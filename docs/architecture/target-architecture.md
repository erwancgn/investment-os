# Investment OS — Lot 2 : architecture cible

Décision de conception du 30 septembre 2026, fondée sur la [baseline Sites v207](baseline.md) et la [debt map](debt-map.md), commit d'audit `ae8d566`. **Au checkpoint du Lot 2, aucune de ces extractions n'était encore implémentée.** Les contrats du Lot 3 sont depuis matérialisés dans les [contrats de domaine](domain-contracts.md); les migrations d’adapters, services et consommateurs restent à faire. La branche reste `chore/architecture-stabilization-mcp`. Le checkpoint du Lot 4 ci-dessous décrit sa migration applicative, sans déploiement.

Trois revues factuelles Luna ont couvert données/cache, renderer/mobile/tests et contrats/Core/MCP. L'orchestrateur a relu les conclusions, choisi les frontières et effectué la revue finale. Les notes de travail restent locales dans `outputs/lot1/` et `outputs/lot2/` ; les décisions revues sont celles de ce document.

La préparation de la preuve de reproductibilité Codex Cloud avant le Lot 4 est suivie dans le [Lot 3.5 — préparation Codex Cloud](codex-cloud-environment.md).

## Décisions et limites

Notion demeure la source des documents, propriétés métier, relations et pointeurs Current. D1 conserve les snapshots synchronisés, index, jobs, verrous et caches techniques déjà utilisés. Le Worker Sites reste la frontière HTTP, d'authentification et de composition. React reste la présentation mobile first. Les analyses continuent d'être produites par les workflows existants ; le Core ne produit aucun jugement financier avec un LLM.

On extrait progressivement les responsabilités existantes : contrats de domaine versionnés, mapping physique Notion, politique Current/archive, normalisation documentaire et rendu de blocs commun. On conserve Portfolio, Basket, IA, sécurité et navigation comme consommateurs de référence. Aucun nouveau framework, seconde bibliothèque UI, migration Supabase, multiutilisateur, Dots, sortie de Sites ou refonte visuelle n'entre dans ce chantier.

## Chemin canonique et dépendances

```mermaid
flowchart LR
  N[Notion] --> S[Sync et snapshots D1]
  S --> A[Adapter Notion : lecture ciblée et mapping]
  A --> C[Core : modèle canonique et politiques]
  C --> V[ViewModel de lecture déterministe]
  V --> R[AnalysisReader : renderer de blocs partagé]
  C --> T[API Worker et futur transport MCP]
  Q[Adapter cours et cache D1] --> C
```

Le diagramme montre le flux des valeurs ; les dépendances du code suivent les ports du Core. Le Core ne dépend ni de React, ni des noms de propriétés Notion, ni de D1, ni de Sites, ni du transport MCP. Les adapters implémentent ses ports. Le Worker assemble les implémentations et applique les gardes avant chaque appel. La vue dépend des contrats ; elle ne choisit plus le rapport Current ni ne remappe les propriétés physiques.

Organisation cible minimale, à matérialiser uniquement dans les lots concernés :

| Emplacement | Responsabilité | Origine à réutiliser |
| --- | --- | --- |
| `core/contracts/` | Types, versions et validation des entrées/sorties publiques du domaine | Types aujourd'hui dans `investment-data.ts`, contrat de projection existant |
| `core/analysis/` | Normalisation pure du contenu portable, sélection Current/archive, règles documentaires | `document-presentation`, `valuation-summary`, politique dispersée |
| `core/` | Services métier et ports nécessaires aux opérations effectivement consommées | Services de `investment-data.ts`, calculs Portfolio conservés |
| `adapters/notion/` | Source IDs/propriétés/relations ; implémentations distinctes des ports de lecture snapshot D1, de sync et d'écriture API Notion | `notion-sync.ts`, mapping de `investment-data.ts`, lecteur des blocs Notion |
| `adapters/market-data/` | Fournisseurs, validation, cache cours/FX/historique | `live-quotes.ts`, logique de quotes/Basket existante |
| `app/lib/` | ViewModel et cache de ressources de la session UI | Helpers de présentation et `resource-cache.ts` |
| `app/components/` | Compositions existantes et unique rendu des blocs | `AnalysisReader`, primitives, sections, table, scénarios, composition CIO |
| `worker/` | HTTP, auth, secrets, composition et diagnostics | Routes et gardes actuelles |
| Transport MCP, emplacement au Lot 11 | Adaptation des sept opérations sans logique métier | Aucun serveur MCP applicatif déployé actuellement |

Il n'y a pas de monorepo, de conteneur d'injection ou de repository générique à ajouter. Chaque extraction migre les consommateurs du module existant ; un wrapper temporaire a un consommateur identifié et une condition de retrait. Les corps de lecteurs remplacés sont retirés au Lot 4 ; le nettoyage transversal reste au Lot 5.

## Contrats à figer au Lot 3

Les noms ci-dessous définissent les responsabilités. Les contrats versionnés et fixtures matérialisés au Lot 3 sont documentés dans les [contrats de domaine](domain-contracts.md); la politique Current y reste pure et non branchée aux adapters/consommateurs.

