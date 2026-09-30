# Investment OS — Lot 1 : Debt Map

Audit du 30 septembre 2026, source `8f17952e2c8ca0f438227692a01bc8bacf99f2b2`, arbre applicatif Sites v207. Branche `chore/architecture-stabilization-mcp`. **Aucun changement applicatif, CSS, dépendance, données ou déploiement.** La [baseline](baseline.md) reste la référence, mobile first.

Trois agents Luna ont inventorié séparément renderer/parsing, données/cache et UI/tests. L'orchestrateur a relu les chemins critiques et arbitré les classifications ci-dessous. Les inventaires et sorties brutes restent locaux dans `outputs/lot1/`. Le [catalogue d'évidence](debt-evidence.json) versionne les 216 regex littérales des sources TS/TSX, trois constructions dynamiques et les 461 déclarations nommées inspectées sur 64 fichiers du programme TypeScript. Il inclut les stories/configurations ; les tests JavaScript ont été recherchés séparément. Les comptes de références incluent les déclarations/imports et ne constituent pas seuls une preuve de code mort.

## Décisions de classement

**KEEP** : réutiliser le comportement/contrat existant, préserver ses consommateurs. **REFACTOR** : chemin actif à simplifier ou corriger, remplacement et tests requis avant retrait. **DELETE** : élément sans consommateur démontré dans ce dépôt ; suppression planifiée au lot de nettoyage, pas exécutée ici. La classe d'un module n'ordonne pas de réécrire chaque helper ; les sous-parties à conserver sont explicitées. Aucun lecteur complet, parser complet, composant de table ou feuille CSS n'est classé DELETE.

Les priorités de revue ne sont pas un nouvel ordre de lots : P0 = fiabilité/intégrité, P1 = déterminisme et convergence, P2 = maintenance. Les décisions d'architecture cible restent au Lot 2.

## Constats vérifiés qui changent la suite

| Priorité | Dette | Preuve et conséquence | Classe |
| --- | --- | --- | --- |
| P0 | Échecs mémoire du Worker | Logs v207 dans la baseline : `exceededMemory` sur Analysis, Company, Basket, Portfolio. `getCompanyDetail` lit tous les corps avant filtrage (`investment-data.ts:394-423`), `getResearchDocument` aussi (`:472-482`). La requête ciblée reste proportionnelle au corpus. L'allocation responsable n'est pas profilée. | REFACTOR lectures/fanout ; conserver auth et données |
| P0 | Parsing structuré partiel accepté | Sonde locale reproduite par l'orchestrateur : paragraph supporté + `to_do` important → seul paragraph retourné ; le texte de secours contient pourtant le `to_do`. `notion-block-parser.ts:48-107`, dispatcher `notion-renderer.ts:149-151`. | REFACTOR couverture et diagnostic du fallback |
| P0 | Détection des résidus incomplète | `hasResidualMarkup` (`notion-renderer.ts:74`) n'inspecte que `text`. Sondes list.items avec `<div>` et table.rows avec `<td>` → false. Aucun déclenchement du secours pour ces champs. | REFACTOR |
| P0 | Politique Current/archive dispersée | Propriétés Current, agents, noms/titres, freshness/date et archives interviennent à plusieurs niveaux : `investment-data.ts:79-149,158-217,373-455`, `company-detail.tsx:188-249`. La sélection de fiche reclasse encore les candidats. Le tie-break de `buildArchivePolicy` ne compare que Current de `b`, pas celui de `a`. | REFACTOR règle unique et ordre total déterministe |
| P1 | Deux rendus de corps actifs | Standard (`analysis-reader.tsx:193-219`) et `MemoBlock` (`investment-memo-reader.tsx:87-125`) dispatchent séparément les mêmes types. Ils partagent déjà sections/table/hero. | REFACTOR convergence ; garder présentation CIO |
| P1 | Numéros de citations incohérents | `analysis-presentation.tsx:85-90` numérote selon l'ordre d'origine ; `:111,141` trie les sources par date puis renumérote. Sonde SSR avec deux sources inversées : citation `[1]` vers old, source old affichée `[2]`. L'ancre ID reste correcte. | REFACTOR ordre/numérotation partagé |
| P1 | Erreurs HTTP aplaties | `resource-cache.ts:49-62` distingue auth mais tous les autres statuts deviennent « Actualisation indisponible ». Company/Analysis n'ont pas de catch de route ; Basket/Portfolio convertissent en 502. Le diagnostic HTTP/schema/provider doit survivre au message UX. | REFACTOR enveloppe d'erreurs |
| P1 | Présentation calculée plusieurs fois | Import et lecture vérifient le payload ; preview parse/extrait avant d'effacer les corps ; le client parse à nouveau et peut préférer une projection que le preview n'utilise pas. `notion-sync.ts:747`, `investment-data.ts:350-358`, `company-preview.ts:7-21`, lecteurs. | REFACTOR responsabilité/coût ; KEEP vérification d'intégrité |
| P2 | Portabilité des gates | Wrapper build exige GNU timeout ; un test utilise URL.pathname encodé ; lint a deux findings existants. Baseline fournit les échecs et contournements de mesure. | REFACTOR scripts/test-path et lint, sans modifier les seuils |
| P2 | Documentation historique périmée | `docs/architecture.md` parle encore de Portfolio fichiers structurés et de D1 index futur ; le runtime utilise déjà snapshots/index/Portfolio D1. `docs/analysis-rendering-contract.md` nomme « lot 0 » d'un chantier antérieur. | REFACTOR docs au Lot 2/9 ; conserver historique identifié |

