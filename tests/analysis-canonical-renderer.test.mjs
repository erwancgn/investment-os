import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = fileURLToPath(new URL("../.test-runtime/lot4-canonical-renderer.mjs", import.meta.url));
let runtime;

const minimalValidProjection = () => {
  const metric = (id, label, value, unit) => ({ id, label, value, unit, status: "known", asOf: "2026-09-29T00:00:00Z", evidenceIds: ["ev-1"] });
  return {
    presentationContractVersion: "1.0.0", analysisType: "valuation",
    identity: { company: "Example Corp", ticker: "EXM", exchange: null, currency: "USD", evidenceIds: ["ev-1"] },
    generatedAt: "2026-09-30T10:00:00Z", reportSha256: "a".repeat(64),
    summary: { text: "Projection vérifiée", evidenceIds: ["ev-1"] },
    facts: [{ id: "revenue", label: "Revenue", value: 42.5, unit: "USD bn", status: "known", asOf: "2026-09-29T00:00:00Z", evidenceIds: ["ev-1"] }],
    scenarios: [{ id: "base", label: "Base", condition: "Thèse maintenue", impact: "Rendement annuel", status: "known", asOf: "2026-09-29T00:00:00Z", evidenceIds: ["ev-1"], terminalValue: metric("terminal", "Terminal price", 1500, "USD"), cagrPercent: metric("cagr", "CAGR", 12.5, "%") }],
    thresholds: [metric("hurdle", "Required return", 12, "%")],
    sources: [{ id: "src-1", title: "Source de référence", url: "https://example.com/source", publishedAt: null, retrievedAt: "2026-09-30T10:00:00Z", asOf: "2026-09-29T00:00:00Z", dataCategory: "other", freshness: "known", provenance: "collected_this_run" }],
    evidence: [{ id: "ev-1", sourceId: "src-1", claim: "Les mesures sont justifiées", locator: "Tableau 1", supportingData: "Revenue 42.5 USD; terminal 1500 USD; CAGR 12.5%; hurdle 12%", supportingDataSha256: "b".repeat(64), captureMethod: "source_retrieval", capturedAt: "2026-09-30T10:00:00Z", asOf: "2026-09-29T00:00:00Z", freshness: "known", freshnessCheckId: "fresh-1" }],
    freshnessChecks: [{ id: "fresh-1", dataCategory: "other", method: "latest_source_search", result: "latest_verified", checkedAt: "2026-09-30T10:00:00Z", checkedSourceIds: ["src-1"], supportingData: "Recherche effectuée", supportingDataSha256: "c".repeat(64), captureMethod: "source_retrieval", capturedAt: "2026-09-30T10:00:00Z", locator: "Search" }],
    provenance: { runId: "run-1", pluginVersion: "1.2.6", contractVersion: "1.2.6" },
  };
};

before(async () => {
  await mkdir(fileURLToPath(new URL("../.test-runtime/", import.meta.url)), { recursive: true });
  await build({
    stdin: {
      contents: [
        'export { AnalysisReader } from "./app/components/analysis-reader.tsx";',
        'export { CompanyAnalysisDocument } from "./app/components/company-analysis-document.tsx";',
        'export { AnalysisProjectionSummary } from "./app/components/analysis-presentation.tsx";',
        'export { parseNotionDocument, canonicalAnalysisContent, hasResidualMarkup } from "./app/lib/notion-renderer.ts";',
        'export { normalizeAnalysisDocument } from "./app/lib/document-presentation.ts";',
        'export { companyPreview } from "./app/lib/company-preview.ts";',
        'export { extractValuationSummary } from "./app/lib/valuation-summary.ts";',
        'export { isAnalysis, isAnalysisContent } from "./core/contracts/analysis.ts";',
        'export { document, completeReferenceDocuments, tsmcValuationDocument, advantestValuationDocument } from "./stories/reference-fixtures.ts";',
      ].join("\n"),
      resolveDir: root,
      sourcefile: "lot4-canonical-renderer-entry.ts",
    },
    bundle: true, platform: "node", format: "esm", packages: "external", outfile: output,
    plugins: [{
      name: "stub-company-resource-hook",
      setup(build) {
        build.onResolve({ filter: /client-resource$/ }, args => args.path.endsWith("client-resource") ? { path: "client-resource", namespace: "company-resource-test" } : undefined);
        build.onLoad({ filter: /.*/, namespace: "company-resource-test" }, () => ({ contents: "export function useClientResource(){ return globalThis.__companyAnalysisResource; }", loader: "js" }));
      },
    }],
  });
  runtime = await import(pathToFileURL(output).href);
});