| Contrat | Invariants |
| --- | --- |
| `Company` / `CompanyPreview` | Identité stable, ownership/watchlist, métadonnées et références d'analyses ; aucun corps documentaire dans le preview |
| `AnalysisHeader` | ID, famille explicite, statut, dates, company IDs, provenance et révision ; classification physique effectuée dans l'adapter |
| `AnalysisDocument` | Header, contenu canonique, résumé/faits attestés, projection et diagnostics ; distinct du preview |
| `AnalysisContent` | Blocs ordonnés, IDs de source stables, texte et annotations sûres, sections, tables, listes et contenu non pris en charge conservé |
| `Decision` / `EarningsReview` | Champs métier actuels et états explicites ; la décision Notion et le memo CIO ont des compositions distinctes |
| `Portfolio` / `Position` | Quantités, PRU, comptes, objectifs, expositions, rapprochement et calculs actuels ; provenance et couverture des cours |
| `Quote` | Valeur, devise, source, date du cours, date de récupération et fraîcheur distinctes ; zéro ne remplace jamais une donnée absente |
| Résultat de service | Donnée valide, métadonnées de fraîcheur/révision et diagnostics ; erreur typée quand l'opération ne peut fournir de résultat valide |

La version de domaine proposée est `schemaVersion: "1.0.0"`. Elle est indépendante de `presentationContractVersion: "1.0.0"`, de la version méthodologique actuelle `contractVersion: "1.2.6"`, de `pluginVersion` et de la version de normalisation. On réutilise le validateur strict de `presentation-projection.ts` pour cette projection ; les entités et résultats du domaine ont leur propre validation de contrat au Lot 3. On ne crée pas un validateur concurrent de la projection. Les valeurs `known`/`unknown`, unités, dates et preuves survivent au passage dans le domaine. Une famille non reconnue reste explicite et lisible ; elle n'est pas transformée en Business par une heuristique UI.

Une incompatibilité de version est diagnostiquée avant publication du résultat. Les anciennes analyses entrent par les lecteurs de format de compatibilité documentés ; cette compatibilité ne signifie pas accepter un payload structuré invalide. Les dates/horloges nécessaires à une normalisation sont injectées, afin que la même entrée, version et date de référence produisent la même sortie.

## Normalisation et rendu

**Un seul pipeline de normalisation, deux lecteurs de format nécessaires.** Le lecteur Notion structuré est dans l'adapter ; le lecteur HTML/Markdown historique produit les mêmes blocs portables. Le dispatcher existant `parseNotionDocument` est déplacé/refactoré, pas doublé. Les propriétés physiques Notion restent dans l'adapter ; la présentation métier portable reste dans le Core.

1. Charger le snapshot demandé et ses métadonnées liées. Garder son contenu brut inchangé pendant la normalisation comme preuve/rejeu de cette entrée. D1 remplace actuellement le snapshot d'une page lors d'une nouvelle sync : il ne conserve pas toutes ses révisions. Les analyses historiques restent les pages/version documentaires existantes ; une promesse de rejeu d'une ancienne révision d'une même page exigerait une conservation supplémentaire, hors garantie actuelle.
2. Extraire le payload machine et vérifier projection, hash et références avec le validateur existant. Le payload machine ne fait pas partie du corps humain rendu.
3. Lire le format structuré et évaluer sa couverture, y compris enfants, listes et cellules. Une sortie non vide n'est pas une preuve de complétude.
4. Si le format structuré est complet, le retenir. Sinon, utiliser le texte complet seulement si sa couverture est vérifiée ; à défaut conserver les blocs supportés et un bloc de contenu non pris en charge avec texte disponible et diagnostic. Ne pas fusionner aveuglément deux corps complets et dupliquer les paragraphes. Un contenu impossible à restituer doit être signalé, pas silencieusement supprimé.
5. Normaliser les annotations en segments typés de texte/emphase/code/lien et extraire une seule fois les informations métier nécessaires. Réutiliser les règles syntaxiques du helper inline, en extrayant sa partie pure : le module actuel importe React et ne peut être déplacé tel quel dans le Core. Le composant rend les segments et ne reparcourt pas le markup source. Une projection valide est prioritaire pour les données qu'elle atteste ; absente, la compatibilité legacy s'applique ; invalide, le corps humain reste lisible avec notice et sans promouvoir les faits du payload rejeté.
6. Produire le modèle canonique avec liens de provenance. Les scénarios ou seuils ambigus restent dans le corps et portent un diagnostic ; aucune hypothèse de valeur ou nouvelle méthode financière n'est ajoutée.
7. Construire le ViewModel depuis ce modèle : arbre H1/H2/H3, blocs promus/visibles, disclosure, source/citation et compositions. Ce ViewModel ne lit ni raw JSON, ni propriétés Notion, ni réseau.
8. Rendre sans reparsing ni extraction de chiffres côté composant.

Le serveur normalise le document complet demandé ; le client reçoit un modèle validé et construit la vue pure. Le preview utilise le même résultat sémantique pour les résumés, sans envoyer les corps. Les résumés peuvent être dérivés à l'import ou lors d'une lecture ciblée : leur stockage éventuel nécessite une mesure du Lot 6, une clé de révision/version et une invalidation prouvée. Il n'y a pas de cache mémoire global de tous les rapports à introduire pour accélérer cette étape.

Trajectoire de preview : sans dérivation stockée, calculer depuis les seuls documents liés effectivement demandés par le preview, puis retirer leurs corps de la réponse ; les historiques non demandés restent des headers. Si les consommateurs exigent davantage de résumés, le contrat doit le rendre explicite et borner la lecture sans supprimer silencieusement un résumé affiché. Le Lot 4 valide la cohérence preview/document ; le Lot 6 valide le coût et décide d'une éventuelle dérivation persistée à la sync. Le passage au modèle canonique n'est donc pas présenté comme une optimisation SQL déjà livrée.

**Un renderer de corps partagé.** `AnalysisReader` reste le point d'entrée. Standard et CIO deviennent des compositions au-dessus du même dispatch de blocs, sections, inline, tables et sources. Le memo garde Decision Card, handoffs, modules, raisonnement et avertissement d'âge ; il ne reçoit aucun score financier. La source Notion Decisions conserve ses champs et son template métier. Les variantes de famille sont explicites dans le contrat, sans condition par ticker.

