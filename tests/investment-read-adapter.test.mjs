import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

let modules;
async function apis() {
  if (modules) return modules;
  const root = fileURLToPath(new URL("../", import.meta.url));
  const bundle = async path => {
    const result = await build({ entryPoints: [`${root}/${path}`], bundle: true, write: false, platform: "node", format: "esm" });
    return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  };
  modules = {
    adapter: await bundle("adapters/notion/investment-reads.ts"),
    legacy: await bundle("app/lib/investment-data.ts"),
    sync: await bundle("app/lib/notion-sync.ts"),
    selection: await bundle("core/analysis/current-selection.ts"),
    preview: await bundle("app/lib/company-preview.ts"),
    contracts: await bundle("core/contracts/investment.ts"),
  };
  return modules;
}

async function fixture() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of (await readdir(`${root}/drizzle`)).filter(file => file.endsWith(".sql")).sort()) {
    sqlite.exec(await readFile(`${root}/drizzle/${migration}`, "utf8"));
  }
  sqlite.exec(`CREATE TABLE notion_document_companies (document_page_id TEXT NOT NULL, company_page_id TEXT NOT NULL, match_method TEXT NOT NULL, matched_at TEXT NOT NULL, PRIMARY KEY(document_page_id, company_page_id));
    CREATE TABLE notion_relations (source_page_id TEXT NOT NULL, source_key TEXT NOT NULL, property_name TEXT NOT NULL, target_page_id TEXT NOT NULL, target_source_key TEXT, matched_at TEXT NOT NULL, PRIMARY KEY(source_page_id, property_name, target_page_id));`);
  const reads = { bodyIds: new Set() };
  const db = { async batch(statements) { return Promise.all(statements.map(statement => statement.run())); }, prepare(query) {
    const statement = sqlite.prepare(query); let bindings = [];
    const observe = rows => { for (const row of rows) if (row.blocks_json) reads.bodyIds.add(row.page_id); };
    const prepared = {
      bind(...values) { bindings = values; return prepared; },
      async all() { const results = statement.all(...bindings); observe(results); return { results }; },
      async first() { const result = statement.get(...bindings) ?? null; if (result) observe([result]); return result; },
      async run() { const result = statement.run(...bindings); return { success: true, meta: { changes: result.changes } }; },
    };
    return prepared;
  } };
  const rich = value => ({ type: "rich_text", rich_text: [{ plain_text: value }] });
  const title = value => ({ type: "title", title: [{ plain_text: value }] });
  const relation = (...ids) => ({ type: "relation", relation: ids.map(id => ({ id })) });
  const ids = {
    company: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    current: "a1111111-a111-4111-8111-a11111111111",
    archive: "b2222222-b222-4222-8222-b22222222222",
    active: "c3333333-c333-4333-8333-c33333333333",
    sold: "d4444444-d444-4444-8444-d44444444444",
  };
  const insert = sqlite.prepare("INSERT INTO notion_documents VALUES(?,?,?,?,?,?,?,?,?)");
  const save = (id, source, name, properties, plainText, blocks = "[]", edited = "2026-09-30T10:00:00Z") => insert.run(id, source, name, `https://notion.so/${id}`, edited, JSON.stringify(properties), blocks, plainText, "2026-09-30T10:00:00Z");
  save(ids.company, "companies", "Example Systems", {
    Company: title("Example Systems"), Ticker: rich("EXM"), ISIN: rich("US0378331005"), "Current Business Analysis": relation(ids.current), Currency: rich("USD"),
  }, "");
  const reportBlocks = JSON.stringify([{ id: "report-paragraph", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Revenue grew steadily." }] } }]);
  save(ids.current, "analyses", "Example Business Analysis", {
    Company: relation(ids.company), Agent: rich("Business Analyst"), Status: rich("Validated"), Date: { type: "date", date: { start: "2026-09-29" } }, "TL;DR": rich("Growth remains steady."),
  }, "Revenue grew steadily.", reportBlocks, "2026-09-30T10:00:00Z");
  save(ids.archive, "analyses", "Example Business Analysis Archived", {
    Company: relation(ids.company), Agent: rich("Business Analyst"), Status: rich("Superseded"), Date: { type: "date", date: { start: "2025-09-29" } },
  }, "Archived operating evidence.", reportBlocks, "2025-10-01T10:00:00Z");
  save(ids.active, "portfolio", "NVIDIA — PEA", {
    Position: title("NVIDIA — PEA"), Status: rich("Active"), Quantity: { type: "number", number: 2 }, PRU: { type: "number", number: 50 }, Account: rich("PEA"),
    "Target Weight": { type: "number", number: 0.1 }, "Target Weight 10k": { type: "number", number: 0.2 }, Company: relation(ids.company),
  }, "");
  save(ids.sold, "portfolio", "Old holding", {
    Position: title("Old holding"), Status: rich("Sold"), Quantity: { type: "number", number: 0 }, "Target Weight": { type: "number", number: 0.4 },
  }, "");
  for (const documentId of [ids.current, ids.archive]) sqlite.prepare("INSERT INTO notion_document_companies VALUES(?,?,?,?)").run(documentId, ids.company, "notion-relation", "2026-09-30T10:00:00Z");
  const clearReads = () => reads.bodyIds.clear();
  return { db, sqlite, ids, reads, clearReads };
}

test("read adapter preserves legacy company/document/portfolio payloads while validating canonical projections", async () => {
  const [{ createInvestmentReadAdapter, canonicalCompany, canonicalPortfolio, canonicalQuote }, legacy, preview, contracts] = await Promise.all([
    apis().then(result => result.adapter), apis().then(result => result.legacy), apis().then(result => result.preview), apis().then(result => result.contracts),
  ]);
  const data = await fixture();
  const adapter = createInvestmentReadAdapter(data.db);

  const oldCompany = await legacy.getCompanyDetail(data.db, data.ids.company);
  const bridgeCompany = await adapter.getCompany(data.ids.company);
  assert.deepEqual(bridgeCompany, preview.companyPreview(oldCompany));
  assert.equal(contracts.validateCompanyPreview(canonicalCompany(oldCompany)), true);
  assert.equal(bridgeCompany.analyses[0].plainText, "");
  assert.equal(bridgeCompany.archives[0].plainText, "");
  assert.deepEqual([...data.reads.bodyIds].sort(), [data.ids.active, data.ids.archive, data.ids.current].sort(), "company detail reads only its related current/archive and active-position candidate bodies");

  const oldPortfolio = await legacy.getLivePortfolio(data.db, false, true);
  const bridgePortfolio = await adapter.getPortfolio({ force: false, cacheOnly: true });
  const comparable = value => ({ ...value, generatedAt: "normalized" });
  assert.deepEqual(comparable(bridgePortfolio), comparable(oldPortfolio));
  assert.equal(contracts.validatePortfolio(canonicalPortfolio(oldPortfolio)), true);
  assert.deepEqual(bridgePortfolio.positions.map(position => position.id), [data.ids.active]);
  assert.equal(bridgePortfolio.targetLines.some(line => line.name === "Old holding"), false);

  const [quote] = await adapter.getQuotes(["nvda"], { cacheOnly: true });
  assert.equal(contracts.validateQuote(canonicalQuote(quote)), true);
  data.sqlite.close();
});

test("identity adapter resolves from company rows without reading analysis bodies", async () => {
  const { createInvestmentService } = (await apis()).adapter;
  const data = await fixture();
  data.clearReads();
  const service = createInvestmentService(data.db);
  const ticker = await service.resolveCompany("EXM");
  assert.equal(ticker.status, "ok");
  assert.equal(ticker.data.status, "resolved");
  assert.equal(ticker.data.candidates[0].companyId, data.ids.company.replaceAll("-", ""));
  assert.deepEqual([...data.reads.bodyIds], []);
  assert.equal((await service.resolveCompany("Unknown")).data.status, "not_found");
  const byIsin = await service.resolveCompany("US0378331005");
  assert.equal(byIsin.data.status, "resolved", "ISIN read from the Notion cache");
  assert.equal(byIsin.data.candidates[0].isin, "US0378331005");
  assert.equal(byIsin.data.candidates[0].assetId, null, "no exchange on the listing: no guessed quote symbol");
  data.sqlite.close();
});

test("history lookup by UUID preserves the archived legacy document and source date", async () => {
  const [{ createInvestmentReadAdapter }, legacy] = await Promise.all([
    apis().then(result => result.adapter), apis().then(result => result.legacy),
  ]);
  const data = await fixture();
  const adapter = createInvestmentReadAdapter(data.db);
  const oldHistorical = await legacy.getResearchDocument(data.db, data.ids.archive);
  const bridgeHistorical = await adapter.getAnalysisById(data.ids.archive);
  assert.deepEqual(bridgeHistorical, oldHistorical);
  assert.equal(bridgeHistorical.archived, true);
  assert.equal(bridgeHistorical.date, "2025-09-29");
  assert.equal(bridgeHistorical.presentationStatus, "absent");
  data.sqlite.close();
});

test("Current adapter separates Business, CIO Memo, Decision and Earnings pointers and loads only the selected body", async () => {
  const [{ createInvestmentReadAdapter }] = await Promise.all([apis().then(result => result.adapter)]);
  const data = await fixture();
  const rich = value => ({ type: "rich_text", rich_text: [{ plain_text: value }] });
  const relation = (...ids) => ({ type: "relation", relation: ids.map(id => ({ id })) });
  const title = value => ({ type: "title", title: [{ plain_text: value }] });
  const ids = {
    memo: "e5555555-e555-4555-8555-eeeeeeeeeeee",
    decision: "f6666666-f666-4666-8666-ffffffffffff",
    earnings: "17777777-1777-4777-8777-177777777777",
    valuation: "58888888-5888-4888-8888-588888888888",
    short: "69999999-6999-4999-8999-699999999999",
    portfolio: "7aaaaaaa-7aaa-4aaa-8aaa-7aaaaaaaaaaa",
    otherCompany: "28888888-2888-4888-8888-288888888888",
    wrongOwner: "39999999-3999-4999-8999-399999999999",
    wrongFamily: "4aaaaaaa-4aaa-4aaa-8aaa-4aaaaaaaaaaa",
  };
  const reportBlocks = JSON.stringify([{ id: "current-block", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Selected body." }] } }]);
  const insert = data.sqlite.prepare("INSERT INTO notion_documents VALUES(?,?,?,?,?,?,?,?,?)");
  const save = (id, source, name, properties, body = "Selected body.", blocks = reportBlocks) => insert.run(id, source, name, `https://notion.so/${id}`, "2026-09-30T10:00:00Z", JSON.stringify(properties), blocks, body, "2026-09-30T10:00:00Z");
  const companyProperties = JSON.parse(data.sqlite.prepare("SELECT properties_json FROM notion_documents WHERE page_id=?").get(data.ids.company).properties_json);
  companyProperties["Current Investment Memo"] = relation(ids.memo);
  companyProperties["Current Investment Decision"] = relation(ids.decision);
  companyProperties["Latest Earnings"] = relation(ids.earnings);
  companyProperties["Current Valuation Analysis"] = relation(ids.valuation);
  companyProperties["Current Short Analysis"] = relation(ids.short);
  companyProperties["Current Portfolio Analysis"] = relation(ids.portfolio);
  data.sqlite.prepare("UPDATE notion_documents SET properties_json=? WHERE page_id=?").run(JSON.stringify(companyProperties), data.ids.company);
  save(ids.memo, "analyses", "Example Investment Memo", { Company: relation(data.ids.company), Agent: rich("Investment Memo"), Status: rich("Validated"), "TL;DR": rich("Memo summary") });
  save(ids.decision, "decisions", "Example Investment Decision", { Company: relation(data.ids.company), Status: rich("Validated"), Date: { type: "date", date: { start: "2026-09-28" } } });
  save(ids.earnings, "earnings", "Example Earnings Review", { Company: relation(data.ids.company), Agent: rich("Earnings Analyst"), Status: rich("Validated"), "Earnings Date": { type: "date", date: { start: "2026-09-27" } } });
  save(ids.valuation, "analyses", "Example Valuation Analysis", { Company: relation(data.ids.company), Agent: rich("Valuation Analyst"), Status: rich("Validated") });
  save(ids.short, "analyses", "Example Short Analysis", { Company: relation(data.ids.company), Agent: rich("Short Seller"), Status: rich("Validated") });
  save(ids.portfolio, "analyses", "Example Portfolio Analysis", { Company: relation(data.ids.company), Agent: rich("Portfolio Manager"), Status: rich("Validated") });
  save(ids.otherCompany, "companies", "Other Systems", { Company: title("Other Systems"), Ticker: rich("OTH") }, "", "[]");
  save(ids.wrongOwner, "analyses", "Other Business Analysis", { Company: relation(ids.otherCompany), Agent: rich("Business Analyst"), Status: rich("Validated") });
  save(ids.wrongFamily, "analyses", "Other Unmapped Note", { Company: relation(data.ids.company), Agent: rich("Unmapped Agent"), Status: rich("Validated") });
  for (const documentId of [ids.memo, ids.decision, ids.earnings, ids.valuation, ids.short, ids.portfolio]) {
    data.sqlite.prepare("INSERT INTO notion_document_companies VALUES(?,?,?,?)").run(documentId, data.ids.company, "notion-relation", "2026-09-30T10:00:00Z");
  }
  data.sqlite.prepare("INSERT INTO notion_document_companies VALUES(?,?,?,?)").run(ids.wrongOwner, ids.otherCompany, "notion-relation", "2026-09-30T10:00:00Z");
  data.sqlite.prepare("INSERT INTO notion_document_companies VALUES(?,?,?,?)").run(ids.wrongFamily, data.ids.company, "notion-relation", "2026-09-30T10:00:00Z");

  const adapter = createInvestmentReadAdapter(data.db);
  for (const [family, pointer, expectedId] of [
    ["business", "Current Business Analysis", data.ids.current],
    ["cio_memo", "Current Investment Memo", ids.memo],
    ["decision", "Current Investment Decision", ids.decision],
    ["earnings", "Latest Earnings", ids.earnings],
    ["valuation", "Current Valuation Analysis", ids.valuation],
    ["short", "Current Short Analysis", ids.short],
    ["portfolio", "Current Portfolio Analysis", ids.portfolio],
  ]) {
    data.clearReads();
    const result = await adapter.getCurrentAnalysis(data.ids.company, family);
    assert.equal(result.status, "ok", `${family} selected through ${pointer}`);
    assert.equal(result.data.header.id, expectedId.replaceAll("-", ""));
    assert.deepEqual([...data.reads.bodyIds], [expectedId], `${family} reads only its selected document body`);
  }
  data.sqlite.close();
});

test("Current selector reports wrong owner, wrong family, archived target and missing memo pointer distinctly", async () => {
  const [{ createInvestmentReadAdapter }] = await Promise.all([apis().then(result => result.adapter)]);
  const data = await fixture();
  const rich = value => ({ type: "rich_text", rich_text: [{ plain_text: value }] });
  const relation = (...ids) => ({ type: "relation", relation: ids.map(id => ({ id })) });
  const title = value => ({ type: "title", title: [{ plain_text: value }] });
  const ids = { other: "28888888-2888-4888-8888-288888888888", wrongOwner: "39999999-3999-4999-8999-399999999999", wrongFamily: "4aaaaaaa-4aaa-4aaa-8aaa-4aaaaaaaaaaa", memo: "e5555555-e555-4555-8555-eeeeeeeeeeee" };
  const blocks = JSON.stringify([{ id: "body", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Historical content remains readable." }] } }]);
  const save = (id, source, name, properties, edited = "2026-09-30T10:00:00Z") => data.sqlite.prepare("INSERT INTO notion_documents VALUES(?,?,?,?,?,?,?,?,?)").run(id, source, name, `https://notion.so/${id}`, edited, JSON.stringify(properties), blocks, "Historical content remains readable.", "2026-09-30T10:00:00Z");
  save(ids.other, "companies", "Other Systems", { Company: title("Other Systems") });
  save(ids.wrongOwner, "analyses", "Other Business Analysis", { Company: relation(ids.other), Agent: rich("Business Analyst"), Status: rich("Validated") });
  save(ids.wrongFamily, "analyses", "Unmapped Note", { Company: relation(data.ids.company), Agent: rich("Unmapped Agent"), Status: rich("Validated") });
  save(ids.memo, "analyses", "Example Investment Memo", { Company: relation(data.ids.company), Agent: rich("Investment Memo"), Status: rich("Validated") });
  data.sqlite.prepare("INSERT INTO notion_document_companies VALUES(?,?,?,?)").run(ids.wrongOwner, ids.other, "notion-relation", "2026-09-30T10:00:00Z");
  data.sqlite.prepare("INSERT INTO notion_document_companies VALUES(?,?,?,?)").run(ids.wrongFamily, data.ids.company, "notion-relation", "2026-09-30T10:00:00Z");
  data.sqlite.prepare("INSERT INTO notion_document_companies VALUES(?,?,?,?)").run(ids.memo, data.ids.company, "notion-relation", "2026-09-30T10:00:00Z");
  const adapter = createInvestmentReadAdapter(data.db);
  const properties = JSON.parse(data.sqlite.prepare("SELECT properties_json FROM notion_documents WHERE page_id=?").get(data.ids.company).properties_json);
  const runWithPointer = async (key, id, family = "business") => {
    const changed = { ...properties, [key]: relation(id) };
    data.sqlite.prepare("UPDATE notion_documents SET properties_json=? WHERE page_id=?").run(JSON.stringify(changed), data.ids.company);
    return adapter.getCurrentAnalysis(data.ids.company, family);
  };

  const wrongOwner = await runWithPointer("Current Business Analysis", ids.wrongOwner);
  assert.equal(wrongOwner.status, "error");
  assert.ok(wrongOwner.metadata.diagnostics.some(item => item.code === "current_company_mismatch"));
  const wrongFamily = await runWithPointer("Current Business Analysis", ids.wrongFamily);
  assert.equal(wrongFamily.status, "error");
  assert.ok(wrongFamily.metadata.diagnostics.some(item => item.code === "current_family_mismatch"));
  const archived = await runWithPointer("Current Business Analysis", data.ids.archive);
  assert.equal(archived.status, "error");
  assert.ok(archived.metadata.diagnostics.some(item => item.code === "current_document_archived"));

  data.clearReads();
  const missing = await runWithPointer("Current Business Analysis", "5bbbbbbb-5bbb-4bbb-8bbb-5bbbbbbbbbbb");
  assert.equal(missing.status, "error");
  assert.ok(missing.metadata.diagnostics.some(item => item.code === "current_document_missing"));
  assert.deepEqual([...data.reads.bodyIds], [], "missing explicit target must not hydrate a fallback body");

  const missingMemoPointer = { ...properties };
  delete missingMemoPointer["Current Investment Memo"];
  data.sqlite.prepare("UPDATE notion_documents SET properties_json=? WHERE page_id=?").run(JSON.stringify(missingMemoPointer), data.ids.company);
  const absentMemo = await adapter.getCurrentAnalysis(data.ids.company, "cio_memo");
  assert.equal(absentMemo.status, "ok");
  assert.equal(absentMemo.data, null);
  assert.ok(absentMemo.metadata.diagnostics.some(item => item.code === "memo_current_reference_missing"));

  data.clearReads();
  const historical = await adapter.getAnalysisById(data.ids.archive);
  assert.ok(historical);
  assert.equal(historical.archived, true);
  assert.equal(data.reads.bodyIds.has(data.ids.archive), true, "an archived analysis stays readable by ID outside Current selection");
  data.sqlite.close();
});

test("integrity listing retains historical body metadata and date/projection state", async () => {
  const [{ createInvestmentReadAdapter }, legacy] = await Promise.all([
    apis().then(result => result.adapter), apis().then(result => result.legacy),
  ]);
  const data = await fixture();
  const adapter = createInvestmentReadAdapter(data.db);
  const oldDocuments = await legacy.listResearchDocuments(data.db, true);
  const bridgeDocuments = await adapter.listAnalysesForIntegrity();
  assert.deepEqual(bridgeDocuments, oldDocuments);
  const archived = bridgeDocuments.find(document => document.id === data.ids.archive);
  const current = bridgeDocuments.find(document => document.id === data.ids.current);
  assert.equal(archived.archived, true);
  assert.equal(archived.date, "2025-09-29");
  assert.equal(current.date, "2026-09-29");
  assert.equal(archived.normalizedAnalysis.analysis.header.revision, "2025-10-01T10:00:00Z");
  assert.equal(archived.normalizedAnalysis.analysis.header.provenance.sourceId, data.ids.archive);
  assert.equal(data.reads.bodyIds.has(data.ids.archive), true, "integrity explicitly asks for normalized analysis bodies");
  data.sqlite.close();
});

test("explicit Company relations own primary links; title fallback and secondary links remain intact", async () => {
  const [{ rebuildDocumentCompanyLinks, rebuildNotionRelations, documentCompanyLinks, documentPrimaryCompanyLinks }, { readCurrentAnalysisContext }, { selectCurrentAnalysis }] = await Promise.all([
    apis().then(result => result.sync), apis().then(result => result.legacy), apis().then(result => result.selection),
  ]);
  const data = await fixture();
  const ids = {
    optoelectronics: "18888888-1888-4888-8888-188888888888",
    materials: "29999999-2999-4999-8999-299999999999",
    fallback: "3aaaaaaa-3aaa-4aaa-8aaa-3aaaaaaaaaaa",
    explicit: "4bbbbbbb-4bbb-4bbb-8bbb-4bbbbbbbbbbb",
    joint: "5ccccccc-5ccc-4ccc-8ccc-5ccccccccccc",
    titleOnly: "6ddddddd-6ddd-4ddd-8ddd-6dddddddddd6",
    contentOnly: "7eeeeeee-7eee-4eee-8eee-7eeeeeeeeeee",
  };
  const title = value => ({ type: "title", title: [{ plain_text: value }] });
  const relation = (...pageIds) => ({ type: "relation", relation: pageIds.map(id => ({ id })) });
  const select = value => ({ type: "select", select: { name: value } });
  const save = (id, source, name, properties, plainText = "") => data.sqlite.prepare("INSERT INTO notion_documents VALUES(?,?,?,?,?,?,?,?,?)")
    .run(id, source, name, `https://notion.so/${id}`, "2026-09-30T10:00:00Z", JSON.stringify(properties), "[]", plainText, "2026-09-30T10:00:00Z");

  save(ids.optoelectronics, "companies", "Applied Optoelectronics", { Company: title("Applied Optoelectronics"), Ticker: { type: "rich_text", rich_text: [{ plain_text: "AAOI" }] } });
  save(ids.materials, "companies", "Applied Materials", { Company: title("Applied Materials"), Ticker: { type: "rich_text", rich_text: [{ plain_text: "AMAT" }] } });
  save(ids.fallback, "companies", "Fallback Systems", { Company: title("Fallback Systems"), Ticker: { type: "rich_text", rich_text: [{ plain_text: "FBS" }] } });
  // The explicit owner is unique; the shared first token "Applied" must not
  // promote the neighboring company to primary ownership through a title edge.
  save(ids.explicit, "analyses", "Applied Optoelectronics Business Analysis", { Company: relation(ids.optoelectronics), Agent: select("Business Analyst"), Status: select("Validated") });
  // Multiple owners remain valid when both are explicitly present in Notion.
  save(ids.joint, "analyses", "Joint Valuation Analysis", { Company: relation(ids.optoelectronics, ids.materials), Agent: select("Valuation Analyst"), Status: select("Validated") });
  // Title inference remains a primary fallback where Company is absent.
  save(ids.titleOnly, "analyses", "Fallback Systems Business Analysis", { Agent: select("Business Analyst"), Status: select("Validated") });
  // Body matches remain in the complete secondary index but never become owners.
  save(ids.contentOnly, "analyses", "Quarterly Sector Update", { Agent: select("Valuation Analyst"), Status: select("Validated") }, "Fallback Systems valuation notes.");

  await rebuildDocumentCompanyLinks(data.db);
  await rebuildNotionRelations(data.db);
  const canonical = value => value.replaceAll("-", "").toLowerCase();
  const secondary = await documentCompanyLinks(data.db);
  const primary = await documentPrimaryCompanyLinks(data.db);
  assert.deepEqual(primary.get(canonical(ids.explicit)), [canonical(ids.optoelectronics)]);
  assert.deepEqual(secondary.get(canonical(ids.explicit)).sort(), [canonical(ids.materials), canonical(ids.optoelectronics)].sort(), "the secondary index keeps the inferred title edge");
  assert.deepEqual(primary.get(canonical(ids.joint)).sort(), [canonical(ids.materials), canonical(ids.optoelectronics)].sort(), "all explicit Company relations remain primary owners");
  assert.deepEqual(primary.get(canonical(ids.titleOnly)), [canonical(ids.fallback)], "title ownership still works when no Company relation exists");
  assert.deepEqual(secondary.get(canonical(ids.contentOnly)), [canonical(ids.fallback)], "content-only match remains available in the secondary index");
  assert.equal(primary.has(canonical(ids.contentOnly)), false, "content-only match is excluded from primary ownership");
  assert.equal(data.sqlite.prepare("SELECT COUNT(*) AS count FROM notion_relations WHERE source_page_id=? AND property_name='Company'").get(ids.joint).count, 2, "the real Notion relation graph retains explicit multi-owner edges");

  const materialsBusiness = await readCurrentAnalysisContext(data.db, ids.materials, "business");
  const materialsBusinessSelection = selectCurrentAnalysis(materialsBusiness);
  assert.equal(materialsBusinessSelection.status, "absent", "a title-only false positive must not select the AOLO report for Applied Materials");
  const materialsValuation = await readCurrentAnalysisContext(data.db, ids.materials, "valuation");
  const materialsValuationSelection = selectCurrentAnalysis(materialsValuation);
  assert.equal(materialsValuationSelection.status, "selected", "an explicitly shared analysis stays selectable by both companies");
  assert.deepEqual(materialsValuationSelection.analysis.companyIds.sort(), [canonical(ids.materials), canonical(ids.optoelectronics)].sort());
  const fallbackValuation = await readCurrentAnalysisContext(data.db, ids.fallback, "valuation");
  assert.equal(selectCurrentAnalysis(fallbackValuation).status, "absent", "a content-only edge never makes a document selectable as owned research");
  data.sqlite.close();
});

test("MCP service accepts Notion IDs as dashed UUID, upper case or page URL (no mapping error)", async () => {
  const { createInvestmentService } = (await apis()).adapter;
  const data = await fixture();
  const service = createInvestmentService(data.db);
  const compact = data.ids.company.replaceAll("-", "").toLowerCase();
  const dashed = `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
  for (const id of [compact, dashed, dashed.toUpperCase(), `https://www.notion.so/Example-Systems-${compact}?pvs=4`]) {
    const company = await service.getCompany(id);
    assert.equal(company.status, "ok", id); assert.equal(company.data?.id, compact, id);
    assert.equal((await service.getCurrentAnalysis(id, "business")).status, "ok", `current ${id}`);
  }
  data.sqlite.close();
});

test("portfolio quotes: unmapped position takes the Yahoo symbol of its linked Company, mapped ones are unchanged", async () => {
  const { positionQuoteId } = (await apis()).legacy;
  const row = (name, companyIds = []) => ({ page_id: `row-${name}`, title: name, notion_url: "", properties_json: JSON.stringify({ Position: { type: "title", title: [{ plain_text: name }] }, Company: { type: "relation", relation: companyIds.map(id => ({ id })) } }) });
  const companies = [
    { id: "c-asml", name: "ASML Holding", ticker: "ASML", exchange: "Euronext Amsterdam" },
    { id: "c-unknown", name: "Mystery Corp", ticker: "MYST", exchange: "" },
  ];
  assert.equal(positionQuoteId(row("NVIDIA"), companies, new Map()), "nvda", "legacy mapping kept");
  assert.equal(positionQuoteId(row("ASML Holding NV", ["c-asml"]), companies, new Map()), "ASML.AS", "relation → ticker + exchange");
  assert.equal(positionQuoteId(row("ASML Holding NV"), companies, new Map([["row-ASML Holding NV", ["c-asml"]]])), "ASML.AS", "indexed company link");
  assert.equal(positionQuoteId(row("Mystery", ["c-unknown"]), companies, new Map()), undefined, "unknown exchange: no guessed quote");
  assert.equal(positionQuoteId(row("Orphan line"), companies, new Map()), undefined, "no linked company: no quote (manual price still applies)");
});
