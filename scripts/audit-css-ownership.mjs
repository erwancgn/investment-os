import { readFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import { appCssFiles } from "./css-file-manifest.mjs";

const root = process.cwd();
const files = appCssFiles;
const isUxFile = file => file.startsWith("app/styles/ux/");

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
const declarationChains = new Map();
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
        add(declarationChains, `${selector}\u0000${context}\u0000${declaration.property}`, {
          file,
          selector,
          context,
          line: occurrence.line,
          property: declaration.property,
          value: declaration.value,
          important: declaration.important,
        });
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
  const ux = occurrences.filter(item => isUxFile(item.file));

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

  for (const [owner, bucket] of [
    ["globals", globals],
    ["ux", ux],
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
      if (owner === "globals") globalsRepeatedSameContext.push(finding);
      else uxRepeatedSameContext.push(finding);
    }
  }
}

function classifyDeclarationChains() {
  const sameFile = [];
  const crossFile = [];
  let shadowedDeclarations = 0;
  let identicalDeclarations = 0;

  for (const occurrences of declarationChains.values()) {
    if (occurrences.length < 2) continue;
    const byFile = new Map();
    for (const item of occurrences) add(byFile, item.file, item);

    for (const [file, items] of byFile) {
      if (items.length < 2) continue;
      const values = [...new Set(items.map(item => `${item.value}${item.important ? " !important" : ""}`))];
      if (values.length === 1) identicalDeclarations += items.length - 1;
      else shadowedDeclarations += items.length - 1;
      sameFile.push({
        file,
        selector: items[0].selector,
        context: items[0].context,
        property: items[0].property,
        values,
        lines: items.map(item => item.line),
      });
    }

    if (byFile.size > 1) {
      crossFile.push({
        selector: occurrences[0].selector,
        context: occurrences[0].context,
        property: occurrences[0].property,
        values: occurrences.map(item => ({
          file: item.file,
          line: item.line,
          value: item.value,
          important: item.important,
        })),
      });
    }
  }

  return {
    sameFile: sameFile.sort((a, b) => a.file.localeCompare(b.file) || a.selector.localeCompare(b.selector) || a.property.localeCompare(b.property)),
    crossFile: crossFile.sort((a, b) => a.selector.localeCompare(b.selector) || a.property.localeCompare(b.property)),
    shadowedDeclarations,
    identicalDeclarations,
  };
}

const declarationChainResult = classifyDeclarationChains();
const globalUxDeclarationChains = declarationChainResult.crossFile.filter(item => {
  const files = new Set(item.values.map(value => value.file));
  return files.has("app/globals.css") && [...files].some(isUxFile);
});
const uxModuleDeclarationChains = declarationChainResult.crossFile.filter(item => {
  const files = new Set(item.values.map(value => value.file));
  return files.size > 1 && [...files].every(isUxFile);
});

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

const ownershipContractMetrics = [
  "sameFileDeclarationChains",
  "globalUxDeclarationChains",
  "uxModuleDeclarationChains",
];

const result = {
  inventory,
  metrics: {
    exactCrossFileSelectors: crossFileSelectors.length,
    sameContextCrossFileSelectors: sameContextCrossFileSelectors.length,
    uxRepeatedSameContext: uxRepeatedSameContext.length,
    globalsRepeatedSameContext: globalsRepeatedSameContext.length,
    importantDeclarations: importantOccurrences.length,
    uxImportantDeclarations: importantOccurrences.filter(item => isUxFile(item.file)).length,
    globalsImportantDeclarations: importantOccurrences.filter(item => item.file === "app/globals.css").length,
    sameFileDeclarationChains: declarationChainResult.sameFile.length,
    crossFileDeclarationChains: declarationChainResult.crossFile.length,
    globalUxDeclarationChains: globalUxDeclarationChains.length,
    uxModuleDeclarationChains: uxModuleDeclarationChains.length,
    shadowedDeclarations: declarationChainResult.shadowedDeclarations,
    identicalRepeatedDeclarations: declarationChainResult.identicalDeclarations,
  },
  sameContextCrossFileSelectors,
  uxRepeatedSameContext: uxRepeatedSameContext.sort((a, b) => b.count - a.count || a.selector.localeCompare(b.selector)),
  globalsRepeatedSameContext: globalsRepeatedSameContext.sort((a, b) => b.count - a.count || a.selector.localeCompare(b.selector)),
  sameFileDeclarationChains: declarationChainResult.sameFile,
  crossFileDeclarationChains: declarationChainResult.crossFile,
  globalUxDeclarationChains,
  uxModuleDeclarationChains,
  topImportantSelectors: topImportant(),
};

const ownershipContractViolations = ownershipContractMetrics
  .filter(metric => result.metrics[metric] > 0)
  .map(metric => ({ metric, value: result.metrics[metric] }));

result.contract = {
  metrics: ownershipContractMetrics,
  violations: ownershipContractViolations,
  status: ownershipContractViolations.length ? "FAIL" : "PASS",
};

console.log(JSON.stringify(result, null, 2));

if (ownershipContractViolations.length) {
  console.error(
    `CSS ownership contract failed: ${ownershipContractViolations
      .map(({ metric, value }) => `${metric}=${value}`)
      .join(", ")}`,
  );
  process.exitCode = 1;
}
