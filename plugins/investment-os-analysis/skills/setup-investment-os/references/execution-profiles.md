# Profils d’exécution

## Règle centrale

Le profil est résolu par les skills analytiques sans question préalable. `/start` sert à diagnostiquer ou configurer, jamais à débloquer artificiellement une analyse.

## Conversation avec transport Investment OS MCP — flux actif

- Préférer le plugin officiel du Site Investment OS connecté, selon la [référence MCP](investment-os-mcp.md).
- `profile: conversation`, `transport: investment-os-mcp`, persistance `NOT_REQUIRED`.
- Chaque READ inclut `contractVersion: "1.0.0"` et scope explicite `personal` ou `demo`.
- MCP charge identité, portefeuille, analyses Current/historiques et prix ; le Core possède sélection Current et calculs existants.
- La présence de `save_analysis` au catalogue ne prouve aucune permission WRITE. WRITE reste fermé/non délégué en production ; aucun appel de mutation dans ce flux.
- Rapports, handoffs, exports et checkpoints analytiques restent dans le chat ; pas d’historique du nouveau run garanti entre conversations.
- Une erreur auth/permission/transport est signalée, sans fallback direct Notion ni changement de scope. Les inputs utilisateur peuvent permettre une analyse conversationnelle avec le gap conservé.

## Investment OS MCP persistant — runtime WRITE autorisé

- Profil `investment-os-mcp` seulement si activation WRITE, droits personnels et autorisation officielle de l’intention sont vérifiés sur le runtime visé.
- Une soumission `save_analysis` canonique et READ de clôture selon la référence MCP ; receipts intacts, aucune mutation physique directe ni retry.
- Une validation isolée ne vaut pas activation production ; le défaut production reste Conversation/NOT_REQUIRED.
- Un état inconnu ou une persistance incomplète reste visible et interdit VERIFIED/COMPLETE persistant.

## Conversation sans transport

- Aucune BDD requise ; rapports, handoffs et export payload dans le chat.
- Portefeuille demandé uniquement aux modules qui en ont besoin.
- Portfolio Fit retourne `BLOCKED_INPUT` tant qu’aucun snapshot exploitable n’est fourni.
- Pas d’historique garanti entre conversations.

## Profils persistants historiques — choix explicite hors MCP

`notion-investment-os` et `external-database` sont conservés pour les workflows existants uniquement sur choix explicite. Ils ne sont pas sélectionnés automatiquement par la présence de schéma, préférence ancienne ou erreur MCP. Leurs opérations physiques sont propres au provider historique et ne sont jamais exécutées dans le transport MCP.

### Notion Investment OS

- Exige lecture, écriture et fetch réellement disponibles, puis schéma exact inspecté.
- `Companies`, `Analyses` et, selon le module, `Portfolio` sont les sources de ce provider.
- Publication versionnée et relue après chaque module ; Current après validation/relecture et ancienne Current Superseded après confirmation.
- `Previous Version` n’est pas écrit par le runtime.
- Aucune adaptation silencieuse du schéma. Une Company minimale peut être créée dans un run historique autorisé après résolution non ambiguë ; pas dans le flux MCP READ-only.

### External database

- Exige choix explicite et handshake réussi d’un adaptateur configuré avec écriture et readback.
- Même contenu analytique ; persistance/versioning/checkpoints selon les capacités réelles.
- Toute capacité exigée mais absente retourne `BLOCKED_CAPABILITY` ; les erreurs ne sont pas masquées.

## Priorité

1. choix explicite du run compatible avec les capacités réelles ;
2. Conversation avec MCP officiel connecté pour les inputs/continuité ;
3. Conversation avec inputs utilisateur/recherche.

Une préférence de connexion ne constitue pas une autorisation d’écriture ni de fallback provider.
