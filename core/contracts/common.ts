/** Version for canonical domain contracts. Independent from plugin and presentation versions. */
export const SCHEMA_VERSION = "1.0.0" as const;

export type DiagnosticSeverity = "info" | "warning" | "error";
export type Diagnostic = {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  path?: string;
};

export type ProvenanceKind = "notion" | "legacy" | "projection" | "derived";
export type Provenance = {
  kind: ProvenanceKind;
  sourceId: string | null;
  revision: string | null;
  capturedAt: string | null;
};

export type Freshness = "fresh" | "stale" | "unknown";
export type ServiceMetadata = {
  revision: string | null;
  freshness: Freshness;
  provenance: Provenance | null;
  diagnostics: Diagnostic[];
};
export type ServiceError = {
  code: ServiceErrorCode;
  message: string;
  retryable: boolean;
};
export type ServiceErrorCode =
  | "invalid_input" | "unsupported_version" | "not_found" | "unauthorized" | "forbidden"
  | "mapping" | "normalization" | "storage" | "dependency" | "rate_limit" | "timeout"
  | "network" | "cache" | "stale_request";
export type ServiceResult<T> =
  | { schemaVersion: typeof SCHEMA_VERSION; status: "ok"; data: T; metadata: ServiceMetadata }
  | { schemaVersion: typeof SCHEMA_VERSION; status: "error"; error: ServiceError; metadata: ServiceMetadata };

export type Validator<T> = (value: unknown, now?: number) => value is T;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isEnumValue<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

/** Valid calendar date in ISO YYYY-MM-DD form; optional reference time makes future checks deterministic. */
export function isIsoDate(value: unknown, now?: number): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) return false;
  return now === undefined || (Number.isFinite(now) && parsed <= now);
}

/** Valid timezone-qualified ISO timestamp; if now is supplied, timestamps cannot be future dated. */
export function isIsoDateTime(value: unknown, now?: number): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!match) return false;
  const [, date, hour, minute, second, zone, , offsetHour, offsetMinute] = match;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  if (zone !== "Z" && (Number(offsetHour) > 14 || Number(offsetMinute) > 59 || (Number(offsetHour) === 14 && Number(offsetMinute) !== 0))) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  if (!isIsoDate(date)) return false;
  return now === undefined || (Number.isFinite(now) && parsed <= now);
}

export function isIsoDateOrDateTime(value: unknown, now?: number): value is string {
  return isIsoDate(value, now) || isIsoDateTime(value, now);
}

export function isStringArray(value: unknown, allowEmpty = true): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(item => typeof item === "string");
}

/** Portable links may be HTTP(S), but may not contain credentials or use executable/local schemes. */
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateDiagnostic(value: unknown): value is Diagnostic {
  if (!isRecord(value)) return false;
  const keys = value.path === undefined ? ["code", "message", "severity"] : ["code", "message", "severity", "path"];
  return hasExactKeys(value, keys)
    && isNonEmptyString(value.code)
    && isNonEmptyString(value.message)
    && isEnumValue(value.severity, ["info", "warning", "error"] as const)
    && (value.path === undefined || typeof value.path === "string");
}

export function validateProvenance(value: unknown, now?: number): value is Provenance {
  return hasExactKeys(value, ["kind", "sourceId", "revision", "capturedAt"])
    && isEnumValue(value.kind, ["notion", "legacy", "projection", "derived"] as const)
    && isNullableString(value.sourceId)
    && isNullableString(value.revision)
    && (value.capturedAt === null || isIsoDateTime(value.capturedAt, now));
}

export function validateServiceMetadata(value: unknown, now?: number): value is ServiceMetadata {
  if (!hasExactKeys(value, ["revision", "freshness", "provenance", "diagnostics"])) return false;
  return isNullableString(value.revision)
    && isEnumValue(value.freshness, ["fresh", "stale", "unknown"] as const)
    && (value.provenance === null || validateProvenance(value.provenance, now))
    && Array.isArray(value.diagnostics)
    && value.diagnostics.every(validateDiagnostic);
}

export function validateServiceResult<T>(value: unknown, validateData: Validator<T>, now?: number): value is ServiceResult<T> {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION || !validateServiceMetadata(value.metadata, now)) return false;
  if (value.status === "ok") {
    return hasExactKeys(value, ["schemaVersion", "status", "data", "metadata"])
      && validateData(value.data, now);
  }
  if (value.status === "error") {
    return hasExactKeys(value, ["schemaVersion", "status", "error", "metadata"])
      && hasExactKeys(value.error, ["code", "message", "retryable"])
      && isEnumValue(value.error.code, ["invalid_input", "unsupported_version", "not_found", "unauthorized", "forbidden", "mapping", "normalization", "storage", "dependency", "rate_limit", "timeout", "network", "cache", "stale_request"] as const)
      && isNonEmptyString(value.error.message)
      && typeof value.error.retryable === "boolean";
  }
  return false;
}
