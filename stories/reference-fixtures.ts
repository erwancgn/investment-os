import type {
  CompanyDetail as CompanyDetailData,
  CompanyDocument,
  CompanyListItem,
  LivePortfolio,
} from "../app/lib/investment-data";

export const reference = {
  id: "ref-business",
  kind: "business" as const,
  title: "Current Business Analysis",
  agent: "Business Analyst",
  score: "82",
  verdict: "Quality compounder",
  confidence: "High",
  status: "Current",
  date: "2026-09-18",
  lastEditedTime: "2026-09-18T10:00:00.000Z",
  notionUrl: "#",
};

export const company: CompanyListItem = {
  id: "company-example",
  name: "Advanced Micro Devices — Long Reference Name",
  ticker: "AMD",
  sector: "Technology",
  industry: "Semiconductors and accelerated computing",
  ownershipStatus: "Owned",
  watchlistMembership: true,
  monitoringStatus: "Monitoring",
  businessScore: 82,
  businessVerdict: "Quality compounder",
  researchStage: "Current",
  researchPriority: "High",
  lastAnalysis: "2026-09-18",
  themes: ["AI infrastructure", "Quality", "Data center"],
  country: "United States",
  currency: "USD",
  exchange: "NASDAQ",
  dataCompleteness: "Complete",
  notionUrl: "#",
  researchReferences: [reference],
};

export const emptyCompanies = { companies: [] };

export const document: CompanyDocument = {
  previewSummaryItems: ["Strong operating quality", "Valuation requires discipline"],
  id: "doc-business",
  title: "Current Business Analysis",
  sourceKey: "analyses",
  category: "business",
  agent: "Business Analyst",
  notionUrl: "#",
  lastEditedTime: "2026-09-18T10:00:00.000Z",
  plainText: "Reference document",
  summary: "A compact current analysis used only for the reference screen.",
  handoffSummary: "Maintain monitoring.",
  status: "Current",
  score: "82",
  verdict: "Quality compounder",
  confidence: "High",
  date: "2026-09-18",
  relations: [],
  archived: false,
  current: true,
};

export const companyDetail: CompanyDetailData = {
  ...company,
  analyses: [document],
  earnings: [],
  decisions: [],
  portfolioDocuments: [],
  archives: [],
};

// Complete, fictional company dossier for UI coverage. Kept separate from the
// public demo data and from any personal or live Notion document.
const referenceDocument = (category: CompanyDocument["category"], title: string, plainText: string, overrides: Partial<CompanyDocument> = {}): CompanyDocument => ({
  ...document,
  id: `ref-${category}`,
  title,
  category,
  agent: `${category} reference`,
  plainText,
  summary: `${title} : conclusion de référence pour la maquette.`,
  score: category === "business" ? "82" : category === "valuation" ? "58" : "",
  verdict: category === "synthese" ? "Conserver" : "À surveiller",
  ...overrides,
});

export const completeReferenceDocuments = {
  business: referenceDocument("business", "Business — référence", "## Thèse\nUne activité de qualité, sous réserve de confirmer la demande.\n## Risques\nLa concentration client peut modifier la trajectoire."),
  valuation: referenceDocument("valuation", "Valuation — référence", "## Données de référence\nCours de référence : 100 USD au 22 septembre 2026.\n## Scénarios 5 ans\n| Scénario | Prix terminal | CAGR annualisé |\n|---|---:|---:|\n| Bear | 80 USD | -4 %/an |\n| Base | 145 USD | 8 %/an |\n| Bull | 205 USD | 15 %/an |\n## Seuils de rendement · Base intacte\n| Objectif annuel | Cours conditionnel |\n|---|---:|---:|\n| 10 % | 94 USD |\n| 12 % | 86 USD |\n| 15 % | 75 USD |\n## Hypothèses\nLe rendement dépend de la thèse et du cours de référence.\n## RUN RECEIPT\ncontract_version=1; run_id=valuation-reference; status=PASS\n## Sources\n- Exemple de source de marché."),
  risques: referenceDocument("risques", "Short — référence", "## Thèse baissière\nLe scénario central peut échouer.\n## Antithèse\nLes résultats peuvent rester solides.\n## Signaux\nSurveiller les marges et le cash."),
  portfolio: referenceDocument("portfolio", "Portfolio Fit — référence", "## Contribution\nExposition fictive, aucune position personnelle.\n## Risques\nLa corrélation des actifs peut renforcer un choc commun."),
  synthese: referenceDocument("synthese", "Mémo CIO — référence", "## Decision Card\nAction | Conserver\nConfiance | Moyenne\n## Raisonnement décisif\nActivité solide, rendement à revoir.\n## État des modules\nBusiness | Validated\nValuation | Current\n## Prochaine revue\nAprès résultats.", { agent: "Investment Memo CIO", score: "", verdict: "Conserver", id: "ref-memo" }),
  earnings: referenceDocument("earnings", "Earnings — référence", "## Résultats\nLa marge progresse sur le trimestre fictif.\n## Guidance\nPrévision inchangée.\n## Analyses à actualiser\nValuation : à revoir.", { sourceKey: "earnings", score: "", id: "ref-earnings" }),
};

