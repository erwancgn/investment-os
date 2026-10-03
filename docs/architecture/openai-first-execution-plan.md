# Investment OS — vision figée OpenAI-first et plan d’exécution Lots 7.2–13

> Statut : décision d’architecture figée le 1 octobre 2026.
>
> Cette note complète `target-architecture.md` et `lot-8-handoff.md`. Elle ne remplace ni les contrats du domaine, ni les gates de chaque lot. En cas de conflit sur l’état courant, la passation du lot en cours prévaut. En cas de conflit sur la vision cible des lots 8–13, cette note prévaut jusqu’à décision utilisateur explicite contraire.

## 1. Décision produit et principe directeur

Investment OS est **OpenAI-first en exploitation**, parce que l’usage réel prévu reste principalement dans l’écosystème OpenAI :

- ChatGPT et Codex pour l’usage agentique ;
- le plugin `Investment OS Analysis` pour regrouper Skills et outils ;
- les Skills pour la méthodologie financière ;
- ChatGPT Sites pour l’application actuelle et, si les gates du Lot 11 le valident, comme première cible d’hébergement du serveur MCP ;
- MCP comme transport standard entre les agents et Investment OS.

Cette préférence d’exploitation ne doit pas devenir un verrou d’architecture.

Le principe à préserver est :

> **OpenAI-first, pas OpenAI-locked.**
>
> Sortir d’OpenAI ultérieurement doit principalement remplacer le runtime, le transport ou l’intégration agentique. Cela ne doit pas imposer de réécrire les règles métier, les contrats, le modèle canonique, les calculs ou les adapters de données.

Conséquence : le Core et les contrats ne doivent dépendre ni de ChatGPT, ni de Sites, ni du SDK OpenAI, ni de MCP. Le MCP est un transport. Les Skills sont une couche de méthodologie. La PWA est une interface. Notion/D1 sont une implémentation de persistence/cache actuelle.

## 2. Ce qui est vrai aujourd’hui

### 2.1 Production réellement déployée

La production reste **Sites v208**, issue du Lot 6 :

- source Lot 6 : `9f98a7f7a20adef95c591a583fe60a70e04a8e38` ;
- le Lot 7 n’est pas déployé ;
- Notion reste la vérité documentaire ;
- D1 reste le snapshot/cache technique et la file technique ;
- le Worker Sites sert les routes HTTP, auth, sync et composition ;
- la PWA React/Vinext consomme ces routes.

Le runtime de production ne contient donc pas encore la cible Core complète du chantier et ne contient pas de serveur MCP Investment OS.

### 2.2 Branche d’architecture

Branche canonique du refactor :

`chore/architecture-stabilization-mcp`

Checkpoint produit du Lot 7 :

`0d8853eced6d28e5bd861916c92ac9da16c5499b`

Checkpoint documentaire de consolidation Lot 7.1 :

`4347182e17d7a72a54f84662f37ed9be9d3234dd`

Le Lot 7 a introduit :

- `core/contracts/` ;
- `core/analysis/current-selection.ts` ;
- `core/portfolio.ts` ;
- `core/services/investment-os.ts` ;
- `core/services/ports.ts` ;
- `adapters/notion/investment-reads.ts` ;
- des migrations de consommateurs de lecture ;
- les tests Core/adapters associés.

### 2.3 Ce qui est déjà réellement branché sur la branche du chantier

Le Core fournit les opérations suivantes :

- `getCompany()` ;
- `getPortfolio()` ;
- `getPosition()` ;
- `getCurrentAnalysis()` ;
- `listAnalyses()` ;
- `saveAnalysis()` ;
- `getQuote()` ;
- `getAnalysisById()`.

État runtime :

| Opération | État |
| --- | --- |
| `getCompany` | pont Core actif pour le détail Company personnel, transport historique préservé |
| `getPortfolio` | pont Core actif sur le Portfolio personnel |
| `getAnalysisById` | pont Core actif ; archives et historiques restent adressables |
| `getQuote` | pont Core actif via le batch de quotes existant |
| `listAnalyses` | utilisé pour l’intégrité dans le mode prévu |
| `getCurrentAnalysis` | implémenté et testé, mais **pas encore basculé comme politique Current unique du runtime/UI** |
| `getPosition` | contrat/service présent, pas d’adapter runtime réel final |
| `saveAnalysis` | contrat/service présent, aucun writer Notion réel final ; une sync D1 n’est pas une sauvegarde métier |

Le Core n’est donc pas « terminé » au sens migration. Il est suffisamment matérialisé pour tester ses frontières, mais son adoption finale dépend des gates du Lot 7.2 et du Lot 8.

## 3. Où vivent les responsabilités dans la cible

### 3.1 Investment Core

Le Core porte les règles métier et les politiques de domaine :

- identité et validation canonique ;
- politique Current/archive ;
- agrégats Portfolio ;
- contracts de Company/Analysis/Position/Portfolio/Quote ;
- orchestration des opérations métier ;
- erreurs et diagnostics de domaine ;
- validation des receipts d’écriture.

