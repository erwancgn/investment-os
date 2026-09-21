import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, rootUrl), "utf8");

test("all 21 manifest exports have executable Storybook coverage", async () => {
  const primitiveSource = await read("app/components/ui-primitives.tsx");
  const manifest = await read("ui-foundation-manifest.md");
  const storyFiles = (await readdir(new URL("stories/", rootUrl))).filter(file => file.endsWith(".stories.tsx"));
  const storySource = (await Promise.all(storyFiles.map(file => read(`stories/${file}`)))).join("\n");
  const exports = [...primitiveSource.matchAll(/^export function (\w+)/gm)].map(match => match[1]);
  const manifestExports = [...manifest.matchAll(/^\| \d+ \| `([^`]+)` \|/gm)].map(match => match[1]);

  assert.equal(exports.length, 21);
  assert.deepEqual(manifestExports, exports);
  for (const exportName of exports) {
    assert.match(storySource, new RegExp(`\\b${exportName}\\b`), `${exportName} has no Storybook usage`);
  }

  const mapping = await read("docs/lovable-design-system.md");
  assert.match(mapping, /Lovable → React → Storybook/);
  for (const exportName of exports) {
    assert.ok(mapping.includes(`\`${exportName}\``), `${exportName} is missing from the Lovable mapping`);
  }
});

test("reference screen stories use production components at both required viewports", async () => {
  const references = {
    Companies: ["NotionCompanies", "mobile", "desktop"],
    Watchlist: ["NotionWatchlist", "mobile", "desktop"],
    Analyses: ["NotionAnalyses", "mobile", "desktop"],
    Portfolio: ["LivePortfolioDashboard", "mobile", "desktop"],
    Reader: ["AnalysisReader", "mobile", "desktop"],
  };

  for (const [storyName, [componentName, ...viewports]] of Object.entries(references)) {
    const source = await read(`stories/${storyName}.stories.tsx`);
    assert.match(source, new RegExp(`import \\{[^}]*\\b${componentName}\\b[^}]*\\} from \\"\\.\\./app/components/`), `${storyName} does not import ${componentName}`);
    assert.match(source, new RegExp(`<${componentName}[\\s>]`), `${storyName} does not render ${componentName}`);
    for (const viewport of viewports) {
      assert.match(source, new RegExp(`defaultViewport: \\"${viewport}\\"`), `${storyName} is missing ${viewport} viewport`);
    }
  }

  const productionScreens = [
    ["notion-companies", "NotionCompanies", "company"],
    ["notion-watchlist", "NotionWatchlist", "watchlist"],
    ["notion-analyses", "NotionAnalyses", "analysis"],
  ];
  for (const [fileName, componentName, kind] of productionScreens) {
    const source = await read(`app/components/${fileName}.tsx`);
    assert.match(source, new RegExp(`<DiscoveryCard[^>]+kind=\"${kind}\"`), `${componentName} no longer mounts the production ${kind} card`);
  }

  const preview = await read(".storybook/preview.ts");
  const frame = await read("stories/reference-frame.tsx");
  assert.match(preview, /width: "390px"/);
  assert.match(preview, /width: "1440px"/);
  assert.match(frame, /width: 390/);
});

test("the design-system page keeps the visible reference order", async () => {
  const source = await read("stories/DesignSystem.stories.tsx");
  const sections = ["Foundations", "Surfaces", "Controls", "Badges / States", "Data display", "Discovery cards", "Reference screens"];
  let previous = -1;
  for (const section of sections) {
    const position = source.indexOf(`>${section}<`);
    assert.ok(position > previous, `${section} is missing or out of order`);
    previous = position;
  }
});