// UI references use only values visible in the reviewed TSMC and Advantest
// examples. They are presentation fixtures, not live market data.
export const tsmcValuationDocument = referenceDocument(
  "valuation",
  "TSMC — Valuation Check — référence UI",
  `## TL;DR
Au cours de référence de 451,89 USD du 22/09/2026, le scénario Base donne 9,91 %/an, sous l’objectif de 12 %/an.

## Cours de référence
Clôture historique : 451,89 USD au 22/09/2026. Donnée non live.

## Scénarios · horizon 5 ans
| Mesure · horizon 5 ans | Bear | Base | Bull |
|---|---:|---:|---:|
| Prix terminal estimé · USD | 409,55 | 724,69 | 973,98 |
| CAGR actionnaire · %/an | −1,95 % | 9,91 % | 16,60 % |

## Seuils du scénario Base intacte
| Rendement exigé | Prix maximal |
|---|---:|
| 10 % | 449,98 USD |
| 12 % | 411,21 USD |
| 15 % | 360,30 USD |

## Méthode
Les seuils sont conditionnels à la thèse Base et distincts du cours de référence.

## RUN RECEIPT
run_id=tsmc-reference; contract_version=1.2.5

## Sources
Clôture historique utilisée comme exemple de présentation.`,
  { id: "ref-tsmc-valuation", score: "58", verdict: "Correcte · appréciation du rapport" },
);

export const advantestValuationDocument = referenceDocument(
  "valuation",
  "Advantest — Valuation Check — référence UI",
  `## TL;DR
Au cours de référence de 33 060 JPY (clôture TSE du 24/09/2026 à 15:30 JST), la valorisation est correcte mais au-dessus du prix cible à 12 %.

## Cours de référence
33 060 JPY · clôture TSE du 24/09/2026 à 15:30 JST. Donnée historique, non live.

## Seuils du scénario Base intacte
| Rendement exigé | Prix maximal |
|---|---:|
| 10 % | 34 234 JPY |
| 12 % | 31 285 JPY |
| 15 % | 27 411 JPY |

## Lecture
Statut canonique : au-dessus du prix cible à 12 %.

## Sources
Cours de référence et seuils historiques de démonstration.`,
  { id: "ref-advantest-valuation", score: "55", verdict: "Correcte — au-dessus du prix cible 12 %" },
);

export const tsmcCompany: CompanyListItem = {
  ...company,
  id: "company-tsmc-reference",
  name: "Taiwan Semiconductor Manufacturing Company",
  ticker: "TSM",
  sector: "Technology",
  industry: "Semiconductors",
  country: "Taiwan",
  currency: "USD",
  exchange: "NYSE",
};

export const completeCompanyDetail: CompanyDetailData = {
  ...companyDetail,
  ownershipStatus: "Not owned",
  researchReferences: [
    ...(["business", "valuation", "short", "portfolio", "memo"] as const).map((kind) => ({
      ...reference,
      id: kind === "memo" ? "ref-memo" : `ref-${kind === "short" ? "risques" : kind}`,
      kind,
      title: completeReferenceDocuments[kind === "short" ? "risques" : kind === "memo" ? "synthese" : kind].title,
      score: kind === "business" ? "82" : kind === "valuation" ? "58" : "",
      verdict: kind === "memo" ? "Conserver" : "À surveiller",
    })),
  ],
  analyses: [completeReferenceDocuments.business, completeReferenceDocuments.valuation, completeReferenceDocuments.risques, completeReferenceDocuments.portfolio, completeReferenceDocuments.synthese],
  earnings: [completeReferenceDocuments.earnings],
  decisions: [],
  portfolioDocuments: [],
  archives: [{ ...completeReferenceDocuments.business, id: "ref-business-archive", archived: true, current: false, date: "2026-08-01" }],
};

export const tsmcCompanyDetail: CompanyDetailData = {
  ...completeCompanyDetail,
  ...tsmcCompany,
  researchReferences: completeCompanyDetail.researchReferences.map((item) => item.kind === "valuation"
    ? { ...item, id: tsmcValuationDocument.id, title: tsmcValuationDocument.title, score: tsmcValuationDocument.score, verdict: tsmcValuationDocument.verdict }
    : item),
  analyses: completeCompanyDetail.analyses.map((item) => item.category === "valuation" ? tsmcValuationDocument : item),
};

const slice = {
  marketValueEur: 10000,
  investedValueEur: 9300,
  cashValueEur: 700,
  costBasisEur: 9000,
  pnlEur: 300,
  pnlPercent: 3.3,
  brokerCostBasisEur: 9000,
  brokerPnlEur: 300,
  brokerPnlPercent: 3.3,
  positions: 2,
};

