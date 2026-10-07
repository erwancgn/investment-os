import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const COMPANY = "company-1";
let selector;

async function api() {
  if (selector) return selector;
  const entry = fileURLToPath(new URL("../core/analysis/current-selection.ts", import.meta.url));
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: "node", format: "esm", metafile: true });
  selector = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  return selector;
}

function candidate(overrides = {}) {
  return {
    id: "analysis-1",
    family: "business",
    sourceKind: "analysis",
    agent: "Business Analyst",
    status: "Validated",
    date: "2026-09-01",
    lastEditedTime: "2026-09-02T10:00:00Z",
    companyIds: [COMPANY],
    sourceFreshness: "unknown",
    archived: false,
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    companyId: COMPANY,
    family: "business",
    explicitCurrentIds: [],
    candidates: [candidate()],
    ...overrides,
  };
}

test("Core selector has no app, transport, React, Notion or LLM imports", async () => {
  const entry = fileURLToPath(new URL("../core/analysis/current-selection.ts", import.meta.url));
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: "node", format: "esm", metafile: true });
  const importedFiles = Object.keys(result.metafile.inputs);
  assert.ok(importedFiles.some(file => file.endsWith("core/analysis/current-selection.ts")));
  const pathParts = importedFiles.map(file => file.split(/[\\/]/));
  assert.ok(pathParts.every(parts => !parts.some(part => ["app", "worker", "adapters", "transport"].includes(part))));
  assert.ok(importedFiles.every(file => !/(react|notion|openai|llm)/i.test(file)));
});

test("an explicit current ID wins over a newer legacy candidate and does not mutate input", async () => {
  const { selectCurrentAnalysis } = await api();
  const explicit = candidate({ id: "older", date: "2025-01-01", lastEditedTime: "2025-01-02T00:00:00Z" });
  const newer = candidate({ id: "newer", date: "2026-09-20", lastEditedTime: "2026-09-21T00:00:00Z" });
  const candidates = [newer, explicit];
  const ids = [explicit.id];
  const before = structuredClone({ candidates, ids });
  const result = selectCurrentAnalysis(input({ explicitCurrentIds: ids, candidates }));

  assert.equal(result.status, "selected");
  assert.equal(result.selectionReason, "explicit_current");
  assert.equal(result.analysis.id, "older");
  assert.deepEqual({ candidates, ids }, before);
});

test("multiple explicit IDs are invalid and never trigger fallback", async () => {
  const { selectCurrentAnalysis } = await api();
  const result = selectCurrentAnalysis(input({
    explicitCurrentIds: ["analysis-1", "another"],
    candidates: [candidate(), candidate({ id: "fallback", date: "2030-01-01" })],
  }));

  assert.equal(result.status, "invalid");
  assert.equal(result.selectionReason, "invalid_explicit_current");
  assert.equal(result.diagnostics[0].code, "multiple_current_references");
});

test("duplicate copies of the same explicit ID count as one relation", async () => {
  const { selectCurrentAnalysis } = await api();
  const result = selectCurrentAnalysis(input({ explicitCurrentIds: ["analysis-1", "analysis-1"] }));
  assert.equal(result.status, "selected");
  assert.equal(result.analysis.id, "analysis-1");
});

test("missing, archived, wrong-owner and wrong-family explicit targets fail closed", async () => {
  const { selectCurrentAnalysis } = await api();
  const cases = [
    { explicitCurrentIds: ["missing"], candidates: [candidate()], code: "current_document_missing" },
    { explicitCurrentIds: ["analysis-1"], candidates: [candidate({ archived: true }), candidate({ id: "fallback" })], code: "current_document_archived" },
    { explicitCurrentIds: ["analysis-1"], candidates: [candidate({ companyIds: ["company-2"] }), candidate({ id: "fallback" })], code: "current_company_mismatch" },
    { explicitCurrentIds: ["analysis-1"], candidates: [candidate({ family: "valuation" }), candidate({ id: "fallback" })], code: "current_family_mismatch" },
    { explicitCurrentIds: ["analysis-1"], candidates: [candidate({ sourceKind: "decision" }), candidate({ id: "fallback" })], code: "current_family_mismatch" },
  ];

  for (const item of cases) {
    const result = selectCurrentAnalysis(input(item));
    assert.equal(result.status, "invalid", item.code);
    assert.equal(result.diagnostics[0].code, item.code);
  }
});

