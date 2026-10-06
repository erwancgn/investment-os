---
name: portfolio-fit
description: Évalue l’intégration d’une action, d’un ETF ou d’un dérivé dans un portefeuille réel. Utiliser pour /portfolio, /portfolio-check, /pf-fit, allocation, concentration, look-through, exposition delta, stress tests, taille ou financement ; exige un snapshot portefeuille.
---

# Portfolio Fit

Mesure l’effet réel d’une position sur le portefeuille sans exécuter de transaction.

## Ressources obligatoires

Lis intégralement :

- [Portfolio Check Framework](references/portfolio-check-framework.md), autorité méthodologique ;
- [contrat d’exécution portable](references/execution-contract.md), autorité runtime et persistance.

Lis aussi le [transport officiel Investment OS MCP](references/investment-os-mcp.md). Le flux MCP actif utilise le profil Conversation en lecture seule : charge les inputs/continuité par les outils requis, conserve les diagnostics, puis rends le rapport et l’export avec `NOT_REQUIRED`. Les instructions de publication ci-dessous concernent exclusivement un profil historique persistant explicitement choisi ; elles n’activent aucune écriture MCP.

## Plan d’outils MCP

- **Requis, dans l’ordre :** `resolve_company(query, market?)` → `get_company(id=companyId)` et obtenir un snapshot réel par `get_portfolio()`, sauf si un snapshot exploitable est fourni par l’utilisateur.
- **Conditionnels :** `get_position(id)` si une ligne du portefeuille requiert son détail; `get_quote(assetId)` pour les prix nécessaires des titres/sous-jacents; `get_current_analysis` pour Business, Valuation ou Short quand le souscriptionnement est pertinent; `get_analysis_by_id` uniquement pour hydrater une archive identifiée. Réutilise les positions et assets déjà retournés.
- Sans snapshot, arrête en `BLOCKED_INPUT`. `ambiguous` exige une clarification; `not_found` n’autorise aucune création ni mapping manuel.
- Applique les erreurs, forbidden, timeout et receipt selon la référence MCP. Persistance : aucune en production READ-only; WRITE et receipt seulement sur runtime autorisé pour l’intention.

## Préflight portefeuille bloquant

Résous le portefeuille avant toute recherche ou tout calcul :

1. portefeuille MCP lisible avec fraîcheur conservée ;

Le provider historique Notion documenté dans Setup n’est utilisable que si l’utilisateur le choisit explicitement; une erreur MCP ne déclenche aucun fallback.
2. snapshot fourni dans la conversation ou un fichier ;
3. sinon demande-le une seule fois.

Accepte texte, Markdown, CSV, XLSX, JSON, export de courtier ou capture lisible. Exige au minimum instrument ou ticker, quantité ou montant et devise ; demande aussi cash et caractéristiques des dérivés lorsqu’ils sont matériels.

Si aucun snapshot exploitable n’est fourni, retourne BLOCKED_INPUT. Ne crée aucune analyse, ne modifie aucune relation Current et n’effectue pas une analyse générique présentée comme Portfolio Fit.

## Préflight société

Résous l’instrument, le marché et le cours. Une Company absente permet un cold start conversationnel. Aucune création Company n’est disponible dans le flux MCP du Lot 12. Le provider historique de Setup ne peut être utilisé que par choix explicite de l’utilisateur, jamais comme fallback de résolution MCP.

Charge Business, Valuation et Short Current lorsqu’ils existent. Leur absence ne bloque pas le calcul des expositions, mais limite le périmètre à EXPOSURE_ONLY : le sizing fondamental et le financement restent provisoires et le statut global est PARTIAL.

## Exécution

Applique intégralement le framework :

- poids sur valeurs de marché, jamais sur PRU ;
- look-through ETF lorsque les données sont fiables ;
- dérivés en delta-equivalent ;
- cash et devises ;
- concentration et blocs de risque communs ;
- contraintes PEA / CTO ;
- source de financement et coût d’opportunité.

Ne modifie jamais quantités, PRU, cash, décisions ou ordres.

## Sortie

Produis le rapport et la Portfolio Card du framework, puis :

### HANDOFF — PORTFOLIO

- Contract version : 1.3.0
- Plugin version : 1.3.10
- Run ID :
- Module : portfolio
- Entreprise et ticker :
- Date du snapshot :
- Valeur du portefeuille :
- Périmètre : FULL_UNDERWRITING | EXPOSURE_ONLY
- Expositions avant / après :
- Prix utilisés :
- Verdict et confiance :
- Poids initial / cible / maximal :
- Source de financement :
- Risque dominant et gaps :
- Score : null

Termine par le RUN RECEIPT. En profil persistant, publie et vérifie Portfolio Analysis puis Current Portfolio Analysis. En Conversation, ajoute l’EXPORT PAYLOAD.
