# Design system de référence

## Rôle

Le design system est la source commune de l’application, de Storybook et des validations Lovable. Il ne doit jamais exister une seconde implémentation concurrente : les stories montent les composants réellement utilisés par l’application, et Lovable sert uniquement de banc de validation visuelle.

## Sources canoniques

| Besoin | Source |
| --- | --- |
| Entrée CSS publique commune à la production et Storybook | [`app/design-system.css`](../app/design-system.css) |
| Primitives React partagées | [`app/components/ui-primitives.tsx`](../app/components/ui-primitives.tsx) |
| Contrats visuels des primitives, surfaces et tokens globaux | [`app/globals.css`](../app/globals.css) |
| Layouts métier, composition responsive et compatibilité historique | [`app/ux-foundations.css`](../app/ux-foundations.css) |
| Références exécutables et données d’état | [`stories/`](../stories/) |

Les valeurs ne doivent pas être recopiées dans cette documentation. En cas de divergence, les primitives de production et leurs stories font foi.

### Entrée et propriété CSS

`app/design-system.css` est l’unique entrée CSS publique. `app/layout.tsx` et `.storybook/preview.ts` l’importent directement, dans cet ordre immuable : Tailwind, fondations UX, puis globals canoniques. `stories/storybook.css` reste une feuille de contexte Storybook, pas une seconde entrée du design system.

`app/globals.css` est l’unique propriétaire des tokens canoniques et des alias historiques encore consommés. `ux-foundations.css` porte les règles de composition et de responsive sans redéfinir de bloc `:root`. Les contextes d’accessibilité et de responsive utilisent les propriétés canoniques et leurs tokens existants, sans créer de token concurrent.

## Contrat de surface

1. Le canvas de page est neutre et distinct du contenu.
2. Une surface de contenu de premier niveau utilise `primary` : carte métier, recherche, KPI, liste documentaire.
3. `secondary` est réservé aux informations réellement imbriquées ou de soutien ; il ne doit pas servir à griser arbitrairement une carte de premier niveau.
4. `glass` est réservé au chrome, à la navigation, aux menus flottants et aux surfaces qui se superposent au contenu.
5. `DiscoveryCard` porte le shell Apple Light / Liquid Glass commun des cartes Companies, Radar et Analyses : un écran peut organiser son contenu interne, mais ne redéfinit pas localement fond, bordure, rayon ou ombre. Les informations réellement imbriquées peuvent utiliser de petites surfaces secondaires. Le hover/focus léger reste une interaction voulue.
6. Le titre principal d’une DiscoveryCard peut occuper jusqu’à deux lignes dans une piste flexible `minmax(0, 1fr)`. Les badges, statuts et actions occupent des pistes `auto` non réductibles : le titre ne peut ni les chevaucher ni leur prendre leur espace, et la carte conserve une hauteur intrinsèque.
7. Le Radar conserve la hiérarchie visuelle validée dans Lovable : identité + statut + action, puis décision / ownership / confiance, thèmes, enfin thèse secondaire.
8. Toute action interactive conserve une zone cible d’au moins 44 × 44 px. Les contrôles compacts partagés utilisent `CompactControl` : leur zone interactive mesure 44 px de haut autour d’un visuel de 40 px, avec 18 px de gouttière horizontale de chaque côté. Le chevron reste discret (10 px, trait 1,25 px) et le bouton icône conserve un visuel 40 × 40 px avec une icône de 12 px.
9. Un segmented control contenu conserve lui aussi une zone interactive de 44 px ; son conteneur visuel reste à 40 px avec 3 px d’inset uniforme et le segment actif à 34 px. Les filtres existants restent libres d’utiliser la variante non contenue quand le contexte l’exige.

## Utilisation avec Lovable

Lovable lit automatiquement le fichier racine `AGENTS.md`. Pour une tâche d’interface, la skill `investment-os-ui` ajoute le protocole de travail et relit les sources canoniques du dépôt.

La page Lovable de référence est un banc de comparaison mobile. Elle peut montrer les mêmes surfaces, contrôles et cartes, mais elle ne définit ni token ni composant de production.

## Règles minimales

