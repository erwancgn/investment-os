# Modèle de données canonique

Ce modèle est logique. Chaque provider le mappe vers sa technologie sans modifier les sorties analytiques. Le flux MCP officiel lit les contrats canoniques réellement retournés selon la [référence transport](investment-os-mcp.md) ; le Core et les adapters possèdent Current, promotion et mapping physique. Les mentions de propriété `Run ID`, création Company et publication ci-dessous concernent exclusivement les providers historiques persistants, pas les arguments ni une mutation MCP active.

## Company

- identifiant stable ;
- nom légal ;
- ticker, place de cotation et devise ;
- aliases ;
- analyses courantes par module.

Lorsqu'elle manque, une Company peut être créée pendant un run si nom légal, ticker et marché sont non ambigus. La fiche initiale reste minimale et sa création est idempotente.

## Analysis Run

- `run_id` stable ;
- profil et provider ;
- entreprise ;
- modules demandés ;
- versions des frameworks ;
- statuts analytique (`COMPLETE`, `PARTIAL`, `FAILED`, `BLOCKED_INPUT`) et de persistance (`NOT_REQUIRED`, `VERIFIED`, `FAILED`) ;
- checkpoint ;
- limites et erreurs.

## Analysis

- compagnie, propriété texte `Run ID` et module ;
- date et version ;
- statut Draft, Validated ou Superseded ;
- fraîcheur ;
- verdict, score optionnel et confiance ;
- rapport complet ;
- handoff summary et evidence gaps.

La propriété `Run ID` doit être persistée directement et correspondre au run du handoff. Elle ne peut pas être remplacée par une mention dans un autre champ.

`Previous Version` est une propriété historique facultative. Le runtime 1.3.0 ne la renseigne pas : l'historique est dérivé de Company, module, Version, Run ID et des relations Current.

`score` est obligatoire uniquement lorsque le framework Business ou Valuation le rend calculable. Il reste nul pour Earnings Review, Short, Portfolio Fit et Memo CIO.

## Handoff

- version du contrat ;
- run, entreprise et module source ;
- dates, période, devise et cours pertinents ;
- verdict et confiance ;
- payload métier ;
- sources, limites et validation.

## Portfolio Snapshot

- date ;
- devise de référence ;
- cash par compte ;
- valeur totale ;
- positions et expositions ;
- source et fraîcheur.

## Source

- analyse ;
- URL, titre et éditeur ;
- date de publication et date d’accès ;
- type ;
- caractère primaire ou secondaire.

## Niveaux de capacité

| Niveau | Entités | Usage |
|---|---|---|
| Conversation | aucune | Tous les skills dans le chat |
| Research | Company, Analysis | Earnings Review, Business, Valuation, Short |
| Portfolio | Research + Portfolio Snapshot | Portfolio Fit |
| Complete | Portfolio + Run + Handoff | Full Analyse, Memo CIO, reprise |
