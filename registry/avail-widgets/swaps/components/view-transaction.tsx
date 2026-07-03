import React, { FC, type RefObject, useMemo, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
} from "../../ui/dialog";
import {
  type SwapStepType,
} from "../../common";
import {
  type OnSwapIntentHookData,
} from "@avail-project/nexus-core";
import { formatTokenBalance } from "@avail-project/nexus-core/utils";
import { ChevronDown, ChevronUp, Info, MoveDown, XIcon } from "lucide-react";
import { TokenIcon } from "./token-icon";
import { StackedTokenIcons } from "./stacked-token-icons";
import {
  type GenericStep,
  formatUsdForDisplay,
  usdFormatter,
} from "../../common";
import { TOKEN_IMAGES } from "../config/destination";
import { Button } from "../../ui/button";
import {
  type ExactOutSourceOption,
  type SwapMode,
  type TransactionStatus,
} from "../hooks/useSwaps";
import { getIntentMatchedOptionKeys } from "../utils/source-matching";
import TransactionProgress from "./transaction-progress";
import { Separator } from "../../ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";
import { Checkbox } from "../../ui/checkbox";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

function parseNonNegativeNumber(value: unknown): number {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatFeeUsd(amountUsd: number): string {
  if (amountUsd > 0 && amountUsd < 0.001) {
    return "< $0.001";
  }
  return formatUsdForDisplay(amountUsd);
}

function formatSignedUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0.00";
  const sign = value < 0 ? "-" : "+";
  const absolute = Math.abs(value);
  const absoluteLabel =
    absolute < 0.001 ? "< $0.001" : formatUsdForDisplay(absolute);
  return `${sign}${absoluteLabel}`;
}

function formatImpactPercent(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0%";
  const absolute = Math.abs(value);
  if (absolute < 0.01) {
    return "< 0.01%";
  }
  const fixed = absolute.toFixed(2);
  return `${fixed.replace(/\.?0+$/, "")}%`;
}

interface ViewTransactionProps {
  steps: GenericStep<SwapStepType>[];
  status: TransactionStatus;
  swapMode: SwapMode;
  swapIntent: RefObject<OnSwapIntentHookData | null>;
  getFiatValue: (amount: number, token: string) => number;
  continueSwap: () => void | Promise<void>;
  exactOutSourceOptions: ExactOutSourceOption[];
  exactOutSelectedKeys: string[];
  toggleExactOutSource: (key: string) => void;
  isExactOutSourceSelectionDirty: boolean;
  updatingExactOutSources: boolean;
  explorerUrls: {
    sourceExplorerUrl: string | null;
    destinationExplorerUrl: string | null;
  };
  reset: () => void;
  txError: string | null;
}

interface TokenBreakdownProps
  extends Omit<
    ViewTransactionProps,
    | "swapIntent"
    | "continueSwap"
    | "status"
    | "explorerUrls"
    | "steps"
    | "reset"
    | "txError"
    | "swapMode"
    | "nexusSDK"
    | "exactOutSourceOptions"
    | "exactOutSelectedKeys"
    | "toggleExactOutSource"
    | "isExactOutSourceSelectionDirty"
    | "updatingExactOutSources"
  > {
  tokenLogo: string;
  chainLogo: string;
  symbol: string;
  amount: number;
  decimals: number;
}

const TokenBreakdown = ({
  getFiatValue,
  tokenLogo,
  chainLogo,
  symbol,
  amount,
  decimals,
}: TokenBreakdownProps) => {
  return (
    <div className="flex items-center w-full justify-between">
      <div className="flex flex-col items-start gap-y-1">
        <p className="text-xl font-medium ">
          {formatTokenBalance(amount, {
            symbol: symbol,
            decimals: decimals,
          })}
        </p>
        <p className="text-base text-muted-foreground font-medium ">
          {usdFormatter.format(getFiatValue(amount, symbol))}
        </p>
      </div>
      <TokenIcon
        symbol={symbol}
        chainLogo={chainLogo}
        tokenLogo={tokenLogo}
        size="lg"
      />
    </div>
  );
};

interface MultiSourceBreakdownProps {
  getFiatValue: (amount: number, token: string) => number;
  sources: NonNullable<OnSwapIntentHookData["intent"]>["sources"];
}

