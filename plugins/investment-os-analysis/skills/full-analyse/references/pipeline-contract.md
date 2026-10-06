# Contrat Full Analyse — v1.3.0

## Invariants

Pipeline : Business → Valuation → Short → Portfolio Fit → Memo CIO. Un Run ID, une identité et un Evidence Ledger partagé. Chaque framework reste l’autorité de son module. Aucun module ne modifie le portefeuille ou n’exécute une décision.

## Transport actif

Lis la [référence MCP](investment-os-mcp.md). Le flux actif est Conversation avec transport `investment-os-mcp`, scope explicite et persistance `NOT_REQUIRED`. Les READ servent aux inputs et à la continuité, jamais à la promotion Current. Les checkpoints sont conversationnels ; le catalogue ne fournit pas de reprise de run. Le profil MCP persistant exige activation/droits/autorisation WRITE vérifiés sur le runtime visé ; il suit `RENDER → SAVE_ANALYSIS → RECEIPT → READBACK → CHECKPOINT` selon la référence MCP, sans promotion directe. Les cycles Draft/Validated/Current ci-dessous concernent uniquement les profils historiques explicitement choisis, hors MCP. En production, ces écritures restent fermées.

## Préflight

1. Exécuter le Capability check du contrat commun.
2. Résoudre l’identité et le profil.
3. Résoudre le portefeuille : MCP `get_portfolio`, snapshot fourni, puis une seule demande utilisateur. Le provider historique Notion documenté dans Setup n’est utilisable que si l’utilisateur le choisit explicitement; une erreur MCP ne déclenche aucun fallback.
4. Rechercher le même Run ID et ses checkpoints dans la conversation ; ne pas inférer same-run d’une baseline Current.
5. Créer le Research Pack et l’Evidence Ledger communs.

Sans portefeuille, l’utilisateur peut demander de continuer : Business, Valuation et Short restent possibles ; Portfolio et Memo sont provisoires et le pipeline PARTIAL.

## Machine à états par module

Pour Business, Valuation, Short, Portfolio puis Memo :

`ANALYSIS → EVIDENCE_GATE → RENDER → DRAFT_WRITE → REAL_READBACK → VALIDATE → CURRENT → CHECKPOINT`

- En profil Conversation : après RENDER, la persistance vaut `NOT_REQUIRED` et le checkpoint est analytique.
- En profil historique persistant : chaque état de persistance exige la sortie réelle de l’outil correspondant. En profil MCP WRITE autorisé, le receipt verified et les READ de clôture remplacent le cycle historique ; le Core possède les transitions physiques.
- Le module suivant ne démarre qu’après un checkpoint terminal `VERIFIED`, `FAILED` ou `NOT_REQUIRED`.
- Une persistance FAILED ne bloque pas les analyses aval réalisables, mais interdit le statut global COMPLETE.
- Aucun identifiant, timestamp, hash ou reçu d’adaptateur ne peut être créé par le modèle.

## Dépendances

| Incident | Suite autorisée |
|---|---|
| Business inexploitable | Short autonome ; Portfolio EXPOSURE_ONLY ; Memo provisoire |
| Valuation partielle | Short ; Portfolio EXPOSURE_ONLY ; Memo provisoire |
| Short partiel | Portfolio ; Memo provisoire |
| Snapshot absent avec poursuite explicite | Business, Valuation, Short ; Memo sans sizing |
| Persistance FAILED | Tous les calculs encore réalisables |

Short, Portfolio et Memo ont toujours score null.

## Clôture

Avant la réponse finale, expose pour chacun des cinq modules :

- dernier état atteint ;
- statut analytique ;
- statut de persistance ;
- identifiant de page seulement s’il provient de l’adaptateur ;
- readback exécuté ou manquant ;
- Current relue ou manquante en profil historique persistant ; aucune promotion attendue en Conversation/MCP ;
- gaps.

`COMPLETE` exige cinq analyses complètes et, en profil MCP WRITE autorisé, cinq receipts verified et READ de clôture attendus ; en profil historique persistant, cinq persistances VERIFIED avec cinq Current relues. `PARTIAL` exige au moins un résultat exploitable. `FAILED` signifie qu’aucun résultat exploitable n’est disponible.

HANDOFF — CIO termine l’analyse. Seule la PIPELINE CARD après clôture termine le run.
