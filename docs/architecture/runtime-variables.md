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

## Exploitation du WRITE

Depuis le 7 octobre 2026, WRITE est ouvert en exploitation normale : `MCP_WRITE_ENABLED=1` est posé sur Sites. Sans cette variable le code reste fermé (valeur par défaut sûre). Les protections restent actives : propriétaire seul (`OWNER_EMAIL`, identité fournie par Sites), 100 écritures par fenêtre de 24 h et par appelant (`MCP_LIMITS.writesPerWindow`, compteur local à l'instance, chaque appel `save_analysis` ou `create_company` compte, même en échec), un seul WRITE en vol (`write_in_progress` sinon), délai MCP de 30 s.

Une sauvegarde ambiguë (timeout, 5xx, `write_in_progress`) n'est jamais rejouée à l'aveugle : lire `get_company` (titre, date, score, statut, pointeur Current) avant toute décision ; un replay doit conserver le même `runId` et un contenu identique.

Fermeture d'urgence (suspicion d'usage anormal, boucle d'écritures) :

1. Retirer `MCP_WRITE_ENABLED`, redéployer la version enregistrée, relever la révision d'environnement.
2. Attendre 5 minutes (la version précédente peut répondre quelques minutes après le déploiement), puis confirmer le refus par un appel `create_company` sur une société existante (Kering, ISIN FR0000121485) : `forbidden` attendu, jamais `existing`. Ne jamais tester le refus avec `save_analysis`, qui écrit si WRITE est encore ouvert. Si la réponse est `existing`, poser `MCP_WRITE_ENABLED=0` explicitement et recommencer.
3. Consigner révisions et déploiements dans la passation.

Réouverture : poser `MCP_WRITE_ENABLED=1`, redéployer, relever la révision d'environnement ; aucune écriture n'est exécutée par l'opérateur du déploiement.
