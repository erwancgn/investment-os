# Dette CSS — état après le Lot 9

## Point de départ

Le design system possède désormais une entrée publique unique, un seul bloc `:root`,
aucun token concurrent et aucune classe orpheline détectée. La dette restante est une
dette de cascade et de consolidation, mesurée par la baseline versionnée :

- 177 sélecteurs exacts répétés ;
- 0 conflit direct de propriétés ;
- 134 variantes responsive ;
- 1 redondance stricte intentionnelle ;
- 42 extensions additives ;
- 292 déclarations `!important`.

Le nettoyage de cascade du Lot 7A a supprimé 14 déclarations `!important` dont le résultat était intégralement supplanté plus loin dans le même contexte CSS, sans modifier le comportement calculé. L'audit canonicalise désormais les paramètres des `@media` avant comparaison : les formes `@media(max-width:760px)` et `@media (max-width: 760px)` ne peuvent plus masquer un conflit. Trois conflits responsive historiques ainsi révélés ont été supprimés au profit du propriétaire `ux-foundations.css`.

La redondance stricte restante est volontaire : le fallback `.ui-surface--glass` est déclaré dans deux contextes indépendants, l'absence de support du blur et `prefers-reduced-transparency`. Elle ne doit pas être supprimée tant que ces deux comportements restent distincts.

Cette baseline est un plafond de non-régression, pas un état cible. Les sélecteurs répétés, conflits directs, redondances, déclarations `!important`, tokens concurrents et classes orphelines sont stricts. Les variantes responsive et extensions additives sont revues dans leur contexte : elles ne constituent pas une dette par nature lorsqu’elles expriment un comportement réellement différent et localisé.

## Décision du Lot 9 — 21 septembre 2026

Le découpage de `ux-foundations.css` n'est pas retenu. La feuille est chargée globalement par
`design-system.css` et un split en plusieurs fichiers importés au même endroit ne réduirait ni
le CSS chargé, ni la cascade, ni le nombre de règles actives. Il ajouterait surtout des frontières
de fichiers sans nouveau propriétaire fonctionnel. Un découpage ne devra être reconsidéré que si
une extraction réellement scindée par route/composant permet de réduire les règles chargées et la
cascade calculée, sans dupliquer les règles partagées.

La passe code mort a été renforcée avant toute suppression :

- `audit-dead-css.mjs` utilise désormais le registre dynamique canonique
  `css-audit-registry.mjs` au lieu d'une liste parallèle d'exemptions génériques ;
- les classes portées par les configurations d'objets React, notamment les colonnes de
  `DataTable`, sont explicitement détectées ;
- un candidat `.research-coverage-table .ui-data-table .research-score-cell` a été contrôlé
  contre `CompanyDetail` et `DataTable` puis conservé : il est réellement consommé ;
- `npm run audit:css` échoue désormais lorsqu'un sélecteur supprimable est détecté en mode
  audit ; le mode `--fix` reste volontairement séparé.

Aucune règle CSS n'a été supprimée dans ce lot faute de candidat mort prouvé. La baseline CSS
reste donc inchangée. Le prochain gate est la review fraîche de la branche complète face à
`main`, sans nouveau refactor CSS préalable sauf régression détectée.

## Périmètre recommandé

Durée estimée : 4 à 6 jours de développement, puis 0,5 à 1 jour de recette
visuelle mobile et desktop.

1. Conserver zéro conflit direct entre `globals.css` et `ux-foundations.css` ; toute nouvelle composition métier reste dans `ux-foundations.css`.
2. Réduire progressivement les `!important` seulement après suppression de leur règle concurrente ; la redondance `ui-surface--glass` est explicitement conservée.
3. Revoir les variantes responsive par composant : conserver celles qui expriment un vrai changement de composition et supprimer uniquement les doublons de cascade.
4. Ne découper `ux-foundations.css` que si le découpage réduit réellement la cascade ; ne pas créer de fichier pour un seul consommateur.
5. Passer à la validation Lovable puis à la recette finale application + Storybook avant toute fusion vers `main` ou publication Sites.

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