test("a duplicate candidate identity for an explicit pointer is an invalid input", async () => {
  const { selectCurrentAnalysis } = await api();
  const result = selectCurrentAnalysis(input({
    explicitCurrentIds: ["analysis-1"],
    candidates: [candidate(), candidate({ lastEditedTime: "2026-09-03T00:00:00Z" })],
  }));
  assert.equal(result.status, "invalid");
  assert.equal(result.diagnostics[0].code, "duplicate_analysis_id");
});

test("a CIO memo is distinct from a Notion decision and requires its exact validated agent", async () => {
  const { selectCurrentAnalysis } = await api();
  const memo = candidate({ id: "memo", family: "cio_memo", sourceKind: "analysis", agent: " Investment   Memo ", status: " validated " });
  const decision = candidate({ id: "decision", family: "decision", sourceKind: "decision", agent: "Decision", status: "Validated" });

  const selectedMemo = selectCurrentAnalysis(input({ family: "cio_memo", explicitCurrentIds: ["memo"], candidates: [memo, decision] }));
  const selectedDecision = selectCurrentAnalysis(input({ family: "decision", explicitCurrentIds: ["decision"], candidates: [memo, decision] }));
  const wrongMemo = selectCurrentAnalysis(input({ family: "cio_memo", explicitCurrentIds: ["decision"], candidates: [memo, decision] }));
  const rejectedMemo = selectCurrentAnalysis(input({ family: "cio_memo", candidates: [candidate({ id: "draft-memo", family: "cio_memo", agent: "Investment Memo", status: "Draft" })] }));
  const validLegacyMemo = selectCurrentAnalysis(input({ family: "cio_memo", candidates: [memo] }));

  assert.equal(selectedMemo.status, "selected");
  assert.equal(selectedMemo.analysis.id, "memo");
  assert.equal(selectedDecision.status, "selected");
  assert.equal(selectedDecision.analysis.id, "decision");
  assert.equal(wrongMemo.status, "invalid");
  assert.equal(wrongMemo.diagnostics[0].code, "current_family_mismatch");
  assert.equal(rejectedMemo.status, "absent");
  assert.equal(validLegacyMemo.status, "absent");
  assert.equal(validLegacyMemo.diagnostics[0].code, "memo_current_reference_missing");
});

test("ordinary explicit Draft, Rejected and unmapped statuses remain selected with diagnostics", async () => {
  const { selectCurrentAnalysis } = await api();
  for (const [status, code] of [["Draft", "draft_current"], ["Rejected", "rejected_current"], ["Needs review", "unmapped_current_status"]]) {
    const result = selectCurrentAnalysis(input({ explicitCurrentIds: ["analysis-1"], candidates: [candidate({ status })] }));
    assert.equal(result.status, "selected");
    assert.equal(result.analysis.status, status);
    assert.ok(result.diagnostics.some(item => item.code === code));
  }
});

test("fallback ranks Current plus Validated, then Validated, then other non-archived candidates", async () => {
  const { selectCurrentAnalysis } = await api();
  const currentDraft = candidate({ id: "current-draft", sourceFreshness: "fresh", status: "Draft" });
  const validated = candidate({ id: "validated", date: "2025-01-01", status: "Validated" });
  const freshValidated = candidate({ id: "fresh-validated", date: "2020-01-01", sourceFreshness: "fresh", status: "Validated" });
  const rejected = candidate({ id: "rejected", status: "Rejected", date: "2030-01-01" });
  const archived = candidate({ id: "archived", status: "Validated", sourceFreshness: "fresh", archived: true });

  const result = selectCurrentAnalysis(input({ candidates: [rejected, currentDraft, validated, archived, freshValidated] }));
  assert.equal(result.status, "selected");
  assert.equal(result.selectionReason, "legacy_fallback");
  assert.equal(result.analysis.id, "fresh-validated");

  const validatedResult = selectCurrentAnalysis(input({ candidates: [rejected, validated, currentDraft] }));
  assert.equal(validatedResult.status, "selected");
  assert.equal(validatedResult.analysis.id, "validated");

  const otherResult = selectCurrentAnalysis(input({ candidates: [rejected, currentDraft, archived] }));
  assert.equal(otherResult.status, "selected");
  assert.equal(otherResult.analysis.id, "rejected");
});

