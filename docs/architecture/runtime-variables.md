# Variables d'exécution du Worker

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `NOTION_TOKEN` | Jeton d'intégration Notion (secret) | aucun : Notion indisponible |
| `OWNER_EMAIL` | Propriétaire du site (accès personnel, WRITE) | aucun : accès démo seul |
| `MCP_WRITE_ENABLED` | Interrupteur du WRITE MCP en production (`1` ouvre) | fermé |
| `NOTION_SOURCES` | JSON surchargeant des IDs de sources de données Notion par clé, ex. `{"companies":"<uuid>"}` | IDs du déploiement (`adapters/notion/sync.ts`) |

`NOTION_SOURCES` est strict : JSON invalide, clé inconnue ou identifiant mal formé renvoient une erreur 500 explicite, jamais un repli silencieux vers une autre base.
Clés valides : companies, analyses, earnings, portfolio, etf_exposures, watchlist, decisions, sources. Une modification de variable s'applique après redéploiement de la version enregistrée.

## Fraîcheur du cache D1

Sites ne documente pas de déclencheur planifié. Un appel MCP authentifié réussi vérifie donc la fraîcheur du cache Notion (au plus une fois par minute et par isolate) et lance une synchronisation en arrière-plan sous verrou D1 si le cache est périmé. Les lectures MCP restent servies depuis le cache courant ; `create_company` interroge Notion en direct, donc une société créée à la main n'est jamais dupliquée même si le cache est en retard.

## Champs Notion legacy

`Research Stage` et `Research Priority` (base Companies) sont des champs manuels historiques. Ni l'app ni le MCP ne les calculent ni ne les écrivent : `create_company` ne pose que `Status = Watchlist`. L'étape de suivi affichée dans la fiche vient de `Monitoring Status` (base Watchlist) ; « Recherche en cours » est le badge affiché tant qu'aucun mémo CIO Current validé n'est relié.
