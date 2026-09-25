import test from "node:test";
import assert from "node:assert/strict";
import {
  demoDataIds,
  getDemoCompanies,
  getDemoCompanyDetail,
  getDemoLivePortfolio,
  getDemoResearchDocument,
  getDemoThemeBaskets,
} from "../app/lib/demo-data.ts";

test("demo company and research endpoints resolve only fictional demo ids", () => {
  const { companies } = getDemoCompanies();
  assert.equal(companies.length, 3);
  assert.deepEqual(companies.map(company => company.id), demoDataIds.companies);
  for (const company of companies) {
    assert.match(company.id, /^demo-/);
    assert.equal(company.notionUrl, "#");
    for (const reference of company.researchReferences) {
      assert.match(reference.id, /^demo-/);
      assert.ok(getDemoResearchDocument(reference.id)?.document, `reference ${reference.id} must resolve`);
    }
    const detail = getDemoCompanyDetail(company.id)?.company;
    assert.ok(detail);
    assert.ok(detail.analyses.every(document => document.id.startsWith("demo-")));
  }
  assert.equal(getDemoCompanyDetail("private-page-id"), null);

  for (const id of demoDataIds.analyses) {
    const result = getDemoResearchDocument(id);
    assert.ok(result?.document);
    assert.match(result.document.id, /^demo-/);
    assert.equal(result.document.notionUrl, "#");
    assert.match(result.document.plainText, /fictif|fictive|pédagogique/i);
  }
  assert.equal(getDemoResearchDocument("private-page-id"), null);
});

test("LumaGrid demo has a linked, chronological five-part educational case", () => {
  const { company } = getDemoCompanyDetail("demo-lumagrid");
  const references = company.researchReferences;
  assert.deepEqual(references.map(reference => reference.kind), ["business", "valuation", "short", "portfolio", "memo"]);
  const documents = references.map(reference => getDemoResearchDocument(reference.id)?.document);
  assert.ok(documents.every(Boolean));
  assert.deepEqual(documents.map(document => document.date), ["2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"]);
  assert.ok(documents.every(document => document.plainText.length > 900), "each reader page should contain substantive educational content");
  assert.match(documents[1].plainText, /Scénarios, horizon 2031[\s\S]*Prudent[\s\S]*Central[\s\S]*Favorable/);
  assert.match(documents[3].plainText, /43 %[\s\S]*concentration/i);
  assert.ok(documents.every(document => /fictif|fictive|pédagogique/i.test(document.plainText)));
  assert.ok(documents.every(document => !/plugin canonique/i.test(document.plainText) || /n’est pas|ne suit pas|n'a pas/i.test(document.plainText)));
});

test("demo portfolio relationships reconcile with demo companies and carry no live quotes", () => {
  const portfolio = getDemoLivePortfolio();
  const companyIds = new Set(getDemoCompanies().companies.map(company => company.id));
  assert.equal(portfolio.targetTotals.target10kWeight, 100);
  assert.equal(portfolio.targetTotals.target25kWeight, 100);
  assert.ok(portfolio.positions.every(position => position.companyIds.every(id => companyIds.has(id))));
  assert.ok(portfolio.positions.filter(position => position.instrumentType !== "Cash").every(position => position.quoteSymbol === null && position.fetchedAt === null));
  assert.equal(portfolio.positions.find(position => position.instrumentType === "Cash")?.marketValueEur, portfolio.totals.cashValueEur);
  assert.ok(portfolio.positions.every(position => position.notionUrl === "#"));

  portfolio.positions.length = 0;
  assert.equal(getDemoLivePortfolio().positions.length, 3, "returned fixture must not mutate the canonical demo data");
});

test("demo basket data follows requested dimension, period, and selection", () => {
  const theme = getDemoThemeBaskets({ dimension: "theme", period: "1y", selectedName: "Logiciels" });
  assert.equal(theme.dimension, "theme");
  assert.equal(theme.period, "1y");
  assert.equal(theme.selectedBasket?.name, "Logiciels");
  assert.equal(theme.refreshProgress?.complete, true);
  assert.ok(theme.details.flatMap(detail => detail.companies).every(company => company.id.startsWith("demo-")));

  const sector = getDemoThemeBaskets({ dimension: "sector", period: "5d" });
  assert.equal(sector.dimension, "sector");
  assert.equal(sector.period, "5d");
  assert.equal(sector.selectedBasket?.name, sector.details[0]?.name);
  assert.equal(getDemoThemeBaskets({ dimension: "theme", period: "1m", selectedName: "unknown" }).selectedBasket, null);
});

test("public demo fixtures contain no personal Notion URLs", () => {
  const serialized = JSON.stringify({ companies: getDemoCompanies(), portfolio: getDemoLivePortfolio(), baskets: getDemoThemeBaskets({ dimension: "theme", period: "1y" }), document: getDemoResearchDocument(demoDataIds.analyses[0]) });
  assert.doesNotMatch(serialized, /https?:\/\/(?:www\.)?notion\.(?:so|site)\//i);
  assert.doesNotMatch(serialized, /oai-authenticated-user-email|OWNER_EMAIL|NOTION_TOKEN/i);
});
