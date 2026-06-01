"use client";

import { useState, useMemo } from "react";
import SummaryCard from "./summary-card";
import { GasPumpIcon, CoinIcon } from "./icons";
import WidgetHeader from "./widget-header";
import { ReceiveAmountDisplay } from "./receive-amount-display";
import { ErrorBanner } from "./error-banner";
import type { DepositWidgetContextValue } from "../types";
import { Button } from "../../ui/button";
import { CardContent } from "../../ui/card";
import { usdFormatter } from "../../common";
import { TOKEN_IMAGES } from "../constants/assets";
import { formatTokenBalance } from "@avail-project/nexus-core";
import { useNexus } from "../../nexus/NexusProvider";
import { BadgePercent, ShieldCheck } from "lucide-react";
import { formatFeeUsd, formatImpactPercent, formatSignedUsd } from "../utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

interface ConfirmationContainerProps {
  widget: DepositWidgetContextValue;
  heading?: string;
  onClose?: () => void;
}

const ConfirmationContainer = ({
  widget,
  heading,
  onClose,
}: ConfirmationContainerProps) => {
  const [showSpendDetails, setShowSpendDetails] = useState(false);
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const { getFiatValue } = useNexus();

  const {
    confirmationDetails,
    feeBreakdown,
    handleConfirmOrder,
    isProcessing,
    txError,
    activeIntent,
    simulationLoading,
  } = widget;

  const isLoading = simulationLoading || !activeIntent;

  const receiveAmount =
    confirmationDetails?.receiveAmountAfterSwapUsd?.toFixed(2) ?? "0";
  const timeLabel = confirmationDetails?.estimatedTime ?? "~30s";
  const amountSpent = confirmationDetails?.amountSpent ?? 0;
  // TODO: Ensure unique names are displayed
  const tokenNames = confirmationDetails?.sources
    .filter((s) => s)
    .map((s) => s?.symbol)
    .slice(0, 2)
    .join(", ");
  const moreCount =
    (confirmationDetails?.sources.filter((s) => s).length ?? 0) - 2;
  const tokenNamesSummary =
    moreCount > 0 ? `${tokenNames} + ${moreCount} more` : tokenNames;

  // Combined filter + map into single iteration (js-combine-iterations)
  const sourceDetails = useMemo(() => {
    if (!confirmationDetails?.sources) return [];
    const result: Array<{
      chainName: string;
      chainLogo: string | undefined;
      tokenSymbol: string;
      tokenDecimals: number;
      amount: string;
      amountUsd?: number;
      isDestinationBalance: boolean;
    }> = [];
    for (const source of confirmationDetails.sources) {
      if (!source) continue;
      result.push({
        chainName: source.chainName ?? "",
        chainLogo: source.chainLogo,
        tokenSymbol: source.symbol ?? "",
        tokenDecimals: source.decimals ?? 6,
        amount: source.balance ?? "0",
        amountUsd: source.balanceInFiat,
        isDestinationBalance: source.isDestinationBalance ?? false,
      });
    }
    return result;
  }, [confirmationDetails]);

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
      ].filter((row) => row.amountUsd > 0),
    [feeBreakdown],
  );

  const showFeeBreakdown = !isLoading && feeDetailRows.length > 0;
  const showPriceImpactBreakdown =
    !isLoading &&
    (Math.abs(feeBreakdown.swapImpactUsd) > 0 || feeBreakdown.bufferUsd > 0);

  return (
    <>
      <WidgetHeader
        title={heading ?? ""}
        onBack={widget.goBack}
        onClose={onClose}
        depositTargetLogo={widget?.destination?.depositTargetLogo}
      />
      <CardContent>
        <div className="flex flex-col">
          <div className="bg-base rounded-t-lg border-t border-l border-r shadow-[0_1px_12px_0_rgba(91,91,91,0.05)] px-6 pt-10 pb-1 flex flex-col gap-6">
            <ReceiveAmountDisplay
              amount={receiveAmount}
              timeLabel={timeLabel}
              loading={isLoading}
              destinationTokenLogo={
                widget?.destination?.tokenLogo ||
                (widget?.destination?.tokenSymbol ? TOKEN_IMAGES[widget.destination.tokenSymbol] : undefined)
              }
              depositTargetLogo={widget?.destination?.depositTargetLogo}
            />
            <div className="max-h-100 overflow-y-auto no-scrollbar">
              <SummaryCard
                icon={<CoinIcon className="w-5 h-5 text-muted-foreground" />}
                title="You spend"
                subtitle={
                  isLoading
                    ? "Calculating..."
                    : tokenNamesSummary || "Selected assets"
                }
                value={String(amountSpent)}
                showBreakdown={!isLoading && sourceDetails.length > 0}
                loading={isLoading}
                expanded={showSpendDetails}
                onToggleExpand={() => setShowSpendDetails(!showSpendDetails)}
              >
                <div className="space-y-4">
                  {sourceDetails.map((source, index) => {
                    const amountUsd =
                      source.amountUsd ??
                      getFiatValue(
                        parseFloat(source.amount),
                        source.tokenSymbol,
                      );
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {source.chainLogo && (
                            <img
                              src={source.chainLogo}
                              alt={source.chainName}
                              width={20}
                              height={20}
                              className="rounded-full"
                            />
                          )}
                          <div className="flex flex-col gap-0.5">
                            <span className="font-sans text-sm text-card-foreground">
                              {source.tokenSymbol}
                            </span>
                            <span className="font-sans text-[13px] text-muted-foreground">
                              {source.chainName}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 items-end">
                          <span className="font-sans text-sm text-card-foreground">
                            {usdFormatter.format(amountUsd)}
                          </span>
                          <span className="font-sans text-[13px] text-muted-foreground">
                            {formatTokenBalance(parseFloat(source.amount), {
                              decimals: source.tokenDecimals,
                              symbol: source.tokenSymbol,
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SummaryCard>

              <SummaryCard
                icon={<GasPumpIcon className="w-5 h-5 text-muted-foreground" />}
                title="Total fees"
                value={formatFeeUsd(feeBreakdown.totalFeeUsd)}
                showBreakdown={showFeeBreakdown}
                loading={isLoading}
                expanded={showFeeDetails}
                onToggleExpand={() => setShowFeeDetails(!showFeeDetails)}
              >
                <div className="space-y-3">
                  {feeDetailRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between"
                    >
                      <span className="font-sans text-sm text-card-foreground">
                        {row.label}
                      </span>
                      <span className="font-sans text-sm text-muted-foreground">
                        {formatFeeUsd(row.amountUsd)}
                      </span>
                    </div>
                  ))}
                </div>
              </SummaryCard>

              {showPriceImpactBreakdown && (
                <SummaryCard
                  icon={
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <BadgePercent className="size-5 text-muted-foreground stroke-[1.8]" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Estimated market impact from multiple swap routes</p>
                      </TooltipContent>
                    </Tooltip>
                  }
                  title={
                    <div className="flex flex-col w-full gap-y-1">
                      <div className="inline-flex items-center gap-1.5">
                        <span>Price impact</span>
                      </div>
                    </div>
                  }
                  subText={
                    <div className="flex flex-col items-start gap-y-4 py-4">
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-x-4">
                          <ShieldCheck className="size-5 text-muted-foreground stroke-[1.8]" />
                          <span className="font-sans text-sm text-card-foreground">
                            Swap buffer
                          </span>
                        </div>
                        <span className="font-display text-card-foreground tracking-[0.36px] leading-4.5 font-medium">
                          {formatFeeUsd(feeBreakdown.bufferUsd)}
                        </span>
                      </div>

                      <p className="font-sans text-xs leading-4.5 text-muted-foreground ml-8.5">
                        Temporary buffer collected to ensure swaps succeed.{" "}
                        <br />
                        Excess funds are refunded.
                      </p>
                    </div>
                  }
                  value={`${formatSignedUsd(feeBreakdown.swapImpactUsd)} (${formatImpactPercent(feeBreakdown.swapImpactPercent)})`}
                  showBreakdown={false}
                  loading={isLoading}
                />
              )}
            </div>
          </div>
          {txError && widget.status === "error" && (
            <ErrorBanner message={txError} />
          )}
          <Button
            className="rounded-t-none"
            onClick={handleConfirmOrder}
            disabled={isProcessing || isLoading}
          >
            {isProcessing
              ? "Fetching quote"
              : isLoading
                ? "Fetching quote"
                : "Confirm and deposit"}
          </Button>
        </div>
      </CardContent>
    </>
  );
};

export default ConfirmationContainer;
