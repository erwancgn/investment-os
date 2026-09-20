# Plan strict de remise en cohérence

## Mode d’exécution

Ce plan doit être exécuté étape par étape. Une étape correspond à un lot autonome.

Pour chaque étape :

1. repartir du HEAD validé du projet Sites ;
2. ne modifier que les fichiers explicitement autorisés ;
3. ne pas anticiper l’étape suivante ;
4. exécuter tous les contrôles demandés ;
5. présenter le diff, les résultats et les risques résiduels ;
6. s’arrêter et attendre la validation utilisateur ;
7. ne pas publier Sites et ne pas synchroniser GitHub sans autorisation explicite.

Les corrections fonctionnelles et visuelles ne doivent pas être mélangées dans un même lot.

### Séquence d’exécution retenue

L’étape 1 sécurité est traitée en premier. Comme le typecheck est un garde-fou
transversal requis par les lots suivants, l’étape 3 est exécutée immédiatement après
l’étape 1, avant l’étape 2 dépendances. Cette inversion est volontaire et ne fusionne
pas les périmètres : l’étape 3 reste limitée au contrat TypeScript et à sa validation.

## Baseline constatée le 20 septembre 2026

- `npm run build` : réussite.
- `npm run lint` : réussite.
- `npm test` : 59 tests réussis.
- `npm run audit:css` : aucun sélecteur déclaré mort.
- `npm run build-storybook` : réussite, avec un avertissement de bundle Storybook supérieur à 500 kB.
- `npm ci --dry-run --ignore-scripts` : réussite ; le lockfile est cohérent avec `package.json`.
- `npx tsc --noEmit` : échec, 117 erreurs.
- `npm audit --omit=dev` : 5 vulnérabilités de production, dont Next.js en criticité critique.

### Baseline UI/Storybook à intégrer

Le dépôt GitHub `investment-os/main` dispose d’une nouvelle baseline UI/docs au commit
`7cc921e3d26e9f3bafe9411de55a598b78dd854d`. Cette baseline doit être récupérée et
comparée au checkout Sites avant toute implémentation de l’étape 5. Elle ne doit pas
être mélangée avec les corrections de sécurité de l’étape 1.

La hiérarchie canonique du design system est absolue :

`app/components/ui-primitives.tsx` → `ui-foundation-manifest.md` → Storybook → Lovable

Le code de production et le manifeste définissent le contrat. Storybook vérifie les
états et les compositions ; Lovable est la référence visuelle validée, pas une source
de code à recopier.

## Étape 1 — Fermer les mutations Notion publiques

### Objectif

Empêcher un visiteur anonyme de déclencher une synchronisation ou de lire le jeton de vérification webhook.

### Fichiers autorisés

- `worker/index.ts`
- `app/page.tsx`
- `app/components/notion-background-sync.tsx`
- `app/components/notion-sync-status.tsx`
- `app/lib/notion-sync-client.ts`
- nouveaux tests de sécurité ciblés dans `tests/`
- `README.md` uniquement pour documenter le contrat final

### Travail attendu

- Ne plus renvoyer `verificationToken` depuis une route GET publique.
- Appliquer la décision produit : Site owner-private, synchronisation strictement serveur.
- Supprimer tout déclenchement automatique ou manuel d’une mutation Notion depuis le navigateur.
- Conserver le webhook signé comme flux principal.
- Prévoir un mécanisme d’autorisation serveur unique pour une éventuelle réconciliation périodique ; aucun secret ne doit être livré au client.
- Protéger `/api/notion/sync`, `/api/notion/import-next`, `/api/notion/sync-background`, `/api/notion/sync-portfolio` et `/api/notion/sync-all`.
- Préserver la vérification HMAC du webhook Notion.
- Ne pas rendre publiques les routes de snapshots ; elles restent accessibles uniquement via le Site owner-private.
- Rendre le panneau de synchronisation informatif ou le retirer s’il n’a plus d’action utile.
- Ajouter des tests prouvant qu’une requête navigateur anonyme est refusée et qu’un appel serveur autorisé est accepté.

### Interdictions

- Ne pas refactorer tout le Worker.
- Ne pas modifier la logique d’import, les verrous ou le TTL.
- Ne pas ajouter de compte administrateur ni de fournisseur d’authentification utilisateur.

### Critères d’acceptation

- Aucun secret ou jeton webhook n’est retourné au navigateur.
- Toutes les mutations refusent une requête non autorisée.
- Le chargement, le retour au premier plan et les actions UI ne lancent aucune mutation Notion.
- Le webhook signé et les lectures publiques continuent de fonctionner.
- Build, lint, tests et typecheck ciblé du Worker passent.

## Étape 2 — Corriger les dépendances vulnérables

### Objectif

Éliminer les vulnérabilités de production sans casser Vinext ou Sites.

### Fichiers autorisés

- `package.json`
- `package-lock.json`
- éventuels fichiers de configuration strictement requis par la mise à jour

