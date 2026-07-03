// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import { type Hex, padHex } from "viem";
import { CHAIN_METADATA } from "../../common";
import type { UserAsset } from "../../nexus/NexusProvider";

export type DepositSourceFilter = "all" | "stablecoins" | "native" | "custom";

type DepositSourceDestination = {
  chainId: number;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
};

const STABLECOIN_SYMBOLS = ["USDC", "USDT", "DAI", "TUSD", "USDP"] as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EVM_NATIVE_PLACEHOLDER = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const MAX_PRIORITY_RANK = Number.MAX_SAFE_INTEGER;

const sortSourcesByPriority = (
  swapBalance: UserAsset[],
  _destination: DepositSourceDestination,
) =>
  swapBalance
    .flatMap((asset) => asset.breakdown ?? [])
    .sort(
      (a, b) =>
        parseNonNegativeNumber(b.balanceInFiat) -
        parseNonNegativeNumber(a.balanceInFiat),
    )
    .map((breakdown) => ({
      chainID: breakdown.chain.id,
      tokenAddress: breakdown.contractAddress,
    }));

const parseNonNegativeNumber = (value: unknown): number => {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const normalizeAddress = (address: string): string => address.toLowerCase();

const toComparableSdkAddress = (address: string): string => {
  const normalized = normalizeAddress(address);
  const effectiveAddress =
    normalized === ZERO_ADDRESS ? EVM_NATIVE_PLACEHOLDER : normalized;

  try {
    return padHex(effectiveAddress as Hex, { size: 32 }).toLowerCase();
  } catch {
    return effectiveAddress;
  }
};

export const getDepositSourceId = (
  tokenAddress: string,
  chainId: number,
): string => `${tokenAddress}-${chainId}`;

export const parseDepositSourceId = (
  sourceId: string,
): { tokenAddress: Hex; chainId: number } | null => {
  const separatorIndex = sourceId.lastIndexOf("-");
  if (separatorIndex <= 0) return null;

  const tokenAddress = sourceId.slice(0, separatorIndex) as Hex;
  const chainId = Number.parseInt(sourceId.slice(separatorIndex + 1), 10);
  if (!Number.isInteger(chainId) || chainId <= 0) return null;

  return { tokenAddress, chainId };
};

const isStablecoin = (symbol?: string): boolean =>
  STABLECOIN_SYMBOLS.includes(
    (symbol ?? "").toUpperCase() as (typeof STABLECOIN_SYMBOLS)[number],
  );

const isNative = (symbol?: string): boolean => {
  const normalized = (symbol ?? "").toUpperCase();
  if (!normalized) return false;
  return Object.values(CHAIN_METADATA).some(
    (chain) => chain.nativeCurrency.symbol.toUpperCase() === normalized,
  );
};

const getFiatLookupKey = (tokenAddress: string, chainId: number): string =>
  `${normalizeAddress(tokenAddress)}-${chainId}`;

const getPriorityLookupKey = (tokenAddress: string, chainId: number): string =>
  `${toComparableSdkAddress(tokenAddress)}-${chainId}`;

const buildSourceFiatByKeyMap = (
  swapBalance: UserAsset[] | null,
): Map<string, number> => {
  const map = new Map<string, number>();
  if (!swapBalance) return map;

  for (const asset of swapBalance) {
    for (const breakdown of asset.breakdown ?? []) {
      const chainId = breakdown.chain?.id;
      const tokenAddress = breakdown.contractAddress;
      if (!chainId || !tokenAddress) continue;

      map.set(
        getFiatLookupKey(tokenAddress, chainId),
        parseNonNegativeNumber(breakdown.balanceInFiat),
      );
    }
  }

  return map;
};

const buildPriorityRankMap = (
  swapBalance: UserAsset[] | null,
  destination: DepositSourceDestination,
): Map<string, number> => {
  const map = new Map<string, number>();
  if (!swapBalance?.length) return map;

  const sortedSources = sortSourcesByPriority(swapBalance, destination);

  sortedSources.forEach((source, index) => {
    map.set(getPriorityLookupKey(source.tokenAddress, source.chainID), index);
  });

  return map;
};

const buildSortedSourceCandidates = (params: {
  sourceIds: Iterable<string>;
  swapBalance: UserAsset[] | null;
  destination: DepositSourceDestination;
  minimumBalanceUsd?: number;
}) => {
  const { sourceIds, swapBalance, destination, minimumBalanceUsd } = params;
  const uniqueIds = [...new Set(sourceIds)];
  if (uniqueIds.length === 0) return [];

  const sourceFiatByKeyMap = buildSourceFiatByKeyMap(swapBalance);
  const priorityRankMap = buildPriorityRankMap(swapBalance, destination);

  return uniqueIds
    .map((sourceId) => {
      const parsed = parseDepositSourceId(sourceId);
      if (!parsed) return null;

      const fiatKey = getFiatLookupKey(parsed.tokenAddress, parsed.chainId);
      const priorityKey = getPriorityLookupKey(
        parsed.tokenAddress,
        parsed.chainId,
      );

      return {
        sourceId,
        balanceInFiat: sourceFiatByKeyMap.get(fiatKey) ?? 0,
        priorityRank: priorityRankMap.get(priorityKey) ?? MAX_PRIORITY_RANK,
      };
    })
    .filter((item): item is NonNullable<typeof item> => {
      if (!item) return false;
      if (minimumBalanceUsd == null) return true;
      return item.balanceInFiat >= minimumBalanceUsd;
    })
    .sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) {
        return a.priorityRank - b.priorityRank;
      }
      if (a.balanceInFiat !== b.balanceInFiat) {
        return b.balanceInFiat - a.balanceInFiat;
      }
      return a.sourceId.localeCompare(b.sourceId);
    });
};

