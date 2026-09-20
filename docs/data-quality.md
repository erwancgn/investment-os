# Registre de qualité des données

## Confirmé

- Les six documents Nebius importés sont des snapshots intégraux des pages Notion identifiées.
- Business v3, Valuation v4 et Earnings Q2 sont les documents actuels au 13 août 2026.
- Short v2, Portfolio v1 et Mémo CIO v1 sont conservés comme versions historiques.
- Le warrant Nebius mentionné dans le mémo historique a été vendu.

## À rapprocher avant calcul d’un portefeuille live

- Le call Nebius restant a été vendu le 12 août 2026 pour un produit total de 147 €. Il est exclu des positions ouvertes.
- Le statut du call Marvell reste à confirmer avant de l’intégrer à la valorisation automatique.
- La trajectoire 25 000 € validée le 13 août devient la référence structurelle et totalise 100%, avec Nebius à 10%. La cible 10 000 € reste un milestone historique.
- La valeur actuelle (≈9 100 €), le capital investi (≈7 650 €) et les PV comptables CTO + PEA (+1 551 €) proviennent de périmètres déclaratifs légèrement différents. L’application les signale sans forcer une égalité artificielle.
- Les quantités fractionnaires, les comptes et les PRU sont disponibles, mais les symboles de marché doivent être normalisés avant valorisation automatique.

## Règle d’affichage

Tant que ces rapprochements ne sont pas terminés, les valeurs historiques de portefeuille restent des repères déclaratifs et sont signalées. Les cotations live sont indépendantes et indiquent toujours leur fournisseur.

## Périmètre de calcul de l’application

- **Valeur de ligne** = quantité active × cours live dans la devise native, converti en EUR avec le taux de change live.
- **Coût d’acquisition** = quantité active × PRU réel renseigné dans Notion (PRU exprimé en EUR dans la base actuelle).
- **PV affichée** = valeur de ligne − coût d’acquisition. Il s’agit exclusivement d’une PV latente sur les positions ouvertes.
- Les opérations réalisées, frais, dividendes et plus-values historiques Trade Republic ne sont pas encore importés ; ils ne doivent donc pas être additionnés à la PV latente de l’application.
- Un cours manuel Notion n’est utilisé qu’en secours lorsqu’aucun cours live validé n’est disponible. Un cours non-EUR manuel sans taux `FX to EUR` est laissé indisponible plutôt que converti avec une hypothèse implicite.
- Le bouton `↻ Actualiser` force une nouvelle lecture des cours et des taux de change, puis recalcule les valeurs, pondérations et PV de l’écran et des fiches entreprises.
