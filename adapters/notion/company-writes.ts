import type { CompanyCreation, CreateCompanyInput } from "../../core/services/ports";
import { companyDuplicates } from "../../core/services/investment-os";
import { createNotionClient, type NotionWriteOptions } from "./analysis-writes";
import { propertyName, propertyValue } from "./investment-data";
import { documentUpsertStatement, normalizeNotionPageId, notionSources } from "./sync";

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === "object" ? value as RecordValue : {};
const fault = (code: string) => Object.assign(new Error("Création Company interrompue."), { code });
const FENCE_MS = 10 * 60_000;
const rich = (content: string) => [{ type: "text", text: { content } }];
const optionNames = (definition: unknown) => (object(object(definition).select).options as unknown[] ?? []).map(option => String(object(option).name));
/** Case-insensitive match against the options configured in Notion; never creates a select option. */
const configured = (definition: unknown, value: string | null) => value === null ? undefined : optionNames(definition).find(name => name.toLowerCase() === value.trim().toLowerCase());

/**
 * Creates a minimal Company page. The live Notion query (not the D1 cache) is the last duplicate barrier:
 * a page created by hand, or by a timed-out earlier call, is returned as `existing` and nothing is written.
 */
export function createNotionCompanyWriter(db: D1Database, options: NotionWriteOptions) {
  const source = options.sources?.companies ?? notionSources.companies;
  const { read, mutate } = createNotionClient(options);
  const candidate = (page: RecordValue, schemaProperties: RecordValue, titleName: string) => {
    const properties = object(page.properties);
    return {
      companyId: normalizeNotionPageId(String(page.id)),
      canonicalName: String(propertyValue(properties, titleName) ?? ""),
      ticker: String(propertyValue(properties, "Ticker") ?? ""),
      exchange: propertyName(schemaProperties, ["Exchange"]) ? (propertyValue(properties, "Exchange") as string | null) ?? null : null,
      assetId: null,
      isin: String(propertyValue(properties, "ISIN") ?? "").trim() || null,
    };
  };
  return async function createCompany(input: CreateCompanyInput): Promise<CompanyCreation> {
    const schema = object((await read(`/data_sources/${source}`)).properties);
    const titleName = Object.keys(schema).find(name => object(schema[name]).type === "title");
    // Identity properties must exist with the expected types before any query or mutation.
    if (!titleName || object(schema.Ticker).type !== "rich_text" || object(schema.ISIN).type !== "rich_text") throw fault("mapping");
    // Idempotency fence keyed by ISIN: Notion's query index lags creation, and a lost response leaves the outcome unknown.
    await db.prepare("CREATE TABLE IF NOT EXISTS notion_company_creations (isin TEXT PRIMARY KEY, owner TEXT NOT NULL, page_id TEXT, started_at INTEGER NOT NULL)").run();
    const owner = crypto.randomUUID(), now = Date.now();
    await db.prepare("INSERT INTO notion_company_creations (isin, owner, page_id, started_at) VALUES (?, ?, NULL, ?) ON CONFLICT(isin) DO UPDATE SET owner = excluded.owner, started_at = excluded.started_at WHERE notion_company_creations.page_id IS NULL AND notion_company_creations.started_at < ?").bind(input.isin, owner, now, now - FENCE_MS).run();
    const fence = await db.prepare("SELECT owner, page_id FROM notion_company_creations WHERE isin = ?").bind(input.isin).first<{ owner: string; page_id: string | null }>();
    const release = () => db.prepare("DELETE FROM notion_company_creations WHERE isin = ? AND owner = ? AND page_id IS NULL").bind(input.isin, owner).run();
    if (fence?.page_id) {
      const known = object(await read(`/pages/${fence.page_id}`));
      if (!known.archived && !known.in_trash) return { status: "existing", candidates: [candidate(known, schema, titleName)] };
      await db.prepare("DELETE FROM notion_company_creations WHERE isin = ? AND page_id = ?").bind(input.isin, fence.page_id).run();
      throw fault("stale_request");
    }
    const base = input.ticker.replace(/\.[A-Z]{1,4}$/, "");
    const duplicates = await read(`/data_sources/${source}/query`, "POST", { page_size: 10, filter: { or: [
      { property: "ISIN", rich_text: { equals: input.isin } },
      { property: "Ticker", rich_text: { equals: input.ticker } },
      { property: "Ticker", rich_text: { equals: base } },
      { property: "Ticker", rich_text: { starts_with: `${base}.` } },
      { property: titleName, title: { equals: input.name } },
    ] } });
    const pages = (Array.isArray(duplicates.results) ? duplicates.results : []).map(object).filter(page => !page.archived && !page.in_trash);
    // The query is deliberately broad; the Core rule decides (same base ticker on another exchange is another company).
    const live = companyDuplicates(pages.map(page => ({ ...candidate(page, schema, titleName), aliases: [] })), input);
    if (live.length) { await release(); return { status: "existing", candidates: live.map(({ aliases: _aliases, ...known }) => ({ ...known, isin: known.isin ?? null })) }; }
    // Another call holds this ISIN with an unknown outcome and Notion does not show the page yet: refuse, never duplicate.
    if (fence?.owner !== owner) throw fault("rate_limit");
    const properties: RecordValue = { [titleName]: { title: rich(input.name) }, Ticker: { rich_text: rich(input.ticker) }, ISIN: { rich_text: rich(input.isin) } };
    const exchange = configured(schema.Exchange, input.exchange);
    if (exchange) properties.Exchange = { select: { name: exchange } };
    for (const [name, value] of [["Currency", input.currency], ["Country", input.country]] as const) {
      if (value === null || object(schema[name]).type !== "select") continue;
      const option = configured(schema[name], value) ?? configured(schema[name], "Other");
      if (option) properties[name] = { select: { name: option } };
    }
    for (const [name, value] of [["Status", "Watchlist"], ["Research Stage", "Unscreened"]] as const) {
      const option = configured(schema[name], value);
      if (option) properties[name] = { select: { name: option } };
    }
    let created: RecordValue;
    try { created = object(await mutate("/pages", "POST", { parent: { type: "data_source_id", data_source_id: source }, properties })); }
    catch (error) {
      // A definite refusal frees the fence; a network/timeout outcome is unknown and keeps it (FENCE_MS) to block a duplicate.
      if (!["network", "timeout"].includes(String(object(error).code))) await release();
      throw error;
    }
    const pageId = normalizeNotionPageId(String(created.id ?? ""));
    if (!/^[0-9a-f]{32}$/.test(pageId)) throw fault("storage");
    await db.prepare("UPDATE notion_company_creations SET page_id = ? WHERE isin = ? AND owner = ?").bind(pageId, input.isin, owner).run();
    // Read back what Notion stored and write it through to D1 first, so resolve_company sees it without a sync.
    const stored = object(await read(`/pages/${pageId}`));
    await db.batch([documentUpsertStatement(db, "companies", stored, [])]);
    const result = candidate(stored, schema, titleName);
    // The ISIN is the identity: anything else differing (trim, rich-text split) does not undo a successful creation.
    if (result.isin !== input.isin) throw fault("storage");
    return { status: "created", candidates: [result] };
  };
}
