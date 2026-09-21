# Dette CSS — état après le Lot 9B

## Statut

Le Lot 9B ferme le chantier de consolidation CSS avant review finale de branche.

Le monolithe `app/ux-foundations.css` n'est plus propriétaire des règles métier. Il est désormais
un point d'entrée ordonné qui importe les modules UX suivants :

- `app/styles/ux/portfolio.css` ;
- `app/styles/ux/discovery.css` ;
- `app/styles/ux/company.css` ;
- `app/styles/ux/analysis-reader.css` ;
- `app/styles/ux/shared-semantics.css` ;
- `app/styles/ux/documents.css` ;
- `app/styles/ux/workspaces.css` ;
- `app/styles/ux/shell.css` ;
- `app/styles/ux/shared-business.css`.

Le découpage a été réalisé uniquement après nettoyage des anciennes strates de cascade. Il ne sert
donc pas à masquer le monolithe : les audits canoniques parcourent explicitement les neuf modules
via `scripts/css-file-manifest.mjs`.

## Résultat du Lot 9B

Baseline de départ :

- 177 sélecteurs exacts répétés ;
- 0 conflit direct de propriétés ;
- 134 variantes responsive ;
- 1 redondance stricte intentionnelle ;
- 42 extensions additives ;
- 292 déclarations `!important` ;
- 0 token répété ou concurrent ;
- 0 classe orpheline.

Nouvelle baseline :

- 174 sélecteurs exacts répétés ;
- 0 conflit direct de propriétés ;
- 132 variantes responsive ;
- 1 redondance stricte intentionnelle ;
- 41 extensions additives ;
- 222 déclarations `!important` ;
- 0 token répété ou concurrent ;
- 0 classe orpheline.

Le Lot 9B a donc retiré 70 déclarations `!important` par rapport à la baseline précédente, réduit
les variantes et extensions de cascade, et conservé zéro conflit direct.

L'audit d'ownership renforcé vérifie en plus les sélecteurs et propriétés au niveau individuel,
y compris lorsque les sélecteurs sont regroupés différemment dans le CSS. Après consolidation :

- aucune chaîne de propriété `globals.css ↔ UX` ne doit subsister ;
- aucune chaîne de propriété concurrente entre modules UX ne doit subsister ;
- aucune chaîne de propriété répétée dans un même module ne doit être acceptée sans justification ;
- `npm run audit:css` doit rester à 0 sélecteur et 0 règle supprimable.

La redondance stricte restante est volontaire : le fallback `.ui-surface--glass` existe dans deux
contextes d'accessibilité distincts et ne doit pas être fusionné tant que ces comportements restent
indépendants.

## Règles d'ownership

1. `globals.css` possède les tokens et primitives visuelles partagées.
2. Les modules `app/styles/ux/*` possèdent composition métier, layout et responsive.
3. `ux-foundations.css` ne contient que l'ordre d'import des modules UX.
4. L'ordre d'import ne doit jamais servir à corriger un conflit d'ownership.
5. Un même sélecteur peut exister dans plusieurs contextes seulement lorsque le contexte exprime
   un vrai comportement responsive/state/accessibility et qu'aucune propriété concurrente ne se
   repose sur la cascade pour obtenir le rendu final.
6. Une primitive partagée est réutilisée avant toute règle visuelle locale équivalente.
7. La baseline est un plafond de non-régression, jamais une cible à relever.

## Garde-fous automatiques

- `npm run audit:css:governance` : tokens, répétitions, conflits, responsive, `!important`,
  classes orphelines et baseline.
- `npm run audit:css:ownership` : collisions de propriétés entre owners et modules.
- `npm run audit:css` : sélecteurs/règles supprimables avec registre dynamique canonique.
- `npm test` : contrats fonctionnels et CSS.
- `npm run build-storybook` + captures 390 px / 1440 px : validation visuelle de référence.

## Prochain lot — Lot 10

Le Lot 10 n'est pas un nouveau refactor CSS par défaut. C'est une review fraîche de toute la branche
`refactor/css-foundation-cleanup` face à `main`.

La review doit couvrir :

1. architecture CSS et respect des owners ;
2. composants React modifiés et absence de compatibilité inutile ;
3. chemins Notion / client resource et absence de régression fonctionnelle ;
4. Storybook, fixtures et couverture visuelle ;
5. tests, audits et workflow CI ;
6. secrets, données personnelles et exposition accidentelle du portefeuille ;
7. code mort ou fichiers devenus inutiles ;
8. diff global face à `main`.

Le résultat du Lot 10 est obligatoirement l'un des deux verdicts suivants :

- `MERGE` ;
- `CHANGES REQUIRED`.

Aucun merge vers `main` ni aucune publication Sites ne fait partie automatiquement du Lot 10.
Ils nécessitent une validation utilisateur explicite après le verdict.
