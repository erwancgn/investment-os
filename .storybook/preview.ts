import { definePreview } from "@storybook/react-vite";
import "../app/design-system.css";
import "../stories/storybook.css";

export default definePreview({
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    viewport: {
      options: {
        mobile: { name: "Mobile", styles: { width: "390px", height: "844px" } },
        desktop: { name: "Desktop", styles: { width: "1440px", height: "900px" } },
      },
    },
  },
});
