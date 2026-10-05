# Lot 12 — résolution canonique et preuves de clôture

5 octobre 2026. Reprise de la source Sites v221, commit `8722b15752df21b883a4265922d10471f5422469`. Le checkout Orca local est un miroir plus ancien sans Core/MCP ; il n'a pas servi de source d'implémentation.

## resolve_company

Le besoin nom/ticker est validé. Le nouvel outil READ du contrat MCP 1.0.0 mappe `query, market?` vers `Core.resolveCompany`. Le Core applique les correspondances exactes ticker (casse normalisée, ponctuation conservée), nom (Unicode, accents/ponctuation normalisés), puis alias explicite ou nom sans suffixe juridique. Une collision nom/ticker ou plusieurs candidatures produit `ambiguous`, jamais un choix implicite. Un marché explicite filtre les candidatures par Exchange ; absence de résultat : `not_found`. Aucune création de Company.

Le port de domaine `readCompanyIdentities` n'expose aucune propriété physique. L'adapter Notion réutilise `propertyValue`, `normalizeNotionPageId` et les snapshots Companies existants pour une lecture ciblée sans analyses, relations ou reconstruction Portfolio. `Aliases`/`Alias` restent dans l'adapter. Le catalogue de cotations de production est réutilisé pour fournir un `assetId` seulement lorsqu'une concordance ticker/marché unique existe. Aucun mapping de Company du portefeuille/watchlist n'est ajouté ; une cotation non identifiée conserve `assetId: null`.

Le résultat expose `status: resolved | ambiguous | not_found` et `candidates[]` avec `companyId`, `canonicalName`, `ticker`, `exchange`, `assetId`. Les deux derniers champs sont nullables. Le runtime demo utilise son snapshot déterministe. Les erreurs de ports passent par les catégories Core ; validation, scope/auth et budget 30 s restent ceux du transport existant.

## Vérifications à ce checkpoint

- Typecheck et build PASS.
- Tests Core/adapters/MCP ciblés : 38/38 PASS.
- Suite globale : 279/279 PASS, dont tests de résolution et lecture d'identité sans corps documentaire.
- Workerd isolé : catalogue de 8 tools, résolution ticker LUMA → Company canonique → les six READ existants PASS ; refus WRITE `forbidden/not_started` malgré les flags de fixture PASS.
- Le harness runtime a été réaligné sur le verrou source fermé : son ancien attendu WRITE verified n'était plus compatible avec v221. Les tests d'intégration du writer Notion restent dans la suite globale.
- Les fixtures de source lisaient encore les deux shims UI déplacés au Lot 7 : chemins corrigés vers les adapters exécutés, et URL esbuild convertie par `fileURLToPath`. Aucun comportement applicatif financier changé.

## Gates runtime encore ouverts

Publication Sites, découverte hébergée de resolve_company, release du plugin privé, trois workflows représentatifs et leurs receipts/relectures restent à consigner. Aucun Lot 13 commencé. WRITE reste fermé à ce checkpoint.
