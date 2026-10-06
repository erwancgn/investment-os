# Provider Notion — Investment OS

Ce provider historique est conservé pour un workflow existant explicitement choisi, hors flux MCP. Ne le sélectionne pas automatiquement et ne l’utilise jamais comme fallback d’une erreur MCP. Dans le flux officiel, le Core et ses adapters possèdent les opérations physiques décrites ici.

## Détection en lecture seule

Vérifier les BDD `Companies`, `Analyses` et, pour les modules portefeuille, `Portfolio`. Lire les propriétés au lieu de les deviner.

`Analyses` doit exposer une propriété texte `Run ID`. Elle est obligatoire pour l'idempotence, les retries et la preuve same-run. `Framework Version`, le titre, le corps et `Handoff Summary` ne la remplacent pas.

Relations attendues selon les modules :

- `Current Business Analysis` ;
- `Current Valuation Analysis` ;
- `Current Short Analysis` ;
- `Current Portfolio Analysis` ;
- `Current Investment Memo`.

Le bloc ou type Earnings existant peut recevoir une Earnings Review datée lorsqu'il est compatible. Aucune relation `Current Earnings` ni nouvelle propriété n'est requise par la v1.3.0.

## Résolution de Company pendant une analyse

Une Company absente n'est pas un motif de setup. Pendant un run analytique avec persistance active :

1. rechercher ticker + marché puis nom légal et aliases ;
2. utiliser une correspondance exacte ;
3. si aucune correspondance n'existe et que nom légal, ticker et marché sont non ambigus, créer une fiche minimale avec nom légal, ticker, marché, devise, date de création et source d'identité ;
4. relire la fiche avant de poursuivre ;
5. si plusieurs correspondances restent possibles, demander une précision sans créer de doublon.

Une création ou relecture en échec ne bloque pas l'analyse conversationnelle ; elle bloque seulement la persistance qui en dépend. Ne crée aucune donnée financière, analyse, décision ou position avec la fiche minimale.

## Compatibilité

Si ce provider historique a été explicitement choisi et que le schéma exact est reconnu, conserver ce choix. `/start` doit seulement confirmer que la configuration existe déjà.

Si le schéma est proche mais différent :

1. lister les écarts ;
2. proposer un mapping ou les propriétés manquantes ;
3. montrer les modifications ;
4. attendre une autorisation explicite ;
5. ne rien renommer ni supprimer automatiquement.

## Publication

La publication suit la séquence : rechercher le même `(Run ID, module)` → reprendre ou créer en Draft → relire → valider → relire → mettre à jour Current → relire Company → superseder l'ancienne version → relire l'ancienne page.

Le runtime ne renseigne jamais `Previous Version`, car la relation du workspace peut être réciproque. L'historique repose sur Company, module, Version, Run ID et Current. Une erreur de persistance interdit `VERIFIED` et le statut global `COMPLETE`, mais jamais la restitution du rapport analytique disponible.

Ne crée aucune nouvelle BDD `Decisions` pendant le setup si l’espace utilise déjà son propre journal. La création ou l’utilisation d’un journal de décisions reste une option distincte du stockage des analyses.
