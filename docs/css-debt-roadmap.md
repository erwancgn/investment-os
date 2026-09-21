# Prochain chantier — réduction de la dette CSS

## Point de départ

Le design system possède désormais une entrée publique unique, un seul bloc `:root`,
aucun token concurrent et aucune classe orpheline détectée. La dette restante est une
dette de cascade et de consolidation, mesurée par la baseline versionnée :

- 199 sélecteurs exacts répétés ;
- 21 conflits directs de propriétés ;
- 125 variantes responsive ;
- 12 déclarations strictement redondantes ;
- 41 extensions additives ;
- 349 déclarations `!important`.

Cette baseline est un plafond de non-régression, pas un état cible. Les conflits directs, redondances, déclarations `!important` et tokens concurrents doivent rester stables ou diminuer à la fin d’un lot. Les extensions additives peuvent augmenter ponctuellement si elles sont intentionnelles, locales et justifiées par un vrai contexte responsive/state/accessibility, avec justification dans le commit et baisse mesurable de la complexité globale.

## Périmètre recommandé

Durée estimée : 4 à 6 jours de développement, puis 0,5 à 1 jour de recette
visuelle mobile et desktop.

1. Classifier les 21 conflits restants par domaine et par risque, en commençant par le shell,
   les cartes de découverte et les lecteurs.
2. Regrouper les règles d'un même composant dans un propriétaire unique et supprimer
   les répétitions rendues inutiles.
3. Réduire les `!important` seulement après suppression de la règle concurrente qui
   les rend nécessaires.
4. Découper `ux-foundations.css` par responsabilités stables lorsque le déplacement
   réduit réellement la cascade ; ne pas créer de fichiers pour un seul consommateur.
5. Conserver `globals.css` comme propriétaire des tokens et des primitives visuelles,
   sans y réintroduire des règles de composition métier.

## Garde-fous

- Traiter un domaine à la fois avec un diff réversible.
- Ne jamais supprimer un sélecteur à partir du seul audit statique : vérifier les
  consommateurs React et le registre des classes dynamiques.
- Exécuter après chaque lot `npm run audit:css:governance`, les tests applicatifs et
  les stories des écrans concernés.
- Vérifier les références mobile 390 px et desktop 1440 px avant de diminuer la
  baseline.
- Une valeur de baseline ne baisse qu'après suppression effective du code ; elle ne
  doit jamais être modifiée pour masquer une régression.

## Critères de sortie

- zéro nouveau token concurrent ou classe orpheline ;
- aucun conflit direct non documenté sur les primitives partagées ;
- réduction mesurable des sélecteurs répétés et des `!important` ;
- rendu Storybook et application inchangé sur les écrans de référence ;
- documentation et baseline mises à jour dans le même commit que chaque réduction.
