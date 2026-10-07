# Passation Sol — checkpoint Lot 7, gate Current puis Lot 8

Établie le 1 octobre 2026, consolidée en fin de fenêtre après le Lot 7.1. Checkpoint **implémentation Lot 7 : `0d8853eced6d28e5bd861916c92ac9da16c5499b`**. Le commit documentaire ultérieur ne modifie pas ce checkpoint produit. Ne pas utiliser le dernier commit touchant ce fichier pour retrouver le SHA de l’implémentation. Ce checkpoint initial est complété par le correctif de mapping et le gate final du 2 octobre 2026 décrits ci-dessous; aucun Lot 7 n’est déployé.

## Vision figée pour les Lots 8–13

La décision d’architecture post-Lot 7 est détaillée dans [openai-first-execution-plan.md](openai-first-execution-plan.md). Cette note fige l’orientation **OpenAI-first, pas OpenAI-locked**, les responsabilités PWA/Core/Adapter/Skills/MCP, l’état production vs branche, et les gates détaillés des Lots 8 à 13.

Pour toute reprise après le parity gate, lire cette note **avant** de concevoir le Lot 8 ou le MCP. Le gate final Lot 7 est clos; le checkpoint suivant du Lot 8 est décrit dans lot-9-handoff.md. Elle précise notamment que les Lots 10–12 restent dans le plan initial mais que le contrat MCP doit être runtime-agnostic, Sites est la première cible de runtime MCP, et la migration du plugin doit rester infrastructure-only sans changement de méthodologie.

## État immédiat et prochaine mission

Lot 7 clos — GO Lot 8, checkpoint `d2566aa` poussé après autorisation explicite. Lot 8 a ensuite été implémenté dans cette même fenêtre; ses preuves et limites sont consignées dans [lot-9-handoff.md](lot-9-handoff.md). **Lot 8 clos — GO Lot 9 : validation live locale du writer acquise, deux replays `verified` sans doublon et nettoyage des pages de test vérifié.** Le blocage DNS Cloud est historique; la passation Lot 9 détaille les preuves, les limites et le prochain livrable documentaire. Aucun Lot 9 commencé et aucun déploiement Lot 7/8. Les verdicts plus anciens ci-dessous sont historiques.

## Reprise et état déployé

- Sol conserve plan, décisions et verdict; délégation bornée aux agents Luna.
- Racine Cloud `/workspace/investment-os`; racine Desktop `/Users/ec/Documents/ChatGPT/Investment OS - APP/investment-os-stabilization`. Ne pas utiliser le parent comme repo.
- Branche `chore/architecture-stabilization-mcp`, remote `https://github.com/erwancgn/investment-os.git`.
- Parent de ce checkpoint : Lot 6 `9f98a7f7a20adef95c591a583fe60a70e04a8e38`; ne pas rétrograder le checkout.
- Node 22.23.1, npm 11.9.0. Lockfile SHA256 `b8a15bf6f414fc6d3ca7690e0e8724193f881c9cdc3c5bb9e7ec08309ef637f6`; test CSS ownership `83efc331146cb7bec8db1cffe6a0e97b798a6c8c4fbeb3f62f49babfc0de0163`, inchangés.
- Avant modification : racine Git exacte, branche/HEAD/status, runtime et hashes. Préserver les changements existants; fetch/fast-forward uniquement si approprié.
- Lire AGENTS.md, cette passation, target-architecture.md, domain-contracts.md, ports/services/adapter et leurs tests. Les anciennes pièces jointes et /tmp ne sont pas requis. Le plan complet des 13 lots figure dans target-architecture.md; baseline/debt-map donnent les lots initiaux.

Sites reste **v208**, publié le 01/10/2026 à 07:06:01.948 UTC (09:06:01 Europe/Paris), source exacte du parent Lot 6. Projet `appgprj_6a7d7a1233a08191a8d35b746b284e95`, version `appgprj_6a7d7a1233a08191a8d35b746b284e95~appgver_df784ece9264819199fcf9709d662ab4`, déploiement succeeded `appgdep_6abe0646702481918b4e21b39d356165`. **Aucun Lot 7 déployé.**

Rollback conservé : republier via Sites la version sauvegardée v207 `appgprj_6a7d7a1233a08191a8d35b746b284e95~appgver_5e1534e6f1a08191ac21cb00f7b84606`, puis attendre le statut final du nouveau déploiement. Source v207 `bf77b919705127e42f880ca6d0785db4feffab85`. Ne pas supprimer v207. Aucun rollback requis par les résultats de cette tâche.

