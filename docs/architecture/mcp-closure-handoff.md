# Clôture MCP et refactorisation — passation

7 octobre 2026. Production : Sites v255 (arbre `dfe1221aac3ed84643adfadde1091ca1ddc3aebe`), certification WRITE terminée ; WRITE fermé à la révision 34, puis ouvert en exploitation normale (voir runtime-variables.md, « Exploitation du WRITE »).

## Acquis

- Chaîne en production : Skills (plugin) → MCP (contrat 1.0.0, 9 outils, rapport 1.1) → Core → ports → adapter Notion → Notion/D1.
- WRITE : `save_analysis` et `create_company` certifiés de bout en bout sur Xiaomi (1810.HK) puis Kering (KER.PA, société absente de la base, créée une fois).
- Sources Notion configurables (`NOTION_SOURCES`), tables FX et places boursières généralisées, portefeuille et ETF paginés (2 000 lignes).
- Lecteur Markdown : `<` et `>` ne sont plus pris pour des balises ; séparateur de tableau GFM à un seul tiret reconnu ; tableaux irréguliers complétés avec avertissement.
- `stale_request` nomme sa cause dans les diagnostics (`write_stale`), sans jamais renvoyer le texte du rapport.
- `Research Stage` et `Research Priority` : champs legacy manuels, ni écrits ni dérivés.
- Tests : 386 unitaires, 34 MCP, typecheck, validation d'artefact.

## Certification WRITE du 7 octobre (v255, révision 33 ouverte, 34 fermée)

| Scénario | Résultat |
|---|---|
| `/full-analyse` Kering (société absente) | Société créée, Business, Valuation, Short, Portfolio, Memo CIO Validated, cinq pointeurs Current résolus |
| Durée `save_analysis` (Short, Portfolio, Memo) | 15,0 s, 19,1 s, 15,5 s ; aucun timeout |
| `/earnings` Micron (MU) | Draft persisté en 9,0 s, relecture conforme, visible dans l'app avec statuts de refresh |
| `/valorisation` Micron | Business et Valuation vérifiés et promus Current, sans timeout |
| `create_company` rejoué sur Kering | `existing`, aucun doublon |
| Badge de la fiche Kering | « Décision du mémo CIO : Attendre » |
| Fermeture | Deux refus `forbidden` / `not_started` après propagation |

Incident antérieur (v253) : la Valuation Kering a dépassé le délai MCP de 30 s (page néanmoins persistée, issue `unknown`). Cause retenue : lectures séquentielles répétées du corps de page. Correctif en v254/v255 : lectures de sous-blocs en parallèle (4 en simultané) et une seule lecture du corps pour certifier. Le gain n'est pas décomposé par phase ; aucun chronométrage par phase n'existe.

Règle de reprise après `timeout` (issue `unknown`) : ne rien rejouer, lire `get_company` (titre, date, score, statut, pointeur Current), puis décider. Un replay de texte long réémis par un modèle échoue en `stale_request`.

## Dette volontairement non traitée

- Inférence de famille de document par le texte (`referenceKind`, `classifyDocument`, `agentFor`).
- Vocabulaire central des statuts de position.
- Déclencheur planifié : rafraîchissement automatique du cache sans cron non vérifié (le rafraîchissement manuel de l'app existe).
- Chronométrage par phase des écritures (marge observée : 19,1 s sur 30 s).
- Pages Kering et Xiaomi créées avant le correctif du séparateur : une ligne de tableau parasite `-/-:` (cosmétique).

## Hors périmètre

Sortie de Sites : remplacer D1 (cache, verrous, `notion_company_creations`) et l'identité Sites, en conservant contrat 1.0.0, schéma de rapport 1.1, tests et plugin.

## Reste à exécuter

Tag du plugin ; alignement du miroir GitHub depuis Sites (Sites → GitHub uniquement) ; archivage des branches de travail.
