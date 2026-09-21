/**
 * Canonical CSS source manifest.
 * Keep UX module order aligned with app/ux-foundations.css.
 */
export const uxCssFiles = [
  "app/styles/ux/portfolio.css",
  "app/styles/ux/discovery.css",
  "app/styles/ux/company.css",
  "app/styles/ux/analysis-reader.css",
  "app/styles/ux/shared-semantics.css",
  "app/styles/ux/documents.css",
  "app/styles/ux/workspaces.css",
  "app/styles/ux/shell.css",
  "app/styles/ux/shared-business.css",
];

export const appCssFiles = [...uxCssFiles, "app/globals.css"];
export const governanceCssFiles = [...appCssFiles, "stories/storybook.css"];
