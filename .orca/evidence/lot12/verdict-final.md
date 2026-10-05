# Verdict final Lot 12 — PARTIAL / NO-GO

Date : 2026-10-05. Aucun Lot 13 commencé.

## État livré

Sites v227 confirmé succeeded, env11, commit b38c825316ac4f209a214495b6a17bb072648792. WRITE verrou source false, flags supprimés; refus forbidden/not_started prouvé après fermeture. URL : https://investment-os.erwancognee94.chatgpt.site . Plugin privé Investment OS Perso 1.3.9 publié, permission Read, public Investment OS Analysis 1.3.0 intact.

resolve_company ajouté au Core/adapters et catalogue MCP : ticker, nom, alias; ambiguous explicite et multi-market, filtre market; not_found sans création. Réutilisation des primitives de normalisation/catalogue existantes; aucun mapping de sociétés codé en dur.

## Preuves des trois workflows

### Business Microsoft — BUSINESS-MSFT-20261005
resolve_company → get_company(id) → get_current_analysis(business). Société 3b337ea7af3581038c01ec1b0f33d8c4, MSFT/NASDAQ. Rapport Full observé après correction du rendu et Evidence Ledger/Gate, puis intention Draft originale validée isAnalysis et entrée Core.saveAnalysis en fixture locale. Un bloc contient le rapport complet, ce n’est pas un rapport tronqué. Aucun save réel ni receipt. Analyse READ PASS; preuve end-to-end incluant persistance PARTIAL.

Conversation : https://chatgpt.com/c/6ac35884-ce50-83eb-b97c-05a7525ab183

### Full Value LITE — FV-LITE-20261005-1013
resolve_company → get_company(companyId) rejet client → get_company(id) corrigé → get_quote → Current Business/Valuation → get_analysis_by_id(Valuation). Company 3b537ea7af358169b697e2d437379f51. Company/quote/handoff Business réutilisés, pas de portfolio/position. Deux rapports complets, 62 et95 blocs dans l’artefact final.

Une seule tentative save_analysis Business, allowlist runId exacte, aucun retry. Payload envoyé contenait asOf FY2026 / Q4 FY2026 invalides : Core rejette avant writer. Erreur client INVALID_ARGUMENT, aucun receipt/revision/ID Notion. Valuation non soumise. WRITE immédiatement fermé. Cause du message tronqué corrigée : erreurs Core intégrales dans le text MCP. Aucune nouvelle page identifiée, pas de nettoyage supplémentaire, Current inchangés.

Fichier téléchargé corrigé par l’hôte : dates corrigées mais sourceIds de tous les blocs vides, donc Core invalid_input. Copie locale réparée : sourceIds dérivés identifient exactement le bloc de l’artefact original SHA256; ils ne prouvent aucune donnée financière. isAnalysis et entrée Core acceptées, sans accès Notion. Evidence Gate reste PARTIAL : segments Q4, certaines marges historiques,1060nm VCSEL, EPS Q4/guidance Q1, actions diluées FY26, consensus FY27 sans locators suffisants. Pas de nouvelle mutation/retry.

Conversation : https://chatgpt.com/c/6ac35c33-d4f0-83ed-9d54-e806802f13fd

### Full Analyse NVDA — NVDA-FA-20261005-1021
resolve_company → Company/contexte/quote/portfolio/Current → Business → Valuation → Short → Portfolio Fit → CIO. Archives Valuation/Short hydratées. Company 3b337ea7af35811eb7e5e934f832c389; get_company(id) READ correct réellement effectué et conservé après perte de la première trace. Pas de get_position nécessaire : snapshot déjà chargé. Des lectures répétées quote/portfolio/Current ont eu lieu après réponses volumineuses et compaction, dette de réutilisation.

Cinq outputs complets réellement matérialisés,50/53/55/51/54 blocs. Tous leurs Evidence Gates PARTIAL : couverture atomique incomplète; consensus hérité; champs de scénarios manquants; borrow/options/séries indisponibles; exposures ETF datées et concentrations non calculées. L’absence de projection n’est pas à elle seule une invalidité canonique : projection absent est autorisée.

Original téléchargé : sourceIds vides, conversation:// href interdits, score:null illégal sur Short/Portfolio/CIO, decision au mauvais type et scénarios CIO référencés vers blocs Valuation étrangers. Copies réparées sans changements de texte/valeurs financiers : liens visibles conservés, href retirés; origine documentaire dérivée; champs null obsolètes retirés; décision d’origine conservée en sidecar; handoffSummary copié du handoff existant c53; refs scénarios c17. Les cinq entrées passent désormais isAnalysis et Core local. Ces réparations externes ne prouvent pas une exécution autonome canonique du Skill. Aucun SAVE/receipt/relecture nouvelle analyse.

Conversation : https://chatgpt.com/c/6ac35e0c-43ac-83eb-b442-ac0744aeec44

## Matrice finale

