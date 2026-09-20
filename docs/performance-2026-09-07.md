# Investment OS — performances et navigation

Version de référence : source `08394de` (version 139). Modifications préparées et vérifiées localement, sans publication.

## Changements

- Chargement séparé des vues compagnies, watchlist, analyses, recherche, gestion et du lecteur de rapports.
- Cache des réponses API en mémoire de session : réutilisation pendant 60 secondes, mutualisation des requêtes simultanées, actualisation manuelle conservée. Aucune donnée API stockée dans le service worker ou sur disque côté navigateur.
- Invalidation après synchronisation Notion ; les vues actives se rafraîchissent, les vues masquées attendent leur prochaine ouverture. Une réponse ancienne arrivée après une synchronisation ne remplace pas les nouvelles données.
- Les erreurs réseau conservent les dernières données affichées. Une réponse 401/403 purge les données de session, y compris les réponses encore en vol.
- Conservation des filtres, de la section entreprise, du focus et de la position de lecture lors des retours. Navigation compatible avec les boutons précédent/suivant et URL de fiche/document.
- Les fiches compagnie fournissent le TL;DR calculé à partir du document complet, puis retirent les corps de rapports de leur réponse. Le lecteur récupère toujours le contenu intégral à la demande. Les corrections CIO, métadonnées, relations et calculs financiers de la version 139 restent conservés.
- Mémorisation du parsing des rapports ; suppression des imports de polices inutilisées au profit de la police système.
- Service worker limité aux ressources statiques ; aucun rechargement automatique pendant la lecture sans acceptation de la mise à jour.
- Contrôles tactiles, zones de sécurité et mouvements réduits adaptés au mobile.

## Mesures de build

Comparaison de deux builds de production avec les mêmes dépendances :

| Périmètre | Avant | Après, arrondi |
| --- | ---: | ---: |
| Fichier principal de la page | 109 968 octets | 35 ko (environ −68 %) |
| Graphe JS initial identifié dans le manifeste : bootstrap, page, PWA et imports statiques | 383 467 octets | 320 ko (environ −16 %) |
| Même graphe, gzip calculé fichier par fichier | 114 142 octets | 99 ko (environ −13 %) |

Les vues différées restent téléchargées à leur première ouverture. Ces mesures décrivent les fichiers JavaScript, pas une accélération mesurée du temps de chargement sur un iPhone réel.

## Vérifications

- Build de production et validation de l’artefact Sites.
- ESLint.
- 51 tests : contrats existants, CIO, rendu HTML et tests ajoutés sur concurrence, cache, réseau, expiration de session, TL;DR tardif et service worker.
- Navigateur sur jeu synthétique local : liste de 30 entreprises, recherche « Demo 1 », entreprise → Business → rapport complet → retour ; filtre, section et focus conservés ; défilement restauré exactement à 172 px.
- Vue mobile dans un cadre de 390 px : largeur utile 375 px, contenu 375 px, sans débordement horizontal global. Rapport complet de 83 blocs accessible.

La vérification TypeScript globale reste bloquée par les déclarations Cloudflare/D1 manquantes dans la configuration existante ; aucun diagnostic ne concerne les nouveaux modules de cache, navigation ou projection. La fluidité sur appareil iPhone réel, les temps réseau de production et le cycle de mise à jour PWA sur Safari restent à mesurer. Le lancement complet hors connexion n’est pas pris en charge.
