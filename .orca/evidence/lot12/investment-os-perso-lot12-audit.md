# Audit de clôture Lot 12 — Investment OS Perso 1.3.6

## Provenance et portée

Le plugin est privé (`Investment OS Perso`, scope USER, permission Read). La source propriétaire 1.3.4 a été récupérée antérieurement via le backend (`Plugin_528146adc4188191978478e3d98c13bf`) et comparée au cache 1.3.4 avant édition : les neuf `SKILL.md` et la référence MCP principale étaient identiques (10/10). Le parent a ensuite confirmé la release privée 1.3.5 (`pluginrel_6ac3581c3b1c8191987b28634ba9d788`) et le cache installé 1.3.5. Celui-ci est désormais la seule baseline locale : l’auto-sync a retiré le cache 1.3.4. Les 20 frameworks/playbooks/check-frameworks protégés ont SHA identiques entre cache 1.3.5 et 1.3.6; la comparaison historique 1.3.4→1.3.5 avait également établi leur identité.

La copie de travail est `/tmp/investment-os-perso-lot12`. Aucun fichier backend/cache installé n’a été modifié. Aucune publication ni installation n’a été effectuée par cet audit; le parent contrôle la release. Les deux manifests sont en 1.3.6, conservent l’identité privée `Investment OS Perso`, la description longue appliquée par le parent et la permission `Read`.

## Delta 1.3.5 → 1.3.6

La passe finale modifie 30 fichiers : les 2 manifests, 6 templates de handoff dans les Skills, 8 copies du contrat d’exécution, le contrat Setup `handoff-envelope.md`, 2 contrats pipeline composites, 9 références MCP identiques et 2 component locks. Aucun framework, playbook ou check-framework financier n’a été modifié.

- Tous les champs `Plugin version` et `plugin_version` de la copie 1.3.6 sont alignés; `contract_version: 1.3.0` reste inchangé.
- Les contrats d’exécution répétés sont identiques entre les huit modules qui en possèdent un. Leur seul delta par rapport au cache 1.3.5 est `plugin_version: 1.3.1` → `1.3.6`. Le handoff-envelope Setup a le même changement de métadonnée uniquement.
- Les contrats pipeline Full Value et Full Analyse ne prétendent plus que le catalogue manque une recherche Company. Le texte de reprise de run reste distinct et inchangé.
- Les deux `component-lock.json` portent version 1.3.6 et date `2026-10-05`; tous les SHA des fichiers verrouillés correspondent aux bytes actuels, y compris les références MCP et pipelines modifiées.
- Les neuf références MCP sont byte-identiques et portent le contrat `resolve_company` : `query`, marché optionnel, statuts `resolved | ambiguous | not_found`, candidats avec `companyId`, `canonicalName`, `ticker`, `exchange` et `assetId` nullable. Aucune création automatique, résolution locale ou sélection silencieuse en cas d’ambiguïté n’est permise.
- Le client/catalogue observable annonce actuellement `save_analysis.input: unknown`; cette déclaration ne prouve pas la structure Analysis. La référence MCP n’affirme donc plus que des définitions sont embarquées ni ne prescrit un DTO interne. Elle demande au runtime d’inspecter le schéma complet et de résoudre les `$ref`; si celui-ci reste inconnu, ne pas soumettre. Le parent a signalé une correction serveur qui publie les schémas inline; après synchronisation client, ce point doit être revalidé avec le catalogue réellement exposé.

## Résidus d’infrastructure — classement