Le Core ne doit pas connaître :

- les noms de propriétés Notion ;
- D1 ;
- HTTP ;
- cookies/auth Sites ;
- React ;
- ChatGPT ;
- MCP ;
- le SDK OpenAI ;
- les prompts ou méthodes financières des Skills.

### 3.2 Adapter Notion

L’adapter Notion porte la traduction entre la persistence actuelle et les contrats du Core :

- IDs Notion ;
- propriétés physiques ;
- relations ;
- alias de propriétés ;
- statuts ;
- dates ;
- extraction des pointeurs Current ;
- lecture/sync des snapshots D1 lorsque D1 est la projection locale de Notion ;
- écriture métier Notion au Lot 8 ;
- reprise, retry, idempotence et vérification des écritures.

Le Core reçoit des valeurs déjà normalisées.

### 3.3 D1

D1 reste un composant technique :

- snapshots ;
- cache ;
- index ;
- files de jobs/import ;
- verrous ;
- événements webhook ;
- données de quotes mises en cache.

D1 n’est pas la vérité documentaire et ne doit pas devenir une seconde logique métier.

### 3.4 PWA / UI

La PWA reste l’application utilisateur Investment OS :

- Portfolio ;
- Exposition ;
- Trajectoire ;
- Companies ;
- Company detail ;
- analyses ;
- Basket ;
- AI ;
- Gestion ;
- démo/personnel.

Elle consomme des routes Worker/API et des résultats du Core. Elle ne doit plus décider elle-même quelle analyse est Current, remapper Notion ou réimplémenter les calculs Core.

### 3.5 Skills

Les Skills du plugin `Investment OS Analysis` portent l’intelligence analytique et la méthodologie :

- business-analyst ;
- fair-value ;
- short-seller ;
- portfolio-fit ;
- investment-memo-cio ;
- full-value ;
- full-analyse ;
- autres workflows explicitement maintenus par le plugin.

Ils décident **comment analyser** une entreprise. Ils ne doivent pas contenir la politique de stockage, le mapping Notion ou une copie de la politique Current.

### 3.6 MCP

Le MCP expose les capacités Investment OS aux agents.

Il doit rester une couche mince :

```text
ChatGPT / Codex
      |
      v
Plugin + Skills
      |
      v
MCP transport
      |
      v
Investment Core
      |
      v
ports/adapters
```

Le MCP ne doit pas décider :

- quelle analyse est Current ;
- comment déterminer un owner ;
- comment reconnaître une archive ;
- comment calculer un portefeuille ;
- comment sélectionner une version ;
- comment interpréter les propriétés physiques Notion.

Il valide l’entrée transport, appelle le Core et traduit le résultat du Core vers le protocole MCP.

## 4. Architecture cible figée

```mermaid
flowchart TB
  User[Utilisateur] --> PWA[Investment OS PWA]
  User --> Chat[ChatGPT / Codex]

  Chat --> Plugin[Investment OS Analysis plugin]
  Plugin --> Skills[Skills analytiques]
  Skills --> MCP[MCP Investment OS]

  PWA --> Worker[Worker / API]
  MCP --> Core[Investment Core]
  Worker --> Core

  Core --> Ports[Ports du Core]
  Ports --> NotionAdapter[Adapter Notion]
  Ports --> MarketAdapter[Adapter market data]

  NotionAdapter --> D1[(D1 technique)]
  NotionAdapter --> Notion[Notion vérité documentaire]
  MarketAdapter --> Quotes[Providers quotes / FX]
```

Le diagramme est logique, pas une obligation de processus séparés. Au Lot 11, le MCP peut vivre dans le même runtime Sites que l’application si l’isolation, les permissions et les contraintes runtime sont validées. Un second Site technique n’est créé que si une contrainte démontrée le justifie.

## 5. Portabilité : ce qui doit pouvoir sortir d’OpenAI

Doivent rester portables :

- `core/contracts/*` ;
- services Core ;
- sélection Current ;
- calculs Portfolio ;
- modèle canonique ;
- contrats MCP en tant que schémas, sans dépendance runtime Sites ;
- adapters de données ;
- tests de domaine ;
- normalisation et règles de mapping qui ne sont pas spécifiques au runtime OpenAI.

Sont explicitement autorisés à être OpenAI-spécifiques :

- publication Sites ;
- auth/audience Sites ;
- configuration de plugin ;
- packaging du plugin ;
- intégration du MCP hébergé par Sites ;
- expérience ChatGPT/Codex ;
- permissions OpenAI de plugin/Site.

La sortie future d’OpenAI n’est **pas** un lot du chantier actuel. Elle est seulement rendue praticable par les frontières ci-dessus.

## 6. Roadmap globale figée