after(async () => { await rm(output, { force: true }); });

test("a supported paragraph plus an unsupported Notion task both survive normalization", () => {
  const notionBlocks = [
    { id: "paragraph-1", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Thèse conservée" }] } },
    { id: "todo-1", type: "to_do", to_do: { rich_text: [{ plain_text: "Risque à vérifier" }] } },
  ];
  const parsed = runtime.parseNotionDocument("", "", notionBlocks);
  const content = runtime.canonicalAnalysisContent("report-1", parsed);
  assert.equal(runtime.isAnalysisContent(content), true);
  assert.deepEqual(content.blocks.map(block => block.type), ["paragraph", "unsupported"]);
  assert.equal(content.blocks[1].text, "Risque à vérifier");
  assert.deepEqual(content.blocks[1].sourceIds, ["todo-1"]);
});

test("list and table residual markup is detected and cleaned without losing cell text", () => {
  const blocks = [
    { type: "list", ordered: false, items: ["<div>Point important</div>"] },
    { type: "table", rows: [["<td>Seuil</td>", "100 USD"]], header: true },
  ];
  assert.equal(runtime.hasResidualMarkup(blocks), true);
  const content = runtime.canonicalAnalysisContent("report-2", blocks);
  assert.equal(runtime.isAnalysisContent(content), true);
  assert.equal(content.blocks[0].items[0][0].text, "Point important");
  assert.equal(content.blocks[1].rows[0][0][0].text, "Seuil");
});

test("two-column HTML tables become canonical typed table blocks", () => {
  const parsed = runtime.parseNotionDocument("<table><tr><th>KPI</th><th>Valeur</th></tr><tr><td>Rétention</td><td>92 %</td></tr></table>");
  const content = runtime.canonicalAnalysisContent("two-column-html", parsed);
  assert.equal(runtime.isAnalysisContent(content), true);
  assert.equal(content.blocks.length, 1);
  assert.equal(content.blocks[0].type, "table");
  assert.deepEqual(content.blocks[0].rows.map(row => row.map(cell => cell.map(segment => segment.text).join(""))), [
    ["KPI", "Valeur"], ["Rétention", "92 %"],
  ]);
});

test("nested Notion descendants, bookmarks and table descendants retain canonical content and source IDs", () => {
  const notionBlocks = [
    { id: "list-parent", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "Parent" }] }, children: [
      { id: "list-child", type: "numbered_list_item", numbered_list_item: { rich_text: [{ plain_text: "Nested child" }] }, children: [
        { id: "nested-callout", type: "callout", callout: { rich_text: [{ plain_text: "Nested note" }], icon: { type: "emoji", emoji: "📌" } } },
      ] },
    ] },
    { id: "bookmark-1", type: "bookmark", bookmark: { url: "https://example.com/source" } },
    { id: "table-1", type: "table", table: { has_column_header: true }, children: [
      { id: "row-1", type: "table_row", table_row: { cells: [[{ plain_text: "Metric" }], [{ plain_text: "Value" }]] }, children: [
        { id: "row-descendant", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Table note" }] } },
      ] },
    ] },
  ];
  const blocks = runtime.parseNotionDocument("", "", notionBlocks);
  const content = runtime.canonicalAnalysisContent("nested-report", blocks);
  assert.equal(runtime.isAnalysisContent(content), true);
  assert.deepEqual(content.blocks.map(block => block.type), ["list", "list", "callout", "paragraph", "table", "paragraph"]);
  assert.deepEqual(content.blocks.map(block => block.sourceIds), [
    ["list-parent"], ["list-child"], ["nested-callout"], ["bookmark-1"], ["table-1"], ["row-descendant"],
  ]);
  assert.equal(content.blocks[3].text[0].href, "https://example.com/source");
  assert.equal(content.blocks[4].rows[0][1][0].text, "Value");
  assert.equal(content.blocks[5].text[0].text, "Table note");
});