Une seule table ordonnée `sourceId → numéro` alimente citations et liste de sources. Les IDs d'ancre restent stables après tri. Les blocs promus gardent leurs références source ; masquer une table redondante dans la vue ne supprime pas cette table du modèle/source. La vue n'insère jamais du HTML brut non validé.

Mobile : référence 360×800 et 390×844, scénarios empilés jusqu'à 760 px et trois colonnes à partir de 761 px ; aucune largeur de page excédentaire. Les tables denses gardent un défilement interne accessible, les sections les disclosures natifs et la navigation son focus/scroll. Les captures du Lot 0, y compris les sections Business dépliées, restent les comparateurs avant/après ; aucun nouveau design system n'est créé.

## Repository, Current et archives

Les méthodes de lecture ciblent un ID, une compagnie et/ou une page bornée. Elles demandent les colonnes nécessaires ; un listing/preview ne charge pas les `blocks_json` de tous les documents. Le document complet peut nécessiter ses relations/headers associés, jamais tous les corps du corpus. Les index many-to-many existants sont réutilisés. La pagination doit exposer un ordre stable et un curseur au lieu d'un tri global en mémoire. Les limites exactes et la stratégie d'index se valident au Lot 6 sur les vrais plans/requêtes.

La sélection est un service unique du Core, après mapping des propriétés Current par l'adapter :

- Une référence Current explicite et admissible est prioritaire. L'admissibilité appartient à la politique du Core, avec cohérence compagnie/famille/archive. Le memo exige déjà `Validated` et l'agent attendu ; les autres familles n'appliquent pas aujourd'hui uniformément ce filtre. La matrice matérialisée au Lot 3 est décrite dans les [contrats de domaine](domain-contracts.md), avec des fixtures synthétiques avant validation de mapping réel.
- Plusieurs références Current concurrentes, une référence renseignée dont le document est absent, non admissible ou contradictoire produisent un diagnostic de sélection. Aucune référence explicite invalide n'est remplacée silencieusement par le document le plus récent.
- Quand aucune référence explicite n'existe, le fallback historique reste temporairement autorisé pour les familles ordinaires : filtres d'admissibilité puis ordre total par rang de fraîcheur validé, date effective documentée et ID stable. Le résultat expose `selectionReason: legacy_fallback`. CIO memo fait exception : sans Current explicite, le résultat est absent, conformément au lecteur actuel qui n'a pas de fallback.
- Une analyse peut être liée à plusieurs compagnies ; la sélection Current est contextualisée par compagnie/famille et conserve la distinction memo CIO/décision Notion, même si les deux apparaissent dans Synthèse. Les archives gardent ID, contenu et provenance. Les conflits archive/Current sont visibles et ne réécrivent pas le snapshot.

La priorité explicite corrige un comportement aujourd'hui ambigu ; sa migration demande des fixtures de conflits et une comparaison des sélections réelles. Un écart inexpliqué bloque la bascule. L'avertissement memo plus ancien qu'une analyse amont reste conservé et repose sur des dates explicites.

## Caches, fraîcheur et erreurs

| Niveau | Cible et invariants |
| --- | --- |
| Notion → D1 | Snapshot durable avec révision source, date de sync et statut ; une erreur de sync n'annonce pas une actualisation réussie |
| Quote/FX D1 | TTL actuel de cinq minutes et dernier cours valide conservés ; source et date restent visibles après échec fournisseur |
| Historique et Basket | Caches/leases actuels conservés, cadence Basket de 45 min ; fraîcheur de l'historique à préciser au Lot 6 car il n'a pas aujourd'hui de TTL général |
| Ressources navigateur | Mémoire de session, TTL actuel de 60 s, déduplication et protection epoch/revision ; garder l'ancien résultat valide pendant refresh ; auth invalide purge tout |
| Corps normalisés | Pas de nouveau cache process massif ; toute dérivation réutilisée est liée à ID, révision source et version de normalisation, avec taille/invalidation mesurées |
| Service worker | Cache du shell/assets seulement ; aucun snapshot/API privé persistant |

Le scope de session et la version du contrat doivent participer à l'identité d'une ressource ; le changement de scope conserve purge/reload. L'actuelle éviction de 32 entrées inactives ne constitue pas une borne dure de mémoire. Les budgets de corps, concurrence et timeout se déterminent par profilage, pas par une augmentation arbitraire du TTL. Les caches n'ont pas le droit de masquer une sélection incorrecte ou un payload incompatible.

Les erreurs gardent une catégorie exploitable : entrée/version invalide, introuvable, non autorisé, mapping/normalisation, stockage, dépendance/rate limit, timeout/réseau. Une projection invalide ou une donnée ancienne peut être un diagnostic attaché à un corps valide plutôt qu'un échec global. La réponse transport ajoute statut et ID de corrélation ; les logs protégés contiennent opération, durée, nombre de lignes, taille et étape, sans secret ni corps privé. L'UI garde un message simple et une action de relance, tout en conservant la catégorie pour le diagnostic.

Une erreur 500 n'est pas automatiquement une erreur mémoire. Le dépassement mémoire Worker peut interrompre avant le catch ; il se corrèle aux logs runtime. La baseline prouve `exceededMemory`, sans prouver l'allocation responsable. On mesure séparément SQL, mapping, normalisation, payload, réseau et rendu au Lot 6. On ne publie pas d'objectif de latence chiffré sans mesure comparable froide/chaude.

