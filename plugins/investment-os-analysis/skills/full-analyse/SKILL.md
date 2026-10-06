---
name: full-analyse
description: Exécute Business, Valuation, Short, Portfolio Fit puis Memo CIO avec handoffs cohérents. Utiliser pour /full-analyse, analyse complète, décision CIO, sizing, financement et plan d’exécution.
---

# Full Analyse

Exécute Business → Valuation → Short → Portfolio Fit → Memo CIO avec un seul Run ID.

## Ressources obligatoires

Lis d’abord intégralement le [contrat d’exécution](references/execution-contract.md), le [contrat du pipeline](references/pipeline-contract.md) et le [component lock](references/component-lock.json). Charge ensuite l’adaptateur et le framework de chaque module uniquement au moment de l’exécuter, dans l’ordre Business, Valuation, Short, Portfolio puis Memo.

Les ressources embarquées forment une version indivisible. N’utilise aucune ancienne version ou skill externe.

Lis aussi le [transport officiel Investment OS MCP](references/investment-os-mcp.md). Le flux MCP actif utilise le profil Conversation en lecture seule : charge les inputs/continuité par les outils requis, conserve les diagnostics, puis rends le rapport et l’export avec `NOT_REQUIRED`. Les instructions de publication ci-dessous concernent exclusivement un profil historique persistant explicitement choisi ; elles n’activent aucune écriture MCP.

## Plan d’outils MCP

- **Requis, dans l’ordre :** `resolve_company(query, market?)` → `get_company(id=companyId)` → obtenir le portefeuille avec `get_portfolio()` ou réutiliser un snapshot fourni; charger les prix avec `get_quote(assetId)` lorsque nécessaires et qu’un assetId canonique existe. Résolution et Company sont effectuées une fois pour tout le pipeline.
- **Conditionnels :** `get_position(id)` quand le détail d’une position est nécessaire; `get_current_analysis` pour baselines Business, Valuation, Short et Portfolio pertinentes; `get_analysis_by_id` uniquement pour hydrater une archive identifiée. Le module aval réutilise quotes, portefeuille, Company et handoffs déjà chargés.
- Sans snapshot, demande-le avant Portfolio; si l’utilisateur demande de continuer, applique le pipeline PARTIAL prévu. `ambiguous` bloque la recherche jusqu’à clarification; `not_found` interdit création/mapping Company.
- Applique les erreurs, forbidden, timeout et receipt selon la référence MCP. Production READ-only : aucun `save_analysis`, persistance `NOT_REQUIRED`; dans un runtime autorisé, sauvegarde chaque output requis une fois, conserve son receipt et fais les READ de clôture.

## Préflight

- Résous identité, profil, langue et Run ID.
- En MCP, charge la Company et les familles Current requises via les outils officiels ; leur sélection appartient au Core. Le contrôle de schéma/relations est réservé au profil historique explicite.
- Résous le portefeuille avant de commencer : MCP `get_portfolio`, snapshot fourni, puis une seule demande utilisateur. Le provider historique Notion documenté dans Setup n’est utilisable que si l’utilisateur le choisit explicitement; une erreur MCP ne déclenche aucun fallback.
- Si aucun portefeuille n’est disponible, demande-le. Si l’utilisateur exige de continuer sans lui, Business, Valuation et Short peuvent être exécutés ; Portfolio et Memo restent provisoires et le pipeline PARTIAL.
- Recherche les checkpoints du même Run ID dans la conversation ; le catalogue MCP n’expose aucun outil de reprise de run. Les historiques lus par ID restent des inputs de continuité.
- Constitue un Research Pack commun frais.

## Pipeline résilient

Pour chaque module, termine `analyse → handoff → statut de persistance → checkpoint` avant de charger le suivant. En Conversation/READ-only, le statut est `NOT_REQUIRED` et le checkpoint reste dans la conversation ; aucune écriture ni relecture de nouveau document n'est tentée. En profil MCP WRITE autorisé, `save_analysis`, receipt et READ de clôture suivent la référence MCP. Le cycle historique Draft/Current ne s'applique qu'au provider explicitement choisi.

1. Business produit le handoff de référence, puis atteint un statut de persistance terminal.
2. Valuation exige un Business analytiquement exploitable et un prix complet, puis atteint un statut de persistance terminal.
3. Short utilise les handoffs disponibles mais peut continuer en mode autonome si Valuation est partielle, puis atteint un statut de persistance terminal.
4. Portfolio exige le snapshot et des prix ; sans underwriting complet, son périmètre est EXPOSURE_ONLY. Il atteint ensuite un statut de persistance terminal.
5. Memo CIO n’est définitif qu’avec quatre handoffs cohérents. Il atteint ensuite un statut de persistance terminal.

En profil persistant, distingue `VERIFIED`, `FAILED` et une issue `UNKNOWN` explicitement non vérifiée. En Conversation, le statut vaut `NOT_REQUIRED`. Une persistance échouée ou inconnue ne bloque pas les calculs aval réalisables, mais reste enregistrée dans la clôture et interdit `COMPLETE` persistant.

Un échec analytique bloque uniquement les dépendances qui exigent réellement son résultat. Un échec de persistance ne bloque jamais un calcul aval réalisable ; il interdit seulement VERIFIED, Current et le statut global COMPLETE.

Short, Portfolio et Memo ont toujours score null. Aucun module ne modifie Portfolio ou n’exécute une décision.

## Barrière terminale

`HANDOFF — CIO` termine uniquement la phase analytique. Il ne termine jamais un run persistant.

En profil persistant, ne rends pas le rapport final avant d'avoir consigné le receipt ou l'échec/issue inconnue. En Conversation, aucun WRITE n'est attendu.

Avant toute réponse finale, exécute la `PERSISTENCE CLOSURE` du contrat pipeline. Une réponse `PARTIAL` ou `FAILED` reste autorisée lorsque la persistance a échoué explicitement ; une sortie silencieuse ou `COMPLETE` ne l’est pas.


## Gate de complétude du rendu

Le statut global `COMPLETE` exige les rapports intégralement rendus au format de chaque framework, toutes les sections obligatoires, les Evidence Ledgers et Evidence Gates complets, et les handoffs de chaque module réellement produits et conformes. Une PIPELINE CARD, une synthèse ou un handoff seul ne suffit jamais. Si une pièce manque, marque le pipeline `PARTIAL` et indique précisément ce qui reste à compléter. Réfère-toi à la gate du contrat d’exécution; cette règle réaffirme les formats déjà exigés et ne modifie aucune méthode ni aucun critère financier.

## Sortie

Présente les cinq rapports et handoffs disponibles, puis une PIPELINE CARD avec :

- Run ID, profil, langue et snapshot ;
- statuts analytique et de persistance par module ;
- versions, preuves, gaps et checkpoints ;
- relations Current vérifiées ;
- Décision CIO ou caractère provisoire ;
- statut global COMPLETE, PARTIAL ou FAILED.

HANDOFF — CIO est le handoff analytique final. La `PIPELINE CARD` après `PERSISTENCE CLOSURE` est la preuve terminale du run. En Conversation ou après persistance échouée, ajoute les EXPORT PAYLOADS.
