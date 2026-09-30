# Contrats de domaine — version 1.0.0

Ce document fige le premier vocabulaire normalisé de `core/contracts` et la politique pure de sélection Current. Le Core ne lit ni D1, ni Notion, ni React, ni le transport MCP. Ces contrats sont la cible du Lot 3; aucun appel runtime n’est redirigé vers le sélecteur dans ce lot.

## Versions et responsabilités

`schemaVersion: "1.0.0"` versionne les valeurs de domaine. `presentationContractVersion` versionne séparément le payload machine de présentation existant; le validateur de ce payload ne remplace pas celui des entités et résultats du service. La méthode financière reste versionnée indépendamment dans les documents (`contractVersion`). Version de plugin, protocole MCP et normalisation documentaire ne changent pas la version des records canoniques.

Les adapters convertissent les IDs et propriétés physiques Notion en contrat normalisé. Les IDs fournis au Core sont déjà canoniques (UUID en minuscules sans tirets selon la convention d’identité existante) : le Core compare des clés opaques et ne parse ni n’invente un alias Notion. `sourceKind` distingue `analysis` et `decision`; `family` porte le type métier précis, notamment `cio_memo` contre `decision`. Cela garde le memo CIO et une ligne Décision séparés même quand les deux sont présentés dans la zone Synthèse.

Les formes communes vivent dans `core/contracts/common.ts`; les records d’investissement sont dans `core/contracts/investment.ts` et les headers/analysis contracts dans `core/contracts/analysis.ts`. Les ViewModels d’écran, previews et blocs de présentation restent des projections calculées depuis les valeurs canoniques; ils ne sont pas des identifiants ni des écritures source.

## Champs utiles au choix Current

`AnalysisHeader` transporte au minimum :

- `id`, `family`, `sourceKind`, `agent` : identité, famille métier, distinction analyse/décision et label d’agent déjà mappé;
- `companyIds` : IDs de Companies propriétaires normalisés, éventuellement plusieurs;
- `archived` : signal explicite d’archive mappé par l’adapter depuis les propriétés/statuts/titres physiques. `current` n’est pas une propriété globale du document : le pointeur est contextualisé par Company + famille et transmis séparément au selector;
- `status`, `sourceFreshness`, `date`, `lastEditedTime`, `revision`, `provenance` : état, rang de fraîcheur métier, date principale, date de modification, révision et preuve source. `date` accepte un jour ISO ou un timestamp ISO à fuseau; les dates historiques secondaires normalisées par l’adapter sont passées séparément au selector comme `relatedDates`.

`sourceFreshness: "fresh"` dans le contrat normalisé signifie le statut Notion `Source Freshness = Current`; il ne veut pas dire « édité dans les dernières heures ». La fraîcheur temporelle réseau/cache est portée par `ServiceMetadata.freshness` et ne participe pas à l’ordre métier Current.

## Exports canoniques et invariants

| Valeur canonique | Types/exportations | Validation publique |
| --- | --- | --- |
| Company et preview | `Company`, `CompanyPreview`, `ResearchReference` | `isCompany` / `validateCompany`, `isCompanyPreview` / `validateCompanyPreview`; résultats `validateCompanyResult` et `validateCompanyPreviewResult` |
| Portfolio et position | `Portfolio`, `Position` (`OpenPosition` ou `ClosedPosition`), `PortfolioSlice` | `validatePortfolio`, `isPosition` / `validatePosition`; résultats `validatePortfolioResult` et `validatePositionResult` |
| Analyse canonique | `Analysis` / `AnalysisDocument`: `BusinessAnalysis`, `ValuationAnalysis`, `ShortAnalysis`, `PortfolioFitAnalysis`, `MemoAnalysis`, `DecisionAnalysis`, `EarningsAnalysis`, `GenericAnalysis` | `isAnalysis` / `validateAnalysis`; `AnalysisHeader` via `isAnalysisHeader`, `AnalysisContent` via `isAnalysisContent`, `AnalysisPreview` via `isAnalysisPreview` / `validateAnalysisPreview` |
| Décision | `Decision`, incluse dans `DecisionAnalysis` | `isDecision` |
| Cours | `Quote` | `isQuote` / `validateQuote`; résultat `validateQuoteResult` |
| Enveloppes | `ServiceResult<T>`, `ServiceMetadata`, `Diagnostic`, `Provenance` | `validateServiceResult`, `validateServiceMetadata`, `validateDiagnostic`, `validateProvenance` |

Invariants contrôlés par ces validateurs : seul Business et Valuation portent un `score`; le mémo CIO n’en porte pas. Les previews n’incluent ni `AnalysisContent` ni corps source. Les segments gardent du texte, des marques typées et des liens HTTP(S) sûrs; le code inline est exclusif. Les métriques ont une valeur numérique ou `null`; une valeur `known` exige une valeur et une origine traçable par IDs de blocs ou provenance projection complète, tandis que `unknown` conserve `null` sans origine de bloc. Une projection `valid` doit correspondre à la famille canonique. La validation structurelle ne vérifie pas le hash du rapport brut : l’adapter doit vérifier le snapshot/hash avant de marquer une projection valide. Une position fermée est adressable hors des holdings ouverts; les IDs des groupes restent uniques.

