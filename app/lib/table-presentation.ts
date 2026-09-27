/**
 * Small source tables fit in the reading column; only genuinely dense tables
 * receive a horizontal-scroll affordance. Width alone is not a useful proxy
 * for density (e.g. a three-column scenario comparison is still compact).
 */
export function shouldScrollNotionTable(rows: string[][]) {
  const columns = Math.max(0, ...rows.map(row => row.length));
  const bodyRows = Math.max(0, rows.length - 1);
  return columns >= 5 || (columns >= 3 && bodyRows >= 6);
}