Le gate mémoire Lot 6 est levé par l’utilisateur : « J’ai fait les tests, c’est validé. Tu peux enchainer sur le lot 7 selon le plan établi ». Ce n’est pas une campagne instrumentée de Sol; ne pas inventer logs, request IDs ou timings. Codex Cloud et Sites restent deux runtimes distincts.

## Architecture et consommation obtenues

| Opération | Core / port | Consommateur actif / limite |
| --- | --- | --- |
| getCompany | CompanyPreview validée + contrôle ID | GET personnel /api/companies/:id via adapter, réponse preview historique; choix legacy conservé |
| getPortfolio | Portfolio validé, agrégats purs core/portfolio.ts | GET personnel /api/portfolio/live; cash/FX/PRU/cibles/expositions/réconciliation conservés |
| getPosition | Position ouverte/fermée, ID et options validés | Aucun lecteur unitaire existant; aucun port runtime branché, dependency |
| getCurrentAnalysis | contexte → selector existant → hydratation → contrôle owner/family/sourceKind/archive | Adapter disponible et testé SQLite; ni Worker ni UI basculé avant parité réelle |
| listAnalyses | previews validées; filtres délégués au port | Integrity utilise le mode historique complet explicite; aucun nouveau listing public |
| saveAnalysis | input/revision/run/relations + receipt validés | Pas d’écriture Notion active; dependency sans writer; import D1 ne constitue pas saveAnalysis |
| getQuote | Quote validée + options | GET personnel /api/quotes via batch historique inchangé; fournisseur/FX/cache single-flight conservés |
| getAnalysisById | Analysis canonique + identité | GET personnel /api/analyses/:id; archives accessibles, corps/provenance/dates conservés |

Le Core ne dépend ni du frontend/plugin/Codex/MCP, ni du mapping Notion, D1, HTTP/auth/secrets. Le Worker garde auth/scope/cache headers et assemblage. Le pont adapter réutilise app/lib/investment-data, quotes et le normalizer existant. Il n’extrait pas encore tout le mapping physique : c’est l’objet Lot 8. Aucun parser/renderer concurrent, redesign, nouvelle méthode, Supabase, endpoint sans consommateur ou nouveau MCP.

Le mapper Current léger reste dans investment-data afin de partager props/classification/owners/aliases au lieu de dupliquer leur logique. Il conserve les candidats inconnus pour diagnostiquer wrong-family et n’impose pas de LIMIT arbitraire. Le contexte hydrate uniquement le corps choisi. L’ownership/freshness/archive explicite de cette hydratation vient des headers source du même contexte; provenance et famille du normalizer restent contrôlées. Les archives legacy dérivées globales ne constituent pas une règle de sélection contextualisée.

## Validations, changements et limites

- Typecheck et build vérifié Worker : PASS; artefact ESM/default.fetch/manifeste : PASS.
- Lint ciblé : zéro erreur/zéro warning; diff-check : PASS.
- 223 assertions réussies dans les 22 fichiers exécutés directement, dont 7 Core, 2 agrégats et 5 tests SQLite adapter. Les tests SQLite couvrent sept familles, aliases memo/decision/earnings, owner/family/archive/missing explicites, un seul corps choisi, parité HTTP/data Company/Portfolio/historique/intégrité, quotes cache-only, exclusion Sold et provenance/dates.
- npm test : échec uniquement du fichier CSS ownership; ses deux assertions reproduisent les sorties subprocess vides déjà documentées Cloud. Fichier et script ne sont pas modifiés. Pas de PASS global inventé; reproduire sur runner compatible pour clôture complète.
- Le test CSS est valide localement sous Node 22.23.1; la limitation préexistante des subprocess Node appartient à Codex Cloud. Ne pas affaiblir le test, changer ses assertions ou modifier le produit pour masquer ce problème.
- Suites référence/renderer/SSR, Portfolio/Basket/IA, sécurité, cache et performances existantes : PASS. Aucun nouvel accès navigateur au corpus personnel; pas de capture mobile 360/390 ou mesure mémoire production Lot 7. DOM/CSS et lecteurs visuels n’ont pas changé; une prochaine publication devra être vérifiée sur ces tailles.
- Corrections révélées pendant migration : UUID Notion tireté canonisé uniquement dans la projection domaine (JSON source inchangé), TimeoutError/AbortError conservent timeout et détails privés masqués. Total portefeuille vide ajoute positions:0, attendu par le contrat; autres agrégats conservent les formules.
- Pas de changement de dépendances/lockfile, ni mutation DB, ni déploiement. Core/ports testés ne prouvent pas une écriture réelle, un CAS Notion, une idempotence ou promotion atomique.

