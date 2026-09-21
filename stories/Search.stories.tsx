import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentSearch } from "../app/components/document-search";
import { desktopFrame, frame } from "./reference-frame";

const meta = { title: "Reference screens/Search", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Search: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => frame(<DocumentSearch openCompany={() => undefined} />),
};

export const SearchDesktop: Story = {
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: () => desktopFrame(<DocumentSearch openCompany={() => undefined} />),
};
