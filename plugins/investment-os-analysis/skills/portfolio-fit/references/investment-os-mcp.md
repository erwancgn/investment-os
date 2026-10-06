# Transport officiel Investment OS MCP — 1.0.0

## Flux actif en lecture seule

Utilise le plugin officiel du Site Investment OS existant : https://investment-os.erwancognee94.chatgpt.site . Découvre les outils et leurs schémas réellement disponibles via le catalogue du client connecté. Le nom de namespace dépend du client ; appelle l’outil découvert, jamais un endpoint HTTP ou un wrapper inventé. Si le catalogue est obsolète, fais actualiser les outils du plugin Site par le mécanisme officiel. L’authentification reste gérée par cette connexion : aucun serveur local, OAuth local, extraction de token ou secret dans la conversation.

Le catalogue canonique contient huit outils : `resolve_company`, `get_company`, `get_portfolio`, `get_position`, `get_current_analysis`, `get_analysis_by_id`, `get_quote`, `save_analysis`. Leur présence n’accorde aucune permission. Le flux actif est `profile: conversation`, `transport: investment-os-mcp`, `persistence_status: NOT_REQUIRED` : sept READ pour les inputs/continuité, rapports et exports dans le chat, aucun appel `save_analysis`. WRITE reste fermé et non délégué en production.

Choisis explicitement `scope: "personal"` pour les données personnelles ou `scope: "demo"` pour une demande démo. Aucun basculement de scope, aucun rôle/tenant/token auto-déclaré. Les droits sont vérifiés par le serveur. En cas d’erreur auth, permission ou transport, conserve le diagnostic et signale la limite ; n’accède pas directement à Notion et ne change pas de provider pour contourner l’erreur. Un input fourni par l’utilisateur peut permettre une analyse conversationnelle, sans prétendre à une lecture MCP réussie.

## Résoudre une société

Quand l’utilisateur donne un nom, un alias ou un ticker, commence par `resolve_company` avant tout appel nécessitant un identifiant d’entreprise. Arguments requis : `contractVersion: "1.0.0"`, `scope` et `query`. `market` est optionnel et doit être omis s’il est absent; fournis-le s’il est indiqué ou utile pour distinguer les marchés. L’enveloppe MCP standard contient le résultat métier : `status: resolved | ambiguous | not_found` et `candidates[]`. Chaque candidat contient `companyId`, `canonicalName`, `ticker`, `exchange` (nullable si inconnu) et `assetId` (champ présent, valeur string ou `null`).

- `resolved` avec exactement un candidat : réutilise son `companyId` pour `get_company` et les lectures d’analyses ; utilise son `assetId` seulement pour `get_quote`. Un résultat `resolved` avec zéro ou plusieurs candidats est une réponse incohérente à signaler.
- `ambiguous` : ne choisis jamais silencieusement. Si le marché fourni ne suffit pas, demande une clarification en présentant les candidats. Un ticker présent sur plusieurs marchés reste ambigu.
- `not_found` : n’invente aucun ID, ne crée aucune Company et ne tente aucun accès direct à Notion ; poursuis seulement une analyse conversationnelle si les inputs et sources disponibles le permettent, en indiquant l’absence de Company MCP.

## Appels READ exacts

Chaque appel inclut `contractVersion: "1.0.0"` et le scope explicite. Les objets ci-dessous décrivent les arguments ; remplace les variables par les valeurs obtenues, sans envoyer de placeholder.

| Outil | Arguments JSON |
|---|---|
| `resolve_company` | `{ "contractVersion": "1.0.0", "scope": scope, "query": query, "market": market }` (omettre `market` si absent) |
| `get_company` | `{ "contractVersion": "1.0.0", "scope": scope, "id": companyId }` |
| `get_portfolio` | `{ "contractVersion": "1.0.0", "scope": scope }` |
| `get_position` | `{ "contractVersion": "1.0.0", "scope": scope, "id": positionId }` |
| `get_current_analysis` | `{ "contractVersion": "1.0.0", "scope": scope, "companyId": companyId, "family": family }` |
| `get_analysis_by_id` | `{ "contractVersion": "1.0.0", "scope": scope, "id": analysisId }` |
| `get_quote` | `{ "contractVersion": "1.0.0", "scope": scope, "assetId": assetId }` |

`options?: { force?: boolean, cacheOnly?: boolean }` existe uniquement sur `get_portfolio`, `get_position` et `get_quote`, à utiliser si nécessaire. Ne l’ajoute pas aux autres READ. Familles Current : `business`, `valuation`, `short`, `portfolio`, `cio_memo`, `decision`, `earnings`. Le handoff humain CIO conserve son module existant ; la famille de domaine est `cio_memo`.

Les IDs restent opaques : utilise seulement le `companyId` retourné par `resolve_company`, un `companyId` réellement retourné dans `companyIds` par une position de `get_portfolio`/`get_position`, ou un ID explicitement fourni par l’utilisateur. Ne dérive jamais un ID d’un ticker, d’un lien ou d’un format physique. `targetId` ou `quoteSymbol` d’une position ne sert à `get_quote` que si le serveur l’expose explicitement comme identifiant d’asset ; ne l’utilise jamais comme `companyId`. Le Core reste propriétaire de la correspondance Company/Analysis. Il n’existe aucun outil de création Company ou `list_analyses`.

