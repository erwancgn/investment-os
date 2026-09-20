import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotionAnalyses } from "../app/components/notion-analyses";
import { frame, stateFrame } from "./reference-frame";
import { analysesData, emptyAnalysesData } from "./reference-fixtures";

const meta = { title: "Reference screens/Analyses", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Analyses: Story = { render: () => frame(<NotionAnalyses initialData={analysesData} />) };
export const Empty: Story = { render: () => frame(<NotionAnalyses initialData={emptyAnalysesData} />) };
export const Loading: Story = { render: () => stateFrame(<NotionAnalyses initialLoading />) };
export const Error: Story = { render: () => stateFrame(<NotionAnalyses initialError="La source des analyses est temporairement indisponible." />) };