| Lot | Objet | État au 01/10/2026 | Gate |
| --- | --- | --- | --- |
| 0 | Baseline | terminé | état restaurable et preuves baseline |
| 1 | Debt map | terminé | dette et doublons factuels |
| 2 | Architecture cible | terminé | frontières et dépendances |
| 3 | Contrats domaine | terminé | contrats et selector pur |
| 3.5 | Reproductibilité Codex Cloud | terminé | environnement documenté |
| 4 / 4.1 | Renderer canonique | terminé | rendu partagé, corrections ciblées |
| 5 | Nettoyage | terminé | code remplacé retiré avec preuves |
| 6 | Performance / lectures ciblées | terminé et déployé | recette production v208 |
| 7 | Core | implémenté, **gate final ouvert** | parité réelle Current |
| 8 | Adapter Notion lecture/écriture | NO-GO avant clôture Lot 7 | mapping complet + writer vérifié |
| 9 | Skill permanent | futur | chemin stabilisé et règles anti-duplication |
| 10 | Contrat MCP | clos | contrat 1.0.0 ; passation `lot-10-handoff.md` |
| 11 | Serveur MCP | futur | serveur mince sur Core, runtime validé |
| 12 | Migration plugin → MCP | futur | parité méthodologique, receipts et persistence |
| 13 | Clôture | futur | non-régression globale, sécurité, perf, docs |

## 7. Lot 7.2 — mission immédiate

Le Lot 7.2 est le seul travail autorisé avant le Lot 8, sauf documentation explicitement demandée.

Objectif : démontrer que la politique `getCurrentAnalysis()` du Core peut remplacer la politique legacy sans masquer d’écart inexpliqué.

Résultats Lot 7.1 déjà acquis :

- Cadence Business : même sélection legacy/Core ;
- Advantest Business : même sélection ;
- Advantest Valuation : même sélection ;
- KLA Business/Valuation : legacy fallback vers v2 ; pointeur réel vers v1 Superseded ; classification `DATA_INCONSISTENCY` + `EXPECTED_POLICY_CHANGE` ; aucun `CORE_BUG`.

Preuves encore requises :

- index/relations D1 nécessaires à la sélection ;
- conflits d’owner éventuels ;
- branches du graphe réel non encore suffisamment couvertes ;
- complément many-to-many/fallback/dates uniquement si les preuves existantes restent insuffisantes.

Chaque divergence doit être classée :

- `CORE_BUG` ;
- `MAPPING_BUG` si un mapping d’adapter est réellement en cause ;
- `LEGACY_BUG` ;
- `DATA_INCONSISTENCY` ;
- `EXPECTED_POLICY_CHANGE`.

Ne pas modifier le Core pour reproduire une anomalie legacy ou une incohérence de données. Un correctif Core exige un `CORE_BUG` démontré.

Gate Lot 7 :

- toutes les divergences significatives expliquées ;
- aucune branche critique du graphe Current non couverte ;
- aucune donnée personnelle/export brut ajouté à Git ;
- verdict GO/NO-GO explicite ;
- passation mise à jour avant tout début du Lot 8.

## 8. Lot 8 — Adapter Notion complet

### Objectif

Faire de Notion une dépendance remplaçable derrière les ports du Core, tout en conservant Notion comme vérité documentaire pendant ce chantier.

### Lecture

Déplacer/centraliser dans l’adapter tout ce qui connaît :

- noms de propriétés Notion ;
- relations ;
- alias ;
- UUID physiques ;
- classification des familles ;
- statuts/fraîcheur ;
- dates ;
- pointeurs Current ;
- mapping snapshots D1.

Ne pas créer un second parser ou une seconde politique Current.

### getPosition

Livrer un vrai adapter runtime :

- lookup par ID stable ;
- position ouverte ou fermée ;
- ne pas déduire l’historique complet du seul portefeuille live ;
- mêmes règles de calcul et provenance que le domaine ;
- tests de position absente, fermée, ouverte et incohérente.

### saveAnalysis

Le writer doit être une vraie opération métier, pas un alias de sync.

Contrat minimal à garantir :

- `runId` idempotent ;
- `expectedRevision` / contrôle de concurrence ;
- validation de la Company et des relations ;
- écriture du document ;
- promotion Current lorsque demandée ;
- relecture après écriture ;
- vérification que la cible persistée correspond au résultat attendu ;
- retries sûrs ;
- distinction d’un succès partiel ;
- diagnostic exploitable sans exposer de secret.

Le receipt du Core doit rester capable de distinguer :

- `persisted` ;
- `promotion_pending` ;
- `verified` ;
- `partial`.

Les détails exacts du mécanisme Notion (CAS natif ou séquence réconciliable) appartiennent à l’adapter. Ne jamais faire promettre au Core une atomicité que Notion ne garantit pas réellement.

### Gate Lot 8

- mappings physiques isolés ;
- lecture réelle par les ports ;
- `getPosition` réel ;
- `saveAnalysis` réel ;
- idempotence/retry/concurrence testés ;
- receipts prouvés ;
- auth/secrets inchangés ou améliorés ;
- aucune mutation navigateur non autorisée ;
- aucune régression PWA/Portfolio/Basket/analyses.

## 9. Lot 9 — Skill permanent