Diff : 14 fichiers, +1040/−14 lignes (net +1026). Produit : 6 fichiers +509/−12; tests : 3 fichiers +437/−0; docs : 4 fichiers +92/−0; package.json : +2/−2. Les comptes par fichier sont disponibles via `git show --stat`/`--numstat`. Le passage d’un ancien bloc de calcul compact sur une ligne vers le module pur augmente les LOC de formatage; il ne crée pas une seconde formule active.

## Gate restant et verdict Lot 8

**NO-GO Lot 8 : parity gate encore ouvert.** Le Lot 7.2 doit reprendre uniquement les branches encore insuffisamment prouvées, pas recommencer toute la campagne. La politique cible refuse les pointeurs explicites invalides; legacy peut les masquer par fallback/archive global. Ce changement ne doit pas entrer discrètement dans un simple wrapper getCompany.

### Lot 7.1 — résultats acquis, à ne pas rejouer inutilement

Comparaison ciblée read-only via Notion autorisé, replay temporaire des fonctions réelles du checkpoint sur les mêmes entrées de sélection. Les propriétés du panel ont été lues par fetch unitaire complet; les compléments Companies/Analyses ont été paginés. Il s’agit d’une preuve ciblée source, pas d’une preuve exhaustive des snapshots/index D1 ou du runtime Sites. Aucun export personnel brut ni identifiant de page du panel n’est conservé dans cette passation.

- Cadence Business : legacy/Core, même sélection.
- Advantest Business : même sélection.
- Advantest Valuation : même sélection.
- KLA Business et Valuation : legacy sélectionne v2 par fallback; les pointeurs Current réels pointent vers v1 Superseded. Incohérence des relations source : **DATA_INCONSISTENCY**. Refus du fallback par Core : **EXPECTED_POLICY_CHANGE**, conforme à la politique documentée. **Aucun CORE_BUG démontré.** Aucun correctif Core ou mapping ne doit artificiellement reproduire le fallback legacy KLA.
- Les archives examinées restent accessibles par ID et ne deviennent pas Current admissibles.
- Many-to-many désigne aussi le graphe Company ↔ rapports Business/Valuation et les liens entre rapports/versions, pas uniquement un rapport ayant plusieurs owners. Les cas KLA/Advantest ont couvert des liens Company vers plusieurs familles et Previous Version sans confondre ces liens avec l’ownership. Ne pas qualifier ce graphe d’absent parce que la relation Company d’un rapport a un seul propriétaire.

### Lot 7.2 — consignes et verdict provisoires historiques

**Historique remplacé par le replay final Lot 7 ci-dessous.** Les limites de collecte et le NO-GO décrits dans cette sous-section étaient exacts pour la passe 7.2 initiale. Le gate a ensuite été assoupli pour autoriser la reconstruction locale D1 depuis les cinq sources Notion; l’absence d’un export D1 live reste un risque distinct et n’est plus bloquante.

**Instruction historique du démarrage 7.2 (2 octobre 2026) :** le quota **Notion Query Data Source** avait été atteint pendant le Lot 7.1. Lors de la passe 7.2, `get_site` live a confirmé Sites v208 et `available_with_limit` a permis les lectures nécessaires; ne pas présenter l’ancien blocage de quota comme le blocage actuel.

Travail read-only sur données complètes autorisées : vérifier le comportement des index/relations D1 nécessaires à la sélection Current, les conflits éventuels d’owner, et uniquement les cas réels supplémentaires nécessaires aux branches du graphe encore non prouvées. Many-to-many, fallback et dates ne sont à compléter que si leur couverture acquise ne suffit pas. Comparer IDs legacy/Core, famille, owner, archive/current, date, relation Company et usage du fallback; garder séparés owner et liens inter-rapports. Ne pas committer de données personnelles ou d’export brut; ne pas traiter le viewer D1 tronqué comme une preuve complète.

