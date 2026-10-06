# Investment OS — campagne E2E bornée — 2026-10-06

**Campagne PARTIAL / interrompue. LOT 13: NOT CERTIFIED. WRITE fermé en production v245, environnement 25.** Deux Drafts Schneider persistés et relus, un appel Micron rejeté `mapping`, cinq modules Alphabet non soumis. Trois appels `save_analysis` au total, chacun une fois ; aucun retry. Aucune promotion Current, aucun ordre, aucune modification financière ou du portefeuille.

## Baseline et état final

Baseline Lot12 GO infrastructure : Site v240 `2987b557052fe9afd56f895636de57b14062d530`, environnement 21 ; app `erwancgn/lot11-lot12-closeout` / `9081489534ace3a1cee87fbfb0ab0b752563cb53` ; plugin personnel 1.3.10 / `da40190987cdb420a0672675c70c2e6d44330f79` ; 299/299 tests hérités. Aucun changement du plugin ni synchronisation du miroir Git app effectués ici. Leur alignement final reste à vérifier.

| Version | Source Site | Configuration appliquée | Rôle |
|---|---|---|---|
| v241 | `ffa4bc94f847f558dd3039280245a8ae1f50dd8c` | env22, WRITE borné | Business Schneider puis arrêt sur régressions reader |
| v242 | `e1d064c5732618aed8070b54afb60e72ba073b6f` | env23, flags retirés | Première fermeture |
| v243 | `786b7ba1cbc0f95acfce4540785755c818f99818` | env23, WRITE fermé | Deux corrections reader ; relecture du même Draft, sans réécriture |
| v244 | `f24a7f1e8437198bb2b7610f440a9d4f7ca8633e` | env24, WRITE borné | Valuation Schneider, puis échec Micron |
| v245 | `93a7497de4af5191405b09978bba595b1532bbfe` | env25, WRITE fermé | État final `succeeded` à 09:08:27Z |

URL production : https://investment-os.erwancognee94.chatgpt.site

Déploiement final : `appgdep_6ac4ba811c088191bf10d31773b2649d`. Version sauvegardée : `appgprj_6a7d7a1233a08191a8d35b746b284e95~appgver_e0afe20e74648191a9c7d9411bed7627`. Vérification des variables : révision25, aucune clé `MCP_WRITE_*`. Source finale : `SITE_WRITE_RELEASE_APPROVED=false`. Les trois flags ont été retirés, puis cette révision réellement déployée.

## Intentions et résultats réels

| Intention | Run ID | Appels | Résultat / ID réel | Statut |
|---|---|---:|---|---|
| Schneider Business | `FV-SU-20261006-LOT13-E2E` | 1 | `3f137ea7af3581eca68bfbbe7adc5bad` ; Draft, persisted=true, promoted=false, verified=false ; 47 blocs d’origine relus identiques après correction | PASS contenu/persistance ; PARTIAL pipeline |
| Schneider Valuation | même run | 1 | `3f137ea7af3581528270ee5d79af9abb` ; Draft, persisted=true, promoted=false, verified=false ; 52 blocs d’origine relus identiques | PASS contenu/persistance ; PARTIAL présentation/pipeline |
| Micron Earnings | `ER-MU-20261006-LOT13-E2E` | 1 | Error `mapping`, retryable=false, sans receipt/ID ; appel à 09:07:55Z environ | BLOCKED_MAPPING |
| Alphabet Business | `FA-GOOGL-20261006-LOT13-E2E` | 0 | Payload préparé seulement | BLOCKED_CAMPAIGN_HALTED |
| Alphabet Valuation | même run | 0 | Payload préparé seulement | BLOCKED_CAMPAIGN_HALTED |
| Alphabet Short | même run | 0 | Payload préparé seulement | BLOCKED_CAMPAIGN_HALTED |
| Alphabet Portfolio Fit | même run | 0 | Payload préparé seulement | BLOCKED_CAMPAIGN_HALTED |
| Alphabet CIO Memo | même run | 0 | Payload préparé seulement | BLOCKED_CAMPAIGN_HALTED |

Les deux receipts Schneider indiquent `persisted`, jamais `verified`. La réussite de la comparaison en lecture ne transforme pas le receipt en `verified` et ne clôture pas le pipeline du plugin. Les huit rapports sont analytiquement **PARTIAL**, avec gaps explicites ; ce ne sont pas trois analyses financières complètes certifiées.

Schneider Business : https://app.notion.com/p/Business-Check-Schneider-Electric-3f137ea7af3581eca68bfbbe7adc5bad

