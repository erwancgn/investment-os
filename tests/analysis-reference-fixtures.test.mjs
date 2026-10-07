import assert from "node:assert/strict";
import { access, mkdir, readFile, rm } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { uxCssFiles } from "../scripts/css-file-manifest.mjs";

const fixtureUrl = new URL("../app/data/analysis-reference-fixtures.json", import.meta.url);
const rendererUrl = new URL("../app/lib/notion-renderer.ts", import.meta.url);
const templateUrl = new URL("../app/data/analysis-template-registry.json", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);
const workerSourceUrl = new URL("../worker/index.ts", import.meta.url);
const dataUrl = new URL("../adapters/notion/investment-data.ts", import.meta.url);
const navigationUrl = new URL("../app/lib/app-navigation.tsx", import.meta.url);
const syncUrl = new URL("../adapters/notion/sync.ts", import.meta.url);
const companyDetailUrl = new URL("../app/components/company-detail.tsx", import.meta.url);
const liveHoldingSummaryUrl = new URL("../app/components/live-holding-summary.tsx", import.meta.url);
const analysisReaderUrl = new URL("../app/components/analysis-reader.tsx", import.meta.url);
const memoReaderUrl = new URL("../app/components/investment-memo-reader.tsx", import.meta.url);
const presentationUrl = new URL("../app/lib/document-presentation.ts", import.meta.url);
const presentationFixturesUrl = new URL("../app/data/document-presentation-fixtures.json", import.meta.url);
const latestInfoUrl = new URL("../app/components/latest-info-card.tsx", import.meta.url);
const notionTableUrl = new URL("../app/components/notion-table.tsx", import.meta.url);
const companiesUrl = new URL("../app/components/notion-companies.tsx", import.meta.url);
const uxUrls = uxCssFiles.map(file => new URL(`../${file}`, import.meta.url));
const readUxSource = async () => (await Promise.all(uxUrls.map(url => readFile(url, "utf8")))).join("\n");
const globalsUrl = new URL("../app/globals.css", import.meta.url);
const designSystemUrl = new URL("../app/design-system.css", import.meta.url);
const uiPrimitivesUrl = new URL("../app/components/ui-primitives.tsx", import.meta.url);
const uiManifestUrl = new URL("../ui-foundation-manifest.md", import.meta.url);
const primitiveStoriesUrl = new URL("../stories/UIPrimitives.stories.tsx", import.meta.url);
const referenceFrameUrl = new URL("../stories/reference-frame.tsx", import.meta.url);
const referenceStoryUrls = Object.fromEntries(
  ["Companies", "Company", "Portfolio"].map((name) => [name, new URL(`../stories/${name}.stories.tsx`, import.meta.url)]),
);
const analysisPresentationUrl = new URL("../app/components/analysis-presentation.tsx", import.meta.url);
const liveDashboardUrl = new URL("../app/components/live-portfolio-dashboard.tsx", import.meta.url);

async function pathExists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

test("analysis reference registry covers the six canonical Notion templates", async () => {
  const registry = JSON.parse(await readFile(fixtureUrl, "utf8"));
  assert.equal(registry.contractVersion, "1.0");
  assert.deepEqual(
    registry.references.map((reference) => reference.kind),
    ["earnings", "business", "valuation", "portfolio", "short", "investment_memo"],
  );

  for (const reference of registry.references) {
    assert.match(reference.notionPageId, /^[0-9a-f-]{36}$/i);
    assert.ok(reference.expected.tablesMin >= 0);
    assert.ok(Array.isArray(reference.expected.requiredSections));
    assert.ok(reference.expected.requiredSections.includes("TL;DR"));
  }
});

test("TSMC and Advantest display fixtures preserve the reviewed valuation examples", async () => {
  const registry = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const tsmc = registry.renderingCases.find((item) => item.id === "tsmc-valuation-mobile-first");
  const advantest = registry.renderingCases.find((item) => item.id === "advantest-valuation-jpy");
  assert.ok(tsmc, "TSMC reference example is available to tests and Storybook");
  assert.ok(advantest, "Advantest JPY example is available to tests and Storybook");
  assert.deepEqual([tsmc.referencePrice, tsmc.referenceDate, tsmc.horizon], ["451,89 USD", "22/09/2026", "5 ans"]);
  assert.deepEqual(tsmc.scenarios.map(({ name, terminal, cagr }) => [name, terminal, cagr]), [
    ["Bear", "409,55 USD", "−1,95 %/an"],
    ["Base", "724,69 USD", "9,91 %/an"],
    ["Bull", "973,98 USD", "16,60 %/an"],
  ]);
  assert.deepEqual(tsmc.thresholds.map(({ rate, price }) => [rate, price]), [
    ["10 %", "449,98 USD"], ["12 %", "411,21 USD"], ["15 %", "360,30 USD"],
  ]);
  assert.equal(tsmc.expectedReading, "Base : 9,91 %/an, sous l’objectif de 12 %/an au cours de référence.");
  assert.deepEqual([advantest.referencePrice, advantest.referenceDate, advantest.score], ["33 060 JPY", "24/09/2026", "55/100"]);
  assert.deepEqual(advantest.thresholds.map(({ rate, price }) => [rate, price]), [
    ["10 %", "34 234 JPY"], ["12 %", "31 285 JPY"], ["15 %", "27 411 JPY"],
  ]);

  const presentationContract = JSON.parse(await readFile(presentationFixturesUrl, "utf8")).displayContract;
  assert.deepEqual(presentationContract.embeddedFamilies, ["business", "valuation", "short", "portfolio", "investment_memo", "earnings"]);
  assert.deepEqual(presentationContract.viewports, ["mobile", "tablet", "desktop"]);
  assert.equal(presentationContract.mobileThreeItemLayout, "stacked-full-width");
  assert.equal(presentationContract.scenarioAndThresholdTablesScrollable, false);
  assert.equal(presentationContract.denseMatricesScrollable, true);
  assert.equal(presentationContract.runReceiptVisible, false);
  assert.equal(presentationContract.scoreExample, "55/100");
  assert.equal(presentationContract.sourceDetailsPosition, "after-analysis-content");
});

test("TSMC fixture values are extracted as scenarios and thresholds without changing their meaning", async () => {
  const { extractValuationSummary } = await import("../app/lib/valuation-summary.ts");
  const { renderingCases } = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const tsmc = renderingCases.find((item) => item.id === "tsmc-valuation-mobile-first");
  const blocks = [
    { type: "heading", level: 2, text: `Scénarios · horizon ${tsmc.horizon}` },
    { type: "table", header: true, rows: [
      ["Mesure · horizon 5 ans", "Bear", "Base", "Bull"],
      ["Prix terminal estimé · USD", ...tsmc.scenarios.map((item) => item.terminal.replace(/\s*USD$/, ""))],
      ["CAGR actionnaire · %/an", ...tsmc.scenarios.map((item) => item.cagr)],
    ] },
    { type: "heading", level: 2, text: "Seuils du scénario Base intacte" },
    { type: "table", header: true, rows: [
      ["Rendement exigé", "Prix maximal"],
      ...tsmc.thresholds.map((item) => [item.rate, item.price]),
    ] },
  ];
  const summary = extractValuationSummary(blocks);
  assert.deepEqual(summary?.scenarios.map(({ name, terminal, cagr }) => [name, terminal, `${cagr}/an`]),
    tsmc.scenarios.map(({ name, terminal, cagr }) => [name, terminal, cagr]));
  assert.deepEqual(summary?.thresholds.map(({ rate, price }) => ({ rate, price })), tsmc.thresholds);
  assert.deepEqual(summary?.promotedBlockIndexes, [1, 3]);
});

test("runtime routes and package identity have no isolated legacy template remnants", async () => {
  const workerSource = await readFile(workerSourceUrl, "utf8");
  const packageSource = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(workerSource, /url\.pathname === ["']\/api\/quotes["']/);
  assert.equal(await pathExists(new URL("../app/api/quotes/route.ts", import.meta.url)), false);
  assert.equal(await pathExists(new URL("../examples/d1/", import.meta.url)), false);
  assert.equal(await pathExists(new URL("../db/index.ts", import.meta.url)), false);
  assert.equal(packageSource.name, "investment-os");
  assert.equal(packageSource.displayName, "Investment OS");
});

test("the unified renderer is the documented parser entry point", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /export function parseNotionDocument/);
  assert.match(source, /export function parseNotionText/);
  assert.match(source, /parseNotionBlocks\(notionBlocks\)/);
  assert.match(source, /rowsFrom/);
});

test("the semantic template registry covers every company section", async () => {
  const registry = JSON.parse(await readFile(templateUrl, "utf8"));
  assert.equal(registry.contractVersion, "1.0");
  for (const kind of ["earnings", "business", "valuation", "portfolio", "risques", "synthese", "analyses", "universal"]) {
    assert.ok(registry.templates[kind], `missing template ${kind}`);
    assert.ok(Array.isArray(registry.templates[kind].preferredBlocks));
  }
});

