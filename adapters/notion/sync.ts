import { humanReadableNotionBlocks, verifyPresentationProjection } from "../../app/lib/presentation-projection";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11";

export const notionSources = {
  companies: "3b337ea7-af35-802b-97bf-000bb8d741de",
  analyses: "84b60cc9-5546-4a05-b37f-0982114f3777",
  earnings: "0accd120-da19-418c-af6f-e617c1b89f55",
  portfolio: "c330cffb-8dbe-4051-92bf-1928eaa6312a",
  etf_exposures: "a74b9e99-1587-44cb-974c-a010e93c7e34",
  watchlist: "64c8f9d7-5e72-42b1-ba18-c941703e0814",
  decisions: "afa74a08-1d90-4e34-bf56-01a6cd859d88",
  sources: "103006cf-2cb5-4fc9-8a9e-ad79c24ee79d",
} as const;

export type NotionSourceKey = keyof typeof notionSources;
export const notionSyncSources = Object.keys(notionSources) as NotionSourceKey[];
type JsonRecord = Record<string, unknown>;

async function ensureSyncStateColumns(db: D1Database) {
  const columns = (await db.prepare("PRAGMA table_info(notion_sync_state)").all<{ name:string }>()).results ?? [];
  const names = new Set(columns.map(column => column.name));
  if (!names.has("next_cursor")) await db.prepare("ALTER TABLE notion_sync_state ADD COLUMN next_cursor TEXT").run();
  if (!names.has("last_scanned_at")) await db.prepare("ALTER TABLE notion_sync_state ADD COLUMN last_scanned_at TEXT").run();
}


/** A short-lived D1 lock prevents a launch refresh and a manual refresh from
 * importing the same Notion pages concurrently. The lock is intentionally
 * runtime-created so existing snapshots upgrade without a migration step. */
async function ensureSyncLockTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS notion_sync_lock (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    owner TEXT NOT NULL,
    locked_until TEXT NOT NULL
  )`).run();
}

export async function acquireNotionSyncLock(db: D1Database, ttlMs = 180000) {
  await ensureSyncLockTable(db);
  const owner = crypto.randomUUID();
  const now = new Date().toISOString();
  const lockedUntil = new Date(Date.now() + ttlMs).toISOString();
  const result = await db.prepare(`INSERT INTO notion_sync_lock (id, owner, locked_until)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, locked_until=excluded.locked_until
    WHERE notion_sync_lock.locked_until <= ?`).bind(owner, lockedUntil, now).run();
  return { acquired: Number(result.meta?.changes ?? 0) > 0, owner };
}

export async function releaseNotionSyncLock(db: D1Database, owner: string) {
  await ensureSyncLockTable(db);
  await db.prepare("DELETE FROM notion_sync_lock WHERE id=1 AND owner=?").bind(owner).run();
}

/**
 * A lock per Notion source keeps two tabs from importing the same database at
 * once without letting a slow Analyses import block the operational Portfolio
 * source. The previous single global lock could survive a cancelled Worker
 * and reject every later refresh for fifteen minutes.
 */
async function ensureSourceSyncLockTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS notion_source_sync_lock (
    source_key TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    locked_until TEXT NOT NULL
  )`).run();
}

export async function acquireNotionSourceSyncLock(db: D1Database, sourceKey: NotionSourceKey, ttlMs = 90_000) {
  await ensureSourceSyncLockTable(db);
  const owner = crypto.randomUUID();
  const now = new Date().toISOString();
  const lockedUntil = new Date(Date.now() + ttlMs).toISOString();
  const result = await db.prepare(`INSERT INTO notion_source_sync_lock (source_key, owner, locked_until)
    VALUES (?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET owner=excluded.owner, locked_until=excluded.locked_until
    WHERE notion_source_sync_lock.locked_until <= ?`).bind(sourceKey, owner, lockedUntil, now).run();
  return { acquired: Number(result.meta?.changes ?? 0) > 0, owner };
}

export async function releaseNotionSourceSyncLock(db: D1Database, sourceKey: NotionSourceKey, owner: string) {
  await ensureSourceSyncLockTable(db);
  await db.prepare("DELETE FROM notion_source_sync_lock WHERE source_key=? AND owner=?").bind(sourceKey, owner).run();
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function plainRichText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map(item => {
    const rich = asRecord(item);
    return typeof rich.plain_text === "string" ? rich.plain_text : "";
  }).join("");
}

function scalarText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(scalarText).filter(Boolean).join(", ");
  const item = asRecord(value);
  if (typeof item.name === "string") return item.name;
  if (typeof item.plain_text === "string") return item.plain_text;
  if (typeof item.start === "string") return item.start;
  if (typeof item.date === "string") return item.date;
  if (typeof item.value === "string" || typeof item.value === "number") return String(item.value);
  return "";
}

function propertyText(property: unknown): string {
  const item = asRecord(property);
  const type = typeof item.type === "string" ? item.type : "";
  const value = item[type];
  if (type === "title" || type === "rich_text") return plainRichText(value);
  if (type === "select" || type === "status") return scalarText(value);
  if (type === "multi_select" && Array.isArray(value)) return value.map(scalarText).filter(Boolean).join(", ");
  if (type === "number" || type === "checkbox" || type === "email" || type === "phone_number" || type === "url") return scalarText(value);
  if (type === "date") return scalarText(value);
  // Relations are stored in the dedicated graph. Raw page IDs are not
  // readable content and must never leak into full-text snapshots.
  if (type === "relation") return "";
  if (type === "formula") {
    const formula = asRecord(value);
    const formulaType = typeof formula.type === "string" ? formula.type : "";
    return scalarText(formula[formulaType]);
  }
  if (type === "rollup") {
    const rollup = asRecord(value);
    const result = rollup[typeof rollup.type === "string" ? rollup.type : ""];
    return scalarText(result);
  }
  return "";
}

function snapshotPropertyContent(properties: JsonRecord): string[] {
  return Object.entries(properties).flatMap(([name, value]) => {
    const text = propertyText(value).trim();
    return text ? [`${name}: ${text}`] : [];
  });
}

/**
 * The Notion connection is deliberately read-only.  These relations are an
 * app-side index so that a newly imported page can still be attached to the
 * right company when a relation property is empty, renamed, or unavailable
 * in a filtered Notion view.
 */
