# Audit UI v74 — Investment OS

Audit source réalisé avant refonte. L'objectif est d'améliorer la hiérarchie, la densité mobile et la cohérence sans modifier les calculs, les données Notion ou les règles de sélection des analyses.

## Diagnostic transversal

- La navigation à cinq entrées est saine et adaptée au mobile.
- La palette et l'identité vert profond sont reconnaissables, mais les niveaux de surface sont trop proches et les textes secondaires trop petits.
- Plusieurs écrans utilisent des cartes imbriquées pour des informations qui pourraient être de simples lignes structurées.
- Le fichier global contient des règles historiques puis des surcharges qui masquent ou renomment du contenu avec des pseudo-éléments. Cela rend les évolutions visuelles fragiles.
- Les états de chargement et d'erreur existent, mais ils n'ont pas encore un langage visuel uniforme.
- Les interactions importantes sont présentes, mais les zones tactiles et les focus clavier ne sont pas systématiquement homogènes.

## Portfolio

### En place

- Valeur, capital investi, PV, cash, cours convertis en EUR et diagnostics de calcul.
- Filtres par enveloppe, tri, filtre PV et bascule PV pourcentage/euros.
- Deux lectures d'exposition : secteur et thèmes directs Notion.
- Trajectoire 10k/25k séparée avec portefeuille actuel et écarts aux cibles.

### Écarts UX

- Le premier écran répète la valeur et la performance entre les cartes de périmètre et les cartes de métriques.
- Le diagnostic de calcul apparaît avant les positions alors qu'il s'agit d'une fonction secondaire.
- La section positions a conservé dans son JSX les mécaniques de cible, ensuite cachées en CSS.
- Les lignes sont lisibles mais utilisent six zones de grille et trop de micro-libellés sur mobile.
- Les blocs santé, synchronisation et méthode repoussent le portefeuille réel sous la ligne de flottaison.

### Décision de refonte

- Une seule synthèse financière : valeur en grand, PV, capital investi et cash.
- Périmètre Total/CTO/PEA sous forme de sélecteur compact avec valeur.
- Positions courantes sans cible ; poids, valeur, cours et PV restent visibles.
- Diagnostic conservé mais replié sous les données principales.
- Exposition Large/Précise conservée.
- Toute cible reste dans Trajectoire.

## Watchlist

### En place

- Cartes riches, filtres par statut et accès direct à la société.

### Écarts UX

- Trop de poids visuel identique entre ticker, statut, score et note.
- Les cartes deviennent hautes sur mobile et rendent la comparaison difficile.
- Les scores circulaires occupent beaucoup d'espace pour une seule donnée.

### Suite recommandée

- Passer à une ligne compacte sur mobile, garder la carte complète sur grand écran.
- Mettre le statut et le prochain niveau d'action avant les détails narratifs.

## Compagnies

### En place

- Recherche, tableau, relations Notion et ouverture de la fiche canonique.

### Écarts UX

- Le tableau desktop est forcé en largeur sur mobile, donc le balayage horizontal devient la navigation principale.
- Les colonnes secondaires prennent autant de place que le nom et le statut de recherche.

### Suite recommandée

- Une carte-ligne mobile avec société, ticker, statut, analyses disponibles et chevron.
- Conserver le tableau uniquement à partir du format tablette.

## Fiche entreprise

### En place

- Hero, thèmes, statut, onglets, position live, synthèse et analyses courantes/archives.

### Écarts UX

- Sept onglets horizontaux sont corrects fonctionnellement, mais la lecture de la synthèse est trop fragmentée par les cartes.
- La dernière analyse apparaît à plusieurs endroits dans la même section.
- La traçabilité est utile, mais trop visible par rapport au verdict et au TL;DR.

### Suite recommandée

- En-tête compact, verdict/TL;DR immédiatement visibles, puis onglets.
- Une analyse courante principale par catégorie et une ligne repliable pour l'historique.
- Traçabilité et source dans un panneau secondaire.

## Analyses

### En place

- Filtres par type, scores, verdicts, fraîcheur et lecteur structuré par template.

### Écarts UX

- Le tableau à cinq colonnes est dense sur mobile.
- Agent, score, verdict et fraîcheur ont une importance visuelle trop proche.

### Suite recommandée

- Ligne mobile à deux niveaux : titre/entreprise puis type, verdict et date.
- Utiliser le score comme signal discret, pas comme colonne dominante.

## Lecteur d'analyse

### En place

- TL;DR, métadonnées, tables défilables, titres numérotés, Decision Card et nettoyage HTML.

### Écarts UX

- La hero, le bloc « source réelle », le sommaire et les métadonnées occupent beaucoup d'espace avant le contenu.
- Sur téléphone, la taille de texte est bonne mais les sections longues manquent parfois de respiration contextuelle.

### Suite recommandée

- Garder titre, verdict et TL;DR dans le premier écran.
- Replier source, relations et sommaire.
- Conserver les tableaux horizontaux et renforcer Bear/Base/Bull comme vrais titres.

## Recherche

### En place

- Recherche plein texte locale, résultats classés et lecteur complet.

### Écarts UX

- L'introduction est plus éditoriale que fonctionnelle et prend trop de hauteur.
- Les résultats gagneraient à mettre le passage correspondant plus près du titre.

### Suite recommandée

- Champ de recherche dans le premier viewport avec une introduction d'une ligne.
- Surlignage des termes et résultat compact.

## Gestion

### En place

- Indicateurs d'intégrité, orphelins, relations multiples, Current manquants et synchronisation détaillée.

### Écarts UX

- Six indicateurs ont le même niveau alors que seuls les avertissements nécessitent une action.
- Les actions de synchronisation et les diagnostics sont répartis dans plusieurs zones.

### Suite recommandée

- Résumé « sain / à traiter » en tête.
- Regrouper les actions et n'ouvrir les listes détaillées qu'en cas d'anomalie.

## Ordre d'implémentation

1. Refonte Portfolio et suppression des doublons de structure.
2. Tokens UI et états d'interaction partagés.
3. Fiches entreprises et lecteur d'analyse.
4. Listes Watchlist, Compagnies et Analyses.
5. Recherche et Gestion.

