import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnalysisReader } from "../app/components/analysis-reader";
import { desktopFrame, frame } from "./reference-frame";
import { completeReferenceDocuments, document } from "./reference-fixtures";

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


export const Memo: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => frame(<AnalysisReader document={memoDocument} companyName="Advanced Micro Devices" onBack={() => undefined} />) };
export const MemoDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<AnalysisReader document={memoDocument} companyName="Advanced Micro Devices" onBack={() => undefined} />) };

export const Business: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.business} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const Valuation: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.valuation} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const Short: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.risques} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const PortfolioFit: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.portfolio} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const CIO: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.synthese} companyName="Entreprise de référence" onBack={() => undefined} />) };
export const Earnings: Story = { render: () => frame(<AnalysisReader document={completeReferenceDocuments.earnings} companyName="Entreprise de référence" onBack={() => undefined} />) };
