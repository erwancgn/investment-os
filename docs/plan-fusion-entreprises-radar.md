# Fusion Radar + Compagnies — plan d'exécution

## Décision et périmètre

Une seule page de premier niveau, **Entreprises**, remplace Radar et Compagnies. Son univers est la base Notion `Companies`, sans filtre implicite : toutes les fiches sont affichables. Les vues `Toutes`, `Détenues` et `Watchlist` sont des filtres de cette même liste. Les vues peuvent se recouper. Les pages de premier niveau Analyses et Recherche disparaissent ; la lecture des documents reste accessible depuis la fiche entreprise et ses liens profonds. Portfolio et Gestion restent en place.

## Contrat de données

1. `Companies` est la source des identités et de l'univers. L'identifiant de page Notion, normalisé, est la seule clé de jointure ; ne pas joindre par nom ou ticker pour déterminer l'appartenance.
2. `Détenue` vient des positions Portfolio actives de quantité positive reliées à Company. `Watchlist` vient des entrées Watchlist dont la relation `Company` pointe vers la fiche. `Companies.Status` reste une donnée de cycle de vie, pas une deuxième définition de l'appartenance.
3. La relation Watchlist↔Company doit être unique pour une entrée Watchlist. L'intégrité doit signaler les entrées sans Company, avec plusieurs Companies, les doublons par Company, et les fiches `Companies.Status = Watchlist` sans entrée Watchlist.
4. Les cinq références d'analyse utilisent les relations `Current ...` sur Company. Pour le mémo CIO affiché, exiger `Current Investment Memo`, agent `Investment Memo`, état `Validated` et relation à la bonne Company ; ne pas retomber silencieusement sur un ancien mémo. Sans mémo valide : `Pas de décision CIO`.
5. `Monitoring Status` est une étape de suivi éditoriale de Watchlist. Le plugin Investment OS Analysis ne l'alimente pas. Ne pas l'exposer comme signal automatique ni déduire `Ready to buy` d'un mémo. Ne pas afficher `Watchlist.Décision` à côté du verdict CIO comme une seconde décision concurrente.
6. Les cinq nouvelles entrées Watchlist liées aux Companies existantes (LVMH, Aehr, Tower, FICO, Bloom) ont été créées le 23 septembre 2026. Leurs champs `Monitoring Status`, `Décision` et thèse restent vides jusqu'à saisie explicite. Vérifier leur présence après synchronisation Notion avant de tester les compteurs de l'app.

## Changements ciblés

| Fichier | Action |
| --- | --- |
| `app/page.tsx` | Remplacer les wrappers `Watchlist` et `Companies` par un seul écran `Entreprises` ; retirer `AnalysisHub` et `Research` de la navigation, les imports lazy associés et le marqueur `TXT`. Garder Portfolio, Gestion, CompanyDetail et DocumentView. |
| `app/lib/app-navigation.tsx` | Définir une destination canonique `companies` pour Entreprises. Faire converger les anciennes URL `?tab=watchlist`, `?tab=analyses` et `?tab=research` vers cette destination avec `replaceState`, tout en conservant `company`/`document` dans les liens profonds. Garder le préchargement des routes de détail. |
| `app/components/notion-companies.tsx` | En faire l'unique liste (éventuellement la renommer `company-directory.tsx` dans le même changement). Garder `SearchField`, `DisclosureSurface`, `Tabs`, les cartes et cinq liens `Current`. Remplacer les cinq filtres par `Toutes`, `Détenues`, `Watchlist`; retirer `Not owned`, `Hors watchlist`, le texte `Non classé` et la combinaison `Monitoring Status · Watchlist.Décision`. Ajouter un état explicite pour les fiches sans mémo courant. |
| `app/lib/investment-data.ts` | Construire une seule projection Company pour la liste et le détail. Garder les jointures Portfolio et Watchlist par ID Notion. Unifier l'origine de la décision sur le seul mémo CIO courant validé ; retirer le champ dérivé de `Watchlist.Décision` du contrat UI. Garder `Monitoring Status` uniquement si une section de détail en a encore l'usage explicite. Supprimer `listWatchlist`, `WatchlistItem` et `WatchlistData` après migration de Gestion vers un audit construit sur les relations brutes. Ne pas supprimer les fonctions de documents nécessaires aux fiches et au lecteur. |
| `app/components/company-detail.tsx` | Conserver les onglets internes et l'historique d'analyses. Remplacer `Decision : data.decision` par le verdict du mémo courant, daté, ou l'absence explicite de mémo. Mettre l'étape éditoriale de suivi dans un emplacement distinct seulement si utile. |
| `worker/index.ts` | Garder `/api/companies`, `/api/companies/:id`, `/api/analyses/:id`, l'audit et les routes de synchronisation. Supprimer `/api/watchlist`, `/api/analyses` (index), `/api/archives` et `/api/notion/search` après migration de leurs seuls consommateurs internes. |
| `app/lib/notion-sync.ts`, `app/lib/notion-sync-client.ts` | Garder l'import des sources Companies, Portfolio, Watchlist et Analyses ; la disparition d'une page ne doit pas arrêter leur synchronisation. L'audit détecte `Companies.Status = Watchlist` sans entrée reliée. |
| `app/styles/ux/discovery.css`, `app/styles/ux/analysis-reader.css`, `app/globals.css` | Conserver uniquement les sélecteurs réellement utilisés par Entreprises, CompanyDetail et DocumentView. Retirer les styles propres aux cartes Radar, aux filtres Monitoring, à la table Analyses et à Recherche après suppression des composants. Réviser les règles responsive 390 px et desktop, sans nouvelle couche de surcharge. |
| `stories/Companies.stories.tsx`, `stories/reference-fixtures.ts`, `stories/reference-frame.tsx`, `stories/DesignSystem.stories.tsx` | Mettre les fixtures et stories sur la page unique ; couvrir les vues qui se recoupent, les entreprises sans Watchlist et les fiches sans mémo. Enlever toute fixture `Hold` qui n'est pas une option Notion réelle. |
| `docs/design-system.md` et documentation de navigation | Décrire la destination unique, le filtre dans `DisclosureSurface` et la provenance de chaque badge/verdict. |

