import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotionWatchlist } from "../app/components/notion-watchlist";
import { asyncState, desktopFrame, frame } from "./reference-frame";
import { emptyWatchlist, watchlist } from "./reference-fixtures";

const meta = { title: "Reference screens/Watchlist · Radar", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const radarReference = {
  ...watchlist,
  items: [
    {
      ...watchlist.items[0],
      id: "radar-long-thesis",
      name: "Advanced Micro Devices — Accelerated Computing",
      ticker: "AMD",
      decision: "",
      conviction: "High",
      themes: ["AI infrastructure", "Semiconductors", "Data center", "Quality"],
      thesis: "La demande en accélérateurs soutient la croissance, avec une exécution produit encore à confirmer sur les prochaines générations.",
    },
    {
      ...watchlist.items[0],
      id: "radar-missing-decision",
      name: "AIXTRON",
      ticker: "AIXA",
      decision: "",
      conviction: "",
      analysisDate: "",
      themes: ["Semiconductors", "Advanced Packaging"],
      thesis: "Business Check v2 exact skill : Very Good, 81/100, moat process fort et exposition photonique IA.",
    },
  ],
} satisfies typeof watchlist;

export const Watchlist: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => frame(<NotionWatchlist initialData={radarReference} openCompany={() => undefined} />),
};
export const WatchlistDesktop: Story = {
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: () => desktopFrame(<NotionWatchlist initialData={radarReference} openCompany={() => undefined} />),
};
export const Empty: Story = { render: () => frame(<NotionWatchlist initialData={emptyWatchlist} openCompany={() => undefined} />) };
export const Loading: Story = { render: () => asyncState("Chargement du Radar…", "État de chargement de la source Watchlist Notion.") };
export const Error: Story = { render: () => asyncState("Watchlist Notion indisponible", "Impossible de synchroniser le Radar pour le moment.") };