const MultiSourceBreakdown = ({
  getFiatValue,
  sources,
}: MultiSourceBreakdownProps) => {
  // Calculate summed USD value across all sources
  const totalUsdValue = useMemo(() => {
    return sources.reduce((sum, source) => {
      const amount = Number.parseFloat(source.amount);
      const fiatValue = getFiatValue(amount, source.token.symbol);
      return sum + fiatValue;
    }, 0);
  }, [sources, getFiatValue]);

  // Prepare sources for stacked icons
  const stackedSources = useMemo(() => {
    return sources.map((source) => ({
      tokenLogo: TOKEN_IMAGES[source.token.symbol] ?? "",
      chainLogo: source.chain.logo,
      symbol: source.token.symbol,
    }));
  }, [sources]);

  return (
    <div className="flex items-center w-full justify-between">
      <div className="flex flex-col items-start gap-y-1">
        <p className="text-xl font-medium">
          {sources.length} source{sources.length > 1 ? "s" : ""}
        </p>
        <p className="text-base text-muted-foreground font-medium">
          {usdFormatter.format(totalUsdValue)}
        </p>
      </div>
      <StackedTokenIcons sources={stackedSources} size="lg" maxDisplay={4} />
    </div>
  );
};

const ViewTransaction: FC<ViewTransactionProps> = ({
  steps,
  status,
  swapMode,
  swapIntent,
  getFiatValue,
  continueSwap,
  exactOutSourceOptions,
  exactOutSelectedKeys,
  toggleExactOutSource,
  isExactOutSourceSelectionDirty,
  updatingExactOutSources,
  explorerUrls,
  reset,
  txError,
}) => {
  const transactionIntent = swapIntent.current?.intent;
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [showPriceImpactDetails, setShowPriceImpactDetails] = useState(false);
  const sources = useMemo(
    () => transactionIntent?.sources ?? [],
    [transactionIntent?.sources],
  );
  const hasSources = sources.length > 0;
  const hasMultipleSources = sources.length > 1;
  const usedSourceKeys = useMemo(
    () => getIntentMatchedOptionKeys(sources, exactOutSourceOptions),
    [sources, exactOutSourceOptions],
  );
  const usedSourceKeySet = useMemo(
    () => new Set(usedSourceKeys),
    [usedSourceKeys],
  );
  const { usedSourceOptions, otherSourceOptions } = useMemo(() => {
    const usedOrder = new Map(
      usedSourceKeys.map((key, index) => [key, index] as const),
    );
    const used: ExactOutSourceOption[] = [];
    const other: ExactOutSourceOption[] = [];
    for (const opt of exactOutSourceOptions) {
      if (usedSourceKeySet.has(opt.key)) {
        used.push(opt);
      } else {
        other.push(opt);
      }
    }
    used.sort((a, b) => {
      const aOrder = usedOrder.get(a.key) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = usedOrder.get(b.key) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
    return { usedSourceOptions: used, otherSourceOptions: other };
  }, [exactOutSourceOptions, usedSourceKeySet, usedSourceKeys]);

  // Prepare source info for TransactionProgress
  const sourceInfo = useMemo(() => {
    if (!hasSources || sources.length === 0) {
      return {
        symbol: "Multiple assets",
        logos: { token: "", chain: "" },
      };
    }
    if (hasMultipleSources) {
      return {
        symbol: `${sources.length} sources`,
        logos: {
          token: TOKEN_IMAGES[sources[0].token.symbol] ?? "",
          chain: sources[0].chain.logo,
        },
      };
    }
    return {
      symbol: sources[0].token.symbol,
      logos: {
        token: TOKEN_IMAGES[sources[0].token.symbol] ?? "",
        chain: sources[0].chain.logo,
      },
    };
  }, [sources, hasSources, hasMultipleSources]);

  const shouldShowExactOutSourceSelection =
    status === "simulating" && swapMode === "exactOut";

  const feeBreakdown = useMemo(() => {
    const feesAndBuffer = transactionIntent?.feesAndBuffer;
    const bridgeRaw = feesAndBuffer?.bridge;
    const caGasUsd = parseNonNegativeNumber(bridgeRaw?.caGas);
    const collectionUsd = parseNonNegativeNumber(
      (bridgeRaw as Record<string, string | undefined> | undefined)?.collection,
    );
    const fulfilmentUsd = parseNonNegativeNumber(
      (bridgeRaw as Record<string, string | undefined> | undefined)?.fulfilment,
    );
    const gasSuppliedUsd = parseNonNegativeNumber(
      (bridgeRaw as Record<string, string | undefined> | undefined)
        ?.gasSupplied,
    );
    const protocolFeeUsd = parseNonNegativeNumber(bridgeRaw?.protocol);
    const solverFeeUsd = parseNonNegativeNumber(bridgeRaw?.solver);

    const hasBridgeBreakdown = Boolean(bridgeRaw);
    const executionBridgeUsd = collectionUsd + fulfilmentUsd + gasSuppliedUsd;
    const gasSponsorshipUsd = hasBridgeBreakdown ? caGasUsd : 0;

    const gasAmount = parseNonNegativeNumber(
      transactionIntent?.destination?.gas?.amount,
    );
    const gasSymbol = transactionIntent?.destination?.gas?.token?.symbol;
    const destinationGasUsd =
      gasAmount > 0 && gasSymbol
        ? parseNonNegativeNumber(getFiatValue(gasAmount, gasSymbol))
        : 0;
    const executionGasFeeUsd = hasBridgeBreakdown
      ? executionBridgeUsd
      : destinationGasUsd;

    const bridgeComponentTotal = Object.entries(bridgeRaw ?? {})
      .filter(([key]) => key !== "total")
      .reduce((sum, [, value]) => sum + parseNonNegativeNumber(value), 0);
    const bridgeExplicitTotal = parseNonNegativeNumber(bridgeRaw?.total);
    const bridgeUsd =
      bridgeExplicitTotal > 0 ? bridgeExplicitTotal : bridgeComponentTotal;
    const knownBridgeRowsUsd =
      gasSponsorshipUsd +
      executionGasFeeUsd +
      protocolFeeUsd +
      solverFeeUsd;
    const otherBridgeFeeUsd = Math.max(0, bridgeUsd - knownBridgeRowsUsd);

    const bufferUsd = parseNonNegativeNumber(feesAndBuffer?.buffer);
    const totalFeeUsd =
      gasSponsorshipUsd +
      executionGasFeeUsd +
      protocolFeeUsd +
      solverFeeUsd +
      otherBridgeFeeUsd;
    const intentSpendUsd = sources.reduce((sum, source) => {
      const amount = parseNonNegativeNumber(source.amount);
      const fiatValue = getFiatValue(amount, source.token.symbol);
      return sum + parseNonNegativeNumber(fiatValue);
    }, 0);
    const destinationAmount = parseNonNegativeNumber(
      transactionIntent?.destination?.amount,
    );
    const destinationSymbol = transactionIntent?.destination?.token?.symbol;
    const destinationValueUsd =
      destinationAmount > 0 && destinationSymbol
        ? parseNonNegativeNumber(
            getFiatValue(destinationAmount, destinationSymbol),
          )
        : 0;
    const swapImpactUsd =
      destinationValueUsd - intentSpendUsd - totalFeeUsd - bufferUsd;
    const maxPriceImpactUsd = swapImpactUsd + bufferUsd;
    const spendBaseUsd = intentSpendUsd - totalFeeUsd - bufferUsd;
    const swapImpactPercent =
      spendBaseUsd > 0 ? (swapImpactUsd / spendBaseUsd) * 100 : 0;
    const maxPriceImpactPercent =
      spendBaseUsd > 0 ? (maxPriceImpactUsd / spendBaseUsd) * 100 : 0;

    return {
      totalFeeUsd,
      gasSponsorshipUsd,
      executionGasFeeUsd,
      protocolFeeUsd,
      solverFeeUsd,
      otherBridgeFeeUsd,
      bridgeUsd,
      bufferUsd,
      swapImpactUsd,
      swapImpactPercent,
      maxPriceImpactUsd,
      maxPriceImpactPercent,
    };
  }, [transactionIntent, getFiatValue, sources]);

  const feeDetailRows = useMemo(
    () =>
      [
        { label: "Gas sponsorship", amountUsd: feeBreakdown.gasSponsorshipUsd },
        {
          label: "Execution Gas fee",
          amountUsd:
            feeBreakdown.executionGasFeeUsd + feeBreakdown.otherBridgeFeeUsd,
        },
        { label: "Protocol fee", amountUsd: feeBreakdown.protocolFeeUsd },
        { label: "Solver fee", amountUsd: feeBreakdown.solverFeeUsd },
      ],
    [feeBreakdown],
  );

  const showFeeBreakdown = feeDetailRows.length > 0;
  const showPriceImpactBreakdown =
    Math.abs(feeBreakdown.maxPriceImpactUsd) > 0 ||
    Math.abs(feeBreakdown.swapImpactUsd) > 0 ||
    feeBreakdown.bufferUsd > 0;

  const exactOutSelectedTotalUsd = useMemo(() => {
    if (!shouldShowExactOutSourceSelection) return 0;
    if (!exactOutSourceOptions.length || !exactOutSelectedKeys.length) return 0;

    const selectedSet = new Set(exactOutSelectedKeys);
    return exactOutSourceOptions.reduce((sum, opt) => {
      if (!selectedSet.has(opt.key)) return sum;
      const balance = Number.parseFloat(opt.balance);
      if (!Number.isFinite(balance) || balance <= 0) return sum;
      const fiatValue = getFiatValue(balance, opt.tokenSymbol);
      if (!Number.isFinite(fiatValue) || fiatValue <= 0) return sum;
      return sum + fiatValue;
    }, 0);
  }, [
    shouldShowExactOutSourceSelection,
    exactOutSourceOptions,
    exactOutSelectedKeys,
    getFiatValue,
  ]);

  const exactOutRequiredUsd = useMemo(() => {
    if (!shouldShowExactOutSourceSelection) return 0;
    const amount = Number.parseFloat(
      transactionIntent?.destination?.amount ?? "0",
    );
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const symbol = transactionIntent?.destination?.token?.symbol;
    if (!symbol) return 0;
    const base = getFiatValue(amount, symbol);
    if (!Number.isFinite(base) || base <= 0) return 0;
    return base;
  }, [shouldShowExactOutSourceSelection, transactionIntent, getFiatValue]);

  const isExactOutSourceSelectionInsufficient = useMemo(() => {
    if (!shouldShowExactOutSourceSelection) return false;
    if (exactOutRequiredUsd <= 0) return false;
    return exactOutSelectedTotalUsd < exactOutRequiredUsd;
  }, [
    shouldShowExactOutSourceSelection,
    exactOutRequiredUsd,
    exactOutSelectedTotalUsd,
  ]);

  const continueLabel = !hasSources
    ? "Waiting for sources..."
    : updatingExactOutSources
      ? "Updating sources..."
      : shouldShowExactOutSourceSelection && isExactOutSourceSelectionDirty
        ? "Update sources"
        : "Continue";

  if (!transactionIntent) return null;

  return (
    <Dialog
      defaultOpen={true}
      onOpenChange={(open) => {
        if (!open) {
          reset();
        }
      }}
    >
      <DialogContent className="max-w-md!" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between w-full">
          <p className="text-sm font-medium text-muted-foreground">
            You&apos;re Swapping
          </p>
          <DialogClose>
            <XIcon className="size-5 text-muted-foreground" />
          </DialogClose>
        </DialogHeader>
        <div className="flex flex-col items-start w-full gap-y-4">
          {/* Source section - handle empty, single, and multiple sources */}
          {!hasSources ? (
            <div className="flex items-center w-full justify-between">
              <p className="text-base text-muted-foreground">
                Calculating sources...
              </p>
            </div>
          ) : hasMultipleSources ? (
            <MultiSourceBreakdown
              getFiatValue={getFiatValue}
              sources={sources}
            />
          ) : (
            <TokenBreakdown
              getFiatValue={getFiatValue}
              tokenLogo={TOKEN_IMAGES[sources[0].token.symbol] ?? ""}
              chainLogo={sources[0].chain.logo}
              symbol={sources[0].token.symbol}
              amount={Number.parseFloat(sources[0].amount)}
              decimals={sources[0].token.decimals}
            />
          )}
          <MoveDown className="size-5 -ml-1.5 text-muted-foreground" />
          <TokenBreakdown
            getFiatValue={getFiatValue}
            tokenLogo={
              TOKEN_IMAGES[transactionIntent?.destination?.token.symbol]
            }
            chainLogo={transactionIntent?.destination?.chain.logo}
            symbol={transactionIntent?.destination?.token.symbol}
            amount={Number.parseFloat(transactionIntent?.destination?.amount)}
            decimals={transactionIntent?.destination?.token.decimals}
          />
        </div>
        {(showFeeBreakdown || showPriceImpactBreakdown) && (
          <div className="w-full space-y-2">
            {showFeeBreakdown && (
              <div className="w-full rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Total fees</p>
                  <p className="text-sm font-medium">
                    {formatUsdForDisplay(feeBreakdown.totalFeeUsd)}
                  </p>
                </div>
                <div className="mt-1 flex items-center justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() => setShowFeeDetails(!showFeeDetails)}
                  >
                    <span>View details</span>
                    {showFeeDetails ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </button>
                </div>
                {showFeeDetails && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {feeDetailRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between text-sm"
                      >
                        <p className="text-muted-foreground">{row.label}</p>
                        <p className="text-muted-foreground">
                          {formatFeeUsd(row.amountUsd)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showPriceImpactBreakdown && (
              <div className="w-full rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-1">
                    <p className="text-sm font-medium">Max price impact</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Price impact and buffer info"
                          className="inline-flex size-3.5 items-center justify-center rounded-full border border-muted-foreground/60 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                        >
                          <Info className="size-2.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8} className="max-w-xs">
                        Includes a small buffer to ensure your swaps succeed.
                        Excess funds are refunded after deducting swap fees and
                        price impact.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-sm font-medium text-right">
                    {formatSignedUsd(feeBreakdown.maxPriceImpactUsd)} (
                    {formatImpactPercent(feeBreakdown.maxPriceImpactPercent)})
                  </p>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Includes a buffer to ensure swaps succeed. Excess funds are
                    refunded after deducting fees and impact.
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() =>
                      setShowPriceImpactDetails(!showPriceImpactDetails)
                    }
                  >
                    <span>View details</span>
                    {showPriceImpactDetails ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </button>
                </div>
                {showPriceImpactDetails && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-muted-foreground">Swap impact</p>
                      <p className="text-muted-foreground">
                        {formatSignedUsd(feeBreakdown.swapImpactUsd)} (
                        {formatImpactPercent(feeBreakdown.swapImpactPercent)})
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-muted-foreground">Swap buffer</p>
                      <p className="text-muted-foreground">
                        {formatFeeUsd(feeBreakdown.bufferUsd)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {status === "error" && (
          <p className="text-destructive text-sm">{txError}</p>
        )}
        {shouldShowExactOutSourceSelection &&
          exactOutSourceOptions.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="source-selection">
                <AccordionTrigger hideChevron={false} className="py-0">
                  <div className="flex w-full items-center justify-between">
                    <p className="text-sm font-medium">Choose sources</p>
                    <p className="text-xs text-muted-foreground">
                      {exactOutSelectedKeys.length} selected
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="mt-3 bg-muted pb-0 px-4 py-3 rounded-lg w-full">
                  {isExactOutSourceSelectionInsufficient && (
                    <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-200">
                      Insufficient selected sources balance. Selected{" "}
                      <span className="font-medium">
                        {usdFormatter.format(exactOutSelectedTotalUsd)}
                      </span>
                      , need at least{" "}
                      <span className="font-medium">
                        {usdFormatter.format(exactOutRequiredUsd)}
                      </span>{" "}
                      (required for {transactionIntent?.destination?.amount}{" "}
                      {transactionIntent?.destination?.token.symbol}).
                    </div>
                  )}
                  <p className="mb-3 text-xs text-muted-foreground">
                    {updatingExactOutSources
                      ? "Updating sources…"
                      : isExactOutSourceSelectionDirty
                        ? "Changes apply when you press Update sources."
                        : "Press Continue to proceed with these sources."}
                  </p>
                  <div className="flex max-h-56 flex-col gap-y-3 overflow-auto pr-1">
                    {usedSourceOptions.map((opt) => {
                      const isSelected = exactOutSelectedKeys.includes(opt.key);
                      const isLastSelected =
                        isSelected && exactOutSelectedKeys.length === 1;
                      const isUsed = usedSourceKeySet.has(opt.key);
                      const tokenLogo =
                        opt.tokenLogo || TOKEN_IMAGES[opt.tokenSymbol] || "";
                      const formattedBalance =
                        formatTokenBalance(opt.balance, {
                          symbol: opt.tokenSymbol,
                          decimals: opt.decimals,
                        }) ?? `${opt.balance} ${opt.tokenSymbol}`;

                      return (
                        <div
                          key={opt.key}
                          className={cn(
                            "flex w-full select-none items-center justify-between gap-x-3",
                            isLastSelected || updatingExactOutSources
                              ? "opacity-80 cursor-not-allowed"
                              : "cursor-pointer",
                          )}
                          onClick={() => {
                            if (isLastSelected || updatingExactOutSources) {
                              return;
                            }
                            toggleExactOutSource(opt.key);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (isLastSelected || updatingExactOutSources) {
                              return;
                            }
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleExactOutSource(opt.key);
                            }
                          }}
                        >
                          <div className="flex items-center gap-x-2">
                            <Checkbox
                              checked={isSelected}
                              disabled={
                                isLastSelected || updatingExactOutSources
                              }
                              onCheckedChange={() => {
                                if (isLastSelected || updatingExactOutSources) {
                                  return;
                                }
                                toggleExactOutSource(opt.key);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${opt.tokenSymbol} on ${opt.chainName} as a source`}
                            />
                            <TokenIcon
                              symbol={opt.tokenSymbol}
                              tokenLogo={tokenLogo}
                              chainLogo={opt.chainLogo}
                              size="sm"
                            />
                            <div className="flex flex-col leading-tight">
                              <p className="text-sm font-medium">
                                {opt.tokenSymbol}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {opt.chainName}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end leading-tight min-w-fit">
                            <p className="text-sm font-medium">
                              {formattedBalance}
                            </p>
                            {isUsed && (
                              <p className="text-xs text-muted-foreground">
                                Currently used
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {otherSourceOptions.length > 0 &&
                      usedSourceOptions.length > 0 && (
                        <Separator className="opacity-40" />
                      )}
                    {otherSourceOptions.map((opt) => {
                      const isSelected = exactOutSelectedKeys.includes(opt.key);
                      const isLastSelected =
                        isSelected && exactOutSelectedKeys.length === 1;
                      const isUsed = usedSourceKeySet.has(opt.key);
                      const tokenLogo =
                        opt.tokenLogo || TOKEN_IMAGES[opt.tokenSymbol] || "";
                      const formattedBalance =
                        formatTokenBalance(opt.balance, {
                          symbol: opt.tokenSymbol,
                          decimals: opt.decimals,
                        }) ?? `${opt.balance} ${opt.tokenSymbol}`;

                      return (
                        <div
                          key={opt.key}
                          className={cn(
                            "flex w-full select-none items-center justify-between gap-x-3",
                            isLastSelected || updatingExactOutSources
                              ? "opacity-80 cursor-not-allowed"
                              : "cursor-pointer",
                          )}
                          onClick={() => {
                            if (isLastSelected || updatingExactOutSources) {
                              return;
                            }
                            toggleExactOutSource(opt.key);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (isLastSelected || updatingExactOutSources) {
                              return;
                            }
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleExactOutSource(opt.key);
                            }
                          }}
                        >
                          <div className="flex items-center gap-x-2">
                            <Checkbox
                              checked={isSelected}
                              disabled={
                                isLastSelected || updatingExactOutSources
                              }
                              onCheckedChange={() => {
                                if (isLastSelected || updatingExactOutSources) {
                                  return;
                                }
                                toggleExactOutSource(opt.key);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${opt.tokenSymbol} on ${opt.chainName} as a source`}
                            />
                            <TokenIcon
                              symbol={opt.tokenSymbol}
                              tokenLogo={tokenLogo}
                              chainLogo={opt.chainLogo}
                              size="sm"
                            />
                            <div className="flex flex-col leading-tight">
                              <p className="text-sm font-medium">
                                {opt.tokenSymbol}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {opt.chainName}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end leading-tight min-w-fit">
                            <p className="text-sm font-medium">
                              {formattedBalance}
                            </p>
                            {isUsed && (
                              <p className="text-xs text-muted-foreground">
                                Currently used
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Select at least 1 source.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        {status === "simulating" && (
          <Button
            onClick={() => void continueSwap()}
            disabled={
              !hasSources ||
              updatingExactOutSources ||
              (shouldShowExactOutSourceSelection &&
                isExactOutSourceSelectionInsufficient)
            }
          >
            {continueLabel}
          </Button>
        )}

        {(status === "swapping" || status === "success") && (
          <>
            <Separator className="transition-opacity" />
            <TransactionProgress
              steps={steps}
              explorerUrls={explorerUrls}
              sourceSymbol={sourceInfo.symbol}
              destinationSymbol={transactionIntent.destination.token.symbol}
              sourceLogos={sourceInfo.logos}
              destinationLogos={{
                token: TOKEN_IMAGES[transactionIntent.destination.token.symbol],
                chain: transactionIntent.destination.chain.logo,
              }}
              hasMultipleSources={hasMultipleSources}
              sources={
                hasMultipleSources
                  ? sources.map((s) => ({
                      tokenLogo: TOKEN_IMAGES[s.token.symbol] ?? "",
                      chainLogo: s.chain.logo,
                      symbol: s.token.symbol,
                    }))
                  : undefined
              }
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ViewTransaction;
