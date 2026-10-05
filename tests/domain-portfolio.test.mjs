import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

let portfolio;
async function moduleUnderTest() {
  if (portfolio) return portfolio;
  const entryPoint = fileURLToPath(new URL("../core/portfolio.ts", import.meta.url));
  const result = await build({ entryPoints: [entryPoint], bundle: true, write: false, platform: "node", format: "esm", metafile: true });
  const inputs = Object.keys(result.metafile.inputs);
  assert.deepEqual(inputs, ["core/portfolio.ts"], "Core portfolio calculations must stay independent of adapters and runtime");
  portfolio = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  return portfolio;
}

test("portfolio aggregation preserves cash exclusion, unrealized PnL, weights and sector exposures", async () => {
  const { calculatePortfolioAggregates } = await moduleUnderTest();
  const result = calculatePortfolioAggregates([
    { id: "stock", name: "Example", instrumentType: "Stock", account: "PEA", sector: "Tech", marketValueEur: 120, costBasisEur: 100, brokerCostBasisEur: 110, pnlEur: 20, brokerPnlEur: 10, quoteSource: "yahoo-query2", quoteFreshness: "fresh" },
    { id: "cash", name: "Cash PEA", instrumentType: "Cash", account: "PEA", sector: "Cash", marketValueEur: 30, costBasisEur: 30, brokerCostBasisEur: 30, pnlEur: 0, brokerPnlEur: 0, quoteSource: "cash", quoteFreshness: "fresh" },
    { id: "missing", name: "No quote", instrumentType: "Stock", account: "CTO", sector: "Health", marketValueEur: null, costBasisEur: 5, brokerCostBasisEur: 5, pnlEur: null, brokerPnlEur: null, quoteSource: "unavailable", quoteFreshness: "unavailable" },
  ]);

  assert.equal(result.marketValueEur, 150);
  assert.equal(result.coverage.cash, 1);
  assert.equal(result.coverage.unavailable, 1);
  assert.deepEqual(result.positions.map(position => [position.id, position.weight]), [["stock", 80], ["cash", 20], ["missing", null]]);
  assert.equal(result.slices.total.investedValueEur, 120);
  assert.equal(result.slices.total.cashValueEur, 30);
  assert.equal(result.slices.total.pnlEur, 15);
  assert.equal(result.slices.total.brokerPnlEur, 5);
  assert.deepEqual(result.sectors.map(({ name, valueEur }) => [name, valueEur]), [["Tech", 120], ["Cash", 30], ["Health", 0]]);
  assert.equal(result.slices.PEA.positions, 2);
  assert.equal(result.slices.CTO.positions, 1);
});

test("empty portfolio aggregation returns a complete zero total slice", async () => {
  const { calculatePortfolioAggregates } = await moduleUnderTest();
  const result = calculatePortfolioAggregates([]);
  assert.deepEqual(result.slices.total, {
    marketValueEur: 0, investedValueEur: 0, cashValueEur: 0, costBasisEur: 0,
    pnlEur: 0, pnlPercent: null, brokerCostBasisEur: 0, brokerPnlEur: 0,
    brokerPnlPercent: null, positions: 0,
  });
});
