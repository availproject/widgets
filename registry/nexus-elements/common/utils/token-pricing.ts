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
  "USDS",
  "DAI",
  "USDM",
  "FDUSD",
  "BUSD",
  "TUSD",
  "PYUSD",
  "GUSD",
  "LUSD",
  "USDE",
  "USDP",
] as const;

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

  const baseSymbol = normalized.split(/[._-]/)[0] ?? normalized;
  const wrappedBase =
    baseSymbol.startsWith("W") && baseSymbol.length > 3
      ? baseSymbol.slice(1)
      : null;

  return Array.from(
    new Set(
      [normalized, baseSymbol, wrappedBase].filter(
        (symbol): symbol is string => Boolean(symbol),
      ),
    ),
  );
}

const COINGECKO_ID_CANDIDATES_BY_SYMBOL: Record<string, string[]> = {
  AAVE: ["aave"],
  AVAX: ["avalanche-2"],
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
