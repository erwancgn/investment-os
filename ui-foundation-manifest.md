# UI foundation manifest

This manifest is the inventory of the production exports from
`app/components/ui-primitives.tsx`. It is intentionally limited to the 21
exported functions below. Storybook is the executable reference; Lovable is
the visual validation reference for the same contracts.

| # | Export | Role | Story coverage |
|---:|---|---|---|
| 1 | `Surface` | Semantic primary, secondary, or glass surface with nested-surface resolution. | `Foundations/Primitives — Surfaces`, `ReferencePage` |
| 2 | `ProgressBar` | Accessible bounded progress indicator. | `DataDisplay` |
| 3 | `SegmentedControl` | Toggle group for mutually exclusive filters or views. | `Controls`, `ReferencePage`, screen stories |
| 4 | `CompactControl` | Compact select or icon control for dense toolbars. | `ReferencePage` |
| 5 | `ActionButton` | Text action with a consistent trailing affordance. | `Controls`, `ReferencePage` |
| 6 | `DiscoveryAction` | Icon-only action for discovery cards with an accessible label. | `ReferencePage`, `Reference screens/Watchlist` |
| 7 | `BackButton` | Accessible compact navigation-back action. | `Controls` |
| 8 | `Badge` | Compact status, taxonomy, or state label. | `Controls`, `ReferencePage`, `DataDisplay` |
| 9 | `SearchField` | Shared search input with optional result count. | `Controls`, `ReferencePage`, screen stories |
| 10 | `SectionHeader` | Consistent section title, description, metadata, and actions. | `Controls`, `ReferencePage`, `Reference screens/Analyses` |
| 11 | `FilterBar` | Semantic layout container for filter controls. | `Controls`, `ReferencePage`, screen stories |
| 12 | `Tabs` | Keyboard-navigable tab selector. | `Controls` |
| 13 | `StatCard` | KPI card for a label, value, and supporting detail. | `DataDisplay`, `ReferencePage`, `Reference screens/Analyses` |
| 14 | `DiscoveryCard` | Shared production card shell for company, analysis, and watchlist discovery. | `ReferencePage`, screen stories |
| 15 | `AsyncState` | Explicit empty, loading, or error state surface. | `ContentStates`, screen state stories |
| 16 | `PrimaryBlock` | Primary semantic surface wrapper. | `Surfaces`, `ContentStates`, screen stories |
| 17 | `SecondaryBlock` | Secondary nested surface wrapper. | `Surfaces`, `DataDisplay` |
| 18 | `GlassChrome` | Glass surface wrapper reserved for navigation or floating chrome. | `Surfaces` |
| 19 | `DisclosureSurface` | Expandable details surface with a shared surface contract. | `ContentStates`, screen stories |
| 20 | `MetadataGrid` | Definition-list grid for structured metadata. | `DataDisplay` |
| 21 | `DataTable` | Accessible tabular data display using typed column renderers. | `DataDisplay` |

## Governance

The required order is:

`ui-primitives.tsx → ui-foundation-manifest.md → Storybook → Lovable`

No primitive is removed because it is absent from one visual example. A
removal requires proof of zero production imports or dynamic usage, zero
canonical or wrapper role, zero required story, zero responsive/state/
accessibility path, and green typecheck, lint, tests, Storybook, and CSS audit
after removal.

