# Passation Sol — checkpoint Lot 7, gate Current puis Lot 8

Établie le 1 octobre 2026. Le commit qui introduit ce fichier est le checkpoint Lot 7. Retrouver son SHA avec `git log -1 --format=%H -- docs/architecture/lot-8-handoff.md`. Ne pas annoncer le Lot 7 intégralement clos : les services/migrations des lecteurs sont livrés, la bascule Current reste bloquée par la parité réelle.

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
- Suites référence/renderer/SSR, Portfolio/Basket/IA, sécurité, cache et performances existantes : PASS. Aucun nouvel accès navigateur au corpus personnel; pas de capture mobile 360/390 ou mesure mémoire production Lot 7. DOM/CSS et lecteurs visuels n’ont pas changé; une prochaine publication devra être vérifiée sur ces tailles.
- Corrections révélées pendant migration : UUID Notion tireté canonisé uniquement dans la projection domaine (JSON source inchangé), TimeoutError/AbortError conservent timeout et détails privés masqués. Total portefeuille vide ajoute positions:0, attendu par le contrat; autres agrégats conservent les formules.
- Pas de changement de dépendances/lockfile, ni mutation DB, ni déploiement. Core/ports testés ne prouvent pas une écriture réelle, un CAS Notion, une idempotence ou promotion atomique.

Diff : 14 fichiers, +1040/−14 lignes (net +1026). Produit : 6 fichiers +509/−12; tests : 3 fichiers +437/−0; docs : 4 fichiers +92/−0; package.json : +2/−2. Les comptes par fichier sont disponibles via `git show --stat`/`--numstat`. Le passage d’un ancien bloc de calcul compact sur une ligne vers le module pur augmente les LOC de formatage; il ne crée pas une seconde formule active.

## Gate restant et verdict Lot 8

**NO-GO pour clôturer la migration Current et enchaîner automatiquement le Lot 8.** Avant toute bascule : obtenir des snapshots réels complets Company/docs/relations pour chacune des familles, comparer sélection legacy vs Core (IDs, owner, archive, conflits, fallback, many-to-many et dates), expliquer chaque différence puis migrer les consommateurs réellement concernés avec tests. La politique cible refuse les pointeurs explicites invalides; legacy peut les masquer par fallback/archive global. Ce changement ne doit pas entrer discrètement dans un simple wrapper getCompany.

Accès vérifiés : l’origine HTTP Sites reste refusée par le proxy Cloud (interdiction utilisateur de contournement). L’outil natif Sites de lecture D1 est accessible : overview renvoie DB et les tables notion_documents/notion_document_companies/notion_relations. Une lecture réelle bornée à une ligne de notion_documents renvoie model_projection.truncated=true et truncated_values=1; properties_json est tronqué et JSON.parse échoue. Le viewer ne propose ni sélection de colonnes ni SQL libre. Cette réponse ne permet pas de construire un corpus comparable complet. Aucun échantillon privé tronqué n’est enregistré dans Git. Utiliser un export fidèle depuis un accès autorisé, sans réinitialiser/synchroniser la DB pour faire passer les tests.

Après ce gate : Lot 8 extrait le mapping/sync Notion et étudie le writer existant du plugin en lecture. Définir garanties et reprises, retries/idempotence, version attendue, contrôle des relations, relecture et receipts persisted/promotion/verified/partial avant toute mutation métier. getPosition doit distinguer fermée/ouverte sans déduire toute l’histoire des seuls holdings live. Pas de nouveau service factice pour remplir les sept noms. La collecte/comparaison read-only et la préparation restent autorisées par le chantier; aucun déploiement implicite.

Ne pas demander une permission générique de continuer : le blocage est une preuve de parité inaccessible ici, pas une absence d’autorisation du chantier. Produire un checkpoint/commit/passation à chaque lot validé, garder les responsabilités Sol et agents Luna.