Les sondes sont de petits exercices locaux, hors suite permanente : `outputs/lot1/parser-probes.json` et `citation-probe.json`. Elles prouvent les comportements construits ; elles ne mesurent pas leur fréquence dans les snapshots privés. Aucun accès aux secrets ou mutation Notion n'a été réalisé.

## Renderer, parsing et normalisation

Comptage explicite : **un point d'entrée AnalysisReader, deux lecteurs de rapports**, **un dispatcher parseNotionDocument, deux parseurs de format** (Notion structuré et texte HTML/Markdown). Les deux formats sont réellement nécessaires aujourd'hui ; ce n'est pas la preuve de deux parseurs obsolètes. La projection structurée enrichit le résumé, elle ne remplace pas le corps documentaire. Périmètre des 16 modules lecteurs/format : 1 981 lignes physiques, pas 1 981 lignes supprimables.

| Module / sous-chemin | Consommateurs et rôle | Décision |
| --- | --- | --- |
| `app/components/analysis-reader.tsx:121` | CompanyAnalysisDocument et DocumentView ; dispatch source analyses+synthese ou agent/titre Memo → CIO, sinon Standard | REFACTOR critère explicite de type ; KEEP point d'entrée |
| StandardAnalysisReader, même fichier `:128` | Parsing, projection validée ou présentation legacy, valuation, hidden indexes, blocs/sources | REFACTOR orchestration et rendu commun |
| DecisionTemplate, même fichier `:43-119,192` | Source `decisions`, `DecisionFields` issus de propriétés Notion ; distinct du CIO documentaire | REFACTOR mapping vers décision canonique ; ne pas supprimer cette source |
| `investment-memo-reader.tsx:127` | Appelé par AnalysisReader ; Decision Card, raisonnement, modules/handoffs, âge >45 j, source | REFACTOR duplication du corps ; KEEP sémantique CIO sans score |
| Memo `sectionRange/firstTable/twoColumnFacts/blockText:38-85` | Extrait sections/table 2 colonnes, retire score/note, garde modules et reasoning | REFACTOR heuristique pilotée par type ; KEEP protections score/note et traçabilité |
| `document-view.tsx:7` | Import lazy `app/page.tsx:21`, route document sans Company `:90` | KEEP wrapper de route actif, pas renderer parallèle |
| `company-analysis-document.tsx:8` | CompanyDetail ; fetch complet, identité normalisée et corps vérifiés, ancien contenu conservé | KEEP garde/UX ; REFACTOR types preview/full et erreur |
| `notion-block-parser.ts:14,48,110` | `parseNotionDocument` ; annotations, liens, listes contiguës, tableaux et enfants → RenderBlock | REFACTOR couverture/perte partielle ; KEEP format de bloc et annotations |
| `notion-renderer.ts:149` | Lecteurs, preview, LatestInfoCard ; choisit structured non vide sans résidu, sinon texte | REFACTOR condition et diagnostic, sans second dispatcher |
| `notion-renderer.ts:17-101` | decodeHtmlEntities, textOnly, htmlTables, htmlCallouts, extractContent, normalizeNotionText | REFACTOR nettoyage explicite/pertes ; KEEP compatibilité HTML historique vérifiée |
| `notion-renderer.ts:103-147` | parseNotionText : headings, quotes/callouts, listes, pipes, paragraphes | REFACTOR contrat de format ; KEEP secours historique, pas suppression immédiate |
| `inline-format.ts:3-41` | Deux lecteurs, sections, projections et facts ; emphase HTML/Markdown, liens/code, plainInlineText | KEEP helper partagé ; REFACTOR syntaxe/support selon cas de corpus, pas nouveau processeur |
| `document-presentation.ts:7-105` | Catégories, priorité facts, summary headings, Intl.Segmenter, fallback handoff CIO | REFACTOR heuristique vers contrat ; KEEP ordre métier et restitution historique |
| `document-presentation.ts:108-212` | documentPresentation, factsFromText/Table, hidden indexes, Run Receipt, suppression de tables promues | REFACTOR séparation extraction/vue ; KEEP indices source et corps non muté |
| `valuation-summary.ts:12-160` | Standard valuation et Memo ; scénarios ligne/colonne/prose, seuils, cours/date, ambiguity/conflicts | REFACTOR normalisation déterministe ; KEEP protections ambiguïté/devise et provenance d'index |
| `presentation-projection.ts:99,164,196,217,229` | Import, mapping D1, lecteurs et tests ; validate/extract, hash rapport/preuves/freshness, filtre bloc machine | KEEP validation fail-closed versionnée ; REFACTOR frontière/coût, pas validation concurrente |
| `analysis-presentation.tsx:14-78` | Hero et fact grid communs aux deux lecteurs | KEEP primitives de présentation |
| AnalysisProjectionSummary/projectionCitations, même fichier `:85-147` | Projection validée ; facts/scenarios/seuils connus, sources triées/citations | REFACTOR numérotation ; KEEP états known/unknown et lien evidence |
| ProjectionStatusNotice, même fichier `:149` | Projection invalid : source encore lisible ; absent : legacy | KEEP notice et comportement explicitement documenté |
| `analysis-section-groups.tsx:14-115` | Deux lecteurs ; H1 parent, H2 disclosure, H3+ dans contenu ; native details, open count/focus, facts | KEEP accordéons/accessibilité ; REFACTOR promotion implicite de 3 paragraphes Label:valeur |
| `notion-table.tsx:11` + `table-presentation.ts:6` | Deux lecteurs ; header, numérique, scroll accessible pour densité ; exceptions scénarios/seuils | KEEP composant/prédicat partagé ; REFACTOR règles de densité si le nouveau modèle les remplace |
| `scenario-comparison.tsx:6` | Deux lecteurs ; Base vs objectif12%, scénarios/seuils adaptatifs, prix non live explicites | KEEP vue ; REFACTOR entrée typée et calcul depuis strings |
| `decision-label.ts:3-60` | Company, Companies, LatestInfoCard et lecteurs ; action ordonnée, date UTC, score /100, type | KEEP format partagé ; REFACTOR vocabulaire catégories cohérent avec contrats |
| `latest-info-card.tsx:9-27` | CompanyDetail, previewSummaryItems ou parse/extraction de secours | REFACTOR extraction répétée ; KEEP composition |
| `company-detail.tsx:188-389` | Shell SPA ; fusion/dedup/groupes, Current memo, synthèse, lecteur actif et archives | REFACTOR sélection métier côté client ; KEEP identité/onglets et largeur mobile |

