# Clôture Lot 10 — contrat MCP / passation Lot 11

3 octobre 2026. Checkout local `investment-os`, branche `chore/architecture-stabilization-mcp`, HEAD d'entrée `9a7e1b2d0f61a136ebad39bb0a804142cd3245b4`. Checkpoint propre et alignement origin vérifié après fetch (0/0). Lots 8 et 9 clos, GO Lot 10 acquis ; aucun gate live antérieur rejoué.

**Lot 10 clos — GO Lot 11 après livraison de ce commit sur origin. Lot 11 non démarré.** Le SHA de livraison est celui du commit contenant cette passation (`git log -1`), sans SHA autoréférentiel dans le document.

## Sources canoniques et surface

- `contracts/mcp.ts` : version 1.0.0, types wire réutilisant le Core, descriptions, mapping et limites.
- `contracts/mcp.v1.schema.json` : schémas structurels draft-07 versionnés ; chaque schéma de tool résout les definitions du bundle.
- Section 10 de `openai-first-execution-plan.md` : règles normatives READ/WRITE, auth/scope/confirmation, erreurs/diagnostics, idempotence, stale, pagination/taille, délais/retry et compatibilité. Pas de seconde documentation de contrat.
- `scripts/generate-mcp-schemas.mjs` : génération depuis les types existants, sans nouvelle dépendance ni validateur métier.
- `tests/mcp-contract.test.mjs` : tests purs, intégrés à `npm test`, commande ciblée `npm run test:mcp` avec contrôle de drift.

Sept tools : get_company, get_portfolio, get_position, get_current_analysis, get_analysis_by_id, save_analysis, get_quote. Chaque tool appelle une seule opération Core existante. L'accès historique par ID est justifié par `/api/analyses/:id`, la navigation et les archives Company. `list_analyses` est écarté : son seul usage runtime Core est l'audit technique d'intégrité, tandis que Company livre déjà les aperçus/archives. Les opérations Current/position/save reposent sur le Core et les besoins couverts au Lot 8, sans prétendre qu'une route UI dédiée existe déjà pour chacune.

Le contrat conserve ServiceResult, les versions de domaine, diagnostics, provenance et liens hérités opaques. Aucun mapping physique, format UUID, calcul Portfolio, policy Current, parser, méthode financière ou SDK OpenAI. Les libellés de provenance/URL déjà présents dans le domaine ne sont pas interprétés par MCP.

## Choix à préserver au Lot 11

- Version exacte obligatoire et scopes personal/demo explicites. Identité et droits vérifiés hors arguments ; permissions READ/WRITE séparées ; WRITE démo interdit. Aucun fallback de scope, aucune permission auto-déclarée.
- Sortie completed avec résultat Core inchangé, ou rejet transport typé avec outcome not_started/unknown. Auth/version/validation/confirmation avant Core ; ressources et références isolées au périmètre autorisé.
- save_analysis conserve analysis, runId, expectedRevision et companyIds ; persisted/promotion_pending/verified/partial restent distincts. Idempotence, reprise, promotion et relectures appartiennent au writer. Aucun retry WRITE automatique.
- Stale/unknown, null/absence, archives, positions fermées et quotes unavailable restent observables. Aucune sélection/recalcul de transport.
- Snapshots complets, aucune pagination v1 ni troncature. Plafonds JSON UTF-8 : entrée 2 MiB, sortie 4 MiB. Budgets : READ 30 s avec au plus deux tentatives, WRITE 120 s avec une tentative. Timeout WRITE ne certifie pas l'annulation.
- Compatibilité par catalogues versionnés, changements additifs minor et ruptures major. Ne pas régénérer silencieusement les schémas après changement Core.

## Reprise séparée du Lot 11

1. Vérifier checkout/branche/HEAD/status/origin ; lire AGENTS, cette passation et la section 11 du plan. Ne pas reprendre GitHub comme source de remplacement de Sites.
2. Examiner les contraintes du runtime et du protocole MCP avant choix d'hébergement. Ni Site existant ni Site dédié définitivement choisi ici. Rendre autonomes les schémas annoncés en incluant leurs definitions et mapper l'enveloppe aux résultats protocole ; aucune logique métier.
3. Composer les véritables ports Core et des jeux de données personnels/démo isolés. Les méthodes historiques de l'assemblage adapter renvoient parfois des payloads HTTP legacy ; elles ne sont pas directement les ServiceResult wire. Vérifier une composition Core réellement disponible avant d'annoncer un tool exécutable. Aucun serveur créé pour résoudre cela au Lot 10.
4. Implémenter et tester auth, permissions, confirmation liée à l'intention, limites, redaction, timeout et reprise explicite. Démontrer le traitement des appels WRITE encore actifs après perte de canal/échéance, sans retry concurrent ni garantie fictive d'annulation.
5. Vérifier les schémas avec les validateurs Core ; les contraintes structurelles JSON ne remplacent pas la validation métier. Prouver les plafonds et délais dans le runtime avant exposition ; toute incompatibilité nécessite une décision explicite de contrat.
6. Conserver les limites du writer Lot 8 (absence de CAS atomique source, writers externes hors lease, mutations ambiguës). Ne pas modifier les Skills/plugin/méthodes financières. Toute publication production ou écriture live non indispensable nécessite l'autorisation correspondant à ce nouveau lot.

## Vérifications de clôture

- `npm run test:mcp` : PASS, contrôle de génération sans drift et 9/9 tests contractuels.
- `npm run test:domain` : PASS, 34/34 (contrats Analysis/Investment, sélection Current, Portfolio, services).
- `node --test tests/investment-read-adapter.test.mjs tests/notion-adapter-write.test.mjs` : PASS, 31/31, fixtures/mocks locaux uniquement, aucune écriture live.
- `npm run typecheck` : PASS.
- ESLint ciblé sur contrat/générateur/tests : PASS.
- Relecture complète des fichiers modifiés et du bundle généré, contrôle de réutilisation Core et des références locales, `git diff --check` : PASS.

Le premier passage des nouveaux tests a révélé un chemin URL encodé dans le harness puis les dictionnaires Portfolio dans le générateur ; les deux sont corrigés et les suites finales passent. Aucun changement du Core, adapter, Worker, UI, Skills, plugin, secrets, permissions externes ou dépendances. Aucun serveur/endpoint MCP, déploiement, mutation Notion/D1 live ou migration. Build et audits CSS non concernés par ces types/documents/tests sans modification runtime ou visuelle.

Aucune action humaine restante pour le Lot 10. Le GO Lot 11 constate le contrat prêt ; il ne certifie ni serveur exécutable ni hébergement validé.
