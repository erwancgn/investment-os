# Passation Sol — gate final Lot 6 puis Lot 7

Établie le 1 octobre 2026. Le commit qui introduit ce fichier est le checkpoint du candidat Lot 6 et de cette passation. **Le candidat est validé localement; le GO définitif Lot 7 n'est pas acquis.** Ne pas confondre le commit demandé par l'utilisateur avec une validation runtime Cloud.

## Reprise et accès

- Sol planifie, orchestre, décide du chemin canonique et revoit les diffs. Les agents **Luna** implémentent les tâches bornées. Aucun Lot 7 n'a été commencé ici.
- Racine locale exacte : `/Users/ec/Documents/ChatGPT/Investment OS - APP/investment-os-stabilization`. Racine Cloud : `/workspace/investment-os`, uniquement si ce repo et le checkpoint y sont effectivement présents.
- Repository : `https://github.com/erwancgn/investment-os.git`; branche : `chore/architecture-stabilization-mcp`; ne pas travailler sur main.
- Checkpoint Lot 6 : retrouver le SHA avec `git log -1 --format=%H -- docs/architecture/lot-7-handoff.md`, puis comparer au SHA fourni dans le prompt de reprise. Le SHA du commit ne peut pas être inscrit dans son propre contenu.
- Lot 5 : `4db2a85846126481d6331bcb1033f8e1802b42ba`; Lots 4–4.1/passation précédente : `7e988b65ca7103c153835ed76740860134de4630`. Baseline restaurable : tag `pre-architecture-stabilization`, commit `730d1b291fa064f537f26e9e4ef840822e65fafa`.
- Avant modification : vérifier racine, branche, HEAD, état Git, Node/npm, lockfile et présence de cette passation. Fetch/avance rapide uniquement si nécessaire pour rejoindre le checkpoint; aucun reset, écrasement, force-push ou substitution d'un checkout ancien. Si HEAD est plus récent, revoir ses changements au lieu de le rétrograder.
- Le réseau local GitHub a été vérifié par fetch. Une ancienne tâche Cloud avait un proxy `proxy:8080` injoignable : cela ne prouve pas l'état réseau actuel. Si ce problème réapparaît, examiner la politique Cloud, sans la contourner ni modifier le code pour masquer le blocage.

Le projet desktop enregistré vise actuellement le **dossier parent** `Investment OS - APP`, qui contient un dépôt Git vide (zéro fichier suivi, aucun HEAD) et plusieurs repos imbriqués. Le compteur « 38k fichiers ajoutés » ne représente pas le diff du chantier. Inventaire du 01/10 : le vrai repo suivait 165 fichiers avant cette passation; `site-ui` contient 34 567 fichiers physiques hors `.git`, dont 33 208 dans `node_modules`. Les dépendances et outputs sont ignorés par le vrai repo. Ne pas faire `git add .` au parent, ne pas committer ces dépendances et ne pas supprimer les autres checkouts. Pour une nouvelle tâche locale, sélectionner le vrai dossier du repo comme projet; tous les outils doivent utiliser cette racine explicitement.

## Contexte à lire

1. `AGENTS.md` puis ce fichier.
2. `docs/architecture/baseline.md` : Lot 0, source Sites, captures et erreurs de départ.
3. `docs/architecture/debt-map.md` : Lot 1; retrouver les symboles, ses numéros de lignes sont historiques.
4. `docs/architecture/target-architecture.md` : décisions Lot 2 et checkpoints **effectivement obtenus** Lots 4, 4.1, 5, 6. Les anciens NO-GO Lot 5 ont été levés au Lot 4.1; le NO-GO Lot 7 du Lot 6 est encore ouvert.
5. `docs/architecture/domain-contracts.md` et `core/contracts/{common,analysis,investment,presentation-projection}.ts` : contrats Lot 3, version domaine 1.0.0, distincte de la version présentation/plugin/méthodologie.
6. `core/analysis/current-selection.ts`, ses tests et fixtures : politique pure du Lot 3, **non branchée au runtime**. Ne pas annoncer qu'elle sélectionne déjà toutes les analyses.
7. `docs/architecture/codex-cloud-environment.md` : Lots 3.5–3.5b, Node 22.23.1 et limite CSS Cloud. Diagnostic 3.5b clôturé avec zéro fichier conservé/zéro ligne nette; ne pas le recréer.
8. `docs/architecture/lot-5-handoff.md` seulement comme contexte historique complémentaire : ses instructions d'arrêt au Lot 5 ne remplacent pas la présente demande de reprise.

Les pièces jointes de la conversation, les fichiers `/tmp` et les captures ignorées ne sont pas des prérequis de lecture : les décisions utiles sont enregistrées dans ces documents. Le prompt initial du Lot 7 est retranscrit ci-dessous.

## État obtenu et limites à préserver

