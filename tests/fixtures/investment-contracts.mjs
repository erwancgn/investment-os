export const schemaVersion = "1.0.0";

export const provenance = {
  kind: "notion",
  sourceId: "notion-page-1",
  revision: "2026-09-01T10:00:00.000Z",
  capturedAt: "2026-09-01T10:01:00.000Z",
};

export function company() {
  return {
    schemaVersion,
    id: "company-1",
    name: "Example Corp",
    ticker: "EXM",
    sector: "Technology",
    industry: "Semiconductors",
    ownershipStatus: "Owned",
    watchlistMembership: false,
    monitoringStatus: "",
    businessScore: 0,
    businessVerdict: "",
    researchStage: "",
    researchPriority: "",
    lastAnalysis: null,
    themes: ["AI"],
    country: "United States",
    currency: "USD",
    exchange: "NASDAQ",
    dataCompleteness: "Complete",
    notionUrl: "https://www.notion.so/example",
    researchReferences: [],
    provenance: structuredClone(provenance),
  };
}

export function analysisHeader() {
  return {
    schemaVersion,
    id: "analysis-1",
    title: "Example Business Analysis",
    sourceUrl: "https://www.notion.so/analysis",
    family: "business",
    originalFamily: null,
    sourceKind: "analysis",
    agent: "Business Analyst",
    status: "Validated",
    date: "2026-09-01",
    lastEditedTime: "2026-09-01T10:00:00.000Z",
    companyIds: ["company-1"],
    revision: "2026-09-01T10:00:00.000Z",
    sourceFreshness: "fresh",
    archived: false,
    provenance: structuredClone(provenance),
  };
}

export function companyPreview() {
  return {
    ...company(),
    analyses: [{ ...analysisHeader(), summary: "Summary", handoffSummary: null, previewSummaryItems: ["Visible preview summary"], score: "0", verdict: null, confidence: null, projectionStatus: "absent", diagnostics: [] }],
    earnings: [],
    decisions: [],
    portfolioDocuments: [],
    archives: [],
  };
}

export function position(lifecycle = "open") {
  return {
    schemaVersion,
    lifecycle,
    id: "position-1",
    targetId: "target-1",
    name: "Example Corp",
    instrumentType: "Stock",
    account: "PEA",
    sector: "Technology",
    industry: "Semiconductors",
    themes: ["AI"],
    primaryTheme: "AI",
    country: "United States",
    countryExposures: [],
    sectorExposures: [],
    themeExposures: [],
    quantity: 2,
    pruEur: 0,
    brokerPruEur: null,
    pruSource: "notion-pru",
    costBasisEur: 0,
    brokerCostBasisEur: 0,
    marketValueEur: null,
    pnlEur: null,
    pnlPercent: null,
    brokerPnlEur: null,
    brokerPnlPercent: null,
    weight: null,
    targetWeight: 0,
    targetEur: 0,
    target10kWeight: 0,
    target10kEur: 0,
    quoteSymbol: null,
    nativePrice: null,
    nativeCurrency: "EUR",
    eurPrice: null,
    fxRate: null,
    fxMarketTime: null,
    fetchedAt: null,
    quoteWarnings: ["Cours indisponible"],
    changePercent: null,
    quoteSource: "unavailable",
    quoteFreshness: "unavailable",
    marketTime: null,
    companyIds: ["company-1"],
    notionUrl: "https://www.notion.so/position",
    warning: "Cours indisponible",
    provenance: structuredClone(provenance),
    ...(lifecycle === "closed" ? { closedAt: "2026-08-31" } : {}),
  };
}

export function portfolio() {
  const slice = {
    marketValueEur: 0,
    investedValueEur: 0,
    cashValueEur: 0,
    costBasisEur: 0,
    pnlEur: 0,
    pnlPercent: null,
    brokerCostBasisEur: 0,
    brokerPnlEur: 0,
    brokerPnlPercent: null,
    positions: 1,
  };
  return {
    schemaVersion,
    generatedAt: "2026-09-01T10:00:00.000Z",
    quoteAsOf: null,
    oldestQuoteAsOf: null,
    targetSource: "Notion Portfolio · Target Weight 10k + Target Weight",
    targetLines: [],
    targetTotals: { target10kWeight: 0, target25kWeight: 0 },
    totals: structuredClone(slice),
    slices: { total: structuredClone(slice) },
    positions: [position()],
    sectors: [{ name: "Technology", valueEur: 0, weight: 0 }],
    coverage: { live: 0, manual: 0, stale: 0, unavailable: 1, cash: 0, total: 1 },
    reconciliation: {
      status: "error",
      coherent: 0,
      warnings: 0,
      errors: 1,
      issues: [{ positionId: "position-1", positionName: "Example Corp", severity: "error", code: "price_unavailable", message: "Cours EUR indisponible." }],
      accountChecks: { total: { linesValueEur: 0, sliceValueEur: 0, deltaEur: 0 } },
    },
    calculation: { pnlScope: "unrealized-open-positions", realizedPnlAvailable: false, feesIncluded: false, dividendsIncluded: false, source: "Notion PRU + live quotes + FX" },
    provenance: structuredClone(provenance),
  };
}

export function quote() {
  return {
    schemaVersion,
    assetId: "asset-1",
    name: "Example Corp",
    nativePrice: 12.5,
    nativeCurrency: "EUR",
    eurPrice: 12.5,
    fxRate: null,
    fxMarketTime: null,
    previousClose: 12,
    changePercent: 4.1667,
    marketTime: "2026-09-01T10:00:00.000Z",
    fetchedAt: "2026-09-01T10:01:00.000Z",
    source: "yahoo-finance",
    freshness: "fresh",
    isFallback: false,
    warnings: [],
    provenance: structuredClone(provenance),
  };
}

export function serviceResult(data) {
  return {
    schemaVersion,
    status: "ok",
    data,
    metadata: { revision: "r1", freshness: "fresh", provenance: structuredClone(provenance), diagnostics: [] },
  };
}