Pour la continuité, appelle `get_current_analysis` pour chaque famille requise par le skill. Le Core choisit Current ; ne trie pas les aperçus pour remplacer ce choix. Les aperçus/archives de `get_company` servent à identifier une analyse historique ; `get_analysis_by_id` hydrate son document. Aucun statut, relation Current ou version historique n’est réécrit par le skill. La compatibilité analytique et la collecte fraîche restent régies par le framework.

Pour un prix requis, appelle `get_quote` avec un assetId réellement obtenu ou fourni. Conserve instrument, devise, source, dates, provenance et fraîcheur. Un prix indisponible/null ou stale/unknown ne devient pas un prix frais calculé. Cherche une source de marché pertinente si le framework le demande et consigne le gap MCP.

## Erreurs, limites et preuve de persistance

Traite séparément les statuts d’enveloppe de transport et le statut métier de `resolve_company`. Un rejet `forbidden` arrête l’appel concerné et interdit tout contournement par Notion ou un autre backend. Un timeout ou une réponse absente conserve l’issue comme inconnue et n’autorise aucun retry du Skill ; pour READ, seul le budget borné du serveur s’applique. Une erreur d’outil, `not_found`, `ambiguous` ou une donnée `null` n’est jamais convertie en succès. Réutilise les IDs, Company, snapshots, quotes et analyses déjà obtenus au cours du run ; ne rappelle un outil que si une dépendance le requiert.

En production, le profil actif reste READ-only : ne soumets pas `save_analysis`, rends le rapport et le handoff dans la conversation et marque la persistance `NOT_REQUIRED`. Si un runtime autorisé séparément active WRITE pour cette intention précise, appelle une seule fois `save_analysis` après le calcul, sans retry automatique ; conserve le receipt brut et relis par les outils MCP canoniques selon la section WRITE. Le receipt est la preuve de mutation, les relectures MCP la preuve de l’état observable. Aucune Skill n’accède directement aux bases physiques, relations, index, adapters ou stockage.

## Résultats et limites

Lis l’enveloppe complète : `{ contractVersion, scope, status: "completed", result }`, puis le statut Core, les données, métadonnées et diagnostics de `result`. `completed` n’est pas une preuve analytique ou de persistance. `result.status: "ok", data: null` est une absence réelle ; un rejet ou une erreur n’est pas un cold start silencieux. Conserve provenance, révision, fraîcheur et diagnostics sans fabriquer de hash, timestamp ou reçu.

Un rejet porte `status: "rejected"`, `error: { code, message, retryable, outcome }` et `diagnostics`. `outcome: "not_started"` indique que le Core n’a pas commencé ; `"unknown"` indique un résultat non observable. Aucun succès ni rollback ne se déduit d’un timeout ou d’une réponse absente. Pas de troncature silencieuse : plafond input 2 MiB, output 4 MiB, budget synchrone READ/WRITE 30 s. Le serveur borne READ à deux tentatives transitoires dans ce budget ; le skill n’ajoute aucune boucle de retry.

## Profil WRITE intégré — fermé en production

Le profil persistant `investment-os-mcp` est distinct du défaut Conversation/READ-only. Il ne peut être choisi que sur un runtime où l’activation WRITE et les droits personnels sont réellement vérifiés, avec autorisation/délégation officielle pour l’intention exacte et politique amont sans replay automatique des mutations ou de reprise explicitement contrôlée. Une validation isolée n’active pas la production : celle-ci reste READ-only, sans appel WRITE. `mcp_capabilities.write: AVAILABLE` exige cette preuve ; sinon `MISSING`. WRITE démo est toujours interdit.

Dans ce profil autorisé, chaque module soumet une seule intention via l’outil découvert `save_analysis` :

```text
save_analysis({
  contractVersion: "1.0.0",
  scope: "personal",
  input: <payload validé contre le schéma complet exposé par le runtime>
})
```

Le catalogue client actuellement observé expose `input: unknown` et ne démontre donc pas la forme de l’objet Analysis ni la résolution des `$ref`. Avant toute soumission, inspecte le schéma complet de `save_analysis` et résous tous les `$ref` jusqu’aux définitions concrètes. Si le runtime ne fournit pas ce schéma complet, n’invente pas la structure et ne soumets rien. Un handoff ou EXPORT PAYLOAD n’est pas à lui seul une Analysis.

Pour les champs de date déclarés par le schéma, transmets une date ISO (`YYYY-MM-DD`) ou une date-heure ISO 8601/RFC 3339, ou `null` uniquement si le champ est nullable. En particulier, `presentation.facts.asOf` ne contient jamais une période fiscale telle que `FY2026` ou `Q4 FY2026` : conserve ces périodes dans le contenu ou le label, et ne déduis/invente pas une date de clôture; mets `null` si aucune date source réelle n’est disponible et que le schéma l’autorise. Un JSON structurellement valide ne démontre pas que Core a validé ni persisté la charge utile; seule la réponse et le receipt réellement retournés établissent le résultat.