export const livePortfolio: LivePortfolio = {
  generatedAt: "2026-09-19T09:00:00.000Z",
  quoteAsOf: "2026-09-19T08:55:00.000Z",
  oldestQuoteAsOf: "2026-09-19T08:55:00.000Z",
  targetSource: "Notion Portfolio · Target Weight 10k + Target Weight",
  targetLines: [{ id: "target-example", name: "Example Corp", target10kWeight: 25, target10kEur: 2500, target25kWeight: 25, target25kEur: 6250 }],
  targetTotals: { target10kWeight: 25, target25kWeight: 25 },
  totals: slice,
  slices: { total: slice, CTO: slice, PEA: { ...slice, marketValueEur: 0, positions: 0 } },
  positions: [{
    id: "position-example",
    targetId: "target-example",
    name: "Example Corp — CTO",
    instrumentType: "Equity",
    account: "CTO",
    sector: "Technology",
    industry: "Software",
    themes: ["AI infrastructure"],
    primaryTheme: "AI infrastructure",
    country: "United States",
    countryExposures: [{ name: "United States", weight: 1 }],
    sectorExposures: [{ name: "Technology", weight: 1 }],
    themeExposures: [{ name: "AI infrastructure", weight: 1 }],
    quantity: 10,
    pruEur: 900,
    brokerPruEur: 900,
    pruSource: "notion-pru",
    costBasisEur: 9000,
    brokerCostBasisEur: 9000,
    marketValueEur: 9300,
    pnlEur: 300,
    pnlPercent: 3.3,
    brokerPnlEur: 300,
    brokerPnlPercent: 3.3,
    weight: 93,
    targetWeight: 25,
    targetEur: 2500,
    target10kWeight: 25,
    target10kEur: 2500,
    quoteSymbol: "EXM",
    nativePrice: 1000,
    nativeCurrency: "USD",
    eurPrice: 930,
    fxRate: 0.93,
    fxMarketTime: "2026-09-19T08:55:00.000Z",
    fetchedAt: "2026-09-19T08:55:00.000Z",
    quoteWarnings: [],
    changePercent: 1.2,
    quoteSource: "reference",
    quoteFreshness: "fresh",
    marketTime: "2026-09-19T08:55:00.000Z",
    companyIds: [company.id],
    notionUrl: "#",
    warning: null,
  }],
  sectors: [{ name: "Technology", valueEur: 9300, weight: 93 }, { name: "Cash", valueEur: 700, weight: 7 }],
  coverage: { live: 1, manual: 0, stale: 0, unavailable: 0, cash: 1, total: 2 },
  reconciliation: { status: "ok", coherent: 2, warnings: 0, errors: 0, issues: [], accountChecks: { CTO: { linesValueEur: 9300, sliceValueEur: 10000, deltaEur: 700 } } },
  calculation: { pnlScope: "unrealized-open-positions", realizedPnlAvailable: false, feesIncluded: false, dividendsIncluded: false, source: "Notion PRU + live quotes + FX" },
};

export const targetAllocationStates: LivePortfolio = {
  ...livePortfolio,
  targetLines: [
    { ...livePortfolio.targetLines[0], target25kWeight: 25, target25kEur: 6250 },
    { id: "target-building", name: "Construction", target10kWeight: 75, target10kEur: 7500, target25kWeight: 7, target25kEur: 1750 },
    { id: "target-remaining", name: "À construire", target10kWeight: 0, target10kEur: 0, target25kWeight: 68, target25kEur: 17000 },
  ],
  targetTotals: { target10kWeight: 100, target25kWeight: 100 },
  positions: [
    {
      ...livePortfolio.positions[0],
      marketValueEur: 9100,
      costBasisEur: 8800,
      brokerCostBasisEur: 8800,
      pnlEur: 300,
      pnlPercent: 3.4,
      brokerPnlEur: 300,
      brokerPnlPercent: 3.4,
      weight: 91,
      pruEur: 880,
      brokerPruEur: 880,
      eurPrice: 910,
      fxRate: 0.91,
      targetEur: 2500,
      target10kEur: 2500,
    },
    {
      ...livePortfolio.positions[0],
      id: "position-outside-target",
      targetId: "target-outside",
      name: "Position hors cible — CTO",
      quantity: 1,
      pruEur: 200,
      brokerPruEur: 200,
      costBasisEur: 200,
      brokerCostBasisEur: 200,
      marketValueEur: 200,
      pnlEur: 0,
      pnlPercent: 0,
      brokerPnlEur: 0,
      brokerPnlPercent: 0,
      weight: 2,
      targetWeight: 0,
      targetEur: 0,
      target10kWeight: 0,
      target10kEur: 0,
      quoteSymbol: "OUT",
      nativePrice: 200,
      nativeCurrency: "EUR",
      eurPrice: 200,
      fxRate: 1,
      companyIds: [],
    },
  ],
};
