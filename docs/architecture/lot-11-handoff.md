# Livraison Lot 11 — serveur MCP / passation avant Lot 12

3 octobre 2026. Checkout local `investment-os`, branche `chore/architecture-stabilization-mcp`, HEAD d'entrée `6d9566c32e1f7cf42d40053eca0977022238bc05`. Checkpoint propre, origin vérifié après fetch (0/0). `.env.local` ignoré et non suivi ; présence des seules clés nécessaires contrôlée sans valeur affichée. Aucun secret réel utilisé pour les tests. Le SHA de livraison est celui du commit contenant ce document, sans SHA autoréférentiel.

**Implémentation et validation locales livrées ; NO-GO Lot 12.** Le gate hébergé reste ouvert. Lots 7–10 non rejoués ; aucune migration du plugin ni modification des Skills/méthodes financières.

## Architecture et surface

- `transports/mcp/server.ts` : transport MCP stateless Web Streamable HTTP via le SDK officiel ; validation des schémas canoniques, autorisation, invocation Core et enveloppe de résultat. Injecte auth et service, sans dépendance à Sites/Worker/adapters/UI. Déplaçable vers un autre runtime Web sans modifier le Core.
- `transports/mcp/sites-auth.ts` : adaptation d'identité du dispatch Sites exclusivement. La politique opérationnelle est dans la section 11 du plan, sans nouvelle définition du contrat.
- `worker/index.ts` : `/mcp` avant le routage UI, assemblage des services selon scope et `ctx.waitUntil` par requête. Les routes historiques conservent leurs payloads.
- `adapters/notion/investment-reads.ts` : expose `createInvestmentService`, assemblage des ports existants et du writer existant. L'adapter legacy réutilise cet assemblage pour position/Current/save. Mapping physique et normalizer restent ici, aucune copie dans MCP.
- `adapters/demo/investment-reads.ts` : ports Core du snapshot démo existant, sans writer, DB personnelle ou provider externe. Réutilise les projections canoniques de l'adapter existant. Les références Current sont des données d'entrée ; leur sélection reste dans le Core.

Exactement sept tools et mapping du manifeste Lot 10 : `get_company → getCompany`, `get_portfolio → getPortfolio`, `get_position → getPosition`, `get_current_analysis → getCurrentAnalysis`, `get_analysis_by_id → getAnalysisById`, `save_analysis → saveAnalysis`, `get_quote → getQuote`. `list_analyses` reste absent. Types, version 1.0.0 et bundle JSON du Lot 10 inchangés. Discovery fournit les definitions locales nécessaires aux schémas autonomes.

## Auth, sécurité et WRITE

Identité vérifiée hors arguments ; anonymous HTTP 401, autorisation refusée `forbidden`, délégation absente `confirmation_required`. Le propriétaire configuré peut READ personal/demo ; les autres identités reconnues seulement READ demo. WRITE demo toujours refusé avant Core. Activation WRITE et délégation personnelle exigent deux flags serveur explicites ; aucun flag ne vient du caller. La délégation couvre les mutations normales du propriétaire, pas des tiers. Les confirmations supplémentaires du plugin/Sites restent obligatoires lorsqu'exigées.

Un cookie de scope UI ou un credential d'automatisation n'authentifie pas MCP. Requêtes navigateur avec Origin ou provenance cross-site refusées. Pas de batch ni de notification `tools/call` pouvant muter ; protocole de tâches non annoncé/refusé. Erreurs de dépendances brutes remplacées par messages génériques ; les ServiceResult/diagnostics sûrs du Core sont conservés. Aucun log de payload, cookie, token ou contenu privé dans le transport.

`runId`, `expectedRevision` et l'intention sont transmis sans transformation. `persisted`, `promotion_pending`, `verified`, `partial`, stale/conflict restent distincts. Une tentative WRITE transport, aucune relance automatique ; le writer garde promotion, relectures et replay. Au timeout, outcome inconnu, tâche conservée via waitUntil et fence de sujet tant qu'elle est active. Ce fence est local à l'isolate ; aucune garantie distribuée supplémentaire au writer. Les limites Lot 8 (absence de CAS Notion atomique, writers externes et mutations ambiguës) restent applicables.

2 MiB d'arguments / 4 MiB d'enveloppe de sortie, JSON UTF-8 ; framing HTTP borné à +4096 octets. READ 30 s / deux tentatives maximum, WRITE 120 s / une tentative. Un backoff READ ne déclenche aucun nouvel appel après deadline. Aucun snapshot tronqué ni pagination ajoutée. Ces limites sont validées dans le transport local ; leur passage à travers le proxy Sites hébergé n'est pas certifié.

## Runtime choisi et preuve « Site existant »