Schneider Valuation : https://app.notion.com/p/Valuation-Check-Schneider-Electric-3f137ea7af3581528270ee5d79af9abb

## Gates de la campagne

| Domaine | Gate / exigence | Preuve exécutée | Reste à prouver | Statut | Source exacte |
|---|---|---|---|---|---|
| Sécurité | Owner vérifié, personal seul, allowlist exacte run/company/family, Draft, revision null, expiration | Policy tests Luna ; source `site-campaign.ts` et `sites-auth.ts` ; deux Drafts personal | Matrice live négative complète non rejouée | PARTIAL | `luna-campaign-validation.log`, `campaign-payload-checks.log` |
| Sécurité | Payload valide avant chaque appel | Schema Ajv, contrat canonique et policy pour les trois appels | Cinq modules Alphabet non appelés | PASS pour appels exécutés | `campaign-per-call-validation.jsonl`, `validate-campaign.mjs` |
| Sécurité | Un seul save par intention, aucun retry | Journal des trois appels uniques ; arrêt à l’erreur Micron | Pas de replay autorisé implicitement | PASS | `campaign-final-live-proof.json` |
| Sécurité | Aucune promotion Current | Receipts promoted=false ; 8 sélections Current avant/après identiques, Micron Earnings null avant/après | Pas preuve d’absence absolue de page Micron hors index | PASS périmètre Current | `campaign-current-comparison.json` |
| Sécurité | Fermeture effective | v245 succeeded env25, flags absents, source false | Aucun besoin de probe mutation négative live | PASS | `campaign-final-live-proof.json` |
| Renderer | Corps et tables Schneider relus sur IDs créés | Comparaison profonde sans IDs techniques ; 47/52 blocs dans l’ordre, textes/marks/liens/tables exacts ; ajout prévu de trois blocs résumé | Visuel/mobile non exécuté | PASS contenu ; PARTIAL rendu | `campaign-readback-0-v243.json`, `campaign-readback-1.json`, `compare-campaign.mjs` |
| Renderer | Underscores littéraux | Régression prouvée puis corrigée ; live `collected_this_run` intact après fix | Aucun | PASS | `app/lib/inline-segments.ts`, `tests/analysis-inline-format.test.mjs` |
| Renderer | Archive canonique distincte de l’historique | Draft archivé à tort avant fix ; canonical archived=false après fix ; Draft demeure dans historique | Aucun pour régression | PASS | `adapters/notion/investment-data.ts`, `tests/notion-adapter-write.test.mjs` |
| Renderer | Parité KPI / scénarios structurés | Valuation : 3 scénarios reconstruits, 0 facts sur 10 attendus ; prix terminal absent en métrique canonique ; cellules intactes | Projection fidèle / extraction, puis gate renderer complet | PARTIAL | `campaign-readback-1.json`, audit Luna ci-dessous |
| Produit | Earnings compatible avec source réelle | Appel unique retourne mapping | Schema source brut, alias/type fautif, correctif prouvé, nouvelle campagne explicitement bornée | BLOCKED | `campaign-final-live-proof.json`, `luna-earnings-mapping-diagnostic.md` |
| Produit | Alphabet chaîne 5 modules | Payloads et handoffs préparés, schema/domain/policy validés localement | Exécution unique, receipt, readback, Current inchangé par module | BLOCKED | `campaign-payloads.json`, `campaign-payload-validation.json` |
| Mobile | Parcours 360×800 et 390×844 | Checklist initiale disponible | Navigateur de contrôle autorisé, captures et interactions réelles | BLOCKED_VISUAL | handoff Lot13, section V |
| Performance | Scénarios hébergés cold/warm/Company/Basket/historique/MCP | Préparation et preuves locales initiales | Mesures reproductibles SQL/fanout/payload/mémoire/normalisation/SSR, sans seuil inventé | BLOCKED_HOSTED_METRICS | handoff Lot13, section B |
| Clôture | Site ↔ Git app ↔ plugin / docs / rollback | Site final source/build/archive cohérents ; plugin inchangé | Synchronisation et vérification miroir app/plugin, docs exécutées/historiques, rollback relu | PARTIAL | handoff Lot13, section A et patch UNAPPLIED |

## Correctifs minimums et tests

Deux régressions certaines corrigées sans changement du writer, du format canonique ou des méthodes financières :

1. `inline-segments.ts` : `_texte_` reste de l’italique historique ; les underscores à l’intérieur des identifiants alphanumériques ne deviennent plus de l’emphase. Test minimal des deux cas.
2. `investment-data.ts` : l’archive du contrat canonique utilise le signal explicite de la page ; la présence du Draft dans l’historique ne devient plus `header.archived=true`. Test Draft après Current existant, Current conservé.