Deux doublons locaux exacts sont prouvés : wrappers `inline()` (Standard20-23/Memo24-27) et `shortDate()` (Standard25-32/Memo29-36). **REFACTOR**, puis retirer les copies lorsque les consommateurs utilisent le helper choisi. Ce sont des fonctions actives, pas du code mort. Aucune condition par ticker/issuer repérée dans parser/presentation/valuation ; les fixtures Advantest/TSMC/Amazon sont des données testées.

### Catalogue des regex et processeurs

Le catalogue d'évidence donne chaque expression, fichier et ligne. Familles sur le chemin renderer : Notion structuré **1** littérale ; HTML/texte **42** ; inline **15** ; présentation **25** + construction dynamique de libellés échappés ; valuation **39** ; décision **14** ; densité table **6** + template taux ; projection **11** + support numérique échappé ; Standard **8**, Memo **5**, sections **1**, table **1**, scénario **2**, Company **8**, LatestInfo **1**. Les autres regex du catalogue concernent mapping, quotes ou UI adjacente. Pas de bibliothèque Markdown séparée appelée sur ce chemin.

KEEP : syntaxes actuelles effectivement consommées et protections de données. REFACTOR : détection métier/masquage/extraction des nombres depuis prose, nettoyage HTML par substitutions, critères de secours. DELETE : **aucune famille entière** sans preuve de remplacement. Un nombre élevé de regex ne démontre pas qu'elles sont inutiles.

### Fallbacks actifs, à préserver jusqu'à convergence prouvée

