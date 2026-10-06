---
name: fair-value
description: Analyse la valorisation d’une entreprise cotée au cours actuel. Utiliser pour /valorisation, /valuation, /valuation-check, juste valeur, scénarios, rendement attendu, croissance pricée ou prix maximal ; un cold start exécute d’abord le Business requis.
---

# Fair Value

Évalue le rendement actionnarial attendu au prix réellement observé.

## Ressources obligatoires

Lis intégralement :

- [Valuation Check Framework](references/valuation-check-framework.md), autorité méthodologique et de scoring ;
- [contrat d’exécution portable](references/execution-contract.md), autorité runtime et persistance.

Version canonique du framework : 2026-09-12-three-factor-neutral. N’utilise aucune version mémorisée ou ressource externe au plugin.

Lis aussi le [transport officiel Investment OS MCP](references/investment-os-mcp.md). Le flux MCP actif utilise le profil Conversation en lecture seule : charge les inputs/continuité par les outils requis, conserve les diagnostics, puis rends le rapport et l’export avec `NOT_REQUIRED`. Les instructions de publication ci-dessous concernent exclusivement un profil historique persistant explicitement choisi ; elles n’activent aucune écriture MCP.

## Plan d’outils MCP

- **Requis, dans l’ordre :** `resolve_company(query, market?)` → `get_company(id=companyId)` → `get_quote(assetId)` si un assetId canonique est disponible → Business compatible → analyse.
- **Conditionnels :** `get_current_analysis` pour Business si aucun handoff compatible du même run ou fourni n’existe, et pour Valuation si sa continuité est nécessaire ; `get_analysis_by_id` seulement pour hydrater une analyse historique explicitement identifiée. Réutilise l’assetId du candidat ou l’assetId canonique retourné par Company; sans assetId, marque le prix MCP indisponible et utilise les sources de marché exigées par le framework; ne substitue pas un companyId.
- `ambiguous` exige une clarification avant le prix; `not_found` interdit toute Company créée ou ID deviné. Complète Business → Valuation selon le workflow et réutilise le même contexte.
- Applique les erreurs, forbidden, timeout et receipt selon la référence MCP. Persistance : aucune en production READ-only; si WRITE est séparément autorisé, soumets chaque output attendu une fois et conserve chaque receipt.

## Préflight Business

Une Valuation complète exige un HANDOFF — BUSINESS compatible.

Priorité :

1. handoff Business du même run ;
2. handoff fourni dans la conversation ;
3. Current Business Analysis Validated, Current, pertinente et suffisamment fraîche ;
4. sinon route vers le workflow Business → Valuation du skill Full Value appartenant à la même version 1.3.0.

Le cold start produit Business puis Valuation avec le même Run ID ; leur publication v1 concerne uniquement le profil historique persistant explicitement choisi. Il ne lance ni Short, ni Portfolio, ni Memo. Si les ressources du même plugin sont indisponibles, signale une erreur de package au lieu d’improviser le Business.

## Prix et données

Recherche le prix pendant ce run. Identifie la valeur, la devise, le marché, l’instrument exact, le type de prix, as_of, retrieved_at et la source. Distingue ADR, action locale et classe de titre.

Utilise les états financiers et hypothèses compatibles avec la période du Business. Un prix ou un composant indispensable manquant rend la Valuation PARTIAL et interdit Validated.

## Exécution

Applique intégralement le framework et le rendement exigé fourni par l’utilisateur. À défaut, utilise 12 %.

Préserve Base Neutrality, Scenario Continuity, Horizon Consistency, Price Monotonicity, Positive-Evidence Consistency et l’absence de double comptage. Ne modifie jamais Portfolio.

## Sortie

Produis le rapport et la Valuation Card du framework, puis :

### HANDOFF — VALUATION

- Contract version : 1.3.0
- Plugin version : 1.3.10
- Run ID :
- Module : valuation
- Entreprise et ticker :
- Date, période et horizon :
- Prix complet et devise :
- Rendement exigé :
- Bear / Base / Bull :
- Prix maximal pour 12 % :
- Score, signal et confiance :
- Expectations Gap :
- Sensibilités et gaps :

Termine par le RUN RECEIPT. En profil persistant, publie et vérifie Valuation Analysis puis Current Valuation Analysis. En Conversation, ajoute l’EXPORT PAYLOAD.