Le Lot 9 n’est pas une réécriture méthodologique.

Objectifs :

- documenter le chemin stabilisé entre Skills, MCP, Core et adapters ;
- figer les responsabilités ;
- empêcher le retour de logique dupliquée ;
- conserver Investment OS Analysis comme source canonique de la méthodologie financière.

Interdits :

- politique Current dans un Skill ;
- mapping Notion dans un Skill ;
- calcul Portfolio dupliqué dans un Skill ;
- nouvelle méthode financière dans le Core ;
- logique d’hébergement OpenAI dans les Skills ;
- modification du contenu/méthode des Skills au motif de la migration MCP.

Livrable attendu : instructions permanentes/skill de développement ou documentation équivalente qui force les prochains changements à respecter le chemin canonique.

Source permanente de développement : `AGENTS.md`, sections « Architecture permanente et propriétaires canoniques » et « Secrets ». Compléter cette source plutôt que créer une seconde couche d’instructions. État de clôture et passation Lot 10 : `docs/architecture/lot-9-handoff.md`.

## 10. Lot 10 — contrat MCP

### Rôle

Définir le langage stable entre Investment OS et les agents avant de choisir les détails d’hébergement.

### Principe

Le contrat MCP est **runtime-agnostic**. Le même contrat doit pouvoir être servi depuis Sites ou un runtime indépendant.

### Contrat canonique 1.0.0 (Lot 10 clos)

Définition normative : `contracts/mcp.ts` (types, noms, descriptions, mapping et limites), avec les schémas JSON Schema draft-07 dans `contracts/mcp.v1.schema.json`. Le présent paragraphe porte les règles opérationnelles communes à **chacun** des tools. Aucun serveur ni dispatcher n'est implémenté. Le dossier `contracts/`, déjà envisagé par l'architecture cible et absent du checkout, distingue le contrat de transport des contrats de domaine `core/contracts/` ; le Core n'importe jamais MCP.

Les schémas sont générés depuis les types avec la dépendance TypeScript déjà installée (`node scripts/generate-mcp-schemas.mjs`, contrôle `--check`). Ils décrivent la structure JSON ; la validité métier, les relations entre champs, les dates, la sélection Current, les agrégats et la cohérence des receipts restent vérifiés par les validateurs/services Core existants. Une conformité JSON Schema seule n'autorise donc jamais une écriture. Le générateur ne constitue pas un validateur métier alternatif.

### Surface minimale et mapping exact

Tous les inputs ont `contractVersion: "1.0.0"` et `scope: "personal" | "demo"`, obligatoires. Les propriétés inconnues sont refusées. Les identifiants sont opaques, non vides, sans espaces périphériques, de 512 caractères maximum ; aucun format physique ou normalizer de source dans MCP. Les arguments supplémentaires figurent ci-dessous. Les schémas de chaque tool sont `tools.<nom>.inputSchema` et `tools.<nom>.outputSchema` dans le bundle, à résoudre **avec ses definitions locales** ; le Lot 11 devra les rendre autonomes lors de leur annonce au protocole.

| Tool stable | Mode | Arguments métier → appel Core exact | Donnée du résultat Core | Justification |
| --- | --- | --- | --- | --- |
| `get_company` | READ | `id` → `getCompany(id)` | `CompanyPreview \| null` | Worker `/api/companies/:id`, Company : identité, aperçus et archives nécessaires à la recherche |
| `get_portfolio` | READ | `options?` → `getPortfolio(options)` | `Portfolio` | Worker `/api/portfolio/live`, holdings et contexte de portefeuille existants |
| `get_position` | READ | `id, options?` → `getPosition(id, options)` | `Position \| null` | Besoin d'une position fermée adressable hors holdings, couvert par le service et les tests Lot 8 ; pas encore de route UI dédiée |
| `get_current_analysis` | READ | `companyId, family` → `getCurrentAnalysis(companyId, family)` | `Analysis \| null` | Dépendances analytiques de la cible Skills ; politique Core déjà implémentée/testée, pas une nouvelle sélection UI |
| `get_analysis_by_id` | READ | `id` → `getAnalysisById(id)` | `Analysis \| null` | Worker `/api/analyses/:id`, navigation et `DocumentHistory` dans Company : lecture historique/archivée réelle, inaccessible via Current seul |
| `save_analysis` | WRITE | `input` → `saveAnalysis(input)` | `SaveAnalysisReceipt` | Publication/reprise validée au Lot 8 ; future migration de la persistance des agents |
| `get_quote` | READ | `assetId, options?` → `getQuote(assetId, options)` | `Quote` | Batch de quotes du Worker et besoins de prix explicites, sans recalcul dans les Skills/transport |

`options` réutilise exactement `ReadOptions` : `force?: boolean`, `cacheOnly?: boolean`. Aucun défaut de transport ne transforme ces valeurs. Les deux champs peuvent coexister ; leur traitement reste celui du port. `family` Current : business, valuation, short, portfolio, cio_memo, decision, earnings.

