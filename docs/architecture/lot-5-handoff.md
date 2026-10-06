# Passation Sol — Lot 5 : Investment OS / Architecture Stabilization

Établie le 30 septembre 2026 après le GO Lot 4.1. Ce document est le point de reprise, pas une nouvelle architecture. Le commit qui l’introduit constitue le checkpoint local Lots 4–4.1. Ne pas commencer les Lots 6 et suivants.

## Consigne de reprise

Tu es Sol, planner, orchestrateur et reviewer. Les agents Luna implémentent les tâches bornées et factuelles ; garde les décisions structurantes, la revue des diffs et le verdict final. L’utilisateur demande le Lot 5 : retirer uniquement le code remplacé sans consommateurs et les symboles morts prouvés. Ne pas rejouer le Lot 4 ni recréer son panel complet sans changement qui le justifie. Mobile first : 360×800 et 390×844. Aucune suppression massive avant preuve et revue.

## Sources à lire dans cet ordre

1. `AGENTS.md` : source Sites, modifications minimales, recherche des consommateurs, tests proportionnés et Storybook utilisant les composants de production.
2. `docs/architecture/baseline.md` : baseline Sites, runtime, mesures et limites reproductibles.
3. `docs/architecture/debt-map.md` et, au besoin, `debt-evidence.json` : preuves du Lot 1 ; les numéros de lignes sont historiques, retrouver les symboles actuels.
4. `docs/architecture/target-architecture.md` : cible Lot 2, checkpoint Lot 4, revue NO-GO historique puis clôture Lot 4.1 qui la remplace.
5. `docs/architecture/domain-contracts.md` : contrats Lot 3 et politique Current.
6. `docs/architecture/codex-cloud-environment.md` : runtime Cloud et échec CSS préexistant.
7. Ce document puis le code actuel et le diff du checkpoint. Ne pas implémenter sur la seule mémoire conversationnelle.

## Projet et état Git à la passation

- Checkout de travail : `/Users/ec/Documents/ChatGPT/Investment OS - APP/investment-os-stabilization` (le dossier parent n’est pas la racine du repo).
- App : https://github.com/erwancgn/investment-os ; remote `origin`.
- Branche : `chore/architecture-stabilization-mcp` ; rester dessus, ne pas basculer sur main.
- HEAD et référence locale origin avant le checkpoint : `0f9752f3d8a1e05290a733607e7cd0bcd4566c09`.
- Baseline restaurable : tag `pre-architecture-stabilization`, commit `730d1b291fa064f537f26e9e4ef840822e65fafa`.
- Les changements Lots 4–4.1 sont inclus dans le commit qui ajoute cette passation. Retrouver son SHA avec `git log -1 --format=%H -- docs/architecture/lot-5-handoff.md`; vérifier l’état vivant avant toute action.
- Le checkpoint local n’est pas une preuve de push, d’alignement Cloud ou de publication Sites. Si reprise depuis GitHub/Cloud, transporter ce commit et vérifier le même HEAD avant le Lot 5. Ne jamais remplacer les changements locaux par un checkout périmé.

Fichiers Lots 4–4.1 présents avant ajout de la passation (M = modification suivie, ?? = nouveau fichier permanent) :

```text
 M app/components/analysis-presentation.tsx
 M app/components/analysis-reader.tsx
 M app/components/analysis-section-groups.tsx
 M app/components/investment-memo-reader.tsx
 M app/components/latest-info-card.tsx
 M app/components/notion-table.tsx
 M app/components/scenario-comparison.tsx
 M app/lib/company-preview.ts
 M app/lib/document-presentation.ts
 M app/lib/inline-format.ts
 M app/lib/investment-data.ts
 M app/lib/notion-block-parser.ts
 M app/lib/notion-renderer.ts
 M app/lib/valuation-summary.ts
 M core/contracts/analysis.ts
 M docs/architecture/target-architecture.md
 M package.json
 M stories/Reader.stories.tsx
 M tests/analysis-reference-fixtures.test.mjs
?? app/lib/inline-segments.ts
?? tests/analysis-canonical-renderer.test.mjs
```

