# Investment OS — Lot 13 — handoff 2026-10-06

**LOT 13: NOT CERTIFIED.** Lot 12 reste **GO infrastructure**. État courant après la campagne E2E autorisée : **Site v245 / `93a7497de4af5191405b09978bba595b1532bbfe`, environnement25, WRITE fermé**. Deux Drafts Schneider créés et relus, un appel Micron échoué `mapping`, cinq modules Alphabet non soumis. Aucun retry, aucune promotion Current, aucun changement financier. Deux corrections reader minimales testées et publiées. Voir l’addendum campagne ci-dessous et `investment-os-lot13-e2e-results-2026-10-06.md` ; les sections de l’audit initial conservent leur périmètre v240 et ne sont pas la configuration courante.

## Baseline Lot12 exacte et frontière de preuve de l’audit initial

| Élément | Baseline | Vérification de cette session |
|---|---|---|
| Site | v240 / `2987b557052fe9afd56f895636de57b14062d530` | Catalogue courant et checkout exact, main propre |
| Déploiement | `appgdep_6ac3d10b02c881918210af403545a8d5` | `succeeded`, env_set_revision **21**, has_mcp true |
| App | `erwancgn/lot11-lot12-closeout` / `9081489534ace3a1cee87fbfb0ab0b752563cb53` | Commit et handoff final lus au SHA exact ; pointe de branche courante non vérifiée |
| Plugin personnel | 1.3.10 / `da40190987cdb420a0672675c70c2e6d44330f79` | Parité release/Git héritée H12 ; aucun checkout/plugin installé comparé ici |
| WRITE | fermé | `SITE_WRITE_RELEASE_APPROVED=false` lu ; probe workerd refuse forbidden/not_started ; flags absents hérités H12 |
| Tests Lot12 | 299/299 | Preuve héritée, aucun replay E2E Lot12 |
| État Lot13 demandé | non commencé | La référence retrouvée P0 contient déjà des contrôles préliminaires du 6 octobre. Ils sont réutilisés comme preuves partielles, jamais comme certification |

Source opérationnelle : `/workspace/scratch/90acd6d39abc/investment-os`. Runtime de cette session Linux Node **v24.19.0** ; package exige >=22.13.0. Les temps ne sont pas comparables aux anciens runs Node22/macOS sans environnement identique. Pas de remote Git configuré dans ce checkout.

