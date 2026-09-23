import type { Meta, StoryObj } from "@storybook/react-vite";
import { PortfolioPageHeader } from "../app/components/app-page-header";
import { LivePortfolioDashboard } from "../app/components/live-portfolio-dashboard";
import { TargetAllocation } from "../app/components/target-allocation";
import { PrimaryBlock } from "../app/components/ui-primitives";
import { desktopFrame, frame, stateFrame } from "./reference-frame";
import { livePortfolio, targetAllocationStates } from "./reference-fixtures";

const dashboard = (data: typeof livePortfolio | null = livePortfolio, loading = false, error = "") => (
  <>
    <PortfolioPageHeader
      quoteAsOf="2026-09-22T15:17:00.000Z"
      loading={loading}
      onRefresh={() => undefined}
      onOpenManagement={() => undefined}
    />
    <LivePortfolioDashboard
      data={data}
      loading={loading}
      error={error}
      onRefresh={() => undefined}
      openCompany={() => undefined}
      beforeDiagnostic={<TargetAllocation data={data} />}
    />
  </>
);

const meta = { title: "Reference screens/Portfolio", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => frame(dashboard()) };
export const TargetAllocationStates: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => frame(<><PortfolioPageHeader quoteAsOf="2026-09-22T15:17:00.000Z" loading={false} onRefresh={() => undefined} onOpenManagement={() => undefined}/><TargetAllocation data={targetAllocationStates}/></>),
};
export const Desktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(dashboard()) };
export const LongContent: Story = {
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: () => desktopFrame(dashboard({
    ...livePortfolio,
    targetLines: Array.from({ length: 10 }, (_, index) => ({
      ...livePortfolio.targetLines[0],
      id: `target-${index}`,
      name: `Synthetic target company ${index + 1}`,
    })),
  })),
};
export const Empty: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => stateFrame(dashboard(null, false, "Aucune donnée de portefeuille disponible.")) };
export const Loading: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => stateFrame(dashboard(null, true)) };
export const Error: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => stateFrame(<PrimaryBlock as="section" className="live-portfolio-state" role="alert"><strong>Portefeuille indisponible</strong><span>Le service de cotation n’a pas répondu.</span><button type="button">Réessayer</button></PrimaryBlock>) };
