---
name: investment-memo-cio
description: Consolide Business, Valuation, Short et Portfolio Fit en décision CIO. Utiliser pour /memo, /invest, /invest-check, décision finale, sizing, financement, plan d’exécution ou invalidations ; un dossier absent route vers Full Analyse.
---

# Investment Memo CIO

Transforme des handoffs cohérents en une décision unique, concise et traçable.

## Ressources obligatoires

Lis intégralement :

- [Investment Memo Framework](references/investment-memo-framework.md), autorité méthodologique ;
- [contrat d’exécution portable](references/execution-contract.md), autorité runtime et persistance.

Pour une demande d’intégration applicative, lis aussi [App Display Contract](references/app-display-contract.md).

Lis aussi le [transport officiel Investment OS MCP](references/investment-os-mcp.md). Le flux MCP actif utilise le profil Conversation en lecture seule : charge les inputs/continuité par les outils requis, conserve les diagnostics, puis rends le rapport et l’export avec `NOT_REQUIRED`. Les instructions de publication ci-dessous concernent exclusivement un profil historique persistant explicitement choisi ; elles n’activent aucune écriture MCP.

## Plan d’outils MCP

- **Requis, dans l’ordre :** `resolve_company(query, market?)` → `get_company(id=companyId)`; consomme d’abord les quatre handoffs du même run s’ils sont présents.
- **Conditionnels :** sinon lire `get_current_analysis` pour Business, Valuation, Short et Portfolio afin d’établir le dossier compatible; `get_analysis_by_id` seulement pour hydrater une analyse historique identifiée; `get_portfolio` ou `get_quote` uniquement si un élément nécessaire à la cohérence, au prix d’entrée ou au sizing manque.
- Réutilise intégralement les handoffs et données déjà lus. Si le dossier manque ou est incohérent avant démarrage, route vers Full Analyse; `ambiguous` exige clarification, `not_found` interdit une identité inventée.
- Applique les erreurs, forbidden, timeout et receipt selon la référence MCP. Persistance : READ-only (`NOT_REQUIRED`); aucun `save_analysis` en production; sinon un appel autorisé et un receipt par output attendu.

## Préflight

Recherche, dans cet ordre :

1. HANDOFF — BUSINESS, VALUATION, SHORT et PORTFOLIO du même run ;
2. handoffs fournis dans la conversation ;
3. analyses Current compatibles par entreprise, ticker, période, devise et prix.

Si le dossier est absent, incomplet ou matériellement incohérent avant le démarrage, route vers Full Analyse v1.3.0 plutôt que de mélanger des périodes. Si un incident survient pendant un pipeline déjà lancé, produis seulement un memo provisoire avec les modules manquants.

## Exécution

Applique intégralement le framework. Résous explicitement les contradictions ; ne moyenne pas mécaniquement les conclusions. La confiance calibre la taille mais n’est pas un score.

Une décision définitive et un sizing exigent un Portfolio complet. Le module ne modifie jamais Portfolio, Watchlist, Decisions ou un compte financier.

## Sortie

Produis le rapport, la Decision Card et :

### HANDOFF — CIO

- Contract version : 1.3.0
- Plugin version : 1.3.10
- Run ID :
- Module : cio
- Entreprise et ticker :
- Date :
- Handoffs consommés :
- Décision et priorité :
- Confiance :
- Poids initial / cible / maximal :
- Prix ou condition d’entrée :
- Source de financement :
- Thèse, risques et invalidations :
- Prochaine revue :
- Gaps :
- Score : null

Termine par le RUN RECEIPT. En profil persistant, publie et vérifie Investment Memo puis Current Investment Memo. En Conversation, ajoute l’EXPORT PAYLOAD.
