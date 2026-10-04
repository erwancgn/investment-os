# Livraison Lot 11 — serveur MCP / passation avant Lot 12

3 octobre 2026. Checkout local `investment-os`, branche `chore/architecture-stabilization-mcp`, HEAD d'entrée `6d9566c32e1f7cf42d40053eca0977022238bc05`. Checkpoint propre, origin vérifié après fetch (0/0). `.env.local` ignoré et non suivi ; présence des seules clés nécessaires contrôlée sans valeur affichée. Aucun secret réel utilisé pour les tests locaux initiaux ; les READ hébergés suivants utilisent les accès serveur et OAuth existants sans extraction ni affichage de secret. Le SHA de livraison est celui du commit contenant ce document, sans SHA autoréférentiel.

**Historique au 3 octobre : serveur v210 READ-only restauré après la campagne synthétique v211 ; NO-GO Lot 12.** Sortie 4 MiB et deadline MCP 30 s prouvées via OAuth, façade mince revue ; réémissions 413 reproduites et incertitude bornée. Le timer Worker 120 s est observé, mais sa restitution échoue sur le chemin Codex (HTTP 504) et le cas haut ChatGPT est réémis/cancelé. Lot 11 non clos ; WRITE fermé/non délégué. Aucun changement financier ni Lot 12 commencé. Les états intermédiaires ci-dessous sont historiques ; le gate final et l’evidence terminent cette passation.

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

2 MiB d'arguments / 4 MiB d'enveloppe de sortie, JSON UTF-8 ; framing HTTP borné à +4096 octets. READ 30 s / deux tentatives maximum, WRITE 120 s / une tentative. Un backoff READ ne déclenche aucun nouvel appel après deadline. Aucun snapshot tronqué ni pagination ajoutée. Les preuves finales de sortie/30 s et l’incompatibilité de fin de budget 120 s sont détaillées dans le gate final ci-dessous ; ne pas confondre timer Worker et livraison au client.

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

**État à la fin du checkpoint e0e7add : correctif local non publié.** Cette restriction historique est levée par l’autorisation utilisateur suivante ; publication et revalidation v210 ci-dessous. V209 et son archive restent inchangées. Aucune permission WRITE à activer pour cette validation. La plateforme n'a montré aucune carte de confirmation mutante pendant le contrôle conforme ; cela ne prouve pas son comportement pour une mutation activée. Les [permissions officielles OpenAI](https://help.openai.com/en/articles/20001495-managing-app-permissions-in-chatgpt) sont dépendantes du compte/risque et ne remplacent jamais le contrôle serveur. Décision B maintenue, WRITE fermé et non délégué.

### Checks du correctif local préparé

`npm run test:mcp` PASS 22/22, génération sans drift ; `npm run typecheck`, ESLint ciblé server.ts/test, `npm run build` et `npm run verify:mcp-runtime` PASS. Le harness reste workerd local, Core/adapter/writer réels, D1 isolée et Notion intercepté : six READ démo, auth/refus WRITE, verified/replay/conflict ; ce n'est pas une validation hébergée du correctif. Les suites Core/adapter antérieures ne sont pas rejouées au-delà du harness nécessaire. `git diff --check` PASS ; seuls les quatre fichiers listés en livraison changent, aucun Core/contrat/Worker/UI/configuration/Skill/plugin/migration. L'archive 209 reste de SHA256 `73c17690e5cf3234c5b4ac356fef1fe26ce9dc08f356d1f25927e3c3df209c03`, inchangée après build. Le build local ne prépare ni ne publie une version Sites automatiquement.

## Reprise autorisée — publication v210 et validation OAuth Codex

La nouvelle autorisation utilisateur permet publication/correctifs/connexions nécessaires au Lot 11, toujours READ-only. Checkpoint e0e7add, branche/origin alignés ; arbre suivi propre et `node_modules 2` non suivi, intact. Audit du diff f461658 → e0e7add : quatre fichiers uniquement (transport, test de permissions existant, passation, plan). Aucun changement Core/contrat/Worker/UI/Skills/plugin financier/configuration/migration/Lot 12 ; aucune valeur secrète. `.env.local` reste ignoré/non suivi.

### Publication exacte et rollback

Source e0e7add poussée sur le dépôt source Sites par le workflow officiel, sans publication automatique. Archive sauvegardée après filtrage des migrations Drizzle et métadonnées macOS, contrôle d’intégrité des octets runtime et scanner de secrets PASS. `node_modules 2` exclu uniquement pendant le packaging, exclusion locale temporaire restaurée exactement ensuite. Aucun fichier .env/SQL/Drizzle ni élément non suivi embarqué ; 56 fichiers, 3 450 880 octets décompressés.

