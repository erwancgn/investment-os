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
  "euronext brussels": { aliases: ["ebr", "xbru", "bru", "br", "brussels", "euronext brussels"], yahoo: "BR" },
  "euronext lisbon": { aliases: ["eli", "xlis", "lis", "ls", "lisbon", "euronext lisbon"], yahoo: "LS" },
  "euronext dublin": { aliases: ["xdub", "dub", "ir", "dublin", "euronext dublin"], yahoo: "IR" },
  "borsa italiana": { aliases: ["bit", "xmil", "mil", "mi", "milan", "borsa italiana", "euronext milan"], yahoo: "MI" },
  "bolsa de madrid": { aliases: ["bme", "xmad", "mad", "mc", "madrid", "bolsa de madrid"], yahoo: "MC" },
  "nasdaq helsinki": { aliases: ["hel", "xhel", "he", "helsinki", "nasdaq helsinki"], yahoo: "HE" },
  "nasdaq copenhagen": { aliases: ["cph", "xcse", "co", "copenhagen", "nasdaq copenhagen"], yahoo: "CO" },
  "oslo bors": { aliases: ["osl", "xosl", "ol", "oslo", "oslo bors"], yahoo: "OL" },
  "wiener borse": { aliases: ["vie", "xwbo", "vi", "vienna", "wiener borse"], yahoo: "VI" },
  "gpw warsaw": { aliases: ["wse", "xwar", "war", "wa", "warsaw", "gpw"], yahoo: "WA" },
  "hong kong stock exchange": { aliases: ["hkg", "xhkg", "hkex", "hk", "hong kong", "hong kong stock exchange"], yahoo: "HK" },
  "toronto stock exchange": { aliases: ["tsx", "xtse", "tor", "to", "toronto", "toronto stock exchange"], yahoo: "TO" },
  "asx": { aliases: ["asx", "xasx", "ax", "sydney", "australian securities exchange"], yahoo: "AX" },
  "taiwan stock exchange": { aliases: ["twse", "xtai", "tw", "taipei", "taiwan stock exchange"], yahoo: "TW" },
  "korea exchange": { aliases: ["krx", "xkrx", "ks", "seoul", "korea exchange"], yahoo: "KS" },
  "singapore exchange": { aliases: ["sgx", "xses", "si", "singapore", "singapore exchange"], yahoo: "SI" },
  "nse india": { aliases: ["nse", "xnse", "ns", "nse india"], yahoo: "NS" },
  "bse india": { aliases: ["bse", "xbom", "bo", "bse india"], yahoo: "BO" },
  "tel aviv stock exchange": { aliases: ["tase", "xtae", "ta", "tel aviv"], yahoo: "TA" },
  "b3 brazil": { aliases: ["b3", "bvmf", "sa", "sao paulo", "bovespa"], yahoo: "SA" },
  "bolsa mexicana": { aliases: ["bmv", "xmex", "mx", "mexico"], yahoo: "MX" },
  "johannesburg stock exchange": { aliases: ["jse", "xjse", "jo", "johannesburg"], yahoo: "JO" },
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
