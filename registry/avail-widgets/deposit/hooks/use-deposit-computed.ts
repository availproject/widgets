"use client";

import { useMemo } from "react";
import type { DestinationConfig, AssetSelectionState } from "../types";
import type {
  OnSwapIntentHookData,
  NexusClient as NexusSDK,
} from "@avail-project/nexus-core";
import type { UserAsset } from "../../nexus/NexusProvider";
import { formatTokenBalance } from "@avail-project/nexus-core/utils";
import { CHAIN_METADATA } from "../../common/utils/constant";
import { usdFormatter } from "../../common";
import type { SwapSkippedData } from "./use-deposit-state";

const NATIVE_TOKEN_PLACEHOLDER_ADDRESS =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function normalizeAddress(address?: string | null): string {
  return (address ?? "").toLowerCase();
}

function isNativeLikeAddress(address?: string | null): boolean {
  const normalized = normalizeAddress(address);
  return (
    normalized === NATIVE_TOKEN_PLACEHOLDER_ADDRESS ||
    normalized === ZERO_ADDRESS
  );
}

function resolvePricingSymbol(params: {
  chainId: number;
  contractAddress?: string | null;
  fallbackSymbol: string;
}): string {
  const { chainId, contractAddress, fallbackSymbol } = params;
  if (!isNativeLikeAddress(contractAddress)) {
    return fallbackSymbol;
  }

  const nativeSymbol =
    CHAIN_METADATA[chainId as keyof typeof CHAIN_METADATA]?.nativeCurrency
      ?.symbol;
  return nativeSymbol ?? fallbackSymbol;
}

