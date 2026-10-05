# Lot 12 — conformité des frontières externes, avant WRITE

État de travail : source opérationnelle Sites `/tmp/lot12-site-source`, HEAD `bd744be6d31aaef7978f1647596c60172674d06f`, publication v233. Corrections locales non commitées/non publiées. Aucun WRITE réseau pendant cet audit. Verrou de release `SITE_WRITE_RELEASE_APPROVED=false` conservé. Aucun changement financier, Core, Skills, contrat MCP ou mapping Summary/TL;DR. Lot 13 non démarré.

## Notion — périmètre et références

L'application utilise REST/fetch avec `Notion-Version: 2026-03-11`, pas le SDK Notion. Les types officiels sont employés uniquement comme oracle de conformité hors réseau : dépôt `makenotion/notion-sdk-js`, commit `37d6d24b56dfb15633164fb1eaffd8d836360500`, fichiers `common.ts`, `pages.ts`, `blocks.ts` archivés avec SHA256 dans `notion-official-37d6d24b/provenance.json`. Les copies main ont été comparées byte-for-byte aux mêmes fichiers téléchargés depuis ce commit immuable.

Références primaires :
- https://developers.notion.com/reference/block
- https://developers.notion.com/reference/page-property-values
- https://developers.notion.com/reference/request-limits
- https://developers.notion.com/reference/status-codes
- https://github.com/makenotion/notion-sdk-js/tree/37d6d24b56dfb15633164fb1eaffd8d836360500/src/api-endpoints

Le mapper réel émet : création de page avec parent data_source_id/properties/children ; update des propriétés de page ; update du statut ; update de la relation Current de Company ; append de children. Les READs supplémentaires ont des query filters rich_text, page_size<=100 et cursors omis lorsqu'absents. Le reader sync séparé émet seulement des requêtes de lecture/query, sans création/update Notion.

La DB Analyses réelle déjà capturée comporte Analysis(title), Run ID(rich_text), Company(relation), Agent(select), Status(select), Analysis Date(date), Source Freshness(select), Score(number), Verdict(rich_text), Confidence(select), Handoff Summary(rich_text). Les validations utilisent ces types physiques ; aucune propriété Summary artificielle n'est ajoutée.

| Écart prouvé | DTO interne / DTO attendu | Fichier/fonction | Impact | Correction minimale / test |
|---|---|---|---|---|
| callout.icon:null | Analysis permet icon:null ; Notion CalloutBlockObjectRequest attend icon?:PageIconRequest, sans null | analysis-writes.ts / blocksFor | rejet provider400 possible malgré isAnalysis/Core valides | omission de icon en absence d'icône, emoji inchangé ; tests absence/emoji/absence de null |
| contrôle de taille en caractères UTF-16 | ancienne JSON.stringify(...).length ; Notion limite les octets du body complet | analysis-writes.ts / writeAnalysis/request | texte multioctet pouvait franchir la limite provider | mesure UTF-8, garde conservatrice450000 sur contenu, body500000 ; test multioctet |
| tableaux internes/URL/blocs imbriqués non bornés | rich_text, children de table et relations étaient envoyés tels quels | analysis-writes.ts / blocksFor/request | un Analysis valide peut produire un body provider invalide | garde tableaux100, texte/URL2000, blocs1000 par requête ; preflight de tous les chunks avant journal/mutation ; tests rich_text101/table101/URL trop longue |
| retry de mutation HTTP429 | mutate bouclait jusqu'à3 tentatives ; contrat Lot12 impose1 | analysis-writes.ts / mutate | WRITE pouvait être rejoué automatiquement | une invocation request ; test existant corrigé pour1 requête,0 création |
| corps d'erreur Notion perdu | HTTP400 réduit à invalid_input sans motif provider | analysis-writes.ts / request ; investment-reads.ts / createInvestmentService | diagnostic opaque dans résultat MCP | parsing sûr, code whitelist/status/type, paths structuraux/types attendus expurgés ; collecte locale à chaque save dans metadata.diagnostics ; tests secret/valeur/request_id absents et diagnostic visible via service |

Autres nullable/optional : aucun autre null interdit trouvé dans les DTO émis. select:null, status:null, date:null et number:null sont explicitement autorisés dans les propriétés officielles. title/rich_text vides sont des tableaux ; relation vide est un tableau ; text.link est omis sans href ; annotation/color ont des valeurs ; date.start est passé depuis le contrat ISO ; icon de callout est omis en absence, jamais null. Les null du journal ou des comparaisons sémantiques ne sont pas envoyés au provider. Page.icon autorise par ailleurs null dans l'API officielle, mais ce mapper ne l'émet pas.

Paragraphes, headings1-3, deux types de listes, quotes, callouts, dividers, tables et table_row respectent leurs formes officielles utilisées. Les enfants créés sont limités à100 par chunk. Tables : largeur positive, rangées homogènes, cellules rich_text, enfants table_row. Pas d'enfants autres que tables dans ce mapper : profondeur produite bornée. Les headings>3 et blocs unsupported restent rejetés par l'adapter avant mutation : restriction existante, aucun changement demandé. Les types officiels ne prouvent pas la validité sémantique d'une chaîne emoji arbitraire ni les droits d'accès futurs ; le fixture emoji⭐ et les données NATIVE actuelles ont été vérifiés.

L'observabilité conserve uniquement les motifs structuraux reconnus, pas le message libre complet qui peut répéter le document ou un secret. Le résultat contient par exemple `code=notion_validation_error`, `Notion HTTP400; type=error; code=validation_error; body.children[6].callout.icon: expected object`. Les valeurs rejetées, property names inconnus, request_id et corps non JSON ne sont pas exposés. Si le texte provider ne correspond à aucune forme reconnue, seul status/type/code est conservé : ne pas prétendre conserver tous les messages libres futurs. La cause provider historique du test live n'est toujours pas récupérable rétrospectivement.

