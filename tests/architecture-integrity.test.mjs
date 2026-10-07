// Guards the Sites → GitHub export against mixed snapshots (incident of 2026-10-06:
// 18 runtime files exported in their v204 version over the Lot 12 tree).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const gitBlob = buffer => createHash("sha1").update(`blob ${buffer.byteLength}\0`).update(buffer).digest("hex");

test("compatibility shims stay one-line re-exports of the Notion adapter", async () => {
  for (const [shim, target] of [["app/lib/investment-data.ts", "../../adapters/notion/investment-data"], ["app/lib/notion-sync.ts", "../../adapters/notion/sync"]]) {
    const code = (await read(shim)).split("\n").filter(line => line.trim() && !line.trim().startsWith("/**") && !line.trim().startsWith("//"));
    assert.deepEqual(code, [`export * from "${target}";`], `${shim} must only re-export ${target}`);
  }
});

test("the Worker mounts the MCP endpoint with Sites authentication", async () => {
  const worker = await read("worker/index.ts");
  assert.match(worker, /import \{ createMcpHandler \} from "\.\.\/transports\/mcp\/server"/);
  assert.match(worker, /import \{ authenticateSitesMcp \} from "\.\.\/transports\/mcp\/sites-auth"/);
  assert.match(worker, /url\.pathname === "\/mcp"\) \{\s+const response = await mcpHandler\(env\)/);
  // No cron on Sites: a successful MCP call refreshes a stale Notion cache in the background.
  assert.match(worker, /launchNotionRefresh\(env, ctx\)/);
  // Forgetting the hosting policy would let any schema-valid WRITE reach the Core.
  assert.match(worker, /import \{ authorizeSitesWrite \} from "\.\.\/transports\/mcp\/site-write-policy"/);
  assert.match(worker, /authorizeWrite: authorizeSitesWrite,/);
});

test("RenderBlock keeps unsupported blocks and source identities", async () => {
  const parser = await read("app/lib/notion-block-parser.ts");
  const type = parser.slice(0, parser.indexOf("type JsonRecord"));
  assert.match(type, /id\?: string; sourceIds\?: string\[\]/);
  assert.match(type, /type: "unsupported"; sourceType: string; text: string/);
});

test("no runtime file is a known stale v204 snapshot", async () => {
  const stale = JSON.parse(await read("tests/fixtures/stale-export-blobs.json"));
  const regressed = [];
  for (const [path, blob] of Object.entries(stale)) {
    const current = gitBlob(await readFile(new URL(`../${path}`, import.meta.url)));
    if (current === blob) regressed.push(path);
  }
  assert.deepEqual(regressed, [], `stale v204 files exported: ${regressed.join(", ")}`);
});

test("every test file is run by npm test or npm run test:mcp (a forgotten file is never executed by Sol)", async () => {
  const { readdir } = await import("node:fs/promises");
  const scripts = JSON.parse(await read("package.json")).scripts;
  const listed = `${scripts.test} ${scripts["test:mcp"]}`;
  const files = (await readdir("tests")).filter(name => name.endsWith(".test.mjs"));
  assert.deepEqual(files.filter(name => !listed.includes(`tests/${name}`)), []);
});
