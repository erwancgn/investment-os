# Provider Supabase

Implémentation de référence du contrat `external-database`. Supabase reste optionnel et n’est pas une dépendance du plugin.

Documentation officielle vérifiée le 7 septembre 2026 :

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/changelog

## Préflight

1. Vérifier qu’un projet Supabase est sélectionné et que l’utilisateur est authentifié.
2. Vérifier les capacités réellement exposées par le connecteur ou le CLI.
3. Inspecter le schéma en lecture seule.
4. Vérifier les réglages Data API et les schémas exposés.
5. Ne demander ni clé secrète ni `service_role` dans la conversation.

## Schéma proposé

Présenter le contenu de `assets/supabase/001_investment_os.sql` avant exécution. Ce schéma est volontairement individuel : chaque ligne privée porte `user_id` et les politiques utilisent `auth.uid()`.

Tables :

- `ios_companies` ;
- `ios_portfolio_snapshots` ;
- `ios_analysis_runs` ;
- `ios_analyses` ;
- `ios_handoffs` ;
- `ios_portfolio_positions` ;
- `ios_sources` ;
- `ios_current_analyses`.

## Sécurité obligatoire

- RLS activée sur toutes les tables du schéma exposé.
- Tous les droits retirés à `anon`.
- `authenticated` reçoit uniquement les opérations nécessaires.
- Politiques séparées pour SELECT, INSERT, UPDATE et DELETE.
- UPDATE contient `USING` et `WITH CHECK` et nécessite une politique SELECT.
- Chaque politique vérifie `(select auth.uid()) = user_id`.
- Aucun `SECURITY DEFINER`.
- Aucune clé `service_role` dans un client ou un asset.

RLS et les grants sont deux contrôles distincts. Si la Data API n’expose pas automatiquement les tables, expliquer les grants requis au lieu de désactiver RLS.

## Mise en place

1. Montrer le plan et le SQL.
2. Obtenir l’autorisation explicite.
3. Exécuter le SQL avec le mécanisme disponible ; ne jamais prétendre qu’il a été exécuté si aucun outil n’est connecté.
4. Vérifier les tables, contraintes, index, grants et politiques.
5. Exécuter les tests de `assets/supabase/investment_os_rls.test.sql` dans un environnement adapté.
6. Tester une écriture, une relecture, un retry avec la même clé et une supersession.
7. Conserver le profil `external-database` uniquement si le handshake complet réussit.

## Échec

Après deux ou trois tentatives différentes au maximum, arrêter et expliquer le blocage. Ne contourner ni RLS, ni permissions, ni authentification. Le mode Conversation reste disponible si l’utilisateur ne requiert pas explicitement la persistance.
