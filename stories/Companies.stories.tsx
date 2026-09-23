import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotionCompanies } from "../app/components/notion-companies";
import type { CompanyListItem } from "../app/lib/investment-data";
import { asyncState, desktopFrame, frame } from "./reference-frame";
import { company, emptyCompanies, reference } from "./reference-fixtures";

const completeCompany: CompanyListItem = {
  ...company,
  id: "company-complete",
  name: "Taiwan Semiconductor Manufacturing",
  ticker: "TSM",
  industry: "Semiconductors",
  researchReferences: [
    { ...reference, id: "business-complete", kind: "business", score: "93" },
    { ...reference, id: "valuation-complete", kind: "valuation", title: "Current Valuation Analysis", score: "58" },
    { ...reference, id: "short-complete", kind: "short", title: "Current Short Analysis", score: "", verdict: "Aucun short" },
    { ...reference, id: "portfolio-complete", kind: "portfolio", title: "Current Portfolio Analysis", score: "", verdict: "Conserver" },
    { ...reference, id: "memo-complete", kind: "memo", agent: "Investment Memo", title: "Current Investment Memo", score: "", status: "Validated", verdict: "Conserver" },
  ],
};

const meta = { title: "Reference screens/Companies", parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile" } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const completeWatchlistOnly = { ...completeCompany, id: "company-watchlist", name: "Aehr Test Systems", ticker: "AEHR", ownershipStatus: "Not owned" as const, watchlistMembership: true, monitoringStatus: "", researchReferences: [] };
const unclassified = { ...completeCompany, id: "company-unclassified", name: "Bloom Energy", ticker: "BE", ownershipStatus: "Not owned" as const, watchlistMembership: false, monitoringStatus: "", researchReferences: [] };
const companies = [completeCompany, completeWatchlistOnly, unclassified];
export const Companies: Story = { render: () => frame(<NotionCompanies initialData={{ companies }} openCompany={() => undefined} />) };
export const CompaniesDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<NotionCompanies initialData={{ companies }} openCompany={() => undefined} />) };
export const Long: Story = { render: () => frame(<NotionCompanies initialData={{ companies: [company, { ...unclassified, id: "company-long", name: "Lumentum Holdings — Optical Networking and Datacenter Infrastructure", ticker: "LITE" }] }} openCompany={() => undefined} />) };
export const LongDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<NotionCompanies initialData={{ companies: [company, { ...unclassified, id: "company-long-desktop", name: "Lumentum Holdings — Optical Networking and Datacenter Infrastructure", ticker: "LITE" }] }} openCompany={() => undefined} />) };
export const Empty: Story = { render: () => frame(<NotionCompanies initialData={emptyCompanies} openCompany={() => undefined} />) };
export const Loading: Story = { render: () => asyncState("Chargement des Companies…", "État de chargement de la base Companies Notion.") };
export const Error: Story = { render: () => asyncState("Base Companies indisponible", "Impossible de charger la base Companies pour le moment.") };