### Travail attendu

- Tester la version patchée de Next.js compatible avec Vinext ; `16.3.5` est la première proposition de `npm audit`, pas une mise à jour à appliquer aveuglément.
- Mettre à jour uniquement les dépendances nécessaires à la résolution des alertes.
- Régénérer le lockfile avec la version Node attendue.
- Vérifier l’absence de changement fonctionnel ou visuel.

### Critères d’acceptation

- `npm ci --ignore-scripts` fonctionne depuis un répertoire propre.
- `npm audit --omit=dev` ne contient plus d’alerte critique ou haute applicable à la production.
- Build, tests et Storybook passent.
- Le diff du lockfile est expliqué et limité à la mise à jour retenue.

## Étape 3 — Restaurer le contrat TypeScript

### Objectif

Ramener le dépôt à zéro erreur TypeScript et rendre ce contrôle obligatoire.

### Fichiers autorisés

- `tsconfig.json` et éventuelles configurations TypeScript spécialisées
- déclarations de types Cloudflare
- fichiers actuellement en erreur
- `package.json` pour ajouter le script `typecheck`

### Travail attendu

- Ajouter les types corrects pour `D1Database`, `D1PreparedStatement`, `Fetcher` et `cloudflare:workers`.
- Isoler proprement les environnements app, Worker et Storybook si leurs types sont incompatibles.
- Corriger les vraies erreurs nullables et les fixtures Storybook obsolètes.
- Corriger les stories sans affaiblir les props de production.
- Ajouter `npm run typecheck` au parcours de validation.

### Interdictions

- Ne pas désactiver `strict`.
- Ne pas généraliser `any`, `@ts-ignore` ou `skipLibCheck` comme solution.
- Ne pas modifier la logique métier hors correction nécessaire au typage.

### Critères d’acceptation

- `npm run typecheck` retourne zéro erreur.
- Build, lint, tests et Storybook passent.
- Le script de test ou de CI ne peut plus être vert avec un typecheck rouge.

## Étape 4 — Réconcilier les données portefeuille et trajectoires

### Objectif

Faire de Notion la seule source courante et retirer les données métier statiques obsolètes.

### Fichiers autorisés

- `app/lib/investment-data.ts`
- `app/components/target-allocation.tsx`
- composants portefeuille directement consommateurs
- fixtures et tests métier correspondants
- `docs/reference-sources.md` seulement si une décision métier est précisée

### Travail attendu

- Lire réellement `Target Weight 10k` pour la cible 10 k€ de chaque position.
- Conserver `Target Weight` pour la cible 25 k€.
- Remplacer les dates codées en dur par une provenance de donnée explicite ou supprimer la date si elle n’existe pas dans la source.
- Supprimer `brokerReference`, `targetProgress`, `pnlByAccount` et autres champs uniquement après confirmation qu’ils n’ont aucun consommateur.
- Ajouter des invariants testés : somme des cibles, position active, séparation 10 k€ / 25 k€, absence de réintroduction des positions vendues.
- Utiliser `docs/reference-sources.md` comme règle de provenance ; ne pas recopier les portefeuilles datés dans le runtime.

### Critères d’acceptation

- Une modification du champ 10 k€ dans Notion ne modifie pas la cible 25 k€, et inversement.
- Aucune date ou valeur de portefeuille historique n’est codée dans la réponse live.
- Les tests couvrent au moins une cible différente entre 10 k€ et 25 k€.
- L’interface indique clairement une cible incomplète ou dont le total diffère de 100 %.

## Étape 5 — Verrouiller le contrat Lovable et Storybook

### Objectif

Faire apparaître exactement le contrat visuel validé dans Lovable sans ajouter une nouvelle couche d’overrides.

### Fichiers autorisés

- `app/components/ui-primitives.tsx`
- `app/globals.css`
- `app/iphone-experience.css`
- `stories/UIPrimitives.stories.tsx`
- `stories/ReferenceScreens.stories.tsx`
- `docs/design-system.md`
- `AGENTS.md`

### Travail attendu

- Repartir de la baseline UI/docs `7cc921e…` après avoir vérifié son identité et son
  absence de divergence avec Sites.
- Traiter les 21 primitives recensées par `ui-primitives.tsx` et leur manifeste comme
  le périmètre canonique ; ne pas déduire le périmètre d’une seule capture Lovable.
- Respecter la chaîne de preuve `ui-primitives.tsx` → `ui-foundation-manifest.md` →
  Storybook → Lovable pour toute création, modification ou validation.
- Choisir et documenter une seule source de tokens : `globals.css`.
- Garantir un contrôle visuel de 40 px conformément à Lovable.
- Garantir une cible tactile d’au moins 44 px sans changer le visuel validé de 40 ou 32 px.
- Corriger la contradiction de `iphone-experience.css` sur `.ui-control`.
- Conserver pour Radar : badge adjacent, action icon-only, grille de trois signaux, thèmes et thèse.
- Ajouter des stories à 390 px pour Radar, Companies et Analyses, avec libellés longs et états vide/chargement/erreur.
- Ajouter une vérification visuelle reproductible ; la simple réussite du build Storybook ne suffit pas.

