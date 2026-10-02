# Passation Lot 9 — Lot 8 clos, adapter Notion lecture/écriture validé

2 octobre 2026. Branche `chore/architecture-stabilization-mcp`, parent Lot 7 `d2566aa`, désormais poussé. Lot 7 reste clos; aucun replay du gate 7. Le Lot 9 n’a pas commencé. Un seul Luna a audité le writer du plugin en lecture seule; aucune Skill ni aucun plugin n’est modifié.

**Verdict final : Lot 8 clos — GO Lot 9.** La validation contrôlée a été exécutée sur le Mac de l’utilisateur avec le véritable adapter du checkpoint `5d8baad`. Les sorties locales rapportées dans cette session confirment la persistance réelle, les relations, Current, les relectures, le receipt `verified`, deux replays sans création ni doublon, puis le nettoyage. Le blocage DNS du runner Cloud est historique; il ne bloque plus le gate. Le Lot 9 n’est pas commencé.

## Checkpoints et état de livraison

- Branche : `chore/architecture-stabilization-mcp`; miroir GitHub : `erwancgn/investment-os`.
- Lot 7 clos : `d2566aa`. Implémentation Lot 8 : `2d35478`. Checkpoint local validé : `5d8baad`; ce dernier commit documentait le blocage Cloud, sans changer le produit.
- Cette passation clôt le gate par un commit documentaire ultérieur; le SHA du produit reste `2d35478`. Aucun changement de code nécessaire à la validation locale.
- Aucun déploiement Sites ni migration D1 live : la production reste au checkpoint Lot 6 indiqué dans `lot-8-handoff.md`. La validation locale du writer n’est pas un déploiement du Worker.
- Aucun corpus, secret ou harness de validation live committé. Les harnesses ont été créés seulement sous `/tmp`, avec nettoyage à la sortie. L’authentification locale a été lue depuis `process.env.NOTION_TOKEN`; aucune valeur ni instruction de réutilisation de cette session n’est conservée ici.

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

## Validation live locale acquise

Preuve : sorties terminal fournies par l’utilisateur sur son Mac, checkout propre `5d8baad`, Node `v22.23.1`, accès à Notion. Sol n’a pas exécuté cette campagne depuis Cloud. Le harness temporaire a bundlé les modules du dépôt avec esbuild; il a utilisé `createInvestmentAdapter`, une SQLite en mémoire avec les migrations réelles `0000`–`0006`, et le véritable transport REST du writer. Aucune logique d’index ou de persistance de l’analyse n’a été réimplémentée.

Une Company de test isolée, au Current initial vide, et une analyse Business technique ont été créées. Aucune analyse existante n’a été écrasée. Après une interruption du harness, la reprise a utilisé ces mêmes pages et ce même Run ID, avec toute nouvelle création explicitement interdite.

| Gate contrôlé | Preuve acquise |
| --- | --- |
| Create / persist | Page créée par le writer de production, persistée et relue; identité attribuée par Notion |
| Relation Company | Relation de l’analyse égale exactement à la Company de test |
| Run ID | Texte relu égal au Run ID de la campagne |
| Promotion Current | Relation Current Business de la Company relue égale exactement à cette analyse |
| Re-read | Page, Company et corps relus via REST; corps attendu identique |
| Receipt verified | Reprise et second replay retournent `verified`, `persisted=true`, `promoted=true`, `verified=true` |
| Replay sans doublon | Deux replays, même ID; zéro nouvelle création; recherche paginée du Run ID : une seule analyse |
| Nettoyage | Current restauré vide; Company et analyse mises à la corbeille, `in_trash=true` relu pour chacune |

Sortie finale rapportée : `VALIDATION LIVE PASS`, `NETTOYAGE VÉRIFIÉ`, `GO LOT 9`, code de sortie `0`.

