import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./fixtures/notion-write-harness.mjs";

const rich = value => [{ type: "text", text: { content: value }, plain_text: value }];
const select = name => ({ type: "select", select: { name } });
const companySchema = { object: "data_source", properties: {
  Company: { type: "title", title: {} }, Ticker: { type: "rich_text", rich_text: {} }, ISIN: { type: "rich_text", rich_text: {} },
  Exchange: { type: "select", select: { options: [{ name: "Euronext Paris" }, { name: "NASDAQ" }] } },
  Currency: { type: "select", select: { options: [{ name: "EUR" }, { name: "USD" }, { name: "Other" }] } },
  Country: { type: "select", select: { options: [{ name: "France" }, { name: "Other" }] } },
  Status: { type: "select", select: { options: [{ name: "Owned" }, { name: "Watchlist" }] } },
  "Research Stage": { type: "select", select: { options: [{ name: "Unscreened" }] } },
} };
/** Minimal Notion: Companies schema, OR-filtered query on title/rich_text equals, page create and read. */
function fakeNotion(source, existing = []) {
  const pages = new Map(existing.map(p => [p.id, p])); const calls = [];
  const text = (p, name) => (p.properties[name]?.title ?? p.properties[name]?.rich_text ?? []).map(r => r.plain_text).join("");
  const fetch = async (url, init = {}) => {
    const path = new URL(url).pathname.replace("/v1", ""), body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method ?? "GET", path, body });
    const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
    if (path === `/data_sources/${source}` && (init.method ?? "GET") === "GET") return json(companySchema);
    if (path === `/data_sources/${source}/query`) {
      const hit = p => body.filter.or.some(f => { const v = text(p, f.property); const rule = f.title ?? f.rich_text; return rule.equals !== undefined ? v === rule.equals : v.startsWith(rule.starts_with); });
      return json({ results: [...pages.values()].filter(p => !p.archived && hit(p)), has_more: false });
    }
    if (path === "/pages" && init.method === "POST") {
      const id = `44444444-4444-4444-8444-${String(pages.size + 1).padStart(12, "4")}`;
      const properties = Object.fromEntries(Object.entries(body.properties).map(([k, v]) => [k, v.title ? { type: "title", title: v.title.map(r => ({ ...r, plain_text: r.text.content })) } : v.rich_text ? { type: "rich_text", rich_text: v.rich_text.map(r => ({ ...r, plain_text: r.text.content })) } : { type: "select", ...v }]));
      const page = { object: "page", id, parent: body.parent, last_edited_time: "2026-10-06T15:00:00.000Z", archived: false, in_trash: false, properties };
      pages.set(id, page); return json(page);
    }
    if (path.startsWith("/pages/")) { const page = [...pages.values()].find(p => p.id.replaceAll("-", "") === path.split("/")[2].replaceAll("-", "")); return page ? json(page) : json({ object: "error", code: "object_not_found" }, 404); }
    return json({ object: "error", code: "invalid_request_url" }, 400);
  };
  return { fetch, calls, pages };
}
const hermes = { name: "Hermès International", ticker: "RMS.PA", exchange: "Euronext Paris", isin: "FR0000052292", currency: "EUR", country: "France" };

test("create_company adapter: live Notion duplicate (not yet in the D1 cache) is returned as existing, nothing written", async () => {
  const data = await fixture();
  const source = data.sources.companies;
  const notion = fakeNotion(source, [{ object: "page", id: "55555555-5555-4555-8555-555555555555", parent: { data_source_id: source }, archived: false, properties: { Company: { type: "title", title: rich("Hermes") }, Ticker: { type: "rich_text", rich_text: rich("RMS.PA") }, ISIN: { type: "rich_text", rich_text: rich("FR0000052292") }, Exchange: select("Euronext Paris") } }]);
  const create = data.api.createNotionCompanyWriter(data.db, { token: "fixture-only", fetch: notion.fetch, sleep: async () => {} });
  const result = await create(hermes);
  assert.equal(result.status, "existing");
  assert.deepEqual(result.candidates.map(c => [c.companyId, c.isin, c.exchange]), [["55555555555545558555555555555555", "FR0000052292", "Euronext Paris"]]);
  assert.equal(notion.calls.filter(c => c.method === "POST" && c.path === "/pages").length, 0);
  // The live check searches ISIN, full ticker, base ticker and the exact name in one query.
  const query = notion.calls.find(c => c.path.endsWith("/query")).body.filter.or;
  assert.ok(query.some(f => f.property === "ISIN" && f.rich_text.equals === "FR0000052292"));
  assert.ok(query.some(f => f.property === "Ticker" && f.rich_text.equals === "RMS.PA"));
  assert.ok(query.some(f => f.property === "Ticker" && f.rich_text.starts_with === "RMS."));
  assert.ok(query.some(f => f.property === "Company" && f.title.equals === "Hermès International"));
  data.sql.close();
});

test("create_company adapter: one create, mapped to configured options, verified, then visible to resolve_company at once", async () => {
  const data = await fixture();
  const notion = fakeNotion(data.sources.companies);
  const options = { token: "fixture-only", fetch: notion.fetch, sleep: async () => {} };
  const create = data.api.createNotionCompanyWriter(data.db, options);
  const result = await create({ ...hermes, exchange: "Xetra", currency: "CHF", country: "Switzerland" });
  assert.equal(result.status, "created");
  const posts = notion.calls.filter(c => c.method === "POST" && c.path === "/pages");
  assert.equal(posts.length, 1, "exactly one provider mutation");
  const p = posts[0].body.properties;
  assert.equal(p.Company.title[0].text.content, "Hermès International");
  assert.equal(p.Ticker.rich_text[0].text.content, "RMS.PA");
  assert.equal(p.ISIN.rich_text[0].text.content, "FR0000052292");
  assert.equal("Exchange" in p, false, "unconfigured exchange is left empty, never invented");
  assert.deepEqual(p.Currency, { select: { name: "Other" } }, "unconfigured currency falls back to Other");
  assert.deepEqual(p.Country, { select: { name: "Other" } });
  assert.deepEqual(p.Status, { select: { name: "Watchlist" } });
  assert.deepEqual(p["Research Stage"], { select: { name: "Unscreened" } });
  const service = data.api.createInvestmentService(data.db);
  const resolved = await service.resolveCompany("FR0000052292");
  assert.equal(resolved.data.status, "resolved", "write-through: no sync needed");
  assert.equal(resolved.data.candidates[0].companyId, result.candidates[0].companyId);
  // A second call (e.g. a model retry after a timeout) finds the page and never creates twice.
  assert.equal((await create(hermes)).status, "existing");
  assert.equal(notion.calls.filter(c => c.method === "POST" && c.path === "/pages").length, 1);
  data.sql.close();
});

test("create_company adapter: refuses before any write when the Companies schema lacks identity properties", async () => {
  const data = await fixture();
  const notion = fakeNotion(data.sources.companies);
  delete companySchema.properties.ISIN;
  try {
    const create = data.api.createNotionCompanyWriter(data.db, { token: "fixture-only", fetch: notion.fetch, sleep: async () => {} });
    await assert.rejects(create(hermes), error => error.code === "mapping");
    assert.equal(notion.calls.filter(c => c.method === "POST" && c.path === "/pages").length, 0);
  } finally { companySchema.properties.ISIN = { type: "rich_text", rich_text: {} }; data.sql.close(); }
});
