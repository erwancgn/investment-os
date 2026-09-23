import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, rootUrl), "utf8");

test("all primitive manifest exports have executable Storybook coverage", async () => {
  const primitiveSource = await read("app/components/ui-primitives.tsx");
  const manifest = await read("ui-foundation-manifest.md");
  const storyFiles = (await readdir(new URL("stories/", rootUrl))).filter(file => file.endsWith(".stories.tsx"));
  const storySource = (await Promise.all(storyFiles.map(file => read(`stories/${file}`)))).join("\n");
  const exports = [...primitiveSource.matchAll(/^export function (\w+)/gm)].map(match => match[1]);
  const manifestExports = [...manifest.matchAll(/^\| \d+ \| `([^`]+)` \|/gm)].map(match => match[1]);

  assert.deepEqual(manifestExports, exports);
  for (const exportName of exports) assert.match(storySource, new RegExp(`\\b${exportName}\\b`), `${exportName} has no Storybook usage`);

  const mapping = await read("docs/lovable-design-system.md");
  assert.match(mapping, /Lovable → React → Storybook/);
  for (const exportName of exports) assert.ok(mapping.includes(`\`${exportName}\``), `${exportName} is missing from the Lovable mapping`);
});

test("reference screen stories render production components at mobile and desktop viewports", async () => {
  const references = {
    Companies: ["NotionCompanies", "mobile", "desktop"],
    Portfolio: ["LivePortfolioDashboard", "mobile", "desktop"],
    Company: ["CompanyDetail", "mobile", "desktop"],
    Reader: ["AnalysisReader", "mobile", "desktop"],
  };
  for (const [storyName, [componentName, ...viewports]] of Object.entries(references)) {
    const source = await read(`stories/${storyName}.stories.tsx`);
    assert.match(source, new RegExp(`import \\{[^}]*\\b${componentName}\\b[^}]*\\} from \\\"\\.\\.\\/app\\/components/`));
    assert.match(source, new RegExp(`<${componentName}[\\s>]`));
    for (const viewport of viewports) assert.match(source, new RegExp(`defaultViewport: \\"${viewport}\\"`));
  }
  const companiesSource = await read("app/components/notion-companies.tsx");
  assert.match(companiesSource, /<DiscoveryCard[^>]+kind="company"/);
  const shellSource = await read("stories/Shell.stories.tsx");
  assert.match(shellSource, /import Home from "\.\.\/app\/page"/);
  assert.match(shellSource, /<Home \/>/);
  const preview = await read(".storybook/preview.ts");
  const frame = await read("stories/reference-frame.tsx");
  assert.match(preview, /width: "390px"/);
  assert.match(preview, /width: "1440px"/);
  assert.match(frame, /maxWidth: 390/);
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

test("production visual review mounts the unified company screen at 390px", async () => {
  const [source, frame] = await Promise.all([read("stories/DesignSystem.stories.tsx"), read("stories/reference-frame.tsx")]);
  assert.match(source, /export const ProductionVisualReview/);
  assert.match(source, /<NotionCompanies(?:\s|>)/);
  assert.doesNotMatch(source, /NotionWatchlist|NotionAnalyses|DocumentSearch/);
  assert.match(source, /from "\.\/reference-fixtures"/);
  assert.match(frame, /maxWidth: 390/);
});

test("mobile company states cover long names and all three overlapping views", async () => {
  const [css, companiesStory, companiesSource, referenceFixtures] = await Promise.all([
    read("app/globals.css"), read("stories/Companies.stories.tsx"), read("app/components/notion-companies.tsx"), read("stories/reference-fixtures.ts"),
  ]);
  assert.match(css, /font-size:\s*var\(--font-discovery-title\)/);
  assert.match(companiesStory, /Lumentum Holdings — Optical Networking and Datacenter Infrastructure/);
  assert.match(companiesStory, /completeWatchlistOnly/);
  assert.match(companiesStory, /unclassified/);
  assert.match(companiesSource, /\["Toutes", "Détenues", "Watchlist"\]/);
  assert.match(companiesSource, /<DisclosureSurface[^>]*summary=/);
  assert.match(referenceFixtures, /Advanced Micro Devices — Long Reference Name/);
});
