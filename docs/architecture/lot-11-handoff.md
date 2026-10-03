# Livraison Lot 11 — serveur MCP / passation avant Lot 12

3 octobre 2026. Checkout local `investment-os`, branche `chore/architecture-stabilization-mcp`, HEAD d'entrée `6d9566c32e1f7cf42d40053eca0977022238bc05`. Checkpoint propre, origin vérifié après fetch (0/0). `.env.local` ignoré et non suivi ; présence des seules clés nécessaires contrôlée sans valeur affichée. Aucun secret réel utilisé pour les tests. Le SHA de livraison est celui du commit contenant ce document, sans SHA autoréférentiel.

**Serveur livré et version 209 publiée READ-only ; NO-GO Lot 12.** La reprise depuis `90932dd` a connecté le plugin Site par OAuth réel et validé les six READ dans les scopes personnel/démo ainsi que l’isolation des références testées. Les détails typés du rejet WRITE hébergé et les plafonds/deadlines maximaux du proxy restent non certifiés ; le Lot 11 n’est pas clos. Lots 7–10 non rejoués ; aucune migration du plugin financier ni modification des Skills/méthodes financières.

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

Lors de la première campagne, l'inspection du plugin Site rapportait not_installed et défaut ChatGPT Allow low-risk actions. L'installation/connexion a été proposée, sans installation ni modification de permission par l'agent. Les [règles officielles d'approbation](https://help.openai.com/en/articles/20001495-managing-app-permissions-in-chatgpt) distinguent permission d'action, connexion et accès provider ; une permission low-risk ne prouve ni WRITE ni une confirmation systématique. Décision **B : premier déploiement READ-only**, activation ultérieure séparée. Les READ authentifiés et le refus WRITE avant Core nécessitent la connexion utilisateur réelle ; aucun bypass d'automatisation ou header forgé ne doit la remplacer.

## Reprise hébergée OAuth du 3 octobre 2026

Checkpoint d'entrée `90932dd585c456b0f217b4d913523e730dccd05d`, branche canonique et origin alignés 0/0. Seul élément non suivi : `node_modules 2`, conservé intact et exclu des livrables. Aucune nouvelle publication, modification du runtime publié, migration ou mutation Notion. `get_deployment_status` confirme toujours v209 succeeded/has_mcp=true ; v208 reste disponible comme rollback identifié, sans exercice de restauration.

### Deux plugins distincts, aucune migration financière

La référence utilisateur `investment-os-analysis-1.3.0-runtime.zip` a été inspectée sans extraction ni modification : manifeste investment-os-analysis 1.3.0, neuf Skills, 81 fichiers de Skills identiques octet par octet au cache local installé 1.3.0. SHA256 archive : `84369e757257e9e0e5d05e3ae2c8948357d44cd4bd8f3f4234520d638f4a0c24`. Aucun mcp.json/serveur MCP dans ce ZIP. La fiche ChatGPT du plugin financier confirme installé, version 1.3.0 et neuf Skills. Les différences de manifeste/assets du paquet distribué ne sont pas assimilées à une différence méthodologique. Aucun remplacement, réinstallation, changement de Skills ou invocation analytique.

Le plugin Site est distinct : `plugin_asdk_app_sites_ad68978f9cb8819192563710e9dd1615`, version plugin 1.0.0, application Investment OS et endpoint `/mcp` du Site existant. Installation et connexion réalisées via Computer Use dans Chrome/ChatGPT, conformément à l'autorisation utilisateur et au [flux officiel Sites](https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites). Le compte existant a été sélectionné ; seul consentement demandé : profil de base pour cette URL MCP. Aucun MFA, saisie de secret, permission WRITE, accès fournisseur supplémentaire ou modification de permission externe. Le retour ChatGPT affiche le compte connecté Primary et « Essayer dans le chat ».

Le connecteur de gestion de plugins accessible dans la session Codex continue de retourner not_installed pour ce même ID après la connexion, sans tools Investment OS dans son catalogue. Cette divergence de surface n'invalide pas les appels observés depuis ChatGPT ; elle empêche de déclarer la connexion Codex acquise. Aucun accès manuel via codex mcp add/login, copie de token, cookie ou identité forgée.

### Discovery et READ réels

Campagne dans la conversation ChatGPT `6ac0fc2c-1500-83ed-b75a-7d09cf519888`, plugin Site explicitement mentionné, sans Notion direct ni Skills financières. La discovery expose les six READ et save_analysis WRITE. Les résultats ci-dessous proviennent des appels de cette surface ; les logs Sites corrélés montrent des POST /mcp réels en production, HTTP 200, avec oai-authenticated-user-id et oai-authenticated-user-email présents et REDACTED. Les valeurs d'identité, données privées et corps d'analyse ne sont pas exportés dans le repo. Les logs ne contiennent pas les arguments ni les résultats par tool : ils corroborent le passage hébergé et l'identité, pas un enregistrement intégral des enveloppes. La lecture CDP du flux conversation n'a pas fourni de corps exploitable ; aucun résultat brut non observé n'est revendiqué.

| Tool | Démo | Personnel | Diagnostics/fraîcheur observés |
| --- | --- | --- | --- |
| get_portfolio | completed / ok, trois positions fictives | completed / ok, non-null | diagnostics vides, metadata unknown |
| get_company | completed / ok, Company fictive | completed / ok, non-null | diagnostics vides, metadata unknown |
| get_position | completed / ok, position fictive | completed / ok, non-null | diagnostics vides ; position personnelle fresh |
| get_current_analysis | completed / ok, non-null | completed / ok, non-null | démo unmapped_current_status warning ; personnel unsupported_block warning, metadata/source fresh |
| get_analysis_by_id | completed / ok, non-null | completed / ok, non-null | démo diagnostics vides ; personnel unsupported_block warning, metadata/source unknown |
| get_quote | completed / ok, cours illustratif closed | completed / ok, objet non-null, quote unavailable | diagnostics vides ; indisponibilité explicite conservée, aucun prix inventé |

Les références personnelles ont été obtenues du Portfolio puis de Company, sans invention ni copie dans cette passation. get_company et get_analysis_by_id avec ces références en scope demo retournent completed/ok/data null ; la Company fictive reste accessible. Ce test démontre l'isolation pour les références exercées, pas un audit exhaustif de toutes les données. Le warning personnel indique un bloc unrepresented_snapshot non pris en charge par le lecteur ; aucune root cause de régression nouvelle démontrée, aucun correctif spéculatif. Le cours unavailable est un résultat Core valide, pas une preuve de disponibilité du provider de marché.

Logs de la série démo : 2–22 ms pour les cinq appels complémentaires ; série personnelle : jusqu'à 7 372 ms sur les invocations relevées. La négociation initiale comporte un HTTP 400 avec protocole 2026-07-28, puis fallback 2025-11-25 réussi, notification 202 et discovery 200. Ces latences Worker ne mesurent pas tout le budget bout en bout et ne prouvent aucune deadline maximale. Nouveau initialize anonyme via HTTP externe : 401, corps générique 12 octets, sans donnée personnelle. Les preuves antérieures de rejet des headers/cookie forgés sont conservées, sans les utiliser pour une preuve positive.

### Contrôle WRITE et limites de la surface hébergée

Une première préparation a envoyé une chaîne comme input.analysis et a été interceptée par le schéma outil ChatGPT, sans atteindre le serveur. Les essais READ version 0.0.0 et ID ASCII de 513 caractères ont aussi été bloqués au préflight (const 1.0.0 / maxLength 512) : aucune erreur unsupported_version/invalid_input serveur n'est revendiquée pour ces essais.

Le contrôle conforme a ensuite récupéré l'objet Analysis fictif complet depuis get_analysis_by_id demo, avec nouvelle intention de test, expectedRevision null et companyIds fictifs. Une seule requête conforme save_analysis a atteint le MCP, sans relance, délégation ni confirmation de mutation. La surface retourne « Error calling MCP tool » et uniquement {contractVersion: 1.0.0, status: rejected}. Ni code, diagnostics ni outcome ne sont visibles dans cette réponse : ne pas inventer forbidden/not_started. Le log Sites du 3 octobre à 13:06:10.021 UTC corrobore ce POST authentifié : requestId `160923b1d7eaf60421ef8b6d7506946f`, HTTP 200 (enveloppe MCP), 6 449 octets d'entrée, 2 ms. Le statut transport rejected, les flags absents et le chemin d'autorisation du code excluent une mutation ; aucune receipt de persistance n'a été renvoyée.

Root cause démontrée : v209 fournit les détails typés dans structuredContent mais ne place que version/status dans content text ; la surface ChatGPT ne les restitue pas pour ce rejet isError. Correctif minimal préparé dans transports/mcp/server.ts : le texte des rejets transport contient désormais l'enveloppe typée déjà produite, composée exclusivement de messages/diagnostics fixes et sûrs. Les succès conservent le résumé compact ; aucun payload, runId, identité ou résultat privé n'est ajouté au texte de rejet. Aucun changement de contrat, d'auth, de flags, de writer ou de logique métier. Le test de permissions existant vérifie un client ne lisant que content : codes forbidden/confirmation_required, outcome not_started, diagnostics et zéro appel Core, sans écho du sujet/runId.

**Ce correctif est local et non publié** ; v209 et son archive restent inchangées. Une nouvelle version nécessitera une autorisation de publication distincte et une revalidation du rejet typé hébergé. Aucune permission WRITE à activer pour cette validation. La plateforme n'a montré aucune carte de confirmation mutante pendant le contrôle conforme ; cela ne prouve pas son comportement pour une mutation activée. Les [permissions officielles OpenAI](https://help.openai.com/en/articles/20001495-managing-app-permissions-in-chatgpt) sont dépendantes du compte/risque et ne remplacent jamais le contrôle serveur. Décision B maintenue, WRITE fermé et non délégué.

### Checks du correctif local préparé

`npm run test:mcp` PASS 22/22, génération sans drift ; `npm run typecheck`, ESLint ciblé server.ts/test, `npm run build` et `npm run verify:mcp-runtime` PASS. Le harness reste workerd local, Core/adapter/writer réels, D1 isolée et Notion intercepté : six READ démo, auth/refus WRITE, verified/replay/conflict ; ce n'est pas une validation hébergée du correctif. Les suites Core/adapter antérieures ne sont pas rejouées au-delà du harness nécessaire. `git diff --check` PASS ; seuls les quatre fichiers listés en livraison changent, aucun Core/contrat/Worker/UI/configuration/Skill/plugin/migration. L'archive 209 reste de SHA256 `73c17690e5cf3234c5b4ac356fef1fe26ce9dc08f356d1f25927e3c3df209c03`, inchangée après build. Le build local ne prépare ni ne publie une version Sites automatiquement.

## Gate restant avant Lot 12

**NO-GO Lot 12 ; Lot 11 non clos.** OAuth ChatGPT, discovery, six READ personnel/démo et isolation ciblée acquis. WRITE reste fermé/non délégué, env revision 4, flags absents ; aucune mutation réelle autorisée ou exécutée. Le rejet WRITE authentifié est observé, mais ses champs typés restent masqués dans v209 ; le correctif local ci-dessus ne constitue pas une preuve hébergée acquise.

Les maxima contractuels 2/4 MiB et les délais 30/120 s sont toujours prouvés localement uniquement. Les schémas READ n'offrent aucun argument valide de 2 MiB ni délai artificiel ; la surface ChatGPT valide les arguments avant MCP et ne fournit pas ici de client OAuth brut pilotable. Les snapshots réels lus et les latences courtes ne prouvent pas le passage des maxima. Aucun gonflement de données live, tool de test publié, identité simulée ou changement caché de contrat pour obtenir PASS. La documentation officielle consultée ne certifie pas ces budgets exacts du proxy. Cette preuve nécessite un moyen officiel de test OAuth/proxy adapté ou une validation instrumentée séparément autorisée ; toute nouvelle publication exige son gate, pas une republication automatique de v209.

Pas d'intervention humaine de saisie confidentielle/MFA nécessaire pour la connexion effectuée. La connexion ChatGPT n'est plus l'action restante. Avant clôture, obtenir les preuves de plafonds/deadlines manquantes et autoriser séparément la publication du correctif préparé pour revalider les détails du rejet WRITE. La synchronisation de la connexion vers Codex reste également non prouvée. Aucun rollback déclenché : aucune régression produit/auth démontrée. Ne pas démarrer Lot 12, modifier le plugin financier ou déduire GO d'une installation réussie.

Livraison Git : correctif ciblé server.ts, régression dans le test de permissions existant, cette passation et statuts obsolètes du plan canonique ; commit/push normaux, aucun force push. L'élément non suivi `node_modules 2` reste présent ; l'arbre suivi est propre après commit, sans prétendre que tout le working tree est vide.
