/**
 * Deterministic, fictional data for the public demo workspace.
 * Nothing in this module is hydrated from D1, Notion, or the live quote cache.
 */
import type {
  CompanyDetail,
  CompanyDocument,
  CompanyListItem,
  LivePortfolio,
  ResearchDocument,
} from "./investment-data";
import type { ThemeBasketResponse, BasketDimension, BasketPeriod } from "./theme-baskets";

const reference = (kind: "business" | "valuation" | "short" | "portfolio" | "memo", title: string, id: string) => ({
  id, kind, title, agent: `${kind[0].toUpperCase()}${kind.slice(1)} Analyst`,
  score: "—", verdict: "Illustration fictive", confidence: "Moyenne", status: "Démo", date: "2026-09-01",
  lastEditedTime: "2026-09-01T09:00:00.000Z", notionUrl: "#",
});

const demoDocuments: CompanyDocument[] = [
  {
    id: "demo-analysis-luma-business", title: "LumaGrid — analyse d’activité", sourceKey: "analyses", category: "business",
    agent: "Business Analyst (exercice pédagogique)", notionUrl: "#", lastEditedTime: "2026-08-26T09:00:00.000Z",
    plainText: `# Cadre de l’exercice
LumaGrid Systems est une entreprise entièrement fictive créée pour présenter le lecteur d’analyses. Elle imagine, fabrique et entretient des batteries stationnaires pour des réseaux électriques régionaux. Le ticker LUMA, le marché fictif et tous les chiffres de cette démonstration sont inventés. Cette note n’est pas une analyse produite par un plugin d’investissement et ne s’appuie pas sur des sources externes.

## Modèle économique
Le cas suppose trois sources de revenus : vente de systèmes de stockage, contrats d’intégration et services de maintenance. Les contrats de maintenance donnent une visibilité potentielle, mais le cas ne fournit aucun historique client vérifié. Les revenus de matériel restent liés au calendrier des appels d’offres, aux autorisations locales et à la capacité de livrer les équipements.

## Hypothèses pédagogiques pour 2026
- Chiffre d’affaires de départ fictif : 1,2 milliard d’euros.
- Marge brute fictive : 24 %, sans historique publiquement vérifiable.
- Part des services fictive : 18 % du chiffre d’affaires.
- Flux de trésorerie opérationnel fictif : négatif pendant la phase d’expansion.

Ces hypothèses servent uniquement à illustrer les enchaînements entre croissance, marge et consommation de capital. Elles ne décrivent aucune société réelle.

## Qualité et limites
Le besoin de stockage est un moteur structurel plausible dans le cadre narratif, mais l’avantage concurrentiel de LumaGrid reste à démontrer. Le dossier ne contient ni contrats clients vérifiés, ni données de rétention, ni ventilation indépendante des coûts. L’industrialisation peut accroître le volume tout en dégradant le rendement du capital si les usines sont sous-utilisées.

## Questions de suivi
1. Les services progressent-ils plus vite que les ventes de matériel ?
2. Les nouveaux sites atteignent-ils le rendement attendu après leur démarrage ?
3. Les besoins de financement restent-ils compatibles avec le scénario de croissance ?

## Conclusion pédagogique
Cas de croissance industrielle à forte intensité capitalistique. L’exercice est utile pour relier cadence de livraison, marge brute et besoin de financement ; les données fournies ne permettent pas de conclure sur une entreprise réelle.`,
    summary: "Cas fictif de stockage électrique ; la qualité du modèle dépend de l’industrialisation et des services.", handoffSummary: "Pour l’exercice de valorisation, tester une montée graduelle de la marge et un besoin de capital durable.",
    status: "Démo pédagogique", score: "72 / 100 (illustratif)", verdict: "Exécution industrielle à démontrer", confidence: "Faible", date: "2026-08-26", relations: [], archived: false, current: true,
  },
  {
    id: "demo-analysis-luma-valuation", title: "LumaGrid — cadre de valorisation", sourceKey: "analyses", category: "valuation",
    agent: "Valuation Analyst (exercice pédagogique)", notionUrl: "#", lastEditedTime: "2026-08-27T09:00:00.000Z",
    plainText: `# Cadre de valorisation fictif
Cet exercice reprend uniquement les hypothèses inventées dans la note d’activité du 26 août 2026. LumaGrid n’est pas une société cotée réelle ; LUMA n’est pas un ticker négociable. Il n’y a ni cours de référence observé, ni valeur intrinsèque publiée, ni recommandation.

## Hypothèses centrales
- Année de base fictive : 2026, chiffre d’affaires de 1,2 Md€.
- Croissance annuelle fictive du chiffre d’affaires : 14 % pendant cinq ans.
- Marge opérationnelle fictive : progression de 4 % à 10 % sur cinq ans.
- Investissements fictifs : 9 % du chiffre d’affaires, puis baisse graduelle à 6 %.
- Taux d’actualisation pédagogique : 10 % ; croissance terminale illustrative : 2 %.

Ces paramètres ne proviennent d’aucun dépôt réglementaire, consensus ou source de marché. Le modèle est un support d’apprentissage : il montre surtout la sensibilité d’une entreprise industrielle aux marges et aux dépenses d’expansion.

## Scénarios, horizon 2031
| Scénario | Croissance annuelle | Marge opérationnelle | Lecture pédagogique |
|---|---:|---:|---|
| Prudent | 7 % | 6 % | Retards de livraison et capacité sous-utilisée |
| Central | 14 % | 10 % | Croissance soutenue, gains industriels graduels |
| Favorable | 20 % | 13 % | Contrats récurrents et montée en cadence rapide |

Les scénarios ne sont pas des probabilités ni des objectifs de cours. Un changement modeste de marge peut déplacer fortement la valeur théorique quand les flux lointains dominent le calcul.

## Contrôles de sensibilité
1. Réduire la croissance à 7 % sans modifier le besoin d’investissement.
2. Maintenir la marge opérationnelle à 6 % au lieu de supposer une amélioration.
3. Porter le taux d’actualisation à 12 % et ramener la croissance terminale à 1 %.

## Conclusion
Dans cet exemple, toute conclusion dépend davantage de la réalisation de la marge cible que du taux de croissance seul. Aucune juste valeur n’est présentée car les données de départ sont entièrement fictives et ne représentent pas une valorisation exploitable.`,
    summary: "Trois scénarios inventés illustrent la sensibilité aux marges, au capital investi et au taux d’actualisation.", handoffSummary: "Le cas central exige une marge opérationnelle de 10 % en 2031 ; chercher les conditions qui invalideraient cette trajectoire.",
    status: "Démo pédagogique", score: "Non calculé", verdict: "Aucune valeur de marché", confidence: "Nulle", date: "2026-08-27", relations: [], archived: false, current: true,
  },
  {
    id: "demo-analysis-luma-short", title: "LumaGrid — contre-thèse et risques", sourceKey: "analyses", category: "risques",
    agent: "Short Seller (exercice pédagogique)", notionUrl: "#", lastEditedTime: "2026-08-28T09:00:00.000Z",
    plainText: `# Contre-thèse fictive
Cette lecture contradictoire est un exercice construit à partir du cas LumaGrid inventé. Elle ne constitue pas une recherche vendeuse sur une entreprise existante.

## Thèse baissière
Le scénario de croissance peut masquer un modèle qui consomme du capital plus vite qu’il n’en crée. Une hausse des livraisons ne garantit pas une amélioration des marges si les installations nécessitent des adaptations coûteuses, des garanties longues ou des pénalités de retard.

## Risques à tester
- **Concentration clients :** un petit nombre d’appels d’offres fictifs pourrait faire varier fortement le carnet de commandes.
- **Risque d’exécution :** les retards de mise en service repoussent la reconnaissance du revenu et immobilisent le fonds de roulement.
- **Risque de financement :** des dépenses d’expansion soutenues peuvent imposer une levée de capitaux dans des conditions défavorables.
- **Risque technologique :** une baisse rapide du coût des solutions concurrentes peut réduire les prix proposés par LumaGrid.
- **Risque de qualité des données :** toutes les métriques du cas sont inventées ; aucune vérification indépendante n’est possible.

## Déclencheurs d’invalidation de la thèse optimiste
1. Marge brute sous 20 % pendant deux périodes fictives consécutives.
2. Retards de livraison répétés accompagnés d’une hausse des créances clients.
3. Besoin de financement supérieur au scénario central sans amélioration visible de la marge.

## Ce qui réfuterait la contre-thèse
Des contrats diversifiés, une marge après installation stable et une conversion mesurable du bénéfice en trésorerie affaibliraient le scénario négatif — à condition que ces éléments soient vérifiables dans un cas réel.

## Conclusion
Le principal risque du modèle pédagogique est le décalage entre croissance comptable et génération de trésorerie. Les signaux listés sont des hypothèses de travail, pas des faits observés.`,
    summary: "La contre-thèse porte sur l’intensité capitalistique, les retards de livraison et la conversion en trésorerie.", handoffSummary: "Tester si le risque d’exécution rend incohérent le scénario central de marge et d’investissement.",
    status: "Démo pédagogique", score: "—", verdict: "Risque d’exécution majeur (cas fictif)", confidence: "Faible", date: "2026-08-28", relations: [], archived: false, current: true,
  },
  {
    id: "demo-analysis-luma-portfolio", title: "LumaGrid — exercice d’intégration portefeuille", sourceKey: "analyses", category: "portfolio",
    agent: "Portfolio Fit (exercice pédagogique)", notionUrl: "#", lastEditedTime: "2026-08-29T09:00:00.000Z",
    plainText: `# Cas pédagogique d’allocation
Cet exercice montre comment examiner le rôle d’une ligne dans un portefeuille fictif. Les montants ci-dessous sont inventés et ne représentent aucun compte ou mandat réel.

## Portefeuille de démonstration
- Valeur totale illustrative : 10 000 €.
- Ligne LumaGrid fictive : 4 300 €, soit 43 % de l’exemple.
- Exposition industrielle fictive : 43 % ; exposition technologique fictive : 47 % ; liquidités : 10 %.
- Aucune donnée de risque, corrélation ou cotation réelle n’est utilisée.

## Lecture de concentration
Le poids de 43 % est volontairement élevé pour rendre visible l’effet d’une ligne dominante. Une variation de 20 % de cette position déplacerait mécaniquement la valeur du portefeuille d’environ 8,6 % avant tout autre mouvement. Ce calcul est arithmétique et ne constitue pas une mesure probabiliste du risque.

## Questions d’adéquation
1. L’exposition à l’industrie est-elle déjà importante via d’autres lignes ?
2. Le scénario de perte est-il supportable sans vente forcée ?
3. Le risque de liquidité est-il compatible avec l’horizon retenu ?
4. Existe-t-il des actifs fictifs redondants dans le thème d’électrification ?

## Conclusion
L’exemple suggère qu’une conviction d’entreprise ne suffit pas à déterminer une taille de position. La concentration, la liquidité et les scénarios de perte doivent être examinés ensemble. Aucun conseil d’allocation n’est fourni.`,
    summary: "Exercice d’allocation fictif : le poids illustratif de 43 % expose le cas à un risque de concentration marqué.", handoffSummary: "Le mémo doit conserver la distinction entre une thèse d’entreprise fictive et le risque de taille de position.",
    status: "Démo pédagogique", score: "—", verdict: "Concentration illustrativement élevée", confidence: "Faible", date: "2026-08-29", relations: [], archived: false, current: true,
  },
  {
    id: "demo-analysis-luma-memo", title: "LumaGrid — mémo de synthèse fictif", sourceKey: "analyses", category: "synthese",
    agent: "Investment Memo (exercice pédagogique)", notionUrl: "#", lastEditedTime: "2026-08-30T09:00:00.000Z",
    plainText: `# Synthèse pédagogique
Ce mémo relie les quatre notes fictives datées du 26 au 29 août 2026. Il ne suit pas un protocole canonique de plugin, ne résulte pas d’une analyse réelle et ne recommande aucune opération.

## Thèse en une phrase
LumaGrid pourrait bénéficier du besoin de stockage réseau si elle convertit sa croissance en marges et trésorerie, mais l’industrialisation et le financement restent les principales inconnues du cas.

## Éléments favorables dans le cas
- Le modèle combine équipements, intégration et maintenance.
- Le revenu de services pourrait améliorer la visibilité si la rétention était démontrée.
- Les scénarios permettent de tester explicitement la montée des marges.

## Éléments défavorables et inconnues
- Le cas ne contient aucune donnée vérifiée sur contrats, clients ou coûts.
- Les besoins d’investissement peuvent retarder l’autofinancement.
- Une ligne illustrative de 43 % crée une concentration excessive pour l’exemple.

## Décision fictive
**Conclusion :** poursuivre l’exercice en mode observation ; aucune entrée, cible ou valeur de marché n’est définie.

**Condition de réexamen :** dans une analyse réelle, obtenir des données vérifiables sur carnet de commandes, marge après installation, conversion en trésorerie et besoin de financement.

## Limites
Tous les noms, chiffres, scénarios et prix affichés dans la démonstration sont synthétiques. Ils ne doivent pas être utilisés pour prendre une décision d’investissement.`,
    summary: "Cas fictif : croissance potentielle contre risque d’exécution, de financement et de concentration.", handoffSummary: "Conclusion de l’exercice : observation seulement ; aucune opération ni cible définie.",
    status: "Démo pédagogique", score: "—", verdict: "Observation fictive", confidence: "Faible", date: "2026-08-30", relations: [], archived: false, current: true,
  },
  {
    id: "demo-analysis-northstar-memo", title: "Northstar Mobility — mémo fictif", sourceKey: "analyses", category: "synthese",
    agent: "Investment Memo Analyst", notionUrl: "#", lastEditedTime: "2026-09-01T09:10:00.000Z",
    plainText: "Cas pédagogique entièrement inventé. Northstar Mobility conçoit des logiciels de gestion de flottes. La thèse dépend de la rétention des clients et de la rentabilité du service. Aucun plugin canonique n’a été appliqué.",
    summary: "Cas fictif de logiciel de gestion de flottes.", handoffSummary: "Comparer croissance récurrente et coût d’acquisition.",
    status: "Démo", score: "68", verdict: "À surveiller", confidence: "Faible", date: "2026-09-01", relations: [], archived: false, current: true,
  },
];