### Interdictions

- Ne pas modifier les calculs ou les données Notion.
- Ne pas recopier les composants Lovable dans le dépôt.
- Ne pas créer de CSS spécifique à Radar pour redéfinir surface, bordure, rayon ou ombre.
- Ne pas augmenter le nombre total de `!important`.
- Ne supprimer aucune primitive, wrapper, story ou style sur simple absence visuelle.
- Toute suppression doit prouver : zéro import/référence de production, zéro usage
  dynamique, zéro rôle canonique ou wrapper, zéro story nécessaire, zéro chemin
  responsive/state/accessibility, puis build, lint, tests, Storybook et audit CSS verts.

### Critères d’acceptation

- Les captures 390 px correspondent à la référence Lovable active.
- Les composants Storybook sont les composants de production.
- Les cibles tactiles et le focus clavier sont vérifiés.
- Le nombre de `!important` et de redéfinitions de tokens diminue ou reste strictement stable.

## Étape 6 — Réduire la dette CSS historique

### Objectif

Retirer progressivement les couches dark/light et overrides devenus inutiles, sans redesign.

### Fichiers autorisés

- `app/globals.css`
- `app/ux-foundations.css`
- `app/iphone-experience.css`
- `app/notion-sync-compact.css`
- script d’audit CSS et tests visuels

### Travail attendu

- Établir les valeurs calculées finales avant suppression.
- Migrer un groupe de composants à la fois.
- Supprimer les anciens blocs dark et les règles compensatoires devenues redondantes.
- Étendre l’audit pour détecter les sélecteurs répétés, tokens redéfinis et conflits de propriété, pas seulement les classes sans consommateur.

### Critères d’acceptation

- Aucun changement visuel non approuvé sur les écrans de référence.
- Réduction mesurable des `!important`, blocs `:root` et sélecteurs répétés.
- Build, tests, audit CSS, Storybook et comparaison visuelle passent.

## Étape 7 — Renforcer les tests de comportement

### Objectif

Remplacer les principaux tests textuels fragiles par des preuves de comportement.

### Fichiers autorisés

- `tests/`
- configuration de test
- `package.json`
- petites adaptations d’export nécessaires à la testabilité

### Travail attendu

- Inclure `tests/quotes-startup.test.mjs` dans la commande standard.
- Tester les projections métier avec des fixtures D1 minimales.
- Tester navigation, clavier, onglets, erreurs et chargement.
- Tester les routes de sécurité ajoutées à l’étape 1.
- Conserver les tests textuels seulement lorsqu’ils valident réellement un contrat de fichier.

### Critères d’acceptation

- La suite standard exécute typecheck, tests métier, sécurité et démarrage des cotations.
- Une régression des cibles 10 k€ / 25 k€ provoque un échec.
- Une route Notion rendue publique provoque un échec.
- Une dérive visuelle des écrans de référence est détectable.

## Étape 8 — Supprimer le code mort et mettre la documentation à jour

### Objectif

Terminer le nettoyage uniquement après sécurisation des comportements.

### Candidats à confirmer

- `app/api/quotes/route.ts`, doublonné par le Worker.
- `examples/d1/` et `db/index.ts`, reliés seulement au template d’exemple.
- `/api/archives`, `/api/notion/sync-portfolio` et `/api/notion/sync-all`, sans consommateur interne connu.
- champs de réponse portefeuille sans consommateur.
- anciens audits UI à archiver.

### Fichiers autorisés

- uniquement les candidats confirmés par recherche de références et, pour les routes, par vérification des usages externes
- `README.md`, `docs/architecture.md`, `docs/data-quality.md`
- `package.json` pour retirer la dénomination `maquette`

### Critères d’acceptation

- Chaque suppression est accompagnée de la preuve d’absence de consommateur.
- Aucun endpoint externe utilisé n’est supprimé sans migration.
- La documentation décrit l’architecture réellement déployée.
- Le dépôt ne contient plus de nom produit `maquette` hors historique explicitement archivé.

## Ordre de priorité

| Priorité | Étapes | Condition de passage |
| --- | --- | --- |
| P0 | 1 puis 2 | Sécurité fermée et dépendances critiques corrigées |
| P1 | 3 puis 4 | Typecheck vert et modèle métier réconcilié |
| P1 UI | 5 | Validation visuelle explicite avant toute publication |
| P2 | 6 puis 7 | Dette CSS réduite et tests comportementaux renforcés |
| P3 | 8 | Suppressions après confirmation des consommateurs |

Luna doit recevoir une seule étape à la fois. Le compte rendu de l’étape précédente devient l’unique contexte additionnel nécessaire pour lancer la suivante.