test("adjacent ordered Notion items keep one continuous list and all source IDs", () => {
  const blocks = runtime.parseNotionDocument("", "", ["first", "second"].map(id => ({ id, type: "numbered_list_item", numbered_list_item: { rich_text: [{ plain_text: id }] } })));
  const content = runtime.canonicalAnalysisContent("ordered-report", blocks);
  assert.equal(runtime.isAnalysisContent(content), true);
  assert.equal(content.blocks.length, 1);
  assert.deepEqual(content.blocks[0].sourceIds, ["first", "second"]);
  assert.equal(content.blocks[0].items.length, 2);
  const document = { ...runtime.advantestValuationDocument, summary: null, plainText: "", notionBlocks: ["first", "second"].map(id => ({ id, type: "numbered_list_item", numbered_list_item: { rich_text: [{ plain_text: id }] } })) };
  const html = renderToStaticMarkup(createElement(runtime.AnalysisReader, { document, companyName: "Example" }));
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
});

test("legacy Advantest and partial scenario facts become numeric canonical metrics with source blocks", () => {
  const advantest = runtime.normalizeAnalysisDocument(runtime.advantestValuationDocument).analysis;
  assert.equal(runtime.isAnalysis(advantest), true);
  assert.deepEqual(advantest.presentation.thresholds.map(metric => metric.value), [34234, 31285, 27411]);
  assert.deepEqual(advantest.presentation.thresholds.map(metric => metric.sourceBlockIds.length), [1, 1, 1]);

  const partial = {
    ...runtime.advantestValuationDocument,
    id: "legacy-partial-scenarios",
    plainText: "## Scenarios 5 ans\nScenario | Terminal Price | CAGR annualisé\nBase | ~1.234,5 USD | 12,5 %\nBull | 1.500 USD | 18 %\n## Seuils scénario Base intacte\nHurdle | Prix maximal\n10 % | ~900 USD\n12 % | 800 USD",
    notionBlocks: undefined,
  };
  const normalized = runtime.normalizeAnalysisDocument(partial).analysis;
  assert.equal(runtime.isAnalysis(normalized), true);
  assert.deepEqual(normalized.presentation.scenarios.map(scenario => [scenario.label, scenario.terminalValue?.value ?? null, scenario.cagrPercent?.value ?? null]), [
    ["Base", 1234.5, 12.5], ["Bull", 1500, 18],
  ]);
  assert.deepEqual(normalized.presentation.thresholds.map(metric => metric.value), [900, 800]);
  assert.ok(normalized.presentation.scenarios.every(scenario => scenario.sourceBlockIds.length > 0));
});

test("scenario punctuation variants share valuation-summary extraction and normalize to equal numbers", () => {
  const documents = [
    "Scenario | Terminal Price USD | Shareholder CAGR\nBear | 800.0 | -2.5 %\nBase | 1,234.5 | 12.5 %\nBull | 1,500.0 | 18.0 %",
    "Scenario | Terminal Price USD | Shareholder CAGR\nBear | ~800.0 | -2.5 %\nBase | ~1,234.5 | 12.5 %\nBull | ~1,500.0 | 18.0 %",
    "Scenario | Terminal Price USD | Shareholder CAGR\nBear | 800.0 | -2.5 %\nBase | 1234.5 | 12.5 %\nBull | 1500.0 | 18.0 %",
  ].map((plainText, index) => ({
    ...runtime.advantestValuationDocument, id: `punctuation-${index}`, plainText, notionBlocks: undefined,
  }));
  const extracted = documents.map(document => {
    const normalized = runtime.normalizeAnalysisDocument(document);
    const uniqueExtraction = runtime.extractValuationSummary(runtime.parseNotionDocument(document.plainText, document.title, document.notionBlocks));
    assert.deepEqual(normalized.valuation, uniqueExtraction, "normalizer delegates to valuation-summary extraction");
    return normalized.analysis.presentation.scenarios.map(scenario => [scenario.terminalValue?.value, scenario.cagrPercent?.value]);
  });
  assert.deepEqual(extracted, Array(3).fill([[800, -2.5], [1234.5, 12.5], [1500, 18]]));

  const compactAfterPeriod = runtime.parseNotionDocument("Base: 145 USD / 8 %.");
  const compactSummary = runtime.extractValuationSummary(compactAfterPeriod);
  assert.deepEqual(compactSummary?.scenarios.map(scenario => [scenario.name, scenario.terminal, scenario.cagr]), [["Base", "145 USD", "8 %"]]);
});