- Pipeline : raw snapshot → `parseNotionDocument` / `normalizeAnalysisDocument` → contrat canonique → `AnalysisReader` → compositions Standard/CIO → rendu partagé `AnalysisBlockBody`. Les deux lecteurs de format structuré et historique restent nécessaires; aucun nouveau parser ou renderer concurrent.
- Lots 4–4.1 : convergence canonique, conservation des sources/liens, correction du lien CIO dans « Raisonnement décisif »; Portfolio 360 chargé. Le panel réel et les fixtures sont décrits dans target-architecture, sans prétendre à une publication en production.
- Lot 5 : retraits prouvés `readNotionStatus`, `NotionRelationRow`, wrappers inline, union legacy et imports/casts; produit +20/−37, net −17. Pas de suppression de parser/fallback/CSS encore utilisé.
- Lot 6 : `investment-data.ts` charge seulement les corps des candidats Company (archives incluses) ou du document demandé; relations ciblées, lots 80 séquentiels, lookup exact puis normalisé. Le listing ordinaire omet les blocs, l'intégrité complète les conserve. Sélection legacy conservée; headers globaux encore proportionnels au corpus, pas de pagination ou limite dure d'archives livrée.
- `CompanyAnalysisDocument` accepte un corps canonique validé et vérifie identités interne/externe; un échec de refresh conserve le contenu. Le cache existant garde TTL60s, single-flight, epoch/revision/abort et purge 401/403; son diagnostic optionnel distingue réseau/timeout/HTTP/introuvable/mapping/stockage/normalisation.
- La route Analysis personnelle ajoute corrélation et durée; logs/JSON n'exposent ni corps ni détails DB privés. Un `exceededMemory` fatal peut interrompre avant le catch; le mapping permissif legacy des propriétés reste à isoler au Lot 8.
- Produit Lot 6 : cinq fichiers +223/−29, net +194. Tests/benchmark existants : cinq fichiers +448/−32. Checkpoint architecture : +31 lignes. Cette passation est le seul nouveau fichier; aucun diagnostic temporaire ni dépendance n'entre dans Git.
- **211/211 tests Node**, typecheck, build direct, artefact, lint ciblé et diff-check passent. Smoke Worker compilé Wrangler local : Portfolio, Business et IA à 360 px sans erreur console. Basket démo chargé. Cela ne vaut pas validation du compte personnel sur Sites.
- Benchmark comparatif (60 companies/180 rapports, 30 appels chauds) : Company médiane 122,0→54,5 ms, Document 61,9→44,5 ms; corps document 181→1, Company 180→3. JSON Company/Document inchangés, principales/archives conservées. Normalisation et SSR mesurés séparément; chiffres et limites complets dans target-architecture. Mémoire échantillonnée Node ≠ mémoire Worker Cloud.
- Les traces démo Chrome avant/après ont 1 requête Analysis à froid, 0 au retour immédiat, 0 doublon; aucun gain de fetch démo démontré. Elles ne mesurent pas le corpus privé ni un click→paint précis.
- Limites locales : chemins avec espaces dans un test ancien; GNU `timeout` absent sur macOS; warning React de snapshot session reproduit sur baseline. Un serveur Vite local affiche un overlay `next/image`, absent de la copie sans espaces et du Worker compilé; collision de cache partagé plausible mais non prouvée. Ne pas ajouter un correctif produit hypothétique.

## Gate obligatoire avant Lot 7

Les logs Sites v207 prouvent `exceededMemory` sur Analysis/Company/Basket/Portfolio, pas l'allocation responsable. La réduction de lectures et le correctif de garde sont prouvés localement; **la disparition des erreurs sur le corpus personnel dans le runtime Cloud n'a pas été vérifiée**. Sites est distinct de l'environnement de développement Codex Cloud : un build Codex Cloud réussi ne prouve pas le runtime Sites/D1 personnel.

Aligner le runner choisi sur le checkpoint exact, établir des parcours comparables froid/chaud et corréler les requêtes aux logs runtime (mémoire, CPU/wall, erreurs, normalisation/rendu). Vérifier sélection/archives et conservation du contenu après refresh échoué. Aucun déploiement ni mutation du corpus n'est implicitement autorisé par cette passation; préparer un résultat reviewable avant toute publication nécessaire. Si les accès ne permettent pas cette preuve, donner le blocage précis et rester NO-GO; ne pas lancer un refactor Lot 7 en parallèle du gate ni prétendre que les mesures synthétiques l'ont levé.

## Lot 7 — objectif initial et frontières

« Centralise les opérations métier nécessaires. Cible minimale : getCompany(), getPortfolio(), getPosition(), getCurrentAnalysis(), listAnalyses(), saveAnalysis(), getQuote(). Réutilise la logique existante. Le Core ne doit pas savoir s'il est appelé par frontend, plugin, Codex ou MCP. »

