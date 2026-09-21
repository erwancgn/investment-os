# Lovable design system visible contract

## Règle de vérité

Lovable est la spécification visuelle visible : il montre les surfaces, la hiérarchie,
les états, les proportions et les compositions à arbitrer. Storybook est l’exécution
vérifiable : il rend les composants de production avec des fixtures synthétiques. Le
code est l’implémentation : il porte l’API React, les tokens, le markup et
l’accessibilité.

En cas d’écart, on ouvre un diff visuel et on arbitre explicitement. On ne corrige pas
un écart en ajoutant un override local ou une seconde primitive.

## Contrat des tokens canoniques

Les tokens ci-dessous sont les seuls points de référence visuels pour les primitives,
les écrans de production et Storybook. Ils sont définis dans le bloc `:root` de
`app/globals.css`. Cette documentation référence les noms de tokens ; elle ne recopie
aucune valeur de couleur, de police ou d’effet afin d’éviter une seconde source de
vérité.

| Famille | Tokens gagnants | Règle d’usage |
|---|---|---|
| Police | `--font-family-sans`, `--font-geist-mono` | Le texte UI utilise `--font-family-sans`; le monospace est réservé aux données qui le nécessitent. |
| Couleurs sémantiques | `--color-bg`, `--color-bg-elevated`, `--color-surface`, `--color-surface-raised`, `--color-surface-active`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-accent`, `--color-accent-strong`, `--color-positive`, `--color-negative`, `--color-warning`, `--color-info`, `--color-violet`, `--color-content-copy` | Les composants consomment les rôles sémantiques ; aucune couleur littérale ne doit être ajoutée dans une primitive. |
| Surfaces | `--surface-canvas`, `--surface-primary`, `--surface-secondary`, `--surface-glass`, `--surface-glass-fallback`, `--surface-stroke`, `--surface-stroke-strong`, `--surface-highlight`, `--surface-blur` | `Surface` et ses wrappers déterminent la hiérarchie primaire, secondaire et glass. |
| Rayons | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill` | Les rayons sont choisis par rôle ; une nouvelle valeur locale doit être justifiée dans le contrat. |
| Ombres | `--surface-shadow`, `--surface-shadow-glass`, `--shadow-panel` | Une surface ne redéfinit pas son ombre localement pour corriger une divergence visuelle. |
| Contrôles | `--control-height`, `--ui-control-height`, `--ui-control-hit-height`, `--ui-control-contained-height`, `--ui-control-radius`, `--ui-discovery-action-visual-size`, `--ui-progress-track`, `--ui-progress-accent`, `--ui-progress-positive`, `--ui-progress-warning`, `--ui-progress-height` | Les contrôles compacts, les segments et les actions utilisent ces tokens communs ; le hit target peut être supérieur à la hauteur visuelle. |

La police et les couleurs visibles dans Lovable doivent donc être comparées à ces
tokens de l’application actuelle. Lovable n’introduit pas de valeur concurrente :
il sert à valider la composition et l’apparence, tandis que le code reste la source
exécutable.

## Référence Lovable vérifiée

La référence active est le projet `Compact Controls Test`, identifié par
`52184df3-fbae-4c28-898f-d379409b03bd`. Le connecteur Lovable expose actuellement le
commit `75074e4d9b984ae9a72ee0dcc1cf7f6b990b1912`, qui remplace la référence précédemment
documentée `852fd99aae56a16aeaa47163aca3b426d8784b1d`.

- Le dernier changement Lovable étend explicitement la cible tactile des contrôles compacts
  et des actions de Discovery Card, et autorise le titre de carte sur deux lignes.
- Les tokens de couleur et la pile de police visibles restent alignés avec les tokens
  canoniques de production.
- Quatre écarts visuels restent à arbitrer avant synchronisation finale sur le shell
  Discovery Card : padding (production 16 px, référence Lovable 14 px), taille du titre
  Company/Analysis/Watchlist (production `--font-lg`, soit 20 px dans la baseline actuelle,
  référence Lovable 15 px), rayon (production `--radius-md`, soit 12 px, référence Lovable
  16 px) et ombre (production `--surface-shadow`, plus marquée, référence Lovable
  `0 1px 3px` très légère).
- Aucun de ces écarts ne doit être corrigé par un override local : l'arbitrage doit
  modifier le contrat canonique ou la référence Lovable, puis être vérifié dans Storybook.