L'adapter distingue une propriété/bloc absent d'un JSON malformé ou d'un type physique inconnu : les conversions actuelles vers `{}`/tableau vide ne doivent plus masquer l'erreur de mapping. La sync conserve sa protection contre une révision plus ancienne, la propagation des suppressions et les lectures compactes Portfolio/ETF ; un échec de scan ne purge pas le dernier snapshot valide. Les positions fermées ne doivent pas être réintroduites dans les holdings par cette extraction.

Le schéma snapshot actuel expose `last_edited_time` et `synced_at`, pas une colonne générale de version. La « révision source » désigne d'abord cette date d'édition ; une dérivation persistante de contenu exigera aussi un digest du contenu effectivement importé. Un éventuel champ stocké supplémentaire relève d'une migration explicite après mesure, pas d'un état déjà disponible.

## Core et surface MCP minimale

| Opération | Responsabilité du Core |
| --- | --- |
| `getCompany` | Identité/métadonnées et références Current/archive sélectionnées ; preview léger |
| `getPortfolio` | Snapshot portefeuille, calculs existants, cours/FX et diagnostics de rapprochement |
| `getPosition` | Position ciblée par ID de page Portfolio ; mêmes calculs, mais lookup également possible pour une ligne fermée exclue des holdings courants |
| `getCurrentAnalysis` | Sélection contextualisée compagnie/famille et document canonique complet |
| `listAnalyses` | Headers paginés et filtres explicites ; corps exclus par défaut |
| `saveAnalysis` | Validation, persistance par adapter et receipt vérifié ; aucune génération de contenu |
| `getQuote` | Cours validé, source/date/fraîcheur et policy de refresh explicite |

L'application doit aussi ouvrir une analyse historique par ID : une méthode interne `getAnalysisById`/port de repository est nécessaire, sans imposer un huitième outil MCP à ce lot. Le contrat MCP détaillé, dont l'accès historique éventuel, reste au Lot 10 ; le minimum de sept opérations ne justifie pas supprimer une route UI existante.

`saveAnalysis` n'existe pas aujourd'hui dans le Core applicatif. On réutilise les conversions, validations et mécanismes de sync existants là où leurs contrats correspondent ; on ne présente pas la future écriture comme déjà implémentée. Notion reste autorité de l'écriture : ID/run idempotent, version attendue et contrôle des relations sont nécessaires pour détecter retries et concurrence. Une relecture avant écriture seule ne garantit pas une mutation atomique : la coordination des clients contrôlés et la vérification après écriture doivent permettre de détecter/réconcilier les changements externes sans revendiquer un compare-and-swap Notion non établi. Un receipt distingue contenu persisté, promotion Current et vérification. Une écriture partielle ne retourne jamais « succès vérifié ». La séquence et la reprise non atomique Notion seront testées aux Lots 7/8/12 avant mutation réelle.

Les sept opérations reçoivent des objets du domaine ; les noms de DB et propriétés Notion ne traversent pas le transport. Le plugin conserve ses rôles, méthode financière, prompts et orchestration ; il remplacera seulement l'infrastructure d'accès/persistance par ces opérations. Aucun appel LLM n'est nécessaire au renderer ou au Core.

Le transport MCP doit rester compatible avec l'hébergement Sites et les gardes propriétaires existantes. Son mode d'hébergement/authentification n'est pas prouvé par l'audit de l'app : le site actuel n'a pas de MCP. La faisabilité et le contrat d'auth sont une gate des Lots 10/11, sans décision de sortie de Sites ni promesse de réutiliser arbitrairement un bearer de sync comme auth MCP.

Le port de lecture snapshot retourne le dernier état synchronisé ; le port d'écriture Notion retourne un résultat de persistance vérifié ou partiel. La sync réconcilie ensuite snapshot/index. Ces ports restent distincts même si leurs implémentations sont regroupées sous `adapters/notion/` : un upsert D1 ne prouve pas une écriture dans Notion et un POST de query data-source n'est pas une mutation documentaire.

## Migration et gates

| Lot | Livraison et gate |
| --- | --- |
| 3 — contrats | Schémas/version, fixtures valides/invalides et politique Current ; types preview/full séparés ; indépendance React/Notion/LLM testable |
| 4 — renderer | Migration du dispatcher et des deux formats, ViewModel, corps partagé ; toutes familles, valid/absent/invalid, couverture partielle, citations et vues mobile comparés |
| 5 — nettoyage | Retirer remplacements sans consommateurs et les deux symboles morts prouvés ; aucun retrait massif fondé sur les seuls comptes de regex |
| 6 — performances | Lectures ciblées, mesures CPU/mémoire/fanout/cold/warm et erreurs ; pas de mémoire proportionnelle aux corps du corpus pour une lecture ciblée |
| 7 — Core | Services/ports indépendants, contrats testés avec adapters fake ; conservation calculs et routage existants |
| 8 — adapter Notion | Mapping/sync/écriture isolés, reprise/concurrence et receipts vérifiés ; aucun secret exposé |
| 9 — Skill permanent | Documenter le chemin réel stabilisé, les gates et les interdits de duplication |
| 10/11 — MCP | Contract/auth/hébergement validés, puis serveur mince sur le Core ; tests erreurs/scope et sept opérations |
| 12 — plugin | Migration infrastructure seulement ; comparaison outputs/receipts et persistance sans changement méthodologique |
| 13 — clôture | Non-régression globale, mobile, sécurité, perf, docs et retrait des wrappers restants |

Les gates de code devront inclure les suites existantes et leurs consommateurs, avec correction explicite des limites de portabilité au lot pertinent. La baseline distingue typecheck PASS, build direct PASS, wrapper build macOS FAIL, lint préexistant FAIL, et les 160 tests PASS dans le chemin temporaire compatible contre 159/160 dans le checkout avec espaces. On ne transforme pas ces constats en « tous les checks passent ».