Une fois le gate levé et consigné, établir le mapping exact opération → implémentation → consommateurs → contrat avant délégation. Réutiliser `getCompanyDetail`, `getLivePortfolio`, `getResearchDocument`, `listResearchDocuments`, la logique quotes et les contrats existants; aucune méthode portable `saveAnalysis` n'a encore été démontrée dans ce repo. Ne pas confondre sync/import snapshot avec sauvegarde métier ni inventer une écriture ou une promotion Current pour remplir une liste de noms. Examiner le plugin existant en lecture si nécessaire (`https://github.com/erwancgn/plugin-investment-os`), sans changer sa méthodologie.

| Opération | Implémentation runtime vérifiée / manque |
| --- | --- |
| getCompany | `investment-data.ts::listCompanies/getCompanyDetail`, routes `/api/companies` et `/api/companies/:id`; modèles UI actuels, pas encore résultat Core Company. |
| getPortfolio | `investment-data.ts::getLivePortfolio`, `/api/portfolio/live`; calculs/FX/expositions actifs à préserver. |
| getPosition | Aucun lookup unitaire ni route positions; seulement `LivePortfolio.positions`. Le contrat distingue ouverte/fermée; ne pas réintroduire les fermées dans les holdings. |
| getCurrentAnalysis | Sélecteur Core pur non câblé; sélection active dans la fiche/reférences. `getResearchDocument` lit un ID historique sans affirmer Current. |
| listAnalyses | `listResearchDocuments`; aucun GET `/api/analyses` listing public. L'intégrité appelle le mode corps complet. |
| saveAnalysis | Aucun service ni route de création/update d'analyse Notion; l'import/sync vers D1 n'en est pas un. Cible et gate d'écriture documentés dans target-architecture. |
| getQuote | `quotes.ts::getQuote` interne privé, `getQuotes` public et `/api/quotes?assets=...`; préserver FX, fraîcheur et dernier cours valide. |

`core/` contient contrats et sélection pure, pas encore services/ports/adapters runtime. `getAnalysisById` reste nécessaire à l'accès historique même s'il n'est pas dans les sept noms minimaux. Ne pas construire des endpoints ou wrappers supplémentaires sans consommateur ni test de migration.

Le Core porte orchestration/politiques pures et contrats canoniques; HTTP/auth/secrets/React restent aux frontières. Notion IDs/propriétés/relations et D1 restent hors Core; l'extraction physique complète de l'adapter appartient au Lot 8. Ne pas doubler le mapping pour réaliser le Lot 7. Pas de Supabase, nouveau MCP, infrastructure, conteneur DI/repository générique, redesign, méthode financière ou condition par ticker/company. Migrer de vrais consommateurs et supprimer les seules implémentations remplacées prouvées inutilisées.

Tester les contrats et migrations Current par famille/propriétaire/archives; toute différence de sélection inexpliquée bloque la bascule. Vérifier les consommateurs partagés Portfolio/Basket/IA, les corps et liens, auth, cache et budgets du Lot 6; mobile 360×800 et 390×844. Garder le rendu Advantest comme référence fonctionnelle/visuelle sans cas particulier. Terminer par architecture obtenue, diff/LOC, tests, limites, état Git et verdict motivé pour le Lot 8. Ne pas commencer le Lot 8 automatiquement.

## Commandes et reproductibilité

Node local 22.23.1 / npm 10.9.8; Cloud validé historiquement Node 22.23.1 / npm 11.9.0. Lockfile SHA-256 : `b8a15bf6f414fc6d3ca7690e0e8724193f881c9cdc3c5bb9e7ec08309ef637f6`; test CSS ownership : `83efc331146cb7bec8db1cffe6a0e97b798a6c8c4fbeb3f62f49babfc0de0163`. Ne pas les modifier pour obtenir un PASS. Réutiliser les dépendances validées; `npm run install:ci` seulement si nécessaires et conformément à la politique du runner.

Linux/Cloud : `npm test`, `npm run validate:artifact`, en conservant la limite préexistante de sortie sous-processus vide dans le test CSS. macOS : `npm run typecheck`; build réellement validé `bash scripts/sites-env.sh -- node_modules/.bin/vinext build`; puis `npm run validate:artifact`. Exécuter les vingt fichiers Node énumérés dans `package.json` après ce build dans une copie fidèle sans espaces lorsque nécessaire, sans changer les tests. La copie locale `/private/tmp/investment-os-lot4-validation` est un confort historique, jamais un prérequis durable.

Mesures : `node --expose-gc tests/benchmark-data.mjs <racine-source> <sortie-json-temporaire>` sur baseline Lot 5 figée et candidat, avec mêmes fixture/instrumentation/runtime. Le benchmark inclut SQL/normalisation/sérialisation/CPU/heap échantillonné/SSR; aucun autre script de sonde à pérenniser. Les preuves compactes et captures locales `outputs/lot6/` sont ignorées; leur absence dans un clone Cloud ne signifie pas que le code ou les tests manquent. Tous les serveurs/onglets de cette validation ont été fermés, aucun service permanent créé.
