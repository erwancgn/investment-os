---
name: setup-investment-os
description: Diagnose the official Investment OS MCP connection, conversation-only use, or an explicitly selected legacy Notion/Supabase/database workflow. Use explicitly for /start, /setup, onboarding, schema diagnostics, portfolio import templates or persistence-adapter setup; do not use for an equity analysis.
---

# Investment OS Setup

Configure le contexte et la persistance d’Investment OS sans exécuter d’analyse financière.

## Invocation

Utilise cette skill uniquement sur `/start`, `/setup` ou une demande claire de configuration. Ne l’invoque jamais automatiquement avant `/business`, `/valorisation`, `/short`, `/pf-fit`, `/memo`, `/full-value` ou `/full-analyse`.

Les skills analytiques résolvent leur profil silencieusement. Un utilisateur dont le plugin Site Investment OS est déjà connecté n’a pas de serveur ni OAuth local à configurer.

## Ressources à lire

1. Lis [Profils d’exécution](references/execution-profiles.md) et [Transport officiel MCP](references/investment-os-mcp.md).
2. Lis [Modèle de données canonique](references/canonical-data-model.md) et [Enveloppe de handoff](references/handoff-envelope.md) pour une persistance.
3. Pour un portefeuille fourni comme fichier, lis [Snapshot portefeuille](references/portfolio-snapshot.md).
4. Pour une BDD externe, lis [Contrat d’adaptateur](references/persistence-adapter.md).
5. Pour un workflow historique explicitement choisi, lis uniquement le provider choisi : [Conversation](references/providers/conversation.md), [Notion Investment OS](references/providers/notion-investment-os.md) ou [Supabase](references/providers/supabase.md).

## Sécurité

- Commence toujours par un diagnostic en lecture seule.
- Ne demande jamais un secret, token ou mot de passe dans la conversation.
- Pendant `/start`, ne crée, renomme, supprime ou migre rien sans montrer le plan et recevoir une autorisation explicite. La création Company minimale concerne seulement les workflows historiques explicitement choisis ; le MCP actif ne fournit aucune création Company.
- Une autorisation de créer un schéma n’autorise pas une suppression ni une migration destructive.
- Ne modifie jamais les positions, quantités, PRU, cash ou ordres du portefeuille.
- N’ajoute aucun connecteur obligatoire au manifest du plugin.

## Workflow

### Plan d’outils MCP

- Pour vérifier une entreprise citée par nom/ticker : `resolve_company` puis `get_company`. Pour les capacités non liées à une entreprise, appelle seulement le READ requis : `get_portfolio`, `get_position`, `get_current_analysis`, `get_analysis_by_id` ou `get_quote` avec un identifiant réel.
- `resolve_company` n’est pas nécessaire au simple diagnostic de connexion. `save_analysis` n’est jamais appelé par le diagnostic actif READ-only.
- Réutilise les IDs retournés. `ambiguous` demande une clarification; `not_found` reste un résultat valide; forbidden/timeout sont rapportés comme limites, sans fallback direct vers un stockage physique.
- WRITE historique n’est pas le flux MCP actif. Tout test de persistance exige son autorisation propre, une intention et un runtime compatibles; conserve le receipt et les relectures. Pas de retry automatique.

### 1. Diagnostic

Découvre les tools du plugin officiel du Site existant et leurs schémas, sans écriture. Réutilise la connexion gérée par le client ; aucun secret, OAuth local ou serveur MCP local. Vérifie les sept READ nécessaires, la version MCP 1.0.0 et le scope explicite. La présence des huit outils ne prouve pas WRITE ; le flux actif reste READ-only.

Si la connexion officielle est disponible, réponds `Connexion existante reconnue — investment-os-mcp`, avec profil Conversation, transport MCP et persistance NOT_REQUIRED. Une lecture limitée au besoin avec un ID réellement fourni/retourné peut confirmer la connexion ; ne prétends pas qu’elle a réussi sans sortie réelle. Un rejet auth/permission/transport est signalé sans fallback Notion ni démo.

Pour un provider historique explicitement choisi, vérifie lecture, écriture, relecture, schéma, idempotence, portefeuille et checkpoints selon ses ressources. Le schéma exact ne sélectionne pas automatiquement Notion.

### 2. Choix guidé

Si aucune connexion officielle n’est disponible, indique le mécanisme de connexion/actualisation du plugin Site. Pour un besoin de configuration exprimé, propose :

1. Conversation uniquement ;
2. connexion au plugin Site Investment OS existant (READ-only) ;
3. workflow historique Notion explicitement choisi ;
4. Supabase historique ;
5. autre BDD ou outil historique.

Recommande Conversation lorsqu’aucune persistance n’est nécessaire. Ne présente pas Supabase comme requis.

### 3. Plan de configuration

Présente :

- profil proposé ;
- capacités actuelles ;
- éléments manquants ;
- créations ou modifications exactes ;
- permissions nécessaires ;
- tests prévus ;
- rollback non destructif ;
- limites restantes.

### 4. Autorisation

Le diagnostic MCP actif se termine sans écriture et sans activation WRITE. Pour un setup historique demandé, demande une confirmation explicite immédiatement avant toute écriture externe. Sépare si nécessaire les autorisations de création du schéma, de création des politiques et d’écriture de test.

### 5. Vérification

Pour le MCP READ-only, rapporte uniquement les lectures réellement observées et leurs gaps ; aucun test d’écriture/versioning. Après un setup historique autorisé :

1. vérifier le schéma ;
2. insérer un enregistrement de test identifiable ;
3. le relire ;
4. tester l’idempotence ;
5. tester le versioning ;
6. tester les autorisations positives et négatives ;
7. ne supprimer la donnée de test que si cela a été annoncé et autorisé.

### 6. Setup Card

Termine par :

| Élément | Résultat |
|---|---|
| Profil | conversation / notion-investment-os / external-database |
| Transport / Provider | investment-os-mcp / aucun / Notion historique / Supabase historique / autre |
| Lecture | Disponible / Indisponible |
| Écriture | Disponible / Indisponible / Non requise |
| Versioning | Disponible / Indisponible / Non requis |
| Portefeuille | Disponible / À fournir / Non requis |
| Checkpoints | Disponibles / Conversation uniquement / Indisponibles |
| Tests | Réussis / Partiels / Non exécutés |
| Limites | |
| Commandes prêtes | |

Ne prétends jamais qu’une lecture MCP a réussi sans résultat réel, ni qu’un provider persistant historique est configuré sans relecture réussie. Aucun succès de diagnostic ne prouve une permission WRITE.
