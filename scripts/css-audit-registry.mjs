/**
 * Explicit dynamic-class registry for the CSS governance audit.
 *
 * This is intentionally narrow: every entry must identify the production
 * generator, the finite values it can emit, and why the CSS selector is live.
 * Do not add generic words without a production generator and, for state
 * selectors, a scoped selectorPattern proving where the value is consumed.
 */
export const dynamicClassRegistry = [
  {
    id: "surface-role",
    pattern: "^ui-surface(?:--(?:primary|secondary|glass))?$",
    source: "app/components/ui-primitives.tsx:Surface",
    reason: "Surface resolves the semantic role before composing the class.",
    values: ["ui-surface--primary", "ui-surface--secondary", "ui-surface--glass"],
  },
  {
    id: "progress-tone",
    pattern: "^ui-progress-track(?:--(?:accent|positive|neutral|warning))?$",
    source: "app/components/ui-primitives.tsx:ProgressBar",
    reason: "ProgressBar serializes its typed tone prop into a modifier class.",
    values: ["ui-progress-track--accent", "ui-progress-track--positive", "ui-progress-track--neutral", "ui-progress-track--warning"],
  },
  {
    id: "badge-tone",
    pattern: "^ui-badge(?:--(?:neutral|accent|positive|warning|negative))?$",
    source: "app/components/ui-primitives.tsx:Badge",
    reason: "Badge serializes its finite BadgeTone union into a modifier class.",
    values: ["ui-badge--neutral", "ui-badge--accent", "ui-badge--positive", "ui-badge--warning", "ui-badge--negative"],
  },
  {
    id: "discovery-card-kind",
    pattern: "^ui-discovery-card(?:--company)?$",
    source: "app/components/ui-primitives.tsx:DiscoveryCard",
    reason: "DiscoveryCard serializes its typed kind prop into a modifier class.",
    values: ["ui-discovery-card--company"],
  },
  {
    id: "analysis-scenario",
    pattern: "^analysis-scenario-(?:bear|base|bull)$",
    source: "app/components/analysis-reader.tsx:AnalysisSection",
    reason: "The reader serializes the validated scenario value from the analysis document.",
    values: ["analysis-scenario-bear", "analysis-scenario-base", "analysis-scenario-bull"],
  },
  {
    id: "company-reference-kind",
    pattern: "^reference-(?:business|valuation|short|portfolio|memo)$",
    source: "app/components/notion-companies.tsx:referenceOrder",
    reason: "The Companies screen serializes the finite referenceOrder values into modifiers.",
    values: ["reference-business", "reference-valuation", "reference-short", "reference-portfolio", "reference-memo"],
  },
  {
    id: "analysis-priority-fact",
    pattern: "^analysis-key-fact--priority$",
    source: "app/components/analysis-presentation.tsx:isPriorityPresentationFact",
    reason: "The presentation layer applies this explicit class to priority facts in the production analysis reader.",
    values: ["analysis-key-fact--priority"],
  },
  {
    id: "notion-table-column-count",
    pattern: "^notion-table-two-column$",
    source: "app/components/notion-table.tsx:columnCount",
    reason: "The Notion table renderer emits this explicit class when the rendered table has two columns.",
    values: ["notion-table-two-column"],
  },
];

export function dynamicClassEntry(className) {
  return dynamicClassRegistry.find(entry => new RegExp(entry.pattern).test(className));
}