const byId: Record<string, CompanyListItem> = {
  "demo-lumagrid": {
    id: "demo-lumagrid", name: "LumaGrid Systems", ticker: "LUMA", sector: "Industrie", industry: "Stockage électrique (fictif)",
    ownershipStatus: "Owned", watchlistMembership: true, monitoringStatus: "Démo", businessScore: 72,
    businessVerdict: "Croissance à confirmer", researchStage: "Illustration", researchPriority: "Moyenne", lastAnalysis: "2026-09-01",
    themes: ["Électrification", "Infrastructures"], country: "France", currency: "EUR", exchange: "FICTIF",
    dataCompleteness: "Données illustratives", notionUrl: "#",
    researchReferences: [
      reference("business", "LumaGrid — analyse d’activité", "demo-analysis-luma-business"),
      reference("valuation", "LumaGrid — cadre de valorisation", "demo-analysis-luma-valuation"),
      reference("short", "LumaGrid — contre-thèse et risques", "demo-analysis-luma-short"),
      reference("portfolio", "LumaGrid — exercice d’intégration portefeuille", "demo-analysis-luma-portfolio"),
      reference("memo", "LumaGrid — mémo de synthèse fictif", "demo-analysis-luma-memo"),
    ],
  },
  "demo-northstar": {
    id: "demo-northstar", name: "Northstar Mobility", ticker: "NSTM", sector: "Technologie", industry: "Logiciels de flotte (fictif)",
    ownershipStatus: "Owned", watchlistMembership: true, monitoringStatus: "Démo", businessScore: 68,
    businessVerdict: "À surveiller", researchStage: "Illustration", researchPriority: "Moyenne", lastAnalysis: "2026-09-01",
    themes: ["Logiciels", "Mobilité"], country: "Canada", currency: "CAD", exchange: "FICTIF",
    dataCompleteness: "Données illustratives", notionUrl: "#",
    researchReferences: [reference("memo", "Northstar Mobility — mémo fictif", "demo-analysis-northstar-memo")],
  },
  "demo-helio": {
    id: "demo-helio", name: "Helio Materials", ticker: "HELI", sector: "Matériaux", industry: "Matériaux avancés (fictif)",
    ownershipStatus: "Not owned", watchlistMembership: true, monitoringStatus: "Démo", businessScore: null,
    businessVerdict: "En observation", researchStage: "Exploration", researchPriority: "Faible", lastAnalysis: null,
    themes: ["Électrification", "Matériaux avancés"], country: "Suède", currency: "SEK", exchange: "FICTIF",
    dataCompleteness: "Données illustratives", notionUrl: "#", researchReferences: [],
  },
};

