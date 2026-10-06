---
name: full-value
description: Exécute Business puis Valuation avec données fraîches, handoff de même run et persistance vérifiée. Utiliser pour /full-value, analyse business et valorisation ou actualisation après résultats.
---

# Full Value

Exécute Business → Valuation avec un seul Run ID.

## Ressources obligatoires

Lis intégralement :

1. [contrat d’exécution](references/execution-contract.md) et [contrat du pipeline](references/pipeline-contract.md) ;
2. [adaptateur Business](references/business-playbook.md) et [Business Framework](references/business-framework.md) ;
3. [adaptateur Valuation](references/fair-value-playbook.md) et [Valuation Framework](references/valuation-framework.md) ;
4. [component lock](references/component-lock.json).

Ces ressources forment une version indivisible. N’utilise aucun composant externe ou mémorisé.

Lis aussi le [transport officiel Investment OS MCP](references/investment-os-mcp.md). Le flux MCP actif utilise le profil Conversation en lecture seule : charge les inputs/continuité par les outils requis, conserve les diagnostics, puis rends le rapport et l’export avec `NOT_REQUIRED`. Les instructions de publication ci-dessous concernent exclusivement un profil historique persistant explicitement choisi ; elles n’activent aucune écriture MCP.

## Plan d’outils MCP

- **Requis, dans l’ordre :** `resolve_company(query, market?)` → `get_company(id=companyId)` → `get_quote(assetId)` quand un assetId canonique est disponible; Business puis Valuation utilisent un seul contexte et Run ID.
- **Conditionnels :** `get_current_analysis` pour Business et Valuation uniquement pour continuité ou contrôle d’un checkpoint; `get_analysis_by_id` seulement pour hydrater une archive identifiée et nécessaire. Ne charge pas portfolio/position.
- Réutilise Company, quote, sources et handoff Business dans Valuation. `ambiguous` bloque les deux modules jusqu’à clarification; `not_found` n’autorise pas la création d’une Company.
- Applique les erreurs, forbidden, timeout et receipt selon la référence MCP. Persistance : aucun write en production READ-only; dans un runtime autorisé, un `save_analysis` par output attendu, receipt et relecture canonique.

## Préflight

- Résous identité, profil, langue et Run ID.
- En MCP, le cold start reste conversationnel sans création Company ; une création minimale est réservée au profil historique persistant explicitement choisi et à une identité non ambiguë.
- Recherche les checkpoints du même run dans la conversation ; les analyses stockées ne prouvent pas seules un checkpoint same-run. Aucun outil de reprise de run supplémentaire n’est exposé par MCP.
- Constitue un Research Pack frais.
- Une ancienne Business Current sert à la continuité, jamais de substitut au Business du run.

## Pipeline

1. Exécute Business intégralement et produis son handoff. En Conversation/READ-only, consigne `NOT_REQUIRED` sans WRITE ; en profil persistant autorisé, applique le contrat de persistance choisi.
2. Si le handoff Business est analytiquement valide, exécute Valuation avec ce handoff, même si la persistance Business a échoué.
3. Une défaillance analytique Business bloque Valuation.
4. Une Valuation incomplète conserve les résultats disponibles mais interdit un pipeline COMPLETE.
5. Consigne un checkpoint analytique après chaque handoff. En Conversation, il reste dans la conversation et ne garantit aucune reprise entre sessions ; en profil historique persistant, utilise le checkpoint réellement relu. Ne recalcule pas un module déjà complet du même Run ID quand sa preuve de reprise existe.

Ne modifie jamais Portfolio ou une décision financière.


## Gate de complétude du rendu

Le statut global `COMPLETE` exige les rapports intégralement rendus au format de chaque framework, toutes les sections obligatoires, les Evidence Ledgers et Evidence Gates complets, et les handoffs de chaque module réellement produits et conformes. Une PIPELINE CARD, une synthèse ou un handoff seul ne suffit jamais. Si une pièce manque, marque le pipeline `PARTIAL` et indique précisément ce qui reste à compléter. Réfère-toi à la gate du contrat d’exécution; cette règle réaffirme les formats déjà exigés et ne modifie aucune méthode ni aucun critère financier.

## Sortie

Présente les deux rapports et handoffs, puis une PIPELINE CARD :

- Run ID, profil et langue ;
- statut analytique, persistance, version et gaps de chaque module ;
- preuve de passage du handoff Business ;
- prix complet de Valuation ;
- statut global COMPLETE, PARTIAL ou FAILED.

En Conversation ou après persistance incomplète, ajoute les EXPORT PAYLOADS.