## Suppressions après migration des imports

- `app/components/notion-watchlist.tsx` : écran Radar séparé.
- `app/components/notion-analyses.tsx` : index de premier niveau des analyses. Garder `analysis-reader.tsx`, `analysis-presentation.tsx`, `document-view.tsx` et les vues d'analyse **dans la fiche**.
- `app/components/document-search.tsx` : page Recherche séparée ; le champ de la page Entreprises couvre la recherche par identité, secteur, industrie et thème.
- `stories/Watchlist.stories.tsx`, `stories/Analyses.stories.tsx`, `stories/Search.stories.tsx` et leurs fixtures devenues inaccessibles. Transférer les cas utiles vers la story Entreprises ou le lecteur de document.
- Les types, helpers, imports et sélecteurs CSS qui n'ont plus de références après ces suppressions. Ne pas supprimer une primitive générique (`Tabs`, `SearchField`, `DisclosureSurface`, `DiscoveryCard`, etc.) utilisée ailleurs.

## Ordre de livraison et critères de sortie

1. Synchroniser Notion et vérifier les cinq nouvelles relations dans le snapshot applicatif. Vérifier les comptes et les anomalies d'intégrité sans se fier au seul nombre de fiches Watchlist.
2. Corriger le contrat de projection et la sélection du mémo courant validé ; couvrir les cas `Owned`/`Watchlist` qui se recoupent, Company dans aucune des deux vues, mémo absent, relation invalide et doublons.
3. Remplacer l'écran par la liste unique ; vérifier au format mobile 390 px la recherche, le filtre, les badges, les cinq références et l'accès au détail/document. `Toutes` doit afficher l'univers complet.
4. Basculer les anciens liens profonds et la navigation. Vérifier retour navigateur, restauration du défilement et liens `company`/`document` depuis les anciennes URL.
5. Supprimer les composants, routes sans consommateurs, fixtures et CSS obsolètes listés plus haut. Exécuter une recherche de références et les contrôles TypeScript/build ; aucun doublon de liste ou de source de décision ne doit rester.
6. Relire le diff pour confirmer que les règles existantes ont été remplacées, pas recouvertes. Faire la revue visuelle mobile et desktop, puis seulement publier selon le circuit Sites et miroir Git du projet.

## État d'implémentation — 23 septembre 2026

Le plan est implémenté dans le checkout Sites. Les anciens onglets et les routes de liste/recherche sans consommateurs sont supprimés ; les URL `?tab=watchlist`, `?tab=analyses` et `?tab=research` convergent vers Entreprises en conservant les paramètres `company` et `document`. Les fiches et le lecteur de documents restent accessibles par leurs routes de détail.

Les relations Company explicites définissent l'appartenance Watchlist. L'audit signale les relations absentes ou multiples, les doublons et les entreprises encore marquées Watchlist sans entrée liée. Le verdict CIO exige la relation `Current Investment Memo`, le statut `Validated` et la propriété `Agent = Investment Memo`.

Les composants Radar, index Analyses et Recherche, leurs stories et leurs styles orphelins sont supprimés. Les seuils CSS versionnés ont baissé après suppression effective des règles : aucun sélecteur orphelin, conflit direct ou token concurrent.

Le changement reste à relire avant commit ; aucun commit ni déploiement n'est inclus dans cette livraison.
