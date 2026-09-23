# UI foundation manifest

This manifest is the inventory of the production exports from
`app/components/ui-primitives.tsx`. It is intentionally limited to the 20
exported functions below. Storybook is the executable reference; Lovable is
the visual validation reference for the same contracts.

| # | Export | Role | Story coverage |
|---:|---|---|---|
| 1 | `Surface` | Semantic primary, secondary, or glass surface with nested-surface resolution. | `Foundations/Primitives — Surfaces`, `Design System/Overview` |
| 2 | `ProgressBar` | Accessible bounded progress indicator. | `DataDisplay`, `Design System/Overview` |
| 3 | `SegmentedControl` | Toggle group for mutually exclusive filters or views. | `Controls`, `Design System/Overview`, screen stories |
| 4 | `CompactControl` | Compact select or icon control for dense toolbars. | `Controls`, `Design System/Overview`, Portfolio |
| 5 | `ActionButton` | Text action with a consistent trailing affordance. | `Controls`, `Design System/Overview`, screen stories |
| 6 | `BackButton` | Accessible compact navigation-back action. | `Controls`, `Design System/Overview`, Reader |
| 7 | `Badge` | Compact status, taxonomy, or state label. | `Badges / States`, `Design System/Overview`, screen stories |
| 8 | `SearchField` | Shared search input with optional result count. | `Controls`, `Design System/Overview`, screen stories |
| 9 | `SectionHeader` | Consistent section title, description, metadata, and actions. | `Controls`, `Design System/Overview`, screen stories |
| 10 | `FilterBar` | Semantic layout container for filter controls. | `Controls`, `Design System/Overview`, screen stories |
| 11 | `Tabs` | Keyboard-navigable tab selector. | `Controls`, `Design System/Overview`, Company |
| 12 | `StatCard` | KPI card for a label, value, and supporting detail. | `Data display`, `Design System/Overview`, screen stories |
| 13 | `DiscoveryCard` | Shared production card shell for the company directory. | `Discovery cards`, `Design System/Overview`, screen stories |
| 14 | `AsyncState` | Explicit empty, loading, or error state surface. | `Badges / States`, screen state stories |
| 15 | `PrimaryBlock` | Primary semantic surface wrapper. | `Surfaces`, `Design System/Overview`, screen stories |
| 16 | `SecondaryBlock` | Secondary nested surface wrapper. | `Surfaces`, `Design System/Overview`, Reader |
| 17 | `GlassChrome` | Glass surface wrapper reserved for navigation or floating chrome. | `Surfaces`, `Design System/Overview` |
| 18 | `DisclosureSurface` | Expandable details surface with a shared surface contract. | `Content states`, Reader, Company |
| 19 | `MetadataGrid` | Definition-list grid for structured metadata. | `Data display`, `Design System/Overview`, Reader |
| 20 | `DataTable` | Accessible tabular data display using typed column renderers. | `Data display`, `Design System/Overview`, Company |

## Governance

The required order is:

`ui-primitives.tsx → ui-foundation-manifest.md → Storybook → Lovable`

No primitive is removed because it is absent from one visual example. A
removal requires proof of zero production imports or dynamic usage, zero
canonical or wrapper role, zero required story, zero responsive/state/
accessibility path, and green typecheck, lint, tests, Storybook, and CSS audit
after removal.
