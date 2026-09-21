import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { dynamicClassEntry, dynamicClassRegistry } from "./css-audit-registry.mjs";

const root = process.cwd();
const baselinePath = path.join(root, "scripts", "css-audit-baseline.json");
const cssFiles = [
  "app/globals.css",
  "app/ux-foundations.css",
  "stories/storybook.css",
];
const sourceRoots = ["app", "stories", ".storybook"];
const jsonOnly = process.argv.includes("--json");
const allowBaselineDrift = process.argv.includes("--allow-baseline-drift");

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

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  }));
  return files.flat();
}

function lineFor(source, index) {
  return source.slice(0, index).split("\n").length;
}

function atRuleContext(node) {
  const context = [];
  let parent = node.parent;
  while (parent) {
    if (parent.type === "atrule") context.unshift(`@${parent.name}${parent.params ? ` ${normalizeAtRuleParams(parent.params)}` : ""}`);
    parent = parent.parent;
  }
  return context.length ? context.join(" > ") : "root";
}

function classNamesFromSelector(selector) {
  return [...selector.matchAll(/\.([_a-zA-Z][\w-]*)/g)].map(match => match[1]);
}

function tokensFromText(value) {
  return value.match(/-?[_a-zA-Z][\w-]*/g) ?? [];
}

