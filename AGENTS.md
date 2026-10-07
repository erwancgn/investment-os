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

## Architecture permanente et propriétaires canoniques

Chemin actuel des services Investment OS : `consumer → Core services → ports → adapter Notion → Notion/D1`. L'assemblage est `createInvestmentAdapter` dans `adapters/notion/investment-reads.ts` ; `createInvestmentReadAdapter` est son alias de compatibilité, pas une seconde implémentation. Le Worker HTTP et la PWA sont des consommateurs. Les projections techniques existantes restent dans leurs propriétaires ; ce chemin ne signifie pas que tous les endpoints historiques passent déjà par le Core.

Chemin MCP en production : `Skills (plugin Investment OS Analysis) → MCP → Core → ports/adapters`. Le MCP est un transport mince, sans logique métier : `transports/mcp/server.ts` (outils et mapping du contrat 1.0.0, 9 outils dont 2 WRITE : `save_analysis`, `create_company`), `transports/mcp/sites-auth.ts` (seule politique d'identité Sites) et `transports/mcp/site-write-policy.ts` (WRITE propriétaire seul, interrupteur `MCP_WRITE_ENABLED`, budget par appelant). En production, WRITE est ouvert pour le propriétaire (`MCP_WRITE_ENABLED=1`) ; sans cette variable le code reste fermé. La fermeture d'urgence et les limites sont décrites dans `docs/architecture/runtime-variables.md`.

| Nouvelle logique | Propriétaire à compléter ou réutiliser |
| --- | --- |
| Contrats de domaine | `core/contracts/` |
| Politique de sélection Current | `core/analysis/current-selection.ts` |
| Agrégats Portfolio | `core/portfolio.ts`, déjà appelé par l'adapter |
| Orchestration métier, validation des entrées et receipts | `core/services/investment-os.ts` ; ports de domaine dans `core/services/ports.ts` |
| Création de société (écriture Companies, clôture ISIN, requête de doublons en direct) | `adapters/notion/company-writes.ts` ; règle de doublon dans `core/services/market-identity.ts` |
| Propriétés physiques Notion, relations, aliases, UUID, statuts, dates et lecture des pointeurs Current physiques | `adapters/notion/investment-data.ts` et `adapters/notion/sync.ts` selon l'implémentation existante |
| Lecture/écriture et projection D1 | `adapters/notion/` ; assemblage dans `investment-reads.ts`, sources/snapshots/index/sync dans `sync.ts` |
| Writer : promotion des pointeurs physiques, retries, reprise, idempotence et relectures de persistance | `adapters/notion/analysis-writes.ts`, en réutilisant mapping et index existants |
| Cache, snapshots, index, jobs et locks | D1 : projection technique uniquement, jamais propriétaire d'une règle métier |
| Méthodologie financière et orchestration analytique | Skills du plugin Investment OS Analysis, source canonique de la méthode ; jamais stockage, mapping Notion ou politique Current |
| Affichage et interactions | PWA/UI : consommation des résultats, sans recalcul métier |

La décision Current appartient au Core ; la lecture/écriture des relations Current physiques appartient à l'adapter. La validation métier d'un receipt appartient au Core ; la preuve de persistance par relectures appartient au writer. Ne pas confondre agrégation Portfolio du Core et mapping des positions dans l'adapter.

Avant tout nouveau document, Skill ou fichier d'instructions : chercher l'emplacement canonique, compléter ou corriger l'existant, et ne créer un fichier que si l'existant ne peut raisonnablement porter cette responsabilité. `AGENTS.md` porte les règles permanentes de développement ; le plan d'exécution porte la roadmap et les passations portent l'état des lots. Ne pas empiler une seconde couche documentaire.

Avant toute nouvelle logique : identifier son propriétaire dans ce tableau, rechercher son implémentation et ses consommateurs, puis corriger ou réutiliser cette implémentation. Réutiliser notamment le normalizer `app/lib/document-presentation.ts`, le parser/renderer existant (`app/lib/notion-renderer.ts`, `app/lib/notion-block-parser.ts`) et les index de `adapters/notion/sync.ts`. Les réexports `app/lib/investment-data.ts` et `app/lib/notion-sync.ts` ne sont pas des propriétaires alternatifs.

Interdits permanents :

- aucune politique Current, aucun mapping Notion ni calcul Portfolio dupliqué dans un Skill ou dans la PWA/UI ;
- aucun stockage dans les Skills ; aucune méthode financière dans le Core ;
- aucune logique d'hébergement OpenAI/Sites dans les Skills ;
- aucune seconde implémentation d'un parser, mapping, index, policy ou autre logique déjà possédée par un propriétaire canonique ;
- aucune modification de méthodologie financière sous prétexte de migration MCP ;
- aucune dépendance du Core vers React, Notion physique, D1, Sites, MCP ou OpenAI : les détails techniques restent derrière les ports ;
- aucune logique métier dans le transport MCP ;
- aucune création d'options de sélection Notion par le MCP : une option absente est ignorée ou remplacée par « Other », jamais créée.

## Secrets

Aucun secret dans le repo, les logs, fixtures, rapports ou outputs. Avant utilisation, vérifier que le fichier local de secrets est ignoré et non suivi par Git, puis contrôler uniquement la présence des valeurs nécessaires, sans les afficher. Utiliser les secrets configurés seulement si le lot les exige ; ne pas copier leur contenu dans une commande, un diff ou une passation. Aucune valeur secrète ne doit parvenir au client.

## Design system de référence

Le design system partagé est celui réellement exécuté par l’application :

- tokens et fondations du design system : `app/globals.css` ;
- primitives réutilisables : `app/components/ui-primitives.tsx` ;
- écrans de référence et états visuels : `stories/` ;
- règles d’usage et de maintenance : `docs/design-system.md`.

Storybook doit importer les composants de production. Ne pas créer de doublon de composant dans `stories/`. Les fixtures de stories sont uniquement des données d’état et doivent rester petites, explicites et locales. Toute évolution visuelle commence par les tokens ou primitives existants, puis est vérifiée dans les écrans de référence concernés.
