import type { RenderBlock } from "./notion-renderer";

type Scenario = { name: "Bear" | "Base" | "Bull"; terminal: string; cagr: string };
type Threshold = { rate: string; price: string };
type Summary = { scenarios: Scenario[]; horizon: string | null; thresholds: Threshold[] };
const names = ["Bear", "Base", "Bull"] as const;
const currencyPattern = /\b(?:USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD)\b/i;

function scenarioName(value: string): Scenario["name"] | null {
  const normalized = value.trim().toLowerCase();
  if (/^(?:bear|baissier|prudent)$/.test(normalized)) return "Bear";
  if (/^(?:base|central)$/.test(normalized)) return "Base";
  if (/^(?:bull|haussier|favorable)$/.test(normalized)) return "Bull";
  return null;
}

function normalizeScenario(name: Scenario["name"], terminal: string, cagr: string, currency?: string): Scenario | null {
  const unit = terminal.match(currencyPattern)?.[0].toUpperCase() ?? currency;
  if (!unit || !/\d/.test(terminal) || !/[-−]?\s*\d/.test(cagr) || !cagr.includes("%")) return null;
  return {
    name,
    terminal: terminal.match(currencyPattern) ? terminal.trim() : `${terminal.trim()} ${unit}`,
    cagr: cagr.replace(/\s*\/?an\b/i, "").trim(),
  };
}

function fromTable(block: Extract<RenderBlock, { type: "table" }>): Scenario[] | null {
  if (!block.header || block.rows.length < 3) return null;
  const [header, ...rows] = block.rows;
  const columns = names.map(name => header.findIndex(cell => scenarioName(cell) === name));
  if (columns.every(index => index > 0)) {
    const terminal = rows.find(row => /prix terminal|terminal price/i.test(row[0] ?? ""));
    const cagr = rows.find(row => /cagr|rendement annualis/i.test(row[0] ?? ""));
    if (!terminal || !cagr) return null;
    const currency = terminal[0]?.match(currencyPattern)?.[0].toUpperCase();
    const result = names.map((name, index) => normalizeScenario(name, terminal[columns[index]] ?? "", cagr[columns[index]] ?? "", currency));
    return result.every(Boolean) ? result as Scenario[] : null;
  }
  const nameIndex = header.findIndex(cell => /scénario|scenario/i.test(cell));
  const terminalIndex = header.findIndex(cell => /prix terminal|terminal price/i.test(cell));
  const cagrIndex = header.findIndex(cell => /cagr|rendement annualis/i.test(cell));
  if (nameIndex < 0 || terminalIndex < 0 || cagrIndex < 0) return null;
  const currency = header[terminalIndex].match(currencyPattern)?.[0].toUpperCase();
  const result = names.map(name => {
    const row = rows.find(candidate => scenarioName(candidate[nameIndex] ?? "") === name);
    return row ? normalizeScenario(name, row[terminalIndex] ?? "", row[cagrIndex] ?? "", currency) : null;
  });
  return result.every(Boolean) ? result as Scenario[] : null;
}

function thresholdsFromBlocks(blocks: RenderBlock[]): Threshold[] {
  const heading = blocks.findIndex(block => block.type === "heading" && /seuil|hurdle/i.test(block.text) && /base/i.test(block.text));
  if (heading < 0) return [];
  const next = blocks.slice(heading + 1).findIndex(block => block.type === "heading");
  const range = blocks.slice(heading + 1, next < 0 ? undefined : heading + 1 + next);
  if (!/base intacte/i.test((blocks[heading] as Extract<RenderBlock, { type: "heading" }>).text) && !range.some(block => block.type === "paragraph" && /base intacte/i.test(block.text))) return [];
  const table = range.find(block => block.type === "table" && block.header && /objectif|hurdle|rendement/i.test(block.rows[0]?.join(" ") ?? "") && /cours|prix/i.test(block.rows[0]?.join(" ") ?? ""));
  if (table?.type === "table") {
    const [header, ...rows] = table.rows;
    const rateIndex = header.findIndex(cell => /objectif|hurdle|rendement/i.test(cell));
    const priceIndex = header.findIndex(cell => /cours|prix/i.test(cell));
    const values = [10, 12, 15].map(rate => {
      const row = rows.find(candidate => new RegExp(`^\\s*${rate}\\s*%\\s*$`).test(candidate[rateIndex] ?? ""));
      const price = row?.[priceIndex]?.trim() ?? "";
      return /\d/.test(price) && currencyPattern.test(price) ? { rate: `${rate} %`, price } : null;
    });
    if (values.every(Boolean)) return values as Threshold[];
  }
  const text = range.flatMap(block => block.type === "paragraph" ? [block.text] : block.type === "list" ? block.items : []).join(" ; ");
  const thresholds = [10, 12, 15].map(rate => {
    const match = text.match(new RegExp(`(?:hurdle\\s*)?${rate}\\s*%\\s*[:：]\\s*(\\d{1,4}(?:[ .]\\d{3})*(?:[,.]\\d+)?)\\s*(USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD)`, "i"));
    return match ? { rate: `${rate} %`, price: `${match[1]} ${match[2].toUpperCase()}` } : null;
  });
  return thresholds.every(Boolean) ? thresholds as Threshold[] : [];
}

/** Only promote explicit, complete prices and annualized returns from the report. */
export function extractValuationSummary(blocks: RenderBlock[]): Summary | null {
  for (const [index, block] of blocks.entries()) {
    if (block.type !== "table") continue;
    const scenarios = fromTable(block);
    if (!scenarios) continue;
    const context = blocks.slice(Math.max(0, index - 2), index + 1).map(item => item.type === "heading" ? item.text : "").join(" ");
    const horizon = /\b5\s*ans\b/i.test(context) || /\b5\s*ans\b/i.test(block.rows[0]?.join(" ") ?? "") ? "5 ans" : null;
    return { scenarios, horizon, thresholds: thresholdsFromBlocks(blocks) };
  }
  return null;
}