export async function ensureCompanyLinkTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS notion_document_companies (
    document_page_id TEXT NOT NULL,
    company_page_id TEXT NOT NULL,
    match_method TEXT NOT NULL,
    matched_at TEXT NOT NULL,
    PRIMARY KEY(document_page_id, company_page_id)
  )`).run();
  // Migrate the first-generation one-company-per-document index in place.
  // This keeps existing snapshots and upgrades them without requiring a full re-import.
  const columns = (await db.prepare("PRAGMA table_info(notion_document_companies)").all<{ name:string; pk:number }>()).results ?? [];
  const documentIsSolePrimaryKey = columns.some(column => column.name === "document_page_id" && column.pk === 1)
    && !columns.some(column => column.name === "company_page_id" && column.pk === 2);
  if (documentIsSolePrimaryKey) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS notion_document_companies_v2 (
      document_page_id TEXT NOT NULL,
      company_page_id TEXT NOT NULL,
      match_method TEXT NOT NULL,
      matched_at TEXT NOT NULL,
      PRIMARY KEY(document_page_id, company_page_id)
    )`).run();
    await db.prepare(`INSERT OR IGNORE INTO notion_document_companies_v2
      (document_page_id, company_page_id, match_method, matched_at)
      SELECT document_page_id, company_page_id, match_method, matched_at
      FROM notion_document_companies`).run();
    await db.prepare("DROP TABLE notion_document_companies").run();
    await db.prepare("ALTER TABLE notion_document_companies_v2 RENAME TO notion_document_companies").run();
  }
  await db.prepare(`CREATE INDEX IF NOT EXISTS notion_document_companies_company_idx
    ON notion_document_companies(company_page_id)`).run();
}

