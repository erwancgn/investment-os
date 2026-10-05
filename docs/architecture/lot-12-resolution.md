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

## Clôture — verdict PARTIAL / NO-GO

La phrase de gate globale n'est pas démontrée. Aucun Lot 13 commencé.

### Source, plugin et tests

Source opérationnelle Sites v224 : `ab2a85a88ebfe7eb1036ddb5abb3c8f7824c1fd2`. Le plugin privé a été publié successivement en 1.3.5–1.3.9 : immutable releases, correction des plans `get_company(id=companyId)`, rappel des exigences Full déjà présentes, dates canoniques explicites. Public Analysis 1.3.0 inchangé ; privé Perso conserve Read et le même app MCP. Release 1.3.9 : `pluginrel_6ac36ad7c8f481918325f97e5060e16c`. Les 20 frameworks/playbooks/check-frameworks financiers protégés sont byte-identiques à la baseline 1.3.4 via la comparaison intermédiaire 1.3.5. Aucun score/seuil/critère financier changé.

Tests : MCP 25/25, suite globale 282/282, typecheck/build PASS. Runtime workerd v224 : huit tools, resolve_company, six READ, auth, WRITE fermé PASS. Tests nouveaux : clients texte seuls reçoivent une erreur Core typée sans exception privée ; asOf fiscal invalide est refusé avant writer, null autorisé passe le Core en fixture. Ce test ne crée aucune donnée réelle.

### Workflows réellement exécutés

| Workflow | Entrée utilisateur | Run | Preuve et limites |
|---|---|---|---|
| Business | Microsoft | BUSINESS-MSFT-20261005 | resolve_company → get_company(id) → Current Business. Rapport Full consolidé avec E/D, Gate et handoff rendu après corrections. Intention Draft préparée ; aucun nouveau save/receipt/relecture d'un output créé. |
| Full Value | LITE | FV-LITE-20261005-1013 | resolve_company → Company → Quote → baselines Business/Valuation → archive Valuation → Business/Valuation Full et handoffs. Premier get_company mal nommé rejeté, corrigé en READ puis dans les plans. Contexte partagé réutilisé. Gate strict des outputs sérialisés PARTIAL : dates asOf fiscales et E/D inline manquants identifiés, correction reviewable en cours. |
| Full Analyse | NVDA | NVDA-FA-20261005-1021 | resolve_company → quote/portfolio/Current des cinq familles → archives Valuation/Short → Business, Valuation, Short, Portfolio Fit, CIO Full. Plusieurs READ ont été répétés pour réponses volumineuses ; aucun get_position requis. Company récent avec id prouvé après gap du journal initial. Pas de WRITE ; les cinq intentions initiales étaient des métadonnées sans content.blocks matérialisé. Audit strict et matérialisation encore requis pour les déclarer canoniques. |

Conversations de preuve : [Business](https://chatgpt.com/c/6ac35884-ce50-83eb-b97c-05a7525ab183), [Full Value](https://chatgpt.com/c/6ac35c33-d4f0-83ed-9d54-e806802f13fd), [Full Analyse](https://chatgpt.com/c/6ac35e0c-43ac-83eb-b442-ac0744aeec44). Les affirmations COMPLETE initiales sur des résumés ont été retirées ; un titre Full, un Ledger seul ou un handoff ne prouvent pas la conformité.

### Unique nouvelle tentative WRITE et fermeture

Ouverture v225, source `a36638b8fb1877d4a67201f4eb18b761fbae6389`, env10, allowlist exacte `FV-LITE-20261005-1013`. Une seule intention Business Draft (61 blocs canoniques), expectedRevision:null, Company `3b537ea7af358169b697e2d437379f51`. Aucun Current demandé, aucun retry, Valuation non soumise.

Le connecteur a retourné INVALID_ARGUMENT avec uniquement `{contractVersion:"1.0.0",status:"completed"}` en texte, sans receipt ni ID. Le payload exact de la confirmation contient `presentation.facts.asOf:"FY2026"` et `"Q4 FY2026"` : `isAnalysisFact` les rejette, et `Core.saveAnalysis` valide avant `ports.writeAnalysis`. Refus avant writer reproduit par test. Aucun nouvel ID Notion ou receipt disponible, aucune persistance déclarée. READ Company LITE ne retrouve aucun Draft de ce run ; cela seul n'aurait pas suffi pour prouver l'absence d'une mutation. Le contrôle Core déterministe fournit la preuve supplémentaire du refus de ce payload avant adapter.

Défaut transport corrigé : les erreurs Core completed/error sont désormais intégralement présentes en texte, comme les refus transport. Les exceptions privées restent filtrées. Le schéma de découverte explique désormais asOf ISO/date-time/null et interdit les périodes fiscales comme dates. Pas d'assouplissement du Core, pas de retry ni nouvelle mutation.

Fermeture v226, source `8acbb05c44ed78aac6c2392877fdcd7f50ec558a`, env11 : trois flags supprimés, verrou source false, Sites succeeded. Refus hébergé prouvé `forbidden/not_started`, retryable:false. Les cinq Current NVIDIA et deux Current LITE ont été relus : mêmes IDs et revisions qu'avant la tentative. Aucune nouvelle page de test à nettoyer identifiée ; les Drafts du checkpoint précédent étaient déjà nettoyés.

### Dette et stabilité

Les plans actifs délèguent identité, Current, relations, Portfolio/Position, Quote, stockage et receipts au MCP/Core ; aucun accès Notion/D1 ou mapping portefeuille ajouté. Setup conserve des docs providers physiques historiques uniquement sur choix explicite, sans fallback MCP. Les calculs d'exposition/fraîcheur restent de la méthode financière. Dette : neuf copies identiques de la référence MCP, synchronisées par test ; formulations legacy de cold start bornées par le contrat MCP ; volume de READ provoquant duplication et perte de trace dans l'hôte. Le risque d'interprétation libre demeure démontré par les premières fausses clôtures COMPLETE.

Comparaison 1.3.0 → état actuel : qualitative seulement à partir du checkpoint acquis et de l'audit présent. Source publique exacte 1.3.0 non récupérée ; aucune mesure de lignes ni preuve byte-à-byte 1.3.0 revendiquée. La comparaison vérifiée 1.3.4 → privé actuel montre moins de plomberie active, plans plus explicites et méthodes protégées intactes. Une migration de backend conserve les tools/domaines, sauf les instructions historiques Setup explicites.

### Actions restant avant GO

1. Finir la matérialisation/audit strict de tous les outputs canoniques et conserver les gaps vrais.
2. Nouvelle décision explicite pour une tentative WRITE corrigée : aucune répétition automatique du save ayant échoué, conformément à la consigne utilisateur.
3. Receipts réels et relectures de chaque output attendu. Draft persisted n'est pas receipt verified et ne prouve pas une promotion Current.
4. Earnings/Setup : audit documentaire acquis, exécution individuelle complète non prouvée dans cette passe.

WRITE antérieur receipt/replay/revision reste acquis ; il ne remplace pas les receipts absents de ces workflows. Verdict final : PARTIAL / NO-GO, production WRITE fermée.
