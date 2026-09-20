# Investment OS

Investment OS est une PWA mobile-first de suivi et de recherche d'investissements. Notion est la source documentaire, Cloudflare D1 le cache technique et un Worker Sites/Vinext sert l'interface et les routes serveur.

## Objectif produit

L'application permet de consulter le portefeuille, les positions, le PRU, les plus-values et les cotations en EUR ; comparer le portefeuille aux trajectoires 10 k€ et 25 k€ ; suivre les sociétés et la watchlist ; consulter les analyses Business, Valuation, Short Seller, Portfolio Fit, Memo et Earnings ; rechercher dans les documents ; afficher la version actuelle et conserver les historiques ; contrôler la qualité des relations et la fraîcheur des données.

## Schéma fonctionnel

~~~mermaid
flowchart TD
  U[Utilisateur] --> P[Portfolio]
  U --> C[Compagnies]
  U --> A[Analyses]
  U --> W[Watchlist]
  U --> G[Gestion]
  P --> Q[Cotations live]
  C --> D[Fiche société]
  D --> R[Analyse actuelle par type]
  D --> H[Historique et archives]
  G --> S[État de synchronisation]
~~~

### Règles métier principales

| Domaine | Règle |
| --- | --- |
| Identité | L'identifiant Notion canonique est la clé ; le titre n'est jamais une identité. |
| Analyse actuelle | Une seule analyse Current est affichée par société et par type. |
| Fraîcheur | Source Freshness = Current et Status = Validated sont prioritaires ; à statut équivalent, la version au last_edited_time le plus récent est retenue. |
| Archives | Les versions précédentes restent consultables sans remplacer la version actuelle. |
| Relations | Les relations Notion et l'index D1 many-to-many relient les documents aux sociétés ; une mention secondaire ne devient pas la société principale. |
| Owned | Une société est détenue si une position Portfolio est Active avec une quantité strictement positive. |
| Portefeuille | Portfolio est synchronisé en priorité ; les quantités, statuts, PRU et trajectoires sont reflétés après synchronisation. |
| Cotations | Yahoo Finance (query2 puis query1) est essayé avant Google Finance ; le dernier cours valide est conservé avec sa provenance et ses horodatages. |

## Schéma technique

~~~mermaid
flowchart LR
  N[Notion] -->|métadonnées et blocs| W[Worker Sites]
  WH[Webhook Notion] -->|événement signé| W
  W --> D[(Cloudflare D1)]
  D --> UI[PWA React/Vinext]
  W --> Y[Yahoo Finance]
  W --> GF[Google Finance fallback]
~~~

### Responsabilités

| Composant | Responsabilité |
| --- | --- |
| Notion | Companies, Analyses, Earnings, Portfolio, Watchlist, Decisions et Sources. |
| worker/index.ts | Routes API, webhook, signature, orchestration des synchronisations et bindings Cloudflare. |
| app/lib/notion-sync.ts | Découverte, comparaison des versions, file d'import, pagination, reprise et reconstruction des relations. |
| D1 | Snapshots, états de synchronisation, verrous, file d'import, événements webhook, relations et cache des cotations. |
| app/components/ | Rendu des écrans, états de chargement/erreur et rafraîchissements. |
| app/lib/investment-data.ts | Projection des snapshots D1 en modèles portefeuille, sociétés, analyses et watchlist. |

## Synchronisation Notion, TTL et webhook

L'interface affiche d'abord les snapshots D1. Les mutations Notion sont strictement serveur-à-serveur : le navigateur ne déclenche aucune synchronisation et ne reçoit aucun secret. Les mises à jour courantes arrivent par le webhook Notion signé ; une réconciliation périodique peut appeler les routes internes avec le jeton serveur `NOTION_SYNC_AUTH_TOKEN` dans `Authorization: Bearer <token>`.

Les sept sources Notion sont parcourues, mais les blocs ne sont téléchargés que pour une page nouvelle ou dont le last_edited_time a changé. La comparaison utilise page_id + last_edited_time, jamais le titre.

Les analyses volumineuses sont importées dans une file D1 durable :

1. les métadonnées sont enregistrées en premier ;
2. les blocs sont lus par requêtes courtes et paginées ;
3. curseur, progression, tentatives et erreurs sont persistés ;
4. un appel suivant reprend au dernier point connu ;
5. l'ancienne version reste visible jusqu'à la publication atomique de la nouvelle version complète.

Les verrous sont séparés par source afin qu'une analyse lente ne bloque pas le portefeuille. Les événements webhook sont dédupliqués, vérifiés par HMAC et convertis en tâches idempotentes. Le webhook accélère la détection ; la file D1 assure l'import et la reprise.

## Routes principales

