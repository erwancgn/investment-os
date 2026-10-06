# Adaptateur Portfolio — Full Analyse v1.3.0

## Préflight

Résous le portefeuille avant de lancer le pipeline : Portfolio MCP (Notion direct seulement en profil historique explicite), snapshot fourni, puis une seule demande utilisateur. Si l’utilisateur impose de continuer sans snapshot, Portfolio et Memo restent provisoires.

## Exécution

Applique intégralement le Portfolio Framework avec les handoffs disponibles et des cours actuels. Calcule les poids sur valeurs de marché, le look-through fiable et les dérivés en delta-equivalent.

- Quatre entrées complètes : périmètre FULL_UNDERWRITING.
- Underwriting incomplet mais snapshot exploitable : EXPOSURE_ONLY et statut PARTIAL.
- Snapshot absent : pas de page Portfolio, statut BLOCKED_INPUT.

Produis HANDOFF — PORTFOLIO v1.3.0. Score reste null. Ne modifie jamais le portefeuille.
