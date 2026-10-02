# Checkpoint Lot 8 — Adapter Notion lecture/écriture

2 octobre 2026. Branche `chore/architecture-stabilization-mcp`, parent Lot 7 `d2566aa`, désormais poussé. Lot 7 reste clos; aucun replay du gate 7. Le Lot 9 n’a pas commencé. Un seul Luna a audité le writer du plugin en lecture seule; aucune Skill ni aucun plugin n’est modifié.

**Verdict : NO-GO Lot 9 — implémentation et fixtures livrées, validation d’écriture réelle non aboutie.** La tentative contrôlée autorisée a échoué avant mutation : le runner ne résout pas `api.notion.com` (`getaddrinfo EAI_AGAIN`). Ce reste de validation ne rouvre pas le Lot 7. Aucun bug critique démontré ne reste dans les chemins couverts; ne pas annoncer un succès de persistance production.

## Propriétaires et changements

| Responsabilité | Propriétaire effectif |
| --- | --- |
| Contrats, sélection Current, agrégats portfolio, validation des services | Core, sans table, propriété Notion, secret ou HTTP |
| Alias/propriétés, UUID, familles, statut/archive, fraîcheur, dates, Current, positions et requêtes D1 | `adapters/notion/investment-data.ts` |
| Sources Notion, snapshots, index Companies/relations, import/sync et webhook existants | `adapters/notion/sync.ts` |
| Publication, Run ID, lease/reprise, révision, promotion et vérification Notion | `adapters/notion/analysis-writes.ts` |
| Assemblage des ports et compatibilité des réponses HTTP existantes | `adapters/notion/investment-reads.ts`, factory `createInvestmentAdapter`; ancien nom conservé comme alias |

`app/lib/investment-data.ts` et `app/lib/notion-sync.ts` sont uniquement des réexports vers leurs propriétaires; aucune seconde implémentation ni version v2. Les lecteurs partagent le mapping des positions et la résolution des aliases. Le normalizer/parser et le renderer existants restent réutilisés. Aucun nouvel endpoint HTTP.

Le Core a reçu une correction étroite, reproduite par la fixture nominale : une création peut recevoir un ID attribué par le port, distinct de l’ID proposé; une mise à jour avec `expectedRevision` doit conserver son ID. Les types `SaveAnalysisInput` et `SaveAnalysisReceipt` sont inchangés.

## Lecture de position

`getPosition` lit le snapshot Portfolio par UUID normalisé. Active avec quantité positive → open et projection live existante. Sold/Vendu/Closed explicite → closed, addressable hors holdings; date de sortie seulement si source disponible. Absent → null. Quantité invalide/négative, Active à zéro, statut inconnu/Inactive ou UUID dupliqué dans la projection → erreur de mapping. Un paramètre invalide reste invalid_input. Ni l’absence des holdings, ni Inactive/Archived ne prouvent une fermeture. Aucune PV réalisée ni prix de clôture n’est inventé.

## Writer et reprise

Le ZIP fourni `investment-os-analysis-1.3.0-runtime.zip` est la référence production. Son provider exige Run ID texte direct, recherche/reprise du run, Draft puis validation et relectures, Current et abstention d’écriture de Previous Version. Le dépôt plugin audité décrit ce protocole et des validateurs, sans writer Notion exécutable. Le port implémente la persistance/promotion de son receipt; les automatismes de supersession/version du protocole Skills ne sont pas invoqués ou modifiés par ce chantier.

Le writer utilise le vrai REST Notion et les sources existantes; son schéma est lu avant écriture. Il refuse les propriétés requises absentes/incompatibles, sans créer de colonne. Relations Company exactes, pages actives et source Companies contrôlées avant mutation. Propriétés écrites en liste blanche, corps canonique mappé en blocs Notion; aucune écriture de Previous Version.