## Historique et décisions acquises

- Lot 0 : rapprochement exact Sites v207 / GitHub, baseline et références mobile. Commit `8f17952` documente la baseline, après `730d1b2` de rapprochement. Pas de refactor ni publication.
- Lot 1 : debt map et consommateurs vérifiés, commit `ae8d566`. Aucun parser/renderer/fichier CSS entier prouvé mort.
- Lot 2 : cible et gates, commit `50bdb1c`. Un normalizer et un corps de rendu partagé, variantes par famille métier ; pas de logique par ticker. Deux formats sources actifs à conserver.
- Lot 3 : contrats de domaine versionnés et sélection Current déterministe, commit `acacee9`. La politique Current est pure et n’a pas été branchée globalement aux adapters. Ne pas prétendre que les services Core/MCP sont déjà livrés.
- Lot 3.5 : environnement Cloud réutilisable rattaché au repo, root et branche conformes ; Node 22.23.1/npm 11.9.0, typecheck/build/artefact PASS. Suite agrégée 18/19 fichiers, échec CSS ownership uniquement. Node 24 a été testé historiquement, le runtime actif reste Node 22.
- Lot 3.5b : diagnostic uniquement, sous-processus Node avec sorties vides dans Cloud ; fixtures directes shell conformes, mécanisme système exact non établi. Test/audit identiques à baseline. Trois artefacts ponctuels supprimés, aucun conservé, zéro ligne nette ajoutée, aucun contournement. Ne pas recréer ces sondes.
- Gate avant Lot 4 : les documents Lots 2/3.5 ont été commités/poussés sous `0f9752f`; local et Cloud propres au même HEAD à ce moment.
- Lot 4 : convergence du rendu et validation décrites ci-dessous. Revue stricte initiale NO-GO : lien CIO perdu dans le raisonnement et capture Portfolio 360 montrant un spinner.
- Lot 4.1 : Luna a corrigé uniquement le raisonnement CIO, Sol l’a revu ; trois tests ciblés, typecheck, build direct et deux vérifications visuelles passent. Spinner Portfolio = chargement Storybook transitoire ; aucune modification Portfolio. Verdict final : GO Lot 5.

## Architecture réellement obtenue

`CompanyDocument brut → normalizeAnalysisDocument → Analysis validé (contrat Lot 3) → ViewModel → AnalysisReader → AnalysisBlockBody`.

- `app/lib/document-presentation.ts` : normalizer existant, contrat/VM validés ; dérive résumé, faits, scénarios, décision et raisonnement. Les blocs du raisonnement CIO restent des `AnalysisBlock[]`, pas des chaînes aplaties.
- `app/lib/notion-renderer.ts` / `notion-block-parser.ts` : dispatcher `parseNotionDocument`, formats HTML/Markdown historique et blocs Notion structurés ; conversion `canonicalAnalysisContent`.
- `app/lib/inline-segments.ts` : extraction pure de la syntaxe inline existante, sans React ; `inline-format.ts` rend les segments typés. Ce n’est pas un second parser documentaire.
- `app/components/analysis-reader.tsx` : entrée et composition standard ; `investment-memo-reader.tsx` : composition CIO/Decision Card/modules et même `AnalysisBlockBody`, y compris « Raisonnement décisif ».
- `analysis-presentation.tsx`, sections, tables, scénarios : corps canonique partagé et composants existants.
- `app/lib/investment-data.ts` : normalisation documentaire serveur ; retire corps brut/blocs/projection redondants quand le modèle normalisé est envoyé.
- `app/lib/company-preview.ts` : utilise le même normalizer, réponses sans corps ; ce lot ne prouve aucune optimisation SQL ni cache persistant.
- `core/contracts/analysis.ts` : imports runtime `.ts`, pas de nouvelle méthodologie.
- Aucun renderer de document ou parser concurrent ; aucun `if ticker/company` ; compositions métier standard/CIO nécessaires.