| Condition / chemin | Effet réel | Classe / condition de retrait |
| --- | --- | --- |
| Structured vide ou résidu `text` | Parser texte global ; résidus list/table et type ignoré ne déclenchent pas ce chemin | REFACTOR critère complet/diagnostic ; conserver format texte tant que snapshots historiques l'exigent |
| Projection absente/invalide | Source reste affichée ; legacy summary/facts/scenarios ; notice invalid | KEEP fail-closed ; REFACTOR traitement explicite version/erreur |
| Résumé absent | Section TLDR, intro, propriété, handoff CIO selon ordre/document ; humanisation dernier recours | REFACTOR contrat, pas suppression silencieuse de contenu |
| Fact/KPI heuristique | Table2colonnes, libellés fixe, grille6facts ou séquence3paragraphes ; projection connue prioritaire | REFACTOR extraction unique ; garder original et indices |
| Scénarios/seuils ambigus | Écarte promotion mais laisse les tables/prose source ; Memo ne promeut que 3scénarios complets | KEEP protection ; REFACTOR résultat explicite de normalisation |
| Erreur fetch/refresh | Sans corps : indisponible+relance ; corps précédent valide : conservé, message de refresh | KEEP comportement cache-first existant ; REFACTOR catégorie d'erreur |
| Relations absentes/legacy | Matching nom/titre/ticker et propriétés historiques ; corpus courant et historique peuvent diverger | REFACTOR adapter/politique ; supprimer seulement après migration/mesure des usages |

## Data access, mémoire et caches

### Frontières et dépendances

| Élément | Chemin prouvé et dette | Classe |
| --- | --- | --- |
| `worker/index.ts:52-90,174-429` | Session, owner injecté Sites, scope cookie, routes API ; démo distincte ; mutations bearer ou owner same-origin | KEEP gardes ; REFACTOR dispatch et propagation erreurs quand Core existe |
| `notion-sync.ts:6-18,95-149` | Huit DB physiques, propertyValue et conversions Notion ; le mapping déborde encore dans investment-data | REFACTOR adapter ; KEEP huit sources et valeurs sans réinventer accès |
| Sync scan/import `:389-489,664-925` | Query100, retries429/5xx, jobs/chunks/leases, upsert par id+lastEdited, Portfolio compact, ETF, purge source disparue | KEEP mécanismes de reprise/idempotence ; REFACTOR isolation et diagnostic |
| Index company/relation `:151-367` | Runtime ensure/upgrade, index many-to-many et primaire ; reconstruction complète, batch50 | REFACTOR schéma/initialisation et coût ; KEEP relations/ownership |
| Locks/status `:21-85,938` + Worker104-162 | D1 locks globaux/source, queues webhook/import, metadataFresh60min, drain background | KEEP protection concurrence ; REFACTOR schéma runtime/observabilité |
| `db/schema.ts`, `drizzle/` | Quotes/snapshots/jobs/webhooks migrés ; d'autres tables créées par ensure runtime (relations/locks/baskets) | KEEP tables/migrations ; REFACTOR registre cohérent, aucune migration dans ce lot |
| `investment-data.ts:28-217` | props WeakMap ; Owned/Watchlist, Current refs, classifications et archive policy, liste Companies | KEEP cache de propriétés/Owned ; REFACTOR mapping physique et sélection/fanout |
| `investment-data.ts:296-358` | relationMap, JSON blocs, snapshotPlainText, projection vérifiée, documentFromRow | REFACTOR mapping/parse partagé ; KEEP fail-closed projection/provenance |
| `getCompanyDetail:394-456` | Toutes Companies+relations+corps puis filter en mémoire ; listCompanies relit Portfolio/Watchlist | REFACTOR lecture ciblée et responsabilité Current/archive |
| `listResearchDocuments:457-470` | Integrity Worker301 et benchmark ; SUBSTR texte700 mais blocks_json complets | REFACTOR lecture/pagination/corps selon besoin ; actif, pas DELETE |
| `getResearchDocument:472-482` | Document ciblé puis tous corps/Companies/relations pour metadata/archive/owner | REFACTOR projection cible, éviter fanout global |
| `company-preview.ts:7-21` | Worker292/296 ; parse/extrait chaque rapport avant retrait corps ; Map de documents par id sur cet appel | REFACTOR preview explicite et résumé cohérent projection ; KEEP payload léger |
| Portfolio `investment-data.ts:509-638` | D1 positions actives, targets, ETF exposure, companies/links, quotes+FX et réconciliation | KEEP calculs/diagnostics ; REFACTOR couplages physiques via adapter, protéger non-régression |
| `quotes.ts:24-125,141-233` | Instruments/symbols, Yahoo2→Yahoo1→Google, timeout/validation, D1 quote/history, dédup requêtes | KEEP fournisseurs/cache/fallback validation ; REFACTOR mapping pour Core/adapter sans modifier méthode financière |
| `theme-baskets.ts:1-300` | Historique/FX → panier ; snapshots, freshness45min, batches3/lease25s, source stamp | KEEP calculs/batching/reprise ; REFACTOR frontières/schéma/erreur seulement si nécessaire |
| `theme-basket-warmup.ts:14-82` | Single flight, idle/visibilité/Portfolio busy, bouclebatch, refresh cache ressource ; catch idle silencieux | KEEP scheduling/dédup ; REFACTOR observabilité et coordination avec lectures Analysis |
| `resource-cache.ts:5-92` | URL→snapshot/promise, TTL60s, epoch/revision/abort, mémoire de session, eviction inactive32 | KEEP moteur existant ; REFACTOR erreur, freshness après échec et modèle preview/full |
| `client-resource.ts:19-110` | Session single-flight, scope clear/reload, lifecycle visibilité/online/sync, useClientResource | KEEP isolation ; REFACTOR fallback session silencieux et responsabilité invalidation |
| `notion-sync-client.ts:25-70` | Fetch status direct, POSTrefresh owner, polling750ms jusqu'à60s | KEEP frontière navigateur sans secret ; REFACTOR diagnostic/coalescence status |
| `notion-document-refresh`, `notion-global-refresh`, `notion-sync-status`, `notion-background-sync`, `notion-integrity` | UI sync/status/toast/integrity ; usages depuis Company/header/page | KEEP surfaces/opérations ; REFACTOR responsabilités quand adapter/Core disponibles |
| `app-navigation.tsx:18-111` | Préfetch URL avant hook, historique+focus/scroll, legacy tabs, map100, openAnalysis context | KEEP navigation ; REFACTOR uniquement duplication/coordination mesurée |
| `app/page.tsx:47-90` | Activity garde vues visitées, Portfolio déclenche warmup quand ready, lazy composants | KEEP shell ; REFACTOR scheduling si preuves mémoire, pas refonte visuelle |
| `demo-data.ts` | Worker scope démo ; fixtures séparées de D1/Notion/quotes live | KEEP isolation et fixtures |
| `ai-prompt.js`, `ai-analysis.tsx` | Workflows → prompt/lien ChatGPT après sélection ; aucune API LLM dans l'app | KEEP comportement ; adapter infra lors du Lot12, pas méthodologie maintenant |
| `public/sw.js:1-23`, `pwa-register.tsx:12-102` | Cache persistant assets uniquement `/assets` extensions admises, jamais API/HTML/auth redirects ; update15min et acceptation utilisateur | KEEP séparation public/privé et update ; aucun cache privé offline à ajouter |
| `app-page-header.tsx:15-25` | Image locale choisie, localStorage d'apparence ; pas cache des réponses Analysis | KEEP préférence locale, hors cache métier |