La source Lovable expose notamment `src/components/CompactControl.tsx`,
`src/components/CompanyDiscoveryCard.tsx` et `src/routes/index.tsx`. Le projet
Lovable contient une page de référence visuelle et des composants de démonstration ;
il ne remplace pas les composants React de production du checkout.

## Mapping Lovable → React → Storybook

Les valeurs visuelles restent dans les tokens canoniques nommés ; cette table ne
recopie aucune valeur CSS. Une ligne correspond à un contrat visuel ; `DiscoveryCard`
apparaît donc trois fois pour documenter explicitement ses variantes `company`,
`watchlist` et `analysis`, sans créer trois exports React.

| Référence Lovable | Export React | Classe racine | Story / états vérifiés |
|---|---|---|---|
| Primary / secondary / glass surface | `Surface` | `.ui-surface` | `Foundations/Primitives — Surfaces`, `Design System/Overview` / trois rôles, nesting |
| Progress indicator | `ProgressBar` | `.ui-progress-track` | `DataDisplay`, `Design System/Overview` / accent, positive, bounded value |
| Segmented filters | `SegmentedControl` | `.ui-control-group` | `Controls`, `Design System/Overview` / actif, contenu, clavier |
| Compact select / icon | `CompactControl` | `.ui-compact-control` | `Controls`, `Design System/Overview`, Portfolio / select, icon, disabled |
| Text action | `ActionButton` | `.ui-action-button` | `Controls`, `Design System/Overview` / normal, compact, focus |
| Discovery affordance | `DiscoveryAction` | `.ui-discovery-action` | `Controls`, `Design System/Overview`, Radar / icon-only, accessible label |
| Back navigation | `BackButton` | `.ui-back-button` | `Controls`, Reader / normal, focus, accessible label |
| Badge / state | `Badge` | `.ui-badge` | `Badges / States`, `Design System/Overview` / neutral, accent, positive, warning, negative |
| Search toolbar | `SearchField` | `.ui-search-toolbar` | `Controls`, `Design System/Overview`, screen stories / empty, query, count |
| Section heading | `SectionHeader` | `.ui-section-header` | `Controls`, `Design System/Overview`, screen stories / h1, h2, metadata |
| Filter container | `FilterBar` | `.ui-filter-bar` | `Controls`, `Design System/Overview`, screen stories / labelled group |
| Tabs | `Tabs` | `.ui-tabs` | `Controls`, Company / active, arrow navigation, Home/End |
| KPI card | `StatCard` | `.ui-stat-card` | `Data display`, `Design System/Overview`, Analyses / normal, long value |
| Company discovery card | `DiscoveryCard` | `.ui-discovery-card--company` | Companies, `Design System/Overview`, `Design System/ProductionVisualReview` / normal, long, empty |
| Radar discovery card | `DiscoveryCard` | `.ui-discovery-card--watchlist` | Radar, `Design System/Overview`, `Design System/ProductionVisualReview` / decision, themes, thesis |
| Analysis discovery card | `DiscoveryCard` | `.ui-discovery-card--analysis` | Analyses, `Design System/Overview`, `Design System/ProductionVisualReview` / current, long, empty |
| Async state | `AsyncState` | `.ui-async-state` | `Badges / States`, screen state stories / empty, loading, error |
| Primary block | `PrimaryBlock` | `.ui-surface--primary` | Surfaces, `Design System/Overview`, screen stories / semantic wrapper |
| Secondary block | `SecondaryBlock` | `.ui-surface--secondary` | Surfaces, `Design System/Overview`, Reader / nested content |
| Floating glass chrome | `GlassChrome` | `.ui-surface--glass` | Surfaces, `Design System/Overview` / chrome role |
| Disclosure details | `DisclosureSurface` | `.ui-disclosure-surface` | Content states, Reader, Company / closed, open |
| Metadata definition list | `MetadataGrid` | `.ui-metadata-grid` | Data display, `Design System/Overview`, Reader / labelled list |
| Data table | `DataTable` | `.ui-data-table-wrap` | Data display, `Design System/Overview`, Company / headers, rows, responsive labels |

## Accès et arbitrage

Le connecteur Lovable est utilisé pour synchroniser puis vérifier le projet, ses
sources et son commit de référence. Storybook reste la vérification reproductible
locale ; il ne remplace pas la validation visuelle Lovable.
