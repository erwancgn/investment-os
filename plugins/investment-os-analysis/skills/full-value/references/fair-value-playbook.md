# Adaptateur Valuation — Full Value v1.3.0

Le Valuation Framework embarqué est l’unique autorité méthodologique et de scoring.

## Entrées

- HANDOFF — BUSINESS du même Run ID ;
- prix complet collecté pendant le run ;
- états financiers compatibles ;
- rendement exigé utilisateur, ou 12 % par défaut.

## Exécution

- Ne recherche pas une ancienne Business et ne relance pas Business.
- Applique toutes les sections du Valuation Framework.
- Vérifie Base Neutrality, Scenario Continuity, Horizon Consistency, Price Monotonicity, Positive-Evidence Consistency et Double Counting.
- Un prix ou un composant de score manquant produit PARTIAL et interdit Validated.
- Produis HANDOFF — VALUATION v1.3.0 avec le Run ID du pipeline.

La persistance suit exclusivement le contrat d’exécution.