Les obstacles intermédiaires sont résolus : DNS Cloud indisponible, puis HTTP 403 de création avant campagne autorisée côté Mac. Le premier harness local employait à tort une assertion `archived === false` et le PATCH de nettoyage `{archived:true}`. Avec Notion-Version `2026-03-11`, le champ observé/accepté est `in_trash`; l’API a explicitement rejeté `archived` en nettoyage. Correction du harness uniquement, puis reprise sans nouvelle création et nettoyage vérifié avec `{in_trash:true}`. Le writer ne réalise pas cet archivage de test et contrôle déjà les deux indicateurs de lecture; aucun CORE_BUG ou MAPPING_BUG démontré par cet incident.

Les contrôles locaux initiaux et de reprise ont rapporté `HYGIÈNE SECRET OK — Git propre`; le runner Cloud avait également vérifié fichiers, temporaires et sorties Git sans correspondance du secret. Le dernier harness de clôture, sans log sur disque, a supprimé son environnement d’authentification de processus et ses artefacts `/tmp` à la sortie. Cela ne prétend pas effacer une variable déjà définie dans le shell personnel de l’utilisateur.

## Limites conservées, sans rouvrir le gate

- La preuve live porte sur Business, les Companies et Analyses réelles et le replay; elle ne certifie pas une campagne live des sept familles ni les schémas Earnings/Decisions. Les cas d’erreur et autres variantes restent ceux des fixtures acquises.
- Absence de CAS/transaction Notion et d’unicité globale face aux writers externes hors lease D1. Les états ambigus exigent une réconciliation positive ou une intervention.
- Les blocs unsupported, headings >3 et payloads >450 KB sont refusés avant mutation. Le contenu d’une page existante n’est pas remplacé destructivement; nouveau contenu → nouveau run/page.
- La persistance du journal, les migrations D1 live, le déploiement/auth du runtime, le contrat MCP et la migration infrastructure du plugin sont des travaux distincts. Aucun succès de déploiement ni `npm test` global PASS n’est revendiqué.

## Démarrage Lot 9 — prochaine session

Objectif canonique : **Skill permanent de développement / instructions permanentes ou documentation équivalente**, selon `openai-first-execution-plan.md`, section 9. Documenter le chemin stabilisé, figer les responsabilités et empêcher le retour de logique dupliquée. Le plugin Investment OS Analysis reste la source canonique de la méthodologie financière; le ZIP `investment-os-analysis-1.3.0-runtime.zip` a servi de référence Lot 8.

1. Synchroniser le checkout local avec le commit de cette passation, en fast-forward uniquement et avec Git propre. Lire `AGENTS.md`, cette passation et la section 9 du plan; consulter uniquement les contrats/propriétaires utiles à ce livrable.
2. Établir les instructions permanentes autour du chemin réel : consommateur → services Core → ports → adapter Notion → sources/projection. Le chemin futur Skills → MCP → Core est une cible des Lots 10–12, pas un transport déjà déployé.
3. Figer les propriétaires canoniques et les contrôles de développement : réutilisation du mapping/parser/index/agrégats, validation des contrats/receipts, tests proportionnés aux changements et secrets hors fichiers/outputs.
4. Interdire dans les Skills la policy Current, le mapping Notion, les calculs Portfolio dupliqués, les détails d’hébergement OpenAI et toute modification de méthode financière liée à la migration.
5. Relire et vérifier le livrable documentaire, puis checkpoint et passation Lot 10. Ne pas créer le serveur ni le contrat MCP au Lot 9; ne pas modifier les Skills financières, le plugin, la production ou les schémas live pour ce livrable.

Ne pas refaire l’audit générique du repo, le gate Lot 7, l’export D1, les tentatives réseau Cloud, la campagne live Lot 8 ou les suites déjà vertes sans changement pertinent. Aucun sous-agent nécessaire par défaut. Le gate Lot 9 évaluera la cohérence des instructions avec les propriétaires et interdits ci-dessus; GO Lot 9 ici autorise son démarrage, pas sa clôture anticipée.
