---
name: short-seller
description: Challenge une thèse haussière avec une analyse contradictoire et forensic. Utiliser pour /short, /short-check, risques baissiers, red flags, qualité des résultats, dilution, gouvernance ou scénario Theme Right / Stock Wrong.
---

# Short Seller

Cherche ce qui peut invalider la thèse sans chercher à confirmer l’utilisateur.

## Ressources obligatoires

Lis intégralement :

- [Short Seller Framework](references/short-seller-framework.md), autorité méthodologique ;
- [contrat d’exécution portable](references/execution-contract.md), autorité runtime et persistance.

Lis aussi le [transport officiel Investment OS MCP](references/investment-os-mcp.md). Le flux MCP actif utilise le profil Conversation en lecture seule : charge les inputs/continuité par les outils requis, conserve les diagnostics, puis rends le rapport et l’export avec `NOT_REQUIRED`. Les instructions de publication ci-dessous concernent exclusivement un profil historique persistant explicitement choisi ; elles n’activent aucune écriture MCP.

## Plan d’outils MCP

- **Requis, dans l’ordre :** `resolve_company(query, market?)` → `get_company(id=companyId)`.
- **Conditionnels :** `get_current_analysis` pour Business et Valuation lorsqu’une baseline compatible existe ou est utile ; `get_quote` uniquement si le framework ou la demande exige un contexte de prix actuel ; `get_analysis_by_id` uniquement pour une archive identifiée et nécessaire. Portfolio/position ne sont pas requis.
- Réutilise les handoffs du même run avant tout Current. `ambiguous` exige une clarification; `not_found` autorise seulement l’analyse conversationnelle sans Company MCP.
- Applique les erreurs, forbidden, timeout et receipt selon la référence MCP. Persistance : READ-only (`NOT_REQUIRED`); `save_analysis` seulement dans un runtime autorisé, sans retry et avec receipt.

## Préflight

- Résous l’identité, la langue, le profil et un Run ID stable.
- Charge Business et Valuation Current lorsqu’elles existent et sont compatibles.
- Leur absence ne bloque pas un Short autonome sur une nouvelle société : reconstruis la thèse consensuelle à partir de sources vérifiables et ajuste la confiance.
- Dans Full Analyse, utilise les handoffs disponibles du même run sans contaminer leurs scores.

## Recherche et analyse

Applique intégralement le framework. Distingue entreprise fragile, action chère et short exploitable. Une rumeur reste un overlay non scoré. Toute allégation sensible exige une source attribuable.

Le scénario Theme Right / Stock Wrong doit être crédible et falsifiable. Short ne reçoit jamais de score numérique et ne modifie jamais Portfolio.

## Sortie

Produis le rapport et la Short Card du framework, puis :

### HANDOFF — SHORT

- Contract version : 1.3.0
- Plugin version : 1.3.10
- Run ID :
- Module : short
- Entreprise et ticker :
- Date :
- Baselines utilisées ou absentes :
- Verdict et confiance :
- Thèse baissière :
- Red flags :
- Catalyseurs :
- Risque de squeeze :
- Kill criteria :
- Gaps :
- Score : null

Termine par le RUN RECEIPT. En profil persistant, publie et vérifie Short Analysis puis Current Short Analysis. En Conversation, ajoute l’EXPORT PAYLOAD.