La recommandation est le **Site Investment OS existant**, avec capacité MCP ajoutée seulement au manifeste local. La section 11 du plan référence les documents officiels revalidés. Sites autorise le serveur dans un Site existant et provisionne/actualise le plugin à publication/republication. Les permissions Site, plugin et services connectés sont séparées ; l'autorisation de voir l'application ne confère pas WRITE MCP.

Diagnostic Sites read-only : Site actif, propriétaire courant, audience publique, version publiée 208 ; OWNER_EMAIL et les clés Notion existent côté serveur. Le Site publié n'annonce pas MCP ; la connexion MCP retournée par la plateforme exige activation et republication. Pas de preview existante observée. Les flags WRITE ne sont pas configurés. Aucune variable ni permission externe modifiée, aucun nouveau Site créé.

Mesure locale indicative de build, même checkout/machine : avant intégration 8,57 s / RSS pic 653 680 640 octets / JS serveur environ 964 KiB ; après intégration 9,33 s / RSS pic 824 225 792 octets / JS serveur environ 1,6 MiB. Ce sont des mesures du processus build, pas la mémoire du Worker hébergé. Catalogue discovery 764 318 octets. Le Worker construit démarre dans workerd, sans eval dynamique ; six READ démo observés entre 8 et 80 ms. Aucun besoin démontré d'un second Site pour build, isolation des scopes ou dépendances. Le SDK MCP 1.32.0 et le validateur Worker @cfworker/json-schema 4.1.1 sont les seules nouvelles dépendances directes.

Le serveur partage le secret Notion/D1 côté serveur nécessaires à l'application ; il n'exige aucun secret navigateur. Co-hébergement implique un cycle de publication et rollback commun avec l'UI. Le rollback doit conserver une version déclarant MCP pour garder sa disponibilité. Une séparation ultérieure ne serait justifiée que par une contrainte d'audience, confiance d'identité, ressources ou cycle de déploiement réellement constatée ; rien de tel n'est démontré localement.

## Validations et checks

- `npm run test:mcp` : PASS, 22/22 (9 contractuels + 13 serveur) et génération sans drift.
- `npm run test:mcp-server` : PASS, 13/13 ; discovery et import boundary, mappings des sept tools, erreurs/version/schémas, auth/permissions/démo/confirmation, limites exactes, deadlines 30/120 s et fence, retry READ et absence de retry WRITE.
- Le test HTTP loopback utilise le client MCP officiel, le véritable Core/adapter/writer, SQLite en mémoire et les fixtures Notion existantes interceptées. Les quatre receipts, replay sans seconde création, conflit et lecture démo sont validés. Extraction du harness writer pour éviter une seconde implémentation de fixtures.
- `npm run verify:mcp-runtime` après build : PASS, véritable artefact Worker dans Miniflare/workerd, D1 éphémère, réseau Notion intégralement intercepté. Initialize/discovery, six READ démo, anonymous, version, WRITE démo, navigateur ; WRITE personnel verified, replay sans recréation/promotion supplémentaire, conflit stale_request et READ personnel du document écrit. Identité Sites simulée explicitement sur listener loopback seulement.
- `npm run test:domain` : PASS, 34/34.
- Tests read adapter / writer / sécurité Notion / demo : PASS, 51/51.
- Typecheck, ESLint ciblé des fichiers touchés, build runtime et `git diff --check` : PASS.

Les tests ne contactent aucun provider réel et ne mutent ni Notion ni D1 live. Données de test et listeners éphémères nettoyés. Aucun déploiement production, migration live, permission externe, secret ou SDK OpenAI dans le Core.

## Gate restant avant Lot 12

Le code local satisfait les chemins transport/Core et les protections testables. **Le GO n'est pas donné**, car une simulation d'en-têtes ne prouve pas la frontière d'auth Sites réelle et le plugin publié n'expose pas MCP. Les documents officiels ne certifient pas à eux seuls l'écrasement d'en-têtes forgés, l'absence d'entrée Worker directe et les budgets proxy 120 s / 4 MiB. Aucun client ChatGPT/Codex n'a été connecté au serveur hébergé.

Action humaine restante : autoriser explicitement le gate de publication production avant toute republication ; contrôler les permissions/audiences et la délégation WRITE voulues. Puis, dans la poursuite du Lot 11, prouver avec la plateforme l'identité non forgeable et l'entrée exclusivement dispatchée, les confirmations, les limites/délais hébergés, les READ et un WRITE isolé avec replay/receipt/nettoyage. Ne pas démarrer Lot 12 avant ces preuves et le nouveau GO explicite. Aucun second Site ne doit être créé automatiquement pour contourner ce gate.

Livraison Git : commit normal contenant cette passation, push normal sur la branche canonique ; état propre et alignement origin à vérifier en clôture. Aucun force push.
