/**
 * Small source tables fit in the reading column; only genuinely dense tables
 * receive a horizontal-scroll affordance. Width alone is not a useful proxy
 * for density (e.g. a three-column scenario comparison is still compact).
 */
export function shouldScrollNotionTable(rows: string[][]) {
  const normalized = rows.map(row => row.map(cell => cell.trim()).filter(Boolean));
  const columns = Math.max(0, ...normalized.map(row => row.length));
  const bodyRows = Math.max(0, normalized.length - 1);
  const header = normalized[0]?.join(" ") ?? "";
  const content = normalized.flat().join(" ");
  const hasScenarioSet = /\bBear\b/i.test(header) && /\bBase\b/i.test(header) && /\bBull\b/i.test(header)
    && /prix terminal|terminal price|cagr|rendement annualis/i.test(content);
  const thresholdHeader = /objectif|hurdle|rendement|exig[eé]|required/i.test(header) && /cours|prix|maximal/i.test(header);
  const thresholdRates = normalized.slice(1).map(row => row[0] ?? "");
  const hasThresholdSet = thresholdHeader && [10, 12, 15].every(rate => thresholdRates.some(value => new RegExp(`^${rate}\\s*%$`).test(value)));
  if (hasScenarioSet || hasThresholdSet) return false;
  return columns >= 5 || (columns >= 3 && bodyRows >= 6);
}
