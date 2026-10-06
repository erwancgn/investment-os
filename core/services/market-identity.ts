/** Market identity rules shared by resolution, duplicate checks and quote symbols. Pure: no I/O. */
export const identityKey = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");

/** Exchange spellings models use (MIC, Google/Bloomberg codes, city) → one key, with its Yahoo suffix ("" = US, none). */
const EXCHANGES: Record<string, { aliases: string[]; yahoo: string }> = {
  "euronext paris": { aliases: ["epa", "xpar", "par", "pa", "paris", "euronext paris"], yahoo: "PA" },
  "euronext amsterdam": { aliases: ["ams", "xams", "as", "amsterdam", "euronext amsterdam"], yahoo: "AS" },
  "nasdaq": { aliases: ["nasdaq", "xnas", "nas", "nasdaq gs", "nasdaqgs", "nasdaq global select"], yahoo: "" },
  "nyse": { aliases: ["nyse", "xnys", "new york stock exchange", "n"], yahoo: "" },
  "tokyo stock exchange": { aliases: ["tse", "xtks", "tyo", "tokyo", "tokyo stock exchange"], yahoo: "T" },
  "six swiss exchange": { aliases: ["six", "xswx", "swx", "sw", "zurich", "six swiss exchange"], yahoo: "SW" },
  "london stock exchange": { aliases: ["lse", "xlon", "lon", "london", "london stock exchange"], yahoo: "L" },
  "nasdaq stockholm": { aliases: ["sto", "xsto", "st", "stockholm", "nasdaq stockholm"], yahoo: "ST" },
  "xetra": { aliases: ["xetra", "xetr", "etr", "fra", "frankfurt", "deutsche borse"], yahoo: "DE" },
};
export const exchangeKey = (value: string) => { const key = identityKey(value); return Object.keys(EXCHANGES).find(name => EXCHANGES[name].aliases.includes(key)) ?? key; };
const EXCHANGE_SUFFIXES = new Set(Object.values(EXCHANGES).map(e => e.yahoo).filter(Boolean));
/** Yahoo suffix of a known exchange ("" for US), or null when the exchange is unknown. */
export function yahooSuffix(exchange: string | null): string | null {
  if (!exchange) return null;
  const entry = EXCHANGES[exchangeKey(exchange)];
  return entry ? entry.yahoo : null;
}
const tickerKey = (value: string) => value.normalize("NFKC").trim().toLocaleUpperCase("en");
/** The trailing ".XX" of a ticker when it is a known exchange suffix (SU.PA → PA); share classes (BRK.B) are not. */
export function exchangeSuffixOf(ticker: string): string | null {
  const suffix = tickerKey(ticker).match(/\.([A-Z]{1,4})$/)?.[1];
  return suffix && EXCHANGE_SUFFIXES.has(suffix) ? suffix : null;
}
/**
 * Yahoo symbol of a listing: keep an explicit exchange suffix, otherwise derive it from the exchange.
 * Unknown exchange without suffix → null: no quote is better than another listing's price.
 */
export function quoteSymbolFor(ticker: string, exchange: string | null): string | null {
  const t = tickerKey(ticker);
  if (!/^[A-Z0-9][A-Z0-9.\-]{0,14}$/.test(t)) return null;
  if (exchangeSuffixOf(t)) return t;
  const suffix = yahooSuffix(exchange);
  if (suffix === null) return null;
  // Yahoo writes share classes with a dash on US listings (BRK.B → BRK-B).
  return suffix === "" ? t.replace(/\.(?=[A-Z]$)/, "-") : `${t}.${suffix}`;
}
