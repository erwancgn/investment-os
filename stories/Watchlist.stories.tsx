import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotionWatchlist } from "../app/components/notion-watchlist";
import { asyncState, frame } from "./reference-frame";
import { emptyWatchlist, watchlist } from "./reference-fixtures";

const meta = { title: "Reference screens/Watchlist · Radar", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Watchlist: Story = { render: () => frame(<NotionWatchlist initialData={watchlist} openCompany={() => undefined} />) };
export const Empty: Story = { render: () => frame(<NotionWatchlist initialData={emptyWatchlist} openCompany={() => undefined} />) };
export const Loading: Story = { render: () => asyncState("Chargement du Radar…", "État de chargement de la source Watchlist Notion.") };
export const Error: Story = { render: () => asyncState("Watchlist Notion indisponible", "Impossible de synchroniser le Radar pour le moment.") };
