# AN-598 — diagnostic lecture seule

Aucune modification de production, aucun WRITE, aucun retry, aucun reset journal. Source v236/77122e9, verrou releasefalse.

## Établi

Le code persistence_verification_failed existe à un seul retour du writer, analysis-writes.ts:309. Après le POST réussi et la lecture complète, ce garde compare : parent.data_source_id ; propriétés physiques via propertiesMatch ; blocs via semanticBlock. Le receipt partial reçu démontre que ce garde a échoué ; il ne discrimine pas ses trois clauses.

Ce retour précède persisted=true, saveJournal(persisted) et le batch D1 documentUpsertStatement + analysisIndexStatements (lignes310-316). Le journal live archivé phasepersisting concorde. getAnalysisById utilise readAnalysis -> getResearchDocument -> SELECT notion_documents ; aucune lecture live Notion/fallback sur ce chemin. La réponse MCPnull établit donc l'indisponibilité dans ce read path au moment de lecture. La page Notion n'est pas absente : AN-598 a été directement observée avec Draft, bon run/Company/score/verdict et couverture textuelle275/275 après normalisation du rendu connecteur. Aucun batch d'indexation par ce writer n'a pu être exécuté après le retourpartial.

## Défaut de comparaison reproduit hors réseau

Payload exact de préflight, même schéma physique, même adapter/service, deux cas contrôlés :
- mock echo du DTO envoyé : receiptpersisted,1 ligne analyse D1, getAnalysisById nonnull ;
- seul changement dans la réponse GETchildren : callout.icon absent devient {type:emoji,emoji:💡} : receiptpartial/persistence_verification_failed, journalpersisting,0 ligne analyse D1, getAnalysisByIdnull.

Cause de ce défaut reproduit : blocksFor omet correctement icon absent ; semanticBlock renvoie icon:null pour le DTO attendu, mais icon:{type:emoji,emoji:💡} pour la réponse simulée. La comparaison canonicalJson n'est pas égale. Les tests existants utilisent une réponse mock qui recopie exactement le DTO, sans valeurs par défaut du provider, donc leurs deux tests callout passent sans détecter ce défaut de round-trip. Cette reproduction n'est pas un WRITE Notion et ne produit pas de receipt live.

## Limite d'attribution historique

Le readback Notion archivé affiche <callout icon=💡>. Il s'agit du rendu XML/markdown du connecteur, pas du JSON REST GETblocks/children utilisé par le writer. Le writer ne conserve pas les différences de son garde. Impossible de certifier, à partir des seules preuves présentes, que l'icône est l'unique clause ayant rejeté la réponse live : une autre différence parent/propriété/bloc/annotation/ordre peut coexister. Aucune hypothèse présentée comme preuve.

## Étape minimale restante

Obtenir par READ les blocs REST de AN-598 et ses tables, ainsi que la page REST, puis comparer exactement les trois clauses du garde aux DTO provider archivés. Les outils disponibles donnent le document du connecteur et la table D1, sans capture des réponses REST du writer. Ne pas modifier le mapper, ne pas rejouer save_analysis et ne pas considérer le replay du journal persisting comme une lecture. Si les REST confirment l'icône par défaut, correctif candidat limité à la comparaison d'icône non spécifiée, en conservant le contrôle strict d'une icône explicitement fournie ; ajouter le test du défaut provider simulé. Pas encore appliqué.

Lot12 reste PARTIAL. WRITE fermé. Lot13 non démarré.

## READ ultérieur : état actualisé

Le nouveau get_analysis_by_id renvoie désormais AN-598 non null : Draft, Company NVIDIA correcte, revision 2026-10-05T15:30:00.000Z, score92, verdictExcellent. La réponse brute est archivée dans diagnostic-latest-mcp-read.json. L'absence MCP était donc temporaire ; elle ne doit plus être présentée comme un blocker actuel d'accès. Le journal relu reste persisting, même digest/page et lease0 : le readback tardif ne transforme pas le receipt partial en receipt persisted/verified. L'origine exacte de l'alimentation ultérieure du cache n'est pas établie par ces READs.

Le callout relu via MCP porte aussi 💡. Dans le source opérationnel v236, notion-block-parser.iconText reprend l'emoji du body.icon ; son fallback est ◆, pas 💡. Cela confirme un écart sémantique observable avec le DTO envoyé sans icon. Le comparateur strict traite ces deux formes comme différentes. La réponse REST historique complète du writer manque toujours pour exclure des différences concomitantes dans ses autres clauses.

Le readback comporte quatre diagnostics unsupported_block / unrepresented_snapshot. Sa disponibilité ne suffit donc pas à certifier une égalité documentaire native intégrale. Aucun changement de production ni nouveau WRITE pendant ce diagnostic. Lot12 PARTIAL maintenu.
