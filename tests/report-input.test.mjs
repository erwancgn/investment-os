// Lot 3 — save_analysis "report" input: the server, not the model, builds the Analysis.
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { withFixture, compact, companyId } from "./fixtures/notion-write-harness.mjs";

let modulePromise;
const api = () => modulePromise ??= build({
  stdin: { contents: 'export * from "./core/analysis/report.ts"; export { createInvestmentCore } from "./core/services/investment-os.ts"; export { isAnalysis } from "./core/contracts/analysis.ts"; export { reportContentRenderer } from "./adapters/notion/investment-reads.ts"; export { parseNotionText, canonicalAnalysisContent } from "./app/lib/notion-renderer.ts";', resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "esm",
}).then(r => import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`));

const markdown = `# Business Check — Fixture SA

## Synthèse

Le chiffre d'affaires atteint 12,4 Md€ en 2025 [E:rev-2025]. La marge **reste** stable.

| Indicateur | 2024 | 2025 |
| --- | --- | --- |
| CA (Md€) | 11,8 | 12,4 |

- Moat : coûts de changement élevés [E:moat-1]
- Risque : cyclicité

---

Sources : [Rapport annuel 2025](https://example.com/ar-2025)`;

function report(extra = {}) {
  return { format: "report", runId: "BC-FIX-20261006", kind: "business", companyId: compact(companyId), title: "Business Check — Fixture SA", date: "2026-10-06", status: "Draft",
    reportMarkdown: markdown, summary: "Qualité élevée, cyclicité modérée.", verdict: "Excellente", confidence: "High", score: 82, ...extra };
}

test("builds a valid Analysis whose body matches the app reader for the same Markdown", async () => {
  const m = await api();
  const result = m.analysisFromReport(report(), m.reportContentRenderer);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal(m.isAnalysis(result.input.analysis), true);
  const reader = m.canonicalAnalysisContent("x", m.parseNotionText(markdown)).blocks;
  const strip = blocks => blocks.map(block => Object.fromEntries(Object.entries(block).filter(([key]) => key !== "id" && key !== "sourceIds")));
  assert.deepEqual(strip(result.input.analysis.content.blocks), strip(reader));
  assert.deepEqual(result.input.companyIds, [compact(companyId)]);
  assert.equal(result.input.expectedRevision, null);
  assert.equal(result.input.analysis.score, "82");
  assert.equal(result.input.analysis.header.agent, "Business Analyst");
});

test("block ids are deterministic and [E:id] markers become sourceIds, others get derived markers", async () => {
  const m = await api();
  const a = m.analysisFromReport(report(), m.reportContentRenderer).input.analysis;
  const b = m.analysisFromReport(report(), m.reportContentRenderer).input.analysis;
  assert.deepEqual(a, b, "same input, same Analysis (writer idempotence relies on it)");
  assert.ok(a.content.blocks.every((block, i) => block.id === `BC-FIX-20261006:business:b${i}`));
  const synth = a.content.blocks.find(block => block.type === "paragraph" && JSON.stringify(block).includes("12,4 Md€"));
  assert.deepEqual(synth.sourceIds, ["rev-2025"]);
  const list = a.content.blocks.find(block => block.type === "list");
  assert.deepEqual(list.sourceIds, ["moat-1"]);
  const heading = a.content.blocks.find(block => block.type === "heading");
  assert.deepEqual(heading.sourceIds, [`derived:BC-FIX-20261006:business:${heading.id.split(":").at(-1)}`]);
});

test("kind-specific fields are enforced and foreign fields refused with the field named", async () => {
  const m = await api();
  const issues = input => m.analysisFromReport(input, m.reportContentRenderer).issues;
  assert.deepEqual(issues(report({ kind: "short", score: 50 })), ["score is only allowed for business and valuation"]);
  assert.deepEqual(issues(report({ handoffSummary: "x" })), ["handoffSummary is only allowed for cio_memo"]);
  assert.deepEqual(issues(report({ score: 82.5 })), ["score must be an integer between 0 and 100"]);
  assert.deepEqual(issues(report({ score: 101 })), ["score must be an integer between 0 and 100"]);
  assert.deepEqual(issues(report({ kind: "earnings", score: undefined })), ["earnings is required for earnings"]);
  const memo = m.analysisFromReport(report({ kind: "cio_memo", score: undefined, handoffSummary: "Conserver." }), m.reportContentRenderer);
  assert.equal(memo.ok, true); assert.equal(memo.input.analysis.handoffSummary, "Conserver."); assert.equal("score" in memo.input.analysis, false);
});

test("earnings report maps refreshes onto the writer contract", async () => {
  const m = await api();
  const result = m.analysisFromReport(report({ kind: "earnings", score: undefined, earnings: { fiscalPeriod: "Q1 FY2026", guidance: "Raised", guidanceVsConsensus: "Above",
    refreshes: { business: "monitor", valuation: "required", short: null, portfolio: "not-needed", memo: "recommended" } } }), m.reportContentRenderer);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  const review = result.input.analysis.earningsReview;
  assert.equal(review.fiscalPeriod, "Q1 FY2026");
  assert.deepEqual(review.refreshes.map(r => [r.key, r.status]), [["business", "monitor"], ["valuation", "required"], ["portfolio", "not-needed"], ["memo", "recommended"]]);
});

test("invalid reports are refused before any write: dates, links, headings, size, empty body", async () => {
  const m = await api();
  const issues = input => m.analysisFromReport(input, m.reportContentRenderer).issues;
  assert.deepEqual(issues(report({ date: "FY2026" })), ["date must be an ISO calendar date (YYYY-MM-DD)"]);
  assert.deepEqual(issues(report({ reportMarkdown: "   " })), ["reportMarkdown is empty"]);
  assert.deepEqual(issues(report({ reportMarkdown: "#### Trop profond\n\nTexte." })), ["heading level 4 or deeper is not supported (block 0)"]);
  assert.deepEqual(issues(report({ reportMarkdown: "x".repeat(400_001) })), ["reportMarkdown exceeds 400000 characters"]);
  const unsafe = m.analysisFromReport(report({ reportMarkdown: "Voir [ici](javascript:alert(1))." }), m.reportContentRenderer);
  assert.equal(unsafe.ok, true);
  const hrefs = JSON.stringify(unsafe.input.analysis.content).match(/"href":"[^"]*"/g) ?? [];
  assert.deepEqual(hrefs, [], "an unsafe link stays visible text, never an href");
});

test("Core routes the report form through the same writer port and receipt validation", async () => {
  const m = await api();
  let seen;
  const core = m.createInvestmentCore({ renderReportContent: m.reportContentRenderer, writeAnalysis: async input => { seen = input; return { schemaVersion: "1.0.0", status: "persisted", analysisId: "page-1", runId: input.runId, revision: "r1", persisted: true, promoted: false, verified: false, diagnostics: [] }; } });
  const ok = await core.saveAnalysis(report());
  assert.equal(ok.status, "ok"); assert.equal(seen.analysis.kind, "business"); assert.equal(seen.runId, "BC-FIX-20261006");
  const bad = await core.saveAnalysis(report({ score: 500 }));
  assert.equal(bad.status, "error"); assert.equal(bad.error.code, "invalid_input");
  assert.deepEqual(bad.metadata.diagnostics.map(d => d.code), ["report_input"]);
  assert.match(bad.metadata.diagnostics[0].message, /score must be an integer/);
  const missing = await m.createInvestmentCore({ writeAnalysis: async () => assert.fail("must not write") }).saveAnalysis(report());
  assert.equal(missing.error.code, "dependency");
});

test("end to end on the fake Notion: a report becomes a Draft that reads back with the same body, replay is idempotent", () => withFixture({}, async f => {
  const service = f.api.createInvestmentService(f.db, f.options);
  // The fixture data source has no Verdict/Confidence/Score columns; the real schema is covered below.
  const minimal = report({ verdict: null, confidence: null, score: null });
  const first = await service.saveAnalysis(minimal);
  assert.equal(first.status, "ok", JSON.stringify(first.metadata?.diagnostics));
  assert.equal(first.data.persisted, true);
  const creates = f.creates;
  const replay = await service.saveAnalysis(minimal);
  assert.equal(replay.status, "ok"); assert.equal(replay.data.analysisId, first.data.analysisId); assert.equal(f.creates, creates, "no second page");
  const read = await service.getAnalysisById(first.data.analysisId);
  assert.equal(read.status, "ok");
  assert.ok(JSON.stringify(read.data.content).includes("12,4 Md€"));
}));

test("diagnostics never echo report text", async () => {
  const m = await api();
  const secret = "SECRET-REPORT-TEXT";
  for (const issue of m.analysisFromReport(report({ reportMarkdown: `#### ${secret}`, date: secret, score: 999 }), m.reportContentRenderer).issues) assert.equal(issue.includes(secret), false, issue);
});

test("every report kind passes the writer preflight against the REAL Notion schemas", () => withFixture({}, async f => {
  const m = await api();
  const schema = async name => JSON.parse(await readFile(new URL(`./fixtures/notion-schemas/${name}.json`, import.meta.url), "utf8"));
  const earnings = { fiscalPeriod: "Q1 FY2026", guidance: "Raised", guidanceVsConsensus: "Above", refreshes: { business: "monitor", valuation: null, short: null, portfolio: null, memo: "recommended" } };
  const cases = [["business", { score: 82 }], ["valuation", { score: 71 }], ["short", { score: undefined }], ["portfolio", { score: undefined }], ["cio_memo", { score: undefined, handoffSummary: "Conserver." }], ["earnings", { score: undefined, earnings }]];
  for (const [kind, extra] of cases) {
    const built = m.analysisFromReport(report({ kind, ...extra }), m.reportContentRenderer);
    assert.equal(built.ok, true, `${kind}: ${built.issues}`);
    assert.deepEqual(f.api.preflightAnalysisWrite(built.input, await schema(kind === "earnings" ? "earnings" : "analyses")), [], kind);
  }
}));

test("review fix: unknown keys are refused without echoing the caller's key", async () => {
  const m = await api();
  const issues = m.analysisFromReport({ ...report(), "<script>x</script>": 1, extra: 2 }, m.reportContentRenderer).issues;
  assert.deepEqual(issues, ["2 unknown report fields"]);
});

test("review fix: the server never claims freshness it cannot know", async () => {
  const m = await api();
  const header = m.analysisFromReport(report(), m.reportContentRenderer).input.analysis.header;
  assert.equal(header.sourceFreshness, "unknown");
});

test("review fix: evidence markers survive inside tables and headings", async () => {
  const m = await api();
  const blocks = m.analysisFromReport(report({ reportMarkdown: "## Marge [E:mg-1]\n\n| KPI | Valeur |\n| --- | --- |\n| Marge | 18 % [E:mg-2] |" }), m.reportContentRenderer).input.analysis.content.blocks;
  assert.deepEqual(blocks.map(b => b.sourceIds), [["mg-1"], ["mg-2"]]);
});

test("review fix: a receipt that still carries the synthesized id is never presented as a page id", async () => {
  const m = await api();
  const receipt = (status, analysisId, extra = {}) => async input => ({ schemaVersion: "1.0.0", status, analysisId: analysisId ?? input.analysis.header.id, runId: input.runId, revision: null, persisted: false, promoted: false, verified: false, diagnostics: [], ...extra });
  const partial = await m.createInvestmentCore({ renderReportContent: m.reportContentRenderer, writeAnalysis: receipt("partial") }).saveAnalysis(report());
  assert.equal(partial.status, "ok", "partial receipt is preserved");
  assert.ok(partial.metadata.diagnostics.some(d => d.code === "analysis_id_unresolved" && d.severity === "warning"));
  const lying = await m.createInvestmentCore({ renderReportContent: m.reportContentRenderer, writeAnalysis: receipt("persisted", undefined, { persisted: true }) }).saveAnalysis(report());
  assert.equal(lying.status, "error"); assert.equal(lying.error.code, "mapping");
});

test("guidanceVsConsensus accepts only the configured Notion options and the error lists them", async () => {
  const m = await api();
  const make = value => report({ kind: "earnings", score: undefined, earnings: { fiscalPeriod: "Q1 FY2026", guidance: "Raised", guidanceVsConsensus: value, refreshes: {} } });
  for (const ok of ["Above", "Inline", "Below", "Not Available", null]) assert.equal(m.analysisFromReport(make(ok), m.reportContentRenderer).ok, true, String(ok));
  for (const bad of ["Above consensus", "In line", "above", "Not Applicable", ""]) {
    const r = m.analysisFromReport(make(bad), m.reportContentRenderer);
    assert.equal(r.ok, false, bad);
    assert.ok(r.issues.some(i => i.includes("earnings.guidanceVsConsensus must be Above, Inline, Below, Not Available or null")), JSON.stringify(r.issues));
    assert.ok(!JSON.stringify(r.issues).includes(bad || "\u0000"), "value is not echoed");
  }
});

const tableMarkdown = rows => `# T\n\n${rows.join("\n")}\n\nFin.`;

test("hardening: a table with ragged rows is completed, never refused, and writes end to end", () => withFixture({}, async f => {
  const m = await api();
  const ragged = tableMarkdown(["| Critère | Score |", "| --- | --- |", "| Business model | 13/15 |", "| Moat |", "| Résilience | 9/10 | extra |"]);
  const built = m.analysisFromReport(report({ reportMarkdown: ragged }), m.reportContentRenderer);
  assert.equal(built.ok, true, built.issues?.join("; "));
  const table = built.input.analysis.content.blocks.find(b => b.type === "table");
  assert.deepEqual([...new Set(table.rows.map(r => r.length))], [3], "every row has the widest row's column count");
  assert.equal(m.isAnalysis(built.input.analysis), true);
  const service = f.api.createInvestmentService(f.db, f.options);
  const saved = await service.saveAnalysis(report({ reportMarkdown: ragged, verdict: null, confidence: null, score: null }));
  assert.equal(saved.status, "ok", JSON.stringify(saved));
}));

test("hardening: provider limits the writer enforces are named field-level issues, not a bare invalid_input", async () => {
  const m = await api();
  const dense = Array.from({ length: 120 }, (_, i) => `**b${i}** t${i}`).join(" ");
  const issues = m.analysisFromReport(report({ reportMarkdown: dense }), m.reportContentRenderer).issues;
  assert.ok(issues.some(issue => /more than 100 formatted segments \(block \d+\)/.test(issue)), issues.join("; "));
  const longUrl = m.analysisFromReport(report({ reportMarkdown: `[x](https://example.com/${"a".repeat(2100)})` }), m.reportContentRenderer).issues;
  assert.ok(longUrl.some(issue => /link longer than 2000 characters \(block \d+\)/.test(issue)), longUrl.join("; "));
  for (const issue of [...issues, ...longUrl]) assert.equal(issue.includes("aaaa"), false, "never echoes content");
});

test("hardening: a provider refusal that reaches the Core carries a diagnostic naming the rule", async () => {
  const m = await api();
  const core = m.createInvestmentCore({ renderReportContent: m.reportContentRenderer, writeAnalysis: async () => { throw Object.assign(new Error("x"), { code: "invalid_input", detail: "table rows have different column counts" }); } });
  const result = await core.saveAnalysis(report());
  assert.equal(result.error.code, "invalid_input");
  assert.deepEqual(result.metadata.diagnostics.map(d => d.code), ["write_input"]);
  assert.match(result.metadata.diagnostics[0].message, /table rows have different column counts/);
});

test("regression (Xiaomi Business): '<' and '>' in prose or table cells are text, never a tag that swallows what lies between", async () => {
  const m = await api();
  const markdown = [
    "# Surveillance", "",
    "| KPI | Seuil d'alerte |", "|---|---|", "| Marge brute smartphones | maintien <10 % |", "| Livraisons | croissance <10 % YoY |", "",
    "| Source | Niveau |", "|---|---|", "| IoT | >1.16 Md appareils |", "",
    "Si a < b et c > d, la phrase reste entière.",
  ].join("\n");
  const built = m.analysisFromReport(report({ reportMarkdown: markdown }), m.reportContentRenderer);
  assert.equal(built.ok, true, built.issues?.join("; "));
  const blocks = built.input.analysis.content.blocks;
  const tables = blocks.filter(b => b.type === "table");
  assert.equal(tables.length, 2, "two separate tables stay separate");
  for (const table of tables) assert.equal(new Set(table.rows.map(r => r.length)).size, 1, "no ragged row");
  const flat = JSON.stringify(blocks);
  for (const kept of ["maintien <10 %", "croissance <10 % YoY", ">1.16 Md appareils", "a < b et c > d"]) assert.ok(flat.includes(kept), `lost: ${kept}`);
  assert.deepEqual(built.input.analysis.diagnostics, [], "nothing had to be completed");
});

test("real tags are still stripped", async () => {
  const m = await api();
  const built = m.analysisFromReport(report({ reportMarkdown: "Texte <b>gras</b> et <br/> suite <mention-page url=\"https://x.com\"/>" }), m.reportContentRenderer);
  const flat = JSON.stringify(built.input.analysis.content.blocks);
  assert.equal(flat.includes("<b>"), false); assert.equal(flat.includes("<br"), false);
});

test("a ragged table is completed and the receipt carries a warning", async () => {
  const m = await api();
  const built = m.analysisFromReport(report({ reportMarkdown: "| A | B |\n|---|---|\n| 1 |\n| 2 | 3 |" }), m.reportContentRenderer);
  assert.deepEqual(built.input.analysis.diagnostics.map(d => d.code), ["table_rows_completed"]);
  assert.equal(m.isAnalysis(built.input.analysis), true);
});

test("regression: the exact Xiaomi Business report (13.8k chars) saves end to end, nothing lost, nothing to complete", () => withFixture({}, async f => {
  const markdown = await readFile(new URL("./fixtures/xiaomi-business-report.md", import.meta.url), "utf8");
  const m = await api();
  const built = m.analysisFromReport(report({ reportMarkdown: markdown }), m.reportContentRenderer);
  assert.equal(built.ok, true, built.issues?.join("; "));
  assert.deepEqual(built.input.analysis.diagnostics, []);
  for (const table of built.input.analysis.content.blocks.filter(b => b.type === "table")) assert.equal(new Set(table.rows.map(r => r.length)).size, 1);
  const flat = JSON.stringify(built.input.analysis.content.blocks);
  for (const kept of ["maintien <10 %", "croissance <10 %", "<10 % YoY", "Base installée >1.16 Md", ">1.16 Md appareils connectés", "baisse >10 % prolongée"]) assert.ok(flat.includes(kept), `lost: ${kept}`);
  const saved = await f.api.createInvestmentService(f.db, f.options).saveAnalysis(report({ reportMarkdown: markdown, verdict: null, confidence: null, score: null }));
  assert.equal(saved.status, "ok", JSON.stringify(saved));
}));

test("reader: a GFM delimiter row with short dashes (|-|-:|) is the separator, not a data row; a lone '-' cell below it is data", async () => {
  const m = await api();
  const md = ["| Élément | Résultat |", "|-|-:|", "| CAGR base | +9,1 % |", "| Dividende | - |"].join("\n");
  const table = m.parseNotionText(md).find(block => block.type === "table");
  assert.deepEqual(table.rows, [["Élément", "Résultat"], ["CAGR base", "+9,1 %"], ["Dividende", "-"]]);
});

test("hardening: a replay whose report differs by one character is refused with a diagnostic naming the digest rule, no second page", () => withFixture({}, async f => {
  const service = f.api.createInvestmentService(f.db, f.options);
  const minimal = report({ verdict: null, confidence: null, score: null });
  const first = await service.saveAnalysis(minimal);
  assert.equal(first.status, "ok");
  const creates = f.creates;
  const replay = await service.saveAnalysis({ ...minimal, reportMarkdown: minimal.reportMarkdown.replace("12,4 Md€", "12,5 Md€") });
  assert.equal(replay.status, "error");
  assert.equal(replay.error.code, "stale_request");
  const diag = replay.metadata.diagnostics.find(d => d.code === "write_stale");
  assert.ok(diag && /^digest:/.test(diag.message), JSON.stringify(replay.metadata.diagnostics));
  assert.equal(JSON.stringify(replay).includes("Fixture SA"), false, "never echoes report text");
  assert.equal(f.creates, creates, "no second page");
}));

test("latency: a Validated long report certifies its body with few full reads (each read costs one round trip per table on real Notion)", () => withFixture({}, async f => {
  const service = f.api.createInvestmentService(f.db, f.options);
  const table = n => ["| Donnée | Valeur |", "| --- | --- |", ...Array.from({ length: 6 }, (_, i) => `| L${n}.${i} | ${i} |`)].join("\n\n".slice(0, 1));
  const parts = ["# Rapport", "Intro."];
  for (let t = 0; t < 11; t++) { parts.push(`# S${t}`, table(t)); for (let p = 0; p < 12; p++) parts.push(`Paragraphe ${t}.${p} [E:V${p}].`); }
  const saved = await service.saveAnalysis({ format: "report", runId: "LAT-FIX-20261006", kind: "business", companyId: compact(companyId), title: "Business Check — Fixture SA", date: "2026-10-06", status: "Validated", reportMarkdown: parts.join("\n\n"), summary: "R.", verdict: null, confidence: null, score: null });
  assert.equal(saved.status, "ok", JSON.stringify(saved.metadata?.diagnostics));
  assert.equal(saved.data.verified, true);
  const reads = f.calls.filter(c => c.method === "GET" && /\/blocks\/[^/]+\/children/.test(c.path)).length;
  assert.ok(reads <= 5, `expected at most 5 body page reads, got ${reads}`);
}));