test("TL;DR tables remain visible in server-rendered analysis even when not summarized", () => {
  const document = {
    ...runtime.advantestValuationDocument,
    id: "tldr-kpi-table",
    plainText: "## TL;DR\n<table><tr><th>KPI</th><th>Valeur</th></tr><tr><td>Rétention nette</td><td>118 %</td></tr></table>\n## Analyse\nLa rétention nette soutient la thèse.",
    notionBlocks: undefined,
  };
  const html = renderToStaticMarkup(createElement(runtime.AnalysisReader, { document, companyName: "Entreprise" }));
  assert.match(html, /class="notion-table[^"]*"[\s\S]*?<th[^>]*>KPI<\/th>[\s\S]*?<td>Rétention nette<\/td>[\s\S]*?<td[^>]*>118 %<\/td>[\s\S]*?<\/table>/);
  assert.match(html, /La rétention nette soutient la thèse/);
});

test("scenario table with an extra hypothesis column stays visible and is not promoted", () => {
  const document = {
    ...runtime.advantestValuationDocument,
    id: "scenario-table-with-hypothesis",
    plainText: "## Scénarios\nScenario | Terminal Price USD | Shareholder CAGR | Hypothèse clé\nBear | 80 USD | -5 % | Multiples constants\nBase | 150 USD | 10 % | Croissance bénéficiaire\nBull | 250 USD | 18 % | Demande stable",
    notionBlocks: undefined,
  };
  const normalized = runtime.normalizeAnalysisDocument(document);
  assert.deepEqual(normalized.valuation?.promotedBlockIndexes, []);
  const html = renderToStaticMarkup(createElement(runtime.AnalysisReader, { document, companyName: "Entreprise" }));
  assert.match(html, /Hypothèse clé/);
  assert.match(html, /Multiples constants/);
  assert.match(html, /Croissance bénéficiaire/);
  assert.match(html, /Demande stable/);
});

test("horizontal scenarios choose shareholder CAGR over EPS CAGR and retain dividend-inclusive values", () => {
  const blocks = runtime.parseNotionDocument([
    "Hypothèse | Bear | Base | Bull",
    "Valeur terminale, dividendes inclus USD | 80 | 150 | 250",
    "CAGR EPS | 10 % | 13 % | 16 %",
    "CAGR actionnaire total, dividendes inclus | -7.5 % | +10.8 % | +17.5 %",
  ].join("\n"));
  const summary = runtime.extractValuationSummary(blocks);
  assert.deepEqual(summary?.scenarios.map(scenario => [scenario.name, scenario.terminal, scenario.cagr, scenario.terminalLabel]), [
    ["Bear", "80 USD", "-7.5 %", "Valeur à l’horizon, dividendes inclus"],
    ["Base", "150 USD", "+10.8 %", "Valeur à l’horizon, dividendes inclus"],
    ["Bull", "250 USD", "+17.5 %", "Valeur à l’horizon, dividendes inclus"],
  ]);
});

test("invalid legacy dates are diagnosed while the normalized contract stays valid", () => {
  const normalized = runtime.normalizeAnalysisDocument({
    ...runtime.advantestValuationDocument, id: "bad-legacy-dates", date: "2026-02-30", lastEditedTime: "not-a-date",
  }).analysis;
  assert.equal(normalized.header.date, null);
  assert.equal(normalized.header.lastEditedTime, "1970-01-01T00:00:00Z");
  assert.ok(normalized.diagnostics.some(diagnostic => diagnostic.code === "invalid_source_date"));
  assert.equal(runtime.isAnalysis(normalized), true);
});