Classer toute nouvelle divergence exclusivement **EXPECTED_POLICY_CHANGE**, **LEGACY_BUG**, **CORE_BUG**, **MAPPING_BUG** ou **DATA_INCONSISTENCY**. **Aucun changement de code sans CORE_BUG ou MAPPING_BUG démontré.** Si aucun écart Core ou mapping n’est démontré et que les branches restantes sont suffisamment couvertes, clôturer Lot 7 et prononcer GO Lot 8; sinon NO-GO avec le blocage précis. La mission Lot 7.2 ne commence pas elle-même le Lot 8.

### Lot 7.2 — passe du 2 octobre 2026

Environnement contrôlé avant travail : checkout initial `/workspace/investment-os`, branche `work`, HEAD `930442a`, propre, Node 22.23.1 et npm 11.9.0. Après fetch par accès réseau supporté, worktree isolé `/workspace/investment-os-lot72` créé sur `chore/lot-7.2-parity-gate`, HEAD exact `42c73e9c7bc6b1d6d5b4bc3f4f22d79326c4790a`. La référence locale canonique a ensuite été alignée sur ce HEAD et le worktree est sur `chore/architecture-stabilization-mcp`. Hashes du lockfile et du test CSS identiques à la passation.

**Résultat : NO-GO Lot 8.** L’audit source est utile et cohérent, mais n’est pas une preuve exhaustive de parité D1 ni une comparaison legacy/Core. Il n’a démontré aucun **CORE_BUG** ni **MAPPING_BUG**; aucune correction de code n’est autorisée par les faits observés.

- Sites live confirmé v208. La requête Notion `available_with_limit` a réussi; la source compte **114 Companies**. Projection SQL de graphe (champs, pas corps) : Companies 114 sur 2 pages et Analyses 589 sur 6 pages, pagination keyset URL jusqu’à `has_more=false`; le total Analyses 589 a aussi été vérifié par `COUNT(*) OVER()`.
- Audit source de 193 cibles Current couvrant les cinq familles : aucun pointeur multiple, manquant ou relation Company incohérente. Chacune des 589 analyses a exactement un owner; aucune n’est sans owner. Le graphe contient 495 arêtes Previous Version et 35 arêtes Earnings + Investment Decisions. Ces liens inter-rapports restent distincts de l’ownership; le fait de n’observer qu’un owner par analyse ne prouve pas l’absence de graphe many-to-many.
- Le corpus obtenu couvre uniquement les projections Companies et Analyses demandées. Earnings, Decisions et Portfolio n’ont pas été projetés; il n’y a ni snapshot D1 ni transaction snapshot simultanée. Les comparaisons legacy/Core n’ont pas été refaites, car les entrées D1 complètes étaient indisponibles. Les constats Lot 7.1 restent acquis et leurs classifications ne sont pas rejouées.
- D1 overview expose 13 tables sous `DB`, dont les trois tables pertinentes au gate. Lecture d’une ligne `notion_documents` : `model_projection.truncated=true`, `truncated_values=1` et `properties_json` tronqué. Une ligne de chacune des tables `notion_document_companies` et `notion_relations` est non tronquée, mais reste un échantillon; cela ne fournit pas un corpus complet.
- La sonde GET `/api/session` via le proxy supporté s’est arrêtée sur curl exit 56, CONNECT 403, HTTP 000. Ne pas tenter de contournement. Aucun export daté complet local ni credential runtime Cloudflare/Notion n’a été fourni. L’endpoint integrity existant agrège les résultats, borne plusieurs listes de problèmes à 50 et n’exporte pas les propriétés; aucun endpoint de graphe complet n’a été identifié.
- Le tableau de divergences n’a reçu aucun écart mesuré dans cette passe. Une limitation d’accès ne constitue pas une divergence et ne reçoit pas de classification bug. Les égalités acquises et les deux constats KLA de Lot 7.1 restent inchangés : **DATA_INCONSISTENCY** pour les relations source incohérentes et **EXPECTED_POLICY_CHANGE** pour le refus du fallback legacy.
- Couverture source observée : Current dans les cinq familles, unicité des pointeurs, relation Company, owner unique des 589 analyses et arêtes inter-rapports comptées. Couverture encore bloquée : corpus D1 complet, Earnings/Decisions/Portfolio, snapshot cohérent et comparaisons legacy/Core sur entrées identiques pour les branches insuffisamment prouvées. Lot 7.1 n’a pas été rejoué.
- Vérifications ciblées rapportées par Luna : exécution directe selector **14/14 sous-tests**, Core **7/7**, adapter **5/5**; typecheck exit 0. Le lancement root `node --test` sur trois fichiers n’a donné que trois enveloppes sans détail; ces enveloppes ne sont pas comptées comme assertions. L’avertissement SQLite expérimental est signalé. La fixture adapter ne couvre pas la reconstruction d’index ni un document à plusieurs owners; le selector couvre le cas multi-owner avec une entrée synthétique. Revue d’accès : les index reconstruits sont `notion-relation`, `title` et `content`, puis le filtre primary sélectionne deux méthodes; les snapshots de propriétés restent nécessaires pour les sources analyses, earnings, decisions et portfolio.
- La limitation préexistante des subprocess du test CSS ownership n’a pas été rejouée dans cette passe documentaire; aucun `npm test` global n’est revendiqué. Les hashes lockfile et test CSS sont restés identiques.
- Aucun ID de page privé, export brut ou contenu d’analyse n’est ajouté à Git. Aucune mutation production, synchronisation, publication/déploiement, correction de code ou début du Lot 8 n’a eu lieu.

