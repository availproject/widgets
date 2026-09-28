// biome-ignore-all lint/suspicious/useNumberToFixedDigitsArgument: Decimal.toFixed() preserves every fractional digit; a digits argument would round balances.

import Decimal from "decimal.js";
import type { ChainBalance, TokenBalance } from "./better-intent-compat";

const BalanceDecimal = Decimal.clone({ precision: 80 });

interface BalanceFields {
  /** Spendable amount. UI token options retain this compatibility field. */
  balance?: string;
  balanceInFiat?: number | string;
  totalBalance?: string;
  totalBalanceInFiat?: number | string;
  usableBalance?: string;
}

export interface TokenOptionBalances {
  /** Always sourced from usableBalance; used for inputs, percentages and quotes. */
  balance: string;
  balanceInFiat: string;
  totalBalance: string;
  totalBalanceInFiat: string;
}

type NormalizedChainBalance = ChainBalance & {
  balanceInFiat: number;
  totalBalanceInFiat: number;
  usableBalance?: string;
  totalBalance?: string;
};

export type NormalizedUserAsset = TokenBalance & {
  balanceInFiat: number;
  totalBalanceInFiat: number;
  breakdown: NormalizedChainBalance[];
  chainBalances: NormalizedChainBalance[];
};

const nonNegative = (value: string | number | undefined) => {
  try {
    const parsed = new BalanceDecimal(value ?? 0);
    return parsed.isFinite() && parsed.gte(0) ? parsed : new BalanceDecimal(0);
  } catch {
    return new BalanceDecimal(0);
  }
};

export const getUsableBalance = (balance?: BalanceFields): string =>
  balance?.usableBalance ?? balance?.balance ?? "0";

export const getTotalBalance = (balance?: BalanceFields): string =>
  balance?.totalBalance ?? balance?.balance ?? "0";

export const getTotalBalanceInFiat = (
  balance?: BalanceFields
): number | string =>
  balance?.totalBalanceInFiat ?? balance?.balanceInFiat ?? 0;

export function toTokenOptionBalances(
  balance: BalanceFields
): TokenOptionBalances {
  return {
    balance: getUsableBalance(balance),
    balanceInFiat: `$${nonNegative(balance.balanceInFiat).toFixed()}`,
    totalBalance: getTotalBalance(balance),
    totalBalanceInFiat: `$${nonNegative(getTotalBalanceInFiat(balance)).toFixed(2)}`,
  };
}

const FORMATTED_AMOUNT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i;
const parseFormatted = (value: string | number | undefined) =>
  nonNegative(
    typeof value === "string"
      ? value.replace(/[$,\s]/g, "").match(FORMATTED_AMOUNT)?.[0]
      : value
  );

export function sumTokenOptionBalances(
  balances: BalanceFields[]
): TokenOptionBalances {
  let usable = new BalanceDecimal(0);
  let total = new BalanceDecimal(0);
  let usableUsd = new BalanceDecimal(0);
  let totalUsd = new BalanceDecimal(0);
  for (const balance of balances) {
    usable = usable.plus(parseFormatted(getUsableBalance(balance)));
    total = total.plus(parseFormatted(getTotalBalance(balance)));
    usableUsd = usableUsd.plus(parseFormatted(balance.balanceInFiat));
    totalUsd = totalUsd.plus(parseFormatted(getTotalBalanceInFiat(balance)));
  }
  return toTokenOptionBalances({
    usableBalance: usable.toFixed(),
    totalBalance: total.toFixed(),
    balanceInFiat: usableUsd.toFixed(),
    totalBalanceInFiat: totalUsd.toFixed(),
  });
}

export function isAmountAboveUsableBalance(
  balance: BalanceFields,
  amount: string,
  mode: "token" | "usd" = "token"
): boolean {
  const available =
    mode === "usd" ? balance.balanceInFiat : getUsableBalance(balance);
  return parseFormatted(amount).gt(parseFormatted(available));
}

/** SDK value is the USD value of usableBalance, including for native assets. */
export function normalizeUserAssets(
  assets: TokenBalance[] | null,
  getUsdRate: (symbol: string) => number = () => 0,
  includeSource?: (source: ChainBalance) => boolean
): NormalizedUserAsset[] | null {
  if (!assets) {
    return null;
  }
  return assets.flatMap((asset) => {
    const legacyAsset = asset as TokenBalance & { breakdown?: ChainBalance[] };
    const sources = asset.chainBalances ?? legacyAsset.breakdown ?? [];
    const included = includeSource ? sources.filter(includeSource) : sources;
    if (includeSource && included.length === 0) {
      return [];
    }

    const breakdown = included.map((source): NormalizedChainBalance => {
      const total = nonNegative(getTotalBalance(source));
      const usable = BalanceDecimal.min(
        nonNegative(getUsableBalance(source)),
        total
      );
      const value = nonNegative(source.value);
      const rate =
        usable.gt(0) && value.gt(0)
          ? value.div(usable)
          : nonNegative(getUsdRate(source.symbol ?? asset.symbol));
      const usableUsd = usable.mul(rate);
      return {
        ...source,
        balance: usable.toFixed(),
        usableBalance: usable.toFixed(),
        totalBalance: total.toFixed(),
        value: usableUsd.toFixed(),
        balanceInFiat: usableUsd.toNumber(),
        totalBalanceInFiat: total.mul(rate).toNumber(),
      };
    });

    const sums = sumTokenOptionBalances(breakdown);
    return [
      {
        ...asset,
        balance: sums.balance,
        usableBalance: sums.balance,
        totalBalance: sums.totalBalance,
        value: parseFormatted(sums.balanceInFiat).toFixed(),
        balanceInFiat: parseFormatted(sums.balanceInFiat).toNumber(),
        totalBalanceInFiat: parseFormatted(sums.totalBalanceInFiat).toNumber(),
        breakdown,
        chainBalances: breakdown,
      },
    ];
  });
}
