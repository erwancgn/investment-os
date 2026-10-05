# Investment OS — architecture cible

> Document historique antérieur au chantier de stabilisation. La [cible du Lot 2](architecture/target-architecture.md) le remplace pour ce chantier ; la [baseline](architecture/baseline.md) décrit le runtime actuel. Les mentions ci-dessous de Portfolio en fichiers, d'index D1 futur et d'export Supabase/Vercel ne décrivent pas l'état actuel ni le périmètre autorisé.

## Décision actuelle

Le produit reste hébergé sur Sites pendant la phase de validation mobile. Notion demeure la source documentaire, le Worker Sites sert l’interface et les routes serveur, et D1 conserve uniquement les données techniques qui gagnent à être mises en cache.

Cette architecture n’utilise pas l’API OpenAI. La recherche est plein texte et locale. Les analyses IA continuent d’être produites dans ChatGPT puis enregistrées dans Notion.

## Flux de données

1. Les analyses sont écrites et validées dans Notion.
2. Une synchronisation contrôlée copie les pages autorisées en snapshots structurés.
3. L’application rend ces snapshots sans résumé généré.
4. Le Worker récupère les cours via Yahoo Finance query2, puis query1, puis Google Finance.
5. Chaque dernier cours valide est conservé dans D1 avec sa source et ses horodatages.
6. L’interface indique explicitement la fraîcheur et utilise le dernier cours valide quand les fournisseurs échouent.

## Séparation des responsabilités

- Notion : compagnies, analyses, earnings, watchlist, décisions et historique.
- Fichiers structurés : positions, quantités, PRU, comptes et allocation cible issus de la projection portefeuille.
- D1 : cache des cotations et, plus tard, index de recherche/synchronisation.
- Sites Worker : secrets, appels externes, validation des réponses et API privées.
- Client : visualisation, calculs dérivés et navigation mobile.

## Contrat de vérité

Toute donnée affichée doit comporter une provenance et une date. Une donnée non confirmée est affichée comme telle ; elle ne doit pas être transformée en métrique « réelle ». Les versions historiques des analyses restent consultables mais sont distinguées des versions actuelles.

## Export futur

Le code est déjà versionné en Git et organisé pour être exporté. Une migration vers GitHub + Next.js + Supabase + Vercel remplacera :

- D1 par Postgres/Supabase ;
- la synchronisation de snapshots par une tâche serveur ;
- l’authentification Sites par Supabase Auth ou un accès Vercel protégé ;
- le Worker vinext par les routes serveur Next.js.

Les composants React, les données Notion normalisées, le moteur de recherche local et la logique de fournisseurs de cours restent réutilisables.
