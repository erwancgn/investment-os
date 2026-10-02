# Passation Sol — checkpoint Lot 7, gate Current puis Lot 8

Établie le 1 octobre 2026, consolidée en fin de fenêtre après le Lot 7.1. Checkpoint **implémentation Lot 7 : `0d8853eced6d28e5bd861916c92ac9da16c5499b`**. Le commit documentaire ultérieur ne modifie pas ce checkpoint produit. Ne pas utiliser le dernier commit touchant ce fichier pour retrouver le SHA de l’implémentation. Ne pas annoncer le Lot 7 intégralement clos : les services/migrations des lecteurs sont livrés, le parity gate reste ouvert.

## Vision figée pour les Lots 8–13

La décision d’architecture post-Lot 7 est détaillée dans [openai-first-execution-plan.md](openai-first-execution-plan.md). Cette note fige l’orientation **OpenAI-first, pas OpenAI-locked**, les responsabilités PWA/Core/Adapter/Skills/MCP, l’état production vs branche, et les gates détaillés des Lots 8 à 13.

Pour toute reprise après le parity gate, lire cette note **avant** de concevoir le Lot 8 ou le MCP. Elle ne change pas la mission immédiate : Lot 7.2 reste le seul chantier actif et Lot 8 reste NO-GO jusqu’à fermeture du gate. Elle précise notamment que les Lots 10–12 restent dans le plan initial mais que le contrat MCP doit être runtime-agnostic, Sites est la première cible de runtime MCP, et la migration du plugin doit rester infrastructure-only sans changement de méthodologie.

## État immédiat et prochaine mission

Lots 0–6 terminés selon leurs gates; gate production Lot 6 validé humainement, Sites actuellement v208. Implémentation Lot 7 réalisée et committée au checkpoint ci-dessus, sans déploiement Lot 7. La passe documentaire et d’audit Lot 7.2 du 2 octobre 2026 est terminée; elle a renforcé les preuves source, mais le gate de parité reste bloqué faute de corpus D1 complet et de comparaisons legacy/Core nouvelles. **Lot 7 n’est pas déclaré clos et Lot 8 reste NO-GO.** Voir les résultats de passe 7.2 ci-dessous; aucune clôture du gate n’est implicite.

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

### Lot 7.2 — preuves réellement manquantes et verdict

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

La passe 7.2 est terminée comme campagne de collecte/analyse, mais le gate reste ouvert faute de corpus complet et de comparaison suffisante : **Lot 8 NO-GO**. Une prochaine clôture exige une preuve autorisée des branches D1 restantes et les comparaisons de parité correspondantes; elle devra préserver les catégories déjà acquises.

### Fin de fenêtre et hygiène

Les exports/replays, diagnostics temporaires, rapports de session hors repo et archives de build de cette fenêtre sont supprimés après consolidation. Les preuves utiles sont résumées ici; ne pas dépendre de /tmp, de captures ignorées ou de pièces jointes. Le nettoyage ne touche pas le produit, les dépendances installées ou les répertoires système du runner. Le commit de consolidation est documentaire uniquement, poussé sur la branche du chantier avec Git propre.

Accès vérifiés : l’origine HTTP Sites reste refusée par le proxy Cloud (interdiction utilisateur de contournement). L’outil natif Sites de lecture D1 est accessible : overview renvoie DB et les tables notion_documents/notion_document_companies/notion_relations. Une lecture réelle bornée à une ligne de notion_documents renvoie model_projection.truncated=true et truncated_values=1; properties_json est tronqué et JSON.parse échoue. Le viewer ne propose ni sélection de colonnes ni SQL libre. Cette réponse ne permet pas de construire un corpus comparable complet. Aucun échantillon privé tronqué n’est enregistré dans Git. Utiliser un export fidèle depuis un accès autorisé, sans réinitialiser/synchroniser la DB pour faire passer les tests.

Après ce gate : Lot 8 extrait le mapping/sync Notion et étudie le writer existant du plugin en lecture. Définir garanties et reprises, retries/idempotence, version attendue, contrôle des relations, relecture et receipts persisted/promotion/verified/partial avant toute mutation métier. getPosition doit distinguer fermée/ouverte sans déduire toute l’histoire des seuls holdings live. Pas de nouveau service factice pour remplir les sept noms. La collecte/comparaison read-only et la préparation restent autorisées par le chantier; aucun déploiement implicite.

Ne pas demander une permission générique de continuer : le blocage est une preuve de parité inaccessible ici, pas une absence d’autorisation du chantier. Produire un checkpoint/commit/passation à chaque lot validé, garder les responsabilités Sol et agents Luna.
