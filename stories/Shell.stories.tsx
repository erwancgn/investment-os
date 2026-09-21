import type { Meta, StoryObj } from "@storybook/react-vite";
import Home from "../app/page";

const meta = { title: "Reference screens/Shell", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <Home />,
};

export const Desktop: Story = {
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: () => <Home />,
};