## Suppressions du Lot 5 : preuve avant action

Déjà prouvés morts aux Lots 1–2, à recontrôler dans l’état vivant :

- `readNotionStatus` dans `app/lib/client-resource.ts` (ancien helper de quatre lignes).
- `NotionRelationRow` dans `app/lib/notion-sync.ts` (ancien type d’une ligne). Suppression du type seulement, pas de travail sync/Notion.

À examiner, jamais considérés morts par défaut : wrappers `inline()` dans les deux lecteurs, helpers de date et union legacy de sections. Un doublon encore appelé exige migration ciblée avant retrait ; ne pas créer un helper supplémentaire pour économiser quelques lignes. `shortDate` reste notamment présent dans `company-detail.tsx` : ce n’est pas une preuve de suppression.

À garder tant que leurs consommateurs existent : `RenderBlock`, `parseNotionDocument`, les deux lecteurs de format, `documentPresentation`, `extractValuationSummary`, les contrats/projections et leurs notices, sources et fallback. Les anciens corps JSX Standard/CIO ont déjà été remplacés au Lot 4 : ne pas inventer une seconde vague de suppressions de lecteurs entiers.

Pour chaque candidat : rechercher références/imports/réexports, routes et usages dynamiques, déterminer si remplacement effectif, migrer seulement si nécessaire, relire le diff puis vérifier les consommateurs. Un comptage regex ou zéro import isolé ne suffit pas. Ne pas supprimer tests, fixtures ou preuves parce qu’ils n’ont pas de consommateur produit.

## Validation acquise et limites

Lot 4 : 202/202 assertions Node PASS dans une copie sans espaces, typecheck, build direct, validation d’artefact et lint ciblé PASS. Panel : Advantest Valuation v9 (24/09), Nebius Q2 2026 (13/08), Booking Short historique v1 (11/08), TSMC Valuation v16 (22/09), NVIDIA Business v5 détenue mais Superseded (07/09), Advantest CIO historique (07/08). Exports réels HTML/Markdown ; blocs structurés et projections couverts par fixtures SSR. Sections repliées/dépliées et largeur vérifiées à 360/390. Aucun test sur téléphone physique.

Portfolio/Basket : composants de production en stories ; IA : recherche démo NVIDIA, Valorisation et aperçu prompt dans l’app Vite réelle à 360/390. Story Shell/IA bloquée par `process is not defined` dans `next/image`, configuration inchangée. Pas de publication ni validation post-déploiement.

Lot 4.1 :

```bash
node --test --test-name-pattern='CIO memo reasoning|production reader renders|company preview keeps' tests/analysis-canonical-renderer.test.mjs
npm run typecheck
bash scripts/sites-env.sh -- node_modules/.bin/vinext build
```

Trois tests ciblés PASS. Nouveau SSR : lien CIO conservé après sérialisation JSON/API, même lorsque corps sources retirés. Fixture Memo existante avec lien synthétique `https://example.com/annual-report`, pas de nouvelle story ni composant. CIO et Portfolio 360 px chargés, largeur documentaire 360 px. Captures ignorées Git : `outputs/lot41/cio-reasoning-360.png`, `outputs/lot41/portfolio-360.png`. Aucun réaudit panel/Basket/IA au Lot 4.1.

Limites à reporter honnêtement :

- macOS : `npm test`/`npm run build` wrapper exige GNU `timeout` absent (exit 69) ; build direct validé, ne pas revendiquer wrapper PASS.
- Chemins avec espaces : test historique basé sur `URL.pathname` laisse `%20` ; copie de validation `/private/tmp/investment-os-lot4-validation`, dépendances existantes réutilisées sans installation. Cette copie est temporaire, peut disparaître ou être périmée ; vérifier les sources avant réutilisation.
- Cloud : échec CSS ownership préexistant distinct des résultats locaux ; ne pas modifier `tests/audit-css-ownership.test.mjs` ni contourner le runtime.
- Lint global : dette baseline documentée ; lint ciblé PASS ne signifie pas lint global PASS.
- SHA-256 lockfile : `b8a15bf6f414fc6d3ca7690e0e8724193f881c9cdc3c5bb9e7ec08309ef637f6`.
- SHA-256 test CSS : `83efc331146cb7bec8db1cffe6a0e97b798a6c8c4fbeb3f62f49babfc0de0163`.

