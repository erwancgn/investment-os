# Contrat d’exécution portable — v1.3.0

Ce contrat gouverne tous les rapports. Le framework du module reste l’unique autorité méthodologique.

## 1. Capability check bloquant

Avant la recherche, lis le [transport officiel Investment OS MCP](investment-os-mcp.md) et établis uniquement à partir des outils réellement disponibles :

```yaml
capabilities:
  web_search: AVAILABLE | MISSING
  notion_read: AVAILABLE | MISSING
  notion_write: AVAILABLE | MISSING
  notion_fetch: AVAILABLE | MISSING
  external_database: AVAILABLE | MISSING
transport: investment-os-mcp # seulement si connecté
mcp_capabilities:
  read: AVAILABLE | MISSING
  write: MISSING | AVAILABLE # AVAILABLE seulement sur runtime WRITE autorisé
```

Préfère le MCP officiel connecté pour les inputs et la continuité : `profile: conversation`, `transport: investment-os-mcp`, `persistence_status: NOT_REQUIRED`. Vérifie les outils READ nécessaires au module et leurs schémas ; n’infère jamais WRITE du catalogue ni de READ. Le contrat MCP impose `contractVersion: "1.0.0"` et un scope explicite `demo` ou `personal` à chaque appel. WRITE reste fermé en production.

Sans connexion MCP, Conversation reste disponible avec les inputs utilisateur et la recherche. Les profils persistants historiques `notion-investment-os` et `external-database` sont sélectionnés uniquement sur choix explicite pour un workflow existant, hors flux MCP. Notion exige lecture, écriture et fetch réels ; l’adaptateur externe exige écriture et readback. Une erreur MCP auth/permission/transport est signalée et ne déclenche aucun fallback direct Notion. Si l’utilisateur exige une capacité indisponible, retourne `BLOCKED_CAPABILITY` et nomme la capacité manquante.

## 2. États autorisés

Le run progresse sans saut :

`CAPABILITY_CHECK → IDENTITY → RESEARCH → ANALYSIS → EVIDENCE_GATE → RENDER → PERSISTENCE → COMPLETE`.

Statuts analytiques : `COMPLETE`, `PARTIAL`, `FAILED`, `BLOCKED_INPUT`, `BLOCKED_CAPABILITY`.
Persistance : `NOT_REQUIRED`, `VERIFIED`, `FAILED`.
Page : `Draft`, `Validated`, `Superseded`.

Un état n’est atteint que lorsque son résultat existe. Ne produis jamais un reçu, un hash, un identifiant de page, un timestamp d’adaptateur ou un statut PASS qui n’a pas été retourné par un outil. Sans outil de hash, n’utilise aucun hash.

## 3. Identité

Résous nom légal, ticker, classe, marché, devise et, si utile, ISIN depuis une source officielle ou faisant autorité consultée pendant le run. Une ambiguïté bloque la recherche lourde et déclenche une seule question. En MCP, résous uniquement les IDs réellement retournés ou fournis selon la référence transport ; aucune Company n’est créée. Une Company minimale peut être créée uniquement dans un profil historique persistant explicitement choisi, après résolution non ambiguë.

## 4. Evidence Ledger avant rédaction

Cherche réellement chaque donnée factuelle utilisée. Construis d’abord un registre interne :

| ID | Claim exacte | Valeur | Période / as_of | URL | Consulté le | Locator | Extrait probant |
|---|---|---:|---|---|---|---|---|

Règles :

- toute valeur factuelle visible renvoie à un ID du ledger ;
- toute dérivation enregistre formule, entrées sourcées, unité et résultat ;
- une URL sans extrait ne constitue pas une preuve ;
- chaque preuve fraîche porte `provenance: collected_this_run`; une baseline héritée sert à la continuité, jamais à prouver une donnée fraîche ;
- les derniers résultats exigent une recherche d’une publication plus récente ;
- le prix exige instrument, place, devise, type, `as_of`, `retrieved_at` et source ;
- une donnée non prouvée est retirée ou rend le rapport `PARTIAL` ; elle ne devient jamais « non vérifiée » dans un rapport déclaré complet.

## 5. Evidence gate et rendu

Avant affichage ou écriture, vérifie le rapport contre le ledger :

- identité cohérente ;
- chaque chiffre factuel possède sa référence `[E:id]` ;
- chaque calcul possède sa référence `[D:id]` et se recalcule depuis ses entrées ;
- aucune citation orpheline ;
- aucun `**gras**`, `__gras__`, `*italique*`, `_italique_` ni balise HTML d’emphase dans une zone humaine ;
- titres, listes et tableaux inclus ;
- code et payload technique exclus du texte humain.

