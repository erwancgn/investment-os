# Passe de cohérence mobile après v142

## Règles communes

- Les alias historiques de couleur pointent vers les tokens du thème clair : texte, fond, accent, avertissement et erreur. Cela évite le retour des couleurs du thème sombre chargé après les imports CSS.
- Le conteneur extérieur possède les marges mobiles et la réserve de navigation ; le conteneur intérieur n'ajoute plus un second padding.
- Les surfaces Trajectoire, Source documentaire et Méthode partagent un espacement vertical de 1 rem.
- Le bloc Notion accepte le retour à la ligne de son groupe d'actions. Sous 560 px, le bouton occupe la largeur disponible, avec une cible tactile de 44 px minimum.
- Méthode : titre de 1 rem et informations secondaires de 0,875 rem ; action colorée avec le token d'accent.
- Les primitives Surface, DisclosureSurface, MetadataGrid, Tabs et ProgressBar sont conservées. Aucun nouveau composant ni dépendance.

## Analyses et données

Le registre des six familles et le renderer existants restent en place. Le contrat d'enveloppe du plugin disponible confirme un score nul pour Short, Portfolio Fit et Mémo CIO. Aucun changement des sorties des skills ou des données Notion.

La liste des analyses réutilise ses liens primaires et lance ses lectures indépendantes en parallèle. L'ordre des entreprises, documents et propriétaires reste conservé.

## Vérification

56 tests réussis et build valide. Fixture locale : 60 entreprises, 180 rapports, 30 passages après échauffement. Réponses de liste strictement égales avant/après, 206 947 octets.

Requêtes SQL : 18 → 14 ; lignes retournées : 548 → 544. Médiane locale : 53,1 → 55,7 ms ; p95 : 94,8 → 98,0 ms. Aucun gain de latence démontré par cette mesure ; la réduction du nombre de requêtes est le bénéfice établi.

Le rendu Safari/iPhone et l'objectif de chargement complet inférieur à 2 secondes ne sont pas vérifiés par ces tests. Les modifications d'espacement doivent être contrôlées visuellement sur appareil avant de déclarer le défaut de la capture résolu.