- V210 : `appgprj_6a7d7a1233a08191a8d35b746b284e95~appgver_8dd8c5dec3ec8191b2916d0e1854262f`.
- Déploiement : `appgdep_6ac10106e9cc8191a349ef157e00673a`, succeeded, has_mcp=true, env revision 4 ; premier succès observé à 13:20:18 UTC le 3 octobre, reconfirmé après campagne. Même origine et plugin Site. Inventaire D1 après campagne : 13 tables, notion_analysis_writes absente, aucune migration.
- SHA256 gzip : `93d6b91ef92541dc1a7d862ef10e0f88666705a8bb2553b534cc5c4c5cefc229` ; hash natif archive décompressée `sha256:9dbe7de0d2eca96d06bc0cc0b5b39ac19082f1665789474dda654d9afab8294e`.
- Rollback MCP immédiat : v209, version_id `appgprj_6a7d7a1233a08191a8d35b746b284e95~appgver_020f5854beb88191bfaf74d0c10c2dfc`, source f461658, archive native disponible recontrôlée avant publication. Hash natif `sha256:2bc07676b94f4ba446bd326dfbddcfc44a908e49320927237f3ce39f938b8713`. V208 reste le rollback produit sans MCP décrit plus haut.
- Procédure exacte : deploy_site_version(project_id existant, version_id 209 ou 208), sans modification d’audience/env/tunnels, puis get_deployment_status jusqu’à succeeded. La disponibilité des archives et cette procédure sont vérifiées ; aucune restauration effective n’est revendiquée. Aucune régression produit/auth observée justifiant un rollback.

### OAuth et READ revalidés sur v210

La même connexion OAuth ChatGPT a exécuté les six READ dans chaque scope et les deux contrôles d’isolation, dans la conversation déjà identifiée. Tous completed/ok ; diagnostics/fraîcheur et quote personnel unavailable restent ceux du tableau précédent. Les logs montrent l’identité Sites ID/email présente et masquée ; aucun payload privé exporté.

