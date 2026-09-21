import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import { dynamicClassEntry, dynamicClassRegistry } from "./css-audit-registry.mjs";

const root = process.cwd();
const appRoot = path.join(root, "app");
const fix = process.argv.includes("--fix");
const cssFiles = ["globals.css", "ux-foundations.css"];
async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  }));
  return files.flat();
}

const sourceFiles = (await filesUnder(appRoot)).filter(file => /\.(?:tsx?|jsx?|json)$/.test(file));
const staticClasses = new Set();

const tokensFromText = value => value.match(/-?[_a-zA-Z][\w-]*/g) ?? [];
const addStaticClasses = value => {
  for (const token of tokensFromText(value)) staticClasses.add(token);
};

for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");

  for (const match of source.matchAll(/\bclassName\s*=\s*\{`([\s\S]*?)`/g)) addStaticClasses(match[1]);

  for (const match of source.matchAll(/\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]*?)\})/g)) {
    addStaticClasses(match[1] ?? match[2] ?? "");
    for (const literal of (match[3] ?? "").matchAll(/(["'`])([\s\S]*?)\1/g)) addStaticClasses(literal[2]);
  }

  for (const match of source.matchAll(/\bclassName\s*:\s*([\s\S]{0,220})/g)) {
    const expression = match[1].split(/\n\s*[A-Za-z_$][\w$]*\s*:/, 1)[0];
    for (const literal of expression.matchAll(/(["'`])([\s\S]*?)\1/g)) addStaticClasses(literal[2]);
  }
  for (const match of source.matchAll(/\bclassName\s*:\s*(["'`])([\s\S]*?)\1/g)) addStaticClasses(match[2]);

  for (const match of source.matchAll(/\bclassList\.(?:add|remove|toggle)\(([^)]*)\)/g)) {
    for (const literal of match[1].matchAll(/(["'`])([\s\S]*?)\1/g)) addStaticClasses(literal[2]);
  }
}

const isKnownClass = (className, selector) => staticClasses.has(className)
  || Boolean(dynamicClassEntry(className))
  || dynamicClassRegistry.some(entry => entry.selectorPattern && new RegExp(entry.selectorPattern).test(selector));

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
      return classNames.length === 0 || classNames.every(className => isKnownClass(className, selector));
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
