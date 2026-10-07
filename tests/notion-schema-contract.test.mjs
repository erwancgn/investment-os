// Contract between the writer's property mapping and the REAL Notion schemas
// (captured read-only, see tests/fixtures/notion-schemas). Runs without network.
// Refresh fixtures with scripts/check-notion-schemas.mjs before each write campaign.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fixture, input } from "./fixtures/notion-write-harness.mjs";

const schema = async name => JSON.parse(await readFile(new URL(`./fixtures/notion-schemas/${name}.json`, import.meta.url), "utf8"));
const api = async () => { const f = await fixture(); f.sql.close(); return f.api; };

function draft(kind, extra = {}) {
  const value = input({ runId: `contract-${kind}` });
  const a = value.analysis;
  a.kind = kind; a.header.family = kind; a.header.status = "Draft";
  a.verdict = "Fixture verdict"; a.confidence = "High"; a.summary = "Fixture summary.";
  delete a.score;
  if (kind === "business" || kind === "valuation") a.score = "82";
  if (kind === "cio_memo") a.handoffSummary = "Fixture handoff.";
  if (kind === "earnings") a.earningsReview = { fiscalPeriod: "Q1 FY2026", guidance: "Raised", guidanceVsConsensus: "Above", confidence: "High",
    refreshes: ["business", "valuation", "short", "portfolio", "memo"].map(key => ({ key, label: key, status: "monitor", rawValue: "Monitor" })) };
  Object.assign(a, extra);
  return value;
}

for (const kind of ["business", "valuation", "short", "portfolio", "cio_memo"]) {
  test(`${kind} maps onto the real Analyses schema without issue`, async () => {
    const { preflightAnalysisWrite } = await api();
    assert.deepEqual(preflightAnalysisWrite(draft(kind), await schema("analyses")), []);
  });
}

test("earnings maps onto the real Earnings schema migrated on 2026-10-06", async () => {
  const { preflightAnalysisWrite } = await api();
  assert.deepEqual(preflightAnalysisWrite(draft("earnings"), await schema("earnings")), []);
});

test("the pre-migration Earnings schema reproduces the Micron mapping failure exactly", async () => {
  const { preflightAnalysisWrite } = await api();
  const before = await schema("earnings");
  for (const name of ["Run ID", "Agent", "Status", "Verdict"]) delete before.properties[name];
  const issues = preflightAnalysisWrite(draft("earnings"), before);
  for (const name of ["Run ID", "Agent", "Status", "Verdict"]) assert.ok(issues.some(issue => issue.includes(name)), `${name} missing from ${issues.join("; ")}`);
});

test("Analyses Score is numeric: a textual score like 89/100 is refused with the field named", async () => {
  const { preflightAnalysisWrite } = await api();
  const issues = preflightAnalysisWrite(draft("business", { score: "89/100" }), await schema("analyses"));
  assert.deepEqual(issues, ["Score has a non-numeric value (expected number)"]);
});

test("known gap: Investment Decisions is not writable by the writer (no Run ID, Agent, Draft status)", async () => {
  const { preflightAnalysisWrite } = await api();
  const issues = preflightAnalysisWrite(draft("decision", { decision: { schemaVersion: "1.0.0", action: "Hold" } }), await schema("decisions"));
  assert.ok(issues.some(issue => issue.includes("Run ID")));
  assert.ok(issues.some(issue => issue.includes("Agent")));
  assert.ok(issues.some(issue => issue.startsWith("Status has an unsupported select option")));
});

test("preflight issues never echo payload values", async () => {
  const { preflightAnalysisWrite } = await api();
  const secret = "PRIVATE-VALUE-42";
  const value = draft("business", { score: secret, verdict: secret });
  value.runId = secret; value.analysis.header.title = secret;
  for (const issue of preflightAnalysisWrite(value, await schema("earnings"))) assert.equal(issue.includes(secret), false, issue);
});