### Registre de durée de vie

| Cache / coordination | Scope, fraîcheur, invalidation | Classe |
| --- | --- | --- |
| Snapshots Notion D1 | Persistants, `lastEditedTime`/scan ; fraîcheur metadata60min n'expire pas le corps ; queues+reconciliation | KEEP stockage ; REFACTOR adapter |
| parsedProperties WeakMap | Objet row, protège JSON identique, pas cache de requête entre réponses | KEEP |
| Table initialization WeakMaps quotes | Handle D1, promesse ensure partagée, échec retiré ; pas lock cross-Worker | KEEP pattern ; REFACTOR schema responsibility |
| Quote requests WeakMap | Handle D1 + id/mode/force, seulement pendant promesse | KEEP |
| Quote D1 | 5min lecture cache ; cacheOnly peut stale ; force bypass ; dernier bon résultat en fallback étiqueté | KEEP |
| History D1 | `getCompanyHistory` accepte tout cache sans limite d'âge si non force ; Basket impose45min/coverage | REFACTOR fraîcheur explicite entre consommateurs ; KEEP historique ajusté/fusion |
| Basket snapshots D1 | Dimension/période, source stamp et generatedAt45min ; refresh_state timeout15min/lease25s | KEEP mécanisme ; REFACTOR diagnostics et coût de republication |
| Cache ressource client | URL, 60s, session seulement ; clear scope/auth ; invalidation sync ; erreur conserve data | KEEP ; REFACTOR états typed/stale |
| Preview Map locale | Id document sur une companyPreview ; perdue après appel | KEEP dédup locale ; REFACTOR coût avant compaction |
| useMemo lecteurs | Identité document, reparsing si nouvel objet ; aucune persistance | KEEP mémo calcul ; REFACTOR normalisation propriétaire |
| Navigation Maps | Position/focus, 100entrées, pas de corps d'analyse | KEEP |
| PWA CacheStorage | Version shellv5, asset cache-first, activation retire anciennes versions ; API explicitement exclue | KEEP |