| Zone | Classe | Constat |
|---|---|---|
| Résolution de société dans les neuf plans MCP | Remplacée par Core-MCP | `resolve_company` est l’étape d’identité canonique avant les tools métier; les IDs sont réutilisés. Les Skills ne font aucun mapping portefeuille/watchlist. |
| D1, noms de tables/propriétés et gestion du stockage dans les plans actifs | Supprimés/remplacés | Pas de D1 ni d’accès physique dans les tool plans MCP. Lecture/écriture et projection restent au Core/adapters. |
| Sélection Current, relations Company↔Analysis et choix « dernière analyse » | Remplacés par Core-MCP | Les Skills demandent Current par famille ou une archive explicitement identifiée; ils ne trient ni ne reconstruisent localement les relations. Aucun fallback silencieux « dernière analyse » dans les plans actifs. |
| Retry infrastructurel | Remplacé/borné | Pas de retry mutation automatique. Un retry READ borné relève du serveur; aucun Skill ne boucle autour des tools. |
| Providers historiques Setup (Notion/Supabase/adapters) | Légitime, configuration legacy explicite | Schémas et opérations physiques y restent descriptifs d’un provider choisi explicitement. Le flux MCP ne tombe pas en fallback vers ces providers. |
| Affichage CIO et compatibilité des relations historiques | Légitime avec limite de portée | Le contrat d’affichage conserve des formes historiques; cela ne pilote ni résolution ni Current dans les Skills MCP. |
| Calculs Portfolio et validation Quote | Légitimes comme méthode financière | Calcul d’exposition, fraîcheur, instrument/devise/source appartiennent aux frameworks; les inputs proviennent des tools canoniques ou d’un snapshot donné. Ce n’est pas une reconstruction d’index backend. |
| Company absente dans Portfolio Fit / provider Setup | Corrigée et bornée | Le préflight interdit explicitement toute création Company dans le MCP Lot 12; le provider historique Setup exige un choix explicite et ne sert jamais de fallback. |
| Playbook Portfolio Fit mentionnant le provider Notion historique | Legacy conservé | SHA protégé et inchangé. Le contrat courant borne le provider au choix explicite de Setup, sans fallback après erreur MCP. |
| Références MCP dupliquées dans neuf Skills | Dette documentaire | Les copies sont identiques et un test vérifie leur synchronisation. Leur déduplication nécessiterait de changer le packaging/routage des Skills, hors cette passe. |

## Vérification

Le script autonome `/tmp/test-investment-os-perso-lot12.mjs` passe. Il contrôle les deux manifests et permissions, les neuf Skills/références identiques, le contrat resolve_company, la prudence sur le schéma `save_analysis`, l’égalité des huit execution-contracts, les versions exhaustives, les deux locks et tous leurs hashes, l’absence des clauses périmées de recherche Company et les 20 SHA protégés contre le cache installé 1.3.5.

Le premier essai après auto-sync a échoué uniquement parce que le chemin du cache 1.3.4 n’existait plus; le script a été basculé sur la baseline disponible 1.3.5 et passe ensuite. Les méthodes restent byte-identiques à cette baseline, elle-même vérifiée identique à 1.3.4 pour les 20 fichiers protégés.

## Preuves runtime rapportées par le parent

Le parent rapporte un workflow Business réel sur le plugin hôte 1.3.5 : `resolve_company("Microsoft")` a renvoyé le companyId canonique `3b337ea7af3581038c01ec1b0f33d8c4` et assetId `msft`, suivi de `get_company` et `get_current_analysis`; la persistance est `NOT_REQUIRED` en Conversation. Ce runtime ne teste pas la copie documentaire 1.3.6 ni les workflows composites.

Le parent rapporte également la correction du catalogue `save_analysis` dans le serveur MCP, les tests MCP 23/23 et suite globale 279/279 PASS, ainsi qu’une publication Sites v223 en cours. Ces éléments sont des informations parentales et non une validation indépendante par ce test documentaire.

## Limites

Ce travail ne publie pas et ne prouve pas le déploiement de la copie 1.3.6. Les parcours end-to-end Full Value et Full Analyse ne sont pas testés dans cette passe. Le schema `save_analysis` doit être relu via le catalogue post-déploiement avant tout WRITE; le WRITE reste fermé en production. Le verdict métier Lot 12 dépend encore des exécutions runtime Full Value et Full Analyse demandées au parent.

## Addendum final — 1.3.6 → 1.3.7

