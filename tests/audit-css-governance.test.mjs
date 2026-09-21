import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditCssGovernance } from "../scripts/audit-css-governance.mjs";

test("CSS governance matches the checked-in debt baseline", async () => {
  const result = await auditCssGovernance();
  const baseline = JSON.parse(await readFile(new URL("../scripts/css-audit-baseline.json", import.meta.url), "utf8"));

  assert.deepEqual(result.scope.cssFiles, [
    "app/globals.css",
    "app/ux-foundations.css",
    "stories/storybook.css",
  ]);
  assert.deepEqual(result.metrics, baseline.thresholds);
  assert.deepEqual(result.baseline.regressions, []);
  assert.deepEqual(result.findings.orphanClasses, []);
});

test("the audit keeps generated primitives and scoped state selectors out of orphan findings", async () => {
  const result = await auditCssGovernance({ compare: false });
  const orphanNames = new Set(result.findings.orphanClasses.map(item => item.className));

  for (const className of [
    "ui-surface--primary",
    "ui-badge--warning",
    "ui-discovery-card--watchlist",
    "analysis-scenario-base",
    "decision-reject",
    "notion-table-two-column",
    "research-score-cell",
    "error",
    "running",
  ]) {
    assert.equal(orphanNames.has(className), false, `${className} should be proven by a static or registered generator`);
  }

});

test("production and Storybook import the same public CSS entry", async () => {
  const [layout, preview, entry] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.storybook/preview.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/design-system.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /import \"\.\/design-system\.css\"/);
  assert.match(preview, /import \"\.\.\/app\/design-system\.css\"/);
  assert.doesNotMatch(layout, /import \"\.\/(?:globals|iphone-experience)\.css\"/);
  assert.doesNotMatch(preview, /import \"\.\.\/app\/(?:globals|iphone-experience)\.css\"/);
  assert.deepEqual(
    [...entry.matchAll(/@import \"([^\"]+)\";/g)].map(match => match[1]),
    ["tailwindcss", "./ux-foundations.css", "./globals.css"],
  );
});


test("responsive contexts are canonicalized before conflict classification", async () => {
  const result = await auditCssGovernance({ compare: false });
  const analysisRow = result.findings.repeatedSelectors.find(item => item.selector === ".analysis-list-row");

  assert.ok(analysisRow, "analysis-list-row should remain a tracked repeated selector");
  assert.ok(analysisRow.contexts.includes("@media (max-width:760px)"));
  assert.equal(analysisRow.contexts.some(context => context.includes("max-width: 760px")), false);
  assert.deepEqual(result.findings.propertyConflicts, []);
});

test("dead CSS audit uses the canonical dynamic registry and scans object column classes", async () => {
  const source = await readFile(new URL("../scripts/audit-dead-css.mjs", import.meta.url), "utf8");

  assert.match(source, /dynamicClassEntry, dynamicClassRegistry/);
  assert.doesNotMatch(source, /const dynamicPrefixes =/);
  assert.doesNotMatch(source, /const dynamicNames =/);
  assert.ok(source.includes("addStaticClasses(match[2]);"));
});
