import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotionAnalyses } from "../app/components/notion-analyses";
import { desktopFrame, frame, stateFrame } from "./reference-frame";
import { analysesData, emptyAnalysesData } from "./reference-fixtures";

const meta = { title: "Reference screens/Analyses", parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile" } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Analyses: Story = { render: () => frame(<NotionAnalyses initialData={analysesData} />) };
export const AnalysesDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<NotionAnalyses initialData={analysesData} />) };
const longAnalysesData = { documents: [...analysesData.documents, ...analysesData.documents.map((item, index) => ({ ...item, id: `doc-long-${index}`, title: `${item.title} — Detailed operating, valuation and portfolio review with a deliberately long title`, plainText: `${item.plainText} Long synthetic content used to verify wrapping and scanning on both mobile and desktop layouts.` }))], counts: { analyses: 8, earnings: 3, portfolio: 2, decisions: 2 } };
export const Long: Story = { render: () => frame(<NotionAnalyses initialData={longAnalysesData} />) };
export const LongDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<NotionAnalyses initialData={longAnalysesData} />) };
export const Empty: Story = { render: () => frame(<NotionAnalyses initialData={emptyAnalysesData} />) };
export const Loading: Story = { render: () => stateFrame(<NotionAnalyses initialLoading />) };
export const Error: Story = { render: () => stateFrame(<NotionAnalyses initialError="La source des analyses est temporairement indisponible." />) };