const detailDocs: Record<string, CompanyDocument[]> = {
  "demo-lumagrid": demoDocuments.slice(0, 5),
  "demo-northstar": [demoDocuments[5]],
  "demo-helio": [],
};

const emptySlice = { marketValueEur: 0, investedValueEur: 0, cashValueEur: 0, costBasisEur: 0, pnlEur: 0, pnlPercent: null,
  brokerCostBasisEur: 0, brokerPnlEur: 0, brokerPnlPercent: null, positions: 0 } as const;
const demoSlice = { marketValueEur: 10000, investedValueEur: 9000, cashValueEur: 1000, costBasisEur: 8600, pnlEur: 400,
  pnlPercent: 4.65, brokerCostBasisEur: 8600, brokerPnlEur: 400, brokerPnlPercent: 4.65, positions: 3 } as const;

const demoPortfolio: LivePortfolio = {
  generatedAt: "2026-09-01T09:00:00.000Z", quoteAsOf: null, oldestQuoteAsOf: null,
  // Required by the existing API type; this demo portfolio is static and has no Notion links or live quote provenance.
  targetSource: "Notion Portfolio · Target Weight 10k + Target Weight",
  targetLines: [
    { id: "demo-lumagrid", name: "LumaGrid Systems", target10kWeight: 50, target10kEur: 5000, target25kWeight: 40, target25kEur: 10000 },
    { id: "demo-northstar", name: "Northstar Mobility", target10kWeight: 40, target10kEur: 4000, target25kWeight: 40, target25kEur: 10000 },
    { id: "demo-cash", name: "Liquidités", target10kWeight: 10, target10kEur: 1000, target25kWeight: 20, target25kEur: 5000 },
  ],
  targetTotals: { target10kWeight: 100, target25kWeight: 100 }, totals: { ...demoSlice },
  slices: { total: { ...demoSlice }, CTO: { ...demoSlice }, PEA: { ...emptySlice } },
  positions: [
    { id: "demo-position-luma", targetId: "demo-lumagrid", name: "LumaGrid Systems — CTO", instrumentType: "Fictional equity", account: "CTO",
      sector: "Industrie", industry: "Stockage électrique (fictif)", themes: ["Électrification", "Infrastructures"], primaryTheme: "Électrification",
      country: "France", countryExposures: [{ name: "France", weight: 1 }], sectorExposures: [{ name: "Industrie", weight: 1 }], themeExposures: [{ name: "Électrification", weight: 1 }],
      quantity: 20, pruEur: 200, brokerPruEur: 200, pruSource: "notion-pru", costBasisEur: 4000, brokerCostBasisEur: 4000,
      marketValueEur: 4300, pnlEur: 300, pnlPercent: 7.5, brokerPnlEur: 300, brokerPnlPercent: 7.5, weight: 43,
      targetWeight: 50, targetEur: 5000, target10kWeight: 50, target10kEur: 5000, quoteSymbol: null, nativePrice: 215, nativeCurrency: "EUR", eurPrice: 215,
      fxRate: 1, fxMarketTime: null, fetchedAt: null, quoteWarnings: ["Cours synthétique de démonstration, non coté."], changePercent: null, quoteSource: "illustrative", quoteFreshness: "demo", marketTime: null,
      companyIds: ["demo-lumagrid"], notionUrl: "#", warning: null },
    { id: "demo-position-northstar", targetId: "demo-northstar", name: "Northstar Mobility — CTO", instrumentType: "Fictional equity", account: "CTO",
      sector: "Technologie", industry: "Logiciels de flotte (fictif)", themes: ["Logiciels", "Mobilité"], primaryTheme: "Logiciels",
      country: "Canada", countryExposures: [{ name: "Canada", weight: 1 }], sectorExposures: [{ name: "Technologie", weight: 1 }], themeExposures: [{ name: "Logiciels", weight: 1 }],
      quantity: 50, pruEur: 92, brokerPruEur: 92, pruSource: "notion-pru", costBasisEur: 4600, brokerCostBasisEur: 4600,
      marketValueEur: 4700, pnlEur: 100, pnlPercent: 2.17, brokerPnlEur: 100, brokerPnlPercent: 2.17, weight: 47,
      targetWeight: 40, targetEur: 4000, target10kWeight: 40, target10kEur: 4000, quoteSymbol: null, nativePrice: 140, nativeCurrency: "CAD", eurPrice: 94,
      fxRate: 0.6714285714, fxMarketTime: null, fetchedAt: null, quoteWarnings: ["Cours et change synthétiques de démonstration, non cotés."], changePercent: null, quoteSource: "illustrative", quoteFreshness: "demo", marketTime: null,
      companyIds: ["demo-northstar"], notionUrl: "#", warning: null },
    { id: "demo-position-cash", targetId: "demo-cash", name: "Liquidités CTO", instrumentType: "Cash", account: "CTO",
      sector: "Liquidités", industry: "", themes: [], primaryTheme: "", country: null, countryExposures: [], sectorExposures: [{ name: "Liquidités", weight: 1 }], themeExposures: [],
      quantity: 1000, pruEur: null, brokerPruEur: null, pruSource: "missing", costBasisEur: 0, brokerCostBasisEur: 0,
      marketValueEur: 1000, pnlEur: 0, pnlPercent: null, brokerPnlEur: 0, brokerPnlPercent: null, weight: 10,
      targetWeight: 20, targetEur: 5000, target10kWeight: 10, target10kEur: 1000, quoteSymbol: null, nativePrice: 1, nativeCurrency: "EUR", eurPrice: 1,
      fxRate: 1, fxMarketTime: null, fetchedAt: null, quoteWarnings: [], changePercent: null, quoteSource: "cash", quoteFreshness: "fresh", marketTime: null,
      companyIds: [], notionUrl: "#", warning: null },
  ],
  sectors: [{ name: "Industrie", valueEur: 4300, weight: 43 }, { name: "Technologie", valueEur: 4700, weight: 47 }, { name: "Liquidités", valueEur: 1000, weight: 10 }],
  coverage: { live: 0, manual: 2, stale: 0, unavailable: 0, cash: 1, total: 3 },
  reconciliation: { status: "ok", coherent: 3, warnings: 0, errors: 0, issues: [], accountChecks: { CTO: { linesValueEur: 9000, sliceValueEur: 10000, deltaEur: 1000 } } },
  calculation: { pnlScope: "unrealized-open-positions", realizedPnlAvailable: false, feesIncluded: false, dividendsIncluded: false, source: "Notion PRU + live quotes + FX" },
};