Pour les changements de rendu : Business, Earnings, Valuation, Short, Portfolio Fit, CIO, décision et format générique ; plusieurs compagnies/historiques ; scénarios ambigus et valeurs négatives ; blocs inconnus/enfants, texte/HTML, projection valide/absente/invalide ; sources réordonnées et âge à horloge fixe. Pour les données : Current explicite/conflit/fallback/ties, archives, many-to-many, auth/purge, refresh raté avec ancien contenu et fanout borné. Portfolio/Basket/IA gardent leurs captures et tests de référence. La validation ne se limite pas à des assertions de source ou une seule fixture Advantest.

Artefacts exigés au Lot 4 : tests persistants de couverture partielle (paragraph + `to_do`, résidus dans listes/cellules), tests de rendu SSR des blocs/citations, stories consommant les composants de production, captures navigateur à 360/390 avec sections repliées et dépliées et mesure de largeur. Les références dépliées existantes sont notamment à 390 ; elles ne prouvent pas aujourd'hui un rendu déplié à 360. Les comparaisons mobile doivent donc compléter cette couverture, sans prétendre qu'une assertion Storybook de viewport est un test visuel.

## Checkpoint et estimation révisée

État acquis : baseline restaurable sur `pre-architecture-stabilization`, audit et cible versionnés sur la branche dédiée ; production Sites v207 et GitHub main inchangés. Les seules suppressions prouvées sont `readNotionStatus` (quatre lignes) et le type `NotionRelationRow` (une ligne), planifiées au Lot 5. Aucun fichier, parser, lecteur complet ou feuille CSS n'est déclaré mort.

Risques dominants : dépassements mémoire non profilés, restitution Notion partielle, sélection Current aujourd'hui ambiguë, écritures Notion non atomiques, faisabilité/auth MCP et gates macOS. Les adapters et contrats réduisent les couplages ; ils ne corrigent pas ces risques par leur simple existence.

Estimation indicative du travail actif restant, révisable à chaque gate ; ce n'est ni une date de livraison ni une mesure de consommation du quota :

| Ensemble | Sessions de travail estimées (60–90 min) |
| --- | --- |
| 3 — contrats/fixtures | 1–2 |
| 4/5 — convergence renderer et nettoyage | 3–5 |
| 6 — profilage, lectures ciblées et diagnostics | 2–4 |
| 7/8 — Core et adapter lecture/écriture | 3–5 |
| 9/10 — Skill et contrat MCP | 1–2 |
| 11/12 — serveur et migration plugin | 3–5 |
| 13 — validation finale et clôture | 1–2 |
| **Total restant** | **14–25 sessions**, hors attente utilisateur/fournisseur |

La largeur de la fourchette reflète surtout le profilage mémoire et les garanties de persistance/auth. **GO recommandé pour le Lot 3 uniquement**, avec fixtures de sélection et validation de contrat avant branchement UI. Aucun GO global pour les écritures, le MCP ou le déploiement n'est implicite. Arrêt obligatoire à ce checkpoint jusqu'à décision utilisateur.

## Bilan du Lot 2

- Découvertes confirmées par les revues : sept opérations cibles ne signifient pas sept fonctions déjà disponibles ; deux formats documentaires sont actifs ; une extraction Core seule ne résout pas les limites mémoire ou les écritures partielles.
- Modifications : cette cible et un avertissement de remplacement dans `docs/architecture.md`. Aucune suppression ; les cinq lignes mortes prouvées restent planifiées au Lot 5.
- Vérification : revue statique croisée de l'audit et des sources citées, responsabilité unique pour mapping/sélection/normalisation/rendu, matrice des gates et contrôle du diff documentaire. Aucun build, test applicatif ou capture supplémentaire requis par ce lot sans changement de runtime ; les limites de la baseline restent explicites.
- Résultat : cible reviewable et plan de migration défini ; aucune correction applicative revendiquée. Dette/risques : ceux de la debt map, priorisés ci-dessus, restent ouverts.
- Budget observé au checkpoint : compte Codex partagé à 54 % utilisés sur la fenêtre de cinq heures et 8 % sur la semaine ; un reset disponible, aucun utilisé. Ce relevé n'isole pas le coût du lot ni celui des agents.
- Décision : arrêt au checkpoint ; recommandation GO Lot 3, sous réserve du GO utilisateur.


## Checkpoint Lot 4 — renderer canonique

Gate préalable : les livrables documentaires Lots 2/3.5 ont été revus, commités et poussés sous `0f9752f3d8a1e05290a733607e7cd0bcd4566c09`; local et Cloud étaient propres et alignés avant l’implémentation.

Chemin obtenu : `CompanyDocument brut → normalizeAnalysisDocument → Analysis (contrat Lot 3 validé) → ViewModel → AnalysisReader → AnalysisBlockBody`. Le Mémo CIO conserve sa composition Decision Card/modules, avec le même corps canonique. Le ViewModel reprend résumé, faits, décision, raisonnement et membership scénarios/seuils du modèle canonique validé; les formats source conservent approximations, unités et espacements. Aucun branchement ticker/entreprise. Les formats Notion structurés et historiques HTML/Markdown passent par le dispatcher existant `parseNotionDocument`. Les previews utilisent le même normalizer; les réponses documentaires ne dupliquent plus texte brut/blocs/projection à côté du corps canonique.

