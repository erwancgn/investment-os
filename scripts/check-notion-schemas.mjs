// READ-ONLY. Runs the writer preflight against the live Notion schemas before a
// write campaign. Needs NOTION_TOKEN in the environment; performs GET requests only.
// Usage: NOTION_TOKEN=… node scripts/check-notion-schemas.mjs [--write-fixtures]
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";

const token = process.env.NOTION_TOKEN?.trim();
if (!token) { console.error("NOTION_TOKEN is required (read access only)."); process.exit(2); }
const bundle = await build({ stdin: { contents: 'export * from "./adapters/notion/analysis-writes.ts"; export { notionSources } from "./adapters/notion/sync.ts";', resolveDir: process.cwd() }, bundle: true, write: false, platform: "node", format: "esm" });
const path = `/tmp/check-notion-schemas-${process.pid}.mjs`;
await writeFile(path, bundle.outputFiles[0].text);
const { preflightAnalysisWrite, notionSources } = await import(`file://${path}`).finally(() => unlink(path));
const { input } = await import("../tests/fixtures/notion-write-harness.mjs");

const families = { analyses: ["business", "valuation", "short", "portfolio", "cio_memo"], earnings: ["earnings"] };
let failed = 0;
for (const [source, kinds] of Object.entries(families)) {
  const response = await fetch(`https://api.notion.com/v1/data_sources/${notionSources[source]}`, { headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2026-03-11" } });
  if (!response.ok) { console.error(`${source}: HTTP ${response.status}`); failed++; continue; }
  const schema = await response.json();
  if (process.argv.includes("--write-fixtures")) console.log(`${source}: fixture refresh is manual; compare with tests/fixtures/notion-schemas/${source}.json`);
  for (const kind of kinds) {
    const value = input({ runId: `preflight-${kind}` });
    Object.assign(value.analysis, { kind, verdict: "Preflight", confidence: "High", summary: "Preflight." });
    value.analysis.header.family = kind; value.analysis.header.status = "Draft";
    delete value.analysis.score;
    if (kind === "business" || kind === "valuation") value.analysis.score = "80";
    if (kind === "cio_memo") value.analysis.handoffSummary = "Preflight.";
    if (kind === "earnings") value.analysis.earningsReview = { fiscalPeriod: "Q1", guidance: "Raised", guidanceVsConsensus: "Above", confidence: "High", refreshes: [] };
    const issues = preflightAnalysisWrite(value, schema);
    console.log(`${kind.padEnd(10)} ${issues.length ? `FAIL ${issues.join("; ")}` : "PASS"}`);
    if (issues.length) failed++;
  }
}
process.exit(failed ? 1 : 0);