function parseNonNegativeNumber(value: unknown): number {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatFeeKeyLabel(key: string): string {
  const normalized = key.trim();
  if (!normalized) return "Fee";

  const knownLabels: Record<string, string> = {
    caGas: "CA gas",
    protocol: "Protocol",
    solver: "Solver",
    collection: "Collection",
    fulfilment: "Fulfilment",
    gasSupplied: "Gas supplied",
  };

  if (knownLabels[normalized]) {
    return knownLabels[normalized];
  }

  const spaced = normalized
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface UseDepositComputedProps {
  swapBalance: UserAsset[] | null;
  assetSelection: AssetSelectionState;
  activeIntent: OnSwapIntentHookData | null;
  destination: DestinationConfig;
  inputAmount: string | undefined;
  exchangeRate: Record<string, number> | null;
  getFiatValue: (amount: number, symbol: string) => number;
  actualGasFeeUsd: number | null;
  swapSkippedData: SwapSkippedData | null;
  skipSwap: boolean;
  nexusSDK: NexusSDK | null;
}

/**
 * Available asset item from swap balance
 */
export interface AvailableAsset {
  chainId: number;
  tokenAddress: `0x${string}`;
  decimals: number;
  symbol: string;
  balance: string;
  balanceInFiat?: number;
  tokenLogo?: string;
  chainLogo?: string;
  chainName?: string;
}

type AssetBreakdownWithOptionalIcon = UserAsset["breakdown"][number] & {
  icon?: string;
};

/**
 * Hook for computing derived values from deposit widget state.
 * Separates computation logic from main hook for better maintainability.
 */
export function useDepositComputed(props: UseDepositComputedProps) {
  const {
    swapBalance,
    assetSelection,
    activeIntent,
    destination,
    inputAmount,
    exchangeRate,
    getFiatValue,
    actualGasFeeUsd,
    swapSkippedData,
    skipSwap,
    nexusSDK,
  } = props;

  /**
   * Flatten swap balance into a sorted list of available assets
   */
  const availableAssets = useMemo<AvailableAsset[]>(() => {
    if (!swapBalance) return [];
    const items: AvailableAsset[] = [];

    for (const asset of swapBalance) {
      if (!asset?.breakdown?.length) continue;
      for (const breakdown of asset.breakdown) {
        if (!breakdown?.chain?.id || !breakdown.balance) continue;
        const numericBalance = Number.parseFloat(breakdown.balance);
        if (!Number.isFinite(numericBalance) || numericBalance <= 0) continue;
        const breakdownIcon = (breakdown as AssetBreakdownWithOptionalIcon)
          .icon;

        items.push({
          chainId: breakdown.chain.id,
          tokenAddress: breakdown.contractAddress as `0x${string}`,
          decimals: breakdown.decimals ?? asset.decimals,
          symbol: breakdown.symbol,
          balance: breakdown.balance,
          balanceInFiat: breakdown.balanceInFiat,
          tokenLogo: breakdownIcon || "",
          chainLogo: breakdown.chain.logo,
          chainName: breakdown.chain.name,
        });
      }
    }
    return items.toSorted(
      (a, b) => (b.balanceInFiat ?? 0) - (a.balanceInFiat ?? 0),
    );
  }, [swapBalance]);

  /**
   * Total USD value of selected assets
   */
  const totalSelectedBalance = useMemo(
    () =>
      availableAssets.reduce((sum, asset) => {
        const key = `${asset.tokenAddress}-${asset.chainId}`;
        if (assetSelection.selectedChainIds.has(key)) {
          return sum + (asset.balanceInFiat ?? 0);
        }
        return sum;
      }, 0),
    [availableAssets, assetSelection.selectedChainIds],
  );

  /**
   * Total balance across all assets
   */
  const totalBalance = useMemo(() => {
    const balance =
      swapBalance?.reduce(
        (acc, balance) => acc + parseFloat(balance.balance),
        0,
      ) ?? 0;
    const usdBalance =
      swapBalance?.reduce((acc, balance) => acc + (balance.balanceInFiat ?? 0), 0) ??
      0;
    return { balance, usdBalance };
  }, [swapBalance]);

  /**
   * User's existing balance on destination chain
   */
  const destinationBalance = useMemo(() => {
    if (!nexusSDK || !swapBalance || !destination) return undefined;
    return swapBalance
      ?.flatMap((token) => token.breakdown ?? [])
      ?.find(
        (chain) =>
          chain.chain?.id === destination.chainId &&
          normalizeAddress(chain.contractAddress) ===
            normalizeAddress(destination.tokenAddress),
      );
  }, [swapBalance, nexusSDK, destination]);

  /**
   * Confirmation screen details computed from intent or skipped swap data
   */
  const confirmationDetails = useMemo(() => {
    // Handle swap skipped case - compute from swapSkippedData
    if (swapSkippedData && skipSwap) {
      const { destination: destData, gas } = swapSkippedData;

      // Format the token amount from raw units
      const rawAmount = Number.parseFloat(destData.amount);
      const tokenAmount = rawAmount / Math.pow(10, destData.token.decimals);
      const receiveAmountUsd = getFiatValue(tokenAmount, destData.token.symbol);

      // Format for display
      const receiveAmountAfterSwap = `${tokenAmount.toFixed(2)} ${destData.token.symbol}`;

      // Gas fee calculation from swapSkippedData
      const estimatedFeeWei = Number.parseFloat(gas.estimatedFee);
      const estimatedFeeEth = estimatedFeeWei / 1e18;
      const gasFeeUsd = getFiatValue(
        estimatedFeeEth,
        destination.gasTokenSymbol ?? "ETH",
      );

      return {
        sourceLabel: destination.label ?? "Deposit",
        sources: [],
        gasTokenSymbol: destination.gasTokenSymbol,
        estimatedTime: destination.estimatedTime ?? "~30s",
        amountSpent: receiveAmountUsd,
        totalFeeUsd: gasFeeUsd,
        receiveTokenSymbol: destData.token.symbol,
        receiveAmountAfterSwapUsd: receiveAmountUsd,
        receiveAmountAfterSwap,
        receiveTokenLogo: destination.tokenLogo,
        receiveTokenChain: destData.chain.id,
        destinationChainName: destData.chain.name,
      };
    }

    if (!activeIntent || !nexusSDK) return null;

    // Use user's requested amount (from input), not SDK's optimized bridge amount
    const receiveAmountUsd = inputAmount
      ? parseFloat(inputAmount.replace(/,/g, ""))
      : 0;

    // Use getFiatValue which goes through the full pegging-aware
    // resolution (e.g. wcBTC → BTC → ~$103k) instead of a raw
    // exchangeRate lookup that is case-sensitive and bypasses pegs.
    const tokenExchangeRate = getFiatValue(1, destination.tokenSymbol);
    const safeTokenExchangeRate =
      Number.isFinite(tokenExchangeRate) && tokenExchangeRate > 0
        ? tokenExchangeRate
        : 1;
    const receiveTokenAmount = receiveAmountUsd / safeTokenExchangeRate;

    const receiveAmountAfterSwap = formatTokenBalance(
      receiveTokenAmount.toString(),
      {
        symbol: destination.tokenSymbol,
        decimals: destination.tokenDecimals,
      },
    );

    // Build sources array from intent sources
    const sources: Array<{
      chainId: number;
      tokenAddress: `0x${string}`;
      decimals: number;
      symbol: string;
      balance: string;
      balanceInFiat?: number;
      tokenLogo?: string;
      chainLogo?: string;
      chainName?: string;
      isDestinationBalance?: boolean;
    }> = [];

    activeIntent.intent.sources.forEach((source) => {
      const sourcePricingSymbol = resolvePricingSymbol({
        chainId: source.chain.id,
        contractAddress: source.token.contractAddress,
        fallbackSymbol: source.token.symbol,
      });
      const sourceAmountUsd = parseNonNegativeNumber(source.value);

      const matchingAsset = availableAssets.find(
        (asset) =>
          asset.chainId === source.chain.id &&
          (normalizeAddress(asset.tokenAddress) ===
            normalizeAddress(source.token.contractAddress) ||
            asset.symbol.toUpperCase() === source.token.symbol.toUpperCase()),
      );

      if (matchingAsset) {
        sources.push({
          ...matchingAsset,
          symbol: sourcePricingSymbol,
          balance: source.amount,
          balanceInFiat: sourceAmountUsd,
          isDestinationBalance: false,
        });
      } else {
        sources.push({
          chainId: source.chain.id,
          tokenAddress: source.token.contractAddress as `0x${string}`,
          decimals: source.token.decimals,
          symbol: sourcePricingSymbol,
          balance: source.amount,
          balanceInFiat: sourceAmountUsd,
          chainLogo: source.chain.logo,
          chainName: source.chain.name,
          isDestinationBalance: false,
        });
      }
    });

    // Calculate total spent from cross-chain sources
    const totalAmountSpentUsd = activeIntent.intent.sources?.reduce(
      (acc: number, source: any) => acc + parseNonNegativeNumber(source.value),
      0,
    );

    // Get the actual amount arriving on destination (AFTER fees)
    const destinationAmountUsd = parseNonNegativeNumber(
      activeIntent.intent.destination?.value,
    );

    const intentFeesAndBuffer = activeIntent.intent.feesAndBuffer;
    const bridgeFeeEntries = Object.entries(intentFeesAndBuffer?.bridge ?? {})
      .filter(([key]) => key !== "total")
      .map(([key, value]) => ({
        key,
        amountUsd: parseNonNegativeNumber(value),
      }));
    const bridgeFeeComponentsTotal = bridgeFeeEntries.reduce(
      (sum, fee) => sum + fee.amountUsd,
      0,
    );
    const bridgeFeeExplicitTotal = parseNonNegativeNumber(
      intentFeesAndBuffer?.bridge?.total,
    );

    // SDK-provided bridge total is authoritative; component sum is a fallback.
    const bridgeFeeUsd =
      bridgeFeeExplicitTotal > 0
        ? bridgeFeeExplicitTotal
        : bridgeFeeComponentsTotal;

    // Fall back to inferred fee only when intent payload has no feesAndBuffer field.
    const inferredFeeUsd = Math.max(
      0,
      totalAmountSpentUsd - destinationAmountUsd,
    );
    const hasIntentFeeBreakdown = Boolean(intentFeesAndBuffer);
    const totalFeeUsd = hasIntentFeeBreakdown ? bridgeFeeUsd : inferredFeeUsd;

    // Calculate destination balance used
    const usedFromDestinationUsd = Math.max(
      0,
      receiveAmountUsd - destinationAmountUsd,
    );

    if (usedFromDestinationUsd > 0) {
      const usedTokenAmount = usedFromDestinationUsd / safeTokenExchangeRate;
      const chainMeta =
        CHAIN_METADATA[destination.chainId as keyof typeof CHAIN_METADATA];

      sources.push({
        chainId: destination.chainId,
        tokenAddress: destination.tokenAddress,
        decimals: destination.tokenDecimals,
        symbol: destination.tokenSymbol,
        balance: usedTokenAmount.toString(),
        balanceInFiat: usedFromDestinationUsd,
        tokenLogo: destination.tokenLogo,
        chainLogo: chainMeta?.logo,
        chainName: chainMeta?.name,
        isDestinationBalance: true,
      });
    }

    const actualAmountSpent = totalAmountSpentUsd + usedFromDestinationUsd;

    return {
      sourceLabel: destination.label ?? "Deposit",
      sources,
      gasTokenSymbol: destination.gasTokenSymbol,
      estimatedTime: destination.estimatedTime ?? "~30s",
      amountSpent: actualAmountSpent,
      totalFeeUsd,
      receiveTokenSymbol: destination.tokenSymbol,
      receiveAmountAfterSwapUsd: receiveAmountUsd,
      receiveAmountAfterSwap,
      receiveTokenLogo: destination.tokenLogo,
      receiveTokenChain: destination.chainId,
      destinationChainName: activeIntent.intent.destination?.chain?.name,
    };
  }, [
    activeIntent,
    nexusSDK,
    destination,
    availableAssets,
    inputAmount,
    exchangeRate,
    getFiatValue,
    swapSkippedData,
    skipSwap,
  ]);

  /**
   * Gas fee breakdown for display
   */
  const feeBreakdown = useMemo(() => {
    let gasUsd = 0;

    // Use actual gas fee from receipt if available
    if (actualGasFeeUsd !== null) {
      gasUsd = actualGasFeeUsd;
    } else if (swapSkippedData && skipSwap) {
      // Use gas from swapSkippedData when swap is skipped
      const { gas } = swapSkippedData;
      const estimatedFeeWei = Number.parseFloat(gas.estimatedFee);
      const estimatedFeeEth = estimatedFeeWei / 1e18;
      gasUsd = getFiatValue(
        estimatedFeeEth,
        destination.gasTokenSymbol ?? "ETH",
      );
    } else if (activeIntent?.intent?.destination?.gas) {
      // Otherwise use estimated gas from intent
      const gas = activeIntent.intent.destination.gas;
      gasUsd = parseNonNegativeNumber(gas.value);
    }

    const bridgeRaw = activeIntent?.intent?.feesAndBuffer?.bridge;
    const caGasUsd = parseNonNegativeNumber(bridgeRaw?.caGas);
    const gasSuppliedUsd = parseNonNegativeNumber(
      (bridgeRaw as Record<string, string | undefined> | undefined)
        ?.gasSupplied,
    );
    const protocolFeeUsd = parseNonNegativeNumber(bridgeRaw?.protocol);
    const solverFeeUsd = parseNonNegativeNumber(bridgeRaw?.solver);

    const hasBridgeBreakdown = Boolean(bridgeRaw);
    const executionBridgeUsd = caGasUsd;
    const gasSponsorshipUsd = hasBridgeBreakdown ? gasSuppliedUsd : 0;
    const executionGasFeeUsd = hasBridgeBreakdown ? executionBridgeUsd : gasUsd;

    const bridgeComponents = Object.entries(bridgeRaw ?? {})
      .filter(([key]) => key !== "total")
      .map(([key, value]) => ({
        key,
        label: formatFeeKeyLabel(key),
        amountUsd: parseNonNegativeNumber(value),
      }))
      .filter((component) => component.amountUsd > 0);

    const bridgeComponentsTotal = bridgeComponents.reduce(
      (sum, component) => sum + component.amountUsd,
      0,
    );
    const bridgeExplicitTotal = parseNonNegativeNumber(bridgeRaw?.total);
    const bridgeUsd =
      bridgeExplicitTotal > 0 ? bridgeExplicitTotal : bridgeComponentsTotal;
    const knownBridgeRowsUsd =
      gasSponsorshipUsd + executionGasFeeUsd + protocolFeeUsd + solverFeeUsd;
    const otherBridgeFeeUsd = Math.max(0, bridgeUsd - knownBridgeRowsUsd);

    // Intent buffer can be displayed for transparency but is not added to total fee.
    const bufferUsd = parseNonNegativeNumber(
      activeIntent?.intent?.feesAndBuffer?.buffer,
    );

    const totalFeeUsd =
      executionGasFeeUsd +
      gasSponsorshipUsd +
      protocolFeeUsd +
      solverFeeUsd +
      otherBridgeFeeUsd;
    const gasFormatted = usdFormatter.format(gasUsd);

    const sourceValueUsd = (activeIntent?.intent?.sources ?? []).reduce(
      (sum: number, source: any) => sum + parseNonNegativeNumber(source.value),
      0,
    );

    const destinationValueUsd = parseNonNegativeNumber(
      activeIntent?.intent?.destination?.value,
    );

    const totalSomething = destinationValueUsd + totalFeeUsd + bufferUsd;
    const swapImpactUsd = totalSomething - sourceValueUsd;
    const spendBaseUsd = sourceValueUsd - totalFeeUsd - bufferUsd;
    const swapImpactPercent =
      spendBaseUsd > 0 ? (swapImpactUsd / spendBaseUsd) * 100 : 0;

    return {
      totalGasFee: gasUsd,
      gasUsd,
      gasFormatted,
      bridgeUsd,
      bufferUsd,
      totalFeeUsd,
      gasSponsorshipUsd,
      executionGasFeeUsd,
      protocolFeeUsd,
      solverFeeUsd,
      otherBridgeFeeUsd,
      swapImpactUsd,
      swapImpactPercent,
      bridgeComponents,
    };
  }, [
    activeIntent,
    getFiatValue,
    actualGasFeeUsd,
    swapSkippedData,
    skipSwap,
    destination.chainId,
    destination.gasTokenSymbol,
    destination.tokenSymbol,
  ]);

  return {
    availableAssets,
    totalSelectedBalance,
    totalBalance,
    destinationBalance,
    confirmationDetails,
    feeBreakdown,
  };
}