## Politique pure `selectCurrentAnalysis`

Entrée : `{ companyId, family, explicitCurrentIds, candidates }`. La fonction reçoit des headers déjà mappés, filtre par `companyId`, `family` et `sourceKind`, et retourne un résultat `selected`, `absent` ou `invalid`, des diagnostics et une raison (`explicit_current` ou `legacy_fallback`). Elle ne modifie aucune entrée, ne lit pas l’horloge et n’appelle aucun adapter.

| Cas | Règle |
| --- | --- |
| Famille ordinaire | `business`, `valuation`, `short`, `portfolio` et `earnings` attendent `sourceKind=analysis`. `decision` attend `sourceKind=decision`. `cio_memo` attend `sourceKind=analysis`. |
| Référence explicite | Une seule cible Current distincte et présente est prioritaire, même si une candidate fallback est plus récente. L’ID doit pointer vers une candidate de la bonne compagnie, famille/sourceKind et non archivée. |
| Référence explicite multiple | Plusieurs IDs distincts donnent `invalid` avec diagnostic; aucune cible n’est choisie et le fallback ne s’applique pas. Les doublons du même ID se réduisent à une seule référence. |
| Current explicite absente | Pour les familles ordinaires, le fallback legacy est permis. Les candidats archivés et les candidats hors famille/propriétaire sont exclus. Aucun candidat admissible donne `absent`. Pour `cio_memo`, l’absence de pointeur renvoie `absent` avec `memo_current_reference_missing`, même si une ancienne candidate validée existe : le lecteur actuel du mémo n’a pas de fallback. |
| Memo CIO | Avec un pointeur explicite, le statut normalisé doit être exactement `Validated` sans tenir compte de la casse/espaces, et l’agent normalisé exactement `Investment Memo`. Une cible explicite inadmissible est `invalid`; aucune ancienne version n’est choisie. |
| Statut des autres familles | Une relation Current explicite admissible reste autoritaire même pour un statut `Draft`, `Rejected` ou non reconnu, car le runtime actuel ne filtre pas ces statuts pour les familles ordinaires. Le résultat garde un diagnostic `draft_current`, `rejected_current` ou `unmapped_current_status`. Ne pas imposer le filtre validé du memo à toutes les analyses. |
| Fallback des autres familles | Ordre total : `Source Freshness=Current` **et** `Validated`, puis `Validated`, puis toute autre candidate non archivée; ensuite date effective décroissante; puis ID stable ascendant. Des IDs dupliqués parmi les candidates admissibles rendent l’ensemble `invalid`, sans choix dépendant de l’ordre d’entrée. Les statuts Draft/Rejected ne sont pas exclus globalement si aucune candidate mieux classée n’existe. |
| Archive / cible absente / mauvais owner / mauvaise famille | Un Current explicite qui pointe vers une cible manquante, archivée, appartenant à une autre compagnie ou d’une famille/sourceKind incompatible renvoie `invalid` avec diagnostic et aucun fallback. |
| Dates invalides | La date effective est le maximum des champs valides `date`, `relatedDates` et `lastEditedTime` (jour ISO ou timestamp ISO à fuseau). Une date malformée est ignorée et produit un diagnostic; si aucune date valide ne reste, elle vaut zéro pour l’ordre. Une même entrée donne le même choix. |

Cette matrice conserve la compatibilité du choix legacy des familles ordinaires constaté dans `investment-data.ts:202-211`, ainsi que l’absence de fallback du memo CIO, tout en rendant explicite l’échec Current plutôt que de masquer une relation invalide. Le mapping vers `family`, `sourceKind`, `companyIds`, statut, sourceFreshness et archive est à tester séparément dans l’adapter; le selector n’est pas propriétaire de la traduction Notion.

## Compatibilité des sources et limites

La fiche Companies fournit les pointeurs explicites `Current Business Analysis`, `Current Valuation Analysis`, `Current Short Analysis`, `Current Portfolio Analysis`, `Current Investment Memo`; les liens `Current Earnings Analysis`/`Latest Earnings` et `Current Decision`/`Current Investment Decision`/`Latest Decision` sont aussi mappés aujourd’hui (`app/lib/investment-data.ts:81,363-384`). Les documents stockés peuvent venir de `analyses`, `earnings`, `portfolio` ou `decisions`; `cio_memo` est détecté à l’intérieur de la source `analyses` avec l’agent `Investment Memo` (`:273-295`). Le mapping d’adapter doit préserver ces alias et produire la famille logique sans faire entrer heuristiques de titre dans le Core. Pour le tri, la compatibilité existante prend le maximum de `Analysis Date`, `Date`, `Decision Date`, `Earnings Date` et `last_edited_time` (`app/lib/investment-data.ts:93-97`); l’adapter doit alimenter les valeurs secondaires dans `relatedDates`, sans exposer les noms Notion au Core.

