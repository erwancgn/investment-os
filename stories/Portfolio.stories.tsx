import type { Meta, StoryObj } from "@storybook/react-vite";
import { LivePortfolioDashboard } from "../app/components/live-portfolio-dashboard";
import { TargetAllocation } from "../app/components/target-allocation";
import { PrimaryBlock } from "../app/components/ui-primitives";
import { desktopFrame, frame, stateFrame } from "./reference-frame";
import { livePortfolio } from "./reference-fixtures";

const dashboard = (data: typeof livePortfolio | null = livePortfolio, loading = false, error = "") => (
  <LivePortfolioDashboard data={data} loading={loading} error={error} onRefresh={() => undefined} openCompany={() => undefined} />
);

const meta = { title: "Reference screens/Portfolio", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => frame(dashboard()) };
export const Desktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(dashboard()) };
export const LongContent: Story = {
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: () => desktopFrame(<div className="storybook-stack"><TargetAllocation data={{ ...livePortfolio, targetLines: Array.from({ length: 10 }, (_, index) => ({ ...livePortfolio.targetLines[0], id: `target-${index}`, name: `Synthetic target company ${index + 1}` })) }} /><>{dashboard()}</></div>),
};
export const Empty: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => stateFrame(dashboard(null, false, "Aucune donnée de portefeuille disponible.")) };
export const Loading: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => stateFrame(dashboard(null, true)) };
export const Error: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => stateFrame(<PrimaryBlock as="section" className="live-portfolio-state" role="alert"><strong>Portefeuille indisponible</strong><span>Le service de cotation n’a pas répondu.</span><button type="button">Réessayer</button></PrimaryBlock>) };
