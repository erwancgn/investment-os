import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotionCompanies } from "../app/components/notion-companies";
import { asyncState, desktopFrame, frame } from "./reference-frame";
import { company, emptyCompanies } from "./reference-fixtures";

const meta = { title: "Reference screens/Companies", parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile" } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Companies: Story = { render: () => frame(<NotionCompanies initialData={{ companies: [company] }} openCompany={() => undefined} />) };
export const CompaniesDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<NotionCompanies initialData={{ companies: [company] }} openCompany={() => undefined} />) };
export const Long: Story = { render: () => frame(<NotionCompanies initialData={{ companies: [company, { ...company, id: "company-long", name: "Lumentum Holdings — Optical Networking and Datacenter Infrastructure", ticker: "LITE", ownershipStatus: "Not owned", watchlistMembership: false, monitoringStatus: "", decision: "", researchReferences: [] }] }} openCompany={() => undefined} />) };
export const LongDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<NotionCompanies initialData={{ companies: [company, { ...company, id: "company-long-desktop", name: "Lumentum Holdings — Optical Networking and Datacenter Infrastructure", ticker: "LITE", ownershipStatus: "Not owned", watchlistMembership: false, monitoringStatus: "", decision: "", researchReferences: [] }] }} openCompany={() => undefined} />) };
export const Empty: Story = { render: () => frame(<NotionCompanies initialData={emptyCompanies} openCompany={() => undefined} />) };
export const Loading: Story = { render: () => asyncState("Chargement des Companies…", "État de chargement de la base Companies Notion.") };
export const Error: Story = { render: () => asyncState("Base Companies indisponible", "Impossible de charger la base Companies pour le moment.") };
