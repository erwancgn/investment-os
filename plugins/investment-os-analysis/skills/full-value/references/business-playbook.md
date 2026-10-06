# Adaptateur Business — Full Value v1.3.0

Le Business Framework embarqué est l’unique autorité méthodologique et de scoring. Cet adaptateur définit seulement son usage dans Full Value.

## Entrées

- identité résolue ;
- Run ID du pipeline ;
- langue et profil ;
- Research Pack collecté pendant le run ;
- ancienne Business Current éventuelle pour la continuité.

## Exécution

- Exécute toutes les sections applicables du Business Framework.
- Ne remplace jamais la recherche fraîche par l’ancienne analyse.
- Applique la grille canonique à huit critères du framework.
- Ne traite ni prix, ni juste valeur, ni allocation.
- Produis HANDOFF — BUSINESS v1.3.0 avec le Run ID du pipeline.

## Passage à Valuation

Valuation peut commencer si le handoff Business est analytiquement exploitable. Une persistance Business échouée rend le pipeline PARTIAL mais ne bloque pas le passage du handoff en mémoire.

Un score indispensable non calculable rend Business PARTIAL et bloque Valuation.