test("valuation scenario extraction keeps terminal prices, CAGR and thresholds distinct", async () => {
  const { extractValuationSummary } = await import("../app/lib/valuation-summary.ts");
  const columns = [
    { type: "heading", level: 2, text: "Scénarios 5 ans" },
    { type: "table", header: true, rows: [
      ["Mesure · horizon 5 ans", "Bear", "Base", "Bull"],
      ["Prix terminal estimé · USD", "409,55", "724,69", "973,98"],
      ["CAGR actionnaire · %/an", "−1,95 %", "9,91 %", "16,60 %"],
    ] },
    { type: "heading", level: 2, text: "Seuils du scénario Base" },
    { type: "paragraph", text: "Hurdle 10 % : 449,98 USD ; 12 % : 411,21 USD ; 15 % : 360,30 USD." },
    { type: "paragraph", text: "Prix conditionnels à la thèse Base intacte." },
  ];
  const summary = extractValuationSummary(columns);
  assert.deepEqual(summary?.scenarios.map(item => [item.name, item.terminal, item.cagr]), [
    ["Bear", "409,55 USD", "−1,95 %"], ["Base", "724,69 USD", "9,91 %"], ["Bull", "973,98 USD", "16,60 %"],
  ]);
  assert.deepEqual(summary?.thresholds.map(({ rate, price }) => ({ rate, price })), [{ rate: "10 %", price: "449,98 USD" }, { rate: "12 %", price: "411,21 USD" }, { rate: "15 %", price: "360,30 USD" }]);
  assert.equal(summary?.horizon, "5 ans");
  const rows = [
    { type: "heading", level: 2, text: "Scénarios 5 ans" },
    { type: "table", header: true, rows: [
      ["", "Scénario", "Prix terminal", "CAGR annualisé", ""],
      ["", "---", "---:", "---:", ""],
      ["", "Bear", "80 USD", "-4 %/an", ""],
      ["", "Base", "145 USD", "8 %/an", ""],
      ["", "Bull", "205 USD", "15 %/an", ""],
    ] },
    { type: "heading", level: 2, text: "Seuils de rendement · Base intacte" },
    { type: "table", header: true, rows: [
      ["", "Objectif annuel", "Cours conditionnel", ""],
      ["", "---", "---:", ""],
      ["", "10 %", "94 USD", ""],
      ["", "12 %", "86 USD", ""],
      ["", "15 %", "75 USD", ""],
    ] },
  ];
  assert.deepEqual(extractValuationSummary(rows)?.thresholds.map(({ rate, price }) => ({ rate, price })), [
    { rate: "10 %", price: "94 USD" }, { rate: "12 %", price: "86 USD" }, { rate: "15 %", price: "75 USD" },
  ]);
  const unlabeledPrice = extractValuationSummary([{ type: "table", header: true, rows: [["Scénario", "Prix terminal", "CAGR"], ["Base", "120", "9 %"]] }]);
  assert.equal(unlabeledPrice?.scenarios[0]?.terminal, undefined);
  assert.equal(unlabeledPrice?.scenarios[0]?.cagr, "9 %");
  assert.deepEqual(unlabeledPrice?.promotedBlockIndexes, []);
});

test("metadata discovery queues only missing or edited Notion pages", async () => {
  const syncSource = await readFile(syncUrl, "utf8");
  assert.match(syncSource, /queryDataSource\(token,dataSourceId,cursor,100\)/);
  assert.match(syncSource, /!existing\|\|forceRefresh\|\|existing\.last_edited_time/);
  assert.match(syncSource, /existing\.last_edited_time!==String\(page\.last_edited_time/);
  assert.match(syncSource, /statements\.push\(importJobStatement/);
  assert.match(syncSource, /cursor=result\.has_more/);
  assert.match(syncSource, /timestamp: "last_edited_time", direction: "descending"/);
  assert.match(syncSource, /processNextNotionImport/);
  assert.match(syncSource, /maximumRequests=4/);
  assert.doesNotMatch(syncSource, /readBlockTree/);
});

test("large Notion imports are durable, bounded and atomically published", async () => {
  const syncSource = await readFile(syncUrl, "utf8");
  const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0003_notion_import_jobs.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE `notion_import_jobs`/);
  assert.match(migration, /`work_json` text DEFAULT '\[\]'/);
  assert.match(migration, /`lease_until` text/);
  assert.match(syncSource, /requests<Math\.min\(Math\.max\(maximumRequests,1\),6\)/);
  assert.match(syncSource, /UPDATE notion_import_jobs SET blocks_json=\?,work_json=\?/);
  assert.match(syncSource, /documentUpsertStatement\(db,job\.source_key,page,blocks\)/);
  assert.match(syncSource, /DELETE FROM notion_import_jobs WHERE page_id=\? AND lease_owner=\?/);
  assert.match(workerSource, /\/api\/notion\/import-next/);
});

test("browser Notion surfaces preserve read-only data access except the dedicated owner-private refresh", async () => {
  const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const backgroundSource = await readFile(new URL("../app/components/notion-background-sync.tsx", import.meta.url), "utf8");
  const documentRefreshSource = await readFile(new URL("../app/components/notion-document-refresh.tsx", import.meta.url), "utf8");
  const pageSource = await readFile(pageUrl, "utf8");
  const clientSource = await readFile(new URL("../app/lib/notion-sync-client.ts", import.meta.url), "utf8");
  assert.match(workerSource, /authorizeNotionMutation/);
  assert.match(workerSource, /authorizeOwnerPrivateBrowserMutation/);
  assert.doesNotMatch(backgroundSource, /readBrowserNotionStatus/);
  assert.match(pageSource, /useResourceLifecycle/);
  assert.match(await readFile(new URL("../app/lib/client-resource.ts", import.meta.url), "utf8"), /notion-sync-complete/);
  assert.match(clientSource, /\/api\/notion\/status/);
  assert.match(clientSource, /\/api\/notion\/refresh/);
  assert.match(documentRefreshSource, /requestBrowserNotionRefresh/);
  for (const source of [backgroundSource, clientSource, documentRefreshSource]) {
    assert.doesNotMatch(source, /\/api\/notion\/(sync|import-next|sync-background|sync-portfolio|sync-all)/);
    assert.doesNotMatch(source, /request(?:Full|Pending|Background)NotionSync/);
  }
  assert.doesNotMatch(backgroundSource, /pageshow|visibilitychange|online/);
  assert.match(workerSource, /cache-control.*no-store/);
  const resourceSource = await readFile(new URL("../app/lib/client-resource.ts", import.meta.url), "utf8");
  assert.match(resourceSource, /readBrowserNotionStatus/);
  assert.match(resourceSource, /window\.dispatchEvent\(new Event\("notion-sync-complete"\)\)/);
  assert.match(resourceSource, /let scheduled/);
  assert.match(resourceSource, /}, 250\)/);
});