Utilise le formatage natif de l’adaptateur. Termine le rapport par des sources lisibles avec URL, période, date de consultation et extrait. Le modèle peut déclarer le résultat analytique du contrôle, mais ne fabrique aucune preuve technique d’exécution.

## 6. Persistance

### Conversation

Avec transport `investment-os-mcp`, les READ fournissent inputs et continuité selon la référence locale ; aucune sélection/promotion Current ni mapping physique n’est implémenté par le skill. Aucune écriture. Utilise `persistence_status: NOT_REQUIRED` et fournis le rapport, le handoff et un export structuré.

### Profil Investment OS MCP persistant — runtime autorisé seulement

Le profil `investment-os-mcp` est disponible uniquement après vérification explicite d’une activation WRITE, des droits personnels et de l’autorisation de l’intention sur le runtime visé. Il n’est jamais sélectionné depuis le catalogue seul. La production reste Conversation/READ-only. Lis la section WRITE de la référence MCP : une seule soumission `save_analysis` canonique par module, receipt intact et READ de clôture réels. Le Core et les adapters possèdent idempotence, Current, supersession et vérifications ; aucune opération physique directe ni retry de mutation par le skill. Un outcome inconnu ou un receipt incomplet interdit VERIFIED et le statut global COMPLETE du run persistant.

### Adaptateur historique explicitement choisi — hors flux MCP

La séquence suivante s’applique seulement aux profils persistants historiques, jamais au MCP actif. Le profil MCP persistant et ses receipts sont décrits uniquement dans la référence transport ; il reste inactif en production. Pour chaque module historique, dans cet ordre strict :

1. créer ou reprendre la page du même `(Run ID, module)` en `Draft` ;
2. écrire le rapport, le ledger utile et le handoff ;
3. appeler le readback réel de l’adaptateur ;
4. comparer les champs et le texte effectivement renvoyés avec le payload envoyé ;
5. seulement si la comparaison réussit, passer à `Validated` puis relire ;
6. mettre à jour `Current` puis relire la Company ;
7. si une ancienne Current existe, la passer à `Superseded` puis la relire.

La preuve de chaque mutation est la sortie réelle de l’outil correspondant. Une réponse reformulée par le modèle n’est pas un readback. Toute absence ou divergence donne `persistence_status: FAILED`, interdit `Current` et interdit le statut global `COMPLETE`. Un seul essai de compensation sûre est autorisé après un échec Current.

## 7. Handoff et clôture

Chaque handoff porte `contract_version: 1.3.0`, `plugin_version: 1.3.10`, Run ID, module, identité, période, conclusion, confiance, gaps et données nécessaires au module suivant. `score` reste `null` pour Earnings Review, Short, Portfolio Fit et Memo CIO.

En transport MCP, le RUN RECEIPT conserve `transport`, `mcp_capabilities` et, si disponible, `mcp_readbacks` : liste de `{tool, arguments, output}` contenant les véritables enveloppes structurées retournées. Ne fabrique aucune entrée ; les `tool_proofs` de mutations restent vides en READ-only et contiennent seulement les vraies sorties `save_analysis` en profil MCP WRITE autorisé. Les erreurs et lectures incomplètes restent des gaps. Le RUN RECEIPT expose les capacités observées, les étapes atteintes, les IDs de preuves, les sorties d’outils de persistance pertinentes et les gaps. Il ne transforme jamais une affirmation du modèle en preuve.

Un module est `COMPLETE` seulement si son Evidence Ledger et son Evidence Gate sont complets. Un run persistant MCP est `COMPLETE` seulement après receipts verified et READ de clôture réels attendus pour chaque module. Un run historique persistant exige readback réel de toutes les pages et relations Current attendues.

## 8. Gate de complétude du rendu

`COMPLETE` exige le livrable intégral au format du framework et du Skill, toutes leurs sections obligatoires, un Evidence Ledger et un Evidence Gate complets, ainsi que les handoffs réellement produits et conformes au contrat. Une carte, une synthèse, un résumé ou un handoff seul ne remplace pas le rapport complet. Pour un composite, chaque module requis doit donc fournir son rapport complet et son handoff avant que le pipeline puisse être déclaré `COMPLETE`. Si un de ces éléments manque ou n’est qu’affirmé, marque le run `PARTIAL` et indique les éléments à compléter; ne reconstruis pas des preuves absentes. Cette gate réaffirme les exigences de format et de preuve déjà définies par le framework; elle n’ajoute aucun critère financier.
