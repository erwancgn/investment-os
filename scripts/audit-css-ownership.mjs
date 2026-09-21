import { readFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";

const root = process.cwd();
const files = ["app/globals.css", "app/ux-foundations.css"];

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeAtRuleParams(value) {
  return normalize(value)
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*,\s*/g, ",")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")")
    .replace(/\s*(<=|>=|=|<|>)\s*/g, "$1");
}

function atRuleContext(node) {
  const parts = [];
  let parent = node.parent;
  while (parent) {
    if (parent.type === "atrule") {
      parts.unshift(`@${parent.name}${parent.params ? ` ${normalizeAtRuleParams(parent.params)}` : ""}`);
    }
    parent = parent.parent;
  }
  return parts.length ? parts.join(" > ") : "root";
}

function add(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

const selectorOccurrences = new Map();
const importantOccurrences = [];
const inventory = {};

for (const file of files) {
  const source = await readFile(path.join(root, file), "utf8");
  const ast = postcss.parse(source, { from: file });
  let rules = 0;
  let declarations = 0;

  ast.walkRules(rule => {
    rules += 1;
    const context = atRuleContext(rule);
    const selectors = postcss.list.comma(rule.selector).map(normalize);
    const decls = (rule.nodes ?? [])
      .filter(node => node.type === "decl")
      .map(node => ({
        property: node.prop,
        value: normalize(node.value),
        important: node.important,
      }));
    declarations += decls.length;

    for (const selector of selectors) {
      const occurrence = {
        file,
        selector,
        context,
        line: rule.source?.start?.line ?? null,
        declarations: decls,
      };
      add(selectorOccurrences, selector, occurrence);
      for (const declaration of decls) {
        if (declaration.important) {
          importantOccurrences.push({
            file,
            selector,
            context,
            line: occurrence.line,
            property: declaration.property,
            value: declaration.value,
          });
        }
      }
    }
  });

  inventory[file] = {
    lines: source.split("\n").length,
    bytes: source.length,
    rules,
    declarations,
  };
}

const crossFileSelectors = [];
const sameContextCrossFileSelectors = [];
const uxRepeatedSameContext = [];
const globalsRepeatedSameContext = [];

for (const [selector, occurrences] of selectorOccurrences) {
  const globals = occurrences.filter(item => item.file === "app/globals.css");
  const ux = occurrences.filter(item => item.file === "app/ux-foundations.css");

  if (globals.length && ux.length) {
    const commonContexts = [...new Set(globals.map(item => item.context))]
      .filter(context => ux.some(item => item.context === context));
    crossFileSelectors.push({
      selector,
      globals: globals.map(({ line, context }) => ({ line, context })),
      ux: ux.map(({ line, context }) => ({ line, context })),
      commonContexts,
    });
    if (commonContexts.length) {
      sameContextCrossFileSelectors.push({ selector, commonContexts });
    }
  }

  for (const [file, bucket] of [
    ["app/globals.css", globals],
    ["app/ux-foundations.css", ux],
  ]) {
    const byContext = new Map();
    for (const item of bucket) add(byContext, item.context, item);
    for (const [context, items] of byContext) {
      if (items.length < 2) continue;
      const finding = {
        selector,
        context,
        count: items.length,
        lines: items.map(item => item.line),
      };
      if (file === "app/globals.css") globalsRepeatedSameContext.push(finding);
      else uxRepeatedSameContext.push(finding);
    }
  }
}

function topImportant(limit = 60) {
  const grouped = new Map();
  for (const item of importantOccurrences) {
    const key = `${item.file}\u0000${item.selector}`;
    if (!grouped.has(key)) grouped.set(key, { file: item.file, selector: item.selector, count: 0, entries: [] });
    const group = grouped.get(key);
    group.count += 1;
    if (group.entries.length < 8) {
      group.entries.push({ line: item.line, context: item.context, property: item.property });
    }
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || a.selector.localeCompare(b.selector)).slice(0, limit);
}

const result = {
  inventory,
  metrics: {
    exactCrossFileSelectors: crossFileSelectors.length,
    sameContextCrossFileSelectors: sameContextCrossFileSelectors.length,
    uxRepeatedSameContext: uxRepeatedSameContext.length,
    globalsRepeatedSameContext: globalsRepeatedSameContext.length,
    importantDeclarations: importantOccurrences.length,
    uxImportantDeclarations: importantOccurrences.filter(item => item.file === "app/ux-foundations.css").length,
    globalsImportantDeclarations: importantOccurrences.filter(item => item.file === "app/globals.css").length,
  },
  sameContextCrossFileSelectors,
  uxRepeatedSameContext: uxRepeatedSameContext.sort((a, b) => b.count - a.count || a.selector.localeCompare(b.selector)),
  globalsRepeatedSameContext: globalsRepeatedSameContext.sort((a, b) => b.count - a.count || a.selector.localeCompare(b.selector)),
  topImportantSelectors: topImportant(),
};

console.log(JSON.stringify(result, null, 2));
