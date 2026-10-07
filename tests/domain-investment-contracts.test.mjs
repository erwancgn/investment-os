import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import * as fixtures from "./fixtures/investment-contracts.mjs";

let contracts;
async function moduleUnderTest() {
  if (contracts) return contracts;
  const entryPoint = fileURLToPath(new URL("../core/contracts/investment.ts", import.meta.url));
  const result = await build({ entryPoints: [entryPoint], bundle: true, write: false, platform: "node", format: "esm" });
  contracts = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  return contracts;
}

test("company and preview contracts are versioned, typed, and body-free", async () => {
  const api = await moduleUnderTest();
  const company = fixtures.company();
  assert.equal(api.validateCompany(company), true);
  assert.equal(api.validateCompanyResult(fixtures.serviceResult(company)), true);
  assert.equal(api.validateCompanyPreview(fixtures.companyPreview()), true);

  const withBody = fixtures.companyPreview();
  withBody.analyses[0].plainText = "Raw private analysis body";
  assert.equal(api.validateCompanyPreview(withBody), false);
  const staleVersion = fixtures.company();
  staleVersion.schemaVersion = "2.0.0";
  assert.equal(api.validateCompany(staleVersion), false);
  const extraField = fixtures.company();
  extraField.unmappedNotionField = 0;
  assert.equal(api.validateCompany(extraField), false);
  assert.equal(api.validateCompany({ ...fixtures.company(), businessScore: "0" }), false);
  assert.equal(api.validateCompany({ ...fixtures.company(), businessScore: Number.NaN }), false);
  assert.equal(api.validateCompany({ ...fixtures.company(), businessScore: 0 }), true);
});

test("portfolio preserves positions, PRU, targets, accounts, coverage and reconciliation without coercion", async () => {
  const api = await moduleUnderTest();
  const portfolio = fixtures.portfolio();
  assert.equal(api.validatePortfolio(portfolio), true);
  assert.equal(api.validatePortfolioResult(fixtures.serviceResult(portfolio)), true);
  assert.equal(portfolio.positions[0].quantity, 2);
  assert.equal(portfolio.positions[0].pruEur, 0);
  assert.equal(portfolio.positions[0].account, "PEA");
  assert.equal(portfolio.positions[0].marketValueEur, null);
  assert.equal(api.validatePosition({ ...fixtures.position(), pnlEur: -1, pnlPercent: -5 }), true);
  assert.equal(api.validatePosition({ ...fixtures.position(), quantity: 0 }), true);
  const zeroHolding = fixtures.portfolio();
  zeroHolding.positions[0].quantity = 0;
  assert.equal(api.validatePortfolio(zeroHolding), false);
  const negativeHolding = fixtures.portfolio();
  negativeHolding.positions[0].quantity = -1;
  assert.equal(api.validatePortfolio(negativeHolding), false);

  const stringNumber = fixtures.portfolio();
  stringNumber.positions[0].quantity = "2";
  assert.equal(api.validatePortfolio(stringNumber), false);
  const nonFinite = fixtures.portfolio();
  nonFinite.positions[0].costBasisEur = Infinity;
  assert.equal(api.validatePortfolio(nonFinite), false);
  const invalidDate = fixtures.portfolio();
  invalidDate.generatedAt = "2026-02-30T10:00:00Z";
  assert.equal(api.validatePortfolio(invalidDate), false);
});

test("closed positions remain addressable while closed rows cannot enter holdings", async () => {
  const api = await moduleUnderTest();
  const closed = fixtures.position("closed");
  closed.id = "closed-position-1";
  assert.equal(api.validatePositionResult(fixtures.serviceResult(closed)), true);
  assert.equal(api.validatePosition(closed), true);
  assert.equal(api.isOpenPosition(closed), false);

  const mixed = fixtures.portfolio();
  mixed.closedPositions = [closed];
  assert.equal(api.validatePortfolio(mixed), true);
  mixed.closedPositions[0].id = mixed.positions[0].id;
  assert.equal(api.validatePortfolio(mixed), false);
  mixed.closedPositions[0] = closed;
  mixed.coverage.cash = -1;
  assert.equal(api.validatePortfolio(mixed), false);
  mixed.coverage.cash = 0;
  mixed.positions = [closed];
  assert.equal(api.validatePortfolio(mixed), false);
  const noClosedId = { ...closed, id: "" };
  assert.equal(api.validatePosition(noClosedId), false);
});

test("quotes distinguish valid zero values from unknown null values and require valid provenance", async () => {
  const api = await moduleUnderTest();
  const quote = fixtures.quote();
  assert.equal(api.validateQuote(quote), true);
  assert.equal(quote.nativePrice, 12.5);
  assert.equal(quote.eurPrice, 12.5);

  const unknown = { ...quote, nativePrice: null, eurPrice: null, source: null, marketTime: null, fetchedAt: null, freshness: "unavailable" };
  assert.equal(api.validateQuote(unknown), true);
  assert.equal(unknown.nativePrice, null);
  assert.equal(unknown.eurPrice, null);
  const foreignFxMissing = { ...unknown, nativeCurrency: "USD", warnings: [] };
  assert.equal(api.validateQuote(foreignFxMissing), true);
  assert.equal(api.validateQuote({ ...foreignFxMissing, eurPrice: 12.5 }), false);
  assert.equal(api.validateQuote({ ...unknown, nativeCurrency: null }), true);
  const malformedProvenance = { ...quote, provenance: { ...fixtures.provenance, capturedAt: "2026-02-30T10:00:00Z" } };
  assert.equal(api.validateQuote(malformedProvenance), false);
  assert.equal(api.validateQuote({ ...quote, nativePrice: "0" }), false);
  assert.equal(api.validateQuote({ ...quote, freshness: "unknown" }), false);
  assert.equal(api.validateQuote({ ...quote, nativePrice: 0 }), false);
});

test("service results reject bad versions, extra envelope keys and non-finite domain values", async () => {
  const api = await moduleUnderTest();
  const valid = fixtures.serviceResult(fixtures.quote());
  assert.equal(api.validateQuoteResult(valid), true);
  assert.equal(api.validateQuoteResult({ ...valid, schemaVersion: "0.9.0" }), false);
  assert.equal(api.validateQuoteResult({ ...valid, extra: true }), false);
  assert.equal(api.validateQuoteResult({ ...valid, data: { ...valid.data, fxRate: Number.NaN } }), false);
});