test("Notion webhook is authenticated, durable and coalesces on the latest page version", async () => {
  const syncSource = await readFile(syncUrl, "utf8");
  const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0004_damp_marrow.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE `notion_webhook_config`/);
  assert.match(migration, /CREATE TABLE `notion_webhook_events`/);
  assert.match(migration, /`event_id` text PRIMARY KEY/);
  assert.match(workerSource, /\/api\/notion\/webhook\//);
  assert.match(workerSource, /\/api\/notion\/webhook-verification/);
  assert.match(workerSource, /const rawBody=await request\.text\(\)/);
  assert.match(workerSource, /x-notion-signature/);
  assert.match(workerSource, /name:"HMAC",hash:"SHA-256"/);
  assert.match(workerSource, /NOTION_WEBHOOK_SETUP_SECRET/);
  assert.match(workerSource, /recordNotionWebhookEvent/);
  assert.match(workerSource, /ctx\.waitUntil/);
  assert.match(syncSource, /ON CONFLICT\(event_id\) DO NOTHING/);
  assert.match(syncSource, /excluded\.last_edited_time>notion_import_jobs\.last_edited_time/);
  assert.match(syncSource, /excluded\.last_edited_time>=notion_documents\.last_edited_time/);
  assert.match(syncSource, /verification_token=excluded\.verification_token/);
  assert.match(syncSource, /configured_at=excluded\.configured_at/);
  assert.match(syncSource, /processNextNotionWebhookEvent/);
  assert.match(syncSource, /event\.entity_type===\"data_source\"/);
  assert.match(syncSource, /syncNotionSource\(db,token,sourceKey,100,false\)/);
  assert.match(workerSource, /authorizeNotionMutation/);
  assert.doesNotMatch(workerSource, /verificationToken\},\{headers/);
});

test("app, document and market refreshes keep separate responsibilities", async () => {
  const globalSource = await readFile(new URL("../app/components/notion-global-refresh.tsx", import.meta.url), "utf8");
  const documentSource = await readFile(new URL("../app/components/notion-document-refresh.tsx", import.meta.url), "utf8");
  const statusSource = await readFile(new URL("../app/components/notion-sync-status.tsx", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../app/lib/notion-sync-client.ts", import.meta.url), "utf8");
  assert.match(globalSource, /registration\.update\(\)/);
  assert.match(globalSource, /SKIP_WAITING/);
  assert.doesNotMatch(globalSource, /\/api\/notion\//);
  assert.match(documentSource, /requestBrowserNotionRefresh/);
  assert.match(documentSource, /Maj data/);
  assert.doesNotMatch(documentSource, /serviceWorker|\/api\/portfolio\/live/);
  assert.match(statusSource, /Synchronisation en cours/);
  assert.match(statusSource, /notion-sync-meta/);
  assert.doesNotMatch(statusSource, /onClick|requestBrowserNotionRefresh/);
  assert.match(clientSource, /\/api\/notion\/refresh/);
  assert.doesNotMatch(clientSource, /\/api\/notion\/(sync|import-next|sync-background|sync-portfolio|sync-all)/);
});

test("portfolio keeps documentary freshness visible without redundant status cards", async () => {
  const pageSource = await readFile(pageUrl, "utf8");
  const statusSource = await readFile(new URL("../app/components/notion-sync-status.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(pageSource, /DataHealth|data-health/);
  assert.match(pageSource, /<TargetAllocation data=\{portfolio\}\/\>/);
  assert.match(statusSource, /className="notion-sync-meta"/);
  assert.match(statusSource, /latestSync/);
  assert.doesNotMatch(statusSource, /notion-sync-foot/);
});

test("Notion status panel exposes source freshness without manual mutation controls", async () => {
  const syncSource = await readFile(new URL("../app/components/notion-sync-status.tsx", import.meta.url), "utf8");
  const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const notionSyncSource = await readFile(syncUrl, "utf8");
  assert.match(syncSource, /orderedSources.*key:SourceKey/);
  assert.match(syncSource, /key:"portfolio",label:"Portfolio"/);
  assert.match(syncSource, /disabled/);
  assert.doesNotMatch(syncSource, /onClick|fetch\(/);
  assert.match(workerSource, /source === "portfolio" \? 100 : 12/);
  assert.match(workerSource, /acquireNotionSourceSyncLock/);
  assert.match(notionSyncSource, /sourceKey === PORTFOLIO_SOURCE/);
  assert.match(notionSyncSource, /DELETE FROM notion_documents WHERE page_id=\? AND source_key=\?/);
});

test("portfolio refresh uses structured properties without downloading page blocks", async () => {
  const source = await readFile(syncUrl, "utf8");
  assert.match(source, /pages\.map\(page => documentUpsertStatement\(db, sourceKey, page, \[\]\)\)/);
  assert.doesNotMatch(source, /readBlockTree/);
  assert.match(source, /if \(sourceKey === PORTFOLIO_SOURCE\)/);
  assert.match(source, /queryDataSource\(token, compactDataSourceId, cursor, 100\)/);
});

test("trajectory reads both targets from Notion and keeps active positions outside target visible", async () => {
  const dataSource = await readFile(dataUrl, "utf8");
  const targetSource = await readFile(new URL("../app/components/target-allocation.tsx", import.meta.url), "utf8");
  const fixtureSource = await readFile(new URL("../stories/reference-fixtures.ts", import.meta.url), "utf8");
  assert.match(dataSource, /propertyValue\(p,"Target Weight 10k"\)/);
  assert.match(dataSource, /propertyValue\(p,"Target Weight"\)/);
  assert.match(dataSource, /target10kWeight/);
  assert.match(dataSource, /target25kWeight/);
  assert.match(dataSource, /targetTotals/);
  assert.match(dataSource, /Lumentum Holdings.*lite/);
  assert.match(dataSource, /targetId/);
  assert.match(targetSource, /data\?\.targetLines/);
  assert.match(targetSource, /!linesById\.has\(id\)/);
  assert.match(targetSource, /outsideTarget/);
  assert.match(targetSource, /Hors cible/);
  assert.match(targetSource, /currentAmount\/amount\*100/);
  assert.match(targetSource, /visualCompletion=completion==null\?null:Math\.min\(100/);
  assert.match(targetSource, /className="target-list" role="list"/);
  assert.match(targetSource, /className="allocation-row target-row"/);
  assert.match(targetSource, /className="asset-name"/);
  assert.match(targetSource, /className="target-value-toggle"/);
  assert.match(targetSource, /targetValueDisplay==="weight"\?`\$\{weight\}%`:eur0\.format\(amount\)/);
  assert.match(targetSource, /currentAmount\/data\.totals\.marketValueEur\*100/);
  assert.match(targetSource, /outsideWeight\.toFixed\(1\)\}%.*Hors cible/s);
  assert.match(targetSource, /completion>110&&surplus>targetValue\*\.005/);
  assert.doesNotMatch(targetSource, /au-dessus de la cible|cible atteinte|construction en cours|Valeur actuelle/);
  assert.doesNotMatch(targetSource, /className="position-value"|className="position-quote"/);
  assert.match(fixtureSource, /targetAllocationStates/);
  assert.match(fixtureSource, /targetId: "target-outside"/);
  assert.doesNotMatch(targetSource, /portfolio-target/);
  assert.doesNotMatch(targetSource, /fetch\("\/api\/portfolio\/live/);
});

test("company ownership is projected from active positive Portfolio positions", async () => {
  const source = await readFile(dataUrl, "utf8");
  assert.match(source, /function activePortfolioCompanyIds/);
  assert.match(source, /source_key='portfolio'/);
  assert.match(source, /propertyValue\(properties,"Status"\).*===\s*"active"/);
  assert.match(source, /propertyValue\(properties,"Quantity"\)/);
  assert.match(source, /if\(!isActive\|\|quantity<=0\)continue/);
  assert.match(source, /ownershipStatus:owned \? "Owned" : "Not owned"/);
  assert.match(source, /watchlistMembership/);
  assert.doesNotMatch(source, /function effectiveCompanyStatus/);
  assert.doesNotMatch(source, /owned:status\.toLowerCase\(\)\s*===\s*"owned"/);
});

test("company directory derives membership only from explicit Notion relations", async () => {
  const source = await readFile(dataUrl, "utf8");
  const companiesSource = await readFile(companiesUrl, "utf8");
  assert.match(source, /const watchlistCompanyIds=new Set\(watchlistRows\.flatMap\(row=>relationIds\(props\(row\),\["Company","Companies"\]\)\)\)/);
  assert.match(source, /watchlistMembership/);
  assert.match(source, /function activePortfolioCompanyIds/);
  assert.match(companiesSource, /const companyFilters = \["Toutes", "Détenues", "Watchlist"\]/);
  assert.doesNotMatch(companiesSource, /Not owned|Hors watchlist|Non classé/);
});

test("browser history canonicalizes removed company tabs to Entreprises", async () => {
  const source = await readFile(navigationUrl, "utf8");
  assert.match(source, /\["watchlist", "analyses", "research"\]/);
  assert.match(source, /const pop = \(\) => \{[\s\S]*canonicalUrl\.searchParams\.set\("tab", next\.tab\)[\s\S]*history\.replaceState/);
});

test("CIO verdict requires the linked Current validated Investment Memo", async () => {
  const source = await readFile(dataUrl, "utf8");
  const detailSource = await readFile(companyDetailUrl, "utf8");
  assert.match(source, /kind === "memo"[\s\S]*preferred\.includes[\s\S]*relationIds\(item\.properties,\["Company","Companies"\]\)\.includes\(normalizeNotionPageId\(row\.page_id\)\)[\s\S]*status\.trim\(\)\.toLowerCase\(\)==="validated"[\s\S]*propertyValue\(item\.properties,"Agent"\)[\s\S]*investment memo/);
  assert.match(detailSource, /Pas de décision CIO/);
  assert.doesNotMatch(detailSource, /data\.decision\b/);
});

test("Notion integrity audits explicit Watchlist relation cardinality and inverse status", async () => {
  const source = await readFile(dataUrl, "utf8");
  const workerSource = await readFile(workerSourceUrl, "utf8");
  assert.match(source, /export async function auditCompanyWatchlistRelations/);
  assert.match(source, /missingCompany/);
  assert.match(source, /multipleCompanies/);
  assert.match(source, /duplicateCompanies/);
  assert.match(source, /statusWithoutWatchlist/);
  assert.match(workerSource, /auditCompanyWatchlistRelations\(env\.DB\)/);
  assert.doesNotMatch(workerSource, /listWatchlist/);
});

test("company detail stays dynamic instead of using the legacy Nebius cockpit", async () => {
  const pageSource = await readFile(pageUrl, "utf8");
  assert.match(pageSource, /<CompanyDetail[^>]*companyId=\{selectedCompany\}/);
  assert.doesNotMatch(pageSource, /function NebiusDetail/);
  assert.doesNotMatch(pageSource, /const reportData/);
  assert.doesNotMatch(pageSource, /nebius-(business|valuation|short|portfolio|memo|earnings).json/);
});

test("earnings expose the five canonical refresh routes in the company design system", async () => {
  const dataSource = await readFile(dataUrl, "utf8");
  const companySource = await readFile(companyDetailUrl, "utf8");
  const uxSource = await readUxSource();
  assert.match(dataSource, /export type EarningsReviewFields/);
  assert.match(dataSource, /Business.*Valuation.*Short.*Portfolio.*Mémo CIO/s);
  assert.match(dataSource, /propertyValue\(p,"Earnings Date"\).*propertyValue\(p,"Analysis Date"\)/);
  assert.match(companySource, /function EarningsReviewCard/);
  assert.match(companySource, /<MetadataGrid/);
  assert.match(companySource, /<SecondaryBlock className="earnings-routing-item"/);
  assert.match(companySource, /Refresh recommandé/);
  assert.match(companySource, /Refresh requis/);
  assert.match(companySource, /activeSection === "earnings" && <EarningsReviewCard/);
  assert.doesNotMatch(companySource, /Execution Score/);
  assert.match(uxSource, /Earnings — latest quarter and cross-module refresh routing/);
  assert.match(uxSource, /\.earnings-routing-grid/);
});

test("two-column earnings tables prioritize result readability on mobile", async () => {
  const tableSource = await readFile(new URL("../app/components/notion-table.tsx", import.meta.url), "utf8");
  const uxSource = await readUxSource();
  assert.match(tableSource, /columnCount === 2 \? " notion-table-two-column"/);
  assert.match(uxSource, /data-analysis-template="earnings".*notion-table-two-column/s);
  assert.match(uxSource, /width: 32% !important/);
  assert.match(uxSource, /width: 68% !important/);
  assert.match(uxSource, /table-layout: fixed !important/);
});

test("removed top-level analysis and search APIs have no worker routes", async () => {
  const workerSource = await readFile(workerSourceUrl, "utf8");
  assert.doesNotMatch(workerSource, /url\.pathname === "\/api\/(?:analyses|archives|watchlist)"/);
  assert.doesNotMatch(workerSource, /url\.pathname === "\/api\/notion\/search"/);
  assert.match(workerSource, /url\.pathname\.startsWith\("\/api\/analyses\/"\)/);
});

test("archive policy keeps one latest document per company and section", async () => {
  const source = await readFile(dataUrl, "utf8");
  assert.match(source, /buildArchivePolicy/);
  assert.match(source, /Source Freshness/);
  assert.match(source, /freshValidated/);
  assert.match(source, /analysisTimestamp/);
  assert.doesNotMatch(source, /for\(const id of currentIds\).*archivedIds\.delete/s);
  assert.match(source, /classifyDocument\(row\.source_key/);
  assert.match(source, /last_edited_time/);
  assert.match(source, /filter\(doc=>!doc\.archived\)/);
  assert.match(source, /WHERE source_key IN \('analyses','earnings','decisions','portfolio'\)/);
});

test("company fiches use primary ownership links while preserving secondary mentions", async () => {
  const syncSource = await readFile(syncUrl, "utf8");
  const dataSource = await readFile(dataUrl, "utf8");
  assert.match(syncSource, /export async function documentPrimaryCompanyLinks/);
  assert.match(syncSource, /match_method IN \('notion-relation','title'\)/);
  assert.match(syncSource, /export async function documentCompanyLinks/);
  assert.match(dataSource, /documentPrimaryCompanyLinks/);
  assert.match(dataSource, /relatesToCompany\(row,company,primaryLinks\)/);
});

test("company fiches resolve current analyses from canonical Companies relations", async () => {
  const source = await readFile(dataUrl, "utf8");
  assert.match(source, /export function currentCompanyDocumentLinks/);
  assert.match(source, /Current Business Analysis/);
  assert.match(source, /canonicalIdsForCategory\(canonical,row\.page_id,category\)/);
  assert.match(source, /if\(canonicalIds\.size\)return canonicalIds\.has\(item\.row\.page_id\)/);
  assert.match(source, /documentCompanyLabel\(row,companies,owners,primaryLinks\)/);
});

test("company and analysis layouts preserve the Notion parser contract", async () => {
  const companySource = await readFile(companyDetailUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  assert.match(companySource, /const additionalCurrent = docs\.slice\(1\)/);
  assert.match(companySource, /company-history-details/);
  assert.match(companySource, /docs\.map\(\(?doc\)? => \(?\s*<DocumentRow/);
  assert.match(companySource, /<DocumentHistory docs=\{archives\}/);
  assert.match(readerSource, /document\.normalizedAnalysis \?\? normalizeAnalysisDocument\(document\)/);
  assert.match(await readFile(presentationUrl, "utf8"), /parseNotionDocument\(document\.plainText, document\.title, document\.notionBlocks\)/);
  assert.match(readerSource, /analysis-source-details/);
  assert.match(readerSource, /scenarioKind\(title\)/);
  assert.match(readerSource, /<AnalysisSectionGroups blocks=\{blocks\} hidden=\{hidden\}/);
  assert.match(readerSource, /<AnalysisBlockBody/);
  assert.match(await readFile(analysisPresentationUrl, "utf8"), /<NotionTable/);
});

test("all canonical analysis families share one summary presentation contract", async () => {
  const fixtures = JSON.parse(await readFile(presentationFixturesUrl, "utf8"));
  const presentationSource = await readFile(presentationUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  const latestInfoSource = await readFile(latestInfoUrl, "utf8");
  assert.deepEqual(fixtures.documents.map((document) => document.kind), ["business", "valuation", "short", "portfolio", "earnings", "investment_memo"]);
  assert.match(presentationSource, /tl\\s\*;\?\\s\*dr\|à retenir\|executive summary\|synthèse/);
  assert.match(presentationSource, /documentPresentation/);
  assert.match(readerSource, /aria-labelledby="analysis-tldr"/);
  assert.match(latestInfoSource, /aria-label="TL;DR"/);
});

test("analysis facts split only on explicit separators and preserve prose punctuation", async () => {
  const { splitPresentationFactValue } = await import(presentationUrl.href);
  assert.deepEqual(splitPresentationFactValue("Q3 108 Md$ ±2%; marge brute 74% ±50 pb"), ["Q3 108 Md$ ±2%", "marge brute 74% ±50 pb"]);
  assert.deepEqual(splitPresentationFactValue("CA 96 Md$\nEPS 2,46 $"), ["CA 96 Md$", "EPS 2,46 $"]);
  assert.deepEqual(splitPresentationFactValue("CA 96 Md$, EPS 2,46 $"), ["CA 96 Md$, EPS 2,46 $"]);
  assert.deepEqual(splitPresentationFactValue("Signal : positif"), ["Signal : positif"]);
  assert.deepEqual(splitPresentationFactValue("Guidance; ; Marge"), ["Guidance", "Marge"]);
});

test("each canonical analysis family promotes only its decision-useful facts", async () => {
  const fixtures = JSON.parse(await readFile(presentationFixturesUrl, "utf8"));
  const { isPriorityPresentationFact } = await import(presentationUrl.href);
  for (const fixture of fixtures.documents) {
    assert.equal(isPriorityPresentationFact(fixture.kind, fixture.priorityFact), true, `${fixture.kind} should prioritize ${fixture.priorityFact}`);
    assert.equal(isPriorityPresentationFact(fixture.kind, "Company / ticker"), false, `${fixture.kind} should keep identity compact`);
  }
  assert.equal(isPriorityPresentationFact("universal", "Guidance"), false);
});

test("standard analyses and CIO memo reuse the shared hero and fact grid", async () => {
  const presentationSource = await readFile(analysisPresentationUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  const memoSource = await readFile(memoReaderUrl, "utf8");
  const primitiveSource = await readFile(uiPrimitivesUrl, "utf8");
  const uxSource = await readUxSource();
  assert.match(presentationSource, /export function AnalysisReportHero/);
  assert.match(presentationSource, /export function AnalysisFactGrid/);
  assert.match(presentationSource, /<PrimaryBlock as="header"/);
  assert.match(readerSource, /<AnalysisReportHero/);
  assert.match(readerSource, /<AnalysisFactGrid/);
  assert.match(memoSource, /<AnalysisReportHero/);
  assert.match(memoSource, /<AnalysisFactGrid/);
  assert.doesNotMatch(readerSource, /document\.verdict \|\| "Non renseigné"/);
  assert.match(readerSource, /scored \? formatAnalysisScore\(document\.score\) : null/);
  assert.match(memoSource, /value: document\.verdict \|\| "À statuer"/);
  assert.match(primitiveSource, /className\?: string/);
  assert.match(uxSource, /\.analysis-report-hero--without-outcome/);
  assert.match(uxSource, /\.analysis-key-fact--priority/);
  assert.match(uxSource, /\.analysis-structured-value > span \+ span/);
});

test("standard analysis hero uses concise titles and formats scores without a duplicate metadata grid", async () => {
  const [source, memoSource] = await Promise.all([readFile(analysisReaderUrl, "utf8"), readFile(memoReaderUrl, "utf8")]);
  const standardReader = source.slice(source.indexOf("function StandardAnalysisReader"));
  assert.match(standardReader, /<Badge>\{document\.agent\}<\/Badge>/);
  assert.match(standardReader, /<Badge tone=\{document\.status/);
  assert.match(standardReader, /title=\{analysisTypeLabel\(document\)\}/);
  assert.match(standardReader, /subtitle=\{<>\{companyName\} · \{shortDate\(normalized\.analysis\.header\.date \|\| normalized\.analysis\.header\.provenance\.capturedAt\)\}<\/?>\}/);
  assert.match(standardReader, /const formattedScore = scored \? formatAnalysisScore\(document\.score\) : null/);
  assert.match(standardReader, /label: "Score", value: formattedScore/);
  assert.match(standardReader, /detail: formattedScore && formattedScore !== "—" \? formattedScore : undefined/);
  assert.match(standardReader, /outcome=\{outcome\}/);
  assert.match(standardReader, /className="analysis-source-details"/);
  assert.match(standardReader, /Ouvrir le document original/);
  assert.doesNotMatch(standardReader, /Métadonnées de l’analyse|const metadata =/);
  assert.match(source.slice(0, source.indexOf("function StandardAnalysisReader")), /<MetadataGrid/);
  assert.match(memoSource, /className="memo-decision-card"/);
  assert.match(memoSource, /<AnalysisFactGrid/);
});

test("analysis reader leads with editorial analysis and keeps sources after the report", async () => {
  const [readerSource, readerCss] = await Promise.all([
    readFile(analysisReaderUrl, "utf8"),
    readFile(new URL("../app/styles/ux/analysis-reader.css", import.meta.url), "utf8"),
  ]);
  const standardReader = readerSource.slice(readerSource.indexOf("function StandardAnalysisReader"));
  assert.doesNotMatch(standardReader, /title=\{document\.title\}/, "technical Notion title must not be the UI heading");
  assert.ok(standardReader.indexOf("<AnalysisSectionGroups") < standardReader.indexOf("className=\"analysis-source-details\""), "source and TOC disclosure follows analysis content");
  assert.doesNotMatch(standardReader, /<SecondaryBlock className="analysis-source-details"/);
  const mobileScenarioLayout = readerCss.match(/@media \(max-width: 760px\) \{([\s\S]*?)\n\}/g)?.find(rule => rule.includes(".analysis-scenario-cards") && rule.includes(".analysis-threshold-grid")) ?? "";
  assert.match(mobileScenarioLayout, /\.analysis-scenario-cards,[\s\S]*?\.analysis-threshold-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
});

test("Investment Memo CIO has a dedicated decision view without a numeric memo score", async () => {
  const memoSource = await readFile(memoReaderUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  const companySource = await readFile(companyDetailUrl, "utf8");
  assert.match(readerSource, /<InvestmentMemoReader/);
  assert.match(companySource, /\["memo", "Mémo CIO"\]/);
  assert.match(memoSource, /Decision Card/);
  assert.match(memoSource, /extractedValuation\?\.scenarios\.length === 3[\s\S]*every\(item => item\.terminal && item\.cagr\)/);
  assert.match(memoSource, /Raisonnement décisif/);
  assert.match(memoSource, /État des quatre modules/);
  assert.match(await readFile(presentationUrl, "utf8"), /!\/\^\(\?:score\|note\)/);
  assert.doesNotMatch(memoSource, /document\.score/);
  assert.doesNotMatch(await readFile(pageUrl, "utf8"), /AnalysisHub|NotionAnalyses/);
});

test("Notion tables use one adaptive reusable component", async () => {
  const tableSource = await readFile(notionTableUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  const memoSource = await readFile(memoReaderUrl, "utf8");
  const sharedBodySource = await readFile(new URL("../app/components/analysis-presentation.tsx", import.meta.url), "utf8");
  const globalsSource = await readFile(globalsUrl, "utf8");
  assert.match(tableSource, /export function NotionTable/);
  assert.match(tableSource, /--notion-columns/);
  assert.match(tableSource, /Tableau défilable horizontalement/);
  assert.match(tableSource, /notion-table-wide/);
  assert.match(readerSource, /<AnalysisBlockBody/);
  assert.match(memoSource, /<AnalysisBlockBody/);
  assert.match(sharedBodySource, /<NotionTable/);
  assert.doesNotMatch(memoSource, /surfaceForCompact/);
  assert.match(globalsSource, /\.notion-table \{[\s\S]*table-layout: fixed/);
  assert.match(globalsSource, /\.notion-table-wrap \{[\s\S]*overflow-x: hidden/);
  assert.match(globalsSource, /\.notion-table-wrap-scrollable \{ overflow-x: auto; \}/);
  assert.match(globalsSource, /\.notion-table-wide \{[\s\S]*min-width: max\(100%, calc\(var\(--notion-columns\) \* 148px\)\)/);
});

test("analysis disclosures use the company width while keeping prose readable", async () => {
  const [readerCss, companyCss, documentsCss, tableSource, analysisSource] = await Promise.all([
    readFile(new URL("../app/styles/ux/analysis-reader.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/ux/company.css", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/ux/documents.css", import.meta.url), "utf8"),
    readFile(notionTableUrl, "utf8"),
    readFile(analysisReaderUrl, "utf8"),
  ]);
  assert.match(readerCss, /\.notion-page\.universal-analysis-page \{[\s\S]*width: 100%;[\s\S]*max-width: 100%;/);
  assert.match(readerCss, /\.analysis-section-group-content \{[^}]*width: 100%;[^}]*max-width: none;/);
  assert.match(readerCss, /\.notion-page\.universal-analysis-page \.analysis-section-group-content > p \{[^}]*max-width: 76ch;[^}]*margin: 14px auto;/);
  assert.match(readerCss, /\.notion-page\.universal-analysis-page \.analysis-section-group-content > ul,[\s\S]*max-width: 74ch;[\s\S]*margin: 12px auto 20px;/);
  assert.doesNotMatch(tableSource, /surfaceForCompact/);
  assert.match(tableSource, /return <div \{\.\.\.wrapperProps\}>\{table\}<\/div>/, "all tables share one structural wrapper; only dense tables enable scrolling");
  assert.doesNotMatch(tableSource, /return <SecondaryBlock/);
  assert.doesNotMatch(analysisSource, /surfaceForCompact/);
  assert.doesNotMatch(readerCss, /analysis-section-group-content \.notion-table-wrap/);
  assert.match(readerCss, /\.analysis-projection-scenario\s*\{[^}]*grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 20rem\), 1fr\)\)/);
  assert.match(companyCss, /\.generic-company-detail > \.detail-navigation \{[\s\S]*position: sticky;[\s\S]*top:/);
  assert.doesNotMatch(companyCss, /\.generic-company-detail > \.detail-navigation \{[^}]*position: fixed;/);
  const mobileCopyRule = documentsCss.match(/\.universal-analysis-page \.analysis-section-group-content > p,[\s\S]*?\{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(mobileCopyRule, /(?:width|max-width):\s*100%/);
});

test("company summaries are segmented for a scannable mobile preview", async () => {
  const latestInfoSource = await readFile(latestInfoUrl, "utf8");
  assert.match(latestInfoSource, /function previewItems/);
  assert.match(latestInfoSource, /slice\(0, 3\)/);
  assert.match(latestInfoSource, /remaining: Math\.max\(0, source\.length - 3\)/);
  assert.match(latestInfoSource, /const preview = previewItems\(summary\)/);
});

test("research copy uses the shared readable text token", async () => {
  const uxSource = await readUxSource();
  const globalsSource = await readFile(globalsUrl, "utf8");
  assert.match(globalsSource, /--color-content-copy: #3a3a3c/);
  assert.match(globalsSource, /\.notion-callout p \{ margin: 0; color: var\(--color-content-copy\); \}/);
  assert.match(uxSource, /\.analysis-lead p,[\s\S]*color: var\(--color-content-copy\) !important/);
  assert.match(uxSource, /-webkit-text-fill-color: var\(--color-content-copy\) !important/);
  assert.match(uxSource, /latest-info-summary p,[\s\S]*\.decision-template-columns p/);
});

test("company directory keeps stable identities and accessible row actions", async () => {
  const companiesSource = await readFile(companiesUrl, "utf8");
  assert.match(companiesSource, /company-identity-button/);
  assert.doesNotMatch(companiesSource, /role="button"/);
  assert.match(companiesSource, /company-list-row/);
});

test("Apple Light theme stays isolated from data and parser contracts", async () => {
  const uxSource = await readUxSource();
  const globalsSource = await readFile(globalsUrl, "utf8");
  const designSystemSource = await readFile(designSystemUrl, "utf8");
  const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(designSystemSource, /@import "\.\/ux-foundations\.css";[\s\S]*@import "\.\/globals\.css";/);
  assert.match(globalsSource, /color-scheme: light/);
  assert.match(uxSource, /backdrop-filter: saturate\(180%\) blur\(24px\)/);
  assert.match(globalsSource, /--surface-canvas: #fff/);
  assert.match(globalsSource, /--color-bg: var\(--surface-canvas\)/);
  assert.match(layoutSource, /themeColor: "#ffffff"/);
});

test("Apple Light theme covers shared surfaces and aligns financial figures", async () => {
  const uxSource = await readUxSource();
  const globalsSource = await readFile(globalsUrl, "utf8");
  assert.match(uxSource, /\.ui-metadata-item/);
  assert.match(uxSource, /\.decision-template \{/);
  assert.match(globalsSource, /--surface-secondary: var\(--contrast-surface-secondary, #fff\)/);
  assert.match(uxSource, /font-variant-numeric: tabular-nums lining-nums/);
  assert.match(uxSource, /grid-template-columns:\s*minmax\(210px, 1fr\)\s*minmax\(\s*88px,\s*0?\.45fr\s*\)\s*66px\s*84px\s*84px\s*82px/);
});

test("portfolio hides internal calculation and method panels", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const dashboardSource = await readFile(new URL("../app/components/live-portfolio-dashboard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(pageSource, /MethodDetails|method-details/);
  assert.doesNotMatch(dashboardSource, /Diagnostic des calculs|portfolio-diagnostic|diagnostic-grid/);
});

test("shared UI primitives drive progress bars and segmented filters", async () => {
  const primitiveSource = await readFile(uiPrimitivesUrl, "utf8");
  const uxSource = await readUxSource();
  const globalsSource = await readFile(globalsUrl, "utf8");
  const portfolioSource = await readFile(new URL("../app/components/live-portfolio-dashboard.tsx", import.meta.url), "utf8");
  const targetSource = await readFile(new URL("../app/components/target-allocation.tsx", import.meta.url), "utf8");
  assert.match(primitiveSource, /export function ProgressBar/);
  assert.match(primitiveSource, /export function SegmentedControl/);
  assert.match(portfolioSource, /<ProgressBar value=\{item\.weight\}/);
  assert.match(portfolioSource, /portfolio-account-filter/);
  assert.match(targetSource, /<ProgressBar value=\{progress\}/);
  assert.match(targetSource, /SegmentedControl/);
  assert.doesNotMatch(targetSource, /<span className="target-rank">\{line\.rank\}<\/span>/);
  assert.match(globalsSource, /--ui-progress-height: 5px/);
  assert.match(globalsSource, /\.ui-filter-bar/);
  assert.match(globalsSource, /\.ui-tabs button\.is-active/);
  assert.match(uxSource, /\.pnl-badge\.positive-pnl[\s\S]*background: transparent !important/);
});

test("the company directory uses production discovery and search primitives", async () => {
  const primitiveSource = await readFile(uiPrimitivesUrl, "utf8");
  const companiesSource = await readFile(companiesUrl, "utf8");
  assert.match(primitiveSource, /export function SearchField/);
  assert.match(primitiveSource, /export function Badge/);
  assert.match(primitiveSource, /export function Tabs/);
  assert.match(primitiveSource, /export function DiscoveryCard/);
  assert.match(companiesSource, /<SearchField/);
  assert.match(companiesSource, /<DiscoveryCard[^>]+kind="company"/);
  assert.match(companiesSource, /<Tabs/);
});

test("UI-2 keeps the primitive manifest and unified company reference states", async () => {
  const primitiveSource = await readFile(uiPrimitivesUrl, "utf8");
  const manifest = await readFile(uiManifestUrl, "utf8");
  const primitiveStories = await readFile(primitiveStoriesUrl, "utf8");
  const referenceFrame = await readFile(referenceFrameUrl, "utf8");
  const referenceStorySources = Object.fromEntries(
    await Promise.all(Object.entries(referenceStoryUrls).map(async ([name, url]) => [name, await readFile(url, "utf8")])),
  );
  const referenceStories = Object.values(referenceStorySources).join("\n");
  const exportedFunctions = primitiveSource.match(/^export function /gm) ?? [];

  assert.equal(exportedFunctions.length, (manifest.match(/^\| \d+ \| `[^`]+` \|/gm) ?? []).length);
  assert.match(manifest, /ui-primitives\.tsx → ui-foundation-manifest\.md → Storybook → Lovable/);
  assert.match(primitiveStories, /export const Surfaces/);
  assert.match(primitiveStories, /export const Controls/);
  assert.match(referenceFrame, /maxWidth: 390/);
  for (const screen of ["Companies"]) {
    assert.match(referenceStorySources[screen], new RegExp(`export const ${screen}:`));
    for (const state of ["Empty", "Loading", "Error"]) {
      assert.match(referenceStorySources[screen], new RegExp(`export const ${state}:`));
    }
  }
  assert.match(referenceStories, /import \{ NotionCompanies \} from "\.\.\/app\/components\/notion-companies"/);
  assert.match(referenceStories, /<NotionCompanies initialData=/);
  assert.match(referenceStories, /reference-fixtures/);
  assert.match(referenceStories, /reference-frame/);
});

test("research actions and coverage use the shared mobile UI primitives", async () => {
  const primitiveSource = await readFile(uiPrimitivesUrl, "utf8");
  const companySource = await readFile(companyDetailUrl, "utf8");
  const holdingSource = await readFile(liveHoldingSummaryUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  const latestInfoSource = await readFile(latestInfoUrl, "utf8");
  const uxSource = await readUxSource();

  assert.match(primitiveSource, /export function ActionButton/);
  assert.match(primitiveSource, /export function BackButton/);
  assert.match(primitiveSource, /export function DataTable/);
  assert.match(latestInfoSource, /<ActionButton className="featured-document-open"/);
  assert.doesNotMatch(latestInfoSource, /company-document-open/);
  assert.match(companySource, /<PrimaryBlock as="button"[^>]*className="company-module-card"/);
  assert.match(companySource, /<ResearchCoverage items=\{researchHighlights\} onSelect=\{selectSection\}/);
  assert.match(companySource, /documentConclusion\(doc\)/);
  assert.doesNotMatch(companySource, /research-verdict-cell/);
  assert.match(holdingSource, /className="holding-summary-state holding-summary-loading" aria-busy="true"/);
  assert.doesNotMatch(companySource, /panel company-research-overview/);
  assert.doesNotMatch(readerSource, /analysis-section-number/);
  assert.match(uxSource, /\.company-section-block,[\s\S]*background: transparent !important/);
  assert.match(uxSource, /\.company-module-grid\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(uxSource, /\.company-metrics\.company-metrics--three, \.company-module-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
});

test("analysis and company details share the same liquid-glass primitives without table card nesting", async () => {
  const primitiveSource = await readFile(uiPrimitivesUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  const tableSource = await readFile(notionTableUrl, "utf8");
  const companySource = await readFile(companyDetailUrl, "utf8");
  const latestInfoSource = await readFile(latestInfoUrl, "utf8");
  const uxSource = await readUxSource();
  const globalsSource = await readFile(globalsUrl, "utf8");

  assert.match(primitiveSource, /export function PrimaryBlock/);
  assert.match(primitiveSource, /export function SecondaryBlock/);
  assert.match(primitiveSource, /export function GlassChrome/);
  assert.match(primitiveSource, /const SurfaceContext = createContext/);
  assert.match(primitiveSource, /parentSurface === "primary" \|\| parentSurface === "secondary"/);
  assert.match(primitiveSource, /export function MetadataGrid/);
  assert.match(primitiveSource, /export function DisclosureSurface/);
  assert.match(readerSource, /<article className="notion-page universal-analysis-page">/);
  assert.match(readerSource, /!embedded && onBack && <div className="detail-navigation">/);
  assert.doesNotMatch(readerSource, /className="back-button"/);
  assert.match(companySource, /<BackButton onBack=\{close\} ariaLabel="Retour à la vue précédente" \/>/);
  assert.doesNotMatch(companySource, /className="back-button"/);
  assert.match(globalsSource, /\.ui-back-button \{/);
  assert.match(uxSource, /prefers-reduced-transparency: reduce/);
  assert.match(readerSource, /<section className="analysis-lead"/);
  assert.doesNotMatch(readerSource, /<SecondaryBlock className="analysis-lead"/);
  assert.match(readerSource, /<AnalysisFactGrid\s+ariaLabel="Repères du document"/);
  assert.match(readerSource, /<DisclosureSurface\s+className="analysis-source-details"/);
  assert.match(latestInfoSource, /<PrimaryBlock as="article" className="detail-card latest-info-card"/);
  assert.doesNotMatch(latestInfoSource, /className="panel/);
  assert.match(latestInfoSource, /className="latest-info-summary"/);
  assert.doesNotMatch(latestInfoSource, /<SecondaryBlock[^>]*latest-info-summary/);
  assert.match(latestInfoSource, /<MetadataGrid items=/);
  assert.match(uxSource, /\.company-summary-grid,[\s\S]*background: transparent !important/);
  assert.match(globalsSource, /\.ui-surface\.ui-surface--primary[\s\S]*--surface-primary/);
  assert.match(globalsSource, /\.ui-surface--secondary[\s\S]*--surface-secondary/);
  assert.match(globalsSource, /\.ui-surface--glass[\s\S]*backdrop-filter/);
  assert.match(globalsSource, /prefers-reduced-transparency: reduce/);
  assert.doesNotMatch(tableSource, /surfaceForCompact/);
  assert.doesNotMatch(tableSource, /<SecondaryBlock \{\.\.\.wrapperProps\}/);
  assert.doesNotMatch(`${primitiveSource}\n${uxSource}\n${globalsSource}`, /ui-primary-block|ui-secondary-block/);
  assert.doesNotMatch(`${primitiveSource}\n${uxSource}\n${globalsSource}`, /InsetSurface|ui-inset-surface/);
  assert.doesNotMatch(`${uxSource}\n${globalsSource}`, /analysis-meta-grid|analysis-fact-grid|latest-info-meta|latest-info-facts/);
  assert.doesNotMatch(uxSource, /\.company-research-overview > button \{/);
});

test("analysis section headings stay contained without an extra surface", async () => {
  const uxSource = await readUxSource();
  assert.match(uxSource, /\.notion-page\.universal-analysis-page \.analysis-section \{[\s\S]*box-sizing: border-box;[\s\S]*width: 100%;[\s\S]*overflow: hidden;/);
  assert.match(uxSource, /\.notion-page\.universal-analysis-page \.analysis-section > h2,[\s\S]*overflow-wrap: anywhere;/);
  assert.doesNotMatch(uxSource, /\.notion-source-grid button,\s*\.analysis-section/);
  assert.doesNotMatch(uxSource, /\.analysis-section\s*\{\s*background:\s*var\(--glass-inset\)/);
});

test("company list no longer includes Radar, analysis index or search page code", async () => {
  const pageSource = await readFile(pageUrl, "utf8");
  assert.doesNotMatch(pageSource, /NotionWatchlist|NotionAnalyses|DocumentSearch|Analyses|Recherche/);
  for (const path of ["../app/components/notion-watchlist.tsx", "../app/components/notion-analyses.tsx", "../app/components/document-search.tsx", "../app/lib/search-contract.ts"]) {
    assert.equal(await pathExists(new URL(path, import.meta.url)), false, `${path} should be removed`);
  }
});

test("portfolio exposure keeps ETF look-through and exclusive primary themes", async () => {
  const [dataSource, dashboardSource] = await Promise.all([
    readFile(dataUrl, "utf8"),
    readFile(liveDashboardUrl, "utf8"),
  ]);
  assert.match(dataSource, /rawType==="country"\|\|rawType==="sector"\|\|rawType==="theme"/);
  assert.match(dataSource, /propertyValue\(p,"Data Status"\)/);
  assert.match(dataSource, /propertyValue\(p,"Primary Theme"\)/);
  assert.match(dataSource, /total<0\.95\|\|total>1\.05/);
  assert.match(dashboardSource, /position\.primaryTheme\|\|"Non ventilé thématiquement"/);
  assert.match(dashboardSource, /item\.weight>=1/);
  assert.doesNotMatch(dashboardSource, /directThemes|Expositions non exclusives|Diversification/);
});

test("portfolio trajectories keep Notion targets and active positions isolated", async () => {
  const [dataSource, targetSource] = await Promise.all([
    readFile(dataUrl, "utf8"),
    readFile(new URL("../app/components/target-allocation.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dataSource, /propertyValue\(p,"Target Weight 10k"\)/);
  assert.match(dataSource, /propertyValue\(p,"Target Weight"\)/);
  assert.match(dataSource, /target10kWeight = notionTarget10kWeight/);
  assert.match(dataSource, /targetWeight = notionTargetWeight/);
  assert.match(dataSource, /Status.*active.*Quantity/);
  assert.match(dataSource, /const targetRows = rows\.filter/);
  assert.match(dataSource, /hasTarget = .*Target Weight 10k.*Target Weight/);
  assert.match(dataSource, /isClosedPortfolioRow\(properties\)/);
  assert.match(dataSource, /liveTargetLines\(targetRows\)/);
  assert.doesNotMatch(dataSource, /targetRows\.push\(.*source/);
  assert.match(dataSource, /targetTotals=\{target10kWeight:targetLines\.reduce/);
  assert.doesNotMatch(dataSource, /brokerReference|targetProgress|pnlByAccount/);
  assert.doesNotMatch(targetSource, /13 août 2026|29 juillet 2026/);
  assert.match(targetSource, /Cible incomplète/);
  assert.match(targetSource, /outsideTarget/);
});

test("Run Receipt is hidden as a complete presentation section without mutating source blocks", async () => {
  const { documentPresentation } = await import(presentationUrl.href);
  const blocks = [
    { type: "heading", level: 2, text: "Conclusion" },
    { type: "paragraph", text: "Conclusion lisible." },
    { type: "heading", level: 2, text: "9. RUN RECEIPT:" },
    { type: "paragraph", text: "run_id=demo-1; contract_version=1" },
    { type: "table", header: false, rows: [["internal", "value"]] },
    { type: "heading", level: 2, text: "Sources" },
    { type: "paragraph", text: "Source publique." },
  ];
  const presentation = documentPresentation(blocks, "", { category: "valuation" });

  assert.deepEqual([...presentation.hiddenIndexes].sort((a, b) => a - b), [2, 3, 4]);
  assert.equal(blocks.length, 7, "source blocks remain intact");
  assert.equal(blocks[3].text, "run_id=demo-1; contract_version=1");
});

test("short analytical tables are not assigned horizontal scrolling solely by column count", async () => {
  const { shouldScrollNotionTable } = await import("../app/lib/table-presentation.ts");
  assert.equal(shouldScrollNotionTable([["Seuil", "Cours"], ["10 %", "100 €"], ["12 %", "90 €"]]), false);
  assert.equal(shouldScrollNotionTable([["Scénario", "Cours", "Rendement"], ["Base", "100 €", "10 %"]]), false);
  assert.equal(shouldScrollNotionTable([["Mesure", "Bear", "Base", "Bull", "Source"], ["Prix terminal", "80 €", "100 €", "120 €", "modèle"], ["CAGR", "-4 %", "10 %", "15 %", "modèle"]]), false);
  assert.equal(shouldScrollNotionTable([["Rendement exigé", "Prix maximal", "Statut", "Source", "Notes"], ["10 %", "100 €", "Cible", "Modèle", "—"], ["12 %", "90 €", "Base", "Modèle", "—"], ["15 %", "80 €", "Prudent", "Modèle", "—"]]), false);
  assert.equal(shouldScrollNotionTable([["Date", "Entreprise", "Cours", "Volume", "Variation"], ...Array.from({ length: 12 }, (_, i) => [`2026-${i}`, `Co ${i}`, `${i}`, `${i}`, `${i}`])]), true);
});

test("valuation promotion keeps JPY scenario and hurdle values once with source indexes", async () => {
  const { extractValuationSummary } = await import("../app/lib/valuation-summary.ts");
  const blocks = [
    { type: "heading", level: 2, text: "Scénarios 5 ans" },
    { type: "table", header: true, rows: [
      ["Scénario", "Prix terminal", "CAGR annualisé"],
      ["Bear", "27 411 ¥", "-4 %/an"],
      ["Base", "31 285 ¥", "8 %/an"],
      ["Bull", "34 234 ¥", "15 %/an"],
    ] },
    { type: "heading", level: 2, text: "Seuils du scénario Base intacte" },
    { type: "table", header: true, rows: [
      ["Rendement exigé", "Prix maximal"],
      ["10 %", "34 234 ¥"],
      ["12 %", "31 285 ¥"],
      ["15 %", "27 411 ¥"],
    ] },
  ];
  const summary = extractValuationSummary(blocks);
  assert.deepEqual(summary?.scenarios.map(item => item.terminal), ["27 411 ¥", "31 285 ¥", "34 234 ¥"]);
  assert.deepEqual(summary?.thresholds.map(item => item.price), ["34 234 ¥", "31 285 ¥", "27 411 ¥"]);
  assert.deepEqual(summary?.promotedBlockIndexes, [1, 3]);
});

test("promoted valuation tables hide only their duplicate data and empty headings", async () => {
  const { hidePromotedTableSections } = await import(presentationUrl.href);
  const blocks = [
    { type: "heading", level: 2, text: "Scénarios 5 ans" },
    { type: "table", header: true, rows: [["Scenario", "Price"], ["Base", "120 USD"]] },
    { type: "paragraph", text: "La trajectoire dépend de la marge et de l’exécution." },
    { type: "heading", level: 2, text: "Seuils Base intacte" },
    { type: "table", header: true, rows: [["Hurdle", "Prix"], ["12 %", "90 USD"]] },
  ];
  const hidden = hidePromotedTableSections(blocks, [1, 4], new Set());
  assert.deepEqual([...hidden].sort((a, b) => a - b), [1, 3, 4]);
});

test("company analysis labels stay short and numeric scores state their denominator", async () => {
  const { analysisTypeLabel, analysisDisplayValue, formatAnalysisScore } = await import("../app/lib/decision-label.ts");
  assert.equal(analysisTypeLabel({ category: "valuation", title: "Advantest — Valuation Check v9 — Full Value — 2026-09-24" }), "Valorisation");
  assert.equal(analysisTypeLabel({ category: "earnings", title: "Q3 update" }), "Résultats");
  assert.equal(analysisDisplayValue({ category: "valuation", score: "55" }), "55/100");
  assert.equal(formatAnalysisScore("55 / 100"), "55/100");
  assert.equal(formatAnalysisScore("72 / 100 (illustratif)"), "72/100 (illustratif)");
  assert.equal(formatAnalysisScore("Non calculé"), "Non calculé");
});

test("valuation extraction recognizes explicit hurdle heading and reference market data", async () => {
  const { extractValuationSummary } = await import("../app/lib/valuation-summary.ts");
  const blocks = [
    { type: "paragraph", text: "Cours de référence : 33 060 JPY, clôture TSE du 24/09/2026 à 15:30 JST." },
    { type: "heading", level: 2, text: "Scénarios · horizon 5 ans" },
    { type: "table", header: true, rows: [
      ["Mesure · horizon 5 ans", "Bear", "Base", "Bull"],
      ["Prix terminal estimé · JPY", "27 411", "31 285", "34 234"],
      ["CAGR actionnaire · %/an", "−4 %", "8 %", "15 %"],
    ] },
    { type: "heading", level: 2, text: "Prix pour 10 %, 12 % et 15 %" },
    { type: "table", header: true, rows: [
      ["Rendement exigé", "Prix maximal"],
      ["10 %", "34 234 JPY"], ["12 %", "31 285 JPY"], ["15 %", "27 411 JPY"],
    ] },
  ];
  const summary = extractValuationSummary(blocks);
  assert.equal(summary?.referencePrice, "33 060 JPY");
  assert.equal(summary?.referenceDate, "24/09/2026");
  assert.deepEqual(summary?.thresholds.map(({ rate, price }) => ({ rate, price })), [
    { rate: "10 %", price: "34 234 JPY" }, { rate: "12 %", price: "31 285 JPY" }, { rate: "15 %", price: "27 411 JPY" },
  ]);
  assert.deepEqual(summary?.promotedBlockIndexes, [2, 4]);

  const thresholdsOnly = extractValuationSummary([
    { type: "paragraph", text: "Cours de référence : 33 060 JPY, clôture TSE du 24/09/2026." },
    { type: "heading", level: 2, text: "9. Prix pour 10 %, 12 % et 15 %" },
    { type: "table", header: true, rows: [
      ["Rendement exigé", "Prix maximal"],
      ["10 %", "34 234 JPY"], ["12 %", "31 285 JPY"], ["15 %", "27 411 JPY"],
    ] },
  ]);
  assert.deepEqual(thresholdsOnly?.scenarios, []);
  assert.deepEqual(thresholdsOnly?.thresholds.map(item => item.price), ["34 234 JPY", "31 285 JPY", "27 411 JPY"]);
  assert.deepEqual(thresholdsOnly?.promotedBlockIndexes, [2]);
});

test("valuation presentation extracts safe partial facts without hiding partial source blocks", async () => {
  const { extractValuationSummary } = await import("../app/lib/valuation-summary.ts");
  const blocks = [
    { type: "paragraph", text: "Bear: prix cible 317 USD, CAGR actionnaire 5,2 %; Base: cible 420 USD, CAGR cours 8 %" },
    { type: "heading", level: 2, text: "Prix maximal selon rendement exigé" },
    { type: "paragraph", text: "Prix maximal pour 12 % : 280 USD." },
  ];
  const summary = extractValuationSummary(blocks);
  assert.equal(summary?.version, 2);
  assert.deepEqual(summary?.scenarios.map(s => [s.name, s.terminal, s.cagr]), [["Bear", "317 USD", "5,2 %"], ["Base", "420 USD", "8 %"]]);
  assert.deepEqual(summary?.thresholds.map(t => [t.rate, t.price]), [["12 %", "280 USD"]]);
  assert.deepEqual(summary?.promotedBlockIndexes, []);
});

test("Amazon-style scenario prose keeps final punctuation, approximations, and shareholder CAGR distinct from EBIT CAGR", async () => {
  const { extractValuationSummary } = await import("../app/lib/valuation-summary.ts");
  const blocks = [
    { type: "paragraph", text: "Bear : CAGR EBIT 12 %, EBIT 2031 193,5 Md$, EV/EBIT terminal 18x, cible 317 USD, CAGR actionnaire 5,2 %. Base 504 USD/15,4 %. Bull 705 USD/23,4 %." },
    { type: "heading", level: 2, text: "Prix maximal pour 10 %, 12 % et 15 %" },
    { type: "paragraph", text: "Prix maximal: ≈313/286/251 USD." },
  ];
  const summary = extractValuationSummary(blocks);
  assert.deepEqual(summary?.scenarios.map(s => [s.name, s.terminal, s.cagr]), [
    ["Bear", "317 USD", "5,2 %"], ["Base", "504 USD", "15,4 %"], ["Bull", "705 USD", "23,4 %"],
  ]);
  assert.deepEqual(summary?.thresholds.map(t => [t.rate, t.price]), [["10 %", "≈313 USD"], ["12 %", "≈286 USD"], ["15 %", "≈251 USD"]]);
  const ebitOnly = extractValuationSummary([{ type: "table", header: true, rows: [["Metric", "Bear", "Base", "Bull"], ["CAGR EBIT", "10 %", "12 %", "14 %"]] }]);
  assert.equal(ebitOnly, null);
});

test("Amazon Notion lines extract partial facts with exact source indexes and scenario word boundaries", async () => {
  const { extractValuationSummary } = await import("../app/lib/valuation-summary.ts");
  const blocks = [
    { type: "heading", level: 1, text: "5. Scénarios Bear / Base / Bull" },
    { type: "paragraph", text: "Bear : CAGR EBIT 12 %, EBIT 2031 193,5 Md$, EV/EBIT terminal 18x, cible 317 USD, CAGR actionnaire 5,2 %." },
    { type: "paragraph", text: "Base : CAGR EBIT 18 %, EBIT 2031 251,2 Md$, EV/EBIT terminal 22x, cible 504 USD, CAGR actionnaire 15,4 %." },
    { type: "paragraph", text: "Bull : CAGR EBIT 23 %, EBIT 2031 309,1 Md$, EV/EBIT terminal 25x, cible 705 USD, CAGR actionnaire 23,4 %." },
    { type: "heading", level: 1, text: "9. Prix pour 10 %, 12 % et 15 %" },
    { type: "paragraph", text: "Prix maximal pour 10 % : ≈ 313 USD." },
    { type: "paragraph", text: "Prix maximal pour 12 % : ≈ 286 USD." },
    { type: "paragraph", text: "Prix maximal pour 15 % : ≈ 251 USD." },
  ];
  const summary = extractValuationSummary(blocks);
  assert.deepEqual(summary?.scenarios.map(s => [s.name, s.terminal, s.cagr, s.sourceBlockIndexes]), [
    ["Bear", "317 USD", "5,2 %", [1]], ["Base", "504 USD", "15,4 %", [2]], ["Bull", "705 USD", "23,4 %", [3]],
  ]);
  assert.deepEqual(summary?.thresholds.map(t => [t.rate, t.price, t.sourceBlockIndexes]), [
    ["10 %", "≈ 313 USD", [5]], ["12 %", "≈ 286 USD", [6]], ["15 %", "≈ 251 USD", [7]],
  ]);
  assert.deepEqual(summary?.promotedBlockIndexes, []);
  assert.equal(extractValuationSummary([{ type: "paragraph", text: "database target 317 USD; description 5 %" }]), null);
});

test("analysis sections render H1-only roots and retain Advantest H2/H3 content", async () => {
  const outputDir = new URL("../.test-runtime/", import.meta.url);
  const outputFile = new URL("./analysis-section-groups-runtime.mjs", outputDir);
  await mkdir(outputDir, { recursive: true });
  try {
    await build({ entryPoints: [fileURLToPath(new URL("../app/components/analysis-section-groups.tsx", import.meta.url))], bundle: true, platform: "node", format: "esm", packages: "external", outfile: fileURLToPath(outputFile) });
    const [{ createElement }, { renderToStaticMarkup }, { AnalysisSectionGroups }] = await Promise.all([
      import("react"), import("react-dom/server"), import(outputFile.href),
    ]);
    const renderBlock = ({ block, index }) => block.type === "paragraph"
      ? createElement("p", { key: index }, block.text.map(segment => segment.text).join(""))
      : block.type === "heading" ? createElement(`h${block.level}`, { key: index }, block.text.map(segment => segment.text).join("")) : null;
    const [{ normalizeAnalysisDocument }, { canonicalAnalysisContent }] = await Promise.all([
      import("../app/lib/document-presentation.ts"), import("../app/lib/notion-renderer.ts"),
    ]);
    const render = blocks => {
      const normalized = normalizeAnalysisDocument({ id: "section-test", title: "Sections", category: "analyses", lastEditedTime: "2026-09-30T10:00:00Z", relations: [], plainText: blocks.map(block => block.type === "heading" ? `${"#".repeat(block.level)} ${block.text}` : block.text).join("\n\n") });
      const canonicalBlocks = canonicalAnalysisContent("section-test", blocks).blocks;
      return renderToStaticMarkup(createElement(AnalysisSectionGroups, { blocks: canonicalBlocks, factGroups: normalized.view.factGroups, hidden: new Set(), idForHeading: i => `section-${i}`, renderBlock }));
    };
    const amazon = render([
      { type: "heading", level: 1, id: "investment-card", text: "Investment Card" },
      { type: "paragraph", text: "Business model : Fort" },
      { type: "paragraph", text: "Moat : Fort" },
      { type: "paragraph", text: "Croissance structurelle : Forte" },
      { type: "paragraph", text: "Qualité financière : Forte mais en transition capitalistique" },
      { type: "heading", level: 1, id: "classification", text: "Classification" },
      { type: "paragraph", text: "Source conservée dans le corps." },
    ]);
    assert.match(amazon, /<details[^>]*id="investment-card"/);
    assert.match(amazon, /<details[^>]*id="classification"/);
    assert.match(amazon, /Tout déplier[\s\S]*Tout replier/);
    assert.match(amazon, /class="analysis-key-facts"/);
    for (const value of ["Business model", "Fort", "Moat", "Croissance structurelle", "Qualité financière", "transition capitalistique"]) assert.ok(amazon.includes(value));
    const advantest = render([
      { type: "heading", level: 1, text: "Scénarios" },
      { type: "heading", level: 2, text: "Base" },
      { type: "paragraph", text: "Base scenario content." },
      { type: "heading", level: 3, text: "Hypothèses" },
      { type: "paragraph", text: "Margin and multiple assumptions remain visible." },
    ]);
    assert.match(advantest, /aria-level="3">Base/);
    assert.match(advantest, /<h3>Hypothèses<\/h3>/);
    assert.ok(advantest.includes("Margin and multiple assumptions remain visible."));
  } finally {
    await rm(outputFile, { force: true });
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("valuation presentation recognizes semantic row and column tables while rejecting unlabeled or currency-conflicted data", async () => {
  const { extractValuationSummary } = await import("../app/lib/valuation-summary.ts");
  const table = (rows) => extractValuationSummary([{ type: "table", header: true, rows }]);
  const eliLilly = table([["", "Scenario", "Target Price", "CAGR Total"], ["", "Bear", "317 USD", "5,2 %"], ["", "Base", "420 USD", "8 %"], ["", "Bull", "510 USD", "12 %"]]);
  assert.equal(eliLilly?.scenarios.length, 3);
  const sparse = extractValuationSummary([{ type: "table", header: true, rows: [["", "Scenario", "Target Price (USD)", "CAGR Total"], ["", "Bear", "317", "5,2 %"], ["", "Base", "420", "8 %"], ["", "Bull", "510", "12 %"]] }]);
  assert.deepEqual(sparse?.scenarios.map(s => [s.name, s.terminal, s.cagr]), [["Bear", "317 USD", "5,2 %"], ["Base", "420 USD", "8 %"], ["Bull", "510 USD", "12 %"]]);
  assert.deepEqual(sparse?.promotedBlockIndexes, [0]);
  const duplicateScenario = extractValuationSummary([{ type: "table", header: true, rows: [["Scenario", "Target Price", "CAGR"], ["Bear", "317 USD", "5 %"], ["Bear", "318 USD", "4 %"], ["Base", "420 USD", "8 %"]] }]);
  assert.deepEqual(duplicateScenario?.promotedBlockIndexes, [], "a duplicate scenario row cannot stand in for a missing Bull row");
  const equinix = table([["Measure", "Bear", "Base", "Bull"], ["Prix cible 2031 · USD", "317", "420", "510"], ["CAGR cours", "5,2 %", "8 %", "12 %"]]);
  assert.equal(equinix?.scenarios[1]?.terminal, "420 USD");
  const conflicting = table([["Measure", "Bear", "Base", "Bull"], ["Prix terminal · USD", "317 USD", "420 EUR", "510 USD"], ["CAGR", "5 %", "8 %", "12 %"]]);
  assert.equal(conflicting?.scenarios.length, 3);
  assert.ok(conflicting?.scenarios.every(s => !s.terminal && s.cagr));
  const duplicateConflict = extractValuationSummary([
    { type: "table", header: true, rows: [["Scenario", "Target Price", "CAGR"], ["Bear", "317 USD", "5 %"], ["Base", "420 USD", "8 %"], ["Bull", "510 USD", "12 %"]] },
    { type: "table", header: true, rows: [["Scenario", "Target Price", "CAGR"], ["Bear", "317 USD", "5 %"], ["Base", "430 USD", "8 %"], ["Bull", "510 USD", "12 %"]] },
  ]);
  assert.deepEqual(duplicateConflict?.promotedBlockIndexes, [], "conflicting duplicate values keep both source tables visible");
  const thresholdConflict = extractValuationSummary([
    { type: "heading", level: 2, text: "Prix maximal selon rendement exigé" },
    { type: "table", header: true, rows: [["Hurdle", "Prix maximal"], ["10 %", "90 USD"], ["12 %", "80 USD"], ["15 %", "70 USD"]] },
    { type: "table", header: true, rows: [["Hurdle", "Prix maximal"], ["10 %", "90 USD"], ["12 %", "75 USD"], ["15 %", "70 USD"]] },
  ]);
  assert.deepEqual(thresholdConflict?.thresholds.map(t => t.rate), ["10 %", "15 %"]);
  assert.deepEqual(thresholdConflict?.promotedBlockIndexes, [], "threshold tables with a conflicting rate remain visible");
  assert.equal(table([["Bear", "Base", "Bull"], ["317 USD", "420 USD", "510 USD"]]), null);
});

test("company analysis route keeps the company shell mounted and presents the selected document inside its panel", async () => {
  const [pageSource, companySource, navigationSource, primitiveSource] = await Promise.all([
    readFile(pageUrl, "utf8"), readFile(companyDetailUrl, "utf8"), readFile(navigationUrl, "utf8"), readFile(uiPrimitivesUrl, "utf8"),
  ]);
  assert.match(pageSource, /CompanyDetail companyId=\{selectedCompany\}[\s\S]*selectedAnalysisId=\{route\.document\}/);
  assert.match(pageSource, /route\.document && !selectedCompany/);
  assert.match(companySource, /className="company-section-block company-analysis-panel"/);
  assert.match(companySource, /role="tabpanel"/);
  assert.match(companySource, /aria-labelledby=\{`company-section-panel-tab-\$\{activeSection\}`\}/);
  assert.match(navigationSource, /openAnalysis: \(document: string \| null\) => move\(\{ \.\.\.current\.current, document \}\)/);
  assert.match(primitiveSource, /id=\{panelId \? `\$\{panelId\}-tab-\$\{option\.value\}` : undefined\}/);
  assert.match(primitiveSource, /event\.key === "Home"[\s\S]*event\.key === "End"/);
});

test("global surfaces use white content materials and shell has no blue radial canvas", async () => {
  const [globalsSource, shellSource] = await Promise.all([
    readFile(globalsUrl, "utf8"), readFile(new URL("../app/styles/ux/shell.css", import.meta.url), "utf8"),
  ]);
  assert.match(globalsSource, /--surface-canvas:\s*#fff/i);
  assert.match(globalsSource, /--surface-secondary:\s*(?:var\([^)]*,\s*)?#fff/i);
  assert.doesNotMatch(shellSource, /radial-gradient\(circle at 90%/);
});

test("embedded company analysis fetches its full document instead of rendering the stripped company preview", async () => {
  const [companySource, panelSource, previewSource] = await Promise.all([
    readFile(companyDetailUrl, "utf8"),
    readFile(new URL("../app/components/company-analysis-document.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/company-preview.ts", import.meta.url), "utf8"),
  ]);
  assert.match(previewSource, /plainText: "", notionBlocks: undefined/);
  assert.match(companySource, /<CompanyAnalysisDocument key=\{selectedDocument.id\} preview=\{selectedDocument\}/);
  assert.match(panelSource, /\/api\/analyses\/\$\{encodeURIComponent\(preview.id\)\}/);
  assert.match(panelSource, /const document = hasFullPreview \? preview : data\?\.document/);
  assert.match(panelSource, /<AnalysisReader document=\{document\} companyName=\{companyName\} embedded/);
  assert.doesNotMatch(panelSource, /<AnalysisReader document=\{preview\}/);
  assert.match(panelSource, /Document indisponible/);
  assert.match(panelSource, /Réessayer/);
});

test("the company back button returns to the Companies list regardless of visited analyses", async () => {
  const [pageSource, navigationSource, companyCss, shellCss] = await Promise.all([readFile(pageUrl, "utf8"), readFile(navigationUrl, "utf8"), readFile(new URL("../app/styles/ux/company.css", import.meta.url), "utf8"), readFile(new URL("../app/styles/ux/shell.css", import.meta.url), "utf8")]);
  assert.match(pageSource, /CompanyDetail companyId=\{selectedCompany\}[\s\S]*close=\{\(\) => navigate\("companies"\)\}/);
  assert.match(navigationSource, /navigate: \(tab: Tab\) => \{ if \(tab !== route.tab \|\| route.company \|\| route.document\) move\(\{ tab, company: null, document: null \}\)/);
  assert.match(pageSource, /DocumentView key=\{route.document\} id=\{route.document\} onBack=\{back\}/);
  assert.match(companyCss, /\.generic-company-detail > \.detail-navigation \{[\s\S]*position: sticky;[\s\S]*z-index: 40;/);
  assert.match(companyCss, /safe-area-inset-top/);
  assert.doesNotMatch(companyCss, /--company-back-left|(?:^|[;{])\s*left\s*:/m);
  assert.doesNotMatch(shellCss, /--company-back-left/);
});