test("fallback tie order is stable across candidate permutations and uses ascending ID", async () => {
  const { selectCurrentAnalysis } = await api();
  const first = candidate({ id: "analysis-a", date: "2026-09-01", lastEditedTime: "2026-09-02T00:00:00Z" });
  const second = candidate({ id: "analysis-b", date: "2026-09-02", lastEditedTime: "2026-09-01T00:00:00Z" });
  const expectedDatesEqual = candidate({ id: "analysis-c", date: "2026-09-02", lastEditedTime: "2026-09-02T00:00:00Z" });
  const a = selectCurrentAnalysis(input({ candidates: [second, first, expectedDatesEqual] }));
  const b = selectCurrentAnalysis(input({ candidates: [expectedDatesEqual, first, second] }));

  assert.equal(a.status, "selected");
  assert.equal(b.status, "selected");
  assert.equal(a.analysis.id, "analysis-a");
  assert.equal(b.analysis.id, "analysis-a");
});

test("duplicate eligible fallback IDs are invalid independent of input order", async () => {
  const { selectCurrentAnalysis } = await api();
  const duplicateA = candidate({ id: "duplicate" });
  const duplicateB = candidate({ id: "duplicate", date: "2026-09-10" });
  const first = selectCurrentAnalysis(input({ candidates: [duplicateA, duplicateB] }));
  const second = selectCurrentAnalysis(input({ candidates: [duplicateB, duplicateA] }));

  assert.equal(first.status, "invalid");
  assert.equal(second.status, "invalid");
  assert.equal(first.diagnostics[0].code, "duplicate_analysis_id");
  assert.equal(second.diagnostics[0].code, "duplicate_analysis_id");
});

test("fallback uses the latest normalized source date and edit date, and ignores malformed dates", async () => {
  const { selectCurrentAnalysis } = await api();
  const invalid = candidate({ id: "a-invalid", date: "2026-02-30", lastEditedTime: "not-a-date" });
  const valid = candidate({ id: "z-valid", date: "2026-09-02", lastEditedTime: "2026-09-01T00:00:00Z" });
  const latestEdit = candidate({ id: "b-latest-edit", date: "2020-01-01", lastEditedTime: "2026-09-03T00:00:00Z" });
  const relatedDate = candidate({
    id: "c-related-date",
    date: "2026-09-02T12:00:00Z",
    relatedDates: ["2026-09-04T00:00:00Z", "2026-02-30"],
    lastEditedTime: "2026-09-01T00:00:00Z",
  });
  const result = selectCurrentAnalysis(input({ candidates: [valid, invalid, latestEdit, relatedDate] }));

  assert.equal(result.status, "selected");
  assert.equal(result.analysis.id, "c-related-date");
  assert.ok(result.diagnostics.some(item => item.code === "invalid_analysis_date"));

  const noValidDate = selectCurrentAnalysis(input({ candidates: [
    candidate({ id: "z", date: null, lastEditedTime: "invalid" }),
    candidate({ id: "a", date: "bad", lastEditedTime: "also bad" }),
  ] }));
  assert.equal(noValidDate.status, "selected");
  assert.equal(noValidDate.analysis.id, "a");
});

test("company context supports multi-owner analyses without leaking into another company", async () => {
  const { selectCurrentAnalysis } = await api();
  const shared = candidate({ id: "shared", companyIds: [COMPANY, "company-2"] });
  const other = candidate({ id: "other", companyIds: ["company-2"], sourceFreshness: "fresh" });
  const result = selectCurrentAnalysis(input({ candidates: [other, shared] }));

  assert.equal(result.status, "selected");
  assert.equal(result.analysis.id, "shared");
});

test("no explicit pointer and no eligible candidate returns absent", async () => {
  const { selectCurrentAnalysis } = await api();
  const result = selectCurrentAnalysis(input({ candidates: [candidate({ archived: true })] }));
  assert.deepEqual(result, { status: "absent", selectionReason: "no_candidate", diagnostics: [] });
});