**Écarté : `list_analyses`.** Le seul appel runtime Core trouvé est `listAnalysesForIntegrity` de l'audit technique `/api/notion/integrity`. Cet audit global ne justifie pas un tool agent supplémentaire. Les aperçus Company comprennent les historiques/archives et le tool par ID hydrate leur corps. Pas de tool d'intégrité, de sync, de batch ou de CRUD ajouté mécaniquement. Les usages du Worker justifient la surface, mais ses wrappers HTTP historiques ne sont pas les sorties MCP : le Lot 11 doit composer les ports Core, pas retourner ces wrappers.

### Sortie, erreurs et diagnostics

Sortie normale : `{ contractVersion, scope, status: "completed", result: ServiceResult<T> }`. `result` est le résultat Core, sans recalcul ni interprétation de succès. `result.schemaVersion` reste la version de domaine, indépendante du contrat MCP. Une absence peut être `status: "ok", data: null` ; elle n'est pas convertie mécaniquement en `not_found`.

Rejet transport : `{ contractVersion: "1.0.0", scope: personal | demo | null, status: "rejected", error: { code, message, retryable, outcome }, diagnostics }`. `scope: null` si aucun scope valide n'a été obtenu. `outcome: "not_started"` garantit qu'aucun appel Core n'a commencé ; `"unknown"` signifie que l'appel a commencé sans résultat observable. Un WRITE avec outcome unknown **ne prouve ni échec ni rollback**. Une panne du canal peut empêcher toute réponse ; le caller doit alors considérer le résultat du WRITE inconnu.

Erreurs Core préservées : `invalid_input`, `unsupported_version`, `not_found`, `unauthorized`, `forbidden`, `mapping`, `normalization`, `storage`, `dependency`, `rate_limit`, `timeout`, `network`, `cache`, `stale_request`. Erreurs transport : `invalid_input` (JSON/structure), `unsupported_version` (contrat absent du catalogue), `unauthorized` (identité absente/invalide), `forbidden` (permission/scope/ressource), `confirmation_required`, `limit_exceeded`, `timeout`, `network`, `rate_limit`. Les erreurs de validation/auth/version/limite ne sont pas retryable ; timeout/network/rate_limit peuvent l'être pour READ, jamais comme permission de retry aveugle WRITE. Le champ Core `retryable` reste intact et n'écrase pas cette règle transport.

Diagnostics : `Diagnostic` existant (`code`, message humain, severity info/warning/error, path optionnel). Ceux du Core et du receipt sont conservés dans leurs propriétaires, notamment les avertissements Current, fraîcheur et persistance. Les diagnostics transport utilisent des codes fixes (`input_schema`, `contract_version`, `caller_auth`, `scope_permission`, `mutation_confirmation`, `payload_limit`, `transport_timeout`, `transport_network`, `transport_rate_limit`) et des messages génériques. Aucune exception brute, SQL, table, propriété physique, stack, credential ou en-tête d'auth ne doit être exposé. Le Lot 11 doit contrôler l'innocuité des messages produits avant exposition, sans traduire un diagnostic métier en nouvelle décision métier.

Les données réutilisent les contrats Core tels quels. Les libellés hérités `notionUrl`, `provenance.kind` ou `pruSource` sont des métadonnées opaques du domaine existant, **pas** des noms de propriétés physiques ni des instructions d'accès à une source. Le transport ne les interprète pas, ne normalise pas les UUID et ne mappe aucune propriété Notion. Une source future peut fournir ses liens/provenances via son adapter. Pas de schéma physique Notion/D1, React, Worker, secret, SDK OpenAI ou méthode financière ajouté.

### Identité, permissions et confirmation

Le contexte d'identité est vérifié hors payload par le futur transport : sujet opaque authentifié, droits READ/WRITE, scopes autorisés et rattachement au jeu de données personnel. Aucun `callerId`, rôle, tenant, token ou propriétaire auto-déclaré par l'agent dans les arguments. Le mécanisme d'auth (session, jeton, délégation) et le runtime restent ouverts au Lot 11.

Pour chaque READ : permission `investment:read` et accès au scope demandé ; pour `save_analysis` : `investment:write` et accès personnel, **sans déduire WRITE de READ**. Les deux permissions restent distinctes. READ démo exige aussi une identité reconnue et un droit démo ; un contexte démo anonyme doit être attribué explicitement par une politique runtime future, jamais déduit de `scope`. WRITE démo est toujours forbidden en v1, sans appel Core. Toute référence doit appartenir au jeu de données autorisé : autoriser le scope seul ne suffit pas ; le Lot 11 devra composer des ports isolés et vérifier l'accès aux ressources/références avant mutation. Refus sans révéler l'existence d'une ressource hors périmètre, et aucun fallback personal → demo.

La confirmation d'une mutation relève de la politique de délégation du caller vérifié. Une délégation WRITE explicite peut couvrir les opérations normales ; sinon `confirmation_required` avant Core. Aucune confirmation booléenne auto-déclarée dans le payload, aucun changement de cette politique par le tool. Une approbation est liée à l'identité, au scope et à l'intention exacte ; une intention modifiée exige une nouvelle approbation. L'implémentation du mécanisme est Lot 11.

