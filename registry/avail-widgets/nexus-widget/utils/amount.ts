import Decimal from "decimal.js";

// Read the amount as one number. Removing all nonnumeric characters would turn
// a legacy balance label such as "10 USDT0" into "100".
const AMOUNT_PATTERN = /^[\s$€£¥≈<>]*([+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:\s+\S+|%)?\s*$/i;

export const parseAmount = (value: unknown): Decimal | undefined => {
  if (Decimal.isDecimal(value)) return value.isFinite() ? value : undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const match = String(value).trim().match(AMOUNT_PATTERN);
  if (!match) return undefined;
  try {
    const amount = new Decimal(match[1].replace(/,/g, ""));
    return amount.isFinite() ? amount : undefined;
  } catch {
    return undefined;
  }
};

const STABLE_KEYS = new Set([
  "USDC",
  "USDT",
  "DAI",
  "EURC",
  "USDCE",
  "USDTE",
  "USDBC",
  "USDS",
  "USDE",
  "USDM",
  "CTUSD",
  "PYUSD",
  "TUSD",
  "BUSD",
  "FRAX",
  "LUSD",
  "USDD",
  "USDP",
  "GUSD",
  "EURS",
  "XDAI",
  "SUSD",
  "RLUSD",
  "USD0",
  "USDT0",
]);

export const isStablecoinSymbol = (symbol?: string): boolean => {
  if (!symbol) return false;
  const clean = symbol
    .trim()
    .toUpperCase()
    .replaceAll("₮", "T")
    .replaceAll(/[^A-Z0-9]/g, "");
  return (
    STABLE_KEYS.has(clean) ||
    clean.startsWith("USD") ||
    clean.endsWith("USD") ||
    clean.startsWith("EUR") ||
    clean.endsWith("EUR")
  );
};

export const getTokenDisplayDecimals = (
  symbol?: string,
  tokenDecimals?: number,
): number => {
  if (isStablecoinSymbol(symbol)) return 2;
  const decimals = Number(tokenDecimals);
  const fallback = Number.isFinite(decimals) && decimals >= 0 ? decimals : 6;
  return Math.min(8, fallback);
};

export const formatTokenBalance = (
  value: unknown,
  options?: { symbol?: string; decimals?: number },
): string => {
  const amount = parseAmount(value);
  if (!amount) return "0";
  const maxDecimals = getTokenDisplayDecimals(options?.symbol, options?.decimals);
  return amount.toDecimalPlaces(maxDecimals, Decimal.ROUND_DOWN).toFixed();
};

export const formatUsdAmount = (value: unknown): string => {
  const dec = parseAmount(value);
  if (!dec) return "$0.00";
  if (dec.gt(0) && dec.lt(0.01)) return "<$0.01";
  return `$${dec.toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed(2)}`;
};

