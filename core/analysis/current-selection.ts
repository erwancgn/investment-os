import { isIsoDateOrDateTime, type Diagnostic } from "../contracts/common";
import type { AnalysisFamily, AnalysisHeader } from "../contracts/analysis";

export type CurrentAnalysisFamily = Exclude<AnalysisFamily, "generic" | "unknown">;

/** The company relation is contextual input, not a global flag on an analysis. */
export type CurrentSelectionCandidate = Pick<AnalysisHeader,
  | "id"
  | "family"
  | "sourceKind"
  | "agent"
  | "status"
  | "date"
  | "lastEditedTime"
  | "companyIds"
  | "sourceFreshness"
  | "archived"
> & { relatedDates?: readonly string[] };

export type CurrentSelectionInput = {
  companyId: string;
  family: CurrentAnalysisFamily;
  /** IDs from this company's Current property for the requested family. */
  explicitCurrentIds: readonly string[];
  candidates: readonly CurrentSelectionCandidate[];
};

export type CurrentSelectionResult =
  | {
      status: "selected";
      analysis: CurrentSelectionCandidate;
      selectionReason: "explicit_current" | "legacy_fallback";
      diagnostics: Diagnostic[];
    }
  | {
      status: "absent";
      selectionReason: "no_candidate";
      diagnostics: Diagnostic[];
    }
  | {
      status: "invalid";
      selectionReason: "invalid_explicit_current" | "invalid_candidate_set";
      diagnostics: Diagnostic[];
    };

function diagnostic(code: string, message: string, severity: Diagnostic["severity"] = "warning"): Diagnostic {
  return { code, message, severity };
}