### Sérialisation native de `Analysis`

Produis directement l’objet `Analysis` du module, à partir de son rapport et de son handoff. La version de domaine est `schemaVersion: "1.0.0"`. Chaque `content.blocks[]` a un `id` unique et un tableau `sourceIds` **non vide**, avec des chaînes uniques non vides. Associe les IDs de sources réellement exploitées aux blocs qui en dépendent. Pour un titre, une transition ou un bloc éditorial généré par ce run sans source externe, utilise `derived:<runId>:<family>:<blockId>` comme origine documentaire. Ce marqueur n’est **jamais** une preuve E d’un claim financier et ne comble aucun gap de l’Evidence Gate. Ne remplace pas une référence manquante par un ID inventé.

Chaque segment de texte a exactement `{text, marks, href}`; `href` est `null` ou une URL `http(s)` sûre. Les chemins `conversation://`, locators internes et IDs de handoff restent du **texte visible** avec `href: null`. Un tableau ou une liste conserve sa structure et ses segments. `presentation.facts`, `scenarios` et `thresholds` ne référencent dans `sourceBlockIds` que des IDs présents **dans les blocs de cette même Analysis**. Si un chiffre vient d’un module amont, ajoute un bloc local de handoff/locator qui reprend cette provenance exacte, puis référence ce bloc local; conserve le lien vers le module amont dans son texte et dans le handoff. Vérifie les références après assemblage des blocs.

Les clés au niveau d’`Analysis` dépendent de `kind`. `business` et `valuation` contiennent `score: string|null`; `short` et `portfolio` n’ont **aucune clé `score`**, même si le handoff financier indique `score: null`. `cio_memo` a `handoffSummary: string|null`, avec le texte du handoff final, et n’a ni `score` ni `decision`. La structure `decision` appartient seulement à `kind: "decision"`; elle peut être transportée dans le contenu et le handoff CIO sans devenir une propriété `cio_memo`. Même principe pour `earningsReview`, réservé à `kind: "earnings"`. N’ajoute aucune clé étrangère au type. Garde les faits, valeurs, méthodes, conclusions et gaps inchangés lors de cette sérialisation.

Avant `save_analysis`, confronte l’objet complet au schéma d’entrée exposé et aux règles de domaine ci-dessus : clés exactes, dates, IDs de bloc, liens, provenance, famille, `companyIds`, `runId` et `expectedRevision`. Une validation locale ou une vérification de structure n’est pas un receipt. Si l’objet échoue, corrige la sérialisation dans la production du Skill avant toute mutation; n’envoie pas un payload invalide pour tester le writer.

Conserve `runId`, `companyIds` et l’intention. `expectedRevision` est obligatoire : `null` pour création, sinon la révision opaque réellement lue. Le Core et ses adapters possèdent écriture, idempotence, promotion Current, supersession et relectures ; le skill ne les orchestre pas par des mutations directes. Aucun retry automatique de `save_analysis`, même après timeout/network/413 ou réponse absente ; l’issue peut rester inconnue. Toute reprise séparément autorisée conserve runId, famille, intention et expectedRevision après examen du receipt/journal/état par les outils disponibles.

Préserve intégralement le receipt retourné : `schemaVersion`, `status` (`persisted`, `promotion_pending`, `verified`, `partial`), `analysisId`, `runId`, `revision`, `persisted`, `promoted`, `verified`, `diagnostics`. Ces quatre statuts restent distincts. Seul un receipt cohérent réellement retourné avec `status: "verified"`, les indicateurs de vérification du Core et l’identité attendue peut établir une persistance `VERIFIED`. `persisted`, `promotion_pending` et `partial` restent incomplets, avec leurs diagnostics ; ils ne sont jamais transformés en `verified` par le modèle.

Après la soumission autorisée, utilise `get_analysis_by_id` avec l’analysisId du receipt pour comparer le contenu réellement relu à l’intention, puis `get_current_analysis` pour la famille concernée et `get_company` pour les références de l’entreprise. Ces READ confirment l’état observable, ne remplacent pas le receipt, ne déclenchent aucune promotion/supersession et ne génèrent aucune mutation de réparation. Si la famille ou l’intention ne prévoit pas de Current, ne revendique aucune promotion. Une erreur/divergence conserve receipt et gaps, interdit un statut final VERIFIED, sans réécriture ni retry. La clôture garde `mcp_readbacks` et les preuves d’outil réellement retournées. Sans receipt (outcome unknown/réponse absente), ces lectures peuvent documenter l’état mais ne prouvent pas seules la terminaison/annulation du writer ni une permission de retry.

Le module suivant peut consommer un handoff analytiquement exploitable après un statut de persistance terminal ; toute persistance incomplète/inconnue empêche un run persistant COMPLETE. En production READ-only, aucun receipt de mutation n’est attendu et le statut reste NOT_REQUIRED.

La version MCP `contractVersion: "1.0.0"`, la version de domaine `schemaVersion: "1.0.0"`, la version plugin et la version de handoff sont indépendantes. La méthode financière et les receipts existants restent inchangés.
