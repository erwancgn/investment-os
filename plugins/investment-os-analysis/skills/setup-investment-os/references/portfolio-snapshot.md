# Snapshot portefeuille

## Formats acceptés

Texte, Markdown, CSV, XLSX, JSON, export de courtier ou capture d’écran lisible.

## Minimum requis

- date du snapshot ;
- devise de référence ;
- cash par compte ;
- entreprise ou ticker ;
- compte ;
- quantité ou valeur de marché ;
- devise de la position.

## Recommandé

- cours et horodatage ;
- PRU ;
- type d’instrument ;
- objectif et plafond de poids ;
- composition ETF ;
- ratio, delta, strike et échéance pour les dérivés.

## Validation

1. afficher les lignes ambiguës ;
2. ne pas mélanger des snapshots sans réconciliation ;
3. convertir les devises avec un taux daté ;
4. calculer les poids sur les valeurs de marché, jamais sur les PRU ;
5. vérifier que positions et cash réconcilient le total ;
6. conserver la source et la date.

Si le minimum est incomplet, demander une seule fois les champs manquants.

Pour Portfolio Fit indépendant, l'absence de snapshot exploitable retourne `BLOCKED_INPUT` avant toute recherche lourde, sans création d'analyse ni mutation Current. Dans Full Analyse seulement, l'utilisateur peut demander explicitement de poursuivre sans portefeuille : Business, Valuation et Short restent possibles, tandis que Portfolio et Memo demeurent provisoires et le pipeline `PARTIAL`.
