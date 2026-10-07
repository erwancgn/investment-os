# Clôture MCP et refactorisation — passation

7 octobre 2026. Production : Sites v253 (arbre `7be96a0380e37cac0ed63116b0e9cd31b0f9ef95`), WRITE fermé. Patch p8 (Research Stage legacy) et ce patch de documentation attendent le déploiement v254.

## Acquis

- Chaîne en production : Skills (plugin 1.4.2) → MCP (contrat 1.0.0, 9 outils, rapport 1.1) → Core → ports → adapter Notion → Notion/D1.
- WRITE : `save_analysis` et `create_company` certifiés de bout en bout sur Xiaomi (1810.HK) : société créée une fois (Bourse de Hong Kong, HKD), Valuation et Business enregistrées et vérifiées.
- Sources Notion configurables (`NOTION_SOURCES`), tables FX et places boursières généralisées, portefeuille et ETF paginés (2 000 lignes), rafraîchissement du cache sans cron (voir runtime-variables.md).
- Correctif du lecteur Markdown : `<` et `>` dans le texte ou les cellules ne sont plus pris pour des balises (tableaux fusionnés, texte perdu). Tableaux irréguliers complétés avec avertissement ; refus du fournisseur nommés dans les diagnostics.
- Tests : 383 unitaires, 34 MCP, typecheck, validation d'artefact.

## Dette volontairement non traitée

- Inférence de famille de document par le texte (`referenceKind`, `classifyDocument`, `agentFor`).
- Vocabulaire central des statuts de position.
- Déclencheur planifié (Sites n'en documente pas).
- Champs `Research Stage` et `Research Priority` : legacy, manuels.

## Hors périmètre

Sortie de Sites : remplacer D1 (cache, verrous, `notion_company_creations`) et l'identité Sites, en conservant contrat 1.0.0, schéma de rapport 1.1, tests et plugin.

## Reste à exécuter

Déploiement v254 ; session WRITE groupée de certification (analyse complète sur société absente, `/earnings`, reprise de `create_company` sans doublon) ; tag plugin 1.4.2 ; alignement du miroir GitHub depuis Sites.
