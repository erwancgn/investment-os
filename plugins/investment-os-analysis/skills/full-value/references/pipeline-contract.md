# Contrat Full Value — v1.3.0

Pipeline : Business → Valuation avec un Run ID, une identité et un Evidence Ledger partagé.

## Transport actif

Lis la [référence MCP](investment-os-mcp.md). Le flux actif est Conversation avec transport `investment-os-mcp`, scope explicite et persistance `NOT_REQUIRED`. Les READ servent aux inputs et à la continuité, jamais à la promotion Current. Les checkpoints sont conversationnels ; le catalogue ne fournit pas de reprise de run. Le profil MCP persistant exige activation/droits/autorisation WRITE vérifiés sur le runtime visé ; il suit `RENDER → SAVE_ANALYSIS → RECEIPT → READBACK → CHECKPOINT` selon la référence MCP, sans promotion directe. Les cycles Draft/Validated/Current ci-dessous concernent uniquement les profils historiques explicitement choisis, hors MCP. En production, ces écritures restent fermées.

## Préflight

1. Exécuter le Capability check commun.
2. Résoudre identité, profil et langue.
3. Rechercher le même Run ID et les checkpoints conversationnels ; ne pas inférer same-run d’une baseline Current.
4. Collecter les preuves fraîches et le prix nécessaire.

## Exécution

Business suit `ANALYSIS → EVIDENCE_GATE → RENDER → PERSISTENCE → CHECKPOINT`. Valuation démarre seulement avec un handoff Business analytiquement exploitable. Une persistance Business FAILED n’empêche pas Valuation, mais interdit le statut global COMPLETE en profil persistant.

Valuation suit la même séquence. Chaque écriture historique persistante utilise Draft, readback réel, Validated relu, Current relue et éventuelle ancienne Current Superseded relue. Le modèle ne crée aucun reçu technique.

## Clôture

La PIPELINE CARD expose capacités, preuves, état atteint, persistance et gaps de chaque module. En Conversation, les persistances valent NOT_REQUIRED. En profil MCP WRITE autorisé, COMPLETE exige deux receipts verified et READ de clôture attendus. En profil historique persistant, COMPLETE exige deux persistances VERIFIED et deux Current relues.