test("unmapped runtime document categories retain their original family as unknown", () => {
  const normalized = runtime.normalizeAnalysisDocument({
    ...runtime.document, id: "unmapped-runtime-category", category: "new_notion_family",
  }).analysis;
  assert.equal(normalized.kind, "unknown");
  assert.equal(normalized.header.family, "unknown");
  assert.equal(normalized.header.originalFamily, "new_notion_family");
  assert.equal(runtime.isAnalysis(normalized), true);
});

test("company preview keeps the reader summary and removes canonical body from serialized payload", () => {
  const fullDocument = {
    ...runtime.advantestValuationDocument,
    normalizedAnalysis: undefined,
    notionBlocks: [{ id: "private-block", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Full source body" }] } }],
  };
  const company = {
    ...runtime.companyDetail,
    analyses: [fullDocument], earnings: [], decisions: [], portfolioDocuments: [], archives: [],
  };
  const normalized = runtime.normalizeAnalysisDocument(fullDocument);
  const preview = runtime.companyPreview(company);
  const previewDocument = preview.analyses[0];
  assert.deepEqual(previewDocument.previewSummaryItems, normalized.view.summaryItems);
  assert.deepEqual(previewDocument.previewSummaryItems, runtime.normalizeAnalysisDocument(previewDocument).view.summaryItems);
  const payload = JSON.parse(JSON.stringify(preview));
  assert.equal(payload.analyses[0].plainText, "");
  assert.equal("notionBlocks" in payload.analyses[0], false);
  assert.equal("normalizedAnalysis" in payload.analyses[0], false);
  assert.equal("content" in payload.analyses[0], false);
  assert.equal("presentationProjection" in payload.analyses[0], false);
  assert.equal("blocks" in normalized, false);
  const serialized = JSON.parse(JSON.stringify({ ...fullDocument, plainText: "", notionBlocks: undefined, normalizedAnalysis: normalized }));
  assert.equal(renderToStaticMarkup(createElement(runtime.AnalysisReader, { document: serialized, companyName: "Example" })), renderToStaticMarkup(createElement(runtime.AnalysisReader, { document: fullDocument, companyName: "Example" })));
});

test("valid projection evidence hydrates canonical numeric metrics without copying evidenceIds into metric contracts", () => {
  const normalized = runtime.normalizeAnalysisDocument({
    ...runtime.advantestValuationDocument,
    presentationStatus: "valid",
    presentationProjection: minimalValidProjection(),
  }).analysis;
  assert.equal(normalized.projection.status, "valid");
  assert.equal(normalized.summary, "Projection vérifiée");
  assert.equal(runtime.isAnalysis(normalized), true);
  assert.deepEqual(normalized.presentation.facts.map(fact => fact.value), [42.5]);
  assert.deepEqual(normalized.presentation.thresholds.map(metric => metric.value), [12]);
  assert.deepEqual(normalized.presentation.scenarios.map(scenario => [scenario.terminalValue.value, scenario.cagrPercent.value]), [[1500, 12.5]]);
  for (const metric of [normalized.presentation.thresholds[0], normalized.presentation.scenarios[0].terminalValue, normalized.presentation.scenarios[0].cagrPercent]) {
    assert.deepEqual(Object.keys(metric).sort(), ["asOf", "id", "label", "provenance", "sourceBlockIds", "status", "unit", "value"].sort());
  }
});

test("absent, invalid, null, malformed and family-mismatched projections fall back to report content", () => {
  const baseDocument = {
    ...runtime.advantestValuationDocument,
    plainText: "## Seuils du scénario Base intacte\nHurdle | Prix maximal\n10 % | 34 234 JPY\n12 % | 31 285 JPY\n15 % | 27 411 JPY",
    notionBlocks: undefined,
  };
  const cases = [
    { document: baseDocument, expectedProjection: "absent" },
    { document: { ...baseDocument, presentationStatus: "invalid", presentationProjection: null, presentationError: "Projection rejetée" }, expectedProjection: "invalid" },
    { document: { ...baseDocument, presentationStatus: "valid", presentationProjection: null }, expectedProjection: "invalid" },
    { document: { ...baseDocument, presentationStatus: "valid", presentationProjection: { summary: { text: "incomplète" } } }, expectedProjection: "invalid" },
    { document: { ...baseDocument, presentationStatus: "valid", presentationProjection: { ...minimalValidProjection(), analysisType: "earnings" } }, expectedProjection: "invalid" },
  ];
  for (const { document, expectedProjection } of cases) {
    const normalized = runtime.normalizeAnalysisDocument(document).analysis;
    assert.equal(normalized.projection.status, expectedProjection);
    assert.equal(runtime.isAnalysis(normalized), true);
    assert.deepEqual(normalized.presentation.thresholds.map(metric => metric.value), [34234, 31285, 27411]);
    assert.ok(normalized.diagnostics.some(diagnostic => diagnostic.code === "invalid_projection") === (expectedProjection === "invalid"));
  }
});

test("production reader renders the same business structure for distinct companies and keeps family compositions", () => {
  const render = (document, companyName) => renderToStaticMarkup(createElement(runtime.AnalysisReader, { document, companyName }));
  const first = render(runtime.completeReferenceDocuments.business, "Société A");
  const second = render({ ...runtime.completeReferenceDocuments.business, id: "another-report" }, "Société B");
  for (const html of [first, second]) {
    assert.match(html, /data-analysis-template="business"/);
    assert.match(html, /analysis-section-groups/);
    assert.match(html, /Thèse conservée|Une activité de qualité/);
  }
  assert.equal((first.match(/analysis-section-group/g) ?? []).length, (second.match(/analysis-section-group/g) ?? []).length);
  const memo = render(runtime.completeReferenceDocuments.synthese, "Société C");
  assert.match(memo, /memo-decision-card/);
  for (const document of [runtime.completeReferenceDocuments.valuation, runtime.tsmcValuationDocument, runtime.advantestValuationDocument]) {
    assert.match(render(document, "Société de référence"), /analysis-scenario|analysis-projection|analysis-section/);
  }
});

test("CIO memo reasoning keeps canonical links after API serialization", () => {
  const sourceUrl = "https://example.com/decision-source";
  const document = {
    ...runtime.completeReferenceDocuments.synthese,
    id: "cio-reasoning-link",
    plainText: "",
    notionBlocks: [
      { id: "reasoning-heading", type: "heading_2", heading_2: { rich_text: [{ plain_text: "Raisonnement décisif" }] } },
      { id: "reasoning-paragraph", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Source déterminante", href: sourceUrl }] } },
    ],
  };
  const normalized = runtime.normalizeAnalysisDocument(document);
  assert.equal(normalized.memo.reasoning[0].type, "paragraph");
  assert.deepEqual(normalized.memo.reasoning[0].text.map(segment => [segment.text, segment.href]), [["Source déterminante", sourceUrl]]);

  const apiNormalized = JSON.parse(JSON.stringify(normalized));
  assert.equal(apiNormalized.memo.reasoning[0].text[0].href, sourceUrl);
  const serializedDocument = { ...document, plainText: "", notionBlocks: undefined, normalizedAnalysis: apiNormalized };
  const html = renderToStaticMarkup(createElement(runtime.AnalysisReader, { document: serializedDocument, companyName: "Société CIO" }));
  const reasoningHtml = html.match(/<section class="memo-reasoning">([\s\S]*?)<\/section>/)?.[1] ?? "";
  assert.match(reasoningHtml, /<a href="https:\/\/example\.com\/decision-source"[^>]*>Source déterminante<\/a>/);
});

test("CompanyAnalysisDocument accepts validated canonical API bodies and keeps stale content on refresh failure", () => {
  const source = { ...runtime.completeReferenceDocuments.business, id: "embedded-company-report", plainText: "## Thèse\nCanonical body survives the API boundary.", notionBlocks: undefined };
  const normalizedAnalysis = JSON.parse(JSON.stringify(runtime.normalizeAnalysisDocument(source)));
  assert.equal(runtime.isAnalysis(normalizedAnalysis.analysis), true);
  const render = preview => renderToStaticMarkup(createElement(runtime.CompanyAnalysisDocument, { preview, companyName: "Société A" }));
  try {
    globalThis.__companyAnalysisResource = { data: undefined, loading: false, error: "", refresh() {} };
    const embedded = render({ ...source, plainText: "", normalizedAnalysis });
    assert.match(embedded, /Canonical body survives the API boundary/);
    assert.doesNotMatch(embedded, /Document indisponible/);

    const fetched = { ...source, plainText: "", notionBlocks: undefined, normalizedAnalysis };
    globalThis.__companyAnalysisResource = { data: { document: fetched }, loading: false, error: "Rafraîchissement en échec", refresh() {} };
    const stale = render({ ...source, plainText: "", notionBlocks: undefined, normalizedAnalysis: undefined });
    assert.match(stale, /Canonical body survives the API boundary/);
    assert.match(stale, /Rafraîchissement en échec/);
  } finally { delete globalThis.__companyAnalysisResource; }
});

test("CompanyAnalysisDocument rejects wrong-ID or invalid canonical bodies and still accepts legacy text", () => {
  const source = { ...runtime.completeReferenceDocuments.business, id: "embedded-company-report", plainText: "## Thèse\nCanonical body survives the API boundary.", notionBlocks: undefined };
  const normalizedAnalysis = JSON.parse(JSON.stringify(runtime.normalizeAnalysisDocument(source)));
  const invalid = { ...normalizedAnalysis, analysis: { ...normalizedAnalysis.analysis, content: { ...normalizedAnalysis.analysis.content, blocks: null } } };
  const render = () => renderToStaticMarkup(createElement(runtime.CompanyAnalysisDocument, { preview: { ...source, plainText: "", notionBlocks: undefined }, companyName: "Société A" }));
  try {
    globalThis.__companyAnalysisResource = { data: { document: { ...source, id: "another-report", plainText: "", notionBlocks: undefined, normalizedAnalysis } }, loading: false, error: "", refresh() {} };
    assert.match(render(), /Document indisponible/);
    const mismatchedCanonical = { ...normalizedAnalysis, analysis: { ...normalizedAnalysis.analysis, header: { ...normalizedAnalysis.analysis.header, id: "another-canonical-report" } } };
    assert.equal(runtime.isAnalysis(mismatchedCanonical.analysis), true, "the canonical contract remains valid while its internal identity differs");
    globalThis.__companyAnalysisResource = { data: { document: { ...source, plainText: "", notionBlocks: undefined, normalizedAnalysis: mismatchedCanonical } }, loading: false, error: "", refresh() {} };
    assert.match(render(), /Document indisponible/, "the envelope ID guard alone cannot authorize a different canonical body");
    globalThis.__companyAnalysisResource = { data: { document: { ...source, plainText: "", notionBlocks: undefined, normalizedAnalysis: invalid } }, loading: false, error: "", refresh() {} };
    assert.match(render(), /Document indisponible/);
    globalThis.__companyAnalysisResource = { data: undefined, loading: false, error: "", refresh() {} };
    const legacy = renderToStaticMarkup(createElement(runtime.CompanyAnalysisDocument, { preview: { ...source, plainText: "## Thèse\nLegacy text remains supported.", notionBlocks: undefined }, companyName: "Société A" }));
    assert.match(legacy, /Legacy text remains supported/);
  } finally { delete globalThis.__companyAnalysisResource; }
});

test("citation numbers and source list share the same sorted order", () => {
  const source = (id, retrievedAt) => ({ id, title: id, url: `https://example.com/${id}`, retrievedAt, asOf: null, publishedAt: null, freshness: "unknown", provenance: "baseline" });
  const projection = {
    presentationContractVersion: "1.0.0", generatedAt: "2026-09-30T10:00:00Z",
    summary: { text: "Synthèse", evidenceIds: ["old-evidence"] },
    facts: [], scenarios: [], thresholds: [],
    sources: [source("old", "2026-09-01T10:00:00Z"), source("new", "2026-09-30T10:00:00Z")],
    evidence: [{ id: "old-evidence", sourceId: "old" }],
  };
  const html = renderToStaticMarkup(createElement(runtime.AnalysisProjectionSummary, { projection }));
  assert.match(html, /href="#analysis-projection-source-old">\[2\]<\/a>/);
  assert.match(html, /id="analysis-projection-source-new"[\s\S]*>\[1\] new/);
  assert.match(html, /id="analysis-projection-source-old"[\s\S]*>\[2\] old/);
});