Le préfetch de Company est dédupliqué par la même promesse URL que son hook. Le document complet est une seconde ressource, pas une requête dupliquée. La trace baseline ne prouve aucun duplicata simultané même URL. Les fetchs directs de status et du warmup échappent au cache ressources ; des lectures status répétées et des lectures Company/Analysis/Basket en chevauchement sont des **candidats de coordination**, pas un bénéfice de cache à inventer. L'Activity React et les listeners actifs doivent être vérifiés en runtime avant changer ce scheduling.

Les lectures API privées sont no-store. JSON propriétés invalide devient `{}` ; blocs malformés deviennent vides ; erreurs de statut, session et warmup peuvent être génériques/silencieuses. Projection invalide est déjà un état identifié. Les nouvelles frontières devront garder les causes `not found`, réseau, timeout, schema/mapping, auth, refresh stale et erreurs dépendantes, sans effacer le dernier document validé.

## UI, styles et mobile first

Entrée unique : `app/layout.tsx` → `app/design-system.css` → `ux-foundations.css` puis `globals.css`. Storybook importe la même entrée, plus son cadre. **20 primitives exportées** dans `ui-primitives.tsx:28-471` : Surface, ProgressBar, SegmentedControl, CompactControl, ActionButton, BackButton, Badge, SearchField, SectionHeader, FilterBar, Tabs, StatCard, DiscoveryCard, AsyncState, PrimaryBlock, SecondaryBlock, GlassChrome, DisclosureSurface, MetadataGrid, DataTable. **KEEP** toutes : consommateurs production et/ou stories établis. Pas de seconde bibliothèque à créer.

| Source CSS | Lignes physiques | Propriété / décision |
| --- | ---: | --- |
| `globals.css` | 732 | KEEP tokens, primitives et unique :root ; REFACTOR overrides seulement avec preuve de conflit/remplacement |
| `analysis-reader.css` | 782 | REFACTOR ownership/composition mélangeant Reader, Company et des layouts Portfolio ; KEEP styles mobiles/sections/source |
| `documents.css` | 336 | REFACTOR répartition Reader/DecisionTemplate/Company ; KEEP densité tables/disclosures |
| `company.css` | 212 | KEEP Company ; REFACTOR consolidation des mêmes sélecteurs distribués |
| `shared-business.css` | 517 | REFACTOR frontières de composition communes ; KEEP variantes réellement partagées |
| `shared-semantics.css` | 476 | KEEP sémantique ; REFACTOR regroupement d'extensions après preuves DOM |
| `portfolio.css` | 418 | KEEP non-régression prioritaire ; réduire dispersion responsive si une intervention le nécessite |
| `discovery.css` | 584 | KEEP Companies/Basket et mobile ; pas retrait lié au renderer sans consommateurs prouvés |
| `workspaces.css` | 454 | KEEP IA/gestion ; non-régression |
| `shell.css` | 431 | KEEP navigation/PWA mobile, focus et géométrie |
| `storybook.css` | 52 | KEEP cadre sans composant produit dupliqué |
| `ux-foundations.css` / `design-system.css` | 16 / 8 | KEEP imports seuls, exclus des comptes de règles |

Audits exécutés : gouvernance **PASS** (1 008 règles, 3 317 déclarations, 143 sélecteurs répétés, 111 variantes responsive, 31 extensions additives, 0 conflit direct, 0 token concurrent, 0 classe orpheline). **192 déclarations !important brutes** ; ownership compte **429 occurrences après expansion des groupes de sélecteurs**, métriques différentes. Ownership **PASS** : zéro chaîne de propriétés globals↔UX, zéro chaîne concurrente intermodules et zéro chaîne répétée intra-module non conforme. L'audit deadCSS en lecture seule retourne zéro candidat et zéro suppression.

Pistes REFACTOR, pas preuves DELETE : `.company-summary-grid` dans company65/reader366,576/documents55,285,296 ; `.generic-company-detail` dans company3/reader576,593/shared-business27 ; `.company-metrics article` dans plusieurs modules. Les propriétés/contextes sont additifs ou responsive selon audit : leur présence multiple seule ne prouve pas du dead code.

L'unique redondance stricte signalée, `.ui-surface--glass` background `globals.css:664,668`, concerne **deux conditions indépendantes** : absence de backdrop-filter et préférence reduced-transparency. **KEEP** ces protections ; ne pas supprimer automatiquement pour atteindre zéro. Aucun token :root concurrent ni palette parallèle détecté. `--notion-columns` est une variable locale calculée par le composant table, **KEEP**, pas un design token concurrent.

