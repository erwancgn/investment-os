import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotionCompanies } from "../app/components/notion-companies";
import { asyncState, frame } from "./reference-frame";
import { company, emptyCompanies } from "./reference-fixtures";

const meta = { title: "Reference screens/Companies", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Companies: Story = { render: () => frame(<NotionCompanies initialData={{ companies: [company] }} openCompany={() => undefined} />) };
export const Empty: Story = { render: () => frame(<NotionCompanies initialData={emptyCompanies} openCompany={() => undefined} />) };
export const Loading: Story = { render: () => asyncState("Chargement des Companies…", "État de chargement de la base Companies Notion.") };
export const Error: Story = { render: () => asyncState("Base Companies indisponible", "Impossible de charger la base Companies pour le moment.") };