Logs permis : identifiant de corrélation généré par le transport, tool, version, scope, mode, code d'erreur et durée. Pas de payload complet, corps d'analyse, données personnelles, valeur de runId, token, credential ou secret. Les secrets restent dans le contexte serveur/adapter et ne sont jamais des arguments ni des sorties.

### Idempotence, succès partiel et fraîcheur

READ est sans mutation métier ; `force` peut rafraîchir la projection technique selon le port. Aucune stabilité temporelle de la valeur n'est promise.

`save_analysis.input` est **exactement** `SaveAnalysisInput` : analysis canonique, runId inchangé, expectedRevision obligatoire (`null` pour création ou révision opaque pour update), companyIds inchangés. Le transport ne génère jamais runId, ne remplace jamais expectedRevision et n'altère pas l'intention lors d'une reprise. L'idempotence est celle du writer : même runId/module et intention compatible → relecture/reprise ; intention incompatible → `stale_request`. Aucun stockage, lease, retry de mutation, fingerprint, promotion Current ou preuve de persistance dans MCP. Les limites Lot 8 restent applicables (pas de CAS atomique de source, writers externes et mutation ambiguë).

Les quatre receipts sont retournés comme succès Core **sans les rabattre sur verified** : `persisted`, `promotion_pending`, `verified`, `partial`. Les indicateurs persisted/promoted/verified, analysisId, runId, revision et diagnostics sont préservés. `partial` reste observable, sans rollback ni retry automatique. La cohérence des indicateurs et des identités reste validée par le Core ; la preuve de persistance reste au writer. Une reprise explicite de la même intention est déléguée au writer, jamais implémentée dans le transport.

Pour tous les READ, stale/unknown n'est pas une erreur synthétique : préserver `metadata.freshness`, provenance/revision, freshness métier Quote (fresh/closed/stale/unavailable), warnings et diagnostics. Ne pas masquer un prix null/unavailable ni lui substituer un prix calculé. Les analyses et Company n'acceptent pas une option de refresh inexistante dans le Core. Aucun TTL, âge maximal ou politique Current nouvelle. WRITE ne reçoit pas de garantie de fraîcheur (`unknown` dans les métadonnées du receipt).

### Pagination, taille, délais et retry

V1 n'expose **aucune collection autonome** ni pagination/cursor : Company et Portfolio sont des snapshots complets, Analysis un document entier, Position et Quote des objets unitaires. Aucune troncature silencieuse des listes imbriquées, blocs, diagnostics ou receipts. Les sorties trop grandes sont rejetées `limit_exceeded` ; aucun sous-ensemble n'est prétendu complet. Un futur besoin de pagination requerra un contrat explicite et un véritable consommateur, pas un cursor artificiel sur les méthodes actuelles.

Limites communes à chaque tool : JSON UTF-8 sérialisé, hors framing protocole, entrée ≤ 2 097 152 octets, sortie ≤ 4 194 304 octets. Contrôler l'entrée avant Core et la sortie avant envoi. Ces plafonds couvrent les tableaux imbriqués et les corps ; pas de limite de blocs source ni de découpage de persistance MCP. Une sortie WRITE trop grande a `outcome: unknown` et ne permet pas de rejouer automatiquement. Les diagnostics de rejet restent compacts. Les plafonds sont des maxima contractuels : le Lot 11 doit prouver qu'ils passent dans le runtime retenu, ou proposer explicitement une évolution du contrat, sans plafonds cachés.

Budget transport total, retry compris : READ 30 000 ms, WRITE 120 000 ms. L'échéance démarre à réception de la requête valide. Un timeout ne certifie pas l'annulation du Core/writer. Maximum READ deux tentatives, uniquement timeout/network/rate_limit, avec attente de 250 ms (ou Retry-After si connu et compatible avec le budget). Ne pas multiplier les retries déjà internes à l'adapter. Maximum WRITE **une** tentative ; aucun retry transport automatique, même si le Core annonce retryable. Les reprises explicites conservent le même runId et la même intention et repassent auth/confirmation. Aucune continuation WRITE concurrente après échéance. La gestion effective des appels en cours et des signaux d'annulation doit être démontrée au Lot 11.

### Versioning et compatibilité

Version de contrat indépendante : `MCP_CONTRACT_VERSION = 1.0.0`. Noms stables sans suffixe de version ; la version exacte est obligatoire dans chaque input et retournée dans chaque output. Le catalogue v1 ne supporte que 1.0.0 ; une autre valeur renvoie `unsupported_version` avant Core, jamais une conversion silencieuse. Le rejet annonce la version serveur 1.0.0. Pas de négociation spécifique à un fournisseur.