H12 : [handoff final Lot12 au SHA canonique](https://github.com/erwancgn/investment-os/blob/9081489534ace3a1cee87fbfb0ab0b752563cb53/investment-os-lot12-handoff-2026-10-05.md). Le dernier NO-GO antérieur ne constitue pas l’état courant. AN-599 : neuf tables et 275 groupes conservés ; Draft persisted n’est pas une promotion Current. AN-597 UNKNOWN, AN-598 partial et LITE Valuation PARTIAL ne sont pas requalifiés.

Plan : `docs/architecture/openai-first-execution-plan.md`, §13, lu dans v240. Son résumé final est périmé. Le plan exige une campagne complète, pas de simples assertions statiques.

## Preuves initiales et légende

- **P0** : document `Investment-OS-Lot13-reprise-2026-10-06.md` (8053 octets) lu intégralement ; logs et benchmark retrouvés à `/workspace/scratch/90acd6d39abc/lot13-*`. Résultats locaux déjà exécutés, pas mesures hébergées.
- **P1** : campagne ciblée actuelle **199/199**, zéro fail/skipped ; typecheck/build/artifact PASS. Logs conservés dans les annexes avec hashes. Pas campagne visuelle, pas test live du writer.
- **P2** : `npm run verify:mcp-runtime`, workerd isolé, sept READ demo, auth/version/browser boundary et WRITE release-closed PASS ; catalog JSON 645741 octets. Aucun provider live ; outbound limité à la fixture Notion.
- **P3** : un READ hébergé `get_portfolio` correct, `{contractVersion:"1.0.0",scope:"demo",options:{cacheOnly:true}}`, completed / result ok ; 473 ms de temps observé orchestration entière, pas CPU Worker ni p95. Un premier appel avec cacheOnly au mauvais niveau a été rejeté invalid_input / not_started en 3091 ms : erreur de préparation, pas bug produit. Correction d’arguments sur READ, aucune mutation.
- **P4** : scan du tree courant : 198 fichiers suivis, aucun motif reconnu de token/private key. Ne certifie pas l’historique Git, tous les formats de secrets, ni le plugin.
- **PASS** : exigence précise réellement prouvée dans le périmètre annoncé. **PARTIAL** : preuve présente mais couverture incomplète. **BLOCKED** : preuve absente faute de capacité. Les sous-codes BLOCKED_VISUAL/BLOCKED_HOSTED_METRICS décrivent la cause. Aucun BLOCKED_EXECUTION local : le terminal/build ont fonctionné.

## Matrice exhaustive — audit initial, complétée par l’addendum campagne

| Domaine | Gate | Exigence | Preuve existante | Preuve à exécuter | Statut | Source exacte |
|---|---|---|---|---|---|---|
| Produit | Portfolio | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/components/live-portfolio-dashboard.tsx ; app/page.tsx ; P1 |
| Produit | Exposition | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/components/live-portfolio-dashboard.tsx ; app/page.tsx ; P1 |
| Produit | Trajectoire | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/components/target-allocation.tsx ; app/page.tsx ; P1 |
| Produit | Companies | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/components/notion-companies.tsx ; app/page.tsx ; P1 |
| Produit | Company | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/components/company-detail.tsx ; app/page.tsx ; P1 |
| Produit | analyses | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/components/company-analysis-document.tsx ; app/page.tsx ; P1 |
| Produit | historique | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/components/company-detail.tsx ; app/page.tsx ; P1 |
| Produit | Basket | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/components/theme-baskets.tsx ; app/page.tsx ; P1 |
| Produit | AI | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/components/ai-analysis.tsx ; app/page.tsx ; P1 |
| Produit | Gestion | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/page.tsx ; app/page.tsx ; P1 |
| Produit | démo/personnel | Parcours utilisable, contenu complet, état erreur/chargement honnête | Code inspecté ; tests locaux selon périmètre, pas recette E2E | Recette V aux deux viewports, demo puis personal | PARTIAL | app/lib/client-resource.ts ; app/page.tsx ; P1 |
| Renderer | Business | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | Valuation | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | Short | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | Portfolio Fit | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | CIO Memo | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | Decision | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | Earnings | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | Generic | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | projection valide/absente/invalide | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | HTML historique | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | Markdown historique | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | blocs Notion | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | tables et descendants imbriqués | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | citations | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | scénarios | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | seuils | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | KPI | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | Decision Card | Conserver le contenu et appliquer le reader canonique | Tests SSR/parsers PASS sur fixtures couvertes | V + corpus réel R, vérifier chaque famille et format | PARTIAL | app/lib/document-presentation.ts ; app/lib/notion-renderer.ts ; app/lib/notion-block-parser.ts ; app/components/analysis-reader.tsx ; P1 |
| Renderer | Evidence Ledger | Conserver toutes les tables et preuves documentaires | Lot12 AN-599 : 9 tables / 275 groupes ; normalisation provider testée | R : afficher AN-599 en lecture seule et comparer aux preuves Lot12 | PARTIAL | H12 ; tests/presentation-projection.test.mjs ; tests/notion-adapter-write.test.mjs ; P1 |
| Renderer | Evidence Gate | Conserver toutes les tables et preuves documentaires | Lot12 AN-599 : 9 tables / 275 groupes ; normalisation provider testée | R : afficher AN-599 en lecture seule et comparer aux preuves Lot12 | PARTIAL | H12 ; tests/presentation-projection.test.mjs ; tests/notion-adapter-write.test.mjs ; P1 |
| Renderer | contenus natifs récents | Conserver toutes les tables et preuves documentaires | Lot12 AN-599 : 9 tables / 275 groupes ; normalisation provider testée | R : afficher AN-599 en lecture seule et comparer aux preuves Lot12 | PARTIAL | H12 ; tests/presentation-projection.test.mjs ; tests/notion-adapter-write.test.mjs ; P1 |
| Renderer | normalizer unique | Frontière partagée serveur/preview/reader | PASS statique et tests ; réutilisation normalizedAnalysis | Aucun rerun nécessaire si code identique | PASS | app/lib/document-presentation.ts:277 ; adapters/notion/investment-data.ts:415 ; adapters/notion/investment-reads.ts ; app/components/analysis-reader.tsx |
| Mobile | 360×800 navigation/back/accordéons | Tous les parcours V, contenu ouvert et tableaux larges | Invariants CSS/SSR uniquement | V et captures + mesure DOM | BLOCKED | BLOCKED_VISUAL ; V ; skill Sites preview managed-linux |
| Mobile | 360×800 tableaux/KPI/Decision Card | Tous les parcours V, contenu ouvert et tableaux larges | Invariants CSS/SSR uniquement | V et captures + mesure DOM | BLOCKED | BLOCKED_VISUAL ; V ; skill Sites preview managed-linux |
| Mobile | 360×800 overflow horizontal/loaders/lisibilité/historique | Tous les parcours V, contenu ouvert et tableaux larges | Invariants CSS/SSR uniquement | V et captures + mesure DOM | BLOCKED | BLOCKED_VISUAL ; V ; skill Sites preview managed-linux |
| Mobile | 390×844 navigation/back/accordéons | Tous les parcours V, contenu ouvert et tableaux larges | Invariants CSS/SSR uniquement | V et captures + mesure DOM | BLOCKED | BLOCKED_VISUAL ; V ; skill Sites preview managed-linux |
| Mobile | 390×844 tableaux/KPI/Decision Card | Tous les parcours V, contenu ouvert et tableaux larges | Invariants CSS/SSR uniquement | V et captures + mesure DOM | BLOCKED | BLOCKED_VISUAL ; V ; skill Sites preview managed-linux |
| Mobile | 390×844 overflow horizontal/loaders/lisibilité/historique | Tous les parcours V, contenu ouvert et tableaux larges | Invariants CSS/SSR uniquement | V et captures + mesure DOM | BLOCKED | BLOCKED_VISUAL ; V ; skill Sites preview managed-linux |
| Performance | cold Portfolio | Mesures comparables et corrélées, sans seuil inventé | Benchmark synthétique partiel ; Basket/paint non mesurés | B : réseau + Worker + DOM sur parcours V | BLOCKED | BLOCKED_VISUAL / BLOCKED_HOSTED_METRICS ; B ; plan §13 |
| Performance | warm Portfolio | Mesures comparables et corrélées, sans seuil inventé | Benchmark synthétique partiel ; Basket/paint non mesurés | B : réseau + Worker + DOM sur parcours V | BLOCKED | BLOCKED_VISUAL / BLOCKED_HOSTED_METRICS ; B ; plan §13 |
| Performance | Company + analyses | Mesures comparables et corrélées, sans seuil inventé | Benchmark synthétique partiel ; Basket/paint non mesurés | B : réseau + Worker + DOM sur parcours V | BLOCKED | BLOCKED_VISUAL / BLOCKED_HOSTED_METRICS ; B ; plan §13 |
| Performance | Basket | Mesures comparables et corrélées, sans seuil inventé | Benchmark synthétique partiel ; Basket/paint non mesurés | B : réseau + Worker + DOM sur parcours V | BLOCKED | BLOCKED_VISUAL / BLOCKED_HOSTED_METRICS ; B ; plan §13 |
| Performance | renderer historique | Mesures comparables et corrélées, sans seuil inventé | Benchmark synthétique partiel ; Basket/paint non mesurés | B : réseau + Worker + DOM sur parcours V | BLOCKED | BLOCKED_VISUAL / BLOCKED_HOSTED_METRICS ; B ; plan §13 |
| Performance | fanout réseau | Mesures comparables et corrélées, sans seuil inventé | Benchmark synthétique partiel ; Basket/paint non mesurés | B : réseau + Worker + DOM sur parcours V | BLOCKED | BLOCKED_VISUAL / BLOCKED_HOSTED_METRICS ; B ; plan §13 |
| Performance | mémoire Worker | Mesures comparables et corrélées, sans seuil inventé | Benchmark synthétique partiel ; Basket/paint non mesurés | B : réseau + Worker + DOM sur parcours V | BLOCKED | BLOCKED_VISUAL / BLOCKED_HOSTED_METRICS ; B ; plan §13 |
| Performance | hydration/paint | Mesures comparables et corrélées, sans seuil inventé | Benchmark synthétique partiel ; Basket/paint non mesurés | B : réseau + Worker + DOM sur parcours V | BLOCKED | BLOCKED_VISUAL / BLOCKED_HOSTED_METRICS ; B ; plan §13 |
| Performance | lectures SQL | Mesurer coût et étendue de lecture ciblée | Benchmark local archivé ; tests scoped bodies PASS | B : corrélation runtime hébergé, comparer sur même environnement | PARTIAL | P0 benchmark ; tests/performance.test.mjs ; B |
| Performance | payload | Mesurer coût et étendue de lecture ciblée | Benchmark local archivé ; tests scoped bodies PASS | B : corrélation runtime hébergé, comparer sur même environnement | PARTIAL | P0 benchmark ; tests/performance.test.mjs ; B |
| Performance | normalisation | Mesurer coût et étendue de lecture ciblée | Benchmark local archivé ; tests scoped bodies PASS | B : corrélation runtime hébergé, comparer sur même environnement | PARTIAL | P0 benchmark ; tests/performance.test.mjs ; B |
| Performance | SSR | Mesurer coût et étendue de lecture ciblée | Benchmark local archivé ; tests scoped bodies PASS | B : corrélation runtime hébergé, comparer sur même environnement | PARTIAL | P0 benchmark ; tests/performance.test.mjs ; B |
| Performance | absence de lecture de tous les corps | Mesurer coût et étendue de lecture ciblée | Benchmark local archivé ; tests scoped bodies PASS | B : corrélation runtime hébergé, comparer sur même environnement | PARTIAL | P0 benchmark ; tests/performance.test.mjs ; B |
| Performance | MCP READ | READ réel + délai/taille, sans mutation | Local Worker PASS ; hosted demo PASS 473 ms | Mesures warm/représentatives personal cacheOnly si besoin, pas refaire Lot11 | PARTIAL | P2 ; P3 ; contracts/mcp.ts:50 |
| Performance | MCP WRITE | Réutiliser preuve closeout, ne pas rouvrir | Lot12 E2E acquis ; release fermée | Aucun WRITE autorisé ou nécessaire | PASS | H12 ; transports/mcp/sites-auth.ts |
| Sécurité | auth fail-closed | Respecter la frontière exécutée et les refus | PASS statique/tests isolés ; pas preuve exhaustive live | Réutiliser Lot11/12 ; vérification session réelle dans V | PASS | worker/index.ts:78 ; transports/mcp/sites-auth.ts ; P1 ; H12 |
| Sécurité | isolation propriétaire/démo | Respecter la frontière exécutée et les refus | PASS statique/tests isolés ; pas preuve exhaustive live | Réutiliser Lot11/12 ; vérification session réelle dans V | PASS | worker/index.ts:202-375 ; tests/notion-security.test.mjs ; P1 ; H12 |
| Sécurité | permissions/scopes | Respecter la frontière exécutée et les refus | PASS statique/tests isolés ; pas preuve exhaustive live | Réutiliser Lot11/12 ; vérification session réelle dans V | PASS | transports/mcp/server.ts:71-82 ; P1 ; H12 |
| Sécurité | WRITE fermé par défaut | Respecter la frontière exécutée et les refus | PASS statique/tests isolés ; pas preuve exhaustive live | Réutiliser Lot11/12 ; vérification session réelle dans V | PASS | transports/mcp/sites-auth.ts ; P2 ; P1 ; H12 |
| Sécurité | aucun retry automatique mutation | Respecter la frontière exécutée et les refus | PASS statique/tests isolés ; pas preuve exhaustive live | Réutiliser Lot11/12 ; vérification session réelle dans V | PASS | adapters/notion/analysis-writes.ts:92 ; transports/mcp/server.ts:98 ; P1 ; H12 |
| Sécurité | idempotence | Respecter la frontière exécutée et les refus | PASS statique/tests isolés ; pas preuve exhaustive live | Réutiliser Lot11/12 ; vérification session réelle dans V | PASS | adapters/notion/analysis-writes.ts:186-220 ; tests/notion-adapter-write.test.mjs ; P1 ; H12 |
| Sécurité | cross-scope API/cache | Respecter la frontière exécutée et les refus | PASS statique/tests isolés ; pas preuve exhaustive live | Réutiliser Lot11/12 ; vérification session réelle dans V | PASS | app/lib/resource-cache.ts ; app/lib/client-resource.ts ; tests/resource-cache-scope.test.mjs ; P1 ; H12 |
| Sécurité | webhook authentifié | Respecter la frontière exécutée et les refus | PASS statique/tests isolés ; pas preuve exhaustive live | Réutiliser Lot11/12 ; vérification session réelle dans V | PASS | worker/index.ts:224-252 ; tests/notion-security.test.mjs ; P1 ; H12 |
| Sécurité | diagnostics provider sans payload | Respecter la frontière exécutée et les refus | PASS statique/tests isolés ; pas preuve exhaustive live | Réutiliser Lot11/12 ; vérification session réelle dans V | PASS | adapters/notion/analysis-writes.ts:76-86 ; P1 ; P1 ; H12 |
| Sécurité | aucune donnée personnelle en demo | Jeu demo séparé ; IDs personal inaccessibles | Tests locaux PASS ; READ hébergé uniquement fictif | V : bascule owner/non-owner, vérifier cache/réseau sans exposition | PARTIAL | worker/index.ts ; app/lib/demo-data.ts ; P1 ; P3 ; H12 |
| Sécurité | secrets client/repo | Aucun secret exposé | 198 fichiers suivis : zéro motif reconnu ; tests client PASS | Revue bundle/client et historique/plugin si non couverts par preuves conservées | PARTIAL | P4 ; tests/notion-security.test.mjs ; app/lib/notion-sync-client.ts |
| Sécurité | aucune mutation après timeout sans nouveau gate | Ne pas assimiler timeout à annulation | WRITE fermé empêche de démarrer ; activeWrites garde la tâche en vol | Documenter limite : pas de cancellation propagée ; aucun test WRITE live | PARTIAL | transports/mcp/server.ts:104-113 ; H12 ; S3 |
| Sécurité | absence fallback dangereux | Pas de contourner auth/Current ou MCP→provider | Fail-closed source/tests ; plugin acquis au Lot12 | Contrôle final plugin installé/manifest sans workflow financier | PARTIAL | core/services/investment-os.ts:167 ; H12 ; A |
| Clôture | code mort réellement démontré | Documenter uniquement le système exécuté | Bridges ont encore consommateurs ; aucune suppression justifiée | Conserver ; pas de nettoyage spéculatif | PASS | worker/index.ts:5-6 ; app/lib/investment-data.ts ; app/lib/notion-sync.ts |
| Clôture | branches/scripts inutiles | Documenter uniquement le système exécuté | Scripts de test/benchmark utilisés ; inventaire distant incomplet | Ne rien supprimer ; traiter seulement objet prouvé sans consommateur | PARTIAL | package.json ; scripts/ ; A |
| Clôture | documentation conforme | Documenter uniquement le système exécuté | Écarts README/AGENTS/architecture/domain/plan prouvés | Appliquer patch documentaire préparé et relire runtime/contrat/MCP | PARTIAL | D ; patch annexe |
| Clôture | rollback | Documenter uniquement le système exécuté | v239 connu mais réintroduit perte tables ; pas exécuté | Vérifier procédure et accepter explicitement cette régression si rollback | PARTIAL | H12 ; catalogue Sites v239/v240 |
| Clôture | Site ↔ Git app ↔ plugin | Documenter uniquement le système exécuté | v240 commit/env/déploiement confirmés ; app commit lu ; parité plugin acquise | Vérifier branches courantes et manifeste installé, sans release | PARTIAL | H12 ; A ; .orca/evidence/lot12/plugin-1.3.10-git-parity.json |
| Clôture | anciens NO-GO historiques | Documenter uniquement le système exécuté | H12 final remplace les anciens verdicts ; docs Sites encore périmées | Patch HISTORICAL/SUPERSEDED et liens ; préserver preuves | PARTIAL | D ; patch annexe |

## Audit statique limité et classification

**S1 — renderer : PASS statique/fixtures.** L’adapter construit normalizedAnalysis à la frontière documentFromRow. AnalysisReader réutilise cette valeur ou le normalizer unique ; CIO réutilise le reader dédié et les primitives communes. CanonicalAnalysisContent et les parsers HTML/Markdown/Notion alimentent le même contrat. La normalisation provider des descendants est dans la vue humanReadableNotionBlocks, sans mutation du snapshot brut. Le test projection vérifie la conservation des autres champs. Les tables/citations/scénarios, y compris ponctuation, sont testés. Aucun changement writer/format canonique justifié. Le rendu réel AN-599 et la disposition mobile restent à constater.

**S2 — caches/hydration : PASS invariants, PARTIAL runtime.** Cache mémoire seulement, déduplication promises, TTL 60 s, invalidation epoch/revision, abort des appels en vol, purge 401/403 et suppression de réponse ancienne ; scope switch clear + reload. Service worker exclut API/HTML privés. Hydration session part en demo puis charge la session serveur. CompanyAnalysisDocument vérifie l’identité et le corps canonique, conserve le contenu connu en cas d’erreur. Aucun test navigateur d’hydration effectué. Le warmup Basket et les vues conservées peuvent produire un fanout intentionnel : à mesurer, pas qualifier de bug sans résultat.

**S3 — timeout : limite d’architecture connue, gate PARTIAL, aucun nouveau blocker v240 démontré.** transports/mcp/server.ts utilise Promise.race et waitUntil, sans API de cancellation dans les ports. Une opération déjà commencée peut poursuivre ses étapes après la réponse timeout ; activeWrites ne disparaît qu’à sa terminaison. Le writer réconcilie les mutations ambiguës par READ et journal avant reprise. Cela prouve « pas de retry aveugle », PAS « toute mutation s’arrête au timeout ». WRITE fermé empêche ce chemin de démarrer en v240. Une future réouverture demanderait un gate distinct ; elle est interdite ici. La clause littérale d’absence de mutation après timeout n’est donc pas certifiée pour un WRITE ouvert. Aucun patch de cancellation improvisé.

**S4 — séparation : PASS statique dans le périmètre.** Core contrats/policy/services derrière ports ; MCP effectue auth, validation, limites et dispatch, sans mapping Notion. Les adapters portent projection/cache/journal provider. Des routes techniques et UI legacy lisent encore directement les adapters : chemin réellement exécuté à documenter, aucune fausse affirmation « tous les endpoints sont Core ». Les dépendances adapter→helpers de présentation/UI existent déjà ; dette de portabilité, pas bug démontré. Les réexports app/lib/investment-data et notion-sync ont des consommateurs réels ; ne pas les supprimer.

**S5 — sécurité des deux chemins.** UI→Worker : owner issu du header Sites et OWNER_EMAIL, cookie simple préférence, non-owner toujours demo, fixtures distinctes, réponses privées no-store, mutations techniques bearer serveur fail-closed et refresh owner+same-origin. Webhook : secret de chemin puis HMAC pour événements ; bootstrap vérification protégé par secret, GET token désactivé. Plugin→MCP : identité subject+email requise, scope explicite, permissions et run allowlist, demo WRITE refusé, release flag false, limites JSON, rejet origin navigateur. Aucune preuve de résistance au spoof de header sur un Worker brut : la confiance est celle du dispatch Sites, déjà explicitée. Provider diagnostics limités aux locators structurels/types, jamais messages libres ou payload. Les READ peuvent retry deux fois ; mutations provider et transport une seule tentative.

**S6 — hygiène erreurs : dette à examiner seulement si exposition prouvée.** Portfolio/Basket et certaines routes techniques reprennent error.message dans une réponse réservée au propriétaire. La route analyses et MCP fournissent des diagnostics sûrs. Aucun secret dans une réponse de ces routes n’a été démontré : pas de blocker ni correctif spéculatif.

**D — écarts documentaires certains, empêche la clôture documentaire.** README attribue les propriétaires aux shims, ignore MCP et annonce un Site owner-private alors que le catalogue affiche public. AGENTS et target-architecture présentent MCP comme futur. Domain-contracts dit selector non branché malgré l’appel selectCurrentAnalysis du service. Plan résumé et anciennes passations Lot12 affichent NO-GO pré-clôture. Classe : dette documentaire obligatoire à fermer au Lot13, aucun bug runtime prouvé. Patch minimal préparé ci-dessous, UNAPPLIED ; applicabilité git apply --check PASS. Pas de suppression de preuve historique.

**Blockers initiaux de certification** : campagne V absente ; mesures hébergées B absentes ; documentation courante non corrigée ; alignement final A non entièrement contrôlé ; clause timeout non certifiée au-delà du WRITE fermé. L’audit initial v240 n’avait identifié aucun blocker applicatif certain. La campagne ultérieure a prouvé deux régressions reader corrigées, un échec Earnings mapping restant et une parité KPI/scénarios partielle : voir addendum. Aucune suppression/branche supprimée. Un seuil de vitesse arbitraire ou une préférence UI ne devient pas un blocker.

## Commandes exécutées / restantes

À lancer depuis la source opérationnelle exacte après vérification de HEAD et status. Les commandes ci-dessous réutilisent les tests existants ; ne pas les relancer si source identique et preuves présentes.

```bash
git rev-parse HEAD
git status --short --branch
node --version
node --test tests/analysis-canonical-renderer.test.mjs tests/analysis-reference-fixtures.test.mjs tests/analysis-inline-format.test.mjs tests/cio-summary-routing.test.mjs tests/presentation-projection.test.mjs tests/performance.test.mjs tests/notion-security.test.mjs tests/demo-data.test.mjs tests/resource-cache-scope.test.mjs tests/mcp-server.test.mjs tests/notion-adapter-write.test.mjs
npm run typecheck
npm run build
npm run validate:artifact
npm run verify:mcp-runtime
```

Toutes exécutées avec succès ici. Pas besoin de rejouer npm test 299/299 Lot12 pour simple reprise documentaire. Les suites writer utilisent une base/HTTP synthétiques, aucun save_analysis live.

Benchmark réutilisable (ne pas remplacer les mesures hébergées par cette commande) :

```bash
node --expose-gc tests/benchmark-data.mjs . /workspace/scratch/c34339e3322c/lot13-benchmark-next.json
```

### B — scénarios de performance

Seuils : **aucun seuil numérique de latence/heap/SQL défini dans le §13**. Exigence : mesures comparables et absence de chargement de tous les corps. Bornes contractuelles MCP réellement exécutées : input 2097152 octets, output 4194304 octets, READ/WRITE 30000 ms, READ attempts 2 / WRITE attempts 1. Les tests longs Lot11 120 s sont historiques, pas la config finale v240.

| Scénario | Commande / parcours exact | Métriques à archiver | Résultat | Seuil du plan |
|---|---|---|---|---|
| cold Portfolio | V : nouveau contexte navigateur autorisé, ouvrir Portfolio, cache session neuf sans effacer D1 | navigation→app-view-ready/paint, TTFB, API duration, octets, requêtes, SQL, CPU/heap Worker si disponibles | Synthétique local ci-dessous ; hébergé BLOCKED | Non défini |
| warm Portfolio | V : retourner Portfolio dans même session après Company/Basket | mêmes métriques et état cache, fanout background séparé | Synthétique local ; hébergé BLOCKED | Non défini |
| Company + analyses | GET /api/companies/:id puis ouverture de chaque analyse via /api/analyses/:id dans V | preview/body bytes, SQL/body reads, normalizer, hydration, paint, erreurs | Fixtures/scoped-body PASS ; hébergé BLOCKED | Pas de lecture de tous les corps |
| Basket | V : Portfolio chargé, attendre warmup, ouvrir Thèmes puis retour | temps utilisable, warmup requests, payload, quote fanout, loader | Invariants cache PASS ; benchmark live absent | Non défini |
| renderer historique | V/R : ouvrir un document HTML et un Markdown identifiés | body/normalizer/SSR/hydration/paint, tables, contenu | Fixtures SSR PASS ; hébergé BLOCKED | Non défini |
| MCP READ | get_portfolio({contractVersion:"1.0.0",scope:"demo",options:{cacheOnly:true}}) | status, temps caller, JSON bytes ; série comparables si utile | PASS un appel 473 ms ; pas cold/warm/p95 | Limites MCP ci-dessus |

Pour les mesures HTTP depuis le navigateur autorisé, utiliser les routes précédentes en GET, sans refresh=1 et sans forcer Yahoo/Notion. Relever response et Resource Timing dans les outils réseau ; exporter HAR privé sans cookies/tokens, journal avec version/scope/viewport/cache/heure/request-id. Pour SQL/mémoire, utiliser les logs Worker corrélés de ce parcours ; si la plateforme n’expose pas la métrique, conserver BLOCKED_METRIC. Ne pas fabriquer un compteur à partir du nombre d’appels HTTP. Ne pas lancer sync/refresh ni effacer le cache D1.

Pour la métrique réseau DOM sur une page déjà ouverte, snippets exacts en console du navigateur autorisé :

```javascript
({viewport:[innerWidth,innerHeight], overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth, scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth})
performance.getEntriesByType('resource').filter(x=>x.name.includes('/api/')).map(x=>({url:new URL(x.name).pathname,durationMs:x.duration,transferBytes:x.transferSize,encodedBytes:x.encodedBodySize,decodedBytes:x.decodedBodySize}))
```

TransferSize=0 peut indiquer cache/limitations Timing : ne pas le convertir en payload réel nul. Les tables peuvent scroller dans leur conteneur ; la page entière ne doit pas déborder.

### Résultats synthétiques P0 conservés

| Opération | Cold ms | Médiane warm ms | p95 ms | SQL/appel | Corps/appel | JSON octets | Normalisation cold ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| analyses | 203.92 | 77.49 | 117.64 | 14 | 0 | 214147 | 0.00 |
| company | 80.06 | 53.52 | 59.22 | 13 | 3 | 71389 | 24.67 |
| document | 49.54 | 46.36 | 51.26 | 14 | 1 | 23543 | 2.28 |
| portfolio | 7.76 | 5.46 | 6.89 | 12 | 0 | 1058 | 0.00 |
| companyPreview | 11.85 | 1.75 | 2.52 | 0 | 0 | 2421 | 11.39 |

60 sociétés / 180 rapports / 30 warm. Company lit trois corps liés ; document un seul ; liste/Portfolio zéro. Le helper Company local peut hydrater les rapports liés avant compactage : coût réel conservé, aucune déclaration « zéro corps partout ». Preview seul est une transformation distincte. SQL expliqué utilise index et parfois scans de métadonnées ; ce n’est pas un scan de tous les corps. SSR renderToString : médiane 8,03 ms / p95 11,16 ms ; HTML 10712 octets ; heap max début/fin 63695016 octets = borne inférieure, pas pic Worker. Cold = premier appel après préparation, pas process-cold/production. Ces chiffres proviennent du run préliminaire retrouvé, pas d’un nouveau run de cette session.

## V — checklist visuelle exacte

**BLOCKED_VISUAL** ici. Le workflow [Sites managed-linux preview](skill://sites@openai-curated-remote/root/.codex/plugins/cache/openai-curated-remote/sites/0.1.75/skills/sites-building/references/preview/managed-linux.md) impose : « Before the first cloud-browser action, load and read $control-browser » et « If it is unavailable, do not improvise another browser-control path. » Le skill control-browser n’est pas disponible ; inventaire skills signale `/root/.codex/skills/browser` absent. Aucun navigateur alternatif initialisé, aucune capture revendiquée. Ce n’est pas une demande d’approbation : la session suivante doit disposer de la capacité.

Reprise avec cette capacité : lire control-browser, puis depuis le checkout :

```bash
sites-preview start "$PWD"
```

URL de test imposée par ce profil : http://terminal.local:4173/ ; aucune URL Sites live dans le cloud browser. Viewports **360×800** puis **390×844**. Une authentification réelle via le workflow de la capacité est nécessaire pour personal ; pas de header forgé ni de token récupéré. Le preview demo ne remplace pas la validation personnelle déployée si son auth réelle n’est pas disponible.

Pour CHAQUE viewport :

1. Portfolio : valeurs/positions visibles, fraîcheur honnête, loader finit ; aller/retour et double-clic navigation.
2. Exposition (sous-vue Portfolio) : catégories/graphes lisibles, légende, chiffres et petits segments ; aucune modification des classifications.
3. Trajectoire : sélectionner 10k puis 25k, colonnes/poids/titres, aucune colonne rognée.
4. Companies : Toutes/Détenues/Watchlist, recherche, lignes accessibles, ouvrir société.
5. Company : back vers liste, menu analyses stable, position/aperçus, historique.
6. Business : bandeaux, ouverture/fermeture, tableaux, citations et conservation du corps.
7. Valuation : KPI en haut, scénarios et seuils, terminal/CAGR distincts, ponctuation sans perte ; table large.
8. Portfolio Fit : synthèse, poids/risques, tableaux, sources.
9. CIO Memo : Decision Card, décisions et raisonnement, liens, aucun score numérique de Memo.
10. Basket/Thèmes : passage après warmup et retour ; cache et loader, contenu lisible.
11. AI : sélection d’une entreprise, prompt/copie ; ne pas lancer d’analyse ni de génération.
12. Gestion : personal seulement, statut/sources lisibles ; ne cliquer sur aucune synchronisation/refresh.
13. Short, Decision, Earnings, Generic : ouvrir depuis les fixtures/corpus disponibles, même contrôle contenu et sources.
14. Historique : ouvrir ancienne version, HTML et Markdown ; back restaure le parcours, Current reste distinct.
15. Contrôle transverse : overflow DOM fermé puis accordéons ouverts ; tableaux scrollent dans leur zone ; KPI et Decision Card lisibles ; bottom nav/back sans superposition ; aucune erreur console/hydration ; captures avant/après ouverture avec IDs source et viewport.
16. Bascule demo→personal→demo propriétaire puis session non-owner : Gestion indisponible en demo, cache privé purgé, aucune donnée personnelle dans DOM/réseau après bascule, ID personnel introuvable en demo. Ne pas archiver les captures personnelles dans Git.

## R — corpus renderer à utiliser sans nouvelle écriture

Réutiliser `stories/reference-fixtures.ts`, `app/data/analysis-reference-fixtures.json`, `app/data/document-presentation-fixtures.json`, `tests/fixtures/lot12-an598-business.json` et preuves AN-599 Lot12. La fixture AN-598 n’est pas un nouveau receipt ni une nouvelle certification AN-598. Choisir pour les READ réels des IDs provenant de get_company/archives, jamais inventés. Inclure un rapport natif récent AN-599, bloc Notion/table imbriquée, HTML, Markdown, citations, Ledger et Gate ; comparer textes/groupes/tables au snapshot préservé. Si une famille n’existe pas dans le corpus réel, exécuter le fixture visuel correspondant et laisser la couverture corpus PARTIAL. Ne pas créer de document pour combler un gate.

## A — alignement et rollback restant

- Vérifier HEAD/status de la branche app courante et conserver les docs/evidence spécifiques au miroir ; jamais écraser Sites depuis GitHub.
- Reprendre `.orca/evidence/lot12/plugin-1.3.10-git-parity.json` : 108 fichiers, archive SHA256 `4e3a780b8156b70704cfe40d7468dad529eca9dc7e7869700a360648e1e8a9ab`. Lire le manifeste installé/checkout personnel et confirmer la version/HEAD ; aucune release ni workflow analytique nouveau.
- Vérifier runtime documentaire, surface huit tools MCP, OpenAI/Sites auth/dispatch et packaging réellement nécessaires. Le Core est indépendant ; dépendances de hosting et plugin ne le sont pas.
- Rollback H12 v239 / `03cff56c81b5f39501bdbdc293d32ce365bf0959` existe mais réintroduit la perte de tables. Ne pas le déployer pour un simple test. Pour tout futur patch validé, v240 sera la référence de retour documentaire/contenu. Une procédure doit nommer version, env, verrou et conséquences ; pas prétendre « rollback prouvé live ».

## Patch documentaire préparé

**UNAPPLIED — contrôle d’applicabilité PASS**, pas correction publiée. Aucun patch runtime ni UNVALIDATED runtime. Les bannières préservent les anciens verdicts. Compléter ensuite les paragraphes historiques « selector non branché/MCP futur » comme HISTORICAL, sans réécrire leurs preuves ni transformer leur contenu en baseline. Le patch indique une autorité courante mais ne suffit pas à garantir la relecture complète de la documentation.

Extraire le bloc diff ci-dessous dans un fichier puis, sur v240 exact :

```bash
git apply --check /absolute/path/lot13-docs-prepared.patch
git apply /absolute/path/lot13-docs-prepared.patch
git diff --check
git diff --stat
git diff -- README.md AGENTS.md docs/architecture/
```

Docs seulement : relire la concordance avec le runtime, pas de nouveaux tests miroirs du texte. Intégrer le présent handoff au chemin convenu, puis commit documentaire et alignement miroir selon workflow de reprise. Ne pas republier l’app seulement pour ses documents si le code runtime reste identique.

```diff
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -75,7 +75,7 @@
 
 Chemin actuel des services Investment OS : `consumer → Core services → ports → adapter Notion → Notion/D1`. L'assemblage est `createInvestmentAdapter` dans `adapters/notion/investment-reads.ts` ; `createInvestmentReadAdapter` est son alias de compatibilité, pas une seconde implémentation. Le Worker HTTP et la PWA sont des consommateurs. Les projections techniques existantes restent dans leurs propriétaires ; ce chemin ne signifie pas que tous les endpoints historiques passent déjà par le Core.
 
-Cible future uniquement : `Skills → MCP → Core → ports/adapters`. MCP sera un transport mince, sans logique métier. Son contrat relève du Lot 10 et son serveur du Lot 11 ; ces instructions n'en constituent pas une implémentation.
+Chemin exécuté : `Skills → MCP Sites → Core → ports/adapters`. Transport : `transports/mcp/server.ts` ; auth Sites : `transports/mcp/sites-auth.ts` ; contrat : `contracts/mcp.ts`. WRITE est fermé dans la release v240. La méthodologie reste dans le plugin personnel 1.3.10.
 
 | Nouvelle logique | Propriétaire à compléter ou réutiliser |
 | --- | --- |
--- a/README.md
+++ b/README.md
@@ -26,7 +26,7 @@
 | --- | --- |
 | Identité | L'identifiant Notion canonique est la clé ; le titre n'est jamais une identité. |
 | Analyse actuelle | Une seule analyse Current est affichée par société et par type. |
-| Fraîcheur | Source Freshness = Current et Status = Validated sont prioritaires ; à statut équivalent, la version au last_edited_time le plus récent est retenue. |
+| Fraîcheur / Current | La politique canonique est core/analysis/current-selection.ts : pointeur explicite contextuel prioritaire ; pointeur invalide refusé, sans fallback. Le fallback de compatibilité sans pointeur et la politique stricte CIO restent ceux du sélecteur. |
 | Archives | Les versions précédentes restent consultables sans remplacer la version actuelle. |
 | Relations | Les vues Watchlist utilisent la relation Notion Company explicite, par identifiant de page canonique ; une mention secondaire ne détermine jamais l'appartenance. Chaque entrée Watchlist doit avoir une Company, et une Company au plus. |
 | Owned | Une société est détenue si une position Portfolio est Active avec une quantité strictement positive. |
@@ -34,6 +34,9 @@
 | Cotations | Yahoo Finance (query2 puis query1) est essayé avant Google Finance ; le dernier cours valide est conservé avec sa provenance et ses horodatages. |
 
 ## Schéma technique
+
+Chemins exécutés : UI → API Worker → Core/ports/adapters pour les opérations migrées ; routes techniques historiques → adapters existants. Plugin personnel 1.3.10 → MCP Sites → Core → ports/adapters → Notion/D1. La politique Current est dans core/analysis/current-selection.ts ; un pointeur explicite invalide ne déclenche pas de fallback. WRITE est fermé par SITE_WRITE_RELEASE_APPROVED=false. Un timeout transport ne prouve pas l’annulation d’une tâche démarrée.
+
 
 ~~~mermaid
 flowchart LR
@@ -51,10 +54,10 @@
 | --- | --- |
 | Notion | Companies, Analyses, Earnings, Portfolio, Watchlist, Decisions et Sources. |
 | worker/index.ts | Routes API, webhook, signature, orchestration des synchronisations et bindings Cloudflare. |
-| app/lib/notion-sync.ts | Découverte, comparaison des versions, file d'import, pagination, reprise et reconstruction des relations. |
+| adapters/notion/sync.ts (réexport app/lib/notion-sync.ts) | Découverte, comparaison des versions, file d'import, pagination, reprise et reconstruction des relations. |
 | D1 | Snapshots, états de synchronisation, verrous, file d'import, événements webhook, relations et cache des cotations. |
 | app/components/ | Rendu des écrans, états de chargement/erreur et rafraîchissements. |
-| app/lib/investment-data.ts | Projection des snapshots D1 en modèles portefeuille, entreprises et documents ; audit des relations Watchlist. |
+| adapters/notion/investment-data.ts (réexport app/lib/investment-data.ts) | Projection des snapshots D1 en modèles portefeuille, entreprises et documents ; audit des relations Watchlist. |
 
 ## Synchronisation Notion, TTL et webhook
 
@@ -136,7 +139,7 @@
 
 ## Sécurité et données
 
-- Le Site est owner-private : les routes de données ne doivent jamais être déployées avec une audience publique.
+- Le catalogue Sites v240 indique une audience publique. Les données personnelles restent réservées au propriétaire identifié par Sites et au scope personal. Demo utilise des fixtures distinctes ; le cookie de préférence ne vaut pas identité. Ne pas monter cette authentification sur un Worker public brut.
 - L’arbre courant ne contient ni token Notion, ni secret webhook, ni export de portefeuille ou données D1 de production.
 - Les anciens snapshots et exports sensibles ont été retirés de l’historique Git ; les sources métier restent hors du dépôt.
 - Le webhook est protégé par un secret de chemin, un jeton de vérification et une signature HMAC sha256.
--- a/docs/architecture/target-architecture.md
+++ b/docs/architecture/target-architecture.md
@@ -1,3 +1,5 @@
+> État courant au 2026-10-06 : Lot 12 GO infrastructure, Sites v240, plugin personnel 1.3.10, WRITE fermé. Lot 13 NOT CERTIFIED. [Handoff final Lot 12](https://github.com/erwancgn/investment-os/blob/9081489534ace3a1cee87fbfb0ab0b752563cb53/investment-os-lot12-handoff-2026-10-05.md). Les verdicts NO-GO antérieurs conservés ci-dessous sont HISTORICAL / SUPERSEDED pour l’état courant ; leurs limites de preuve ne sont pas effacées.
+
 # Investment OS — Lot 2 : architecture cible
 
 Décision de conception du 30 septembre 2026, fondée sur la [baseline Sites v207](baseline.md) et la [debt map](debt-map.md), commit d'audit `ae8d566`. **Au checkpoint du Lot 2, aucune de ces extractions n'était encore implémentée.** Les contrats du Lot 3 sont depuis matérialisés dans les [contrats de domaine](domain-contracts.md); les migrations d’adapters, services et consommateurs restent à faire. La branche reste `chore/architecture-stabilization-mcp`. Le checkpoint du Lot 4 ci-dessous décrit sa migration applicative, sans déploiement.
--- a/docs/architecture/domain-contracts.md
+++ b/docs/architecture/domain-contracts.md
@@ -1,3 +1,5 @@
+> État courant au 2026-10-06 : Lot 12 GO infrastructure, Sites v240, plugin personnel 1.3.10, WRITE fermé. Lot 13 NOT CERTIFIED. [Handoff final Lot 12](https://github.com/erwancgn/investment-os/blob/9081489534ace3a1cee87fbfb0ab0b752563cb53/investment-os-lot12-handoff-2026-10-05.md). Les verdicts NO-GO antérieurs conservés ci-dessous sont HISTORICAL / SUPERSEDED pour l’état courant ; leurs limites de preuve ne sont pas effacées.
+
 # Contrats de domaine — version 1.0.0
 
 Ce document fige le premier vocabulaire normalisé de `core/contracts` et la politique pure de sélection Current. Le Core ne lit ni D1, ni Notion, ni React, ni le transport MCP. Ces contrats sont la cible du Lot 3; aucun appel runtime n’est redirigé vers le sélecteur dans ce lot.
--- a/docs/architecture/lot-12-handoff.md
+++ b/docs/architecture/lot-12-handoff.md
@@ -1,3 +1,5 @@
+> État courant au 2026-10-06 : Lot 12 GO infrastructure, Sites v240, plugin personnel 1.3.10, WRITE fermé. Lot 13 NOT CERTIFIED. [Handoff final Lot 12](https://github.com/erwancgn/investment-os/blob/9081489534ace3a1cee87fbfb0ab0b752563cb53/investment-os-lot12-handoff-2026-10-05.md). Les verdicts NO-GO antérieurs conservés ci-dessous sont HISTORICAL / SUPERSEDED pour l’état courant ; leurs limites de preuve ne sont pas effacées.
+
 # Lot 12 — état du raccordement plugin/MCP
 
 4 octobre 2026. Départ : branche `chore/architecture-stabilization-mcp`, HEAD `acbb92dc329df17ef6942345b4c4656700a6de37`, Site v212 stable, Lot 11 clos READ-only. Le plugin canonique est dans le dépôt séparé `plugin-investment-os`, version publiée 1.3.0 ; la source 1.3.1 migre les neuf Skills vers les sept tools MCP sans changer les frameworks financiers. Son audit/parité source et ses tests sont consignés dans `docs/lot-12-mcp-migration.md` du dépôt plugin.
--- a/docs/architecture/lot-12-resolution.md
+++ b/docs/architecture/lot-12-resolution.md
@@ -1,3 +1,5 @@
+> État courant au 2026-10-06 : Lot 12 GO infrastructure, Sites v240, plugin personnel 1.3.10, WRITE fermé. Lot 13 NOT CERTIFIED. [Handoff final Lot 12](https://github.com/erwancgn/investment-os/blob/9081489534ace3a1cee87fbfb0ab0b752563cb53/investment-os-lot12-handoff-2026-10-05.md). Les verdicts NO-GO antérieurs conservés ci-dessous sont HISTORICAL / SUPERSEDED pour l’état courant ; leurs limites de preuve ne sont pas effacées.
+
 # Lot 12 — résolution canonique et preuves de clôture
 
 5 octobre 2026. Reprise de la source Sites v221, commit `8722b15752df21b883a4265922d10471f5422469`. Le checkout Orca local est un miroir plus ancien sans Core/MCP ; il n'a pas servi de source d'implémentation.
--- a/docs/architecture/openai-first-execution-plan.md
+++ b/docs/architecture/openai-first-execution-plan.md
@@ -1,3 +1,5 @@
+> État courant au 2026-10-06 : Lot 12 GO infrastructure, Sites v240, plugin personnel 1.3.10, WRITE fermé. Lot 13 NOT CERTIFIED. [Handoff final Lot 12](https://github.com/erwancgn/investment-os/blob/9081489534ace3a1cee87fbfb0ab0b752563cb53/investment-os-lot12-handoff-2026-10-05.md). Les verdicts NO-GO antérieurs conservés ci-dessous sont HISTORICAL / SUPERSEDED pour l’état courant ; leurs limites de preuve ne sont pas effacées.
+
 # Investment OS — vision figée OpenAI-first et plan d’exécution Lots 7.2–13
 
 > Statut : décision d’architecture figée le 1 octobre 2026.
@@ -839,4 +841,4 @@
 - **Lot 11** : serveur MCP mince, Sites comme première cible d’hébergement, Site existant préféré si compatible ;
 - **Lot 12** : migration infrastructure du plugin vers MCP, sans changement de méthodologie.
 
-La priorité actuelle est **Lot 12, migration du transport du plugin vers MCP**, après clôture READ-only du Lot 11 sur v212 et borne synchrone 30 s. Voir [lot-12-handoff.md](lot-12-handoff.md) : la source des Skills 1.3.1 est migrée, mais la connexion du brouillon public au Site MCP reste non autorisée/non prouvée. Le Site v213 porte seulement la preuve de domaine. WRITE reste fermé et non délégué ; Lot 13 attend le gate Lot 12. Les Lots 7–10 ne sont pas rejoués.
+HISTORICAL / SUPERSEDED : la priorité antérieure était **Lot 12, migration du transport du plugin vers MCP**, après clôture READ-only du Lot 11 sur v212 et borne synchrone 30 s. Voir [lot-12-handoff.md](lot-12-handoff.md) : la source des Skills 1.3.1 est migrée, mais la connexion du brouillon public au Site MCP reste non autorisée/non prouvée. Le Site v213 porte seulement la preuve de domaine. WRITE reste fermé et non délégué ; Lot 13 attend le gate Lot 12. Les Lots 7–10 ne sont pas rejoués.
```

## Ordre minimal initial de reprise et décision — appliquer aussi l’addendum campagne

1. Vérifier baseline/source/publication courante ; lire H12 et ce handoff. Ne pas rejouer Lots7–12 ni les runs existants.
2. Appliquer/revoir la correction documentaire bornée, marquer les anciennes passations historiques ; conserver la procédure rollback honnête.
3. Exécuter V aux deux viewports avec capacité autorisée et corpus R, puis B sur les mêmes parcours/session ; archiver captures/HAR nettoyés/métriques.
4. Corriger uniquement un blocker observé, ajouter le test minimal de régression et vérifier le parcours touché. Si environnement incapable de tester le patch, UNVALIDATED et arrêt de certification.
5. Réaliser A : source Site/app/manifest plugin, env/version et WRITE fermé. Les appels live bornés et leur arrêt sont documentés dans l’addendum ; aucun replay des intentions consommées ni probe mutation supplémentaire.
6. Reclassifier la matrice avec les preuves exactes. GO seulement si tous les gates obligatoires réellement exécutés passent. Sinon conserver **LOT 13: NOT CERTIFIED** en listant les lignes restantes. Aucun Lot14.

Gates encore ouverts : tous les parcours produit/mobile V ; validation visuelle des familles/formats/evidence R ; benchmarks hébergés cold/warm/Company/Basket/historique, fanout/SQL/payload/mémoire/normalisation/SSR/hydration B ; revue complète secrets au périmètre disponible et isolation de session réelle ; interprétation documentée du gate timeout WRITE fermé ; mise à jour docs/historiques/rollback ; alignement final branches/plugin A. Les PASS unitaires ne remplacent aucun de ces parcours.

## Addendum — campagne E2E autorisée avec Luna

Cet addendum prévaut pour l’état courant. Campagne **PARTIAL / interrompue** ; **LOT 13: NOT CERTIFIED**. Les instructions originales « aucun WRITE » ont été modifiées par l’autorisation ultérieure de tester temporairement les analyses Draft, dans personal/owner uniquement. Cette exception n’autorise aucune promotion Current ni opération financière.

Trois `save_analysis` uniques : Business Schneider persisté `3f137ea7af3581eca68bfbbe7adc5bad`, Valuation Schneider persisté `3f137ea7af3581528270ee5d79af9abb`, Earnings Micron échoué `mapping` sans receipt/ID. Alphabet Business/Valuation/Short/Portfolio/CIO : zéro appel. Les deux receipts Schneider sont persisted=true, promoted=false, verified=false ; ils ne sont pas COMPLETE/VERIFIED au sens du plugin. Les huit rapports préparés restent analytiquement PARTIAL.

État final exact : v245 source `93a7497de4af5191405b09978bba595b1532bbfe`, déploiement `appgdep_6ac4ba811c088191bf10d31773b2649d` succeeded, environnement25. Flags `MCP_WRITE_ENABLED`, `MCP_WRITE_DELEGATED`, `MCP_WRITE_TEST_RUN_IDS` retirés ; `SITE_WRITE_RELEASE_APPROVED=false`. App miroir et plugin conservent la baseline annoncée, sans synchronisation ni nouvelle attestation de parité.

Luna : tests bornés policy/MCP/writer, contrôle des payloads et comparaison des tables ; puis **77/77** tests renderer/inline/writer/readadapter et typecheck PASS sur les correctifs. Deux fixes seulement : underscores littéraux conservés, archive canonique basée sur le signal explicite de page. Relecture live du même Draft Business après fix : 47 blocs conservés dans l’ordre ; Valuation :52. Les huit sélections Current sont inchangées. Aucun retry. Vérification finale de Luna sur la source fermée `93a7497` : `npm run test:mcp` **26/26**, schema check PASS, log `luna-final-closed-mcp.log`.

| Domaine | Gate | Exigence | Preuve existante | Preuve restante | Statut | Source exacte |
|---|---|---|---|---|---|---|
| Renderer | underscores / archive Draft | Littéral fidèle, histoire distincte du signal d’archive | Régressions reproduites, fixes,77tests, live readback | Visuel complet distinct | PASS régressions | `campaign-source-fix-validation.log`, `campaign-readback-0-v243.json` |
| Produit | Schneider Full Value Draft | Business + Valuation, sans promotion | 2receipts, corps/tables deepEqual | verified=false, gaps analytiques et visuels | PARTIAL | `campaign-final-live-proof.json`, `campaign-readback-1.json` |
| Produit | Micron Earnings | Mapping compatible avec source réelle | Appel unique error mapping | Schema brut, champ fautif, correctif prouvé, nouveau gate | BLOCKED | `luna-earnings-mapping-diagnostic.md` |
| Produit | Alphabet Full Analyse | 5modules, handoffs et READ IDs réels | Payloads validés et préparés ; zéro appel | Exécution après gate de reprise | BLOCKED | `campaign-payloads.json`, `campaign-payload-validation.json` |
| Renderer | KPI/scénarios présentation | Parité canonique requise | Tableaux conservés,3scénarios valuation reconstruits | Facts non reconstruits, terminalValue absent, projection absente | PARTIAL | `campaign-readback-1.json`, audit Luna dans rapport E2E |
| Sécurité | Current stable / WRITE fermé | Aucune promotion, fermeture déployée | 8Current identiques, v245/env25 sans flags | Pas de probe mutation requis | PASS périmètre campagne | `campaign-current-comparison.json`, `campaign-final-live-proof.json` |
| Clôture | Alignement final | Site/app/plugin cohérents, docs exactes | Site source/build/archive final cohérents | Miroir app/plugin, docs repo et rollback | PARTIAL | rapport E2E ; sectionA initiale |

L’échec Micron étaye un mapping de propriétés Earnings en préflight ; le champ exact n’est pas connu faute de schéma source exposé par les MCP READ. Aucune correction spéculative. L’absence de receipt et Current null ne certifient pas à elles seules l’absence absolue de page provider. Aucun retry.

**Reprise minimale actualisée** : garder WRITE fermé ; lire le schéma Earnings via capacité administrative READ autorisée et rechercher l’éventuel run échoué ; identifier et tester le correctif minimal ; ne jamais réécrire les deux Drafts Schneider ; définir explicitement un nouveau gate/run pour Micron ; ensuite seulement exécuter les cinq intentions Alphabet restées à zéro, fermer et déployer. L’allowlist préparée expire le 2026-10-06 à14:00Z. Aucun retry automatique du run échoué. Les commandes locales, ID réels et preuves sont dans `investment-os-lot13-e2e-results-2026-10-06.md` et l’archive `investment-os-lot13-e2e-proofs-2026-10-06.zip`.

Les autres gates restent exactement ouverts : recette produit/renderer/mobile V à360×800 et390×844 ; métriques hébergées B cold/warm/Company/Basket/historique/MCP et SQL/fanout/payload/mémoire/normalisation/SSR/hydration ; isolation/auth de session réelle et secrets au périmètre complet ; clause timeout ; docs/historiques/rollback ; alignement A. Aucun faux GO, aucun Lot14.

## Annexes — preuves de l’audit initial archivées dans ce handoff

Les logs sont reproduits sans valeurs de configuration privées. Hashes des fichiers originaux ci-dessous. Le benchmark complet reste P0 ; son résumé chiffré et les paramètres/limites sont inclus ci-dessus. Les corps de données personnelles ne sont pas nécessaires à cette campagne.

### lot13-validation.log

SHA256 `eae462c2164657f5e30526c835b0d6795c8a6459276c8748b187e4e60fcdfe42`

```text
✔ a supported paragraph plus an unsupported Notion task both survive normalization (87.697581ms)
✔ list and table residual markup is detected and cleaned without losing cell text (2.128028ms)
✔ two-column HTML tables become canonical typed table blocks (2.114818ms)
✔ nested Notion descendants, bookmarks and table descendants retain canonical content and source IDs (1.206203ms)
✔ adjacent ordered Notion items keep one continuous list and all source IDs (50.76973ms)
✔ legacy Advantest and partial scenario facts become numeric canonical metrics with source blocks (11.130838ms)
✔ scenario punctuation variants share valuation-summary extraction and normalize to equal numbers (6.303654ms)
✔ TL;DR tables remain visible in server-rendered analysis even when not summarized (12.075078ms)
✔ scenario table with an extra hypothesis column stays visible and is not promoted (7.627223ms)
✔ horizontal scenarios choose shareholder CAGR over EPS CAGR and retain dividend-inclusive values (1.036427ms)
✔ invalid legacy dates are diagnosed while the normalized contract stays valid (3.448262ms)
✔ unmapped runtime document categories retain their original family as unknown (0.714424ms)
✔ company preview keeps the reader summary and removes canonical body from serialized payload (19.33004ms)
✔ valid projection evidence hydrates canonical numeric metrics without copying evidenceIds into metric contracts (7.696797ms)
✔ absent, invalid, null, malformed and family-mismatched projections fall back to report content (4.999223ms)
✔ production reader renders the same business structure for distinct companies and keeps family compositions (59.007349ms)
✔ CIO memo reasoning keeps canonical links after API serialization (3.401602ms)
✔ CompanyAnalysisDocument accepts validated canonical API bodies and keeps stale content on refresh failure (7.061052ms)
✔ CompanyAnalysisDocument rejects wrong-ID or invalid canonical bodies and still accepts legacy text (5.609741ms)
✔ citation numbers and source list share the same sorted order (2.479687ms)
✔ Notion rich text annotations render emphasis without visible Markdown markers (13.5473ms)
✔ adjacent emphasis and malformed bold delimiters do not leak double asterisks (0.633763ms)
✔ supported HTML emphasis becomes semantic formatting without literal tags (0.604278ms)
✔ analysis reference registry covers the six canonical Notion templates (11.611971ms)
✔ TSMC and Advantest display fixtures preserve the reviewed valuation examples (1.598172ms)
✔ TSMC fixture values are extracted as scenarios and thresholds without changing their meaning (81.470679ms)
✔ runtime routes and package identity have no isolated legacy template remnants (4.253442ms)
✔ the unified renderer is the documented parser entry point (0.780924ms)
✔ the semantic template registry covers every company section (1.101916ms)
✔ valuation scenario extraction keeps terminal prices, CAGR and thresholds distinct (2.978577ms)
✔ metadata discovery queues only missing or edited Notion pages (1.713886ms)
✔ large Notion imports are durable, bounded and atomically published (2.389701ms)
✔ browser Notion surfaces preserve read-only data access except the dedicated owner-private refresh (8.595167ms)
✔ Notion webhook is authenticated, durable and coalesces on the latest page version (5.753797ms)
✔ app, document and market refreshes keep separate responsibilities (1.968489ms)
✔ portfolio keeps documentary freshness visible without redundant status cards (1.783791ms)
✔ Notion status panel exposes source freshness without manual mutation controls (1.865093ms)
✔ portfolio refresh uses structured properties without downloading page blocks (2.38856ms)
✔ trajectory reads both targets from Notion and keeps active positions outside target visible (1.987597ms)
✔ company ownership is projected from active positive Portfolio positions (0.959803ms)
✔ company directory derives membership only from explicit Notion relations (1.97624ms)
✔ browser history canonicalizes removed company tabs to Entreprises (0.728725ms)
✔ CIO verdict requires the linked Current validated Investment Memo (1.737557ms)
✔ Notion integrity audits explicit Watchlist relation cardinality and inverse status (1.072191ms)
✔ company detail stays dynamic instead of using the legacy Nebius cockpit (1.880201ms)
✔ earnings expose the five canonical refresh routes in the company design system (3.426825ms)
✔ two-column earnings tables prioritize result readability on mobile (1.922535ms)
✔ removed top-level analysis and search APIs have no worker routes (1.303174ms)
✔ archive policy keeps one latest document per company and section (0.678119ms)
✔ company fiches use primary ownership links while preserving secondary mentions (1.395537ms)
✔ company fiches resolve current analyses from canonical Companies relations (6.80685ms)
✔ company and analysis layouts preserve the Notion parser contract (5.079274ms)
✔ all canonical analysis families share one summary presentation contract (10.716265ms)
✔ analysis facts split only on explicit separators and preserve prose punctuation (11.413182ms)
✔ each canonical analysis family promotes only its decision-useful facts (3.772459ms)
✔ standard analyses and CIO memo reuse the shared hero and fact grid (5.169229ms)
✔ standard analysis hero uses concise titles and formats scores without a duplicate metadata grid (0.84548ms)
✔ analysis reader leads with editorial analysis and keeps sources after the report (1.56389ms)
✔ Investment Memo CIO has a dedicated decision view without a numeric memo score (1.76995ms)
✔ Notion tables use one adaptive reusable component (1.683781ms)
✔ analysis disclosures use the company width while keeping prose readable (5.919235ms)
✔ company summaries are segmented for a scannable mobile preview (0.455214ms)
✔ research copy uses the shared readable text token (5.538083ms)
✔ company directory keeps stable identities and accessible row actions (2.014408ms)
✔ Apple Light theme stays isolated from data and parser contracts (16.354539ms)
✔ Apple Light theme covers shared surfaces and aligns financial figures (14.35933ms)
✔ portfolio hides internal calculation and method panels (7.708014ms)
✔ shared UI primitives drive progress bars and segmented filters (17.32002ms)
✔ the company directory uses production discovery and search primitives (8.925273ms)
✔ UI-2 keeps the primitive manifest and unified company reference states (26.95559ms)
✔ research actions and coverage use the shared mobile UI primitives (8.333164ms)
✔ analysis and company details share the same liquid-glass primitives without table card nesting (19.1835ms)
✔ analysis section headings stay contained without an extra surface (9.543432ms)
✔ company list no longer includes Radar, analysis index or search page code (4.99645ms)
✔ portfolio exposure keeps ETF look-through and exclusive primary themes (4.996018ms)
✔ portfolio trajectories keep Notion targets and active positions isolated (1.300445ms)
✔ Run Receipt is hidden as a complete presentation section without mutating source blocks (19.679325ms)
✔ short analytical tables are not assigned horizontal scrolling solely by column count (1.507836ms)
✔ valuation promotion keeps JPY scenario and hurdle values once with source indexes (0.477868ms)
✔ promoted valuation tables hide only their duplicate data and empty headings (0.285379ms)
✔ company analysis labels stay short and numeric scores state their denominator (2.004923ms)
✔ valuation extraction recognizes explicit hurdle heading and reference market data (0.641043ms)
✔ valuation presentation extracts safe partial facts without hiding partial source blocks (0.541904ms)
✔ Amazon-style scenario prose keeps final punctuation, approximations, and shareholder CAGR distinct from EBIT CAGR (0.859641ms)
✔ Amazon Notion lines extract partial facts with exact source indexes and scenario word boundaries (0.420071ms)
✔ analysis sections render H1-only roots and retain Advantest H2/H3 content (57.376318ms)
✔ valuation presentation recognizes semantic row and column tables while rejecting unlabeled or currency-conflicted data (1.794467ms)
✔ company analysis route keeps the company shell mounted and presents the selected document inside its panel (3.117966ms)
✔ global surfaces use white content materials and shell has no blue radial canvas (2.767639ms)
✔ embedded company analysis fetches its full document instead of rendering the stripped company preview (1.553685ms)
✔ the company back button returns to the Companies list regardless of visited analyses (1.825603ms)
✔ CIO memo uses its human introduction instead of the technical handoff (36.139322ms)
✔ CIO memo humanizes a historical handoff only as a last resort (0.640963ms)
✔ other analysis families preserve their property-first fallback (0.707494ms)
✔ analysis summaries split sentence runs while preserving French abbreviations and decimal values (0.327833ms)
✔ demo company and research endpoints resolve only fictional demo ids (3.896446ms)
✔ LumaGrid demo has a linked, chronological five-part educational case (1.335246ms)
✔ demo portfolio relationships reconcile with demo companies and carry no live quotes (1.760406ms)
✔ demo basket data follows requested dimension, period, and selection (1.334946ms)
✔ public demo fixtures contain no personal Notion URLs (1.387535ms)
✔ transport import boundary and canonical discovery schemas (46.887054ms)
✔ unknown tools, invalid versions, invalid schemas, output schemas and scope (11.684411ms)
✔ auth excludes payload identity, cookies, bypass credentials and browser writes (1.604652ms)
✔ Sites WRITE is release-closed; transport fence admits only configured run IDs when explicitly authorized (4.249236ms)
✔ permissions, scope isolation, mutation confirmation and unauthorized never reach Core (3.749665ms)
✔ all eight mappings execute existing Core with exact arguments and preserve diagnostics (29.588758ms)
✔ Core errors are typed and raw dependency exceptions never escape (2.373647ms)
✔ text-only hosted consumers receive typed Core errors without dependency secrets (1.014535ms)
✔ fiscal labels in canonical asOf fail Core validation before the writer (3.352428ms)
✔ 2 MiB streamed/declarative requests and 4 MiB output limits fail without truncation (25.362666ms)
✔ READ and WRITE 30s deadlines preserve unknown outcome and fence pending WRITE (16.845597ms)
✔ demo six reads use snapshot Core and never invoke personal service (89.183601ms)
notion_request_rejected { status: 403, type: 'unknown', code: 'unknown', validation: [] }
notion_request_rejected { status: 403, type: 'unknown', code: 'unknown', validation: [] }
✔ local runtime: SDK client initialize/discover, real adapter WRITE receipts/replay/conflict (1319.257531ms)
✔ completed transient READ retries at most twice; WRITE never retries a Core error (254.366548ms)
✔ READ backoff cannot start a second Core call after its deadline (1.773064ms)
✔ 2 MiB tool arguments are accepted independently of JSON-RPC framing (29.749487ms)
✔ callout semantic verification null -> 💡 (216.436458ms)
✔ callout semantic verification 🔥 -> 🔥 (63.933043ms)
✔ callout semantic verification 🔥 -> 💡 (25.662707ms)
✔ exact AN-598 payload with provider callout icon reaches persisted journal, D1 and immediate readback (107.004989ms)
✔ callout without icon omits icon entirely (35.873843ms)
✔ callout with emoji preserves the Notion icon DTO (13.233703ms)
✔ Notion rejection diagnostics retain structural validation paths without echoed payload or secrets (11.001944ms)
✔ nominal save re-reads Notion and verifies the server-assigned identity through Core (26.70957ms)
✔ creation accepts a canonical intent identity without requiring a physical Notion UUID (9.807419ms)
✔ same run re-reads actual state without duplicate or repeat promotion (9.734279ms)
✔ validated save indexes the promoted Current relation without rebuilding unrelated links (10.920943ms)
✔ incompatible same run conflicts before another create (9.820358ms)
✔ stale expectedRevision cannot mutate an existing analysis (28.988315ms)
notion_request_rejected { status: 404, type: 'unknown', code: 'unknown', validation: [] }
✔ Company absent fails before persistence (14.049695ms)
✔ inconsistent input Company relation is rejected before mutation (11.165249ms)
notion_request_rejected { status: 403, type: 'unknown', code: 'unknown', validation: [] }
✔ persistence OK / promotion KO returns resumable pending and safely resumes (14.348123ms)
✔ promotion OK / final verification KO never returns verified (6.503755ms)
✔ ambiguous create timeout reconciles Run ID before any mutation retry (6.402612ms)
✔ ambiguous promotion reconciles Company rather than blindly repeating PATCH (6.641231ms)
notion_request_rejected { status: 429, type: 'unknown', code: 'unknown', validation: [] }
✔ rate limited mutation is attempted once and does not certify persistence (11.768406ms)
✔ wrong final Current returns partial, never verified (8.738533ms)
✔ concurrent same-run writers share the D1 lease and create at most one page (9.862922ms)
✔ metadata update checks source revision and preserves the existing report body (12.175558ms)
✔ position reads source lifecycle: open, closed, absent, inconsistent and invalid (7.467582ms)
✔ unresolved ambiguous create is fenced across replays, not blindly retried (5.367707ms)
✔ Draft persistence is readable through MCP Core without promoting Current (5.652685ms)
✔ Draft save and replay update only their page indexes and avoid a second create (5.98193ms)
✔ adapter canonicalizes dashed update identity before receipt validation (19.225929ms)
✔ long report is written in bounded chunks and completely re-read before verified (43.011705ms)
✔ long Draft certifies the final append with a complete read without a redundant full scan (14.796668ms)
✔ long Draft cannot certify content changed during the final append read (15.98291ms)
✔ ambiguous append reconciles the exact block prefix without duplicating content (12.488799ms)
✔ lost D1 lease is detected before a Current mutation (10.05427ms)
✔ production shared Run ID remains idempotent independently for Business and Valuation modules (11.286261ms)
✔ physical Company must be a relation; schema mismatch cannot yield verified (2.270563ms)
✔ production source without a Summary property preserves the canonical summary in the report body (5.286475ms)
✔ Company archived during final verification cannot yield verified (4.916438ms)
✔ revisioned update cannot retype a Business Current page as Valuation (5.633326ms)
notion_request_rejected {
  status: 400,
  type: 'error',
  code: 'validation_error',
  validation: [ { path: 'body.children[6].callout.icon', expected: 'object' } ]
}
✔ provider diagnostic survives the adapter Core bridge without sensitive content (3.608823ms)
✔ provider rich-text-array limit rejects before a mutation (3.326559ms)
✔ provider table-children limit rejects before a mutation (2.628641ms)
✔ provider link-url limit rejects before a mutation (2.124443ms)
✔ provider utf8-size limit rejects before a mutation (4.645271ms)
✔ supported block DTOs omit absent optional values while nullable properties remain valid (6.835743ms)
✔ plugin domain challenge is public and does not touch private adapters (318.800813ms)
✔ all Notion mutation routes reject anonymous browser requests (2.414649ms)
✔ anonymous callers always use the demo scope, even with a forged personal cookie (4.106111ms)
✔ owner identity comes only from the Sites authenticated email header plus server configuration (0.841074ms)
✔ image optimizer cannot proxy API routes or arbitrary static paths (0.678289ms)
✔ owner must explicitly select personal scope and the preference is an HttpOnly cookie (0.584428ms)
✔ all Notion mutation routes reject an incorrect bearer token (0.736968ms)
✔ mutation routes fail closed when the server authorization secret is not configured (1.12499ms)
✔ a server bearer token passes the auth gate before route validation (0.417588ms)
✔ webhook verification never exposes its stored token (0.429165ms)
✔ signed Notion webhook payloads remain verifiable (11.507759ms)
✔ browser Notion surfaces never expose server mutation secrets or internal sync routes (4.169837ms)
✔ manual document refresh requires owner scope and remains same-origin only (1.241015ms)
✔ refresh controls keep distinct responsibilities (3.572709ms)
✔ private analysis storage failures return a safe correlated diagnostic (2.729291ms)
✔ normalizer exceptions are tagged safely at the document mapping boundary (202.20432ms)
✔ simultaneous consumers and quick return reuse one request (6.674491ms)
✔ failed refresh retains the previous data and retry clears the error (5.665294ms)
✔ background basket refresh keeps the cached snapshot until refresh=1 fails or completes (1.740095ms)
✔ basket manual refresh forces Yahoo without changing portfolio refresh URLs (1.982769ms)
✔ Notion invalidation during a pending request discards the obsolete response (0.982747ms)
✔ manual quote refresh queued during a normal read keeps refresh=1 (1.09763ms)
✔ session expiration clears all resources and ignores late old-session responses (1.039091ms)
✔ inactive views invalidate without eagerly refetching (0.559932ms)
✔ browser Notion client only reads public status (16.515019ms)
✔ missing Notion summary is safe (14.235054ms)
✔ company preview retains the exact late TLDR while removing full report bodies (53.614134ms)
✔ company previews remain lightweight while their analysis ids resolve to complete demo documents (38.45382ms)
✔ service worker caches static assets only and never substitutes HTML for failed assets (7.163235ms)
✔ D1 company and document reads load only scoped report bodies and preserve legacy selection (94.735284ms)
✔ integrity presentation reads retain complete block and projection diagnostics (96.691604ms)
✔ accepts only a captured projection with resolved freshness checks and exact numeric support (36.822309ms)
✔ rejects stale or malformed metadata and future timestamps deterministically (6.446488ms)
✔ projection is absent without the exact marker and invalid on duplicates or bad JSON (12.056279ms)
✔ machine payload is excluded from the human-facing Notion body (3.26709ms)
✔ provider children normalize once into the imported snapshot shape without changing other blocks (1.5508ms)
✔ clearing the client cache aborts in-flight requests and removes scoped snapshots (20.828132ms)
✔ analysis HTTP and response failures retain stale data with typed diagnostics (14.090335ms)
✔ network failures are classified and authorization failures purge every cached response (3.919521ms)
ℹ tests 199
ℹ suites 0
ℹ pass 199
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2353.893412

```

### lot13-typecheck.log

SHA256 `d796c4dedf630c2dead83b0f3b3ee01dcb5c21bad7ce50dd1af45c299ae2bb31`

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> investment-os@0.1.0 typecheck
> tsc --noEmit --pretty false


```

### lot13-build.log

SHA256 `052a12c5cd5a99772eb5b0ae0b1ee712780439765b05faacea181c9a23986b95`

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> investment-os@0.1.0 build
> bash scripts/build-verified.sh

/usr/bin/timeout
Running bounded vinext build...

  vinext build  (Vite 8.0.13)

[33m▲ [43;33m[[43;30mWARNING[43;33m][0m [1mProxy environment variables detected. We'll use your proxy for fetch requests.[0m


[1/5] analyze client references...
[2K
transforming...✓ 322 modules transformed.
rendering chunks...
✓ built in 754ms
[2/5] analyze server references...
[2K
transforming...✓ 142 modules transformed.
rendering chunks...
✓ built in 162ms
[3/5] build rsc environment...
[2K
transforming...✓ 397 modules transformed.
rendering chunks...
computing gzip size...
✓ built in 855ms
[4/5] build client environment...
[2K
transforming...✓ 150 modules transformed.
rendering chunks...
computing gzip size...
✓ built in 239ms
[5/5] build ssr environment...
[2K
transforming...✓ 148 modules transformed.
rendering chunks...
computing gzip size...
✓ built in 302ms
[0m
  Route (app)
  ─ ? /

  ? Unknown

  ? Some routes could not be classified. vinext currently uses static analysis
    and cannot detect dynamic API usage (headers(), cookies(), etc.) at build time.
    Automatic classification will be improved in a future release.

  Build complete. Run `vinext start` to start the production server.

Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.

```

### lot13-artifact.log

SHA256 `61408fa5ba74dc658545f50b2ff5d577fc75f76c20777a34f2a135132268bf29`

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> investment-os@0.1.0 validate:artifact
> bash scripts/validate-artifact.sh

Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.

```

### lot13-mcp-runtime.log

SHA256 `cdbc0e60fdb28241f10751357393a3afe4339c8059b4fab339aa7dc757a29004`

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> investment-os@0.1.0 verify:mcp-runtime
> node scripts/verify-mcp-runtime.mjs

resolve_company: PASS 13ms
get_company: PASS 54ms
get_portfolio: PASS 11ms
get_position: PASS 8ms
get_current_analysis: PASS 18ms
get_analysis_by_id: PASS 12ms
get_quote: PASS 7ms
workerd: initialization/discovery, identity resolution, 6 demo READ, auth, release-closed WRITE, version, browser boundary PASS
catalog JSON bytes: 645741

```

### lot13-secret-scan.json

SHA256 `a12ac06c09d51010d3cd47f17fe0b28896a7b7831534d34bf8f17f4c36df7da4`

```text
{
  "scope": "tracked current tree only; recognized token/private-key patterns, not history or exhaustive credential detection",
  "files": 198,
  "findings": []
}
```

Benchmark complet P0 : SHA256 `0a2527bb3a1d262f2f692722dd3347eb1b510a8d6489371d6addb43e2011565e`.

READ hébergé P3 (données fictives, enveloppe résumée) :

```json
{
  "request": {
    "contractVersion": "1.0.0",
    "scope": "demo",
    "options": {
      "cacheOnly": true
    }
  },
  "durationMs": 473,
  "contractVersion": "1.0.0",
  "scope": "demo",
  "status": "completed",
  "resultStatus": "ok",
  "positions": 3,
  "allPositionIdsDemo": true,
  "structuredJsonBytes": 5975,
  "initialInputError": {
    "contractVersion": "1.0.0",
    "scope": "demo",
    "status": "rejected",
    "error": {
      "code": "invalid_input",
      "message": "Paramètres transport invalides.",
      "retryable": false,
      "outcome": "not_started"
    },
    "diagnostics": [
      {
        "code": "input_schema",
        "message": "Paramètres transport invalides.",
        "severity": "error"
      }
    ],
    "error_code": "INVALID_ARGUMENT"
  }
}
```
