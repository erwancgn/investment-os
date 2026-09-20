import type { Meta, StoryObj } from "@storybook/react-vite";
import { LivePortfolioDashboard } from "../app/components/live-portfolio-dashboard";
import { frame } from "./reference-frame";
import { livePortfolio } from "./reference-fixtures";

const meta = { title: "Reference screens/Portfolio", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Exposure: Story = { render: () => frame(<LivePortfolioDashboard data={livePortfolio} loading={false} error="" onRefresh={() => undefined} openCompany={() => undefined} />) };
