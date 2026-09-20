# Correctifs après v140 — validation locale

Référence : 6155b9c (v140). Aucun changement de dépendances ou de schéma.

## Changements
- Invalidation du cache : annulation de la lecture obsolète, relance immédiate, protection contre les réponses anciennes. Statut Notion partagé.
- Liens directs : évitent le chargement du portefeuille sans nécessité. Recherche : annulation des pages obsolètes.
- Fiche mobile : marges de 16 px, chiffres de 20 px, date de 15 px. Vérifié dans Chromium à 390 px : date sur une ligne, hauteur 18,75 px.
- Ouverture de position et bascule de plus-value séparées en boutons natifs.
- Réutilisation des lectures et du JSON des lignes. Lecture distincte conservée pour respecter l’ordre des propriétaires d’une analyse.
- Suppression de cleanAnalysisPreview inutilisé, six sélecteurs morts et anciennes polices générées sans référence.

## Mesures
30 passages après échauffement, fonctions serveur regroupées avec esbuild, SQLite en mémoire, mêmes 60 entreprises et 180 rapports synthétiques. Mesures locales de fonctions, pas de latence HTTP ou iPhone.

| Scénario | Médiane avant → après | p95 avant → après | Lectures SQL |
|---|---:|---:|---:|
| Fiche | 136.3 → 36.5 ms | 167.5 → 46.8 ms | 22 → 13 |
| Analyse | 67.6 → 31.6 ms | 86.9 → 60.6 ms | 22 → 15 |

Réponses strictement égales sur ces fixtures. Portefeuille vide égal hors generatedAt : ne démontre pas la performance d’un portefeuille réel.

Course client contrôlée, 30 passages : première requête 40 ms, invalidation à 10 ms, seconde requête 20 ms. Médiane précédemment relevée 60,8 → 30,5 ms. Ce résultat montre la suppression de l’attente obsolète, pas un démarrage réel deux fois plus rapide.

Reproduction :
```sh
node tests/benchmark-data.mjs /chemin/checkout /tmp/data.json
node tests/benchmark-startup.mjs /chemin/v140 /tmp/startup.json
node --test tests/*.test.mjs
npm run lint
```

## Validation et limites
Build valide, lint sans erreur ni avertissement, 51 tests réussis. Le test de concurrence attend désormais les données fraîches avant de résoudre la réponse obsolète. Safari/iPhone réel, réseaux froid/chaud et cours externes restent à vérifier avant toute conclusion sur le démarrage en production. Aucun gain GPU annoncé. Aucun cache de synthèses ajouté : coût local médian 0,55 ms, complexité non justifiée. Flous et grille de recherche conservés.