export async function ensureRelationTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS notion_relations (
    source_page_id TEXT NOT NULL,
    source_key TEXT NOT NULL,
    property_name TEXT NOT NULL,
    target_page_id TEXT NOT NULL,
    target_source_key TEXT,
    matched_at TEXT NOT NULL,
    PRIMARY KEY(source_page_id, property_name, target_page_id)
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS notion_relations_target_idx
    ON notion_relations(target_page_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS notion_relations_property_idx
    ON notion_relations(property_name)`).run();
}

function normalizedMatch(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Stable key for a Notion page. The API has historically returned UUIDs both
 * with and without dashes (and relation values can also arrive as notion.so
 * URLs). Never use the display title as an identity: this compact UUID is the
 * canonical join key for every local relation/index.
 */
export function normalizeNotionPageId(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(/(?:^|\/)([0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(?:[/?#]|$)/i)?.[1];
  const candidate = fromUrl ?? raw;
  const compact = candidate.replaceAll("-", "").toLowerCase();
  return /^[0-9a-f]{32}$/.test(compact) ? compact : raw;
}

function allRelationIds(properties: JsonRecord): string[] {
  return [...new Set(Object.values(properties).flatMap(property => {
    const item = asRecord(property);
    if (item.type !== "relation" || !Array.isArray(item.relation)) return [];
    return item.relation.map(relation => normalizeNotionPageId(String(asRecord(relation).id ?? ""))).filter(Boolean);
  }))];
}

function stringProperty(properties: JsonRecord, names: string[]): string {
  for (const name of names) {
    const value = propertyText(properties[name]);
    if (value && !value.includes("-")) return value.trim();
  }
  return "";
}

function companyAliases(title: string, properties: JsonRecord): string[] {
  const raw = [title, stringProperty(properties, ["Company", "Société", "Name", "Nom"]), stringProperty(properties, ["Ticker", "Symbol"])]
    .map(value => normalizedMatch(value)).filter(Boolean);
  const generic = new Set(["group", "holdings", "holding", "inc", "corp", "corporation", "company", "co", "ltd", "limited", "plc", "sa", "class", "a", "adr"]);
  const aliases = new Set<string>();
  for (const value of raw) {
    aliases.add(value);
    const base = value.split(" ").filter(token => !generic.has(token)).join(" ").trim();
    if (base) aliases.add(base);
    if (base.includes(" ")) aliases.add(base.split(" ")[0]);
  }
  return [...aliases].filter(value => value.length >= 3);
}

function matchCompanies(documentTitle: string, plainText: string, companyRows: { page_id: string; title: string; properties_json: string }[]): { id: string; method: string }[] {
  const title = normalizedMatch(documentTitle);
  const content = normalizedMatch(`${documentTitle} ${plainText.slice(0, 9000)}`);
  const matches: { id: string; method: string; score: number }[] = [];
  for (const row of companyRows) {
    let properties: JsonRecord = {};
    try { properties = asRecord(JSON.parse(row.properties_json)); } catch { /* malformed snapshots remain unlinked */ }
    for (const alias of companyAliases(row.title, properties)) {
      const phrase = ` ${alias} `;
      const inTitle = ` ${title} `.includes(phrase);
      const inContent = ` ${content} `.includes(phrase);
      if (!inTitle && !inContent) continue;
      const score = inTitle ? alias.length + 100 : alias.length + 10;
      matches.push({ id: row.page_id, method: inTitle ? "title" : "content", score });
    }
  }
  const bestByCompany = new Map<string, { id: string; method: string; score: number }>();
  for (const match of matches) {
    const current = bestByCompany.get(match.id);
    if (!current || match.score > current.score) bestByCompany.set(match.id, match);
  }
  return [...bestByCompany.values()].sort((a, b) => b.score - a.score).map(({ id, method }) => ({ id, method }));
}

export async function rebuildDocumentCompanyLinks(db: D1Database) {
  await ensureCompanyLinkTable(db);
  const companies = (await db.prepare("SELECT page_id,title,properties_json FROM notion_documents WHERE source_key='companies'").all<{page_id:string;title:string;properties_json:string}>()).results ?? [];
  if (!companies.length) return { linked: 0, unlinked: 0 };
  const companyIds = new Set(companies.map(company => normalizeNotionPageId(company.page_id)));
  const companyIdByCanonical = new Map(companies.map(company => [normalizeNotionPageId(company.page_id), company.page_id]));
  const documents = (await db.prepare("SELECT page_id,title,plain_text,properties_json FROM notion_documents WHERE source_key IN ('analyses','earnings','decisions','portfolio','watchlist')").all<{page_id:string;title:string;plain_text:string;properties_json:string}>()).results ?? [];
  const now = new Date().toISOString();
  let linked = 0;
  const matchedDocumentIds = new Set<string>();
  const statements: D1PreparedStatement[] = [];
  // Rebuild deterministically: a changed relation must remove its old company
  // edge, not just add the new one. This is what keeps many-to-many links sane.
  await db.prepare("DELETE FROM notion_document_companies").run();
  for (const document of documents) {
    let properties: JsonRecord = {};
    try { properties = asRecord(JSON.parse(document.properties_json)); } catch { /* handled by fallback */ }
    const explicitIds = [...new Set(allRelationIds(properties).filter(id => companyIds.has(id)))].map(id => companyIdByCanonical.get(id) ?? id);
    const inferred = matchCompanies(document.title, document.plain_text, companies)
      .filter(match => !explicitIds.includes(match.id));
    const matches = [
      ...explicitIds.map(id => ({ id, method: "notion-relation" })),
      ...inferred,
    ];
    if (!matches.length) continue;
    matchedDocumentIds.add(document.page_id);
    for (const match of matches) {
      statements.push(db.prepare(`INSERT INTO notion_document_companies (document_page_id, company_page_id, match_method, matched_at)
        VALUES (?, ?, ?, ?) ON CONFLICT(document_page_id, company_page_id) DO UPDATE SET
        match_method=excluded.match_method, matched_at=excluded.matched_at`).bind(document.page_id, match.id, match.method, now));
      linked += 1;
    }
  }
  await runBatches(db, statements);
  return { linked, unlinked: documents.length - matchedDocumentIds.size };
}

export async function documentCompanyLinks(db: D1Database): Promise<Map<string, string[]>> {
  await ensureCompanyLinkTable(db);
  const rows = (await db.prepare("SELECT document_page_id,company_page_id FROM notion_document_companies").all<{document_page_id:string;company_page_id:string}>()).results ?? [];
  const links = new Map<string, string[]>();
  for (const row of rows) {
    const documentId = normalizeNotionPageId(row.document_page_id);
    const companyId = normalizeNotionPageId(row.company_page_id);
    const current = links.get(documentId) ?? [];
    if (!current.includes(companyId)) current.push(companyId);
    links.set(documentId, current);
  }
  return links;
}

/** Primary ownership edges: explicit Notion relations, with title matches as fallback. */
export async function documentPrimaryCompanyLinks(db: D1Database): Promise<Map<string, string[]>> {
  await ensureCompanyLinkTable(db);
  const rows = (await db.prepare("SELECT document_page_id,company_page_id,match_method FROM notion_document_companies WHERE match_method IN ('notion-relation','title')").all<{document_page_id:string;company_page_id:string;match_method:string}>()).results ?? [];
  const explicitByDocument = new Set(rows.filter(row => row.match_method === "notion-relation").map(row => normalizeNotionPageId(row.document_page_id)));
  const links = new Map<string, string[]>();
  for (const row of rows) {
    const documentId = normalizeNotionPageId(row.document_page_id);
    // A valid Notion Company relation is authoritative. Title edges remain a
    // fallback for documents without one; secondary title/content edges stay
    // available through documentCompanyLinks.
    if (row.match_method === "title" && explicitByDocument.has(documentId)) continue;
    const companyId = normalizeNotionPageId(row.company_page_id);
    const current = links.get(documentId) ?? [];
    if (!current.includes(companyId)) current.push(companyId);
    links.set(documentId, current);
  }
  return links;
}

/** Rebuilds the complete page-to-page relation index from imported Notion properties. */
export async function rebuildNotionRelations(db: D1Database) {
  await ensureRelationTable(db);
  const documents = (await db.prepare("SELECT page_id,source_key,properties_json FROM notion_documents").all<{page_id:string;source_key:string;properties_json:string}>()).results ?? [];
  const sourceKeys = new Map(documents.map(document => [normalizeNotionPageId(document.page_id), document.source_key]));
  const rawIds = new Map(documents.map(document => [normalizeNotionPageId(document.page_id), document.page_id]));
  const now = new Date().toISOString();
  await db.prepare("DELETE FROM notion_relations").run();
  const statements: D1PreparedStatement[] = [];
  for (const document of documents) {
    let properties: JsonRecord = {};
    try { properties = asRecord(JSON.parse(document.properties_json)); } catch { continue; }
    for (const [propertyName, property] of Object.entries(properties)) {
      const item = asRecord(property);
      if (item.type !== "relation" || !Array.isArray(item.relation)) continue;
      const targetIds = [...new Set(item.relation.map(relation => normalizeNotionPageId(String(asRecord(relation).id ?? ""))).filter(Boolean))];
      for (const targetId of targetIds) {
        const targetPageId = rawIds.get(targetId) ?? targetId;
        statements.push(db.prepare(`INSERT OR IGNORE INTO notion_relations
          (source_page_id, source_key, property_name, target_page_id, target_source_key, matched_at)
          VALUES (?, ?, ?, ?, ?, ?)`).bind(document.page_id, document.source_key, propertyName, targetPageId, sourceKeys.get(targetId) ?? null, now));
      }
    }
  }
  await runBatches(db, statements);
  return { documents: documents.length };
}

function pageTitle(page: JsonRecord): string {
  const properties = asRecord(page.properties);
  for (const property of Object.values(properties)) {
    if (asRecord(property).type === "title") return propertyText(property) || "Sans titre";
  }
  return "Sans titre";
}

function blockText(block: JsonRecord): string {
  const type = typeof block.type === "string" ? block.type : "";
  const body = asRecord(block[type]);
  if (type === "table_row" && Array.isArray(body.cells)) return body.cells.map(plainRichText).join(" | ");
  if (type === "child_page" || type === "child_database") return String(body.title ?? "");
  if (type === "bookmark" || type === "embed" || type === "link_preview") return String(body.url ?? "");
  if (type === "image" || type === "video" || type === "file" || type === "pdf" || type === "audio") {
    return plainRichText(body.caption);
  }
  return plainRichText(body.rich_text);
}

async function notionRequest(token: string, path: string, init?: RequestInit, attempt = 0): Promise<JsonRecord> {
  const response = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    const delay = Math.max(retryAfter * 1000, 500 * 2 ** attempt);
    await new Promise(resolve => setTimeout(resolve, delay));
    return notionRequest(token, path, init, attempt + 1);
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : `Erreur Notion ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function queryDataSource(token: string, dataSourceId: string, startCursor?: string, pageSize = 100): Promise<JsonRecord> {
  return notionRequest(token, `/data_sources/${dataSourceId}/query`, {
    method: "POST",
    body: JSON.stringify({
      page_size: Math.min(Math.max(pageSize, 1), 100),
      // Notion's default order is not a reliable change feed.  Always put the
      // most recently edited pages first so a refresh sees a new analysis
      // before walking older, unchanged pages.
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      ...(startCursor ? { start_cursor: startCursor } : {}),
    }),
  });
}

// The Notion "Active Positions" view is the portfolio source of truth. The
// REST API exposes the data source rather than the UI view, so the app mirrors
// the view's exact predicate in investment-data.ts (Status = Active) while
// importing the complete source here to also observe positions that became
// inactive (sold/closed) and remove them from the live portfolio projection.
const PORTFOLIO_SOURCE = "portfolio";
const ETF_EXPOSURES_SOURCE = "etf_exposures";

async function listBlockChildren(token: string, blockId: string, startCursor?: string): Promise<JsonRecord> {
  const query = new URLSearchParams({ page_size: "100" });
  if (startCursor) query.set("start_cursor", startCursor);
  return notionRequest(token, `/blocks/${blockId}/children?${query.toString()}`);
}

function flattenBlockText(blocks: JsonRecord[]): string[] {
  const output: string[] = [];
  for (const block of humanReadableNotionBlocks(blocks).map(asRecord)) {
    const text = blockText(block).trim();
    if (text) output.push(text);
    if (Array.isArray(block.children)) output.push(...flattenBlockText(block.children.map(asRecord)));
  }
  return output;
}

export function snapshotPlainText(title: string, propertiesJson: string, blocksJson: string, fallback = "") {
  let properties: JsonRecord = {};
  let blocks: JsonRecord[] = [];
  try { properties = asRecord(JSON.parse(propertiesJson)); } catch { /* use fallback */ }
  try { const parsed = JSON.parse(blocksJson); blocks = Array.isArray(parsed) ? parsed.map(asRecord) : []; } catch { /* use fallback */ }
  const rebuilt = [title, ...snapshotPropertyContent(properties), ...flattenBlockText(blocks)].filter(Boolean).join("\n");
  if (rebuilt.length > title.length + 1) return rebuilt;
  return fallback
    .replace(/\{\s*"type"\s*:\s*"(?:array|relation|rollup|formula)"[\s\S]*?\}/gi, "")
    .replace(/rollupResult:\/\/[^\s]+/gi, "")
    .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function documentUpsertStatement(db: D1Database, sourceKey: NotionSourceKey, page: JsonRecord, blocks: JsonRecord[]) {
  const pageId = String(page.id ?? "");
  const title = pageTitle(page);
  const properties = asRecord(page.properties);
  const propertyContent = snapshotPropertyContent(properties);
  const plainText = [title, ...propertyContent, ...flattenBlockText(blocks)].join("\n");
  return db.prepare(`INSERT INTO notion_documents
    (page_id, source_key, title, notion_url, last_edited_time, properties_json, blocks_json, plain_text, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(page_id) DO UPDATE SET
      source_key=excluded.source_key, title=excluded.title, notion_url=excluded.notion_url,
      last_edited_time=excluded.last_edited_time, properties_json=excluded.properties_json,
      blocks_json=excluded.blocks_json, plain_text=excluded.plain_text, synced_at=excluded.synced_at
    WHERE excluded.last_edited_time>=notion_documents.last_edited_time`)
    .bind(
      pageId,
      sourceKey,
      title,
      String(page.url ?? ""),
      String(page.last_edited_time ?? ""),
      JSON.stringify(properties),
      JSON.stringify(blocks),
      plainText,
      new Date().toISOString(),
    );
}

type ImportTask = { parentId:string; path:number[]; cursor?:string; depth:number };
type StoredImportJob = {
  page_id:string;
  source_key:NotionSourceKey;
  page_json:string;
  blocks_json:string;
  work_json:string;
  attempts:number;
};

function importJobStatement(db:D1Database,sourceKey:NotionSourceKey,page:JsonRecord){
  const pageId=String(page.id??"");
  const edited=String(page.last_edited_time??"");
  const now=new Date().toISOString();
  const initialWork:ImportTask[]=[{parentId:pageId,path:[],depth:0}];
  return db.prepare(`INSERT INTO notion_import_jobs
    (page_id,source_key,last_edited_time,page_json,blocks_json,work_json,status,attempts,next_attempt_at,lease_owner,lease_until,last_error,created_at,updated_at)
    VALUES (?,?,?,?,? ,?,'pending',0,NULL,NULL,NULL,NULL,?,?)
    ON CONFLICT(page_id) DO UPDATE SET
      source_key=excluded.source_key,last_edited_time=excluded.last_edited_time,page_json=excluded.page_json,
      blocks_json='[]',work_json=excluded.work_json,status='pending',attempts=0,next_attempt_at=NULL,
      lease_owner=NULL,lease_until=NULL,last_error=NULL,updated_at=excluded.updated_at
    WHERE excluded.last_edited_time>notion_import_jobs.last_edited_time OR notion_import_jobs.status='failed'`)
    .bind(pageId,sourceKey,edited,JSON.stringify(page),"[]",JSON.stringify(initialWork),now,now);
}

type NotionWebhookEvent = {
  id?: string;
  timestamp?: string;
  type?: string;
  entity?: { id?: string; type?: string };
};

type StoredWebhookEvent = {
  event_id:string;
  event_type:string;
  entity_id:string;
  entity_type:string;
  payload_json:string;
  attempts:number;
};

function sourceKeyFromPage(page:JsonRecord):NotionSourceKey|null{
  const parent=asRecord(page.parent);
  const parentId=normalizeNotionPageId(String(parent.data_source_id??parent.database_id??""));
  if(!parentId)return null;
  return notionSyncSources.find(sourceKey=>normalizeNotionPageId(notionSources[sourceKey])===parentId)??null;
}

export async function configureNotionWebhook(db:D1Database,verificationToken:string){
  const token=verificationToken.trim();
  if(!token)throw new Error("Jeton de vérification webhook manquant");
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO notion_webhook_config (id,verification_token,configured_at,updated_at)
    VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET
      verification_token=excluded.verification_token,
      configured_at=excluded.configured_at,
      updated_at=excluded.updated_at`)
    .bind(token,now,now).run();
  return {configured:true};
}

export async function notionWebhookVerificationToken(db:D1Database){
  const row=await db.prepare("SELECT verification_token FROM notion_webhook_config WHERE id=1").first<{verification_token:string}>();
  return row?.verification_token??null;
}

export async function recordNotionWebhookEvent(db:D1Database,payload:NotionWebhookEvent,rawBody:string){
  const eventId=String(payload.id??"").trim();
  const eventType=String(payload.type??"").trim();
  const entityId=String(payload.entity?.id??"").trim();
  const entityType=String(payload.entity?.type??"").trim();
  if(!eventId||!eventType||!entityId||!entityType)throw new Error("Événement webhook Notion incomplet");
  const now=new Date().toISOString();
  const result=await db.prepare(`INSERT INTO notion_webhook_events
    (event_id,event_type,entity_id,entity_type,event_timestamp,payload_json,status,attempts,next_attempt_at,lease_owner,lease_until,last_error,received_at,processed_at,updated_at)
    VALUES (?,?,?,?,?,?,'pending',0,NULL,NULL,NULL,NULL,?,NULL,?) ON CONFLICT(event_id) DO NOTHING`)
    .bind(eventId,eventType,entityId,entityType,String(payload.timestamp??now),rawBody,now,now).run();
  return {accepted:Number(result.meta?.changes??0)>0,eventId};
}

async function webhookQueueSummary(db:D1Database){
  const pending=await db.prepare("SELECT COUNT(*) AS count FROM notion_webhook_events WHERE status IN ('pending','processing','retry')").first<{count:number}>();
  const failed=await db.prepare("SELECT COUNT(*) AS count FROM notion_webhook_events WHERE status='failed'").first<{count:number}>();
  const configured=await db.prepare("SELECT COUNT(*) AS count FROM notion_webhook_config WHERE id=1").first<{count:number}>();
  return {configured:Number(configured?.count??0)>0,pending:Number(pending?.count??0),failed:Number(failed?.count??0)};
}

async function claimWebhookEvent(db:D1Database):Promise<(StoredWebhookEvent&{leaseOwner:string})|null>{
  const now=new Date().toISOString();
  const candidate=await db.prepare(`SELECT event_id,event_type,entity_id,entity_type,payload_json,attempts
    FROM notion_webhook_events
    WHERE ((status IN ('pending','retry') AND (next_attempt_at IS NULL OR next_attempt_at<=?))
      OR (status='processing' AND lease_until<=?))
    ORDER BY event_timestamp,event_id LIMIT 1`).bind(now,now).first<StoredWebhookEvent>();
  if(!candidate)return null;
  const leaseOwner=crypto.randomUUID();
  const leaseUntil=new Date(Date.now()+45_000).toISOString();
  const claimed=await db.prepare(`UPDATE notion_webhook_events SET status='processing',lease_owner=?,lease_until=?,updated_at=?
    WHERE event_id=? AND ((status IN ('pending','retry') AND (next_attempt_at IS NULL OR next_attempt_at<=?))
      OR (status='processing' AND lease_until<=?))`).bind(leaseOwner,leaseUntil,now,candidate.event_id,now,now).run();
  return Number(claimed.meta?.changes??0)>0?{...candidate,leaseOwner}:null;
}

async function removeWebhookPage(db:D1Database,pageId:string){
  await ensureRelationTable(db);
  await ensureCompanyLinkTable(db);
  const canonical=normalizeNotionPageId(pageId);
  await db.batch([
    db.prepare("DELETE FROM notion_documents WHERE LOWER(REPLACE(page_id,'-',''))=?").bind(canonical),
    db.prepare("DELETE FROM notion_import_jobs WHERE LOWER(REPLACE(page_id,'-',''))=?").bind(canonical),
    db.prepare("DELETE FROM notion_relations WHERE LOWER(REPLACE(source_page_id,'-',''))=? OR LOWER(REPLACE(target_page_id,'-',''))=?").bind(canonical,canonical),
    db.prepare("DELETE FROM notion_document_companies WHERE LOWER(REPLACE(document_page_id,'-',''))=? OR LOWER(REPLACE(company_page_id,'-',''))=?").bind(canonical,canonical),
  ]);
  return {queued:false,removed:true};
}

async function enqueueWebhookPage(db:D1Database,token:string,pageId:string,eventType:string){
  if(eventType==="page.deleted")return removeWebhookPage(db,pageId);
  const page=await notionRequest(token,`/pages/${encodeURIComponent(pageId)}`);
  const sourceKey=sourceKeyFromPage(page);
  if(!sourceKey)return removeWebhookPage(db,pageId);
  const stored=await db.prepare("SELECT last_edited_time FROM notion_documents WHERE LOWER(REPLACE(page_id,'-',''))=?")
    .bind(normalizeNotionPageId(String(page.id??pageId))).first<{last_edited_time:string}>();
  const edited=String(page.last_edited_time??"");
  const removed=page.archived===true||page.in_trash===true;
  if(removed)return {...await removeWebhookPage(db,String(page.id??pageId)),sourceKey};
  if(sourceKey===PORTFOLIO_SOURCE){
    await documentUpsertStatement(db,sourceKey,page,[]).run();
    return {queued:false,updated:true,sourceKey};
  }
  if(stored?.last_edited_time===edited)return {queued:false,unchanged:true,sourceKey};
  await db.batch([
    importJobStatement(db,sourceKey,page),
    db.prepare(`INSERT INTO notion_sync_state (source_key,data_source_id,last_status,last_started_at,last_scanned_at)
      VALUES (?,?,'pending',NULL,NULL)
      ON CONFLICT(source_key) DO UPDATE SET last_status='pending',last_error=NULL`)
      .bind(sourceKey,notionSources[sourceKey]),
  ]);
  return {queued:true,sourceKey};
}

/** Converts one durable webhook signal into the same idempotent import job as
 * metadata discovery. The signal remains retryable until this handoff succeeds. */
export async function processNextNotionWebhookEvent(db:D1Database,token:string){
  const event=await claimWebhookEvent(db);
  if(!event)return {processed:false,...await webhookQueueSummary(db)};
  try{
    const isRelevantPage=event.entity_type==="page"&&event.event_type.startsWith("page.");
    const isRelevantSource=event.entity_type==="data_source"&&event.event_type.startsWith("data_source.");
    const sourceKey=isRelevantSource
      ?notionSyncSources.find(key=>normalizeNotionPageId(notionSources[key])===normalizeNotionPageId(event.entity_id))??null
      :null;
    const result=isRelevantPage
      ?await enqueueWebhookPage(db,token,event.entity_id,event.event_type)
      :sourceKey
        ?await syncNotionSource(db,token,sourceKey,100,false)
        :{queued:false,ignored:true};
    const now=new Date().toISOString();
    await db.prepare(`UPDATE notion_webhook_events SET status='processed',processed_at=?,lease_owner=NULL,lease_until=NULL,last_error=NULL,updated_at=?
      WHERE event_id=? AND lease_owner=?`).bind(now,now,event.event_id,event.leaseOwner).run();
    return {processed:true,eventId:event.event_id,...result,...await webhookQueueSummary(db)};
  }catch(error){
    const attempts=Number(event.attempts??0)+1;
    const failed=attempts>=8;
    const message=error instanceof Error?error.message:"Traitement webhook Notion interrompu";
    const nextAttemptAt=failed?null:new Date(Date.now()+Math.min(300_000,1000*2**attempts)).toISOString();
    await db.prepare(`UPDATE notion_webhook_events SET status=?,attempts=?,next_attempt_at=?,lease_owner=NULL,lease_until=NULL,last_error=?,updated_at=?
      WHERE event_id=? AND lease_owner=?`).bind(failed?"failed":"retry",attempts,nextAttemptAt,message,new Date().toISOString(),event.event_id,event.leaseOwner).run();
    return {processed:true,retry:!failed,error:message,eventId:event.event_id,...await webhookQueueSummary(db)};
  }
}

async function runBatches(db:D1Database,statements:D1PreparedStatement[]){
  for(let index=0;index<statements.length;index+=50)await db.batch(statements.slice(index,index+50));
}

function parseJsonArray<T>(value:string):T[]{
  try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed as T[]:[];}catch{return[];}
}

function targetBlockList(root:JsonRecord[],path:number[]):JsonRecord[]{
  let list=root;
  for(const index of path){
    const block=list[index];
    if(!block)throw new Error("Progression d'import Notion invalide");
    if(!Array.isArray(block.children))block.children=[];
    list=block.children as JsonRecord[];
  }
  return list;
}

async function importQueueSummary(db:D1Database){
  const active=await db.prepare("SELECT COUNT(*) AS count FROM notion_import_jobs WHERE status IN ('pending','processing','retry')").first<{count:number}>();
  const failed=await db.prepare("SELECT COUNT(*) AS count FROM notion_import_jobs WHERE status='failed'").first<{count:number}>();
  const finalization=await db.prepare("SELECT COUNT(*) AS count FROM notion_sync_state WHERE last_status='imported'").first<{count:number}>();
  return {remaining:Number(active?.count??0),failed:Number(failed?.count??0),needsFinalize:Number(finalization?.count??0)>0};
}

async function claimImportJob(db:D1Database):Promise<(StoredImportJob&{leaseOwner:string})|null>{
  const now=new Date().toISOString();
  const candidate=await db.prepare(`SELECT page_id,source_key,page_json,blocks_json,work_json,attempts
    FROM notion_import_jobs
    WHERE ((status IN ('pending','retry') AND (next_attempt_at IS NULL OR next_attempt_at<=?))
      OR (status='processing' AND lease_until<=?))
    ORDER BY CASE source_key WHEN 'companies' THEN 0 WHEN 'earnings' THEN 1 WHEN 'analyses' THEN 2 ELSE 3 END, updated_at
    LIMIT 1`).bind(now,now).first<StoredImportJob>();
  if(!candidate)return null;
  const leaseOwner=crypto.randomUUID();
  const leaseUntil=new Date(Date.now()+60_000).toISOString();
  const claimed=await db.prepare(`UPDATE notion_import_jobs SET status='processing',lease_owner=?,lease_until=?,updated_at=?
    WHERE page_id=? AND ((status IN ('pending','retry') AND (next_attempt_at IS NULL OR next_attempt_at<=?))
      OR (status='processing' AND lease_until<=?))`).bind(leaseOwner,leaseUntil,now,candidate.page_id,now,now).run();
  return Number(claimed.meta?.changes??0)>0?{...candidate,leaseOwner}:null;
}

/** Downloads only a bounded number of Notion block pages. Progress is saved
 * after every API response, so a timeout or closed app resumes the same page. */
export async function processNextNotionImport(db:D1Database,token:string,maximumRequests=4){
  const job=await claimImportJob(db);
  if(!job)return {processed:false,completed:false,...await importQueueSummary(db)};
  const blocks=parseJsonArray<JsonRecord>(job.blocks_json).map(asRecord);
  let work=parseJsonArray<ImportTask>(job.work_json);
  if(!work.length)work=[{parentId:job.page_id,path:[],depth:0}];
  try{
    let requests=0;
    while(work.length&&requests<Math.min(Math.max(maximumRequests,1),6)){
      const task=work.shift()!;
      const result=await listBlockChildren(token,task.parentId,task.cursor);
      const children=(Array.isArray(result.results)?result.results:[]).map(asRecord);
      const target=targetBlockList(blocks,task.path);
      const offset=target.length;
      target.push(...children);
      const continuation=result.has_more===true&&typeof result.next_cursor==="string"
        ? [{...task,cursor:result.next_cursor}]
        : [];
      if(task.depth>=12&&children.some(block=>block.has_children===true)){
        throw new Error("La page Notion dépasse la profondeur maximale d’import; le snapshot complet précédent est conservé.");
      }
      const descendants=task.depth>=12?[]:children.flatMap((block,index)=>block.has_children===true&&typeof block.id==="string"
        ? [{parentId:block.id,path:[...task.path,offset+index],depth:task.depth+1}]
        : []);
      work.unshift(...continuation,...descendants);
      requests+=1;
      await db.prepare(`UPDATE notion_import_jobs SET blocks_json=?,work_json=?,updated_at=?,lease_until=?
        WHERE page_id=? AND lease_owner=?`).bind(JSON.stringify(blocks),JSON.stringify(work),new Date().toISOString(),new Date(Date.now()+60_000).toISOString(),job.page_id,job.leaseOwner).run();
    }
    if(work.length){
      await db.prepare("UPDATE notion_import_jobs SET status='pending',lease_owner=NULL,lease_until=NULL,updated_at=? WHERE page_id=? AND lease_owner=?")
        .bind(new Date().toISOString(),job.page_id,job.leaseOwner).run();
      return {processed:true,completed:false,pageId:job.page_id,...await importQueueSummary(db)};
    }
    const page=asRecord(JSON.parse(job.page_json));
    const pageId=String(page.id??job.page_id);
    const canonicalPageId=normalizeNotionPageId(pageId);
    const presentation=["analyses","earnings","decisions"].includes(job.source_key)
      ? await verifyPresentationProjection(blocks)
      : { status:"absent" as const, projection:null, error:null };
    await db.batch([
      db.prepare("DELETE FROM notion_documents WHERE source_key=? AND LOWER(REPLACE(page_id,'-',''))=? AND page_id<>?").bind(job.source_key,canonicalPageId,pageId),
      documentUpsertStatement(db,job.source_key,page,blocks),
      db.prepare("DELETE FROM notion_import_jobs WHERE page_id=? AND lease_owner=?").bind(job.page_id,job.leaseOwner),
    ]);
    const sourcePending=await db.prepare("SELECT COUNT(*) AS count FROM notion_import_jobs WHERE source_key=? AND status IN ('pending','processing','retry')").bind(job.source_key).first<{count:number}>();
    const sourceFailed=await db.prepare("SELECT COUNT(*) AS count FROM notion_import_jobs WHERE source_key=? AND status='failed'").bind(job.source_key).first<{count:number}>();
    if(Number(sourcePending?.count??0)===0&&Number(sourceFailed?.count??0)===0){
      await db.prepare("UPDATE notion_sync_state SET last_status='imported',last_error=NULL WHERE source_key=?").bind(job.source_key).run();
    }
    return {processed:true,completed:true,pageId:job.page_id,presentationStatus:presentation.status,presentationError:presentation.error,...await importQueueSummary(db)};
  }catch(error){
    const attempts=Number(job.attempts??0)+1;
    const failed=attempts>=5;
    const message=error instanceof Error?error.message:"Import Notion interrompu";
    const nextAttemptAt=failed?null:new Date(Date.now()+Math.min(60_000,1000*2**attempts)).toISOString();
    await db.prepare(`UPDATE notion_import_jobs SET status=?,attempts=?,next_attempt_at=?,lease_owner=NULL,lease_until=NULL,last_error=?,updated_at=?
      WHERE page_id=? AND lease_owner=?`).bind(failed?"failed":"retry",attempts,nextAttemptAt,message,new Date().toISOString(),job.page_id,job.leaseOwner).run();
    if(failed)await db.prepare("UPDATE notion_sync_state SET last_status='error',last_error=? WHERE source_key=?").bind(message,job.source_key).run();
    return {processed:true,completed:false,pageId:job.page_id,retry:!failed,error:message,...await importQueueSummary(db)};
  }
}

export async function finalizeNotionImports(db:D1Database){
  const completedAt=new Date().toISOString();
  await db.prepare(`UPDATE notion_sync_state SET last_status='success',last_completed_at=?,last_error=NULL
    WHERE last_status='imported'`).bind(completedAt).run();
  return {completedAt};
}

/** Rebuilds legacy snapshots without downloading anything from Notion. */
export async function normalizeStoredDocumentText(db: D1Database) {
  const rows = (await db.prepare("SELECT page_id,title,properties_json,blocks_json,plain_text FROM notion_documents").all<{page_id:string;title:string;properties_json:string;blocks_json:string;plain_text:string}>()).results ?? [];
  let updated = 0;
  const statements: D1PreparedStatement[] = [];
  for (const row of rows) {
    const legacy = row.plain_text ?? "";
    const next = snapshotPlainText(row.title, row.properties_json, row.blocks_json, legacy);
    if (next && next !== legacy) {
      statements.push(db.prepare("UPDATE notion_documents SET plain_text=? WHERE page_id=?").bind(next, row.page_id));
      updated += 1;
    }
  }
  await runBatches(db, statements);
  return { scanned: rows.length, updated };
}

export async function syncNotionSource(db:D1Database,token:string,sourceKey:NotionSourceKey,maximumChangedPages=100,forceRefresh=false){
  void maximumChangedPages;
  void forceRefresh;
  await ensureSyncStateColumns(db);
  const dataSourceId=notionSources[sourceKey];
  const startedAt=new Date().toISOString();
  await db.prepare(`INSERT INTO notion_sync_state (source_key,data_source_id,last_status,last_started_at,last_scanned_at)
    VALUES (?,?,'discovering',?,NULL)
    ON CONFLICT(source_key) DO UPDATE SET data_source_id=excluded.data_source_id,last_status='discovering',last_started_at=excluded.last_started_at,last_error=NULL`)
    .bind(sourceKey,dataSourceId,startedAt).run();
  try{
    // Portfolio is a compact structured table. Writing each row separately
    // caused 40+ D1 round-trips (lookup + upsert) and exceeded the Worker
    // lifetime on mobile refreshes. Read the source once and commit the
    // authoritative snapshot as one D1 batch instead.
    if (sourceKey === PORTFOLIO_SOURCE || sourceKey === ETF_EXPOSURES_SOURCE) {
      const syncCompactSource = async (compactSource:NotionSourceKey) => {
        const compactDataSourceId=notionSources[compactSource];
        const result = compactSource === sourceKey
          ? await queryDataSource(token, dataSourceId, undefined, 100)
          : await queryDataSource(token, compactDataSourceId, undefined, 100);
        const pages = (Array.isArray(result.results) ? result.results.map(asRecord) : [])
          .filter(page => typeof page.id === "string" && page.id.length > 0);
        if (result.has_more === true) throw new Error(`La base ${compactSource === PORTFOLIO_SOURCE ? "Portfolio" : "ETF Country Exposure"} dépasse 100 lignes; pagination requise.`);

        const storedRows = (await db.prepare("SELECT page_id FROM notion_documents WHERE source_key=?")
          .bind(compactSource).all<{page_id:string}>()).results ?? [];
        const currentByNormalizedId = new Map(pages.map(page => [normalizeNotionPageId(String(page.id)), String(page.id)]));
        const statements = compactSource === sourceKey
          ? pages.map(page => documentUpsertStatement(db, sourceKey, page, []))
          : pages.map(page => documentUpsertStatement(db, compactSource, page, []));
        let removed = 0;
        for (const row of storedRows) {
          const canonicalPageId = currentByNormalizedId.get(normalizeNotionPageId(row.page_id));
          if (canonicalPageId === row.page_id) continue;
          statements.push(db.prepare("DELETE FROM notion_documents WHERE page_id=? AND source_key=?").bind(row.page_id, compactSource));
          if (!canonicalPageId) removed += 1;
        }
        if (statements.length) await db.batch(statements);

        const completedAt = new Date().toISOString();
        const countRow = await db.prepare("SELECT COUNT(*) AS count FROM notion_documents WHERE source_key=?")
          .bind(compactSource).first<{count:number}>();
        await db.prepare(`UPDATE notion_sync_state SET last_status='success', last_completed_at=?, last_scanned_at=?, last_error=NULL, document_count=?, next_cursor=NULL WHERE source_key=?`)
          .bind(completedAt,completedAt,Number(countRow?.count ?? 0),compactSource).run();
        return { sourceKey:compactSource, scanned:pages.length, refreshed:pages.length, removed, stored:Number(countRow?.count ?? 0), hasMore:false, completedAt };
      };
      const result=await syncCompactSource(sourceKey);
      // Portfolio and ETF exposures are both small structured snapshots. A
      // single sync keeps the dashboard data coherent without adding a second
      // background round-trip or a new loading dependency in the app.
      // Keep the portfolio condition explicit because it is the authoritative
      // trigger for refreshing the dependent ETF exposure snapshot.
      if (sourceKey === PORTFOLIO_SOURCE) {
        await syncCompactSource(ETF_EXPOSURES_SOURCE);
      }
      return result;
    }

    // At the current scale a complete metadata scan costs only a few Notion
    // requests and cannot miss a page after an outage. Content remains cached:
    // only a missing or newly edited page is queued for block download.
    const storedRows=(await db.prepare("SELECT page_id,last_edited_time FROM notion_documents WHERE source_key=?").bind(sourceKey).all<{page_id:string;last_edited_time:string}>()).results??[];
    const queuedRows=(await db.prepare("SELECT page_id FROM notion_import_jobs WHERE source_key=?").bind(sourceKey).all<{page_id:string}>()).results??[];
    const storedById=new Map(storedRows.map(row=>[normalizeNotionPageId(row.page_id),row]));
    const seenPageIds=new Set<string>();
    const statements:D1PreparedStatement[]=[];
    let cursor:string|undefined;
    let scanned=0;
    let queued=0;
    do{
      const result=await queryDataSource(token,dataSourceId,cursor,100);
      const pages=(Array.isArray(result.results)?result.results:[]).map(asRecord);
      for(const page of pages){
        const pageId=String(page.id??"");
        if(!pageId)continue;
        const canonical=normalizeNotionPageId(pageId);
        seenPageIds.add(canonical);
        scanned+=1;
        const existing=storedById.get(canonical);
        if(!existing||forceRefresh||existing.last_edited_time!==String(page.last_edited_time??"")){
          statements.push(importJobStatement(db,sourceKey,page));
          queued+=1;
        }
      }
      cursor=result.has_more===true&&typeof result.next_cursor==="string"?result.next_cursor:undefined;
    }while(cursor);
    await runBatches(db,statements);
    let removed=0;
    for(const row of storedRows){
      if(seenPageIds.has(normalizeNotionPageId(row.page_id)))continue;
      await db.batch([
        db.prepare("DELETE FROM notion_documents WHERE page_id=? AND source_key=?").bind(row.page_id,sourceKey),
        db.prepare("DELETE FROM notion_import_jobs WHERE page_id=? AND source_key=?").bind(row.page_id,sourceKey),
      ]);
      removed+=1;
    }
    for(const row of queuedRows){
      if(seenPageIds.has(normalizeNotionPageId(row.page_id)))continue;
      await db.prepare("DELETE FROM notion_import_jobs WHERE page_id=? AND source_key=?").bind(row.page_id,sourceKey).run();
    }
    const pending=await db.prepare("SELECT COUNT(*) AS count FROM notion_import_jobs WHERE source_key=? AND status IN ('pending','processing','retry')").bind(sourceKey).first<{count:number}>();
    const failed=await db.prepare("SELECT COUNT(*) AS count FROM notion_import_jobs WHERE source_key=? AND status='failed'").bind(sourceKey).first<{count:number}>();
    const stored=await db.prepare("SELECT COUNT(*) AS count FROM notion_documents WHERE source_key=?").bind(sourceKey).first<{count:number}>();
    const completedAt=new Date().toISOString();
    const status=Number(failed?.count??0)>0?"error":Number(pending?.count??0)>0?"pending":"success";
    await db.prepare(`UPDATE notion_sync_state SET last_status=?,last_completed_at=?,last_scanned_at=?,last_error=NULL,document_count=?,next_cursor=NULL WHERE source_key=?`)
      .bind(status,completedAt,completedAt,Number(stored?.count??0),sourceKey).run();
    return {sourceKey,scanned,refreshed:queued,queued,removed,stored:Number(stored?.count??0),hasMore:false,completedAt};
  }catch(error){
    const message=error instanceof Error?error.message:"Erreur de synchronisation inconnue";
    await db.prepare("UPDATE notion_sync_state SET last_status='error',last_error=? WHERE source_key=?").bind(message,sourceKey).run();
    throw error;
  }
}

/** One short, resumable request for every Notion database. */
export async function syncNotionAllSources(db: D1Database, token: string, maximumChangedPages = 8, forceRefresh = false) {
  const results = [];
  for (const sourceKey of notionSyncSources) {
    // ETF Country Exposure is refreshed together with Portfolio above. Keep
    // the key registered for webhook routing/status, but do not query the
    // same compact data source twice during an all-sources refresh.
    if(sourceKey===ETF_EXPOSURES_SOURCE) continue;
    // A portfolio contains only a few dozen rows, so refresh the whole source
    // in one launch. Other databases keep the short resumable budget because
    // their block trees can be much larger.
    const sourceBudget = sourceKey === PORTFOLIO_SOURCE ? Math.max(maximumChangedPages, 100) : maximumChangedPages;
    results.push(await syncNotionSource(db, token, sourceKey, sourceBudget, forceRefresh));
  }
  const total = await db.prepare("SELECT COUNT(*) AS count FROM notion_documents").first<{count:number}>();
  const queue=await importQueueSummary(db);
  return {
    sources: results,
    refreshed: results.reduce((sum, result) => sum + result.refreshed, 0),
    scanned: results.reduce((sum, result) => sum + result.scanned, 0),
    stored: Number(total?.count ?? 0),
    hasMore: results.some(result => result.hasMore),
    queue,
  };
}

export async function notionStatus(db: D1Database, configured: boolean) {
  const rows = await db.prepare("SELECT * FROM notion_sync_state ORDER BY source_key").all();
  const total = await db.prepare("SELECT COUNT(*) AS count, MAX(synced_at) AS latest FROM notion_documents").first<{count:number;latest:string|null}>();
  const states=(rows.results??[]) as {source_key?:string;last_scanned_at?:string|null}[];
  const metadataTtlMs=60*60*1000;
  const metadataCacheFresh=notionSyncSources.every(sourceKey=>{
    const lastScanned=states.find(state=>state.source_key===sourceKey)?.last_scanned_at;
    const timestamp=lastScanned?Date.parse(lastScanned):NaN;
    return Number.isFinite(timestamp)&&Date.now()-timestamp<metadataTtlMs;
  });
  return { configured, metadataCacheFresh, metadataTtlMs, totalDocuments: Number(total?.count ?? 0), latestSync: total?.latest ?? null, queue:await importQueueSummary(db), webhook:await webhookQueueSummary(db), sources: states };
}
