import type { CompanyCreation, CreateCompanyInput } from "../../core/services/ports";
import { createNotionClient, type NotionWriteOptions } from "./analysis-writes";
import { propertyName, propertyValue } from "./investment-data";
import { documentUpsertStatement, normalizeNotionPageId, notionSources } from "./sync";

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === "object" ? value as RecordValue : {};
const fault = (code: string) => Object.assign(new Error("Création Company interrompue."), { code });
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
    const base = input.ticker.replace(/\.[A-Z]{1,4}$/, "");
    const duplicates = await read(`/data_sources/${source}/query`, "POST", { page_size: 10, filter: { or: [
      { property: "ISIN", rich_text: { equals: input.isin } },
      { property: "Ticker", rich_text: { equals: input.ticker } },
      { property: "Ticker", rich_text: { equals: base } },
      { property: "Ticker", rich_text: { starts_with: `${base}.` } },
      { property: titleName, title: { equals: input.name } },
    ] } });
    const live = (Array.isArray(duplicates.results) ? duplicates.results : []).map(object).filter(page => !page.archived && !page.in_trash);
    if (live.length) return { status: "existing", candidates: live.map(page => candidate(page, schema, titleName)) };
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
    const created = object(await mutate("/pages", "POST", { parent: { type: "data_source_id", data_source_id: source }, properties }));
    const pageId = normalizeNotionPageId(String(created.id ?? ""));
    if (!/^[0-9a-f]{32}$/.test(pageId)) throw fault("storage");
    // Read back what Notion stored, then write it through to D1 so resolve_company sees it without a sync.
    const stored = object(await read(`/pages/${pageId}`));
    const result = candidate(stored, schema, titleName);
    if (result.isin !== input.isin || result.ticker !== input.ticker || result.canonicalName !== input.name) throw fault("storage");
    await db.batch([documentUpsertStatement(db, "companies", stored, [])]);
    return { status: "created", candidates: [result] };
  };
}
