# Base Claude — 6 octobre 2026

## Provenance vérifiée

- Sites v245 : `93a7497de4af5191405b09978bba595b1532bbfe`.
- Déploiement `appgdep_6ac4ba811c088191bf10d31773b2649d` : succeeded, has_mcp=true, environnement 25.
- Sources applicatives et tests : base Sites v245 complétée par les corrections locales non publiées décrites ci-dessous, sans build généré ni secrets.
- Plugin : copie complète de la release installée 1.3.10, incluant références, assets et métadonnées. Hashes dans plugin-sha256.json. Snapshot de travail, pas connexion OAuth Claude automatiquement configurée.
- MCP serveur : `transports/mcp/`, Core : `core/`, providers : `adapters/`. Endpoint existant `/mcp` sur le Site. Auth réelle et droits nécessaires pour usage distant ; aucun token exporté.

## Démarrage

Utiliser Node 22 (>=22.13.0), `npm ci`, puis `npm test`, `npm run test:mcp`, `npm run verify:mcp-runtime`, `npm run validate:artifact`.
Lire AGENTS.md et les handoffs des lots 10–12 avant de toucher les contrats. La méthodologie reste dans le plugin ; MCP transporte, Core valide/orchestre, adapter mappe et persiste.
Pour travailler sur les skills avec Claude, consulter directement `plugins/investment-os-analysis/skills/<skill>/SKILL.md` et ses ressources. Le manifest OpenAI et .app.json ne configurent pas à eux seuls un plugin Claude ou OAuth.

## Corrections locales non publiées

La branche conserve le tree de travail local observé, notamment writer, normalizer, projection valuation et test Lot13. Il n'est pas déployé sur Sites. La provenance publiée est v245 ; les modifications locales sont incluses dans cette branche et ne sont pas déployées.

## Validation exécutée dans cette branche

Node v24.19.0, dépendances du checkout opérationnel réutilisées sans mise à jour.
`npm test` : typecheck PASS, build/validation artefact PASS, 300 tests : 277 PASS, 23 FAIL, 0 skipped. Log complet joint `validation.log`.
La branche est une base de reprise fidèle avec les derniers tests, pas une baseline verte. Les échecs reader/writer/roundtrip sont à traiter en premier ; aucune certification Lot13 revendiquée.

## Reprise

Lot12 GO infrastructure ; Lot13 non certifié. Les rapports joints détaillent Schneider, Micron et Alphabet. Aucun retry, WRITE ou promotion implicite. Aucun déploiement ni modification de main effectué pour cette préparation.
