# Références et hiérarchie de vérité

## Règle générale

L’application ne doit pas reconstruire un état courant à partir de documents datés.

1. Les bases Notion synchronisées sont la source de vérité opérationnelle pour les positions actives, les quantités, les PRU, les comptes, les cibles et les statuts.
2. D1 est un cache technique des données Notion et des cotations, jamais une seconde source métier indépendante.
3. Les documents listés ci-dessous sont des références historiques ou des jeux de contrôle. Ils ne doivent pas être copiés dans le code de production, ni utilisés comme fallback silencieux.
4. Toute donnée historique affichée doit porter sa provenance et sa date.
5. En cas de contradiction entre deux documents datés, la version la plus récente n’écrase pas automatiquement Notion : l’écart doit être signalé et arbitré dans Notion.

## Décision d’accès

Le Site est privé et réservé à son propriétaire. Aucune route qui lit le portefeuille,
les analyses, les sociétés ou les URLs Notion ne doit être exposée par un déploiement public.
Cette restriction Sites est la première barrière d’accès ; les mutations Notion restent
en plus strictement serveur-à-serveur.

- Le webhook Notion signé reste le flux principal de mise à jour.
- Une réconciliation périodique peut être déclenchée par un service serveur authentifié.
- Les secrets de synchronisation ne sont jamais transmis au client.
- Les contrôles de synchronisation visibles deviennent informatifs ou sont retirés ; ils ne contiennent pas de secret embarqué.

## Références métier

Les exports et documents personnels utilisés pour les contrôles ne sont pas versionnés
et ne sont pas nécessaires au fonctionnement de l’application. Les propriétés Notion
courantes et les snapshots D1 privés font foi dans l’app ; aucun fichier local de
portefeuille, de ventes, de cibles ou de warrants ne doit être ajouté au dépôt.

## Écarts connus entre références

- La cible 10 k€ du 29 juillet diffère fortement de la cible 10 k€ incluse dans le document du 20 août. L’interface doit lire séparément `Target Weight 10k` et `Target Weight` dans Notion.
- Le document de juillet contient encore Air Liquide, Uber, l’ETF émergents et plusieurs warrants. Le snapshot courant les classe parmi les ventes.
- Le snapshot courant inclut TSMC et Lumentum, absents de l’ancien document de juillet.
- Les warrants Nebius, Micron et Marvell mentionnés dans les documents historiques sont vendus dans le snapshot courant. Aucun ne doit être réintroduit comme position active par un fallback statique.
- Les dates de validation des trajectoires ne doivent pas être codées dans un composant. Elles doivent venir de la donnée ou d’une métadonnée explicitement versionnée.

## Conséquences pour le code

- Supprimer à terme les montants Trade Republic et dates de trajectoire codés en dur.
- Ne jamais calculer la cible 10 k€ à partir du champ 25 k€.
- Ne pas exposer au client des références historiques inutilisées.
- Traiter d’éventuels jeux de test comme des fixtures synthétiques, sans positions personnelles, tokens ou URLs privées.
- Conserver la règle métier actuelle : une position ouverte provient d’une ligne Portfolio Notion `Status=Active` avec une quantité strictement positive.

## Référence visuelle

La référence Lovable active est le projet `Compact Controls Test`, commit `c11099d10e75e010c40d2c926daecc8f97db5370`.

Elle valide notamment :

- les surfaces principales blanches sur canvas neutre ;
- les contrôles compacts visuels de 40 px ;
- les labels centrés et les chevrons fins ;
- le segmented control contenu avec inset de 3 px et segment de 34 px ;
- le shell commun des cartes de découverte ;
- la carte Radar avec identité, badge adjacent, action icon-only, trois signaux, thèmes et thèse.

Lovable est un banc de validation visuelle. Les primitives de production et leurs stories restent l’implémentation canonique.

## Gouvernance du design system Storybook

La baseline GitHub UI/docs de référence est `investment-os/main` au commit
`7cc921e3d26e9f3bafe9411de55a598b78dd854d`. Elle doit être synchronisée ou comparée
au checkout Sites avant le lot Storybook ; ce commit ne constitue pas une autorisation
de modifier la production à lui seul.

La chaîne de vérité est strictement ordonnée :

`ui-primitives.tsx` → `ui-foundation-manifest.md` → Storybook → Lovable

- `ui-primitives.tsx` porte les primitives réellement exécutées en production.
- `ui-foundation-manifest.md` recense leur contrat et les 21 primitives validées.
- Storybook expose les états, compositions et chemins d’accessibilité à vérifier.
- Lovable valide le rendu visuel et les écarts de composition.

Une suppression est interdite sur simple absence visuelle. Elle exige la preuve
simultanée de zéro import/référence de production, zéro usage dynamique, zéro rôle
canonique ou wrapper, zéro story nécessaire, zéro chemin responsive/state/accessibility,
puis le succès du build, du lint, des tests, de Storybook et de l’audit CSS.