Matrice de conclusions, sans nouveau replay des cas acquis :

| Cas / constat | Legacy | Core | Classification explicite | Portée |
| --- | --- | --- | --- | --- |
| Cadence Business; Advantest Business et Valuation | Même ID | Même ID | Aucune divergence | Acquis Lot 7.1, non rejoué |
| KLA Business et Valuation : relation source Current vers v1 Superseded | Masquée par fallback v2 | Cible explicite inadmissible | DATA_INCONSISTENCY | Constat source acquis Lot 7.1 |
| KLA Business et Valuation : traitement du pointeur invalide | Fallback v2 | Refus sans fallback | EXPECTED_POLICY_CHANGE | Écart de policy acquis Lot 7.1 |
| Audit 7.2 des relations source Companies/Analyses | Non exécuté | Non exécuté | Aucune divergence mesurée | Audit de graphe, pas parité runtime |

| Branche du gate | Preuve de cette passe | Limite restante |
| --- | --- | --- |
| Pointeurs Current des cinq familles d’Analyses et relation Company | 193 cibles résolues, zéro multiple/missing/wrong owner source | N’atteste pas l’index primaire D1 ni ses éventuels conflits |
| Ownership vs liens historiques | Un owner par analyse; Previous Version et liens Earnings/Décisions comptés séparément | Pas de preuve de l’inférence title/content ou d’un owner périmé dans D1 |
| Index primaire et index relations réels | Tables accessibles, une ligne non tronquée de chaque index | Pas de propriétés snapshot complètes permettant leur réconciliation |
| Autres sources et branches de sélection | Fixtures existantes vertes pour les sept familles | Pas de nouveau replay réel Earnings/Decision/Portfolio, fallback ou dates |

Source minimale requise à la reprise : headers D1 datés et non tronqués des Companies et des sources analyses/earnings/decisions/portfolio (IDs, titres, propriétés, dates d’édition, texte de classification utilisé), avec les tables complètes `notion_document_companies` (`match_method` inclus) et `notion_relations`, ou extraction autorisée équivalente attestant le même état. Conserver les corps hors Git et ne les charger que si l’hydratation choisie doit être vérifiée. Des fetchs Notion unitaires peuvent compléter un cas source fermé, mais ne certifient pas à eux seuls la fraîcheur de l’index D1.

La passe 7.2 initiale est terminée; son verdict NO-GO était provisoire et est remplacé par le gate final ci-dessous.

### Lot 7 — replay final après correction du mapping, 2 octobre 2026

Le gate a été assoupli : D1 local a été reconstruit par les fonctions de production à partir des cinq sources Notion. L’absence d’un export D1 live n’est plus bloquante; elle reste un risque de différence entre la projection locale reconstruite et l’état runtime. Le quota SQL s’est épuisé sur une requête refusée, sans retry; l’acquisition s’est poursuivie en lecture seule par les vues officielles sans quota, puis par fetch unitaire des métadonnées Companies.