Fichiers applicatifs modifiés :
- `app/components/analysis-reader.tsx`, `investment-memo-reader.tsx`, `analysis-presentation.tsx` : orchestration des compositions et rendu partagé des blocs canoniques.
- `app/components/analysis-section-groups.tsx`, `notion-table.tsx`, `scenario-comparison.tsx`, `latest-info-card.tsx` : sections/tableaux typés, libellés métier et preview cohérent.
- `app/lib/document-presentation.ts`, `notion-renderer.ts`, `notion-block-parser.ts`, `valuation-summary.ts` : normalisation unique, provenance, diagnostics, tableaux à deux colonnes, descendants/listes, scénarios indépendants de ponctuation et distinction CAGR actionnaire/EPS.
- `app/lib/inline-segments.ts` (47 lignes, nouveau), `inline-format.ts` : extraction pure de la syntaxe inline existante puis rendu des segments; aucun parser de document supplémentaire.
- `app/lib/investment-data.ts`, `company-preview.ts` : normalisation serveur et réponses compactes.
- `core/contracts/analysis.ts` : extensions `.ts` de deux imports runtime, sans changement de contrat.
- `tests/analysis-canonical-renderer.test.mjs` (328 lignes, nouveau), `tests/analysis-reference-fixtures.test.mjs`, `package.json` : 17 tests canoniques, migration des références vers le normalizer et enregistrement dans la suite.

Validation : typecheck, build direct `bash scripts/sites-env.sh -- node_modules/.bin/vinext build`, `npm run validate:artifact`, lint des fichiers modifiés et 202/202 tests Node PASS dans `/private/tmp/investment-os-lot4-validation`, sans réinstallation. La commande `npm test` complète reste bloquée sur macOS par le wrapper exigeant GNU `timeout`; le chemin avec espaces conserve la limite de test documentée en baseline. Aucun contournement ni modification du test CSS Cloud; lockfile inchangé. Le résultat Cloud Lot 3.5 demeure distinct de cette preuve locale du Lot 4.

Panel réel Notion : Advantest Valuation v9 (24/09), Nebius Q2 2026 (13/08), Booking Short v1 historique (11/08), TSMC Valuation v16 (22/09), NVIDIA Business v5 détenue mais Superseded (07/09), plus Advantest CIO historique (07/08). Validation du texte exporté HTML/Markdown; blocs Notion structurés/projections et toutes familles couverts par fixtures SSR. Aux viewports 360×800 et 390×844, toutes les sections se déplient et la largeur document reste égale au viewport. KPI/scénarios/seuils, tableaux et Decision Card vérifiés; aucun test sur matériel mobile physique. Captures PNG et mesures privées sous `outputs/lot4/`, ignorées par Git. La story ponctuelle, les rapports bruts et le log de debug sont supprimés après captures.

Portfolio et Basket : références des composants de production à 360/390, sans débordement; suites métier PASS. IA : recherche démo NVIDIA, workflow Valorisation et aperçu du prompt vérifiés dans l’application Vite réelle à 360/390, sans ouverture de conversation externe. La story Shell/IA échoue sur `process is not defined` dans `next/image` (fichiers IA/Storybook inchangés); aucune modification de configuration ajoutée pour le contourner.

Lot 5 : les anciens corps JSX Standard/Memo ont été remplacés. Garder les deux lecteurs de format, `RenderBlock`, `documentPresentation` et `extractValuationSummary`, encore consommés dans l’adaptation historique du normalizer; aucun de ces fichiers n’est déclaré mort. Restent à examiner les wrappers inline et l’union legacy de sections, ainsi que `readNotionStatus`/`NotionRelationRow` déjà prouvés morts au Lot 2. Toute suppression exige une recherche de consommateurs. Le GO provisoire est retiré par la revue stricte ci-dessous; Lot 5 non commencé. Aucun déploiement.


### Revue stricte Lot 4 — NO-GO Lot 5

Sites confirme la production v207, commit `bf77b919705127e42f880ca6d0785db4feffab85`, déploiement réussi le 29/09. Le chemin canonique Lot 4 est local et non déployé; la production exécute encore les lecteurs de la baseline. Aucun renderer/parser de document concurrent ajouté dans le diff local; les deux formats restent nécessaires.

Blocage fonctionnel reproduit en normalisation et SSR : dans le raisonnement CIO, `[le rapport annuel](https://example.com/annual-report)` conserve son `href` dans le bloc canonique, mais `memo.reasoning` concatène seulement `segment.text`. Le bloc source est masqué et le HTML du lecteur ne contient plus l’URL. Cette régression doit être corrigée en conservant les blocs canoniques du raisonnement et en utilisant `AnalysisBlockBody`, puis couverte par un test SSR de lien source.

Blocage de preuve : `outputs/lot4/portfolio-360.png` contient un spinner, pas un portefeuille chargé. La preuve visuelle Portfolio à 360 doit être refaite; cela ne prouve pas une régression du code. Les captures Basket/IA et Portfolio 390 sont exploitables. Le panel des six exports réels et la couverture structurée/projections par fixtures restent valides dans leurs limites; ils ne constituent pas une validation de production après déploiement.

Les 202 tests existants passent et la copie de validation correspond aux sources, mais ne couvrent pas la perte de lien ci-dessus. Build direct/typecheck/artefact restent validés; limitations macOS/chemins avec espaces/Cloud CSS inchangées. Seuls `readNotionStatus` et `NotionRelationRow` sont déjà prouvés morts; wrappers inline/shortDate et union legacy nécessitent migration/recherche avant retrait. Aucune suppression ni changement applicatif pendant cette revue. NO-GO Lot 5 jusqu’à correction du lien, validation SSR et preuve Portfolio 360 chargée.

### Clôture ciblée Lot 4.1 — GO Lot 5