const basketNames: Record<BasketDimension, string[]> = {
  theme: ["Électrification", "Logiciels", "Matériaux avancés", "Mobilité", "Infrastructures"],
  sector: ["Industrie", "Technologie", "Matériaux"],
};

function basketDetail(dimension: BasketDimension, name: string, period: BasketPeriod) {
  const members = Object.values(byId).filter(company => dimension === "sector" ? company.sector === name : company.themes.includes(name));
  const multiplier = period === "1d" ? 0.12 : period === "5d" ? 0.4 : period === "1m" ? 1.5 : period === "6m" ? 5 : period === "YTD" ? 4.2 : period === "5y" || period === "max" ? 18 : 8;
  const offset = basketNames[dimension].indexOf(name) * 0.37 - 0.6;
  const series = Array.from({ length: 13 }, (_, index) => ({ date: `2026-08-${String(index * 2 + 7).padStart(2, "0")}`, value: 100 + offset + multiplier * index / 12 }));
  const returnPercent = series.at(-1)!.value - 100;
  const companies = members.map((company, index) => ({ id: company.id, name: company.name, ticker: company.ticker, ownershipStatus: company.ownershipStatus,
    sector: company.sector, themes: [...company.themes], returnPercent: returnPercent + index * 0.2 }));
  return { name, returnPercent, memberCount: members.length, coveredCount: members.length,
    ownedCount: members.filter(company => company.ownershipStatus === "Owned").length, startDate: series[0].date, endDate: series.at(-1)!.date, series, companies };
}

