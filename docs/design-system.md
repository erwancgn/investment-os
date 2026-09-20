# Design system de référence

## Rôle

Le design system est la source commune de l’application, de Storybook et des validations Lovable. Il ne doit jamais exister une seconde implémentation concurrente : les stories montent les composants réellement utilisés par l’application, et Lovable sert uniquement de banc de validation visuelle.

## Sources canoniques

| Besoin | Source |
| --- | --- |
| Primitives React partagées | [`app/components/ui-primitives.tsx`](../app/components/ui-primitives.tsx) |
| Contrats visuels des primitives, surfaces et tokens globaux | [`app/globals.css`](../app/globals.css) |
| Layouts métier, composition responsive et compatibilité historique | [`app/ux-foundations.css`](../app/ux-foundations.css) |
| Références exécutables et données d’état | [`stories/`](../stories/) |

Les valeurs ne doivent pas être recopiées dans cette documentation. En cas de divergence, les primitives de production et leurs stories font foi.

## Contrat de surface

1. Le canvas de page est neutre et distinct du contenu.
2. Une surface de contenu de premier niveau utilise `primary` : carte métier, recherche, KPI, liste documentaire.
3. `secondary` est réservé aux informations réellement imbriquées ou de soutien ; il ne doit pas servir à griser arbitrairement une carte de premier niveau.
4. `glass` est réservé au chrome, à la navigation, aux menus flottants et aux surfaces qui se superposent au contenu.
5. `DiscoveryCard` porte le shell commun des cartes Companies, Radar et Analyses : un écran peut organiser son contenu interne, mais ne redéfinit pas localement fond, bordure, rayon ou ombre.
6. Les contrôles compacts partagés utilisent `CompactControl`. Ils mesurent 40 px de haut, s’adaptent au libellé visible avec 18 px de gouttière horizontale de chaque côté, et gardent le texte centré indépendamment du chevron. Le chevron reste discret (10 px, trait 1,25 px) et le bouton icône conserve 40 × 40 px avec une icône de 12 px.
7. Un segmented control contenu utilise 3 px d’inset uniforme dans un conteneur de 40 px ; le segment actif mesure 34 px de haut. Les filtres existants restent libres d’utiliser la variante non contenue quand le contexte l’exige.

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
