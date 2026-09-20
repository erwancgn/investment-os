import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";

const root = process.cwd();
const appRoot = path.join(root, "app");
const fix = process.argv.includes("--fix");
const cssFiles = ["globals.css", "ux-foundations.css", "notion-sync-compact.css", "iphone-experience.css"];
const dynamicPrefixes = [
  "analysis-scenario-", "decision-", "reference-", "ui-progress-track--", "ui-surface--",
  "ui-badge--", "ui-discovery-card--",
];
const dynamicNames = new Set([
  "active", "analysis-key-fact--priority", "attractive", "available", "clickable", "error", "is-active",
  "integrity-warning", "live", "missing", "negative", "negative-pnl", "neutral", "ok", "positive",
  "positive-pnl", "notion-table-two-column", "snapshot", "starting", "running", "done", "warning",
]);

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  }));
  return files.flat();
}

const sourceFiles = (await filesUnder(appRoot)).filter(file => /\.(?:tsx?|jsx?|json)$/.test(file));
const source = (await Promise.all(sourceFiles.map(file => readFile(file, "utf8")))).join("\n");
const staticClasses = new Set();
const classNamePattern = /className\s*=\s*(?:\{\s*)?(["'`])([\s\S]*?)\1\s*\}?/g;
const objectClassNamePattern = /className\s*:\s*"([^"]*)"/g;
for (const match of source.matchAll(classNamePattern)) {
  const withoutExpressions = match[2].replace(/\$\{[\s\S]*?\}/g, " ");
  for (const token of withoutExpressions.match(/-?[_a-zA-Z]+[\w-]*/g) ?? []) staticClasses.add(token);
  for (const expression of match[2].matchAll(/\$\{([\s\S]*?)\}/g)) {
    for (const literal of expression[1].matchAll(/(["'])(.*?)\1/g)) {
      for (const token of literal[2].match(/-?[_a-zA-Z]+[\w-]*/g) ?? []) staticClasses.add(token);
    }
  }
}
for (const match of source.matchAll(objectClassNamePattern)) {
  for (const token of match[1].match(/-?[_a-zA-Z]+[\w-]*/g) ?? []) staticClasses.add(token);
}
for (const match of source.matchAll(/classList\.(?:add|remove|toggle)\(([^)]*)\)/g)) {
  for (const token of match[1].match(/-?[_a-zA-Z]+[\w-]*/g) ?? []) staticClasses.add(token);
}

const isKnownClass = className => staticClasses.has(className)
  || dynamicNames.has(className)
  || dynamicPrefixes.some(prefix => className.startsWith(prefix));

let removedSelectors = 0;
let removedRules = 0;
const examples = [];

for (const relativeFile of cssFiles) {
  const file = path.join(appRoot, relativeFile);
  const input = await readFile(file, "utf8");
  const ast = postcss.parse(input, { from: file });

  ast.walkRules(rule => {
    if (/:is\(|:not\(|:where\(|:has\(/.test(rule.selector)) return;
    const selectors = postcss.list.comma(rule.selector);
    const liveSelectors = selectors.filter(selector => {
      const classNames = [...selector.matchAll(/\.(-?[_a-zA-Z]+[\w-]*)/g)].map(match => match[1]);
      return classNames.length === 0 || classNames.every(isKnownClass);
    });
    removedSelectors += selectors.length - liveSelectors.length;
    if (liveSelectors.length === 0) {
      removedRules += 1;
      if (examples.length < 30) examples.push(`${relativeFile}: ${rule.selector}`);
      rule.remove();
    } else if (liveSelectors.length !== selectors.length) {
      if (examples.length < 30) examples.push(`${relativeFile}: ${selectors.filter(selector => !liveSelectors.includes(selector)).join(", ")}`);
      rule.selector = liveSelectors.join(",\n");
    }
  });

  ast.walkAtRules(rule => {
    if (rule.nodes && rule.nodes.length === 0) rule.remove();
  });

  if (fix) await writeFile(file, ast.toString());
}

console.log(JSON.stringify({ mode: fix ? "fix" : "audit", removedSelectors, removedRules, examples }, null, 2));
