# Investment OS — Lot 3.5 : environnement Codex Cloud

## Référence validée

- Dépôt : `erwancgn/investment-os` ; branche `chore/architecture-stabilization-mcp`.
- Racine de la tâche normale : `/workspace/investment-os`.
- HEAD des vérifications initiales : `acacee92aad586df941d8ea936957ab5c1e26fd1`.
- Runtime actif : Node `22.23.1`, npm `11.9.0` ; runtime isolé hors dépôt.
- Lockfile SHA-256 : `b8a15bf6f414fc6d3ca7690e0e8724193f881c9cdc3c5bb9e7ec08309ef637f6`.
- Tâche normale de référence : `01a0f258-5242-75e7-b555-bcf6b76a705f`.

Le blocage initial `Unable to determine project root for task` ne concerne plus cette tâche normale. Une préparation antérieure sous Node 24.19.0/npm 11.9.0 et une session EDIT avaient passé installation, build, typecheck, 185 assertions et validation d’artefact ; ces résultats historiques ne remplacent pas ceux du runtime actif Node 22.

## Commandes existantes et résultats

`npm run install:ci` utilise `npm ci` et le lockfile, sans mise à jour des dépendances. Les tâches normales réutilisent les dépendances présentes ; une réinstallation n’est pas nécessaire quand le reçu d’installation et le lockfile correspondent. Les scripts existants requièrent les outils Linux documentés dans la baseline.

Avant chaque lot, vérifier racine, branche, HEAD, `node -v`, `npm -v`, état Git et empreinte du lockfile. Aligner explicitement le checkout sur le HEAD revu du chantier ; le SHA initial ci-dessus est une preuve historique, pas un pin permanent des lots suivants.

Les commandes réellement exécutées dans la tâche normale sont `npm test` puis `npm run validate:artifact` :

- Typecheck et build : PASS.
- Validation d’artefact : PASS, Worker ESM et manifeste vérifiés.
- Suite agrégée : 18/19 fichiers réussis ; échec de `tests/audit-css-ownership.test.mjs`. Ce comptage par fichiers ne signifie pas 18/19 assertions.

L’environnement et son rattachement sont validés ; la suite Cloud complète reste en échec. Aucun PASS global de reproductibilité des tests n’est revendiqué.

## Limite Cloud ouverte

Le diagnostic Lot 3.5b, clôturé sans code ni artefact conservé, constate des sorties vides lors de l’exécution de sous-processus Node dans ce runtime Cloud. Les fixtures de l’audit exécutées directement depuis le shell donnent les résultats attendus. Le test et l’audit sont identiques à la baseline ; le mécanisme système exact reste indéterminé. Aucun contournement, changement du test ou modification de permission n’a été appliqué.

Pour les lots suivants, conserver cet échec préexistant dans le bilan et compléter les vérifications par un runner compatible. Ne pas déclarer tous les tests verts tant que la suite inchangée ne passe pas. Aucun déploiement Sites, changement de dépendance, lockfile ou méthodologie plugin n’appartient au Lot 3.5. Le GO Lot 4 est une décision explicite de l’utilisateur, distincte du résultat de cette suite.