## MCP — audit Luna, source réellement utilisée

8 tools canoniques exposés dans les métadonnées du connecteur et dans le catalogue du serveur v233 : resolve_company/get_company/get_portfolio/get_position/get_current_analysis/get_analysis_by_id/get_quote/save_analysis. SDK installé/pinné1.32.0, contrat1.0.0. Le transport porte les timeouts30s, READ<=2 tentatives de transport, WRITE1. La suppression du retry provider429 ferme l'écart de mutation au-dessous de Core. Les observations READ internes au writer conservent leur politique préexistante ; aucune nouvelle affirmation sur un budget global de requêtes provider.

Le générateur déclare Draft07 et utilise definitions, pas $defs :99 définitions,24 refs, toutes résolubles. InputSchemas découverts inlinent les refs ; outputSchemas gardent definitions. Unions Analysis et null explicites, required/optional conformes aux types Core. Génération --check PASS. Input/output object roots reconnus par ToolSchema du SDK installé. Sorties validées explicitement par le transport avant sérialisation. Les8 mappings positionnels Core, rejet avant handler, refus WRITE, résultats structuredContent/isError/text fallback et propagation des erreurs Core sont couverts par les tests existants. Les7 appels NATIVE sont aussi validés par le save_analysis inputSchema découvert depuis le serveur local v233.

Écart MCP prouvé, correction proposée seulement : transports/mcp/server.ts, branche de validation output (ligne96 de v233), utilise rejected('invalid_input'), donc code diagnostic input_schema avec path output. Proposer diagnostic output_schema et assertion code/path dans le test badOutput existant. Non bloquant pour les payloads validés ; aucune modification du transport dans cette passe, conformément à la restriction de périmètre précédente.

Limite de preuve publiée : get_site confirme v233 et l'endpoint MCP ; le catalogue source est archivé, les8 tools exposés sont capturés. Une requête directe tools/list à l'endpoint a reçu Unauthorized via le dispatch. Ne pas la présenter comme une vérification live des input/outputSchemas. Aucun contournement d'authentification tenté. La confirmation réseau authentifiée du catalogue est encore à obtenir si exigée avant le prochain test.

## Validation et tests

- Tests Notion :40/40 PASS (baseline31,9 nouveaux ; test429 existant renforcé).
- Tests MCP/contracts :25/25 PASS, générateur --check PASS ; assertion SDK ToolSchema + output object root ajoutée au test discovery existant.
- Core + read adapter :15/15 PASS.
- Typecheck PASS ; build/artifact PASS, logs archivés.
- Diff --check PASS.
- Pas de suite globale rejouée : aucun total282 revendiqué dans cette passe ciblée.
- Sept exports NATIVE :2 LITE et5 NVIDIA, Analysis/Core/inputSchema MCP PASS, mapper réel->DTO provider PASS, sans requête réseau.12 DTO create/update/append vérifiés par TypeScript strict contre les types officiels, plus assertions limites/null. Résultats dans lot12-provider-native-conformity.json ; runner et snapshots archivés.
- NATIVE LITE Valuation reste Evidence Gate PARTIAL : preuves consensusFY2027E non établies. Aucune requalification financière durant cette passe. AN-597 demeure writer UNKNOWN, aucune relance.

## Idempotence — preuve reproduite hors réseau

Clé durable existante : ["NVDA-FA-20261005-NATIVE","business"].
Ancien digest (reproduction exacte du mapper antérieur == valeur D1 précédemment lue) :
`04567a84a4c595288bc38aa61f63e66b46db2f152366b182120b8672c54de765`.
Nouveau digest (même payload, même schéma réel, seule suppression de icon:null affecte le DTO) :
`3cd252ab46ca1b55fc2982811a714d5ef2f76092d1e4bd717b9ac54da1bd20fb`.

Bloc NVIDIA b3, children[6] après le préambule documentaire : ancien {rich_text:identique,icon:null} ; nouveau {rich_text:identique}, aucun champ icon. Les gardes/diagnostics ne modifient aucun octet persistant supplémentaire. Emoji présent : {icon:{type:'emoji',emoji:valeur}} inchangé.

Test avec ancien journal injecté + nouveau mapper : stale_request,0 création, rejet avant mutation provider. Ne pas supprimer/réécrire ce journal pour obtenir un PASS. Ne pas relancer l'ancien run automatiquement. Pour une nouvelle preuve distincte, proposer un nouvel identifiant explicitement autorisé, par exemple NVDA-FA-20261005-NATIVE-WRITEPROOF-01, en conservant les données financières et en archivant le lien avec le run analytique original. Cette modification de l'enveloppe nécessite validation et fenêtre future explicitement autorisée ; elle ne constitue pas une preuve Full Analyse same-run pour les cinq modules.

## Verdict avant nouvelle tentative

Conformité des sept DTO NATIVE corrigés : GO hors réseau.
Nouvelle tentative WRITE maintenant : NO-GO. Corrections encore locales/non publiées ; ancien run Business incompatible avec le digest durable ; nouvelle enveloppe de preuve non autorisée ; confirmation live de catalogue non obtenue par la lecture directe. Prochaine étape minimale : valider/publier cette correction avec WRITE maintenu fermé, confirmer le catalogue via canal authentifié, puis faire approuver un run de preuve distinct et sa fenêtre. Aucun WRITE, aucun reset de journal, aucun alignement destructif pendant cet audit. Lot12 reste PARTIAL.
