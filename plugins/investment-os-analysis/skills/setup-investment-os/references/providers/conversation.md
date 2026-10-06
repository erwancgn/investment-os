# Provider Conversation

Conversation ne nécessite aucun setup. Avec le plugin Site connecté, préfère le [transport MCP officiel](../investment-os-mcp.md) pour les inputs/continuité, sans persistance. Une erreur MCP reste signalée ; aucune connexion directe Notion n’est essayée. Sans transport, utilise les inputs utilisateur et la recherche.

## Comportement

- Produire le rapport complet dans le chat.
- Afficher le handoff canonique.
- Fournir un `EXPORT PAYLOAD` portable.
- Conserver un Run ID et un checkpoint textuel pour les composites.
- Ne jamais prétendre qu’un résultat est persisté.

## Portefeuille

Pour Portfolio Fit, Memo CIO et Full Analyse, demander le portefeuille avant la recherche lourde s’il n’est ni déjà joint ni réellement obtenu par `get_portfolio`. Utiliser les templates présents dans `assets/` si l’utilisateur souhaite un format guidé.

Portfolio Fit indépendant ne continue pas sans portefeuille et retourne `BLOCKED_INPUT`. Full Analyse peut continuer sans lui uniquement sur demande explicite : Portfolio Fit, Memo CIO et le statut global restent provisoires ou partiels.