Les grilles scénarios/seuils sont troiscolonnes ≥761px, lignes pleine largeur ≤760px. Les tables vraiment denses ont une région de scroll focalisable ; les compactes restent dans la colonne. KEEP contrat mobile et accessibilité. Les captures Lot0 à390×844/360×800 restent références ; aucun changement visuel n'étant effectué, pas de nouvelle campagne de captures dans ce lot. Aucune preuve de stabilité pixel/table dense à tous breakpoints : à établir avant convergence UI.

## Tests et zones sans couverture

| Suite / surface | Preuve actuelle | Classe et dette |
| --- | --- | --- |
| analysis-reference-fixtures | Helpers + fixtures récentes/historiques + assertions source/layout ; un rendu sections via esbuild | KEEP ; REFACTOR path espaces, ajouter pertes/variants réels |
| analysis-inline-format | Emphase/HTML/Markdown malformed vers HTML/texte | KEEP unités |
| cio-summary-routing | Summary/handoff, abréviations/décimales | KEEP ordre métier |
| presentation-projection | Schema, dates, preuves/hashes, marqueur absent/invalid, machine filtering | KEEP sécurité/contrat ; compléter sources inversées |
| rendered-html | Worker dist répond HTML200/meta preview ; pas hydratation complète | KEEP intégration ; ne pas appeler e2e visuel |
| resource-cache-scope | Purge/abort/isolation scopes, mocks réseau | KEEP ; compléter typed errors/stale/concurrency à future modification |
| performance | D1 synthétique, cache/preview léger et assertions de sources | KEEP budget ; compléter mémoire/render/normalisation réels |
| notion-security | Worker bundlé avec stub vinext, routes auth/scope, cookies forgés et source checks | KEEP gardes de non-régression |
| quotes-startup | CacheOnly, validation/devise, refresh/provider failure | KEEP |
| theme-baskets | Historique ajusté/FX/périodes/calcul/cache, source checks chart | KEEP ; wrapper cache test-only à revoir |
| theme-basket-warmup | Dédup start, scheduling/batches/mocks async | KEEP |
| demo-data | Isolation/cohérence démo, modules/API | KEEP |
| ai-prompt | Workflows et encodage URL/prompt ; pas d'envoi | KEEP méthodologie/UX |
| audit-css-governance | Détecteur/fixtures/source/registry/baseline | KEEP seuils actuels |
| audit-css-ownership | Gate réel + collision injectée temporaire | KEEP |
| storybook-coverage | Sources stories, imports production, exports/primitives et viewports | KEEP ; REFACTOR confusion présence textuelle vs rendu vérifié |
| Stories Companies/Company/Reader/Portfolio/ThemeBaskets/Shell/UIPrimitives/DesignSystem | Composants production, fixtures locales, mobile390×844/tablette768×1024/desktop1440×900 | KEEP scénarios ; pas composant parallèle |
| Snapshots / visuels / e2e | Aucun runner de pixel regression ou e2e navigateur dans package/tests ; captures manuelles Lot0 | REFACTOR stratégie de preuve lors de modifications, pas nouveau framework dans Lot1 |

Gaps précis : pertes types Notion inconnus, résidus list/table, citation→source triée, règles Current/archive ex æquo/multi-owners, équivalence preview vs projection, tables mobile complètes/longues, focus/scroll/touch, mesure heap Worker et click→paint, traces typed timeout/mapping/schema/refresh. Les fixtures snapshots de données ne sont pas des snapshots visuels automatisés. Les tests statiques peuvent passer alors que le composant ou le réseau échoue : le Lot0 l'a reproduit.

## DELETE prouvé et exclusions

| Élément | Preuve de non-consommation | Décision / volume physique |
| --- | --- | --- |
| `app/lib/client-resource.ts:46-49`, readNotionStatus | Une occurrence AST (déclaration) ; recherche de tous fichiers tracked code/tests/scripts/stories/config/docs ne trouve que cette définition. La lecture utilisée est readBrowserNotionStatus (:client-resource62). Aucun accès par nom dynamique trouvé. | DELETE prévu, 4 lignes ; garder la route status et son client actif |
| `app/lib/notion-sync.ts:339`, type NotionRelationRow | Une occurrence AST ; recherche globale hors outputs/deps/généré ne trouve que sa déclaration. Type effacé, aucune référence de contrat/consumer. | DELETE prévu, 1 ligne |

**Volume supprimable immédiatement démontré : 5 lignes, zéro fichier.** À revérifier contre les références au moment du Lot5. Aucun autre volume de suppression garanti. Le gain potentiel du rendu convergé se mesure après validation, pas en assimilant les 607 lignes des deux lecteurs à du code mort.

