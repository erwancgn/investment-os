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

## Checkpoint hébergé — Business et schéma d'entrée

Sites v222 publié avec succès, environnement 9, source `7e40d3a5a838c2a7d25867783ba2e1ab852538be`. Catalogue actualisé par le mécanisme officiel du client. Plugin privé publié en 1.3.5 (source initiale 1.3.4), méthodes financières conservées.

Run réel `/business Microsoft` depuis le plugin personnel : `BUSINESS-MSFT-20261005`, conversation https://chatgpt.com/c/6ac35884-ce50-83eb-b97c-05a7525ab183 . Le client restitue les appels resolve_company(query=Microsoft), get_company et get_current_analysis(family=business). Company `3b337ea7af3581038c01ec1b0f33d8c4`, MSFT/NASDAQ, assetId msft ; Current `3d237ea7af358192a5d5dde12123edcf`, revision `2026-09-05T07:37:00.000Z`. Les deux READ sont corroborés indépendamment via le connecteur officiel. Rapport et handoff produits, aucune mutation, persistance NOT_REQUIRED. Cette exécution ne prouve pas encore la persistance du nouvel output.

Blocage constaté dans l'hôte : save_analysis(input:any) malgré le schéma canonique complet et ses définitions locales côté serveur. Le Skill a refusé de fabriquer le DTO. Correction de présentation : les schémas d'entrée du catalogue sont développés sans références locales ; validation serveur et contrats métier inchangés. Test de découverte exige les champs complets d'Analysis et l'absence de `$ref` dans les entrées.

## Checkpoint schéma visible et identité de création

Sites v223 confirmé succeeded, environnement 9. Un nouveau contexte ChatGPT expose désormais save_analysis avec Analysis et ses champs complets; les anciens threads peuvent conserver input:any et doivent repartir dans un contexte officiel actualisé. La première intention Business préparée utilise légitimement un ID derived de run. L'adapter exigeait pourtant un UUID Notion même pour expectedRevision:null : cette contrainte physique a été retirée pour les créations où l'identité réelle est attribuée par Notion. Les mises à jour conservent validation UUID et contrôle de révision. Test de création canonique / refus d'une mise à jour sur ID d'intention ajouté. Suite globale : 280/280 PASS.

Plugin privé 1.3.7 publié, plans get_company(id=companyId) explicites et contrats/locks cohérents. Les runs composites depuis LITE et NVDA ont résolu l'identité et exécuté leurs READ; leurs premières synthèses ne satisfaisaient pas les formats Full. Statuts ramenés à PARTIAL et rapports Full en cours de complément avant tout WRITE. Aucun nouveau receipt, aucune nouvelle mutation à ce checkpoint.
