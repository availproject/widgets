import { SUPPORTED_CHAINS } from "@avail-project/nexus-core";
import { formatUnits, parseUnits } from "viem";

export const SHORT_CHAIN_NAME: Record<number, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: "Ethereum",
  [SUPPORTED_CHAINS.BASE]: "Base",
  [SUPPORTED_CHAINS.ARBITRUM]: "Arbitrum",
  [SUPPORTED_CHAINS.OPTIMISM]: "Optimism",
  [SUPPORTED_CHAINS.POLYGON]: "Polygon",
  [SUPPORTED_CHAINS.AVALANCHE]: "Avalanche",
  [SUPPORTED_CHAINS.SCROLL]: "Scroll",
  [SUPPORTED_CHAINS.MEGAETH]: "MegaETH",
  [SUPPORTED_CHAINS.KAIA]: "Kaia",
  [SUPPORTED_CHAINS.BNB]: "BNB",
  [SUPPORTED_CHAINS.MONAD]: "Monad",
  [SUPPORTED_CHAINS.HYPEREVM]: "HyperEVM",
  [SUPPORTED_CHAINS.CITREA]: "Citrea",
  // [SUPPORTED_CHAINS.TRON]: "Tron",
  [SUPPORTED_CHAINS.SEPOLIA]: "Sepolia",
  [SUPPORTED_CHAINS.BASE_SEPOLIA]: "Base Sepolia",
  [SUPPORTED_CHAINS.ARBITRUM_SEPOLIA]: "Arbitrum Sepolia",
  [SUPPORTED_CHAINS.OPTIMISM_SEPOLIA]: "Optimism Sepolia",
  [SUPPORTED_CHAINS.POLYGON_AMOY]: "Polygon Amoy",
  [SUPPORTED_CHAINS.MONAD_TESTNET]: "Monad Testnet",
  // [SUPPORTED_CHAINS.TRON_SHASTA]: "Tron Shasta",
} as const;

export const getShortChainName = (
  chainId?: number | null,
  fallback?: string | null,
) => {
  if (typeof chainId === "number" && SHORT_CHAIN_NAME[chainId]) {
    return SHORT_CHAIN_NAME[chainId];
  }

  return fallback ?? "";
};

const DEFAULT_SAFETY_MARGIN = 0.01; // 1%

/**
 * Compute an amount string for fraction buttons (25%, 50%, 75%, 100%).
 *
 * @param balanceStr - user's balance as a human decimal string (e.g. "12.345") OR as base-unit integer string if `balanceIsBaseUnits` true
 * @param fraction - fraction e.g. 0.25, 0.5, 0.75, 1
 * @param decimals - token decimals (6 for USDC/USDT, 18 for ETH)
 * @param safetyMargin - 0.01 for 1% default
 * @param balanceIsBaseUnits - if true, balanceStr is already base units integer string (wei / smallest unit)
 * @returns decimal string clipped to token decimals (rounded down)
 */
export function computeAmountFromFraction(
  balanceStr: string,
  fraction: number,
  decimals: number,
  safetyMargin = DEFAULT_SAFETY_MARGIN,
  balanceIsBaseUnits = false,
): string {
  if (!balanceStr) return "0";

  // parse balance into base units (BigInt)
  const balanceUnits: bigint = balanceIsBaseUnits
    ? BigInt(balanceStr)
    : parseUnits(balanceStr, decimals);

  if (balanceUnits === BigInt(0)) return "0";

  // Use an integer precision multiplier to avoid FP issues
  const PREC = 1_000_000; // 1e6 precision for fraction & safety margin
  const safetyMul = BigInt(Math.max(0, Math.floor((1 - safetyMargin) * PREC))); // (1 - safetyMargin) * PREC
  const fractionMul = BigInt(Math.max(0, Math.floor(fraction * PREC))); // fraction * PREC

  // Apply safety margin: floor(balance * (1 - safetyMargin))
  const maxAfterSafety = (balanceUnits * safetyMul) / BigInt(PREC);

  // Apply fraction and floor: floor(maxAfterSafety * fraction)
  let desiredUnits = (maxAfterSafety * fractionMul) / BigInt(PREC);

  // Extra clamp just in case
  if (desiredUnits > balanceUnits) desiredUnits = balanceUnits;
  if (desiredUnits < BigInt(0)) desiredUnits = BigInt(0);

  // format back to human readable decimal string with token decimals (formatUnits truncates/keeps decimals)
  // formatUnits will produce exactly decimals digits if fractional part exists; we'll strip trailing zeros.
  const raw = formatUnits(desiredUnits, decimals);
  // strip trailing zeros and possible trailing dot
  return raw
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "")
    .replace(/^\.$/u, "0");
}

export const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFormatterPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/**
 * Formats USD values for UI.
 * Values between 0 and 0.001 are shown as "< $0.001".
 * Values between 0.001 and 0.01 are shown with 3 decimals.
 */
export function formatUsdForDisplay(value: number): string {
  if (!Number.isFinite(value)) return usdFormatter.format(0);
  const absValue = Math.abs(value);

  if (absValue === 0) return usdFormatter.format(0);
  if (absValue < 0.001) return "< $0.001";
  if (absValue < 0.01) {
    return usdFormatterPrecise.format(value);
  }

  return usdFormatter.format(value);
}