Patch : correction documentaire/générateur sans changement du langage accepté. Minor : nouveaux tools ou champs optionnels via un nouveau catalogue, en conservant le catalogue ancien et son comportement pour les callers qui le demandent. Les lecteurs du nouveau catalogue doivent tolérer les ajouts déclarés par sa version ; les schémas stricts d'un ancien catalogue ne sont pas modifiés en place. Major : champ requis, suppression/renommage, nouveau sens d'un receipt, restriction de valeurs/plafonds ou autre rupture ; conserver l'ancien catalogue pendant la migration explicite. Aucune période de compatibilité ni second catalogue hypothétique implémenté au Lot 10. Toute modification des types Core doit déclencher le contrôle de drift et une revue de compatibilité MCP avant régénération.

### Gate Lot 10

Contrat versionné et surface justifiée ; schémas stables ; mapping exact ; READ/WRITE/auth/scope ; idempotence, receipts, stale, limites et délais explicites ; tests contractuels purs PASS ; aucune logique métier/serveur/runtime OpenAI ni changement financier. Livraison et reprise : `docs/architecture/lot-10-handoff.md`. Le GO Lot 11 autorise sa préparation séparée, pas son démarrage dans ce lot.

## 11. Lot 11 — serveur MCP et runtime

### Cible d’exploitation

Première cible : **ChatGPT Sites**, parce que l’utilisation réelle reste OpenAI-first.

OpenAI documente qu’un serveur MCP peut être ajouté à un **Site nouveau ou existant**, puis utilisé via un plugin. La publication/republication du Site crée ou actualise le plugin associé. Les permissions Site, plugin et services connectés restent distinctes.

Références officielles à revalider au début du Lot 11 car le produit peut évoluer :

- https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites
- https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites
- https://help.openai.com/en/articles/20001256-plugins-in-chatgpt-and-codex

### Décision « un Site ou deux Sites »

Ne pas créer deux Sites par principe.

Ordre de décision :

1. tenter de placer le MCP dans le Site Investment OS existant si le runtime permet une séparation claire des secrets, permissions et déploiements ;
2. mesurer impact build/runtime/mémoire et surface d’exposition ;
3. vérifier audience personnelle/démo et permissions plugin ;
4. créer un Site technique séparé seulement si une contrainte réelle de sécurité, de cycle de déploiement, d’audience ou de runtime le justifie.

Le choix un Site/deux Sites est donc **un détail de déploiement du Lot 11**, pas une frontière du domaine.

### Implémentation

Le serveur MCP doit ressembler conceptuellement à :

```text
validate MCP request
        |
        v
map to Core input
        |
        v
call Investment Core
        |
        v
map ServiceResult
        |
        v
MCP response
```

Il ne doit pas introduire de cache métier, de fallback Current ou de logique Notion.

### Sécurité

À valider explicitement :

- auth du caller ;
- audience Site ;
- accès plugin séparé ;
- scopes READ/WRITE ;
- confirmation des actions mutantes si la plateforme l’exige ;
- aucun secret envoyé au client ;
- séparation demo/personnel ;
- logs sans contenu privé ;
- rate limits et timeouts ;
- idempotence des writes via `runId`.

### Gate Lot 11

- outils MCP exécutables contre Core ;
- erreurs typées ;
- scopes et permissions testés ;
- READ validé avant WRITE ;
- aucun appel direct Notion depuis le transport si un port Core existe ;
- choix Site existant vs Site dédié justifié par mesure/contrainte ;
- possibilité de déplacer le serveur MCP vers un autre runtime sans modifier le Core.

## 12. Lot 12 — migration du plugin Investment OS Analysis vers MCP

### Objectif

Remplacer l’infrastructure d’accès aux données/persistance par les tools MCP, **sans changer la méthodologie des Skills**.

Exemple cible :

```text
/full-value NVDA
       |
       v
full-value skill
       |
       +--> MCP get_company
       +--> MCP get_portfolio
       +--> MCP get_current_analysis
       |
       v
Business / Valuation / CIO selon le workflow canonique
       |
       v
MCP save_analysis
       |
       v
Core -> Adapter Notion -> Notion
```

### Source canonique des Skills

Le repo/plugin actuel `erwancgn/plugin-investment-os` reste la source de la méthodologie et des workflows tant qu’une décision explicite ne le remplace pas. Le chantier MCP ne doit pas réinterpréter ou simplifier ses méthodes.

### Parité obligatoire

Comparer avant/après MCP :

- inputs réellement fournis aux Skills ;
- ordre des workflows/handoffs ;
- contenu attendu ;
- scores/verdicts lorsque le skill en définit ;
- receipts ;
- relations ;
- promotion Current ;
- persistence finale ;
- gestion des erreurs partielles.

Une divergence méthodologique n’est pas un « détail de migration ».

### Gate Lot 12

- Skills inchangés sauf adaptation infrastructure nécessaire ;
- plugin utilise les tools MCP officiels ;
- parité des outputs démontrée sur un panel représentatif ;
- writes et receipts vérifiés ;
- aucun accès direct Notion résiduel dans le plugin s’il est remplacé par MCP ;
- permissions plugin/Site vérifiées séparément.