Le parent a identifié un défaut concret de routage dans l’exécution Full Value : le tool recevait `get_company(companyId)` au lieu de l’argument MCP `id`. Les huit plans de Skills qui appellent `get_company` sont maintenant écrits explicitement `get_company(id=companyId)`, conformément à la table d’arguments JSON de la référence MCP. Le test vérifie les huit plans et interdit l’ancienne forme positionnelle.

La copie a été incrémentée à 1.3.7 dans les deux manifests, les handoffs Skills et les champs `plugin_version` des contrats/locks. Les hashes des deux locks composites ont été recalculés. Les corrections parentales Portfolio Fit sont conservées : fermeture correcte du backtick de `BLOCKED_INPUT` et précision qu’aucune Company ne peut être créée dans le flux MCP Lot 12; Setup historique exige un choix explicite et ne sert jamais de fallback.

Vérification finale : `node /tmp/test-investment-os-perso-lot12.mjs` passe en 1.3.7, dont les contrôles couvrent les formes des appels, ces deux clauses Portfolio Fit, les versions exhaustives, hashes component-lock et les 20 fichiers financiers protégés. Le schéma de `save_analysis` reste formulé prudemment dans cette copie : le parent rapporte que le serveur v223 publie les définitions inline, mais la surface catalogue consultable dans ce contexte expose encore `input: unknown`; aucun shape Analysis n’est donc affirmé ici.

## Addendum final — 1.3.7 → 1.3.8

Après deux runs réels où les Skills composites ont conclu `COMPLETE` avec de simples synthèses alors que les frameworks exigent les rapports intégraux, une gate documentaire compacte a été ajoutée aux huit copies synchronisées du contrat d’exécution et rappelée dans les Skills Full Value et Full Analyse. `COMPLETE` exige désormais explicitement le livrable complet au format du framework/Skill, toutes les sections obligatoires, Evidence Ledger/Evidence Gate complets et les handoffs conformes réellement produits pour chaque module. Une card, synthèse, résumé ou handoff seul ne suffit pas; une pièce manquante signifie `PARTIAL` avec les gaps nommés.

Le texte précise que cette gate réaffirme les formats et exigences de preuve déjà définis et n’ajoute aucun critère financier. Aucun framework, score, seuil ou playbook n’a été modifié. La copie est incrémentée à 1.3.8 partout et les deux component-locks composites ont été recalculés.

`node /tmp/test-investment-os-perso-lot12.mjs` passe en 1.3.8. Le test vérifie la présence et l’identité de la gate dans les huit contrats, le rappel dans les deux Skills composites, les versions, tous les hashes verrouillés et les 20 SHA des frameworks/playbooks/check-frameworks protégés contre le cache installé 1.3.5.

## Addendum final — 1.3.8 → 1.3.9 : dates de persistance

Le parent rapporte qu’un unique `save_analysis` de test LITE a retourné une erreur opaque avec statut completed et sans receipt; aucun retry n’a été effectué. WRITE est maintenant refermé, confirmé en environnement 11 / Site v226. Aucune mutation ni aucun receipt supplémentaire n’est demandé par cette correction documentaire; cela ne vaut pas validation/persistance et ne donne aucun GO runtime.

Les neuf références MCP identiques précisent désormais les valeurs de date acceptées par `save_analysis` : dates ISO `YYYY-MM-DD`, dates-heures ISO 8601/RFC 3339, ou `null` seulement si le champ le permet. `presentation.facts.asOf` ne reçoit jamais une période comme `FY2026` ou `Q4 FY2026`; la période reste dans contenu/label, aucune date de clôture n’est inventée et `null` est utilisé si le schéma l’autorise mais aucune date réelle n’existe. Le document précise qu’un JSON bien formé ne prouve pas la validation Core ni la persistance; seuls la réponse et le receipt réellement retournés en sont la preuve.

Les deux manifests, métadonnées Skills, contrats et locks passent à 1.3.9; les hashes composites sont recalculés. Le test documentaire `/tmp/test-investment-os-perso-lot12.mjs` passe et continue de vérifier les 20 SHA protégés inchangés. Aucun framework, playbook, score ou méthode financière n’a été modifié.