Le raisonnement CIO conserve désormais ses blocs canoniques et utilise `AnalysisBlockBody`; le lien est préservé après sérialisation API et rendu SSR. Correction limitée à `document-presentation.ts`, `investment-memo-reader.tsx`, au test SSR ciblé et au lien de la fixture Memo existante dans `stories/Reader.stories.tsx`.

Les trois tests ciblés (lien CIO, compositions du lecteur, preview), le typecheck et le build direct passent. Vérification visuelle CIO à 360 px : lien visible dans « Raisonnement décisif ». Portfolio à 360 px : synthèse et positions chargées, aucun spinner ni débordement; la capture précédente montrait le chargement transitoire Storybook. Aucune correction Portfolio nécessaire. Captures sous `outputs/lot41/`, ignorées par Git.

Les deux blocages de la revue précédente sont levés : GO Lot 5, avec recherche des consommateurs avant chaque suppression. Aucun nouveau renderer/parser, aucun déploiement, aucune revalidation complète du panel ni réaudit Basket/IA; limitations déjà documentées inchangées. Lot 5 non commencé.

### Clôture Lot 5 — nettoyage avec preuves

Reprise locale depuis `7e988b65ca7103c153835ed76740860134de4630`. Les six lignes retirées dans Cloud ont été reprises ici après vérification; le premier bilan Cloud était incomplet pour clôturer ce lot. Sites reste à la version sauvegardée v207, source de la baseline, à la vérification du 30/09.

| Catégorie | Retrait ou conservation vérifié |
| --- | --- |
| Renderers | Le callback Standard et `MemoBlock` ont déjà été remplacés au Lot 4. Aucun ancien corps restant; `AnalysisBlockBody` est partagé par les deux compositions actives. |
| Parsers | Garder `parseNotionBlocks` et `parseNotionText`, appelés par `parseNotionDocument`; structuré partiel et rapports historiques restent couverts. Le dispatcher et le normalizer ne sont pas des parsers concurrents. |
| Helpers | Retirer `readNotionStatus`, sans référence; garder le client actif `readBrowserNotionStatus`. Retirer les deux wrappers `inline()`: `renderInlineFormat` appelle déjà `inlineSegments`, qui traite l’échappement de tilde. Garder les dates encore appelées. |
| Compatibilité/types/imports | `AnalysisSectionGroups` reçoit uniquement des `AnalysisBlock[]` en production. Retirer son union `RenderBlock`, les branches de titre string, les imports associés et deux casts des lecteurs. Migrer le test SSR historique avec `canonicalAnalysisContent`, IDs et assertions H1/H2/H3/faits conservés. Retirer `NotionRelationRow`, sans consommateur. |
| Fallbacks | Garder structuré vide/partiel vers texte, projection absente/invalide, résumé absent et scénarios partiels: corps, diagnostics et sources restent nécessaires. `documentPresentation` et `extractValuationSummary` restent appelés par le normalizer; aucune suppression de fichier justifiée. |
| CSS | Audits dead CSS, gouvernance et ownership conformes; zéro candidat supprimable. Les styles ciblent encore le DOM canonique, responsive et focus inclus. Aucun CSS retiré. |

Mesures hors tests/docs: **20 lignes ajoutées, 37 supprimées, net −17**, cinq fichiers produit modifiés, zéro fichier supprimé. Test migré: +7/−4, sans nouveau test ni fichier. Comptage des dispatchers de corps JSX: **2 avant Lot 4 → 1 à l’entrée du Lot 5 → 1 après Lot 5**; compositions Standard/CIO exclues du comptage. Parsers de format: **2 → 2 → 2**, dispatcher unique conservé. Les suppressions du Lot 4 ne sont pas comptabilisées dans les LOC du Lot 5.

Validation locale: **203/203 tests Node PASS** dans la copie sans espaces actualisée, typecheck, build direct, validation d’artefact, lint ciblé et diff-check PASS. HTML SSR strictement identique avant/après pour huit fixtures existantes (six familles, Advantest, TSMC), à horloge fixe. Aucune nouvelle campagne du panel privé ou capture mobile: DOM et CSS inchangés sur cette comparaison. Sondes SSR temporaires supprimées; aucun script de diagnostic ajouté. Wrapper macOS GNU timeout et échec CSS Cloud préexistant restent distincts et inchangés; lockfile et test CSS inchangés.

Revue Sol des preuves et du diff Luna: **GO Lot 6 recommandé**, soumis à décision utilisateur. Aucun Lot 6 commencé, changement de méthodologie, infrastructure ou déploiement.

### Revue Lot 6 — candidat validé localement, gate Cloud ouvert

Travail autorisé après commit du Lot 5 `4db2a85846126481d6331bcb1033f8e1802b42ba`, sur la même branche. Trois agents Luna ont réalisé lectures, fiabilité/tests et mesures; Sol a arbitré et revu les changements. Aucun déploiement, dépendance, migration, cache concurrent, TTL modifié ou nouveau renderer/parser.

Deux causes distinctes sont établies : les 500 de la baseline v207 correspondent aux logs runtime `exceededMemory`; leur allocation précise n'est toujours pas profilée. Dans le code Lot 4, la garde Company ignorait `normalizedAnalysis` après suppression des champs bruts : elle refusait donc un corps canonique valide. La garde accepte maintenant un contrat `isAnalysis` valide avec identité interne/externe concordante et blocs non vides. Les tests SSR couvrent sérialisation, ancien contenu pendant erreur de refresh, mauvais ID, contrat invalide et texte legacy.