| Route | Usage |
| --- | --- |
| GET /api/notion/status | État du cache, des sources, de la file et du webhook. |
| POST /api/notion/sync-background | Découverte TTL serveur-à-serveur, protégée par `NOTION_SYNC_AUTH_TOKEN`. |
| POST /api/notion/sync | Synchronisation contrôlée d'une source, serveur-à-serveur uniquement. |
| POST /api/notion/import-next | Traitement borné du prochain lot de blocs, serveur-à-serveur uniquement. |
| POST /api/notion/sync-portfolio | Réconciliation serveur du portefeuille, protégée par `NOTION_SYNC_AUTH_TOKEN`. |
| POST /api/notion/sync-all | Réconciliation serveur de toutes les sources, protégée par `NOTION_SYNC_AUTH_TOKEN`. |
| POST /api/notion/webhook/<secret> | Réception et mise en file des événements Notion. |
| GET /api/notion/webhook-verification | Route désactivée ; aucun jeton n'est exposé. |
| GET /api/companies, /api/analyses, /api/archives, /api/watchlist | Données projetées pour l'interface. |
| GET /api/quotes | Cotations avec cache, provenance et fallback fournisseur. |

## Fraîcheur, performance et robustesse

- Le rendu initial ne dépend pas d'un appel Notion : il utilise D1.
- Le scan des métadonnées est différé et limité par le TTL d'une heure.
- Les bases sont traitées de manière contrôlée et les imports de blocs sont séquentiels par lot pour respecter les limites Notion.
- Une requête d'import traite au maximum quatre réponses de blocs par défaut.
- Les réponses 429, les verrous et les interruptions sont rejouables.
- Une version ancienne ne peut pas écraser une version plus récente.
- Après plusieurs échecs, une tâche est exposée comme erreur au lieu de boucler indéfiniment.
- Aucun bouton ou cycle de vie du navigateur ne déclenche une mutation Notion.

### Autorisation des réconciliations serveur

`NOTION_SYNC_AUTH_TOKEN` est une variable d'environnement privée du Worker et du service serveur qui déclenche éventuellement une réconciliation périodique. Elle ne doit jamais être préfixée par `NEXT_PUBLIC_`, injectée dans le bundle client ou placée dans le dépôt. Les cinq routes de mutation refusent les requêtes sans `Authorization: Bearer <token>` correspondant. Le webhook conserve son propre secret de chemin et sa vérification HMAC ; ce mécanisme n'est pas utilisé par le navigateur.

## Développement local

Prérequis : Node.js >=22.13.0, Linux avec flock, curl et GNU timeout.

~~~bash
npm run install:ci
npm run dev
npm run lint
npm test
npm run build
~~~

Les migrations sont générées avec npm run db:generate. Les variables locales restent dans un fichier .env non versionné. Les valeurs hébergées sont gérées par Sites ; aucun secret Notion ne doit être ajouté au dépôt.

## Workflow de versioning et de déploiement

Le déploiement de production reste piloté par Sites :

1. modifier le checkout du projet ;
2. vérifier le changement et les tests concernés ;
3. créer un checkpoint cohérent ;
4. laisser Sites construire et publier la version ;
5. vérifier le statut du déploiement.

Chaque checkpoint cohérent correspond à un commit dans le dépôt Git interne du projet. Une modification en cours de travail n'est pas forcément commitée immédiatement : les petits changements sont regroupés jusqu'à un jalon vérifiable.

Le dépôt GitHub [erwancgn/investment-os](https://github.com/erwancgn/investment-os) est une copie versionnée du code, mais il n'est pas la source automatique du déploiement Sites. Une modification faite dans Sites doit être exportée vers GitHub séparément pour maintenir les deux dépôts alignés.

## Sécurité et données

- Le Site est owner-private : les routes de données ne doivent jamais être déployées avec une audience publique.
- L’arbre courant ne contient ni token Notion, ni secret webhook, ni export de portefeuille ou données D1 de production.
- Les anciens snapshots et exports sensibles ont été retirés de l’historique Git ; les sources métier restent hors du dépôt.
- Le webhook est protégé par un secret de chemin, un jeton de vérification et une signature HMAC sha256.
- Les pages Notion sont lues côté Worker ; le navigateur ne reçoit que les snapshots nécessaires.
- Les données non confirmées conservent leur provenance et leur date.

## Documentation complémentaire

- [docs/architecture.md](docs/architecture.md) — architecture et séparation des responsabilités ;
- [docs/analysis-rendering-contract.md](docs/analysis-rendering-contract.md) — contrat de rendu des analyses ;
- [docs/data-quality.md](docs/data-quality.md) — règles d'intégrité et de qualité ;
- [docs/reference-sources.md](docs/reference-sources.md) — hiérarchie des sources métier et références visuelles ;
- [docs/remediation-plan.md](docs/remediation-plan.md) — plan strict de sécurisation, alignement et nettoyage par étapes ;
- [docs/ui-audit-v74.md](docs/ui-audit-v74.md) — audit de la dette UI/CSS.