## Environnements et production

Cloud de référence : tâche `01a0f258-5242-75e7-b555-bcf6b76a705f`, root `/workspace/investment-os`, Node 22.23.1/npm 11.9.0. L’alignement historique sur `0f9752f` ne contient pas le checkpoint local Lots 4–4.1 ; vérifier et synchroniser avant d’utiliser Cloud pour Lot 5. Ne pas recréer d’infrastructure.

Local : Node 22.23.1/npm 10.9.8. Storybook a servi la validation Lot 4.1 sur 6007 car 6006 était occupé ; ne pas supposer qu’un serveur encore vivant sert les sources actuelles.

Dernière production vérifiée : Sites v207, commit `bf77b919705127e42f880ca6d0785db4feffab85`, projet `appgprj_6a7d7a1233a08191a8d35b746b284e95`, URL https://investment-os.erwancognee94.chatgpt.site. Elle exécute encore la baseline, pas le Lot 4. Respecter AGENTS : ne pas écraser un changement Sites ultérieur avec GitHub. Vérifier tout écart vivant avant synchronisation/publication ; aucune publication implicite dans le GO Lot 5.

Plugin : https://github.com/erwancgn/plugin-investment-os, non modifié. Notion et Lovable étaient fournis comme contexte, leur accès dans une nouvelle conversation doit être vérifié si nécessaire ; aucun travail Supabase/MCP/plugin au Lot 5.

## Déroulement et sortie attendus

1. Vérifier checkout/branche/HEAD/status, lire les sources ci-dessus et préserver le checkpoint.
2. Définir une liste courte des suppressions avec preuves de consommateurs. Déléguer les tâches bornées à Luna ; Sol décide et revoit.
3. Implémenter les seuls retraits démontrés, sans redesign, dépendance, nouveau parser/renderer, nettoyage massif, changement de méthodologie, SQL/cache/auth ou contournement CSS.
4. Lancer tests des consommateurs concernés, typecheck/build et audits existants si touchés. Vérification visuelle mobile seulement si rendu ou composants partagés concernés ; ne pas rejouer tout le panel par réflexe. Tests complets si l’étendue effective le justifie, avec limites runner explicites.
5. Livrer : suppressions avec preuves, fichiers gardés et raison, lignes ajoutées/supprimées/nettes, tests, risques/régressions, `git status`, `git diff --stat`, verdict motivé GO/NO-GO Lot 6. Arrêt pour revue, aucun Lot 6 automatique.

## Prompt à coller dans la nouvelle conversation

> Reprends le chantier Investment OS au Lot 5 depuis le checkout `/Users/ec/Documents/ChatGPT/Investment OS - APP/investment-os-stabilization`, branche `chore/architecture-stabilization-mcp`. Lis `docs/architecture/lot-5-handoff.md` puis les sources qu’il indique. Réconcilie l’état Git vivant et le checkpoint avant de modifier. Les Lots 4–4.1 sont validés, GO Lot 5 ; les anciens NO-GO sont historiques. Tu es Sol, planner/orchestrateur/reviewer, Luna implémente les tâches bornées. Retire uniquement le code remplacé sans consommateurs et les deux symboles morts prouvés, après recherche des références. Garde les deux formats sources et les adaptations encore appelées. Respecte les contraintes et limites de validation de la passation, mobile first. Ne rejoue pas le Lot 4, ne contourne pas le test CSS Cloud, ne déploie pas et ne commence pas le Lot 6. Termine par les preuves de suppression, le bilan de lignes/tests/Git et ton verdict pour revue.
