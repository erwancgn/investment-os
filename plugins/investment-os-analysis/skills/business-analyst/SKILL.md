---
name: business-analyst
description: Analyse fondamentale complète d’une entreprise cotée, indépendante de sa valorisation. Utiliser pour /business, /business-check, le business model, le marché, le moat, la qualité financière, le management, la croissance et les risques ; ne produit ni juste valeur ni recommandation d’achat.
---

# Business Analyst

Évalue la qualité économique d’une société cotée sans tenir compte de son cours.

## Ressources obligatoires

Lis intégralement :

- [Business Check Framework](references/business-check-framework.md), autorité méthodologique et de scoring ;
- [contrat d’exécution portable](references/execution-contract.md), autorité runtime et persistance.

N’utilise aucune ancienne version mémorisée, aucun ZIP externe et aucun autre framework.

Lis aussi le [transport officiel Investment OS MCP](references/investment-os-mcp.md). Le flux MCP actif utilise le profil Conversation en lecture seule : charge les inputs/continuité par les outils requis, conserve les diagnostics, puis rends le rapport et l’export avec `NOT_REQUIRED`. Les instructions de publication ci-dessous concernent exclusivement un profil historique persistant explicitement choisi ; elles n’activent aucune écriture MCP.

## Plan d’outils MCP

- **Requis, dans l’ordre :** `resolve_company(query, market?)` → `get_company(id=companyId)` → `get_current_analysis(companyId, family="business")`.
- **Conditionnels :** `get_analysis_by_id` seulement si une archive identifiée par les données Core est indispensable à la continuité ; `get_quote`, portefeuille et positions ne sont pas requis par Business.
- Réutilise le candidat résolu, les faits Company et toute preuve déjà chargée. Sur `ambiguous`, clarifie avant la recherche; sur `not_found`, ne crée pas de Company et n’invente pas d’identifiant.
- Applique les erreurs, forbidden, timeout et receipt selon la référence MCP. Persistance : aucune en production READ-only (`NOT_REQUIRED`); `save_analysis` et receipt uniquement dans un runtime autorisé pour cette intention.

## Préflight

- Résous l’entreprise, le ticker, la classe de titre et le marché.
- Résous silencieusement le profil d’exécution et la langue.
- Crée un Run ID stable.
- Par MCP, lis la Company puis Business Current via les outils du contrat lorsqu’un ID est disponible. Une absence réelle autorise un cold start conversationnel ; aucun record Version 1 n’est créé dans le flux READ-only.
- Une analyse antérieure sert uniquement à mesurer la continuité : elle ne remplace jamais la collecte du run.

## Recherche

Collecte pendant ce run au moins une source primaire pertinente : rapport annuel ou trimestriel, résultats, présentation investisseurs, transcript officiel ou document réglementaire. Date les faits et sépare faits, hypothèses, inférences et informations non vérifiées.

Une donnée indispensable manquante rend le score concerné non calculable ; elle ne produit ni note moyenne ni malus automatique.

## Exécution

Applique intégralement le framework. Son filtre de matérialité prévaut : ajoute seulement ce qui change la compréhension économique, la probabilité d’un scénario, un risque ou la conclusion Business.

Ne calcule aucun cours cible, multiple d’entrée, marge de sécurité ou décision de portefeuille. Ne modifie jamais Portfolio.

## Sortie

Produis le rapport complet du framework, puis :

### HANDOFF — BUSINESS

- Contract version : 1.3.0
- Plugin version : 1.3.10
- Run ID :
- Module : business
- Entreprise :
- Ticker :
- Date et période :
- Score et Business Verdict :
- Confiance :
- Drivers :
- Risques :
- Hypothèses à transmettre à Valuation :
- Gaps :

Termine par le RUN RECEIPT prévu par le contrat. En profil persistant, publie et vérifie Business Analysis puis Current Business Analysis selon le contrat. En Conversation, ajoute l’EXPORT PAYLOAD.

Une persistance échouée conserve le rapport et le handoff disponibles.
