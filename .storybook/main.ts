import type { StorybookConfig } from "@storybook/react-vite";

const config = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: [],
  core: {
    builder: {
      name: "@storybook/builder-vite",
      options: { viteConfigPath: ".storybook/vite.config.ts" },
    },
  },
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
} satisfies StorybookConfig;

export default config;