Les lectures Company sélectionnent d'abord les métadonnées, puis chargent uniquement les corps de leurs candidats, archives incluses pour préserver les résumés. Le document individuel charge un seul corps, et ses relations sont ciblées. Les lots d'IDs (80) sont séquentiels; les index existants sont utilisés. Le listing ordinaire omet `blocks_json`, conserve la fenêtre de résumé 700 caractères; l'intégrité explicite conserve la lecture complète. Les métadonnées globales nécessaires à la sélection Current/archive restent proportionnelles au corpus : aucune pagination, dérivation persistée ou borne dure du nombre d'archives n'est prétendue acquise.

Le cache existant conserve données, single-flight, epoch/revision/abort et purge auth. Son diagnostic optionnel distingue réseau, timeout, HTTP, introuvable, parse de réponse, stockage et normalisation. Les réponses obsolètes sont écartées. La route Analysis personnelle fournit `x-request-id`, `Server-Timing` et un log d'échec limité à événement/identifiant/code/étape/durée; aucun corps ni message DB privé. Une interruption mémoire avant le catch nécessite encore la corrélation avec les logs runtime. Le mapping permissif des propriétés legacy reste une limite du Lot 8.

Mesures comparables : même fixture SQLite (60 companies, 180 rapports), source baseline figée `4db2a85`, candidat final, un premier appel après initialisation puis 30 appels chauds, `--expose-gc`. Ce ne sont ni D1 distant ni SLA Cloud.

| Lecture | Premier appel ms avant → après | Médiane / p95 chauds ms avant → après | SQL/appel avant → après | Corps complets/appel avant → après |
| --- | ---: | ---: | ---: | ---: |
| Liste analyses | 165,3 → 97,0 | 171,6 / 307,7 → 68,8 / 80,6 | 14 → 14 | 180 → 0 |
| Company | 170,4 → 83,5 | 122,0 / 220,2 → 54,5 / 64,4 | 13 → 13 | 180 → 3 |
| Document | 69,2 → 49,1 | 61,9 / 73,8 → 44,5 / 48,9 | 15 → 14 | 181 → 1 |
| Portfolio vide synthétique | 9,6 → 6,7 | 6,8 / 12,4 → 5,7 / 6,0 | 12 → 12 | 0 → 0 |

Octets JSON des lignes SQL simulées : Company 4 014 402 → 310 579; Document 4 059 427 → 289 384. Réponse liste 3 924 499 → 214 147 octets; réponses Company (71 389) et Document (23 543) inchangées. Sélections/principales/archives et preview identiques sur la fixture comparative, hors retrait intentionnel des corps du listing et horodatages générés. Tests SQLite distincts : IDs compacts/avec tirets/majuscules contenant des lettres, relations absentes, plusieurs propriétaires, résumé tardif, HTML historique, memo/décision séparés, projection invalide.

Normalisation moyenne/appel : Company 5,93 → 3,64 ms (3 normalisations), Document 1,57 → 1,26 ms (1). Sérialisation liste 11,21 → 0,52 ms. SSR `AnalysisReader` : médiane 9,51 → 9,36 ms, p95 11,88 → 12,07 ms, HTML identique de 10 712 octets. CPU et heap sont mesurés par le benchmark existant; le maximum heap échantillonné est une borne inférieure sensible au GC, pas une preuve d'allocation Worker. Les plans conservent des scans de métadonnées et tris temporaires; la compatibilité d'ID normalisée peut scanner les headers à défaut d'une clé exacte.

Chrome local, même parcours démo à 360 px, caches applicatifs vides après reload puis retour immédiat Synthèse→Business : un fetch Analysis à froid dans chaque version, zéro doublon; aucun appel API au retour chaud dans la fenêtre de fraîcheur. Fetch complet 42,1 → 55,2 ms (échantillons uniques, pas de gain démontré). Durée layout/style à froid 3,13 → 7,58 ms, à chaud 5,54 → 5,36 ms; temps Script à chaud 38,26 → 47,23 ms. Ce sont des deltas CDP, pas click→paint. Le parcours démo n'exerce pas D1 personnel; normalisation et SSR sont mesurés séparément ci-dessus.

Vérification supplémentaire de l'artefact compilé avec Wrangler **local**, DB locale et sans publication : Portfolio, Business et IA chargent à 360 px, zéro erreur console, Business sans débordement. Basket démo charge sur le serveur de validation. Captures dans `outputs/lot6/`, ignorées par Git. Le warning de snapshot session est reproduit sur le checkpoint précédent; l'overlay `next/image` d'un serveur Vite du checkout n'apparaît ni dans la copie sans espaces ni sur l'artefact compilé. Collision de cache Vite partagé plausible, cause exacte non démontrée; aucune correction produit opportuniste.

Validation finale : **211/211 tests Node**, typecheck, build direct, validation d'artefact, lint des dix fichiers modifiés et `git diff --check` conformes. Sources validées dans la copie sans espaces; limitations du wrapper macOS/GNU timeout et du test CSS Cloud préexistant inchangées. Lockfile et test CSS ownership inchangés. Diff produit : cinq fichiers, +223/−29, net +194; tests/benchmark existants : cinq fichiers, +448/−32. Aucun fichier produit ajouté ou supprimé; le présent checkpoint est la seule documentation ajoutée. Le candidat reste non commité pour revue; aucun Lot 7 commencé.

**Verdict : GO sur le candidat local, NO-GO pour clôturer définitivement le Lot 6 et commencer le Lot 7.** La baisse de corps chargés est prouvée; la disparition de `exceededMemory`, les allocations responsables et les parcours froid/chaud sur le corpus personnel dans le runtime Cloud ne le sont pas. Le gate restant est cette validation runtime du candidat, avec logs corrélés et même corpus, sans masquer un échec par du cache ou une modification de tests.
