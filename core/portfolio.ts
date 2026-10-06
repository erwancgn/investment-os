export type PortfolioCalculationPosition = {
  name: string;
  instrumentType: string;
  account: string;
  sector: string;
  marketValueEur: number | null;
  costBasisEur: number;
  brokerCostBasisEur: number;
  pnlEur: number | null;
  brokerPnlEur: number | null;
  quoteSource: string;
  quoteFreshness: string;
};

export type PortfolioCalculationSlice = {
  marketValueEur: number;
  investedValueEur: number;
  cashValueEur: number;
  costBasisEur: number;
  pnlEur: number;
  pnlPercent: number | null;
  brokerCostBasisEur: number;
  brokerPnlEur: number;
  brokerPnlPercent: number | null;
  positions: number;
};

const isCashPosition = (position: Pick<PortfolioCalculationPosition, "name" | "instrumentType">) =>
  position.instrumentType.toLowerCase() === "cash" || position.name.toLowerCase().startsWith("cash");

/** Aggregate already-mapped live positions without knowing their source or transport. */
export function calculatePortfolioAggregates<P extends PortfolioCalculationPosition>(preliminary: P[]) {
  const marketValueEur = preliminary.reduce((sum, position) => sum + (position.marketValueEur ?? 0), 0);
  const investedValueEur = preliminary.reduce((sum, position) => sum + (isCashPosition(position) ? 0 : (position.marketValueEur ?? 0)), 0);
  const cashValueEur = preliminary.reduce((sum, position) => sum + (isCashPosition(position) ? (position.marketValueEur ?? 0) : 0), 0);
  const costBasisEur = preliminary.reduce((sum, position) => sum + (isCashPosition(position) ? 0 : position.costBasisEur), 0);
  const brokerCostBasisEur = preliminary.reduce((sum, position) => sum + (isCashPosition(position) ? 0 : position.brokerCostBasisEur), 0);
  const positions = preliminary
    .map(position => ({ ...position, weight: marketValueEur > 0 && position.marketValueEur != null ? position.marketValueEur / marketValueEur * 100 : null }))
    .sort((a, b) => (b.marketValueEur ?? -1) - (a.marketValueEur ?? -1));
  const sectorMap = new Map<string, number>();
  const emptySlice = (): PortfolioCalculationSlice => ({ marketValueEur: 0, investedValueEur: 0, cashValueEur: 0, costBasisEur: 0, pnlEur: 0, pnlPercent: null, brokerCostBasisEur: 0, brokerPnlEur: 0, brokerPnlPercent: null, positions: 0 });
  const slices: Record<string, PortfolioCalculationSlice> = { total: emptySlice() };
  const addSlice = (key: string, position: typeof positions[number]) => {
    const slice = slices[key] ??= emptySlice();
    const value = position.marketValueEur ?? 0;
    const cash = isCashPosition(position);
    slice.marketValueEur += value;
    slice.investedValueEur += cash ? 0 : value;
    slice.cashValueEur += cash ? value : 0;
    slice.costBasisEur += cash ? 0 : position.costBasisEur;
    slice.pnlEur += cash ? 0 : (position.pnlEur ?? 0);
    slice.brokerCostBasisEur += cash ? 0 : position.brokerCostBasisEur;
    slice.brokerPnlEur += cash ? 0 : (position.brokerPnlEur ?? 0);
    slice.positions += 1;
  };
  for (const position of positions) {
    sectorMap.set(position.sector, (sectorMap.get(position.sector) ?? 0) + (position.marketValueEur ?? 0));
    addSlice("total", position);
    if (position.account) addSlice(position.account, position);
  }
  for (const slice of Object.values(slices)) {
    slice.pnlPercent = slice.costBasisEur > 0 ? slice.pnlEur / slice.costBasisEur * 100 : null;
    slice.brokerPnlPercent = slice.brokerCostBasisEur > 0 ? slice.brokerPnlEur / slice.brokerCostBasisEur * 100 : null;
  }
  slices.total = {
    ...slices.total,
    marketValueEur,
    investedValueEur,
    cashValueEur,
    costBasisEur,
    pnlEur: marketValueEur - cashValueEur - costBasisEur,
    pnlPercent: costBasisEur > 0 ? (marketValueEur - cashValueEur - costBasisEur) / costBasisEur * 100 : null,
    brokerCostBasisEur,
    brokerPnlEur: marketValueEur - cashValueEur - brokerCostBasisEur,
    brokerPnlPercent: brokerCostBasisEur > 0 ? (marketValueEur - cashValueEur - brokerCostBasisEur) / brokerCostBasisEur * 100 : null,
  };
  const sectors = [...sectorMap].map(([name, valueEur]) => ({ name, valueEur, weight: marketValueEur ? valueEur / marketValueEur * 100 : 0 })).sort((a, b) => b.valueEur - a.valueEur);
  const live = positions.filter(position => position.quoteSource.startsWith("yahoo") || position.quoteSource === "google-finance").length;
  const manual = positions.filter(position => position.quoteSource === "notion-manual").length;
  const stale = positions.filter(position => position.quoteFreshness === "stale").length;
  const unavailable = positions.filter(position => position.marketValueEur == null && !isCashPosition(position)).length;
  const cash = positions.filter(isCashPosition).length;
  return { marketValueEur, investedValueEur, cashValueEur, costBasisEur, brokerCostBasisEur, positions, sectors, slices, coverage: { live, manual, stale, unavailable, cash, total: positions.length } };
}