function normalized(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function expectedSourceKind(family: CurrentAnalysisFamily): AnalysisHeader["sourceKind"] {
  return family === "decision" ? "decision" : "analysis";
}

function isMemoAdmissible(candidate: CurrentSelectionCandidate): boolean {
  return normalized(candidate.status) === "validated"
    && normalized(candidate.agent) === "investment memo";
}

function candidateMatchesContext(candidate: CurrentSelectionCandidate, input: CurrentSelectionInput): boolean {
  return candidate.family === input.family
    && candidate.sourceKind === expectedSourceKind(input.family)
    && candidate.companyIds.includes(input.companyId);
}

function statusDiagnostics(candidate: CurrentSelectionCandidate): Diagnostic[] {
  const status = normalized(candidate.status);
  if (status === "draft") return [diagnostic("draft_current", "Le pointeur Current cible une analyse Draft.")];
  if (status === "rejected") return [diagnostic("rejected_current", "Le pointeur Current cible une analyse Rejected.")];
  if (status !== "validated") return [diagnostic("unmapped_current_status", "Le statut Current n'est pas reconnu par la politique de compatibilité.")];
  return [];
}

function parseEffectiveDate(candidate: CurrentSelectionCandidate): { timestamp: number; invalidFields: string[] } {
  const valid: number[] = [];
  const invalidFields: string[] = [];

  const sourceDates = [
    ...(candidate.date === null ? [] : [{ value: candidate.date, field: "date" }]),
    ...(candidate.relatedDates ?? []).map((value, index) => ({ value, field: `relatedDates[${index}]` })),
  ];
  for (const { value, field } of sourceDates) {
    if (isIsoDateOrDateTime(value)) valid.push(Date.parse(value.length === 10 ? `${value}T00:00:00.000Z` : value));
    else invalidFields.push(field);
  }

  if (isIsoDateOrDateTime(candidate.lastEditedTime)) {
    valid.push(Date.parse(candidate.lastEditedTime.length === 10 ? `${candidate.lastEditedTime}T00:00:00.000Z` : candidate.lastEditedTime));
  }
  else invalidFields.push("lastEditedTime");

  return { timestamp: valid.length ? Math.max(...valid) : 0, invalidFields };
}

function dateDiagnostics(candidate: CurrentSelectionCandidate): Diagnostic[] {
  const { invalidFields } = parseEffectiveDate(candidate);
  return invalidFields.map(field => diagnostic(
    "invalid_analysis_date",
    `La date ${field} est invalide et a été ignorée.`,
    "warning",
  ));
}

function invalidExplicit(code: string, message: string): CurrentSelectionResult {
  return {
    status: "invalid",
    selectionReason: "invalid_explicit_current",
    diagnostics: [diagnostic(code, message, "error")],
  };
}

function invalidCandidateSet(code: string, message: string): CurrentSelectionResult {
  return {
    status: "invalid",
    selectionReason: "invalid_candidate_set",
    diagnostics: [diagnostic(code, message, "error")],
  };
}

/**
 * Resolves one company's current analysis without reading or mutating external data.
 * A broken explicit pointer is an error, never permission to silently use fallback.
 */
export function selectCurrentAnalysis(input: CurrentSelectionInput): CurrentSelectionResult {
  const distinctCurrentIds = [...new Set(input.explicitCurrentIds)];
  if (distinctCurrentIds.some(id => !id || id.trim() !== id)) {
    return invalidExplicit("invalid_current_id", "Une référence Current ne respecte pas le format d'ID normalisé.");
  }
  if (distinctCurrentIds.length > 1) {
    return invalidExplicit("multiple_current_references", "Plusieurs références Current distinctes existent pour cette compagnie et cette famille.");
  }

  if (distinctCurrentIds.length === 1) {
    const [explicitId] = distinctCurrentIds;
    const matches = input.candidates.filter(candidate => candidate.id === explicitId);
    if (matches.length === 0) return invalidExplicit("current_document_missing", "La cible du pointeur Current est introuvable.");
    if (matches.length > 1) return invalidExplicit("duplicate_analysis_id", "Plusieurs candidates partagent l'ID du pointeur Current.");

    const candidate = matches[0];
    if (candidate.archived) return invalidExplicit("current_document_archived", "Le pointeur Current cible un document explicitement archivé.");
    if (candidate.family !== input.family || candidate.sourceKind !== expectedSourceKind(input.family)) {
      return invalidExplicit("current_family_mismatch", "Le document Current ne correspond pas à la famille attendue.");
    }
    if (!candidate.companyIds.includes(input.companyId)) {
      return invalidExplicit("current_company_mismatch", "Le document Current n'est pas relié à la compagnie demandée.");
    }
    if (input.family === "cio_memo" && !isMemoAdmissible(candidate)) {
      return invalidExplicit("current_memo_not_admissible", "Le mémo Current doit avoir le statut Validated et l'agent Investment Memo.");
    }

    return {
      status: "selected",
      analysis: candidate,
      selectionReason: "explicit_current",
      diagnostics: [
        ...statusDiagnostics(candidate),
        ...dateDiagnostics(candidate),
      ],
    };
  }

  if (input.family === "cio_memo") {
    return {
      status: "absent",
      selectionReason: "no_candidate",
      diagnostics: [diagnostic(
        "memo_current_reference_missing",
        "Aucune référence Current explicite n'est définie pour le mémo CIO.",
        "info",
      )],
    };
  }

  const fallback = input.candidates.filter(candidate =>
    !candidate.archived
    && candidateMatchesContext(candidate, input),
  );

  if (!fallback.length) {
    return { status: "absent", selectionReason: "no_candidate", diagnostics: [] };
  }
  const candidateIds = new Set<string>();
  for (const candidate of fallback) {
    if (candidateIds.has(candidate.id)) {
      return invalidCandidateSet("duplicate_analysis_id", "Plusieurs candidates admissibles partagent le même ID.");
    }
    candidateIds.add(candidate.id);
  }

  const tier = (candidate: CurrentSelectionCandidate): number => {
    const validated = normalized(candidate.status) === "validated";
    if (candidate.sourceFreshness === "fresh" && validated) return 0;
    if (validated) return 1;
    return 2;
  };
  const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
  const ranked = [...fallback].sort((left, right) => {
    const tierDelta = tier(left) - tier(right);
    if (tierDelta) return tierDelta;
    const leftDate = parseEffectiveDate(left).timestamp;
    const rightDate = parseEffectiveDate(right).timestamp;
    if (leftDate !== rightDate) return rightDate - leftDate;
    return compareIds(left.id, right.id);
  });
  const selected = ranked[0];

  return {
    status: "selected",
    analysis: selected,
    selectionReason: "legacy_fallback",
    diagnostics: [
      diagnostic("legacy_current_fallback", "Aucun pointeur Current explicite; la compatibilité historique a sélectionné cette analyse.", "info"),
      ...statusDiagnostics(selected),
      ...fallback.flatMap(dateDiagnostics),
    ],
  };
}
