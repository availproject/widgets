import type { SupportedChainsAndTokensResult } from "@avail-project/nexus-core";

const COINBASE_SPOT_API_BASE = "https://api.coinbase.com/v2/prices";
const COINBASE_EXCHANGE_RATES_API_BASE =
  "https://api.coinbase.com/v2/exchange-rates";
const COINGECKO_SIMPLE_PRICE_API_BASE =
  "https://api.coingecko.com/api/v3/simple/price";
const COINGECKO_SEARCH_API_URL = "https://api.coingecko.com/api/v3/search";

export const DEFAULT_COINBASE_PRICE_REQUEST_TIMEOUT_MS = 4_000;
export const USD_PEGGED_FALLBACK_RATE = 1;
export const DEFAULT_USD_PEGGED_TOKEN_SYMBOLS = [
  "USDT",
  "USDC",
  "USDC.E",
  "USDT.E",
  "USDS",
  "DAI",
  "CTUSD",
  "JUSD",
  "USDM",
  "FDUSD",
  "BUSD",
  "TUSD",
  "PYUSD",
  "GUSD",
  "SVJUSD",
  "LUSD",
  "USDE",
  "USDP",
] as const;

/**
 * Wrapped / derivative token → base token pegging map.
 * When Coinbase has no direct price for a token, we resolve the price
 * of the base symbol and treat it as 1:1.
 *
 * Keys and values are UPPERCASE (normalised).
 */
export const TOKEN_PRICE_PEGS: Readonly<Record<string, string>> = {
  // --- Citrea-specific ---
  CBTC: "BTC",
  WCBTC: "BTC",
  CTUSD: "USD",
  CUSD: "USD",

  // --- Cross-chain wrapped natives ---
  WETH: "ETH",
  WBTC: "BTC",
  WMON: "MON",
  WPOL: "POL",

  // --- BTC derivatives ---
  SBTC: "BTC",
  CBBTC: "BTC",
  ENZOBTC: "BTC",
  KBTC: "BTC",
  BBTC: "BTC",
  SYBTC: "BTC",
  "WBTC.E": "BTC",

  // --- ETH derivatives ---
  STETH: "ETH",
  RETH: "ETH",
  WSTETH: "ETH",
  WBETH: "ETH",
  WEETH: "ETH",
  GTETH: "ETH",
  CBETH: "ETH",

  // --- Other wrapped natives ---
  WSOL: "SOL",
  WTRX: "TRX",
  WBNB: "BNB",
  WHYPE: "HYPE",
  WAVAX: "AVAX",

  // --- Stablecoin variants ---
  "USDC.E": "USDC",
  "USDT.E": "USDT",
  GUSD: "USD",
  JUSD: "USD",
  SVJUSD: "USD",
  USDM: "USD",
} as const;

/**
 * Custom error thrown when a token's USD price cannot be determined
 * through any resolution path (SDK rates, Coinbase API, or pegging fallback).
 */
export class TokenPricingError extends Error {
  public readonly tokenSymbol: string;

  constructor(tokenSymbol: string) {
    super(`Price failure: Cannot value this token at the moment`);
    this.name = "TokenPricingError";
    this.tokenSymbol = tokenSymbol;
  }
}

/**
 * Resolve the base symbol for a given token via the pegging map.
 * Returns `null` if no peg is defined.
 */
export function resolveBaseSymbol(tokenSymbol: string): string | null {
  const normalized = normalizeTokenSymbol(tokenSymbol);
  return TOKEN_PRICE_PEGS[normalized] ?? null;
}

type CoinbaseSpotPriceResponse = {
  data?: {
    amount?: string | number;
  };
};

type CoinbaseExchangeRatesResponse = {
  data?: {
    rates?: Record<string, string | number>;
  };
};

type CoinGeckoSimplePriceResponse = Record<
  string,
  {
    usd?: string | number;
  }
>;