Preuve de statut disponible : pour les mémos, le runtime exige explicitement `Validated` et l’agent `Investment Memo` (`:202-211`). Pour les autres familles, le pointeur Current l’emporte sans filtre statut; le fallback préfère `Source Freshness=Current`, puis `Validated`, puis candidats restants (`:88-97,132-146,202-211`). L’archive actuelle est déduite aussi de mots dans statut/titre (`:84-86`), donc l’adapter doit conserver le comportement existant et tester les libellés réellement présents. Aucun catalogue complet d’options Notion Draft/Rejected/autres n’a été établi ici : les valeurs hors liste sont diagnostiquées sans être inventées ni automatiquement bannies.

La sélection ne persist pas l’historique de révisions de page, ne promeut pas Current, ne modifie aucune donnée, ne génère aucun contenu LLM et ne valide pas l’auth. L’écriture `saveAnalysis`, la promotion Current atomique ou réconciliable, l’auth MCP, et l’évolution de la persistance restent des gates d’adapter/transport distinctes.

## Fixtures et critères d’adoption

Le test isolé du selector couvre : Current explicite plus ancien prioritaire; permutation d’ordre des candidates; égalité date résolue par ID ascendant; freshness+Validated puis Validated puis autres; memo strict; séparation memo CIO/décision; multi-owner contextualisé; Current multiple/missing/archive/wrong owner/wrong family sans fallback; Draft et statut inconnu diagnostiqués pour Current ordinaire; conflit de dates principales/secondaires, timestamp ISO, calendrier invalide et entrée non mutée. Le module demeure non branché runtime jusqu’à la migration des adapters et de tous les consommateurs, avec comparaison de sélection actuelle/cible sur fixtures versionnées pour chaque famille.

## Bilan du Lot 3

- Livré : contrats versionnés et validateurs stricts, extraction byte-equivalent du validateur de projection vers `core/contracts/presentation-projection.ts` avec re-export de compatibilité; entités d’investissement et d’analyse; selector Current pur, non branché.
- Mapping restant : les adapters doivent convertir les propriétés Current/relations legacy vers IDs et familles normalisés, mapper les dates historiques `Analysis Date`, `Date`, `Decision Date`, `Earnings Date` dans `date`/`relatedDates`, préserver les alias et ne pas inclure les corps d’analyses dans les CompanyPreview. La projection de présentation reste versionnée séparément des entités canoniques.
- Horloge : `common.ts`, les validateurs d’analyse qui exposent ce paramètre et `validateServiceResult` acceptent une référence `now` optionnelle pour des validations reproductibles; les validateurs d’investissement ne l’exposent pas tous. Le contrôle de quotes existant dans `app/lib/quotes.ts:78` garde sa tolérance de deux minutes au-delà de `Date.now()`. Toute adaptation du contrôle dans le contrat Core doit préserver cette marge, avec son horloge fournie par l’appelant.
- Validation root : typecheck PASS; `npm run test:domain` 25/25; 19 fichiers de tests applicatifs 185/185 dans la copie exacte `/private/tmp/investment-os-lot3-gdrods7s`, qui contourne le problème historique `URL.pathname` avec espaces; build direct vinext PASS en 5,599 s; `validate:artifact` PASS.
- Limites des gates : le wrapper `npm test` reste non vert sur GNU `timeout`, échec déjà présent dans la baseline; lint des nouveaux fichiers sans warning; lint global garde deux constats baseline inchangés. Le lint local compte 93 findings, dont 91 warnings du probe de sortie non versionné.
- Contrôle source : environ 154 lignes de validateur/projection ont été déplacées, pas supprimées; le contenu extrait est identique et l’ancien chemin garde ses exports compatibilité. Seul le helper texte devenu inutilisé dans la copie Core a été retiré; aucun parser, renderer ou symbole mort réservé au Lot 5 n’a été supprimé. Fonctions raw Notion/hash inchangées. La preuve metafile root liste cinq modules Core autonomes et zéro import externe/app/renderer/LLM (`outputs/lot3/core-boundary.json`). Aucun service Current, UI, site ou mutation Notion n’a été branché ou exécuté.
- Pilotage : travail réalisé par trois agents Luna avec revue racine. Les contrôles de performance, renderer, mapping/adapters, auth et persistance restent ouverts; la prochaine gate concerne le Lot 4, après décision utilisateur. Au relevé du root, le quota partagé était utilisé à 84 % sur cinq heures et 13 % sur la semaine, un reset disponible et aucun consommé.