Le corpus typé compte **752 pages** : 114 Companies, 589 Analyses, 9 Earnings, 18 Decisions et 22 Portfolio. La collecte a eu lieu de 06:37:12 à 06:43:07 UTC (08:37–08:43 Europe/Paris). Un rescan complet et un refetch des 114 Companies ont trouvé zéro ajout, changement de timestamp ou suppression; chaque page a un `last_edited_time` non vide et la date maximale est le 30 septembre 2026. Les corps n’ont pas été collectés : les propriétés et les clés source suffisent à la classification de production des familles; cela ne vérifie pas le contenu sémantique ni le chemin `content-only`, exclu par le filtre `primary`. Le plain text de snapshot inclut les propriétés et le contenu disponible, mais les collecteurs de cette passe ont fourni des corps omis. Le formatage rich text, identité/liens de mentions et annotations ne sont pas reconstructibles; rollup/formula non résolus restent des `null` typés.

SQLite en mémoire a appliqué les six migrations Drizzle, le wrapper D1 `prepare`/`batch`, et les fonctions de production `rebuildDocumentCompanyLinks`, `rebuildNotionRelations` et `documentPrimaryCompanyLinks`, depuis le checkout `d00ad4f` pour le replay initial, puis ce même checkout avec le correctif minimal ci-dessous pour le replay final. Le contexte est construit par le vrai `readCurrentAnalysisContext`; `snapshotPlainText` produit le texte des propriétés. Les comparaisons ont utilisé le vrai `getCompanyDetail`, le selector Current puis l’adapter `getCurrentAnalysis`, avec diagnostics et statut par appel. L’index complet a inséré 1 120 arêtes document–Company et laissé 5 documents Portfolio sans correspondance, sans relation Company source; les relations ont été reconstruites pour les 752 documents.

Le replay initial a démontré un **MAPPING_BUG** dans `documentPrimaryCompanyLinks` : des relations Company déduites des titres polluaient les ensembles de propriétaires explicites. Le cas réel concernait 10 documents et 5 en-têtes sélectionnés; aucune Company demandée n’a été incorrectement sélectionnée comme résultat. Un reproducteur synthétique a confirmé qu’une telle pollution pouvait toutefois provoquer un faux fallback. La correction minimale rend toutes les relations explicites `notion-relation` prioritaires et autoritatives; les relations par titre ne servent de fallback qu’en leur absence. Les index secondaires many-to-many restent inchangés. Le replay complet après correction a réduit les divergences de 8 à 6 dans `getCompanyDetail`, et de 4 à 2 dans `researchReferences`. Aucun CORE_BUG n’a été démontré.

| Famille | Comparaisons (114 Companies) | IDs identiques | Écarts après correction |
| --- | ---: | ---: | ---: |
| Business | 114 | 113 | 1 |
| Valuation | 114 | 113 | 1 |
| Short | 114 | 113 | 1 |
| Portfolio | 114 | 114 | 0 |
| CIO memo | 114 | 113 | 1 |
| Decision | 114 | 113 | 1 |
| Earnings | 114 | 113 | 1 |
| **Total `getCompanyDetail`** | **798** | **792** | **6** |

Séparément, `researchReferences` a été comparé pour 114 Companies × 5 familles : **570 appels, 568 correspondances et 2 écarts** (Short et CIO memo). Chaque appel de sélection Core s’est terminé en 214 statuts `selected`, 582 `absent`, et 2 `invalid`; les 214 hydratations sélectionnées et les 582 absences se sont déroulées correctement. Les deux pointeurs invalides sont archivés explicitement et refusés selon la politique Current; aucun fallback n’a été hydraté.

Matrice exhaustive des divergences de sélection après correction (lignes groupées quand la cause est identique; les références sont comptées séparément) :

| Company / famille / chemin | Legacy | Core | Classification |
| --- | --- | --- | --- |
| KLA Business et Valuation — sélection principale, 2 écarts | v2 Validated, fallback | Pointeur v1 Superseded refusé, `invalid`, aucun ID sélectionné, `current_document_archived` | **EXPECTED_POLICY_CHANGE** : un pointeur explicite invalide interdit le fallback |
| KLA Business et Valuation — constat source associé | L’incohérence est masquée par le fallback | Company Current vise une cible explicitement archivée | **DATA_INCONSISTENCY**, acquis 7.1, sans nouvelle correction source |
| Ciena Decision — sélection principale, 1 écart | Première des deux décisions homonymes datées du 14 août; départage legacy | Autre ID, même date métier, édition la plus récente; `legacy_fallback` | **EXPECTED_POLICY_CHANGE** : date effective maximale incluant `last_edited_time`, puis départage déterministe |
| NVIDIA Earnings — sélection principale, 1 écart | Q2 Post-refresh, date Earnings du 26 août | Latest Earnings explicite Q1, admissible, plus ancien; `explicit_current` | **EXPECTED_POLICY_CHANGE** : le pointeur explicite admissible prime sur la récence |
| Marvell Short et CIO memo — sélection principale, 2 écarts | v2 du 14 août | v1 explicitement Current, Validated, du 9 août, non explicitement archivé | **EXPECTED_POLICY_CHANGE** : priorité au pointeur admissible, sans archive globale dérivée |
| Marvell Short et CIO memo — `researchReferences`, 2 écarts | Référence nulle, v1 exclue par l’archive dérivée globale legacy | v1 sélectionnée et hydratée | **EXPECTED_POLICY_CHANGE** : admissibilité contextuelle et archive explicite, distinctes de l’archive dérivée legacy |
| Ownership par titre malgré une relation Company explicite — résolu | Applied Optoelectronics Business/Valuation recevaient des choix Applied Materials; références nulles | Le propriétaire explicite est conservé; les quatre écarts principaux/références ont disparu après correction | **MAPPING_BUG**, reproduit puis corrigé; pollution des 10 documents supprimée, aucun bug de cette classe restant |

