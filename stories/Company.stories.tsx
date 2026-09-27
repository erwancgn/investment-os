import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CompanyDetail } from "../app/components/company-detail";
import { OpenAnalysisContext } from "../app/lib/app-navigation";
import { desktopFrame, frame, tabletFrame } from "./reference-frame";
import { company, companyDetail, completeCompanyDetail, tsmcCompanyDetail } from "./reference-fixtures";

const meta = { title: "Reference screens/Company", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveDossier({ desktop = false, selectedDocument = null, initialData = completeCompanyDetail }: { desktop?: boolean; selectedDocument?: string | null; initialData?: typeof completeCompanyDetail }) {
  const [activeDocument, setActiveDocument] = useState<string | null>(selectedDocument);
  const dossier = <OpenAnalysisContext value={setActiveDocument}>
    <CompanyDetail companyId={initialData.id} selectedAnalysisId={activeDocument} initialData={initialData} close={() => setActiveDocument(null)} />
  </OpenAnalysisContext>;
  return desktop ? desktopFrame(dossier) : frame(dossier);
}

export const Company: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => frame(<CompanyDetail companyId={company.id} initialData={companyDetail} close={() => undefined} />) };
export const CompanyDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<CompanyDetail companyId={company.id} initialData={companyDetail} close={() => undefined} />) };
export const CompleteDossier: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => <InteractiveDossier /> };
export const CompleteDossierDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => <InteractiveDossier desktop /> };
export const EmbeddedValuation: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => <InteractiveDossier selectedDocument="ref-valuation" /> };
export const EmbeddedValuationDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => <InteractiveDossier desktop selectedDocument="ref-valuation" /> };
export const EmbeddedValuationTablet: Story = { parameters: { viewport: { defaultViewport: "tablet" } }, render: () => tabletFrame(<InteractiveDossier selectedDocument="ref-valuation" />) };
export const EmbeddedBusiness: Story = { render: () => <InteractiveDossier selectedDocument="ref-business" /> };
export const EmbeddedShort: Story = { render: () => <InteractiveDossier selectedDocument="ref-risques" /> };
export const EmbeddedPortfolioFit: Story = { render: () => <InteractiveDossier selectedDocument="ref-portfolio" /> };
export const EmbeddedEarnings: Story = { render: () => <InteractiveDossier selectedDocument="ref-earnings" /> };
export const EmbeddedTSMCValuation: Story = { render: () => <InteractiveDossier initialData={tsmcCompanyDetail} selectedDocument="ref-tsmc-valuation" /> };