Le [protocole officiel Codex App Server](https://learn.chatgpt.com/docs/app-server) permet app/installed(forceRefresh), app/read, mcpServerStatus/list puis mcpServer/tool/call sans lancer de tour de modèle. Audit via `codex app-server --stdio`, thread éphémère, connexion gérée existante uniquement : aucun codex mcp add/login, nouveau plugin, token extrait ni identité simulée. L’inventaire rafraîchi fournit l’ID d’application exact `asdk_app_sites_ad68978f9cb8819192563710e9dd1615`, enabled=true/callable=true. Il expose les sept tools `investment_os.*` ; les six READ sont readOnly, save_analysis non-readOnly. Le plugin financier 1.3.0 reste indépendant et intact ; le CLI inventorie également un ancien plugin personnel 1.2.4, laissé en place sans invocation ni modification.

La divergence précédente était une inspection de l’ID plugin au lieu de l’ID application : get_app_permissions avec l’ID application retourné fournit désormais found, Use my default / Allow low-risk actions. Aucun réglage de permission modifié. Suggestion du plugin existant : already_installed, aucun second widget ni seconde installation. Le résultat READ réel, et non ce statut seul, prouve la connexion Codex.

Les six READ démo et les six READ personnels ont aussi retourné des enveloppes brutes via cet App Server. Validation contre les outputSchema **du bundle canonique 1.0.0**, avec le validateur JSON Schema déjà installé : 12/12 PASS. Références personnelles dérivées en mémoire du Portfolio/Company réels ; aucun ID, contenu d’analyse ou valeur financière personnelle enregistré dans les rapports. Deux lectures Company/Analysis avec ces références en scope demo : completed/ok/null, schémas PASS. Diagnostics démo unmapped_current_status conservés ; diagnostics personnels observés dans ChatGPT, sans les confondre avec un résultat vide de metadata.

Mesures bout en bout du client Codex : READ démo 557–2 908 ms ; READ personnels 938–7 723 ms ; isolation 690/716 ms. Plus grande enveloppe personnelle mesurée : 126 763 octets. Ces succès ne prouvent ni 4 MiB de sortie ni une deadline maximale. Initialize anonyme externe sur v210 : 401, corps générique 12 octets. Santé produit : accueil, session, Portfolio et status Notion HTTP 200 dans les logs après publication, aucun changement UI ni bypass Core.

### Rejet WRITE typé et contrôle de taille borné

La première préparation ChatGPT v210 utilisait companyId singulier : échec de préflight, aucune requête WRITE serveur. La préparation corrigée respecte companyIds, objet Analysis fictif entier, runId isolé et expectedRevision null. Une seule invocation conforme a atteint le serveur le 3 octobre à 13:26:10.419 UTC : requestId `2ef3eb2756531f8904a6f5866471ba0d`, 6 457 octets, HTTP 200, 4 ms. Le résultat réel expose désormais contractVersion 1.0.0, scope personal, status rejected, error forbidden / Accès refusé. / retryable=false / outcome=not_started ; diagnostic scope_permission/error. Aucun champ de persistance, secret, identité ou écho de payload. Aucune confirmation mutante et aucun retry pour cette invocation.

Pour isoler la taille du proxy, deux premières sondes READ portant un champ inconnu de 2 MiB/2 MiB+1 ont été réduites par le connecteur avant envoi (logs : 564 octets). Elles **ne prouvent aucun plafond**. Un essai Current avec type au lieu de family a aussi été rejeté au préflight ; seule la requête corrigée est comptée comme succès READ.

Après nouveau contrôle des flags absents/env revision 4, deux sondes négatives indépendantes save_analysis ont utilisé l’Analysis démo et un titre ASCII synthétique, jamais des données live modifiées. Intentions runId distinctes, expectedRevision null, aucun retry dans le harness ni dans notre transport ; WRITE fermé avant service/Core :

| Sonde | Entrée contractuelle UTF-8 | Observation hébergée |
| --- | --- | --- |
| Titre synthétique valide, limite d’entrée | 2 097 152 octets | HTTP 200, forbidden/not_started, scope_permission ; frame réel 2 097 655 octets, requestId `499bd8cd402900662d5d49f3e9b8583b`, 13:34:08.009 UTC, 88 ms Worker |
| Dépassement du framing HTTP | 2 101 248 octets | HTTP 413, frame réel 2 101 751 octets, erreur client « Limite de taille dépassée. » ; détails typés HTTP masqués par le connecteur |

Cela démontre le passage effectif d’une entrée de 2 MiB avec OAuth réel, et le refus du frame supérieur à 2 MiB+4096. Cela ne teste pas la branche de contrôle 2 MiB+1 des arguments après autorisation WRITE : celle-ci est volontairement inaccessible puisque WRITE est fermé.

**Écart amont observé :** pour la seconde sonde, un seul mcpServer/tool/call du harness produit deux POST 413, avec initialize/notification entre eux : requestIds `8cb61e0e6f185f780c1bf06b024f289c` à 13:34:09.058 UTC et `8e3864b893ae669da038e792817891e1` à 13:34:09.270 UTC, 1/2 ms. Le canal Codex/connecteur/SDK réémet donc cette requête refusée ; son composant précis et son comportement après timeout restent non déterminés. Aucun appel Core pour ces refus de frame/auth, aucune mutation ni receipt. Ne pas généraliser une absence de retry WRITE du serveur à toute la chaîne hébergée. Aucun correctif spéculatif du writer/transport sur cette cause amont ; WRITE reste fermé.

Save_analysis reste annoncé selon le contrat (le catalogue indique isEnabled=true pour l’outil), mais cela ne confère **aucun droit WRITE ou délégation** : les deux flags serveur sont absents. Les [permissions officielles](https://help.openai.com/en/articles/20001495-managing-app-permissions-in-chatgpt) dépendent du compte/risque ; le défaut low-risk et l’absence de carte pour un rejet ne prouvent pas la confirmation d’une mutation activée. Décision **B : READ-only maintenu**, notamment en raison de la réémission amont observée. Aucune mutation Notion, migration D1, rotation de secret ni modification de permission externe.

### Limites au checkpoint 4451d7a — historique avant instrumentation

Les schémas READ bornent les identifiants à 512 caractères, les options sont booléennes ; le connecteur supprime les champs inconnus ou rejette le schéma avant MCP. Ils n’offrent aucun paramètre de délai/taille de sortie. WRITE est refusé avant la création du service et avant son timer 120 s. Aucun snapshot réel exercé n’approche 4 MiB. Le [runtime Sites officiel](https://learn.chatgpt.com/docs/sites) documente HTTP/WebSockets et le stockage, sans garantie exacte des maxima MCP 4 MiB/30/120 s. Le CLI/App Server a permis des preuves supplémentaires, mais ne fournit pas d’injection de délai/résultat dans le Worker publié.

Une attente côté client, un timeout choisi plus court, une identité forgée, un résultat synthétique présenté comme lecture réelle ou un WRITE activé ne combleraient pas ces preuves. Aucun nouveau tool, ressource ou mode de test public ajouté à la production. Il reste nécessaire d’obtenir un moyen officiel de validation instrumentée OAuth du proxy, séparant données synthétiques et Core live, ou une garantie plateforme vérifiable des budgets, puis d’exercer les limites manquantes. L’autorisation de publication n’est plus un obstacle ; aucun consentement, secret à saisir ou MFA ne manque. La cause restante est la capacité de provoquer et observer ces conditions dans un environnement hébergé contrôlé, avec WRITE toujours fermé.

## Gate au checkpoint 4451d7a — historique

**NO-GO Lot 12 ; Lot 11 non clos.** OAuth ChatGPT/Codex, discovery, six READ personnel/démo et isolation ciblée, anonymous refusé, détails typés forbidden/not_started, passage d’une entrée de 2 MiB et refus du framing trop grand acquis. Contrat 1.0.0 inchangé, mapping exclusif Core, aucune logique métier ni fuite de secret observée. Site existant confirmé acceptable pour ces usages ; rollback v209/v208 disponible, restauration non exercée.

Restent non prouvés : sortie maximale 4 MiB, deadline READ 30 s et WRITE 120 s via le proxy. La réémission amont des rejets HTTP 413 doit également être qualifiée avant toute activation WRITE ; aucune absence globale de retry WRITE ni confirmation d’une mutation activée n’est revendiquée. Les preuves locales acquises restent PASS, sans être rebaptisées preuves hébergées. Aucun Lot 12 commencé.

Checks de cette reprise : audit exact du diff/manifest/auth/scopes/flags, archive et secrets PASS ; get_deployment_status succeeded reconfirmé ; assertions OAuth Codex 12 READ + 2 isolation et outputSchema PASS ; refus WRITE typé et sondes HTTP ci-dessus ; revue du diff documentaire et git diff --check PASS. Suites locales acquises à e0e7add non rejouées : MCP 22/22, typecheck, lint ciblé, build et harness workerd PASS. Rapports locaux ne contiennent que statuts/codes/tailles/latences ; pas de payload personnel dans les livrables.

Le fetch final a rencontré deux fichiers de références Git invalides (nom de branche avec suffixe espace `2`, local et origin), pointant un objet indisponible. Ils ont été conservés octet par octet hors `.git/refs`, dans `.git/lot11-ref-quarantine`, puis le fetch canonique a réussi ; aucune branche valide ni donnée de travail remplacée/supprimée. Cette correction réversible concerne seulement les métadonnées Git locales.

Livraison après validation : cette passation et le plan canonique uniquement ; commit/push normaux. La source publiée reste e0e7add, le commit documentaire final ne republie rien. Arbre suivi propre après commit ; `node_modules 2` reste non suivi/intact. Action restante : capacité de validation OAuth/proxy instrumentée des maxima/deadlines et qualification de la réémission amont, sans activation WRITE. Ne pas déclarer le lot clos ni démarrer Lot 12 sur ces preuves partielles.

## Revue statique ciblée — façade MCP v1.0.0

Revue Luna en lecture seule puis vérification par l’orchestrateur sur les sept handlers canoniques de `e0e7add` et leurs appels réellement assemblés. Aucun nouveau test fonctionnel ni refactor métier. `invoke` utilise exclusivement le manifeste `MCP_TOOLS` ; aucun handler individuel parallèle ni accès direct Notion/D1/provider dans MCP. La séparation MCP/Core/adapters est suffisamment saine pour poursuivre ; aucune violation architecturale bloquante trouvée. Le probe synthétique temporaire de la campagne proxy est traité séparément, jamais comme un huitième tool produit.

| Sujet | Couche actuelle | Couche cible | Écart |
| --- | --- | --- | --- |
| scope/auth | `sites-auth.ts` : identité dispatch ; `server.ts` : scope, permissions, délégation, bornes | Auth/transport | `transport/auth` — acceptable ; assemblage personnel/démo dans Worker, aucune identité des arguments |
| Current selection | Core `investment-os.ts:getCurrentAnalysis` → `current-selection.ts` ; pointeurs physiques lus par adapter | Core pour sélection ; adapter pour source | `ok` — aucune sélection ni mapping Notion MCP |
| portfolio calculations | `core/portfolio.ts` : agrégats, weights et PnL d’ensemble ; `investment-data.ts` : projection des lignes/PRU/quotes et réconciliation | Core agrégats ; adapter projection des positions | `ok` — responsabilités existantes distinctes ; aucune arithmétique Portfolio dans MCP |
| quote/FX/freshness | Port `readQuote` ; adapter appelle le helper serveur historique `app/lib/quotes.ts` (collecte/cache, FX, fraîcheur), Core valide Quote | Port/adapter de cotations, Core valide contrat | `compat legacy` — placement historique du helper dans `app/lib`, sans dépendance React ni duplication MCP ; dette non bloquante, non déplacée ici |
| Analysis normalization | `investment-reads.ts:analysisOf` réutilise `app/lib/document-presentation.ts` ; Core valide Analysis | Adapter/normalizer canonique partagé puis Core | `ok` pour responsabilité ; emplacement historique partagé, aucune copie/parser/normalisation MCP |
| diagnostics/provenance | Source/adapter et Core construisent metadata ; MCP transporte ServiceResult entier et ses rejets fixes | Source/Core ; transport pour ses seuls diagnostics | `ok` + `transport/auth` — aucun diagnostic transformé en décision métier ; texte de rejet hébergé n’est qu’un format transport |
| WRITE idempotence/revision/receipt | MCP passe l’intention intacte et protège permission/concurrence locale ; Core valide ; writer journalise/reprend/relit | Core validation ; adapter writer persistance/idempotence | `ok` — runId/expectedRevision inchangés, aucune reprise métier dans MCP ; fence isolate n’est pas un journal durable |

Références ciblées : `transports/mcp/server.ts` (manifest/invoke/call), `transports/mcp/sites-auth.ts`, `core/services/investment-os.ts`, `core/services/ports.ts`, `core/analysis/current-selection.ts`, `core/portfolio.ts`, `adapters/notion/investment-reads.ts`, `investment-data.ts:628–758`, `analysis-writes.ts:125–275`, `app/lib/quotes.ts:199–233`. Le bridge legacy de `createInvestmentAdapter` appartient aux consumers HTTP historiques ; MCP compose `createInvestmentService`, pas ce bridge. Les helpers historiques partagés ne sont pas une seconde implémentation dans le proxy. Aucune correction automatique de dette non bloquante et aucun travail Lot 12.

## Campagne finale proxy OAuth — v211 temporaire, v210 restaurée

Checkpoint de reprise `4451d7a9f94a11f2bb977a6f7f15799e51151739`, origin aligné, seul non-suivi `node_modules 2` préservé. Campagne unique du 3 octobre 2026, données exclusivement synthétiques/démo. Aucun READ canonique réexécuté pour fabriquer du volume, aucune mutation Investment OS/Notion ni migration D1. Contrats/Core/Skills/plugin financier 1.3.0/permissions OAuth/UI inchangés.

L’instrumentation est le commit `08790f2dc03ef4fb61e390d34cf8df360cbe9bda` : module de validation isolé, tests purs, deux hooks temporaires transport/assemblage. Tool explicitement `lot11_proxy_validation`, READ-only, propriétaire authentifié seulement, sans port WRITE, source personnelle, DB ou provider ; une tâche active par isolate, bornes 4 MiB+1 et 125 s, expiration automatique à 18:30 UTC. Il construit une Company fictive via un port synthétique et le vrai Core, puis calibre **l’enveloppe JSON UTF-8 complète** ; ne teste aucune méthode financière. Le timer partagé est strictement équivalent à celui de v210, sans changement de règles métier. Le délai 120 s est exercé par un READ synthétique ; ce n’est pas un WRITE autorisé ni un receipt de persistance.

Publication v211 : saved version `appgprj_6a7d7a1233a08191a8d35b746b284e95~appgver_e8c96e264c2481918be9da7e72102ac7`, deployment `appgdep_6ac11a78661c8191939d3f1cb158f78d`, succeeded/has_mcp=true à 15:09:31 UTC, env revision 4. Archive sans SQL/Drizzle/macOS/.env/valeur secrète locale ; octets runtime conservés après filtrage ; SHA-256 gzip `613ade01b67a5aba16aa1eb1f65e783ae5b41f9a30353e41c5dcffc6af93dfbf`. L’audience est conservée, les deux flags WRITE restent absents. Rollback v210 vérifié avant publication avec hash d’archive canonique inchangé.

Les premiers essais voient un catalogue client figé à sept tools et sont refusés « Unknown tool » sans atteindre le probe. Après **Actualiser les outils** dans la gestion officielle du plugin Site et nouveau chat, le catalogue contient temporairement huit tools. Cette étape actualise les métadonnées, pas les permissions/délégations. Connexion OAuth existante réutilisée : aucune identité forgée, extraction de token, nouveau plugin ou serveur MCP local configuré. Codex CLI 0.160.0 utilise l’App Server officiel et une unique RPC par cas, sans turn d’inférence ; le harness attend au maximum 185 s. ChatGPT utilise le plugin Site connecté. Les identités de fixtures restent exclusivement dans les tests locaux acquis.

### A — frontière de sortie

| Client | Enveloppe demandée et sérialisée avant transport | JSON-RPC préparé, octets | HTTP Worker observé | Résultat client |
| --- | ---: | ---: | --- | --- |
| Codex | 16 384 | 16 897 | 200 | completed ; 16 384 octets client |
| Codex | 4 194 304 | 4 194 823 | 200 | completed ; 4 194 304 octets client, 4 186 335 caractères X vérifiés sans troncature |
| Codex | 4 194 305 proposée | 720 après rejet | 200 | rejected / limit_exceeded ; diagnostic lot11_limit_exceeded |
| ChatGPT | 16 384 | 16 896 | 200 | completed, métriques et résultat structuré rapportés |
| ChatGPT | 4 194 304 | 4 194 820 | 200 | completed, résultat structuré rapporté |
| ChatGPT | 4 194 305 proposée | 716 après rejet | 200 | rejected / limit_exceeded visible ; diagnostics structurés non visibles dans l’UI |

Le plafond contractuel porte sur l’enveloppe **hors framing**, pas sur le JSON-RPC : le chemin OAuth transporte bien plus de 4 MiB avec son framing à la frontière permise. À +1, le guard de validation refuse avant l’envoi du gros résultat, aucune troncature n’est utilisée. SHA-256 de l’enveloppe client Codex exacte : `a1ac391ad1ab7792054a8c4d08cb49e181fe38967173220f20b9a9198f6a5001`. SHA du JSON-RPC Worker correspondant : `6ad26859cc36ddae2517ea02a1675cfd38f6a110c5bc7977998fd8881f764e58`. L’UI ChatGPT ne donne ni octets client bruts ni preuve d’intégrité complète du padding ; son succès est corroboré par le HTTP 200/compteur/hash Worker, sans prétendre avoir audité son contexte modèle entier. Les rejets du probe ont un résumé textuel de métriques, distinct du texte complet des rejets canoniques v210 déjà validés ; leur manque de diagnostic dans l’UI ne redéfinit pas le contrat.

### B — deadlines et couches

| Chemin | Délai Core synthétique | Budget MCP | Observation |
| --- | ---: | ---: | --- |
| Codex | 29 s | 30 s | HTTP 200/completed ; Worker 29 s, client 31 814 ms |
| Codex | 31 s | 30 s | MCP deadline à +30 000 ms, HTTP 200/rejected timeout ; client 32 061 ms |
| ChatGPT | 29 s | 30 s | HTTP 200/completed ; Core fini à +29 000 ms |
| ChatGPT | 31 s | 30 s | MCP timeout à +30 000 ms ; Core fini à +31 000 ms après la réponse |
| Codex | 115 s | 120 s | HTTP 200/completed ; client 117 641 ms |
| Codex | 119 s | 120 s | HTTP 504 amont à 120 699 ms client ; Core finit à +119 000 ms, invocation Worker canceled |
| Codex | 121 s, essai indépendant | 120 s | HTTP 504 amont à 120 770 ms client ; MCP deadline à +120 000 ms, réponse préparée de 699 octets puis Core fini à +121 000 ms ; Worker canceled |
| ChatGPT | 119 s | 120 s | HTTP 200/completed, métriques visibles ; Core fini à +119 000 ms |
| ChatGPT | 121 s | 120 s | Deux requêtes pour la même invocation, seconde à +61 135 ms ; seconde refusée busy ; première canceled après 89 551 ms, aucun événement MCP deadline/Core end capturé |

L’essai Codex 121 s immédiatement après le premier 504 avait reçu busy : la première lecture était encore active. Cet essai est conservé dans l’evidence et **exclu** de la preuve de deadline ; un unique essai indépendant le remplace. Pas de retry WRITE, aucun WRITE du tout. Le verrou synthétique révèle la réémission ; il ne faut pas enlever ce verrou pour lui substituer un succès artificiel.

**Couches prouvées :** les timers MCP du Worker à 30/120 s sont observés avec des timestamps handler/Core/départ/réponse préparée ; le Core synthétique n’a pas de timeout propre. Un HTTP 504 retourné au client Codex avant le rejet MCP vient de la chaîne HTTP amont du Site, pas du timer 185 s du harness ni d’une erreur Core. Le composant amont précis et son instant de réception ne sont pas exposés : `proxyReceivedTimestamp: null` dans l’evidence. Ne pas attribuer ce 504 à une limite universelle Sites ou à une bibliothèque déterminée. La lecture ChatGPT de 119 s réussit, tandis que son contrôle de 121 s subit une réémission et une cancellation avant le timer : aucun plafond stable de 60/90 s n’en est déduit. `Request.signal` n’a fourni aucun abort enregistré ; c’est distinct de l’outcome Cloudflare canceled. `preparedResponse.httpStatus=200` ne signifie pas livraison lorsque le fetch est canceled ou que le client a déjà reçu 504. Le transit hors Worker explique aussi que les mesures client READ dépassent 30 s.

**Compatibilité 120 s non acquise.** Une deadline Worker observée ne suffit pas : le résultat typé de fin de budget ne traverse pas le chemin Codex exercé, et le cas haut ChatGPT ne démontre pas son retour à 120 s. Aucun plafond caché à 115 s, changement de contrat ou correctif spéculatif n’est introduit. Pas de preuve de mémoire maximale Worker ou d’annulation transactionnelle ; aucune telle garantie n’est revendiquée.

### C — réémission HTTP 413 : cas B, attribution bornée

| Client, une invocation | 1er POST 413 UTC / requestId | 2e POST 413 UTC / requestId | Corrélation |
| --- | --- | --- | --- |
| Codex | 15:32:43.852 / 699b679590b218b8242939561e66b691 | 15:32:44.055 / f928804f73a76fa01cfdb75b78b4f2db | même invocationId, deux attemptId, RPC MCP 0 puis 1, même trace amont avec spans distincts |
| ChatGPT | 15:43:41.764 / 3a42962f7c14c063b3ced6f70ac14252 | 15:43:41.925 / 97ff4b9dd81d1244c345b9378faacc28 | même invocationId, deux attemptId, RPC MCP 0 puis 1, même trace amont avec spans distincts |

Aucun Core commencé pour ces 413. Aucun mcp-session-id reçu ; user-agent absent/non discriminant. Des HTTP 200/202 intermédiaires sont visibles ; leurs corps JSON-RPC n’étant pas capturés, cette campagne ne les assimile pas à une méthode précise. Le statut HTTP 413 synthétique reproduit une réémission avec un tout petit payload, sans réutiliser la charge save_analysis du checkpoint précédent ; il ne prouve pas que chaque paramètre du frame original est identique. Codex expose le rejet sûr dans error_data.payload, enveloppé par McpServerError/INVALID_ARGUMENT ; ChatGPT affiche HTTP 413 sans diagnostic structuré visible.

**Fait démontré :** les duplications arrivent en amont du Site pour une invocation logique ; elles ne sont pas causées par un deuxième appel Core ou une boucle du handler. **Root cause précise non démontrée :** aucune trace des tentatives entre Codex/ChatGPT, le connecteur MCP distant et le proxy interne OpenAI ; aucun code/configuration de leur politique de reconnexion/retry accessible. Le SDK JavaScript local 1.32.0 ne rejoue pas un 413 (`client/streamableHttp.js:320–378` : retry 401/auth ou 403/insufficient_scope seulement), mais cela ne prouve rien sur le SDK réellement utilisé en amont. La seule présence d’une même trace ou d’une RPC renumérotée n’identifie pas son auteur.

Instrumentation minimale manquante pour l’attribution : identifiant d’appel et numéro de tentative à chaque hop client/connecteur/proxy, cause du retry/reconnect/timeout, horodatage de réception/départ et budget restant, corrélés aux requestId/trace/attemptId Site. Elle doit être fournie par le runtime amont, sans payload, token, cookie ou identité privée. L’instrumentation Site ajoutée ici ne peut fabriquer ces spans manquants. Même limite pour l’attribution de la réémission ChatGPT longue. Incertitude explicite, pas d’absence de reproductibilité présentée comme PASS.

**Mitigation avant tout WRITE futur :** maintenir les deux flags désactivés/non délégués ; exiger une politique amont sans replay automatique des mutations, ou une reprise explicitement autorisée du **même runId/family, intention et expectedRevision**, après contrôle du receipt/journal/état. Le writer existant utilise la clé runId+family, une empreinte du contenu persisté, une lease/journal D1, le contrôle expectedRevision et des relectures ; il retourne persisted/promotion_pending/verified/partial ou stale_request, sans recréer un create ambigu au replay. Les tests locaux acquis couvrent ces chemins, aucun WRITE réel ajouté. Un timeout/504/rejet d’une tentative réémise ne certifie pas l’annulation de la première, ni un succès sans receipt. Le fence MCP est par isolate ; D1/Notion n’ont pas de transaction atomique commune et l’empreinte porte le contenu persisté, pas tous les champs transport. Ce design protège les reprises identiques sans fournir une garantie distribuée exactly-once. La mitigation est suffisante pour **garder READ-only**, pas une autorisation d’activer WRITE.

### Retrait, rollback et checks

Probe, tests temporaires, hooks Worker/transport et helper de deadline temporaire supprimés. Le code exécuté localement est octet pour octet celui de `4451d7a`/`e0e7add` pour transport/Worker/Core/contrats/adapters/manifest ; aucune nouvelle feature, règle métier ou compat proxy permanente. `node_modules 2` reste intact, non suivi et non inclus.

**Rollback réellement exercé vers la v210 exacte**, pour retirer la validation : version `appgprj_6a7d7a1233a08191a8d35b746b284e95~appgver_8dd8c5dec3ec8191b2916d0e1854262f`, source e0e7add, hash de contenu `sha256:9dbe7de0d2eca96d06bc0cc0b5b39ac19082f1665789474dda654d9afab8294e`. Déploiement de restauration `appgdep_6ac12348880481919bbe053739738cc8`, succeeded/has_mcp=true à 15:46:28.923720 UTC, env revision 4. Catalogue officiel rafraîchi après restauration : App Server voit uniquement les sept tools canoniques, sans appel métier supplémentaire ; aucune trace du probe dans les sources ni le build. Aucune archive modifiée de v210 ni migration. V209/v208 restent les rollbacks historiques disponibles ; aucune restauration vers ces deux versions exercée. Une restauration exige le saved version ID exact, puis get_deployment_status jusqu’à succeeded.

Checks proportionnés : tests MCP existants 22/22 PASS pendant l’ajout du hook ; tests temporaires purs 3/3 PASS (auth/expiration/bornes/timer partagé), Workerd synthétique isolé PASS sans provider ni opération DB ; typecheck, ESLint ciblé et build avec probe PASS ; typecheck/build/validation d’artefact après retrait PASS. Tests domaine/writer acquis conservés, aucune nouvelle campagne métier. Audit archive/secrets/publication et diff hors Lot 11 PASS. Les preuves runtime détaillées expurgées, timestamps et hashes sont dans [lot-11-proxy-evidence.json](lot-11-proxy-evidence.json) ; aucune charge X, identité privée, credential ou log brut n’y figure.

## Gate final Lot 11 — décision avant Lot 12

| Preuve | Hébergé OAuth | ChatGPT | Codex | Résultat | Evidence |
| --- | --- | --- | --- | --- | --- |
| READ canonique | déjà acquis | PASS | PASS | PASS | sections OAuth v210, 12 READ |
| isolation scopes | déjà acquis | PASS | PASS | PASS | sections OAuth v210, 2 contrôles |
| WRITE disabled | déjà acquis | PASS | PASS | PASS | forbidden/not_started/scope_permission, flags absents |
| input 2 MiB | déjà acquis | non exercé à la frontière | PASS | PASS sur Codex | sondes v210 |
| framing > limite | déjà acquis | non exercé à la frontière | HTTP 413 | 413 | sondes v210 |
| output ~4 MiB | oui, synthétique | succès/rejet visibles ; intégrité client non mesurable | intégrité et frontière PASS | frontière comprise et prouvée | evidence cases sizes |
| deadline ~30 s | oui, synthétique | PASS | PASS | timer MCP et retour prouvés ; pas d’annulation garantie | evidence cases time30 |
| deadline ~120 s | oui, synthétique | 119 s succès ; cas haut busy/canceled | 115 s succès ; 119/121 s HTTP 504 | **NO-GO compatibilité bout de budget** | evidence cases time120 |
| retry/replay 413 | oui, synthétique | 2 POST | 2 POST | cas B : duplication démontrée, auteur opaque ; WRITE fermé | evidence cases retry |
| façade mince | revue statique | sans objet | sans objet | PASS, dette de placement non bloquante | tableau architectural ci-dessus |

**NO-GO Lot 12 ; Lot 11 non clos.** Les maxima de sortie et le timer 30 s ont désormais des preuves OAuth réelles, et l’incertitude des réémissions est précisément bornée. Il reste un écart **observé**, pas simplement un manque de test : le chemin Codex perd le retour typé autour du budget 120 s, et le cas haut ChatGPT est réémis/cancelé avant preuve du timer. Le timer 120 s Worker lui-même est prouvé, sa compatibilité sur toute la chaîne ne l’est pas. Aucun changement de contrat, activation WRITE, migration ou travail Lot 12 pour masquer ce point.

Action restante : obtenir observabilité/contrôle ou garantie vérifiable du timeout/replay des hops OpenAI concernés, résoudre cette incompatibilité puis revalider seulement les cas hauts manquants. Aucun nouveau consentement OAuth/MFA ni autorisation de publication ne manque ; le checkout ne permet pas de modifier les composants amont opaques. Un budget plus court demanderait une décision explicite de contrat, pas un plafond caché. La livraison reste READ-only, sur le Site existant avec runtime canonique restauré et rollback prouvé.

## Reprise du 4 octobre — correction du budget synchrone

Le worktree Orca `hawkfish` pointait sur une branche antérieure sans ces sources. Le worktree canonique local `investment-os-stabilization`, HEAD `00ef1460201bcaa58c0311b6dec1ff2745437d0c`, a été retrouvé via `git worktree list`, vérifié aligné avec origin après fetch et ouvert par le helper source Sites (même HEAD). Node 22.23.1, npm 11.9.0, dépendances présentes ; clés Notion locales présentes sans lecture affichée de valeurs. Le lien local préexistant `node_modules 2` reste intact, exclu localement des livrables.

Décision explicitement autorisée par la mission : **READ et WRITE ont désormais une borne synchrone de 30 000 ms**. Les échecs 120 s ci-dessus sont les preuves de reproduction conservées ; la cause observable est la perte de la réponse en amont du Worker avant restitution fiable au client, avec réémission/cancellation possibles. Aucune attribution spéculative à un hop opaque. Le budget 30 s dispose déjà des preuves OAuth 29/31 s sur ChatGPT et Codex ; elles sont réutilisées pour la compatibilité du délai de réponse, sans prétendre être une mutation WRITE hébergée.

Correction minimale : constante `MCP_LIMITS.writeTimeoutMs`, assertions de contrat/deadline et documentation normative. Schémas, sept tools et version de payload 1.0.0 inchangés. Le même mécanisme de deadline du handler est utilisé ; aucun async durable ajouté. Le test WRITE vérifie 29 999/30 000 ms, abort du signal sans annulation du port, une tentative Core, outcome unknown non retryable, fence pendant le travail et rétention waitUntil jusqu'au règlement. Le timeout n'est jamais une preuve d'échec de persistance ni de réussite. waitUntil demande une continuation au runtime, sans garantie de terminaison durable.

READ : deux tentatives au plus pour une erreur transitoire terminée dans le même budget, backoff 250 ms. WRITE : une tentative, aucune relance automatique. Les réémissions amont restent possibles ; 413 est refusé avant Core. WRITE reste fermé/non délégué en production ; toute activation future exige autorisation explicite, politique de reprise contrôlée et validation spécifique. Une reprise conserve runId, famille, intention et expectedRevision et examine receipt/journal/état. Le fence local ne remplace pas l'idempotence durable du writer.

Validation locale : `test:mcp` 22/22 PASS après correction, avec receipts/replay/conflit via SDK HTTP et vrai writer sur fixtures isolées ; typecheck PASS. Publication et validation du nouvel artefact à consigner avant clôture.
