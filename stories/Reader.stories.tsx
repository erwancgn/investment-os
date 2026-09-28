import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnalysisReader } from "../app/components/analysis-reader";
import { desktopFrame, frame, tabletFrame } from "./reference-frame";
import { advantestValuationDocument, completeReferenceDocuments, document, tsmcValuationDocument } from "./reference-fixtures";

const memoDocument = {
  ...document,
  id: "doc-memo",
  title: "Investment Memo CIO — Reference",
  category: "synthese" as const,
  agent: "Investment Memo CIO",
  score: "",
  verdict: "Hold / monitor",
  summary: "Thèse long terme intacte, avec discipline sur la valorisation et suivi des catalyseurs.",
  plainText: `# Investment Memo CIO
## Decision Card
Champ | Valeur | Détail
Action | Hold | Position conservée
Confiance | High | Thèse intacte
Prochaine revue | Après résultats | Revalider la valorisation

## Raisonnement décisif
La qualité opérationnelle reste forte, mais le prix impose de conserver une marge de sécurité.

## État des modules
Module | Statut | Note
Business | Validated | Qualité confirmée
Valuation | Current | Discipline requise
Short | Current | Aucun signal bloquant
Portfolio | Current | Taille maîtrisée

## Risques
- Compression des multiples
- Ralentissement de la demande datacenter`,
};

const meta = { title: "Reference screens/Reader", parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile" } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Reader: Story = { render: () => frame(<AnalysisReader document={document} companyName="Advanced Micro Devices" onBack={() => undefined} />) };
export const ReaderDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<AnalysisReader document={document} companyName="Advanced Micro Devices" onBack={() => undefined} />) };
export const ReaderTablet: Story = { parameters: { viewport: { defaultViewport: "tablet" } }, render: () => tabletFrame(<AnalysisReader document={document} companyName="Advanced Micro Devices" onBack={() => undefined} />) };


export const Memo: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => frame(<AnalysisReader document={memoDocument} companyName="Advanced Micro Devices" onBack={() => undefined} />) };
export const MemoDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<AnalysisReader document={memoDocument} companyName="Advanced Micro Devices" onBack={() => undefined} />) };

export const Business: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.business} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const Valuation: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.valuation} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const Short: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.risques} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const PortfolioFit: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.portfolio} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const CIO: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.synthese} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const Earnings: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.earnings} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const ValuationTSMC: Story = { render: () => frame(<AnalysisReader document={tsmcValuationDocument} companyName="TSMC" onBack={() => undefined} />) };
export const ValuationTSMCTablet: Story = { parameters: { viewport: { defaultViewport: "tablet" } }, render: () => tabletFrame(<AnalysisReader document={tsmcValuationDocument} companyName="TSMC" onBack={() => undefined} />) };
export const ValuationTSMCDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<AnalysisReader document={tsmcValuationDocument} companyName="TSMC" onBack={() => undefined} />) };
export const ValuationAdvantestJPY: Story = { render: () => frame(<AnalysisReader document={advantestValuationDocument} companyName="Advantest" onBack={() => undefined} />) };

// Fallback-renderer regression fixtures transcribed from the read-only Notion pages.
// Google v13: https://app.notion.com/p/3dd37ea7af3581a69ca3fa76f6033714
// Google v14: https://app.notion.com/p/3e937ea7af3581e99d34e56efc0a0a04
const googleValuation = (version: "v13" | "v14", date: string, price: string, cagr: string, status: string) => ({
  ...completeReferenceDocuments.valuation,
  id: `ref-google-${version}`,
  title: `Alphabet — Valuation Check ${version} — Full Value — ${date}`,
  agent: "Valuation",
  current: version === "v14",
  status,
  verdict: "Correcte",
  plainText: `## TL;DR\nCours de référence : ${price} USD. Le scénario Base donne ${cagr} % par an. À 12 % de rendement exigé, le prix maximal est ~332 USD.\n\n## Cours de référence\n${price} USD.\n\n## Scénarios · horizon 5 ans\n| Mesure | Bear | Base | Bull |\n|---|---:|---:|---:|\n| Prix terminal estimé · USD | 262 | 585 | 920 |\n| CAGR actionnaire · %/an | -5,3 % | 11,2 % | 21,7 % |\n\n## Seuils · scénario Base intacte\n| Rendement exigé | Prix maximal |\n|---|---:|\n| 10 % | 363 USD |\n| 12 % | 332 USD |\n| 15 % | 291 USD |\n\n## Sources\nContenu du rapport Notion ${version}.`,
  summary: `Cours ${price} USD · Base ${cagr} %/an · seuil 12 % ~332 USD`,
  score: "59",
  date,
});
const googleV13 = googleValuation("v13", "2026-09-16", "344.98", "11.1", "Superseded");
const googleV14 = googleValuation("v14", "2026-09-28", "343.92", "11.2", "Validated");
export const GoogleV13: Story = { render: () => frame(<AnalysisReader document={googleV13} companyName="Alphabet" onBack={() => undefined} />) };
export const GoogleV13Desktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<AnalysisReader document={googleV13} companyName="Alphabet" onBack={() => undefined} />) };
export const GoogleV14: Story = { render: () => frame(<AnalysisReader document={googleV14} companyName="Alphabet" onBack={() => undefined} />) };
export const GoogleV14Desktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<AnalysisReader document={googleV14} companyName="Alphabet" onBack={() => undefined} />) };

const denseMatrixDocument = {
  ...completeReferenceDocuments.valuation,
  id: "ref-valuation-dense",
  title: "Valuation — matrice dense",
  plainText: `## Repères historiques
| Date | Scénario | Prix | CAGR | Devise |
|---|---|---:|---:|---|
| 2022 | Bear | 80 | -4 % | USD |
| 2023 | Bear | 84 | -3 % | USD |
| 2024 | Base | 100 | 0 % | USD |
| 2025 | Base | 120 | 4 % | USD |
| 2026 | Bull | 145 | 8 % | USD |
| 2027 | Bull | 160 | 10 % | USD |
| 2028 | Bull | 180 | 12 % | USD |`,
};

export const DenseMatrix: Story = { render: () => frame(<AnalysisReader document={denseMatrixDocument} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const DenseMatrixDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<AnalysisReader document={denseMatrixDocument} companyName="Entreprise de référence" onBack={() => undefined} />) };