const sortSourceIdsByPriority = (params: {
  sourceIds: Iterable<string>;
  swapBalance: UserAsset[] | null;
  destination: DepositSourceDestination;
  minimumBalanceUsd?: number;
}): string[] =>
  buildSortedSourceCandidates(params).map((item) => item.sourceId);

export const buildDepositSourcePoolIds = (params: {
  swapBalance: UserAsset[] | null;
  filter: DepositSourceFilter;
  selectedSourceIds: Iterable<string>;
  isManualSelection: boolean;
}): string[] => {
  const { swapBalance, filter, selectedSourceIds, isManualSelection } = params;
  const selectedSourceIdSet = new Set(selectedSourceIds);

  if (isManualSelection) {
    return [...selectedSourceIdSet];
  }

  const sourceIds = new Set<string>();

  swapBalance?.forEach((asset) => {
    asset.breakdown?.forEach((breakdown) => {
      const chainId = breakdown.chain?.id;
      const tokenAddress = breakdown.contractAddress;
      if (!chainId || !tokenAddress) return;

      const stable = isStablecoin(breakdown.symbol ?? asset.symbol);
      const native = isNative(breakdown.symbol ?? asset.symbol);
      const sourceId = getDepositSourceId(tokenAddress, chainId);
      const include =
        filter === "all" ||
        (filter === "stablecoins" && stable) ||
        (filter === "native" && native) ||
        (filter === "custom" && selectedSourceIdSet.has(sourceId));

      if (include) sourceIds.add(sourceId);
    });
  });

  return [...sourceIds];
};

export const buildPrioritySelectedSourceIds = (params: {
  swapBalance: UserAsset[] | null;
  destination: DepositSourceDestination;
  minimumBalanceUsd: number;
  targetAmountUsd?: number;
  sourceIds?: Iterable<string>;
}): string[] => {
  const {
    swapBalance,
    destination,
    minimumBalanceUsd,
    targetAmountUsd,
    sourceIds,
  } = params;

  const requestedSourceIds = sourceIds ? [...new Set(sourceIds)] : undefined;
  const orderedCandidateSourceIds = requestedSourceIds
    ? sortSourceIdsByPriority({
        sourceIds: requestedSourceIds,
        swapBalance,
        destination,
        minimumBalanceUsd,
      })
    : sortSourceIdsByPriority({
        sourceIds: buildDepositSourcePoolIds({
          swapBalance,
          filter: "all",
          selectedSourceIds: [],
          isManualSelection: false,
        }),
        swapBalance,
        destination,
        minimumBalanceUsd,
      });

  if (orderedCandidateSourceIds.length === 0) return [];

  const normalizedTargetAmountUsd = parseNonNegativeNumber(targetAmountUsd);
  if (normalizedTargetAmountUsd <= 0) return [orderedCandidateSourceIds[0]];

  const sourceFiatByKeyMap = buildSourceFiatByKeyMap(swapBalance);
  const selectedSourceIds: string[] = [];
  let runningTotalUsd = 0;

  for (const sourceId of orderedCandidateSourceIds) {
    const parsed = parseDepositSourceId(sourceId);
    if (!parsed) continue;

    selectedSourceIds.push(sourceId);
    runningTotalUsd +=
      sourceFiatByKeyMap.get(
        getFiatLookupKey(parsed.tokenAddress, parsed.chainId),
      ) ?? 0;

    if (runningTotalUsd >= normalizedTargetAmountUsd) break;
  }

  return selectedSourceIds;
};

export const buildSortedFromSources = (params: {
  sourceIds: Iterable<string>;
  swapBalance: UserAsset[] | null;
  destination: DepositSourceDestination;
  minimumBalanceUsd?: number;
}): Array<{ tokenAddress: Hex; chainId: number }> =>
  sortSourceIdsByPriority(params)
    .map((sourceId) => parseDepositSourceId(sourceId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

export interface ResolvedDepositSourceSelection {
  fromSources: Array<{ tokenAddress: Hex; chainId: number }>;
  selectedSourceIds: string[];
  sourcePoolIds: string[];
}

export const resolveDepositSourceSelection = (params: {
  swapBalance: UserAsset[] | null;
  destination: DepositSourceDestination;
  filter: DepositSourceFilter;
  selectedSourceIds: Iterable<string>;
  isManualSelection: boolean;
  minimumBalanceUsd: number;
  targetAmountUsd?: number;
  excludedSourceIds?: Iterable<string>;
}): ResolvedDepositSourceSelection => {
  const {
    swapBalance,
    destination,
    excludedSourceIds,
    filter,
    selectedSourceIds,
    isManualSelection,
    minimumBalanceUsd,
    targetAmountUsd,
  } = params;
  const excludedSourceIdSet = new Set(excludedSourceIds ?? []);

  const sourcePoolIds = buildDepositSourcePoolIds({
    swapBalance,
    filter,
    selectedSourceIds,
    isManualSelection,
  }).filter((sourceId) => !excludedSourceIdSet.has(sourceId));

  const resolvedSelectedSourceIds = isManualSelection
    ? sortSourceIdsByPriority({
        sourceIds: sourcePoolIds,
        swapBalance,
        destination,
        minimumBalanceUsd,
      })
    : buildPrioritySelectedSourceIds({
        swapBalance,
        destination,
        minimumBalanceUsd,
        targetAmountUsd,
        sourceIds: sourcePoolIds,
      });

  return {
    sourcePoolIds,
    selectedSourceIds: resolvedSelectedSourceIds,
    fromSources: buildSortedFromSources({
      sourceIds: resolvedSelectedSourceIds,
      swapBalance,
      destination,
      minimumBalanceUsd,
    }),
  };
};