function collectStaticClassUsage(source, file, usage) {
  const add = value => {
    for (const token of tokensFromText(value)) {
      if (!usage.has(token)) usage.set(token, new Set());
      usage.get(token).add(file);
    }
  };

  const templateClassNamePattern = /\bclassName\s*=\s*\{`([\s\S]*?)`/g;
  for (const match of source.matchAll(templateClassNamePattern)) add(match[1]);

  const classNamePattern = /\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]*?)\})/g;
  for (const match of source.matchAll(classNamePattern)) {
    add(match[1] ?? match[2] ?? "");
    for (const literal of (match[3] ?? "").matchAll(/(["'`])([\s\S]*?)\1/g)) add(literal[2]);
  }

  const objectClassNamePattern = /\bclassName\s*:\s*([\s\S]{0,220})/g;
  for (const match of source.matchAll(objectClassNamePattern)) {
    const expression = match[1].split(/\n\s*[A-Za-z_$][\w$]*\s*:/, 1)[0];
    for (const literal of expression.matchAll(/(["'`])([\s\S]*?)\1/g)) add(literal[2]);
  }
  const directObjectClassNamePattern = /\bclassName\s*:\s*(["'`])([\s\S]*?)\1/g;
  for (const match of source.matchAll(directObjectClassNamePattern)) add(match[2]);

  const classListPattern = /\bclassList\.(?:add|remove|toggle)\(([^)]*)\)/g;
  for (const match of source.matchAll(classListPattern)) {
    for (const literal of match[1].matchAll(/(["'`])([\s\S]*?)\1/g)) add(literal[2]);
  }
}

async function collectClassUsage() {
  const usage = new Map();
  const files = (await Promise.all(sourceRoots.map(directory => filesUnder(path.join(root, directory)))))
    .flat()
    .filter(file => /\.(?:tsx?|jsx?)$/.test(file));
  for (const file of files) collectStaticClassUsage(await readFile(file, "utf8"), relative(file), usage);
  return usage;
}

function addOccurrence(map, key, occurrence) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(occurrence);
}

async function parseCss() {
  const selectors = new Map();
  const declarations = new Map();
  const tokens = new Map();
  const classDefinitions = new Map();
  let importantDeclarations = 0;
  let rootBlocks = 0;
  let ruleCount = 0;
  let declarationCount = 0;

  for (const fileName of cssFiles) {
    const file = path.join(root, fileName);
    const source = await readFile(file, "utf8");
    const ast = postcss.parse(source, { from: file });

    ast.walkRules(rule => {
      ruleCount += 1;
      const context = atRuleContext(rule);
      const selector = normalize(rule.selector);
      const ruleLocation = { file: fileName, line: rule.source?.start?.line ?? lineFor(source, rule.source?.start?.offset ?? 0), context };
      addOccurrence(selectors, selector, { ...ruleLocation, selector });
      for (const className of classNamesFromSelector(rule.selector)) {
        addOccurrence(classDefinitions, className, { ...ruleLocation, selector });
      }
      for (const declaration of rule.nodes ?? []) {
        if (declaration.type !== "decl") continue;
        declarationCount += 1;
        const property = declaration.prop;
        const value = normalize(declaration.value);
        const key = `${selector}\u0000${context}\u0000${property}`;
        addOccurrence(declarations, key, { ...ruleLocation, selector, property, value, important: declaration.important });
        if (property.startsWith("--")) addOccurrence(tokens, property, { ...ruleLocation, property, value, important: declaration.important });
        if (declaration.important) importantDeclarations += 1;
      }
      if (selector === ":root" || selector.includes(":root,")) rootBlocks += 1;
    });
  }

  return { selectors, declarations, tokens, classDefinitions, importantDeclarations, rootBlocks, ruleCount, declarationCount };
}

function sortOccurrences(occurrences) {
  return [...occurrences].sort((a, b) => `${a.file}:${a.line}:${a.context}`.localeCompare(`${b.file}:${b.line}:${b.context}`));
}

function groupSelectorFindings(selectors, declarations) {
  const repeated = [];
  const conflicts = [];
  const responsive = [];
  const redundant = [];
  const additive = [];

  for (const [selector, occurrences] of selectors) {
    if (occurrences.length < 2) continue;
    const ordered = sortOccurrences(occurrences);
    const selectorDeclarations = [...declarations.entries()]
      .filter(([key]) => key.startsWith(`${selector}\u0000`))
      .flatMap(([, values]) => values);
    const contexts = new Set(ordered.map(item => item.context));
    const responsiveContexts = [...contexts].filter(context => /@(media|container)\b/.test(context));
    const properties = new Map();
    for (const declaration of selectorDeclarations) {
      const key = declaration.property;
      if (!properties.has(key)) properties.set(key, []);
      properties.get(key).push(`${declaration.value}${declaration.important ? "!important" : ""}`);
    }
    const overlapping = [...properties].filter(([, values]) => values.length > 1);
    const conflictingProperties = overlapping.filter(([, values]) => new Set(values).size > 1).map(([property]) => property);
    const redundantProperties = overlapping.filter(([, values]) => new Set(values).size === 1).map(([property]) => property);
    const sameContextConflicts = conflictingProperties.filter(property => {
      const valuesByContext = new Map();
      for (const declaration of selectorDeclarations.filter(item => item.property === property)) {
        if (!valuesByContext.has(declaration.context)) valuesByContext.set(declaration.context, new Set());
        valuesByContext.get(declaration.context).add(`${declaration.value}${declaration.important ? "!important" : ""}`);
      }
      return [...valuesByContext.values()].some(values => values.size > 1);
    });
    const category = sameContextConflicts.length
      ? "direct-conflict"
      : conflictingProperties.length
        ? "responsive-variant"
        : redundantProperties.length
          ? "redundant"
          : "additive";

    const finding = {
      selector,
      occurrences: ordered,
      contexts: [...contexts].sort(),
      properties: [...new Set(selectorDeclarations.map(item => item.property))].sort(),
      category,
      conflictingProperties: conflictingProperties.sort(),
      sameContextConflictingProperties: sameContextConflicts.sort(),
      redundantProperties: redundantProperties.sort(),
    };
    repeated.push(finding);
    if (category === "direct-conflict") conflicts.push(finding);
    if (category === "responsive-variant") responsive.push({ ...finding, responsiveContexts: responsiveContexts.sort() });
    if (category === "redundant") redundant.push(finding);
    if (category === "additive") additive.push(finding);
  }

  return { repeated, conflicts, responsive, redundant, additive };
}

function tokenFindings(tokens) {
  const repeated = [];
  const conflicting = [];
  for (const [property, occurrences] of tokens) {
    if (occurrences.length < 2) continue;
    const values = [...new Set(occurrences.map(item => item.value))].sort();
    const finding = { property, values, occurrences: sortOccurrences(occurrences) };
    repeated.push(finding);
    if (values.length > 1) conflicting.push(finding);
  }
  return { repeated, conflicting };
}

function orphanFindings(classDefinitions, classUsage) {
  const findings = [];
  for (const [className, occurrences] of classDefinitions) {
    const selectorRegistryMatch = occurrences.some(occurrence => dynamicClassRegistry.some(entry => entry.selectorPattern && new RegExp(entry.selectorPattern).test(occurrence.selector)));
    if ((classUsage.get(className)?.size ?? 0) > 0 || dynamicClassEntry(className) || selectorRegistryMatch) continue;
    findings.push({
      className,
      selectors: [...new Set(occurrences.map(item => item.selector))].sort(),
      definitions: sortOccurrences(occurrences),
    });
  }
  return findings.sort((a, b) => a.className.localeCompare(b.className));
}

function baselineDelta(value, threshold) {
  return value - threshold;
}

const strictBaselineMetrics = new Set([
  "exactRepeatedSelectors",
  "directPropertyConflicts",
  "strictRedundantDeclarations",
  "repeatedTokens",
  "conflictingTokens",
  "importantDeclarations",
  "orphanClasses",
]);

const reviewOnlyMetrics = new Set([
  "responsiveVariants",
  "additiveExtensions",
  "definedClasses",
]);

function compareBaseline(metrics, baseline) {
  const deltas = {};
  const regressions = [];
  const reviewDrifts = [];
  for (const [metric, threshold] of Object.entries(baseline.thresholds)) {
    const value = metrics[metric];
    if (typeof value !== "number") continue;
    const delta = baselineDelta(value, threshold);
    deltas[metric] = { baseline: threshold, current: value, delta };
    if (delta <= 0) continue;
    const finding = { metric, baseline: threshold, current: value, delta };
    if (strictBaselineMetrics.has(metric)) regressions.push(finding);
    else if (reviewOnlyMetrics.has(metric)) reviewDrifts.push(finding);
  }
  return { deltas, regressions, reviewDrifts };
}

export async function auditCssGovernance({ compare = true } = {}) {
  const [parsed, classUsage, baselineSource] = await Promise.all([
    parseCss(),
    collectClassUsage(),
    readFile(baselinePath, "utf8").then(JSON.parse),
  ]);
  const selectorFindings = groupSelectorFindings(parsed.selectors, parsed.declarations);
  const tokenResult = tokenFindings(parsed.tokens);
  const orphanClasses = orphanFindings(parsed.classDefinitions, classUsage);
  const metrics = {
    exactRepeatedSelectors: selectorFindings.repeated.length,
    directPropertyConflicts: selectorFindings.conflicts.length,
    responsiveVariants: selectorFindings.responsive.length,
    strictRedundantDeclarations: selectorFindings.redundant.length,
    additiveExtensions: selectorFindings.additive.length,
    repeatedTokens: tokenResult.repeated.length,
    conflictingTokens: tokenResult.conflicting.length,
    importantDeclarations: parsed.importantDeclarations,
    definedClasses: parsed.classDefinitions.size,
    orphanClasses: orphanClasses.length,
  };
  const baseline = compare ? compareBaseline(metrics, baselineSource) : { deltas: {}, regressions: [], reviewDrifts: [] };
  return {
    version: 1,
    scope: { cssFiles, sourceRoots },
    metrics,
    inventory: { rules: parsed.ruleCount, declarations: parsed.declarationCount, rootBlocks: parsed.rootBlocks },
    baseline: { file: "scripts/css-audit-baseline.json", ...baseline },
    dynamicClassRegistry,
    findings: {
      repeatedSelectors: selectorFindings.repeated,
      propertyConflicts: selectorFindings.conflicts,
      responsiveVariants: selectorFindings.responsive,
      redundantDeclarations: selectorFindings.redundant,
      additiveExtensions: selectorFindings.additive,
      repeatedTokens: tokenResult.repeated,
      conflictingTokens: tokenResult.conflicting,
      orphanClasses,
    },
  };
}

function printHuman(result) {
  const { metrics, inventory, baseline } = result;
  console.log("CSS governance audit");
  console.log(`Scope: ${result.scope.cssFiles.join(", ")}`);
  console.log(`Inventory: ${inventory.rules} rules, ${inventory.declarations} declarations, ${inventory.rootBlocks} :root blocks`);
  console.log("");
  for (const [metric, value] of Object.entries(metrics)) {
    const delta = baseline.deltas[metric];
    const suffix = delta ? ` (baseline ${delta.baseline}, delta ${delta.delta >= 0 ? "+" : ""}${delta.delta})` : "";
    console.log(`${metric}: ${value}${suffix}`);
  }
  console.log("");
  console.log(`Dynamic registry entries: ${result.dynamicClassRegistry.length}`);
  console.log(`Dynamic entries requiring state review: ${result.dynamicClassRegistry.filter(entry => entry.reviewRequired).map(entry => entry.id).join(", ") || "none"}`);
  console.log(`Orphan candidates: ${metrics.orphanClasses ? result.findings.orphanClasses.map(item => item.className).join(", ") : "none"}`);
  if (baseline.reviewDrifts.length) {
    console.log(`Review-only drift: ${baseline.reviewDrifts.map(item => `${item.metric} (+${item.delta})`).join(", ")}`);
  }
  if (baseline.regressions.length) {
    console.error(`Baseline regressions: ${baseline.regressions.map(item => `${item.metric} (+${item.delta})`).join(", ")}`);
  } else {
    console.log("Baseline status: PASS");
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const result = await auditCssGovernance();
  if (jsonOnly) console.log(JSON.stringify(result, null, 2));
  else printHuman(result);
  if (result.baseline.regressions.length && !allowBaselineDrift) process.exitCode = 1;
}
