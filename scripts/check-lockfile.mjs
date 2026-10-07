// Fails when a package.json dependency is missing from package-lock.json, the
// offline equivalent of `npm ci` refusing an out-of-sync lockfile.
import { readFile } from "node:fs/promises";
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const root = lock.packages?.[""] ?? {};
const missing = [];
for (const field of ["dependencies", "devDependencies"]) {
  for (const [name, range] of Object.entries(pkg[field] ?? {})) {
    if (!lock.packages?.[`node_modules/${name}`]) missing.push(`${name} (not installed in lockfile)`);
    else if (root[field]?.[name] !== range) missing.push(`${name} (${field} range ${range} vs lock ${root[field]?.[name] ?? "absent"})`);
  }
}
if (missing.length) { console.error(`package-lock.json out of sync:\n- ${missing.join("\n- ")}`); process.exit(1); }
console.log("package-lock.json in sync with package.json");
