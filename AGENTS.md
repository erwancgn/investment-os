# Investment OS — Agent instructions

## Source de travail

Le checkout actuel du projet Sites est la source opérationnelle du code et du déploiement.

GitHub est un miroir périodique et peut être en retard sur Sites. Ne jamais utiliser GitHub pour remplacer, restaurer ou écraser automatiquement le code Sites.

Toute modification doit partir de l’état actuel du projet Sites.

Ne jamais implémenter à partir du seul contexte conversationnel ou de la mémoire.

## Avant de modifier

Inspecter uniquement le périmètre pertinent :

1. rechercher les composants, helpers, styles, routes et tests liés à la demande ;
2. identifier l’implémentation réellement utilisée ;
3. tracer ses principaux appels et consommateurs ;
4. lire la documentation pertinente pour ce périmètre.

Ne pas lire ou refactorer tout le repository sans nécessité démontrée.

## Choix de la solution

Utiliser le plus petit changement complet et cohérent répondant au besoin.

Avant de créer du code, vérifier dans cet ordre :

1. Le besoin nécessite-t-il réellement une modification ?
2. Le comportement existe-t-il déjà ?
3. Une implémentation existante peut-elle être corrigée ou réutilisée ?
4. La plateforme ou une dépendance déjà installée couvre-t-elle le besoin ?
5. Seulement ensuite, écrire le minimum de nouveau code nécessaire.

Ne pas ajouter sans nécessité démontrée :

- de dépendance ;
- d’abstraction pour un seul cas ;
- de composant, helper, style ou transformation en doublon ;
- de comportement pour un besoin hypothétique ;
- de couche de compatibilité sans consommateur réel.

Ne jamais simplifier au détriment de la validation, de la sécurité, de l’accessibilité, de la gestion des erreurs, de l’intégrité des données ou de la lisibilité.

## Nettoyage

Lorsqu’une modification remplace une implémentation :

1. rechercher ses références ;
2. migrer les consommateurs concernés ;
3. supprimer le code, les propriétés, styles et imports devenus inutilisés ;
4. vérifier que la suppression ne concerne aucun autre flux.

Supprimer le code rendu obsolète par le changement.

Ne pas étendre la tâche à un nettoyage général sans rapport direct. Signaler séparément la dette préexistante découverte.

## Vérification

Avant de terminer :

1. relire le diff complet ;
2. vérifier que chaque fichier modifié est nécessaire ;
3. vérifier qu’aucune implémentation existante n’a été dupliquée ;
4. lancer les tests proportionnés au changement ;
5. utiliser les audits existants lorsque leur périmètre est concerné ;
6. tester les consommateurs lorsqu’un composant partagé est modifié.

Ne pas déclarer un déploiement réussi avant sa confirmation par Sites.

La synchronisation GitHub est une opération séparée, effectuée à partir d’un état Sites validé. Une tâche Sites ne doit pas être bloquée parce que GitHub n’est pas encore synchronisé.

## Design system de référence

Le design system partagé est celui réellement exécuté par l’application :

- tokens et fondations du design system : `app/globals.css` ;
- primitives réutilisables : `app/components/ui-primitives.tsx` ;
- écrans de référence et états visuels : `stories/` ;
- règles d’usage et de maintenance : `docs/design-system.md`.

Storybook doit importer les composants de production. Ne pas créer de doublon de composant dans `stories/`. Les fixtures de stories sont uniquement des données d’état et doivent rester petites, explicites et locales. Toute évolution visuelle commence par les tokens ou primitives existants, puis est vérifiée dans les écrans de référence concernés.
