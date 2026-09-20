import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL("../app/data/analysis-reference-fixtures.json", import.meta.url);
const rendererUrl = new URL("../app/lib/notion-renderer.ts", import.meta.url);
const templateUrl = new URL("../app/data/analysis-template-registry.json", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);
const searchUrl = new URL("../app/components/document-search.tsx", import.meta.url);
const searchContractUrl = new URL("../app/lib/search-contract.ts", import.meta.url);
const workerSourceUrl = new URL("../worker/index.ts", import.meta.url);
const dataUrl = new URL("../app/lib/investment-data.ts", import.meta.url);
const syncUrl = new URL("../app/lib/notion-sync.ts", import.meta.url);
const companyDetailUrl = new URL("../app/components/company-detail.tsx", import.meta.url);
const liveHoldingSummaryUrl = new URL("../app/components/live-holding-summary.tsx", import.meta.url);
const analysisReaderUrl = new URL("../app/components/analysis-reader.tsx", import.meta.url);
const memoReaderUrl = new URL("../app/components/investment-memo-reader.tsx", import.meta.url);
const presentationUrl = new URL("../app/lib/document-presentation.ts", import.meta.url);
const presentationFixturesUrl = new URL("../app/data/document-presentation-fixtures.json", import.meta.url);
const latestInfoUrl = new URL("../app/components/latest-info-card.tsx", import.meta.url);
const notionTableUrl = new URL("../app/components/notion-table.tsx", import.meta.url);
const watchlistUrl = new URL("../app/components/notion-watchlist.tsx", import.meta.url);
const companiesUrl = new URL("../app/components/notion-companies.tsx", import.meta.url);
const analysesUrl = new URL("../app/components/notion-analyses.tsx", import.meta.url);
const uxUrl = new URL("../app/ux-foundations.css", import.meta.url);
const globalsUrl = new URL("../app/globals.css", import.meta.url);
const uiPrimitivesUrl = new URL("../app/components/ui-primitives.tsx", import.meta.url);
const uiManifestUrl = new URL("../ui-foundation-manifest.md", import.meta.url);
const primitiveStoriesUrl = new URL("../stories/UIPrimitives.stories.tsx", import.meta.url);
const referenceFrameUrl = new URL("../stories/reference-frame.tsx", import.meta.url);
const referenceStoryUrls = Object.fromEntries(
  ["Watchlist", "Companies", "Analyses", "Company", "Portfolio"].map((name) => [name, new URL(`../stories/${name}.stories.tsx`, import.meta.url)]),
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

test("metadata discovery queues only missing or edited Notion pages", async () => {
  const syncSource = await readFile(new URL("../app/lib/notion-sync.ts", import.meta.url), "utf8");
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

test("browser Notion surfaces are read-only and preserve live view refreshes", async () => {
  const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const backgroundSource = await readFile(new URL("../app/components/notion-background-sync.tsx", import.meta.url), "utf8");
  const pageSource = await readFile(pageUrl, "utf8");
  const clientSource = await readFile(new URL("../app/lib/notion-sync-client.ts", import.meta.url), "utf8");
  assert.match(workerSource, /authorizeNotionMutation/);
  assert.match(backgroundSource, /readBrowserNotionStatus/);
  assert.match(pageSource, /useResourceLifecycle/);
  assert.match(await readFile(new URL("../app/lib/client-resource.ts", import.meta.url), "utf8"), /notion-sync-complete/);
  assert.match(clientSource, /\/api\/notion\/status/);
  for (const source of [backgroundSource, clientSource]) {
    assert.doesNotMatch(source, /\/api\/notion\/(sync|import-next|sync-background|sync-portfolio|sync-all)/);
    assert.doesNotMatch(source, /request(?:Full|Pending|Background)NotionSync/);
  }
  assert.doesNotMatch(backgroundSource, /pageshow|visibilitychange|online/);
  assert.match(workerSource, /cache-control.*no-store/);
  const resourceSource = await readFile(new URL("../app/lib/client-resource.ts", import.meta.url), "utf8");
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

test("app refresh only updates the PWA shell while Notion refresh owns the snapshot", async () => {
  const globalSource = await readFile(new URL("../app/components/notion-global-refresh.tsx", import.meta.url), "utf8");
  const statusSource = await readFile(new URL("../app/components/notion-sync-status.tsx", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../app/lib/notion-sync-client.ts", import.meta.url), "utf8");
  assert.doesNotMatch(globalSource, /requestFullNotionSync|waitForFullNotionSync/);
  assert.match(globalSource, /registration\.update\(\)/);
  assert.match(globalSource, /SKIP_WAITING/);
  assert.match(statusSource, /Lecture seule/);
  assert.match(statusSource, /notion-sync-meta/);
  assert.doesNotMatch(statusSource, /onClick|request(?:Full|Pending|Background)NotionSync/);
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
  assert.match(source, /queryDataSource\(token, dataSourceId, undefined, 100\)/);
});

test("trajectory reads both targets from Notion and keeps active positions outside target visible", async () => {
  const dataSource = await readFile(dataUrl, "utf8");
  const targetSource = await readFile(new URL("../app/components/target-allocation.tsx", import.meta.url), "utf8");
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
  assert.match(targetSource, /progressCopy=completion==null/);
  assert.match(targetSource, /<span>\{eur0\.format\(currentAmount \?\? 0\)\} actuels<\/span>/);
  assert.match(targetSource, /<span>\{completion\.toFixed\(1\)\}% de la cible<\/span>/);
  assert.match(targetSource, /target-progress-copy/);
  assert.match(targetSource, /completion>110&&surplus>targetValue\*\.005/);
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

test("canonical state projection keeps ownership and watchlist dimensions separate", async () => {
  const source = await readFile(dataUrl, "utf8");
  assert.match(source, /function monitoringStatusFor/);
  assert.match(source, /monitoringStatus:monitoringStatusFor\(p\)/);
  assert.match(source, /ownershipStatus:owned \? "Owned" : "Not owned"/);
  assert.match(source, /watchlistMembership/);
  assert.match(source, /watchlistCompanyIds/);
  assert.match(source, /companyThemes/);
  assert.match(source, /const themes=\[\.\.\.new Set\(companyIds\.flatMap/);
  assert.doesNotMatch(source, /function effectiveCompanyStatus/);
});

test("canonical UI consumes monitoring, decision and company themes independently", async () => {
  const dataSource = await readFile(dataUrl, "utf8");
  const companiesSource = await readFile(companiesUrl, "utf8");
  const watchlistSource = await readFile(watchlistUrl, "utf8");
  const detailSource = await readFile(companyDetailUrl, "utf8");
  assert.match(dataSource, /canonical==="To deepen"\)return "To analyse"/);
  assert.match(dataSource, /legacy==="À approfondir"\)return "To analyse"/);
  assert.match(dataSource, /items\.flatMap\(item=>item\.themes\)/);
  assert.match(dataSource, /conflictingWatchlistCompanyIds/);
  assert.match(dataSource, /watchlistStateByCompany\.delete\(companyId\)/);
  assert.match(dataSource, /explicitCompanyIds\.length\?explicitCompanyIds/);
  assert.match(dataSource, /relationIdsFromNotion\.length\?relationIdsFromNotion:linkedCompanies/);
  assert.match(companiesSource, /item\.ownershipStatus/);
  assert.match(companiesSource, /item\.watchlistMembership/);
  assert.match(companiesSource, /item\.monitoringStatus/);
  assert.doesNotMatch(companiesSource, /item\.status|item\.categories|item\.owned/);
  assert.match(watchlistSource, /item\.monitoringStatus/);
  assert.match(watchlistSource, /item\.themes/);
  assert.match(watchlistSource, /item\.ownershipStatus/);
  assert.doesNotMatch(watchlistSource, /item\.status|item\.categories/);
  assert.match(detailSource, /data\.ownershipStatus/);
  assert.match(detailSource, /data\.watchlistMembership/);
  assert.match(detailSource, /data\.monitoringStatus/);
  assert.match(detailSource, /data\.decision/);
  assert.doesNotMatch(detailSource, /data\.owned/);
});

test("Notion integrity audits the actual watchlist membership and relation conflicts", async () => {
  const workerSource = await readFile(workerSourceUrl, "utf8");
  assert.match(workerSource, /currentAudit\.filter\(item=>item\.watchlist\)/);
  assert.match(workerSource, /watchlistMissingCompany/);
  assert.match(workerSource, /watchlistMultipleCompanies/);
  assert.match(workerSource, /duplicateWatchlistCompanies/);
  assert.doesNotMatch(workerSource, /currentAudit\.filter\(item=>!item\.owned\)/);
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
  const uxSource = await readFile(uxUrl, "utf8");
  assert.match(dataSource, /export type EarningsReviewFields/);
  assert.match(dataSource, /Business.*Valuation.*Short.*Portfolio.*Mémo CIO/s);
  assert.match(dataSource, /propertyValue\(p,"Earnings Date"\).*propertyValue\(p,"Analysis Date"\)/);
  assert.match(companySource, /function EarningsReviewCard/);
  assert.match(companySource, /<MetadataGrid/);
  assert.match(companySource, /<SecondaryBlock className="earnings-routing-item"/);
  assert.match(companySource, /Refresh recommandé/);
  assert.match(companySource, /Refresh requis/);
  assert.match(companySource, /section === "earnings" && <EarningsSection/);
  assert.doesNotMatch(companySource, /Execution Score/);
  assert.match(uxSource, /Earnings — latest quarter and cross-module refresh routing/);
  assert.match(uxSource, /\.earnings-routing-grid/);
});

test("two-column earnings tables prioritize result readability on mobile", async () => {
  const tableSource = await readFile(new URL("../app/components/notion-table.tsx", import.meta.url), "utf8");
  const uxSource = await readFile(uxUrl, "utf8");
  assert.match(tableSource, /columnCount === 2 \? " notion-table-two-column"/);
  assert.match(uxSource, /data-analysis-template="earnings".*notion-table-two-column/s);
  assert.match(uxSource, /width: 32% !important/);
  assert.match(uxSource, /width: 68% !important/);
  assert.match(uxSource, /table-layout: fixed !important/);
});

test("document search uses the server-side full-text endpoint", async () => {
  const searchSource = await readFile(searchUrl, "utf8");
  const workerSource = await readFile(workerSourceUrl, "utf8");
  assert.match(searchSource, /fetch\(`\/api\/notion\/search\?\$\{params\}`/);
  assert.doesNotMatch(searchSource, /fetch\("\/api\/analyses"/);
  assert.match(workerSource, /searchResearchDocuments\(env\.DB, query/);
  assert.doesNotMatch(searchSource, /nebius-(business|valuation|short|portfolio|memo|earnings).json/);
});

test("full-text search is accent-insensitive, conjunctive and reads beyond 700 characters", async () => {
  const { normalizeSearchText, rankSearchDocuments, searchExcerpt } = await import(searchContractUrl.href);
  assert.equal(normalizeSearchText("Prépaiements & CoWoS"), "prepaiements cowos");
  const longText = `${"socle ".repeat(150)}dilution maîtrisée par le free cash flow`;
  const base = {
    id: "current", sourceKey: "analyses", title: "Analyse actuelle", companyName: "TSMC", companyId: "company",
    category: "valuation", agent: "Valuation Analyst", notionUrl: "https://www.notion.so/current",
    lastEditedTime: "2026-08-29T12:00:00.000Z", date: "2026-08-29", status: "Validated", verdict: "Attractive",
    current: true, validated: true, archived: false, destination: "document",
  };
  const results = rankSearchDocuments([
    { ...base, plainText: longText },
    { ...base, id: "partial", title: "Dilution seulement", plainText: "dilution", current: false, archived: true },
  ], "dilution cash");
  assert.deepEqual(results.map(result => result.id), ["current"]);
  assert.match(results[0].excerpt, /dilution maîtrisée par le free cash flow/i);
  assert.ok(longText.indexOf("dilution") > 700);
  assert.match(searchExcerpt("Le Prépaiement protège la capacité.", ["prepaiement"]), /Prépaiement/);
});

test("current validated research ranks ahead of verbose archives", async () => {
  const { highlightSearchText, rankSearchDocuments } = await import(searchContractUrl.href);
  const shared = {
    sourceKey: "analyses", title: "Analyse du ROIC", companyName: "NVIDIA", companyId: "company", category: "business",
    agent: "Business Analyst", notionUrl: "https://www.notion.so/doc", lastEditedTime: "2026-08-29T12:00:00.000Z",
    date: "2026-08-29", status: "Validated", verdict: "Excellent", destination: "document",
  };
  const results = rankSearchDocuments([
    { ...shared, id: "archive", plainText: "ROIC ".repeat(80), current: false, validated: true, archived: true },
    { ...shared, id: "current", plainText: "Le ROIC reste supérieur au WACC.", current: true, validated: true, archived: false },
  ], "roic");
  assert.equal(results[0].id, "current");
  assert.ok(highlightSearchText("Prépaiement", ["prepaiement"]).some(part => part.match && part.text === "Prépaiement"));
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
  assert.match(readerSource, /parseNotionDocument\(document\.plainText, document\.title, document\.notionBlocks\)/);
  assert.match(readerSource, /analysis-source-details/);
  assert.match(readerSource, /scenarioKind\(block\.text\)/);
  assert.match(readerSource, /<NotionTable/);
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
  const uxSource = await readFile(uxUrl, "utf8");
  assert.match(presentationSource, /export function AnalysisReportHero/);
  assert.match(presentationSource, /export function AnalysisFactGrid/);
  assert.match(presentationSource, /<MetadataGrid/);
  assert.match(readerSource, /<AnalysisReportHero/);
  assert.match(readerSource, /<AnalysisFactGrid/);
  assert.match(memoSource, /<AnalysisReportHero/);
  assert.match(memoSource, /<AnalysisFactGrid/);
  assert.doesNotMatch(readerSource, /document\.verdict \|\| "Non renseigné"/);
  assert.match(readerSource, /scored && document\.score/);
  assert.match(memoSource, /value: document\.verdict \|\| "À statuer"/);
  assert.match(primitiveSource, /className\?: string/);
  assert.match(uxSource, /\.analysis-report-hero--without-outcome/);
  assert.match(uxSource, /\.analysis-key-fact--priority/);
  assert.match(uxSource, /\.analysis-structured-value > span \+ span/);
});

test("Investment Memo CIO has a dedicated decision view without a numeric memo score", async () => {
  const memoSource = await readFile(memoReaderUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  const companySource = await readFile(companyDetailUrl, "utf8");
  const analysesSource = await readFile(analysesUrl, "utf8");
  assert.match(readerSource, /<InvestmentMemoReader/);
  assert.match(companySource, /\["memo", "Mémo CIO"\]/);
  assert.match(memoSource, /Decision Card/);
  assert.match(memoSource, /Raisonnement décisif/);
  assert.match(memoSource, /État des quatre modules/);
  assert.match(memoSource, /!\/\^\(\?:score\|note\)/);
  assert.doesNotMatch(memoSource, /document\.score/);
  assert.match(analysesSource, /item\.category === "business" \|\| item\.category === "valuation"/);
});

test("Notion tables use one adaptive reusable component", async () => {
  const tableSource = await readFile(notionTableUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  const uxSource = await readFile(uxUrl, "utf8");
  assert.match(tableSource, /export function NotionTable/);
  assert.match(tableSource, /--notion-columns/);
  assert.match(tableSource, /Tableau défilable horizontalement/);
  assert.match(tableSource, /notion-table-wide/);
  assert.match(readerSource, /<NotionTable/);
  assert.match(uxSource, /\.notion-table[\s\S]*table-layout: auto !important/);
  assert.match(uxSource, /border: 1px solid var\(--color-border\)/);
  assert.match(uxSource, /Final mobile cascade guard/);
  assert.ok(uxSource.lastIndexOf("Final mobile cascade guard") > uxSource.lastIndexOf("Structured Notion documents"));
  assert.match(uxSource, /min-width: max\(100%, calc\(var\(--notion-columns\) \* 148px\)\)/);
});

test("company summaries are segmented for a scannable mobile preview", async () => {
  const latestInfoSource = await readFile(latestInfoUrl, "utf8");
  assert.match(latestInfoSource, /function previewItems/);
  assert.match(latestInfoSource, /slice\(0, 3\)/);
  assert.match(latestInfoSource, /remaining: Math\.max\(0, source\.length - 3\)/);
  assert.match(latestInfoSource, /const preview = previewItems\(summary\)/);
});

test("research copy uses the shared readable text token", async () => {
  const uxSource = await readFile(uxUrl, "utf8");
  assert.match(uxSource, /--color-content-copy: #3a3a3c/);
  assert.match(uxSource, /\.analysis-lead p,[\s\S]*\.notion-callout p,[\s\S]*color: var\(--color-content-copy\) !important/);
  assert.match(uxSource, /-webkit-text-fill-color: var\(--color-content-copy\) !important/);
  assert.ok(uxSource.lastIndexOf("Content readability guard") > uxSource.lastIndexOf("Final mobile cascade guard"));
});

test("discovery lists keep stable identities and separate interactive targets", async () => {
  const watchlistSource = await readFile(watchlistUrl, "utf8");
  const companiesSource = await readFile(companiesUrl, "utf8");
  const analysesSource = await readFile(analysesUrl, "utf8");

  assert.doesNotMatch(watchlistSource, /accentFor/);
  assert.match(watchlistSource, /watch-card-compact/);
  assert.doesNotMatch(watchlistSource, /convictionScore/);
  assert.match(companiesSource, /company-identity-button/);
  assert.doesNotMatch(companiesSource, /role="button"/);
  assert.match(analysesSource, /analysis-verdict-cell/);
  assert.match(analysesSource, /analysis-freshness/);
});

test("Apple Light theme stays isolated from data and parser contracts", async () => {
  const uxSource = await readFile(uxUrl, "utf8");
  const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(uxSource, /Apple Light surface layer/);
  assert.match(uxSource, /color-scheme: light/);
  assert.match(uxSource, /backdrop-filter: saturate\(180%\) blur\(24px\)/);
  assert.match(uxSource, /--color-bg: #f5f5f7/);
  assert.match(layoutSource, /themeColor: "#f5f5f7"/);
});

test("Apple Light theme covers shared surfaces and aligns financial figures", async () => {
  const uxSource = await readFile(uxUrl, "utf8");
  const globalsSource = await readFile(globalsUrl, "utf8");
  assert.match(uxSource, /Apple Light completeness and financial alignment/);
  assert.match(uxSource, /\.ui-metadata-item/);
  assert.match(globalsSource, /\.decision-template \{/);
  assert.match(globalsSource, /--surface-secondary: rgba\(242, 242, 247, \.92\)/);
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
  const uxSource = await readFile(uxUrl, "utf8");
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

test("discovery surfaces use the shared design-system component layer", async () => {
  const primitiveSource = await readFile(uiPrimitivesUrl, "utf8");
  const companiesSource = await readFile(companiesUrl, "utf8");
  const analysesSource = await readFile(analysesUrl, "utf8");
  const watchlistSource = await readFile(watchlistUrl, "utf8");
  assert.match(primitiveSource, /export function SearchField/);
  assert.match(primitiveSource, /export function Badge/);
  assert.match(primitiveSource, /export function SectionHeader/);
  assert.match(primitiveSource, /export function FilterBar/);
  assert.match(primitiveSource, /export function Tabs/);
  assert.match(primitiveSource, /export function DiscoveryCard/);
  assert.match(primitiveSource, /export function StatCard/);
  assert.match(primitiveSource, /export function AsyncState/);
  for (const source of [companiesSource, analysesSource, watchlistSource]) {
    assert.match(source, /<SearchField/);
  }
  assert.match(companiesSource, /<DiscoveryCard[^>]+kind="company"/);
  assert.match(analysesSource, /<DiscoveryCard[^>]+kind="analysis"/);
  assert.match(watchlistSource, /<DiscoveryCard[^>]+kind="watchlist"/);
  assert.doesNotMatch(`${companiesSource}\n${analysesSource}\n${watchlistSource}`, /className="company-toolbar"|className="search-field"|className="company-count"|className="filter-row"/);
});

test("UI-2 keeps the 21-primitive manifest and fixed mobile reference states", async () => {
  const primitiveSource = await readFile(uiPrimitivesUrl, "utf8");
  const manifest = await readFile(uiManifestUrl, "utf8");
  const primitiveStories = await readFile(primitiveStoriesUrl, "utf8");
  const referenceFrame = await readFile(referenceFrameUrl, "utf8");
  const referenceStorySources = Object.fromEntries(
    await Promise.all(Object.entries(referenceStoryUrls).map(async ([name, url]) => [name, await readFile(url, "utf8")])),
  );
  const referenceStories = Object.values(referenceStorySources).join("\n");
  const exportedFunctions = primitiveSource.match(/^export function /gm) ?? [];

  assert.equal(exportedFunctions.length, 21);
  assert.equal((manifest.match(/^\| \d+ \| `[^`]+` \|/gm) ?? []).length, 21);
  assert.match(manifest, /ui-primitives\.tsx → ui-foundation-manifest\.md → Storybook → Lovable/);
  assert.match(primitiveStories, /export const Surfaces/);
  assert.match(primitiveStories, /export const Controls/);
  assert.match(referenceFrame, /width: 390/);
  for (const screen of ["Watchlist", "Companies", "Analyses"]) {
    assert.match(referenceStorySources[screen], new RegExp(`export const ${screen}:`));
    for (const state of ["Empty", "Loading", "Error"]) {
      assert.match(referenceStorySources[screen], new RegExp(`export const ${state}:`));
    }
  }
  assert.match(referenceStories, /import \{ NotionAnalyses \} from "\.\.\/app\/components\/notion-analyses"/);
  assert.match(referenceStories, /<NotionAnalyses initialData=\{analysesData\}/);
  assert.match(referenceStories, /<NotionAnalyses initialData=\{emptyAnalysesData\}/);
  assert.match(referenceStories, /<NotionAnalyses initialLoading \/>/);
  assert.match(referenceStories, /<NotionAnalyses initialError=/);
  assert.doesNotMatch(referenceStories, /function AnalysesReference/);
  assert.match(referenceStories, /reference-fixtures/);
  assert.match(referenceStories, /reference-frame/);
});

test("research actions and coverage use the shared mobile UI primitives", async () => {
  const primitiveSource = await readFile(uiPrimitivesUrl, "utf8");
  const companySource = await readFile(companyDetailUrl, "utf8");
  const holdingSource = await readFile(liveHoldingSummaryUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  const latestInfoSource = await readFile(latestInfoUrl, "utf8");
  const uxSource = await readFile(uxUrl, "utf8");

  assert.match(primitiveSource, /export function ActionButton/);
  assert.match(primitiveSource, /export function BackButton/);
  assert.match(primitiveSource, /export function DataTable/);
  assert.match(latestInfoSource, /<ActionButton className="featured-document-open"/);
  assert.doesNotMatch(latestInfoSource, /company-document-open/);
  assert.match(companySource, /<DataTable\s+columns=\{columns\}/);
  assert.match(companySource, /key:\s*"score",\s*label:\s*"Conclusion"/);
  assert.match(companySource, /documentConclusion\(item\.document\)/);
  assert.doesNotMatch(companySource, /research-verdict-cell/);
  assert.match(holdingSource, /className="holding-summary-state holding-summary-loading" aria-busy="true"/);
  assert.doesNotMatch(companySource, /panel company-research-overview/);
  assert.doesNotMatch(readerSource, /analysis-section-number/);
  assert.match(uxSource, /Reusable research UI consolidation/);
  assert.match(uxSource, /\.company-section-block,[\s\S]*background: transparent !important/);
  assert.match(uxSource, /\.research-coverage-table \.ui-data-table tr[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(52px, \.65fr\) minmax\(68px, auto\)/);
  assert.match(uxSource, /research-coverage-table \.ui-data-table \.research-type-cell[\s\S]*grid-row: 1;/);
});

test("analysis and company details share the same nested liquid-glass primitives", async () => {
  const primitiveSource = await readFile(uiPrimitivesUrl, "utf8");
  const readerSource = await readFile(analysisReaderUrl, "utf8");
  const companySource = await readFile(companyDetailUrl, "utf8");
  const latestInfoSource = await readFile(latestInfoUrl, "utf8");
  const uxSource = await readFile(uxUrl, "utf8");
  const globalsSource = await readFile(globalsUrl, "utf8");

  assert.match(primitiveSource, /export function PrimaryBlock/);
  assert.match(primitiveSource, /export function SecondaryBlock/);
  assert.match(primitiveSource, /export function GlassChrome/);
  assert.match(primitiveSource, /const SurfaceContext = createContext/);
  assert.match(primitiveSource, /parentSurface === "primary" \|\| parentSurface === "secondary"/);
  assert.match(primitiveSource, /export function MetadataGrid/);
  assert.match(primitiveSource, /export function DisclosureSurface/);
  assert.match(readerSource, /<PrimaryBlock\s+as="article"\s+className="notion-page universal-analysis-page"/);
  assert.match(readerSource, /<BackButton onBack=\{onBack\} ariaLabel="Retour à la liste précédente" \/>/);
  assert.doesNotMatch(readerSource, /className="back-button"/);
  assert.match(companySource, /<BackButton onBack=\{close\} ariaLabel="Retour à la vue précédente" \/>/);
  assert.doesNotMatch(companySource, /className="back-button"/);
  assert.match(uxSource, /\.ui-back-button \{/);
  assert.match(uxSource, /prefers-reduced-transparency: reduce/);
  assert.match(readerSource, /<SecondaryBlock className="analysis-lead"/);
  assert.match(readerSource, /<AnalysisFactGrid\s+ariaLabel="Repères du document"/);
  assert.match(readerSource, /<DisclosureSurface\s+className="analysis-source-details"/);
  assert.match(latestInfoSource, /<PrimaryBlock as="article" className="detail-card latest-info-card"/);
  assert.doesNotMatch(latestInfoSource, /className="panel/);
  assert.match(latestInfoSource, /<SecondaryBlock className="latest-info-summary"/);
  assert.match(latestInfoSource, /<MetadataGrid items=/);
  assert.match(uxSource, /Shared nested liquid-glass surfaces/);
  assert.match(uxSource, /\.company-summary-grid,[\s\S]*background: transparent !important/);
  assert.match(globalsSource, /Apple-inspired semantic surface system/);
  assert.match(globalsSource, /\.ui-surface--primary[\s\S]*--surface-primary/);
  assert.match(globalsSource, /\.ui-surface--secondary[\s\S]*--surface-secondary/);
  assert.match(globalsSource, /\.ui-surface--glass[\s\S]*backdrop-filter/);
  assert.match(globalsSource, /prefers-reduced-transparency: reduce/);
  assert.doesNotMatch(`${primitiveSource}\n${uxSource}\n${globalsSource}`, /ui-primary-block|ui-secondary-block/);
  assert.doesNotMatch(`${primitiveSource}\n${uxSource}\n${globalsSource}`, /InsetSurface|ui-inset-surface/);
  assert.doesNotMatch(`${uxSource}\n${globalsSource}`, /analysis-meta-grid|analysis-fact-grid|latest-info-meta|latest-info-facts/);
  assert.doesNotMatch(uxSource, /\.company-research-overview > button \{/);
});

test("analysis section headings stay contained in their shared surface", async () => {
  const globalsSource = await readFile(globalsUrl, "utf8");
  assert.match(globalsSource, /Keep every Notion section heading inside its shared analysis surface/);
  assert.match(globalsSource, /\.universal-analysis-page \.analysis-section \{[\s\S]*box-sizing: border-box;[\s\S]*width: 100%;[\s\S]*overflow: hidden;/);
  assert.match(globalsSource, /\.universal-analysis-page \.analysis-section > h2,[\s\S]*overflow-wrap: anywhere !important;/);
});

test("active discovery actions no longer depend on legacy button classes", async () => {
  const watchlistSource = await readFile(watchlistUrl, "utf8");
  const analysesSource = await readFile(analysesUrl, "utf8");
  const uxSource = await readFile(uxUrl, "utf8");

  assert.match(watchlistSource, /<DiscoveryAction/);
  assert.doesNotMatch(watchlistSource, /watch-card-action/);
  assert.match(analysesSource, /<ActionButton className="analysis-load-more"/);
  assert.doesNotMatch(watchlistSource, /card-link/);
  assert.doesNotMatch(analysesSource, /primary-button/);
  assert.doesNotMatch(uxSource, /\.primary-button/);
  assert.doesNotMatch(uxSource, /\.card-link/);
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
