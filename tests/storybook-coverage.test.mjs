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
    ThemeBaskets: ["ThemeBaskets", "mobile", "desktop"],
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

test("company Storybook demonstrates persistent analysis navigation with complete valuation data", async () => {
  const [companyStory, fixtures] = await Promise.all([read("stories/Company.stories.tsx"), read("stories/reference-fixtures.ts")]);
  assert.match(companyStory, /OpenAnalysisContext/);
  assert.match(companyStory, /selectedAnalysisId=\{activeDocument\}/);
  assert.match(companyStory, /export const EmbeddedValuation/);
  assert.match(companyStory, /export const EmbeddedValuationDesktop/);
  assert.match(fixtures, /Seuils de rendement · Base intacte[\s\S]*RUN RECEIPT[\s\S]*Sources/);
});

test("mobile navigation presents four equal destinations with a selected blue indicator", async () => {
  const [page, shellCss, discoveryCss] = await Promise.all([read("app/page.tsx"), read("app/styles/ux/shell.css"), read("app/styles/ux/discovery.css")]);
  const tabList = page.match(/const tabs:[\s\S]*?\n\];/)?.[0] ?? "";
  assert.match(tabList, /id: "portfolio"[\s\S]*id: "companies"[\s\S]*id: "themes"[\s\S]*id: "ia"/);
  assert.doesNotMatch(tabList, /gestion/);
  assert.match(shellCss, /\.mobile-nav\s*\{[^}]*display:\s*flex;[^}]*gap:\s*clamp\(/s);
  assert.match(shellCss, /\.mobile-nav button\s*\{[^}]*flex:\s*1 1 0;[^}]*min-height:\s*calc\(var\(--ui-control-hit-height\) \+ var\(--space-2\)\);[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*padding:\s*clamp\(/s);
  assert.match(shellCss, /\.mobile-nav button \.nav-icon,\s*\.mobile-nav button \.nav-icon svg\s*\{[^}]*width:\s*clamp\(26px,\s*7vw,\s*30px\)/s);
  assert.match(shellCss, /\.mobile-nav button\.active::before\s*\{[^}]*background:\s*var\(--color-accent\)/s);
  assert.match(shellCss, /inset:\s*auto max\(var\(--space-3\), env\(safe-area-inset-right\)\) max\(var\(--space-2\), env\(safe-area-inset-bottom\)\)/);
  assert.doesNotMatch(shellCss, /\.app-shell \.page-header h1\s*\{[^}]*max-width:\s*\d+px/s);
  const mobileNav = page.match(/<GlassChrome as="nav" className="mobile-nav"[\s\S]*?<\/GlassChrome>/)?.[0] ?? "";
  assert.match(mobileNav, /aria-label=\{tab\.label\}/);
  assert.match(mobileNav, /<NavigationIcon name=\{tab\.icon\}/);
  assert.doesNotMatch(mobileNav, /<small>/);
  assert.match(mobileNav, /visibleTabs\.map\(tab/);
  assert.match(page, /id: "ia", label: "Analyse IA"/);
  assert.doesNotMatch(page, /eyebrow="(?:Univers d’investissement|Performance des paniers)"/);
  assert.match(discoveryCss, /\.theme-basket-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.4fr\) minmax\(0,\s*\.85fr\) minmax\(0,\s*1\.1fr\)/s);
  assert.match(discoveryCss, /\.theme-basket-controls \.ui-compact-control--select,\s*\.theme-basket-controls \.ui-action-button--compact\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0/s);
  assert.doesNotMatch(discoveryCss, /theme-basket-controls[^}]*min-width:\s*112px/s);
});

test("AI launcher stays a dedicated screen and composes the shared UI primitives", async () => {
  const [source, navigation, styles] = await Promise.all([read("app/components/ai-analysis.tsx"), read("app/lib/app-navigation.tsx"), read("app/styles/ux/workspaces.css")]);
  for (const primitive of ["AppPageHeader", "SearchField", "CompactControl", "PrimaryBlock", "DisclosureSurface", "ActionButton", "AsyncState"]) assert.match(source, new RegExp(`\\b${primitive}\\b`));
  assert.match(source, /useClientResource<\{ companies: CompanyListItem\[\] \}>\("\/api\/companies"\)/);
  assert.match(source, /createAiPrompt\(workflow, selected\.name, selected\.ticker, session\.scope\)/);
  assert.match(source, /createChatGptUrl\(prompt\)/);
  assert.match(source, /className="ai-chatgpt-launcher"[^>]*aria-label=\{openUrl\?/);
  assert.match(source, /aria-disabled=\{!openUrl\}/);
  assert.match(source, /tabIndex=\{openUrl\?undefined:0\}/);
  assert.match(source, /event\.key==="Enter"\|\|event\.key===" "/);
  assert.match(source, /<Image src="\/openai-mark\.svg" alt="" width=\{90\} height=\{90\}/);
  assert.match(source, /Ouvrir le prompt dans ChatGPT/);
  assert.doesNotMatch(source, /ai-chatgpt-card|ai-chatgpt-brand|ai-logo-attribution/);
  assert.match(styles, /\.ai-chatgpt-launcher:focus-visible/);
  assert.match(styles, /\.ai-chatgpt-hint/);
  assert.doesNotMatch(styles, /\.ai-chatgpt-card|\.ai-chatgpt-brand|\.ai-logo-attribution/);
  assert.match(source, /navigator\.clipboard\.writeText\(prompt\)/);
  assert.match(navigation, /"ia"/);
  assert.doesNotMatch(await read("app/components/notion-companies.tsx"), /chatgpt|ai-analysis/i);
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
  assert.match(source, /Entreprises, Portfolio, Thèmes, Company and Reader mount production screens/);
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