type CoinGeckoSearchResponse = {
  coins?: {
    id?: string;
    market_cap_rank?: number | null;
    name?: string;
    symbol?: string;
  }[];
};

type SupportedTokenMetadata = {
  symbol?: string;
  equivalentCurrency?: string;
};

type SupportedChainMetadata = {
  tokens?: SupportedTokenMetadata[];
};

export function normalizeTokenSymbol(tokenSymbol: string): string {
  return tokenSymbol.trim().toUpperCase();
}

const USD_RATE_PEG_SYMBOLS: Record<string, string> = {
  CBTC: "BTC",
  CTUSD: "USDC",
  GUSD: "USDT",
  JUSD: "USDC",
  SVJUSD: "USDT",
  SYBTC: "BTC",
  "USDC.E": "USDC",
  "USDT.E": "USDT",
  "WBTC.E": "BTC",
  WCBTC: "BTC",
};

export function getUsdRatePegSymbol(tokenSymbol: string): string | null {
  const normalized = normalizeTokenSymbol(tokenSymbol);
  if (!normalized) return null;

  return USD_RATE_PEG_SYMBOLS[normalized] ?? null;
}

export function toFinitePositiveNumber(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function getCoinbaseSymbolCandidates(tokenSymbol: string): string[] {
  const normalized = normalizeTokenSymbol(tokenSymbol);
  if (!normalized) return [];

  const pegSymbol = getUsdRatePegSymbol(normalized);
  const baseSymbol = normalized.split(/[._-]/)[0] ?? normalized;
  const wrappedBase =
    baseSymbol.startsWith("W") && baseSymbol.length > 3
      ? baseSymbol.slice(1)
      : null;

  return Array.from(
    new Set(
      [normalized, baseSymbol, wrappedBase, pegSymbol].filter(
        (symbol): symbol is string => Boolean(symbol),
      ),
    ),
  );
}

const COINGECKO_ID_CANDIDATES_BY_SYMBOL: Record<string, string[]> = {
  AAVE: ["aave"],
  AVAX: ["avalanche-2"],
  BTC: ["bitcoin"],
  BNB: ["binancecoin"],
  DAI: ["dai"],
  ETH: ["ethereum"],
  GHO: ["gho"],
  HYPE: ["hyperliquid"],
  MATIC: ["matic-network"],
  OP: ["optimism"],
  POL: ["polygon-ecosystem-token"],
  UNI: ["uniswap"],
  USDC: ["usd-coin"],
  USDS: ["usds"],
  USDT: ["tether"],
  WETH: ["weth"],
};

function getCoinGeckoIdCandidates(tokenSymbol: string): string[] {
  const normalized = normalizeTokenSymbol(tokenSymbol);
  if (!normalized) return [];

  const pegSymbol = getUsdRatePegSymbol(normalized);
  const baseSymbol = normalized.split(/[._-]/)[0] ?? normalized;
  const wrappedBase =
    baseSymbol.startsWith("W") && baseSymbol.length > 3
      ? baseSymbol.slice(1)
      : null;

  return Array.from(
    new Set([
      ...(COINGECKO_ID_CANDIDATES_BY_SYMBOL[normalized] ?? []),
      ...(COINGECKO_ID_CANDIDATES_BY_SYMBOL[baseSymbol] ?? []),
      ...(wrappedBase
        ? COINGECKO_ID_CANDIDATES_BY_SYMBOL[wrappedBase] ?? []
        : []),
      ...(pegSymbol
        ? COINGECKO_ID_CANDIDATES_BY_SYMBOL[pegSymbol] ?? []
        : []),
    ]),
  );
}

export function buildUsdPeggedSymbolSet(
  supportedChains: SupportedChainsAndTokensResult | null,
  baseSymbols: Iterable<string> = DEFAULT_USD_PEGGED_TOKEN_SYMBOLS,
): Set<string> {
  const symbolSet = new Set(baseSymbols);

  for (const chain of (supportedChains ?? []) as SupportedChainMetadata[]) {
    for (const token of chain.tokens ?? []) {
      const symbol = normalizeTokenSymbol(token.symbol ?? "");
      const equivalent = normalizeTokenSymbol(token.equivalentCurrency ?? "");
      if (!symbol) continue;

      // Never add tokens that have an explicit peg in TOKEN_PRICE_PEGS
      // (e.g. wcBTC → BTC). The SDK's equivalentCurrency metadata can
      // incorrectly mark non-stablecoin tokens as USD-pegged.
      if (TOKEN_PRICE_PEGS[symbol]) continue;

      if (equivalent && symbolSet.has(equivalent)) {
        symbolSet.add(symbol);
      }
    }
  }

  return symbolSet;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  requestTimeoutMs: number,
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchCoinbaseUsdRate(
  tokenSymbol: string,
  requestTimeoutMs = DEFAULT_COINBASE_PRICE_REQUEST_TIMEOUT_MS,
): Promise<number | null> {
  const normalized = normalizeTokenSymbol(tokenSymbol);
  if (!normalized) return null;

  for (const candidate of getCoinbaseSymbolCandidates(normalized)) {
    const spotBody = await fetchJsonWithTimeout<CoinbaseSpotPriceResponse>(
      `${COINBASE_SPOT_API_BASE}/${encodeURIComponent(candidate)}-USD/spot`,
      requestTimeoutMs,
    );
    const spotAmount = toFinitePositiveNumber(spotBody?.data?.amount);
    if (spotAmount) return spotAmount;

    const exchangeRatesBody =
      await fetchJsonWithTimeout<CoinbaseExchangeRatesResponse>(
        `${COINBASE_EXCHANGE_RATES_API_BASE}?currency=${encodeURIComponent(candidate)}`,
        requestTimeoutMs,
      );
    const exchangeRatesAmount = toFinitePositiveNumber(
      exchangeRatesBody?.data?.rates?.USD,
    );
    if (exchangeRatesAmount) return exchangeRatesAmount;
  }

  return null;
}

async function fetchCoinGeckoUsdRateByIds(
  ids: string[],
  requestTimeoutMs: number,
): Promise<number | null> {
  if (ids.length === 0) return null;

  const body = await fetchJsonWithTimeout<CoinGeckoSimplePriceResponse>(
    `${COINGECKO_SIMPLE_PRICE_API_BASE}?ids=${encodeURIComponent(
      ids.join(","),
    )}&vs_currencies=usd`,
    requestTimeoutMs,
  );

  for (const id of ids) {
    const rate = toFinitePositiveNumber(body?.[id]?.usd);
    if (rate) return rate;
  }

  return null;
}

export async function fetchCoinGeckoUsdRate(
  tokenSymbol: string,
  requestTimeoutMs = DEFAULT_COINBASE_PRICE_REQUEST_TIMEOUT_MS,
): Promise<number | null> {
  const normalized = normalizeTokenSymbol(tokenSymbol);
  if (!normalized) return null;

  const knownIdsRate = await fetchCoinGeckoUsdRateByIds(
    getCoinGeckoIdCandidates(normalized),
    requestTimeoutMs,
  );
  if (knownIdsRate) return knownIdsRate;

  const searchBody = await fetchJsonWithTimeout<CoinGeckoSearchResponse>(
    `${COINGECKO_SEARCH_API_URL}?query=${encodeURIComponent(normalized)}`,
    requestTimeoutMs,
  );
  const exactSymbolMatches = (searchBody?.coins ?? [])
    .filter(
      (coin) => normalizeTokenSymbol(coin.symbol ?? "") === normalized && coin.id,
    )
    .sort((a, b) => {
      const aRank = a.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    });

  return fetchCoinGeckoUsdRateByIds(
    exactSymbolMatches
      .map((coin) => coin.id)
      .filter((id): id is string => Boolean(id))
      .slice(0, 5),
    requestTimeoutMs,
  );
}
