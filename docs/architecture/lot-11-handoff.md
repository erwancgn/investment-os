# Livraison Lot 11 — serveur MCP / passation avant Lot 12

3 octobre 2026. Checkout local `investment-os`, branche `chore/architecture-stabilization-mcp`, HEAD d'entrée `6d9566c32e1f7cf42d40053eca0977022238bc05`. Checkpoint propre, origin vérifié après fetch (0/0). `.env.local` ignoré et non suivi ; présence des seules clés nécessaires contrôlée sans valeur affichée. Aucun secret réel utilisé pour les tests. Le SHA de livraison est celui du commit contenant ce document, sans SHA autoréférentiel.

**Serveur livré et version 209 publiée READ-only ; NO-GO Lot 12.** La campagne hébergée a validé publication et refus des accès anonymes/forgés ; les READ authentifiés et les budgets proxy restent à prouver après connexion OAuth du plugin Site. Lots 7–10 non rejoués ; aucune migration du plugin financier ni modification des Skills/méthodes financières.

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

La cible est le **Site Investment OS existant**, désormais publié avec capacité MCP. La section 11 du plan référence les documents officiels revalidés. Sites autorise le serveur dans un Site existant et provisionne/actualise le plugin à publication/republication. Les permissions Site, plugin et services connectés sont séparées ; l'autorisation de voir l'application ne confère pas WRITE MCP.

Diagnostic initial : Site actif, propriétaire courant, audience publique, version 208 sans MCP. Après autorisation explicite, version 209 publiée depuis le checkpoint f461658, sans activer WRITE. OWNER_EMAIL et les clés Notion restent côté serveur ; révision d'environnement 4 inchangée. Pas de preview existante observée. Aucune variable ni permission externe modifiée, aucun nouveau Site créé.

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

Les tests locaux ci-dessus ne contactent aucun provider réel et ne mutent ni Notion ni D1 live. Données de test et listeners éphémères nettoyés. Aucun SDK OpenAI dans le Core. Cette campagne locale précède la publication autorisée ci-dessous ; les suites acquises n'ont pas été rejouées.

## Publication autorisée et campagne hébergée bornée

La version 209 sauvegardée depuis `f4616585630a657f40de6e5fc9aed9f6d4ed0151` a été publiée exactement après autorisation utilisateur. Audit préalable : aucun changement UI/Skills/plugin financier/Lot 12 ; diff source depuis 208 comprenant les prérequis canoniques déjà acquis des lots précédents, explicitement accepté. Le packaging standard incluait Drizzle : l'archive sauvegardée 209 exclut toutes les migrations SQL/métadonnées Drizzle et les métadonnées macOS, sans changer les octets du Worker/client construits. Aucun fichier .env ni valeur de credential local dans l'archive. Build et contrôle d'archive PASS.

- Version : `appgprj_6a7d7a1233a08191a8d35b746b284e95~appgver_020f5854beb88191bfaf74d0c10c2dfc` (209).
- Déploiement : `appgdep_6ac0c329d424819180178a730c64ed78`, `get_deployment_status=succeeded`, `has_mcp=true`, env revision 4, confirmé le 3 octobre 2026 à 08:56:21 UTC.
- Origine confirmée : https://investment-os.erwancognee94.chatgpt.site ; connexion MCP `/mcp` et plugin Site provisionnés par la plateforme. Cela ne certifie pas encore discovery/calls avec une identité connectée.
- Rollback immédiat conservé : version 208, `appgprj_6a7d7a1233a08191a8d35b746b284e95~appgver_df784ece9264819199fcf9709d662ab4`, source `9f98a7f7a20adef95c591a583fe60a70e04a8e38`, archive native disponible. Procédure : `deploy_site_version` avec ce version_id et le même project_id, sans modifier audience/env/tunnels ; puis `get_deployment_status` jusqu'à succeeded. Ce rollback retire MCP mais restaure le produit antérieur. Pas d'exercice de rollback effectué sans régression.

Premières preuves HTTP réelles : accueil 200 ; POST initialize MCP sans identité 401 ; mêmes appels avec ID/email forgés ou cookie personal forgé 401. Le refus intervient au dispatch (réponse courte générique), pas une enveloppe Core : aucune donnée personnelle retournée. `/api/session` anonyme retourne scope demo et canAccessPersonal=false ; `/api/portfolio/live` retourne 200, trois positions, uniquement des IDs démo et aucun champ d'erreur. Ce sont des preuves négatives d'intégrité et de santé produit, pas une preuve positive de l'identité propriétaire ni une lecture MCP démo.

Sites read-only après publication : inventaire D1 inchangé (13 tables), table notion_analysis_writes toujours absente ; absence de migration vérifiée. MCP_WRITE_ENABLED/MCP_WRITE_DELEGATED absents, révision 4 : WRITE fermé et non délégué. Logs Worker erreurs sur la fenêtre de validation : zéro événement. Aucun WRITE réel, changement de permission, secret affiché ni correctif de runtime.

L'inspection du plugin Site rapporte not_installed et défaut ChatGPT Allow low-risk actions. L'installation/connexion a été proposée, sans installation ni modification de permission par l'agent. Les [règles officielles d'approbation](https://help.openai.com/en/articles/20001495-managing-app-permissions-in-chatgpt) distinguent permission d'action, connexion et accès provider ; une permission low-risk ne prouve ni WRITE ni une confirmation systématique. Décision **B : premier déploiement READ-only**, activation ultérieure séparée. Les READ authentifiés et le refus WRITE avant Core nécessitent la connexion utilisateur réelle ; aucun bypass d'automatisation ou header forgé ne doit la remplacer.

## Gate restant avant Lot 12

Le code local satisfait les chemins transport/Core et les protections testables. **Le GO n'est pas donné** : publication MCP et refus anonymes/forgés acquis, mais plugin non connecté. Aucun des six READ MCP avec OAuth réel, comparaison personnel/démo, refus save_analysis authentifié ou budget proxy maximal n'est encore certifié. Les documents officiels et réponses anonymes rapides ne prouvent pas les deadlines 30/120 s, ni les plafonds 2/4 MiB à travers la connexion hébergée. Aucune régression produit/auth démontrée ; aucun rollback déclenché.

Action humaine restante : installer le plugin du Site Investment OS et terminer sa connexion OAuth, sans activer WRITE ni modifier de permissions externes. Reprendre ensuite les étapes dépendantes de cette même campagne : six READ personnels/démo, isolation des données, diagnostics, refus WRITE authentifié et limites/délais réels. Ne pas simuler une identité ou ajouter un tool de test pour transformer une preuve manquante en PASS. Aucun WRITE réel autorisé à cette reprise. Ne pas démarrer Lot 12 avant les preuves et le nouveau GO explicite ; aucun second Site créé pour contourner ce gate. La publication 209 est autorisée et acquise : ne pas la redemander ni republier une archive modifiée.

Livraison Git : commit normal contenant cette passation, push normal sur la branche canonique ; état propre et alignement origin à vérifier en clôture. Aucun force push.