Luna a exécuté 77/77 tests : renderer20, inline4, writer46, readadapter7 ; typecheck et diff-check PASS. Log complet : `campaign-source-fix-validation.log`. Build, typecheck et artifact ont également passé avant chaque packaging v243/v244/v245. Policy/MCP et writer préalables : `luna-campaign-validation.log`. Ces suites se recouvrent : ne pas additionner leurs nombres comme des tests uniques. Sur la source finale fermée `93a7497`, Luna a aussi exécuté `npm run test:mcp` : **26/26**, schema check PASS, aucun fail/skipped. Log : `luna-final-closed-mcp.log`.

Le reader ajoute deux/trois blocs `unsupported/unrepresented_snapshot` pour conserver des métadonnées de snapshot. Ils sont distincts du corps original exact, ne sont pas supprimés et restent une limite de présentation. Le writer ne persiste pas l’objet `analysis.presentation` ni la projection fournie ; avec `projection.status=absent`, le reader reconstruit les métriques depuis le contenu. Audit Luna : facts des payloads valuation/earnings/portfolio non reconstruits, prix terminal valuation non extrait faute de devise dans la ligne reconnue. **Aucune parité complète de présentation certifiée.** Classification : gap renderer à résoudre pour la certification des KPI/scénarios requis ; ne bloque pas la preuve de conservation des cellules.

## Micron : ce qui manque réellement

Le champ exact incompatible n’est pas connu. L’erreur `mapping` avant receipt et la lecture du writer étayent un problème du schéma de propriétés Earnings en préflight. Les captures disponibles ne contiennent aucun schéma `/data_sources` brut. Aucun défaut précis n’est donc corrigé par hypothèse. Il faut comparer alias et types requis : title, Run ID, Company/Companies, Agent, Status, date, Verdict, Confidence, Fiscal Period, Guidance et les cinq Refresh. Voir diagnostic Luna pour la liste exacte et les guards.

Après l’échec, `get_company` réussit et `get_current_analysis` Earnings renvoie encore null. Cela ne certifie pas à lui seul l’absence de création côté provider. Les logs Worker errors_only sont vides ; les événements disponibles ne désignent pas le champ fautif. Aucun retry et aucun accès provider alternatif n’ont été utilisés.

## Reprise minimale

1. Garder WRITE fermé ; vérifier Site v245/env25 et source finale. Ne jamais répéter les deux save Schneider.
2. Obtenir un snapshot **READ autorisé** du schéma Earnings et vérifier l’existence éventuelle d’un document/journal correspondant à `ER-MU-20261006-LOT13-E2E`, sans recréation. Les MCP READ disponibles n’exposent pas ce schéma ni une recherche par run ; cette preuve nécessite une capacité administrative autorisée dans la prochaine session.
3. Identifier le champ/type exact, corriger seulement le mapping prouvé et ajouter son test minimal. Ne pas retirer des informations analytiques pour contourner arbitrairement le contrat.
4. Revalider policy/schema/writer et décider une nouvelle campagne/runId explicite pour Micron ; aucun replay automatique du run échoué. Préparer d’abord la version de fermeture, puis ouvrir uniquement la fenêtre bornée.
5. Exécuter les cinq intentions Alphabet restées à zéro seulement après le nouveau gate ; un save par module, receipt puis READ de l’ID créé, Current inchangé. L’allowlist actuelle expire le 2026-10-06 à14:00Z : renouveler explicitement la politique si elle est expirée.
6. Fermer flags et release source, déployer et relire la configuration. Finir V/B/A et la matrice Lot13 complète ; aucun GO sans ces preuves.

Commandes locales exactes, sans écriture provider :

```bash
cd /workspace/scratch/90acd6d39abc/investment-os
npm run typecheck
npm run test:mcp
node --test tests/notion-adapter-write.test.mjs
npm run build
npm run validate:artifact
cd /workspace/scratch/c34339e3322c
node validate-campaign.mjs
node compare-campaign.mjs 0 /workspace/scratch/c34339e3322c/campaign-readback-0-v243.json
node compare-campaign.mjs 1 /workspace/scratch/c34339e3322c/campaign-readback-1.json
```

Les payloads archivés ne sont pas une commande de replay ; les runs soumis restent consommés pour cette campagne. Les benchmarks et parcours visuels exacts restent ceux du handoff Lot13. **LOT 13: NOT CERTIFIED.**