Exclusions vérifiées : **KEEP** DocumentView (import lazy+route), NotionTable (deux lecteurs), AnalysisPresentation (deux lecteurs), decision-label (plusieurs écrans), listResearchDocuments (integrity+benchmark). **KEEP** RootLayout : entrée conventionnelle du framework malgré une seule occurrence AST. **REFACTOR** getCachedCompanyHistory (`quotes.ts:192-194`) : uniquement consommé par `tests/theme-baskets.test.mjs:5,61`, aucun appel production TS ; le test est un vrai consommateur, le wrapper n'est donc pas déclaré mort. Migrer la vérification vers l'API active avant tout retrait. Les aliases de catégories/tab historiques, secours texte et tables/styles actifs restent en REFACTOR/KEEP tant que corpus et remplacement ne les invalident pas.

## État des chemins critiques et sortie du lot

| Chemin | Ownership et appels résolus | Traitement |
| --- | --- | --- |
| Company → Business | Shell/navigation → resource cache → Worker → getCompanyDetail → companyPreview → CompanyAnalysisDocument → getResearchDocument → Standard → parser/sections/table | REFACTOR aux frontières ; primitives/gardes KEEP |
| Company → Valuation | Même lecture ; projection validée sinon extractValuationSummary + ScenarioComparison | REFACTOR extraction déterministe, KEEP provenance/ambiguïtés |
| Company → CIO / Decision | Dispatch Memo pour analyses synthese ; DecisionTemplate séparé pour source decisions | REFACTOR deux vues d'une décision sans perdre sources/handoffs |
| Document autonome | DocumentView route lazy → même AnalysisReader, pas chemin oublié | KEEP wrapper |
| Portfolio | Snapshot positions → companies/ETF/quotesFX → calculs → cache client → dashboard ; warmup ensuite | KEEP métier ; REFACTOR fanout/coordination prouvé |
| Basket | Companies+historyFX → snapshots/refresh state → batches/leases → vue | KEEP méthode/cache ; REFACTOR erreurs/observabilité |
| IA | Companies → workflow → prompt/lien ChatGPT | KEEP |
| Import Notion | Worker gardé → scan/queues/locks → snapshots+relations → projection vérifiée | REFACTOR adapter, KEEP sécurité/idempotence |

Aucun propriétaire, consommateur principal, ordre de dispatch ou fallback critique ne reste non classé pour préparer le Lot2. **Restent à mesurer** : allocation heap exacte de l'échec mémoire, volume et fréquence des formats privés, temps de normalisation/rendu, concurrence réelle des Activity/listeners et panel multi-entreprises. Ces limites ne sont pas maquillées en décisions DELETE ; elles bloquent une optimisation/suppression correspondante tant que la preuve manque. Le Lot2 peut définir les responsabilités et tests requis, sans déclarer l'erreur mémoire corrigée.

Bilan obligatoire :

1. **Découvertes :** deux lecteurs et deux parseurs de format actifs ; perte partielle reproduite, résidus non inspectés, citations mal numérotées ; fanout global D1 et règles Current/archive dispersées ; CSS sans candidat dead démontré.
2. **Modifications :** seulement cette carte et le catalogue d'évidence, aucune implémentation.
3. **Code supprimé :** zéro ; plan DELETE prouvé limité à5lignes/2éléments.
4. **Tests effectués :** trois audits CSS lecture seule, **7/7 tests des audits PASS**, audit AST+recherche globale, sondes parser et SSR reproduites par l'orchestrateur. Build/application suite Lot0 non relancés sans changement code ; leur résultat/limites restent dans baseline.
5. **Résultats :** classifications et callpaths critiques établis ; les sondes exposent des bugs existants, elles ne sont pas des assertions de régression déjà vertes.
6. **Dette restante :** responsabilité normalisation/vue/données, contrat Current/archive, lectures ciblées, erreurs typed, normalisation de formats/projections, preuve mobile, Core/adapter/Skill/MCP/plugin : à traiter dans les lots prévus.
7. **Risques :** retirer un fallback historique ou protection de provenance sans corpus peut perdre contenu/décision ; garder le fanout menace toutes les surfaces ; tests source/CSS ne garantissent pas le DOM ; pas de refonte visuelle ni migration autorisée ici.
8. **Usage :** quota du compte à la clôture : 47 % de la fenêtre 5 h et 7 % hebdomadaire consommés ; un reset disponible, aucun reset demandé/utilisé. Ce n'est pas une mesure du seul lot.
9. **GO recommandé pour Lot2 — architecture cible documentaire. NO-GO pour refactor, nettoyage massif ou nouveau parser/Core avant le checkpoint Lot2 et ses critères de preuve.**