1. Réutiliser une primitive existante avant d’ajouter un composant.
2. Ajouter une primitive seulement lorsqu’un contrat visuel ou interactif a plusieurs consommateurs réels.
3. Les styles métier peuvent gérer grille, largeur, ordre et densité ; ils ne doivent pas réécrire le contrat visuel d’une primitive partagée.
4. Chaque interaction conserve son nom, son état actif, son focus visible et son libellé accessible.
5. Une story utilise le composant de production et évite toute dépendance réseau.
6. Une migration n’est terminée que lorsque les anciens overrides ne sont plus référencés et peuvent être supprimés sans régression.
7. Toute passe UI doit réduire ou stabiliser le nombre d’overrides spécifiques ; une amélioration visuelle qui augmente la concurrence CSS n’est pas considérée comme terminée.

## Gouvernance CSS et baseline de migration

La dette CSS existante est mesurée par [`scripts/audit-css-governance.mjs`](../scripts/audit-css-governance.mjs). L’audit couvre les trois feuilles actuellement chargées ou référencées par le système :

- `app/globals.css` ;
- `app/ux-foundations.css` ;
- `stories/storybook.css`.

Il distingue les sélecteurs exacts répétés, les conflits de propriétés dans un même contexte d’at-rule, les variantes responsive, les propriétés strictement redondantes, les extensions additives, les tokens répétés avec leurs valeurs, et les classes sans consommateur démontré.

La baseline versionnée est [`scripts/css-audit-baseline.json`](../scripts/css-audit-baseline.json). Après la réconciliation du shell v171, l’état courant documenté est : 276 sélecteurs répétés, 81 conflits directs, 129 variantes responsive, 22 redondances identiques et 44 extensions additives ; 0 token répété et 0 valeur concurrente ; 449 déclarations `!important` ; 323 classes définies et 0 classe orpheline.

Le prochain chantier de réduction, son séquencement et ses critères de sortie sont
documentés dans [`docs/css-debt-roadmap.md`](./css-debt-roadmap.md).

La commande de gouvernance échoue avec un code non nul si un compteur surveillé augmente :

```bash
npm run audit:css:governance
```

Pour obtenir la preuve machine stable, notamment pour une CI ou un archivage de diagnostic :

```bash
npm run audit:css:governance:json
```

`npm run audit:css` reste l’audit historique des sélecteurs supprimables ; il n’est pas remplacé par l’audit de gouvernance. Les deux commandes doivent rester vertes pendant la migration.

### Registre des classes dynamiques

Une classe n’est exemptée de l’analyse des orphelines que si son générateur est documenté dans [`scripts/css-audit-registry.mjs`](../scripts/css-audit-registry.mjs). Chaque entrée indique le fichier/composant producteur, les valeurs admises et la raison du contrat. Les mots génériques présents dans les données ou les variables (`error`, `warning`, `running`, etc.) ne prouvent pas à eux seuls qu’une classe CSS est consommée.

Le composant `notion-background-sync` rend uniquement l’état `done` et son registre dynamique ne conserve aucune variante CSS sans consommateur. Les anciennes classes `.signal.attractive`, `.notion-background-sync.starting` et `.warning` ont été supprimées après vérification des consommateurs.

Les compteurs de baseline peuvent diminuer ou rester stables. Une nouvelle exception ne doit pas être ajoutée pour faire passer la CI : il faut d’abord prouver le générateur, le périmètre responsive/state/accessibility et documenter l’entrée du registre.

Le test ciblé de l’audit vérifie la baseline, le périmètre des trois feuilles, les catégories de redéfinitions, les primitives dynamiques, `research-score-cell` et les états génériques explicitement scopés :

```bash
npm run test:css-audit
```

## Vérification locale

Depuis la racine du projet :

```bash
npm run storybook
```

Pour vérifier qu’une référence est publiable techniquement sans la publier :

```bash
npm run build-storybook
```

Puis lancer :

```bash
npm run lint
npm run test
npm run audit:css
```

Ces commandes ne déploient rien. La publication Sites et la synchronisation GitHub restent des étapes séparées, à effectuer uniquement après validation fonctionnelle de bout en bout.