- Nouvelle publication : recherche Run ID → Draft avec corps → relecture → validation → relecture → Current → relecture de l’analyse et de chaque Company active dans sa source → comparaison exacte → projection D1 via le vrai upsert et les vrais index, sans vider les corps Companies déjà en cache → receipt.
- Draft/non-publié : corps/propriétés certifiés, pas de promotion; receipt persisted. Une famille sans relation Current définie suit également cette règle. Un schéma connu de famille supportée dépourvu de la relation attendue échoue explicitement; aucun pointeur n’est inventé.
- Même Run ID dans le même module compatible : aucune seconde création; relecture de l’état réel et reprise de la promotion. Incompatible ou plusieurs pages trouvées : conflit `stale_request`.
- `notion_analysis_writes` (migration `0006_dazzling_maginty`) stocke la clé interne `[Run ID, module]`, empreinte de l’intention, ID réel, phase, lease et ancien Current. Le Run ID documentaire reste inchangé et partagé entre modules comme dans le plugin production; une intention différente dans le même module reste un conflit, sans seconde création. Le lease D1 sérialise les writers partageant cette DB; il ne donne pas une unicité globale Notion contre d’autres writers/DB.
- Révision : lecture/comparaison, nouvelle lecture avant update, écriture et relecture; **aucun CAS Notion atomique**. Updates de propriétés avec corps inchangé et même module; une révision de contenu crée un nouveau run/page, sans remplacement destructif du corps existant.
- Corps longs : création puis chunks de 100 blocs, pagination de toutes les relectures, contrôle du préfixe après mutation ambiguë. Un create/append non réconcilié reste partial et est durablement bloqué contre un retry aveugle.
- Retries au maximum 3, seulement rate_limit/timeout/network. GET/query relus avec backoff; mutation 429 réessayable car rejetée; timeout/network/5xx après mutation → réconciliation avant toute reprise. Une création ambiguë non retrouvée n’est jamais relancée sur une simple absence.
- Promotion défaillante mais persistence certifiée → promotion_pending. Mutation réelle ou promotion effectuée avec état final non certifié → partial. verified exige les relectures de contenu/propriétés, Company et Current conformes. Un Current changé concurremment ne reçoit pas un overwrite de reprise.

## Vérifications

Exécutions directes : nouvelle suite Notion **25/25**; Core **7/7**; adaptateur **6/6**; performance Company/documents/archives/integrity **15/15**; quotes **6/6**; sécurité/auth **15/15**; demo **5/5**; Baskets **19/19**. Les cas obligatoires open/closed/absent/incohérent, nominal verified, replay sans doublon, conflit Run ID, révision périmée, Company absente, relation incohérente, promotion KO, vérification KO, timeout ambigu, rate limit borné et Current final incorrect sont couverts. S’ajoutent lease concurrent/perdu, Run ID partagé entre modules, update UUID tireté, Draft, fence d’ambiguïté et chunks de corps.

Le test de sécurité conserve l’injection du normalizer défaillant au nouveau chemin du propriétaire. La suite nouvelle est enregistrée dans `npm test`, mais aucun `npm test` global PASS n’est revendiqué. Aucun test CSS modifié. Typecheck, ESLint ciblé, build Worker/manifest via `npm run build` et diff-check sont verts. Avertissement SQLite expérimental seulement.

## Validation réelle et limites

La première sonde sans authentification avait échoué avant tout appel HTTP. Une tentative contrôlée autorisée a ensuite chargé l’authentification uniquement dans la mémoire et l’environnement du processus. Le premier accès aux schémas a échoué avant création de Company ou d’analyse; aucun receipt live ni replay live n’a pu être validé. Une sonde réseau sans authentification a isolé le blocage : `TypeError: fetch failed`, cause `getaddrinfo EAI_AGAIN api.notion.com`. Aucun contournement ou nouvelle campagne n’a été lancé. Zéro mutation Notion.

Le contrôle en mémoire a recherché une copie du secret dans les fichiers du checkout (hors dépendances et objets Git), `/tmp`, `git diff`, le diff indexé et `git status` : zéro correspondance. Le processus a effacé sa copie de session et terminé; le runner temporaire sans secret a été supprimé. Aucune valeur d’authentification ni export privé n’est conservé dans cette passation.

Reste avant GO : une seule campagne contrôlée dans un runtime disposant du jeton, avec accès DNS/HTTPS fonctionnel à Notion, une Company de test isolée et les schémas réels, démontrant création/relation/Run ID/Current/relectures/receipt du **même adapter**, sans écraser une analyse existante. Vérifier les champs requis des sources effectivement écrites, dont Run ID et types Agent/Status/date; les fixtures ne certifient pas les schémas live Earnings/Decisions. Aucun secret ou export privé dans Git.

Limites explicites : absence de CAS/transaction Notion, writers externes hors lease D1, états ambigus nécessitant une réconciliation positive ou intervention, blocs unsupported/heading >3 et payload >450 KB refusés avant mutation, update de contenu existant non destructif uniquement via nouveau run/page. Pas de déploiement ni migration D1 live appliquée. Ce checkpoint livre le code testable; **le gate Lot 9 reste NO-GO uniquement tant que la validation réelle ci-dessus manque**.