export function getDemoCompanies(): { companies: CompanyListItem[] } {
  return { companies: Object.values(byId).map(company => structuredClone(company)) };
}

export function getDemoCompanyDetail(id: string): { company: CompanyDetail } | null {
  const company = byId[id];
  if (!company) return null;
  const documents = (detailDocs[id] ?? []).map(document => structuredClone(document));
  return { company: { ...structuredClone(company), analyses: documents.filter(document => ["business", "valuation", "risques", "synthese", "analyses"].includes(document.category)),
    earnings: documents.filter(document => document.category === "earnings"), decisions: [], portfolioDocuments: [], archives: [] } };
}

export function getDemoResearchDocument(id: string): { document: ResearchDocument } | null {
  const document = demoDocuments.find(item => item.id === id);
  if (!document) return null;
  const owner = Object.values(byId).find(company => (detailDocs[company.id] ?? []).some(item => item.id === id));
  if (!owner) return null;
  return { document: { ...structuredClone(document), companyName: owner.name } };
}

export function getDemoLivePortfolio(): LivePortfolio {
  return structuredClone(demoPortfolio);
}

export function getDemoThemeBaskets(options: { dimension: BasketDimension; period: BasketPeriod; selectedName?: string }): ThemeBasketResponse {
  const details = basketNames[options.dimension].map(name => basketDetail(options.dimension, name, options.period));
  const selectedBasket = details.find(item => item.name === options.selectedName) ?? (options.selectedName ? null : details[0] ?? null);
  return {
    generatedAt: "2026-09-01T09:00:00.000Z", dimension: options.dimension, period: options.period,
    baskets: details.map(({ name, returnPercent, memberCount, coveredCount, ownedCount, startDate, endDate, companies }) => ({ name, returnPercent, memberCount, coveredCount, ownedCount, startDate, endDate, searchText: companies.map(company => `${company.name} ${company.ticker}`).join(" ") })),
    selectedBasket, details, refreshErrors: [], refreshNeeded: false, companiesSyncedAt: null,
    refreshProgress: { nextBatch: 0, totalBatches: 0, complete: true },
  };
}

export const demoDataIds = {
  companies: Object.keys(byId),
  analyses: demoDocuments.map(document => document.id),
} as const;
