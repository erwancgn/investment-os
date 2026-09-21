# Design system de référence

## Rôle

Le design system est la source commune de l’application, de Storybook et des validations Lovable. Il ne doit jamais exister une seconde implémentation concurrente : les stories montent les composants réellement utilisés par l’application, et Lovable sert uniquement de banc de validation visuelle.

## Sources canoniques

| Besoin | Source |
| --- | --- |
| Entrée CSS publique commune à la production et Storybook | [`app/design-system.css`](../app/design-system.css) |
| Primitives React partagées | [`app/components/ui-primitives.tsx`](../app/components/ui-primitives.tsx) |
| Contrats visuels des primitives, surfaces et tokens globaux | [`app/globals.css`](../app/globals.css) |
| Ordre public des modules UX | [`app/ux-foundations.css`](../app/ux-foundations.css) |
| Layouts métier et composition responsive | [`app/styles/ux/`](../app/styles/ux/) |
| Références exécutables et données d’état | [`stories/`](../stories/) |

Les valeurs ne doivent pas être recopiées dans cette documentation. En cas de divergence, les primitives de production et leurs stories font foi.

### Entrée et propriété CSS

`app/design-system.css` est l’unique entrée CSS publique. `app/layout.tsx` et `.storybook/preview.ts` l’importent directement, dans cet ordre immuable : Tailwind, fondations UX, puis globals canoniques. `stories/storybook.css` reste une feuille de contexte Storybook, pas une seconde entrée du design system.

`app/globals.css` est l’unique propriétaire des tokens canoniques et des primitives visuelles partagées. `ux-foundations.css` est uniquement l’agrégateur ordonné des modules `app/styles/ux/*`. Ces modules portent la composition métier et le responsive sans redéfinir de bloc `:root`. `scripts/css-file-manifest.mjs` est la liste canonique utilisée par les audits afin qu’un découpage de fichier ne puisse jamais masquer la dette de cascade.

## Contrat de surface

1. Le canvas de page est neutre et distinct du contenu.
2. Une surface de contenu de premier niveau utilise `primary` : carte métier, recherche, KPI, liste documentaire.
3. `secondary` est réservé aux informations réellement imbriquées ou de soutien ; il ne doit pas servir à griser arbitrairement une carte de premier niveau.
4. `glass` est réservé au chrome, à la navigation, aux menus flottants et aux surfaces qui se superposent au contenu.
5. `DiscoveryCard` porte le shell Apple Light / Liquid Glass commun des cartes Companies, Radar et Analyses : un écran peut organiser son contenu interne, mais ne redéfinit pas localement fond, bordure, rayon ou ombre. Le shell partagé est aligné avec la référence Lovable validée et se configure via le contrat commun de surface, jamais via un override d'écran. Les informations réellement imbriquées peuvent utiliser de petites surfaces secondaires. Le hover/focus léger reste une interaction voulue.
6. Le titre principal d’une DiscoveryCard peut occuper jusqu’à deux lignes dans une piste flexible `minmax(0, 1fr)`. Il utilise le token sémantique `--font-discovery-title`. Toute information interne secondaire reste typographiquement sous ce niveau : valeurs de signal au plus en `--font-sm`, métadonnées et labels en `--font-xs` ou plus petit. Les badges, statuts et actions occupent des pistes `auto` non réductibles : le titre ne peut ni les chevaucher ni leur prendre leur espace, et la carte conserve une hauteur intrinsèque.
7. Le Radar conserve la hiérarchie visuelle validée dans Lovable : identité + statut + action, puis décision / ownership / confiance, thèmes, enfin thèse secondaire.
8. Toute action interactive conserve une zone cible d’au moins 44 × 44 px. Les contrôles compacts partagés utilisent `CompactControl` : leur zone interactive mesure 44 px de haut autour d’un visuel de 40 px, avec 18 px de gouttière horizontale de chaque côté. Le chevron reste discret (10 px, trait 1,25 px) et le bouton icône conserve un visuel 40 × 40 px avec une icône de 12 px.
9. Un segmented control contenu conserve lui aussi une zone interactive de 44 px ; son conteneur visuel reste à 40 px avec 3 px d’inset uniforme et le segment actif à 34 px. Il est réservé aux bascules de mode compactes, pas aux taxonomies longues.
10. Pour les filtres visibles, jusqu’à six choix utilisent des pills séparées via `SegmentedControl`. Au-delà de six choix, ou pour une taxonomie dynamique comme les thèmes, les choix sont placés dans une `DisclosureSurface` ; le Radar Thèmes est l’exemple canonique. Aucun comportement automatique basé sur le nombre d’options n’est caché dans la primitive : la composition reste explicite dans l’écran.
11. `SearchField` conserve recherche et compteur sur une seule ligne au viewport mobile de référence ; la recherche prend `minmax(0, 1fr)` et le compteur reste en `max-content`, avec une hauteur interactive commune.
12. Une synthèse de `StatCard` affiche 1 à 3 KPI sur une ligne, 4 KPI en grille 2 × 2, et 5 à 6 KPI en grille 3 × 2. Au-delà de six KPI, le contenu n’est plus considéré comme une synthèse : les indicateurs prioritaires restent visibles et le complément passe dans un niveau de détail ou une disclosure.

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
7. Toute passe UI doit réduire ou stabiliser les sélecteurs répétés, les conflits directs, les redondances, les déclarations `!important`, les tokens concurrents et les classes orphelines. Les variantes responsive et les extensions additives sont des métriques de revue, pas des erreurs par nature : elles peuvent augmenter ponctuellement uniquement si elles sont locales, intentionnelles et justifiées par un vrai contexte responsive, state ou accessibility, avec baisse de la complexité globale.
8. Pour le Portfolio, les modules UX sont propriétaires de la composition desktop/mobile des positions, de l’exposition et de Trajectoire. `globals.css` ne doit plus contenir d’ancienne grille Portfolio ou de mécanique de cible concurrente ; les surfaces Apple Light / Liquid Glass restent fournies par les primitives partagées.
9. Pour le Shell, `GlassChrome` porte le matériau Liquid Glass de la sidebar et de la navigation mobile. les modules UX portent uniquement leur géométrie et la composition du branding, du header, du menu compte et de la bannière PWA ; `globals.css` ne redéfinit pas ces éléments métier.
10. Pour les lecteurs Analyse / Memo, `globals.css` conserve uniquement les primitives documentaires génériques (`notion-page`, `DisclosureSurface`, surfaces). les modules UX sont les propriétaires de la composition du Reader : hero, largeur de lecture, TL;DR, sections, Decision Card, source disclosure et adaptations mobile.
11. Pour la Recherche documentaire, `SearchField` et les classes `ui-search-*` restent des primitives dans `globals.css`. les modules UX sont les propriétaires du workspace, des filtres, résultats, états vide/sans résultat et adaptations mobile. L’ancienne classe `research-hero` ne fait plus partie du contrat de production.
12. L’ordre public reste `ux-foundations.css` puis `globals.css`. `ux-foundations.css` importe les modules UX dans l’ordre canonique documenté par `scripts/css-file-manifest.mjs`. Cet ordre ne doit pas servir de mécanisme de résolution des conflits : les modules UX possèdent la composition métier/responsive et `globals.css` les tokens/primitives. L’audit d’ownership doit rester à zéro chaîne de propriété `globals ↔ UX` et zéro chaîne concurrente entre modules.
13. Pour Radar et Companies, les modules UX portent la composition des listes, résumés, références d’analyse et variantes responsive. `DiscoveryCard` reste propriétaire du shell visuel Apple Light / Liquid Glass ; les cinq références Company restent des surfaces secondaires et ne sont jamais dupliquées dans `globals.css`.

