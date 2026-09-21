import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnalysisReader } from "../app/components/analysis-reader";
import { desktopFrame, frame } from "./reference-frame";
import { document } from "./reference-fixtures";

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
| Champ | Valeur |
| --- | --- |
| Action | Hold |
| Confiance | High |
| Prochaine revue | Après résultats |

## Raisonnement décisif
La qualité opérationnelle reste forte, mais le prix impose de conserver une marge de sécurité.

## État des modules
| Module | Statut |
| --- | --- |
| Business | Validated |
| Valuation | Current |
| Short | Current |
| Portfolio | Current |

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
