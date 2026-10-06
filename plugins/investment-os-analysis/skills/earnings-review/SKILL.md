---
name: earnings-review
description: Documente les derniers résultats d’une entreprise cotée et détermine quelles analyses doivent être actualisées. Utiliser pour /earnings, post-earnings review ou triage après résultats ; ne produit ni score, ni juste valeur, ni décision d’investissement.
---

# Earnings Review

Documente ce qui a changé et route les refreshs sans modifier les analyses Current.

## Ressources obligatoires

Lis intégralement :

- [Earnings Review Framework](references/earnings-review-framework.md), autorité méthodologique ;
- [contrat d’exécution portable](references/execution-contract.md), autorité runtime et persistance.

Lis aussi le [transport officiel Investment OS MCP](references/investment-os-mcp.md). Le flux MCP actif utilise le profil Conversation en lecture seule : charge les inputs/continuité par les outils requis, conserve les diagnostics, puis rends le rapport et l’export avec `NOT_REQUIRED`. Les instructions de publication ci-dessous concernent exclusivement un profil historique persistant explicitement choisi ; elles n’activent aucune écriture MCP.

## Plan d’outils MCP

- **Requis, dans l’ordre :** `resolve_company(query, market?)` → `get_company(id=companyId)`.
- **Conditionnels :** lire `get_current_analysis` pour les familles directement concernées par le triage (business, valuation, short, portfolio, earnings) ; lire une revue antérieure par `get_analysis_by_id` seulement si une archive est explicitement identifiée et utile. Portfolio, position et quote ne sont pas requis par défaut.
- Réutilise les Current et la précédente revue déjà récupérés; ne relance aucun module. `ambiguous` exige une clarification, `not_found` n’autorise aucune création.
- Applique les erreurs, forbidden, timeout et receipt selon la référence MCP. Persistance : READ-only par défaut, `NOT_REQUIRED`; `save_analysis` est conditionnel au support existant du type et à un runtime autorisé, avec receipt conservé.

## Préflight et recherche

- Résous l’entreprise, la période, la langue, le profil et un Run ID stable.
- Lis les analyses Current et la précédente revue si elles existent.
- Leur absence ne bloque pas un cold start : compare la publication à la période précédente, à la guidance et au consensus disponible.
- Collecte pendant ce run la publication officielle, le filing ou le transcript officiel. Une rumeur seule ne peut jamais déclencher Refresh required.

## Exécution

Applique le framework et classe chaque module : No refresh needed, Monitor, Refresh recommended ou Refresh required.

Ne lance jamais automatiquement un autre module. Ne modifie ni hypothèses, ni scores, ni Current. Le score vaut toujours null.

## Sortie

Produis l’EARNINGS REVIEW CARD, le rapport court et :

### HANDOFF — EARNINGS

- Contract version : 1.3.0
- Plugin version : 1.3.10
- Run ID :
- Module : earnings
- Entreprise et ticker :
- Publication et période :
- Source officielle et retrieved_at :
- Faits nouveaux :
- Guidance :
- Business refresh :
- Valuation refresh :
- Short refresh :
- Portfolio refresh :
- Gaps :
- Score : null

Termine par le RUN RECEIPT. Persiste la revue uniquement si le provider possède déjà un type compatible ; ne crée aucune relation Current. Sinon rends l’EXPORT PAYLOAD.