Deux relations historiques supplémentaires sont documentées comme **DATA_INCONSISTENCY** dans la projection demandée : Coherent Business v2 vise une page Coherent de Watchlist, hors de la source Companies; NVIDIA Valuation v2 vise une page introuvable par l’accès Notion disponible (`object_not_found`, sans pouvoir distinguer suppression et manque d’accès). Dans les deux cas, le helper de production conserve le fallback de titre faute de relation résolue vers Companies. Ces versions ne sont pas les cibles Current sélectionnées. Sur les 633 documents ayant une relation Company non vide, 631 ensembles de propriétaires primaires correspondent exactement aux cibles source; ces deux exceptions sont expliquées et les dix pollutions par titre observées avant correction ont disparu. Aucun changement de données historiques n’est entrepris et aucune collecte Watchlist supplémentaire n’est nécessaire au gate des cinq sources demandé.

Les 798 lignes ont également été contrôlées sur les champs demandés. `status` de sélection (`selected`/`absent`/`invalid`) est distinct du statut documentaire Notion; legacy ne retourne pas d’objet de résolution équivalent. Le contrôle des 214 en-têtes hydratés contre les résultats du selector retrouve exactement ID, owners, famille, sourceKind, archived, date et lastEditedTime. Les propriétaires explicites des 214 résultats correspondent aux relations Company source, sans propriétaire inféré supplémentaire; aucun résultat sélectionné n’est archivé. `sourceKind` est `decision` pour Decision et `analysis` pour les six autres familles, y compris Earnings.

| Autres différences de champs, exhaustives et groupées | Résultat / couverture | Classification |
| --- | --- | --- |
| Statut documentaire, famille/sourceKind, owner, archived sur sélection commune | 210 sélections au même ID : aucun écart de statut documentaire ou archive; les 214 en-têtes Core ont owners/famille/sourceKind conformes et une hydratation cohérente | Aucune divergence restante |
| Date affichée legacy / date effective Core sur les mêmes IDs | 210 différences : Business 54, Valuation 54, Short 27, Portfolio 28, CIO memo 26, Decision 15, Earnings 6. Legacy expose une date métier; la date effective de classement Core est le maximum des dates source et de dernière édition. Les valeurs observées sont valides, sans diagnostic de date invalide | **EXPECTED_POLICY_CHANGE**; ces champs ne sont pas annoncés égaux |
| Drapeau `current` dérivé legacy / pointeur explicite Core | 15 décisions au même ID : legacy force `current=true` pour son choix principal, alors que Core constate zéro pointeur explicite et annonce `legacy_fallback`. La 16e décision en fallback est le cas Ciena ci-dessus | **EXPECTED_POLICY_CHANGE** : Current dérivé et Current explicite sont distingués |
| Diagnostics et fallback absents de la réponse legacy | Core expose 87 `memo_current_reference_missing`, 16 `legacy_current_fallback`, 23 `unmapped_current_status` et les 2 `current_document_archived` KLA. Les 23 avertissements concernent les 16 décisions et 7 earnings à statut non reconnu; ils ne bloquent pas leur sélection admissible | **EXPECTED_POLICY_CHANGE** : diagnostics explicites; les 2 incohérences source KLA gardent leur classification séparée |