Abréviations : R resolve_company, C get_company, U get_current_analysis, A get_analysis_by_id, Q get_quote, P get_portfolio, Pos get_position, S save_analysis. R s’applique au nom/ticker fourni; handoffs/contextes du même run sont réutilisés. S est toujours conditionnel à une intention et un runtime autorisés; receipt + relecture obligatoires alors. Tous les plans arrêtent/clarifient ambiguous, ne créent pas sur not_found, rapportent forbidden/timeout sans fallback infra ni retry mutation.

| Skill | R utilisé | Requis dans l’ordre | Conditionnels | Infra résiduelle | Identité | Persistance | Workflow complet | Action restante |
|---|---|---|---|---|---|---|---|---|
| Business | Oui, Microsoft | R,C,U Business | A,S | Aucune active | PASS | PARTIAL | PARTIAL (READ PASS) | SAVE exact puis receipt/relecture si autorisé |
| Earnings | Oui dans plan; run non testé | R,C | U familles concernées,A,S | Aucune active | PARTIAL | PARTIAL | PARTIAL | Exécution autonome et preuve éventuelle SAVE |
| Fair Value | Oui via Full Value/Analyse | R,C,Q si assetId; handoff Business | U,A,S | Aucune active | PASS | PARTIAL | PARTIAL | Combler Evidence Gate et sérialiser dans Skill |
| Short | Oui, contexte NVDA réutilisé | R,C | U,Q,A,S | Aucune active | PASS | PARTIAL | PARTIAL | Evidence Gate + output canonique sans réparation externe |
| Portfolio Fit | Oui, contexte NVDA réutilisé | R,C,P ou snapshot fourni | Pos,Q,U,A,S | Historique borné au provider choisi | PASS | PARTIAL | PARTIAL | Gate exposition/evidence + output canonique |
| Memo CIO | Oui, contexte NVDA réutilisé | R,C,quatre handoffs | U,A,P,Q,S | Aucune active | PASS | PARTIAL | PARTIAL | Gates amont + champs et refs locaux canoniques |
| Full Value | Oui, LITE | R,C,Q si nécessaire; Business→Valuation | U,A,S par output | Aucune active | PASS | FAIL tentative; preuve globale PARTIAL | PARTIAL | Sources manquantes + SAVE/relectures après décision nouvelle |
| Full Analyse | Oui, NVDA | R,C,P ou snapshot,Q si nécessaire; cinq modules | Pos,U,A,S par output | Aucune active | PASS | PARTIAL | PARTIAL | Gates, réutilisation, sérialisation native puis SAVE/relectures |
| Setup | Conditionnel société; run non testé | READ diagnostic requis; R,C si société | P,Pos,U,A,Q; pas S en diagnostic READ | Docs providers historiques légitimes | PARTIAL | PARTIAL (READ sans persistance requise) | PARTIAL | Diagnostic autonome à exécuter |

PASS identité des modules composites signifie identité canonique obtenue une fois et réutilisée, pas nouveau resolve à chaque module. PARTIAL pour run absent n’est pas un échec du resolver.

## Audit et stabilité

Supprimés/remplacés dans les plans actifs : accès Notion/D1, noms physiques de propriétés/bases, mapping Company/Analysis, sélection Current/dernière analyse, reconstruction portefeuille, normalisation physique quote, écriture directe et retry mutation. Méthodes/calculs/fraîcheur demeurent légitimes. Setup providers historiques est légitime seulement sur choix explicite; formulations cold-start historiques restent ambiguës mais bornées par le contrat MCP. Neuf copies du contrat partagé sont une dette documentaire, actuellement identiques et testées.

Comparaison 1.3.0→actuel qualitative seulement, source1.3.0 non disponible pour mesure exacte : responsabilités infra déplacées vers Core/adapters, plans explicites et plus stables face au backend.20 fichiers méthodes/frameworks/playbooks inchangés byte-for-byte depuis1.3.4, seuils/scores/critères non modifiés. Les runs ont montré un risque réel d’interprétation libre (résumés initialement COMPLETE, sérialisation fautive); les gates renforcées préviennent les faux GO mais n’ont pas encore prouvé une autonomie complète.

## Tests et verdicts

- Tests globaux282/282 PASS (baseline276); typecheck/build inclus, aucune régression.
- MCP ciblés25/25 PASS après dernière assertion positive asOf:null; resolver ambiguous/not_found/multi-market couvert par tests Core/MCP/adapters.
- Plugin1.3.9 PASS :9 plans/références,8 contrats identiques,2 locks,20 empreintes financières.
- READ PASS. resolve_company PASS. WRITE historique prouvé, production fermée PASS.
- Business E2E PARTIAL (READ analytique PASS). Full Value E2E PARTIAL. Full Analyse E2E PARTIAL.
- Dette résiduelle PARTIAL : Evidence Gates, génération canonique native, doublons documentaire/lectures, tests autonomes Earnings/Setup, absence de receipts et relectures des outputs nouveaux.

La phrase de gate globale n’est PAS démontrée. Verdict Lot12 PARTIAL / NO-GO. Les réparations locales sont reviewables, pas des receipts. Une nouvelle tentative WRITE ne doit pas être automatique : avant décision explicite, il reste à combler les preuves financières et à faire produire des payloads canoniques par les Skills. Lot13 non démarré.