## Gouvernance CSS et baseline de migration

La dette CSS est mesurée par `scripts/audit-css-governance.mjs`. Son périmètre est défini par
`scripts/css-file-manifest.mjs` et couvre les neuf modules UX, `app/globals.css` et
`stories/storybook.css`. Le fichier agrégateur `ux-foundations.css` n'est volontairement pas
compté comme une seconde source de règles.

Après le Lot 9B, la baseline versionnée est :

- 174 sélecteurs exacts répétés ;
- 0 conflit direct ;
- 132 variantes responsive ;
- 1 redondance stricte intentionnelle ;
- 41 extensions additives ;
- 0 token répété ou concurrent ;
- 222 déclarations `!important` ;
- 317 classes définies ;
- 0 classe orpheline.

`audit-css-ownership.mjs` complète la gouvernance en analysant les sélecteurs individuels même
lorsqu'ils appartiennent à des groupes CSS différents. Le contrat de sortie du Lot 9B est zéro
chaîne de propriété entre `globals.css` et les modules UX, zéro chaîne concurrente entre modules
UX, et zéro chaîne répétée intra-module non justifiée.

Les seuils ne doivent jamais être relevés pour masquer une dette. Une baisse est figée uniquement
après suppression effective de code/cascade et validation du gate complet.

```bash
npm run audit:css:governance
npm run audit:css:ownership
npm run audit:css
npm run test
```

### Registre des classes dynamiques

Une classe n’est exemptée de l’analyse des orphelines que si son générateur est documenté dans [`scripts/css-audit-registry.mjs`](../scripts/css-audit-registry.mjs). Chaque entrée indique le fichier/composant producteur, les valeurs admises et la raison du contrat. Les mots génériques présents dans les données ou les variables (`error`, `warning`, `running`, etc.) ne prouvent pas à eux seuls qu’une classe CSS est consommée.

Le composant `notion-background-sync` rend uniquement l’état `done` et son registre dynamique ne conserve aucune variante CSS sans consommateur. Les anciennes classes `.signal.attractive`, `.notion-background-sync.starting` et `.warning` ont été supprimées après vérification des consommateurs.

Les seuils de baseline ne doivent jamais être relevés pour masquer une dette. Les sélecteurs répétés, conflits directs, redondances, déclarations `!important`, tokens concurrents et classes orphelines sont des métriques strictes : elles doivent rester stables ou diminuer après un lot. Les variantes responsive et extensions additives sont des métriques de revue ; une hausse n’est acceptable que si elle est intentionnelle, locale, liée à un vrai contexte responsive/state/accessibility et documentée dans le même commit. Le nombre de classes définies est informatif ; toute nouvelle classe doit néanmoins avoir un consommateur prouvé. Le volume total de règles et la complexité de cascade doivent tendre à diminuer.

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