Bilan de classification : un **MAPPING_BUG** résolu, aucun **CORE_BUG** démontré, aucun bug Core/mapping restant; les divergences finales relèvent de **EXPECTED_POLICY_CHANGE**, avec les constats source **DATA_INCONSISTENCY** documentés séparément. Aucun **LEGACY_BUG** supplémentaire n’est établi. L’absence d’export D1 live est un risque de synchronisation/runtime, pas une divergence de policy. Les corps et rollups/formules omis ne sont pas revendiqués fidèles; aucun ne participe aux classifications Current effectivement exécutées sur ce corpus.

Vérifications rapportées après correction : selector **14/14**, Core **7/7**, adapter **6/6**, performance **15/15**, typecheck, ESLint sur les deux fichiers touchés et `git diff --check` passent. Aucun test global ou build n’a été relancé. Les corpus et JSON de replay sont temporaires et supprimés après consolidation; aucun identifiant brut, contenu d’analyse ou propriété financière privée n’est ajouté à cette passation.

**Verdict final : Lot 7 clos — GO Lot 8.** Les cinq sources nécessaires ont été collectées avec contrôle de stabilité; les index ont été reconstruits par les fonctions réelles; les vrais chemins legacy/Core ont été comparés sur les mêmes entrées pour les sept familles; toutes les divergences mesurées sont expliquées; aucun CORE_BUG ou MAPPING_BUG ne reste non résolu. La dernière consigne utilisateur privilégie les analyses récentes/Current et interdit toute nouvelle recherche de preuve exhaustive D1 : aucune campagne supplémentaire n’est lancée. Les anomalies de relations historiques restent documentées sans étendre le chantier.

L’absence d’un snapshot D1 live simultané reste un risque de synchronisation/runtime distinct de la policy Core, non bloquant pour ce verdict. La preuve ne couvre ni les corps complets ni leur rendu, ni les rollups/formules non résolus ou l’inférence `content-only`; les classifications effectivement exécutées sur les analyses reposent sur leurs Agents reconnus. Lot 8 n’a pas commencé; aucune mutation, synchronisation ou publication/déploiement production n’a eu lieu.

### Fin de fenêtre et hygiène

Les exports/replays, diagnostics temporaires, rapports de session hors repo et archives de build de cette fenêtre sont supprimés après consolidation. Les preuves utiles sont résumées ici; ne pas dépendre de /tmp, de captures ignorées ou de pièces jointes. Le nettoyage ne touche pas le produit, les dépendances installées ou les répertoires système du runner. Le checkpoint final comprend uniquement le correctif de mapping démontré, sa régression et cette passation; il est committé localement sur la branche du chantier avec Git propre. Le push vers `origin` a été rejeté par la revue automatique d’approbation, qui demande une autorisation explicite de transmission vers GitHub; ce blocage de publication du checkpoint ne rouvre pas le gate Lot 7.

Accès vérifiés lors de la passe 7.2 historique, sans nouvelle tentative au gate final : l’origine HTTP Sites reste refusée par le proxy Cloud (interdiction utilisateur de contournement). L’outil natif Sites de lecture D1 est accessible : overview renvoie DB et les tables notion_documents/notion_document_companies/notion_relations. Une lecture réelle bornée à une ligne de notion_documents renvoie model_projection.truncated=true et truncated_values=1; properties_json est tronqué et JSON.parse échoue. Le viewer ne propose ni sélection de colonnes ni SQL libre. Cette réponse ne permet pas de construire un corpus comparable complet. Aucun échantillon privé tronqué n’est enregistré dans Git. La reconstruction locale a levé le blocage du gate Current; un export live fidèle reste utile pour contrôler séparément la synchronisation/runtime, sans réinitialiser/synchroniser la DB pour faire passer les tests.

Après ce gate : Lot 8 extrait le mapping/sync Notion et étudie le writer existant du plugin en lecture. Définir garanties et reprises, retries/idempotence, version attendue, contrôle des relations, relecture et receipts persisted/promotion/verified/partial avant toute mutation métier. getPosition doit distinguer fermée/ouverte sans déduire toute l’histoire des seuls holdings live. Pas de nouveau service factice pour remplir les sept noms. La collecte/comparaison read-only et la préparation restent autorisées par le chantier; aucun déploiement implicite.

Le gate final ne démarre pas le Lot 8. Ne pas demander une permission générique pour achever les travaux déjà autorisés. Produire un checkpoint/commit/passation à chaque lot validé, garder les responsabilités Sol et agents Luna.
