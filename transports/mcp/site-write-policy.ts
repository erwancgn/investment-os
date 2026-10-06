import type { McpInputs } from "../../contracts/mcp";
import { isReportInput } from "../../core/analysis/report";
import { isRecord } from "../../core/contracts/common";

/**
 * Sites production WRITE policy, checked after schema validation and before the Core.
 * Domain rules (fields, duplicates, idempotence, Current) stay in the Core and the writer.
 */
export function authorizeSitesWrite(name: keyof McpInputs, raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  if (name === "save_analysis") {
    const input = raw.input;
    // Only the published report form: the Core builds the Analysis. Draft or Validated (Validated promotes Current).
    return isReportInput(input) && (input.status === "Draft" || input.status === "Validated");
  }
  // Field rules and duplicate checks belong to the Core and the writer.
  if (name === "create_company") return isRecord(raw.input);
  return false;
}