## 13. Lot 13 — validation finale et clôture

Le chantier n’est clos qu’après une campagne complète.

### Produit

- Portfolio ;
- Exposition ;
- Trajectoire ;
- Companies ;
- Company ;
- analyses ;
- historique ;
- Basket ;
- AI ;
- Gestion ;
- espace demo/personnel.

### Renderer

- Business ;
- Valuation ;
- Short ;
- Portfolio Fit ;
- Earnings ;
- CIO Memo ;
- Decision ;
- Generic ;
- projection valide/absente/invalide ;
- historique HTML/Markdown ;
- blocs Notion structurés ;
- sources/citations ;
- scénarios/seuils.

### Mobile

Viewports minimum :

- 360×800 ;
- 390×844.

Vérifier navigation, disclosures, largeur, tableaux, KPI, Decision Card et absence de débordement.

### Performance

Reprendre des mesures comparables :

- cold/warm ;
- fanout ;
- SQL/reads ;
- taille payload ;
- mémoire ;
- normalisation ;
- SSR ;
- MCP read/write ;
- absence de lecture de tous les corps pour une opération ciblée.

### Sécurité

- auth Sites ;
- owner/demo ;
- routes privées ;
- secrets ;
- webhook ;
- MCP permissions ;
- plugin access ;
- WRITE ;
- idempotence ;
- erreurs sans fuite de données.

### Nettoyage

Retirer seulement les wrappers/bridges legacy dont tous les consommateurs ont été migrés. Chaque suppression exige une recherche de références et des tests. Aucun nettoyage général opportuniste.

### Documentation

Mettre à jour :

- README ;
- architecture ;
- contrat de domaine ;
- passations ;
- schéma runtime réel ;
- procédure de rollback ;
- dépendances OpenAI réelles ;
- surface MCP finale.

Le chantier est clos seulement lorsque la documentation décrit le système **effectivement exécuté**, pas la cible prévue.

## 14. Ce qui est hors scope de ce chantier

Ne pas intégrer avant clôture du Lot 13, sauf décision utilisateur explicite :

- migration Notion → Supabase ;
- Supabase Auth ;
- RLS ;
- multi-user complet ;
- lancement public ;
- migration Vercel/Cloudflare/autre runtime ;
- multi-LLM réel ;
- Claude/Gemini comme providers de production ;
- réécriture from scratch ;
- nouvelle méthode de valorisation/analyse ;
- refonte visuelle non requise par un gate.

Ces sujets constituent le chantier suivant. Le refactor courant doit seulement rendre ces migrations moins coûteuses.

## 15. Scénario de sortie future d’OpenAI

La portabilité sera considérée réussie si une future migration peut conserver :

```text
core/
contracts/
analysis policies/
portfolio calculations/
notion or supabase adapters/
MCP schemas/
domain tests/
```

et remplacer principalement :

```text
ChatGPT Sites runtime
Plugin packaging
OpenAI auth/permissions
OpenAI-specific deployment
```

Exemple futur non planifié :

```text
aujourd'hui:
ChatGPT/Codex -> Plugin -> MCP on Sites -> Core

demain éventuellement:
autre agent/runtime -> même contrat MCP -> Core
```

Aucune implémentation de ce scénario n’est demandée dans les Lots 7–13.

## 16. Règles de reprise pour Codex

À chaque nouvelle fenêtre :

1. vérifier le repo exact et la branche `chore/architecture-stabilization-mcp` ;
2. vérifier HEAD et `git status` ;
3. lire `AGENTS.md` ;
4. lire la passation du lot courant ;
5. lire cette vision figée ;
6. lire seulement les fichiers/contrats du périmètre nécessaire ;
7. ne pas recommencer un lot déjà validé ;
8. ne pas anticiper le lot suivant avant le gate ;
9. ne pas modifier du code sans cause démontrée ;
10. produire un checkpoint et une passation à chaque gate.

### Ordre de lecture recommandé à la reprise actuelle

1. `AGENTS.md`
2. `docs/architecture/lot-8-handoff.md`
3. `docs/architecture/openai-first-execution-plan.md`
4. `docs/architecture/target-architecture.md`
5. `docs/architecture/domain-contracts.md`
6. `core/services/investment-os.ts`
7. `core/services/ports.ts`
8. `core/analysis/current-selection.ts`
9. `adapters/notion/investment-reads.ts`
10. tests concernés.

## 17. Résumé décisionnel

Le chantier initial reste valide.

Le changement de vision produit n’ajoute pas un nouveau lot et ne réouvre pas les Lots 0–9. Il précise seulement :

- **Lot 10** : contrat MCP portable/runtime-agnostic ;
- **Lot 11** : serveur MCP mince, Sites comme première cible d’hébergement, Site existant préféré si compatible ;
- **Lot 12** : migration infrastructure du plugin vers MCP, sans changement de méthodologie.

La priorité immédiate ne change pas : **finir le Lot 7.2 et son parity gate avant tout Lot 8 ou MCP**.
