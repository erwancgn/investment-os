# Contrat de rendu des analyses

Ce document fixe le périmètre du lot 0. Les exemples Notion sont des fixtures de validation, jamais des données métier codées en dur.

## Références

| Type | Référence | Attente principale |
| --- | --- | --- |
| Earnings | Nebius — Q2 2026 | KPI, guidance, delta trimestriel, Q&A, risques et action |
| Business | Bloom Energy — Business Check v1 | business model, marché, concurrence, moat, score |
| Valuation | Bloom Energy — Valuation Check v1 | hypothèses, méthodes, scénarios et fair value |
| Portfolio | Bloom Energy — Portfolio Check v1 | exposition, look-through, stress, sizing et financement |
| Short | Booking Holdings — Short Check v1 | forensic, red flags, squeeze, catalyseurs et kill criteria |
| Investment Memo | Ciena — Investment Memo v2 CIO canonique | consolidation des modules, décision et plan d'exécution |

## Rendu Investment Memo CIO

Le Mémo CIO est une page de décision et non une analyse scorée. Son écran suit le contrat opérationnel du skill : TL;DR, Decision Card, raisonnement décisif, puis thèse/antithèse, débat central, variant perception, scénarios, valorisation et prix d'entrée, portfolio fit, catalyseurs, risques, invalidation, taille, financement, exécution, décision finale, surveillance et sources.

- La Decision Card exclut toujours les champs `Score` et `Note`, y compris lorsque d'anciens mémos Notion les contiennent.
- Le signal de la carte Mémo est le verdict CIO ; seules les analyses Business et Valuation affichent un score numérique.
- L'état des handoffs Business, Valuation, Short et Portfolio reste consultable dans un bloc dédié.
- Un mémo daté de plus de 45 jours est signalé comme étant à actualiser.
- Le HANDOFF CIO complet et les relations Notion restent accessibles comme traçabilité documentaire.

## Règles communes

1. La source Notion reste la vérité documentaire.
2. Le parser produit des blocs sûrs : headings, paragraphs, callouts, lists, tables, dividers.
3. Les entités HTML sont décodées avant l’analyse de structure.
4. Les tableaux HTML et les tableaux Notion convergent vers le même bloc `table`.
5. Les champs non reconnus ne sont pas supprimés : ils restent dans le texte de secours.
6. Les relations restent des liens Notion, jamais du texte opaque.
7. Un document sans template métier doit rester lisible grâce au rendu universel.

## Versionnement

Le registre `app/data/analysis-reference-fixtures.json` est versionné indépendamment des données synchronisées. Une évolution de structure doit augmenter `contractVersion` et conserver un fallback pour la version précédente.
