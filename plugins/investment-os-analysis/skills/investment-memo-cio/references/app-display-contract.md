# Contrat d’affichage App — Memo CIO

Version : `1.0.0`.

Ce contrat décrit la carte et la page Memo CIO. Il ne remplace pas le framework analytique.

## Source de vérité

1. Résoudre la Company.
2. Lire exclusivement sa relation `Current Investment Memo`.
3. Ouvrir la page liée dans `Analyses`.
4. Vérifier `Agent = Investment Memo`, `Status = Validated` et la relation Company.
5. Utiliser le corps complet de cette page pour l’écran de détail.

Ne déduis jamais la disponibilité du Memo depuis `Score`. Les anciens Memos Investment OS peuvent contenir une note héritée ; l’application doit l’ignorer.

## Carte Compagnie

| Champ | Affichage |
|---|---|
| Label | `Memo` |
| Disponibilité | `✓`, `Provisoire` ou `—` |
| Valeur principale | Décision CIO courte si l’espace le permet |
| Métadonnée | Date et confiance |
| Action | Ouvrir la page Memo CIO |
| Score | Jamais affiché |

Business et Valuation conservent leurs scores. Short, Portfolio Fit et Memo CIO affichent un état/verdict, jamais une note artificielle.

## États

- `Absent` : relation vide ou page illisible ; afficher `—` et aucune navigation.
- `Disponible` : page Validated, handoff CIO présent ; afficher `✓` et rendre la carte ouvrable.
- `Provisoire` : modules/portefeuille manquants ou statut partiel ; afficher explicitement `Provisoire`.
- `Superseded` : ne jamais utiliser comme Current ; permettre seulement l’accès depuis l’historique.
- `Erreur` : relation cassée ou type incompatible ; afficher un état technique distinct d’Absent.

## Page Memo CIO

Ordre d’affichage :

1. header entreprise, ticker, date, cours, horizon, confiance ;
2. TL;DR ;
3. Decision Card ;
4. raisonnement décisif ;
5. thèse / antithèse ;
6. débat central ;
7. variant perception ;
8. Bear / Base / Bull ;
9. Portfolio Fit, tailles et financement ;
10. plan d’exécution ;
11. catalyseurs ;
12. risques ;
13. critères d’invalidation ;
14. prochaine revue et points à surveiller ;
15. sources et état des quatre handoffs.

Le `HANDOFF — CIO` reste disponible comme donnée structurée mais n’a pas besoin d’être dupliqué visuellement si tous ses champs sont déjà rendus.

## Compatibilité du schéma Notion historique

- type logique : `Agent = Investment Memo` ;
- contenu : page complète dans `Analyses` ;
- relation : `Current Investment Memo` ;
- état : `Status` ;
- décision courte : `Verdict` ;
- confiance : `Confidence` ;
- résumé structuré : `Handoff Summary` ;
- note : écrire `Score` vide et ignorer toute valeur historique côté lecture.

## Règle de migration

Le correctif d’affichage est défensif : il masque immédiatement les anciennes notes Memo sans exiger de migration de données. Un nettoyage optionnel peut ensuite vider `Score` uniquement pour les pages où `Agent = Investment Memo`, après sauvegarde et vérification ; il ne doit jamais toucher aux scores Business ou Valuation.
