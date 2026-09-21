import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnalysisReader } from "../app/components/analysis-reader";
import { desktopFrame, frame } from "./reference-frame";
import { document } from "./reference-fixtures";

const meta = { title: "Reference screens/Reader", parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile" } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Reader: Story = { render: () => frame(<AnalysisReader document={document} companyName="Advanced Micro Devices" onBack={() => undefined} />) };
export const ReaderDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<AnalysisReader document={document} companyName="Advanced Micro Devices" onBack={() => undefined} />) };

