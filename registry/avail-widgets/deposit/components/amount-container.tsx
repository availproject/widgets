"use client";

import { useCallback, useMemo, useState } from "react";
import type { SwapMaxParams } from "@avail-project/nexus-core";
import WidgetHeader from "./widget-header";
import type { DepositWidgetContextValue } from "../types";
import AmountCard from "./amount-card";
import PayUsing from "./pay-using";
import { ErrorBanner } from "./error-banner";
import { EmptyBalanceState } from "./empty-balance-state";
import { Button } from "../../ui/button";
import { CardContent } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { buildDepositSourcePoolIds, parseSourceId } from "../utils";

interface AmountContainerProps {
  widget: DepositWidgetContextValue;
  heading?: string;
  onClose?: () => void;
}

const AmountContainer = ({
  widget,
  heading,
  onClose,
}: AmountContainerProps) => {
  const [hasAmountError, setHasAmountError] = useState(false);
  const isSwapBalanceLoaded = widget.swapBalance !== null;
  const hasAnySwapAsset = (widget.swapBalance?.length ?? 0) > 0;
  const hasPositiveSwapBalance = useMemo(
    () =>
      (widget.swapBalance ?? []).some((asset) =>
        (asset.breakdown ?? []).some((chain: any) => {
          const amount = Number.parseFloat(chain.balance ?? "0");
          return Number.isFinite(amount) && amount > 0;
        }),
      ),
    [widget.swapBalance],
  );
  const shouldShowEmptyState = isSwapBalanceLoaded && !hasPositiveSwapBalance;
  const amountScreenBalance = useMemo(() => {
    if (widget.assetSelection.filter === "all") {
      return widget.totalBalance?.usdBalance ?? 0;
    }

    return widget.totalSelectedBalance;
  }, [
    widget.assetSelection.filter,
    widget.totalBalance?.usdBalance,
    widget.totalSelectedBalance,
  ]);
  const maxSwapInput = useMemo<SwapMaxParams | undefined>(() => {
    const sourcePoolIds = buildDepositSourcePoolIds({
      swapBalance: widget.swapBalance,
      filter: widget.assetSelection.filter,
      selectedSourceIds: widget.assetSelection.selectedChainIds,
      isManualSelection: widget.isManualSelection,
    });

    const fromSources = sourcePoolIds
      .map((sourceId) => parseSourceId(sourceId))
      .filter((source): source is NonNullable<typeof source> =>
        Boolean(source),
      );

    return {
      toChainId: widget.destination.chainId,
      toTokenAddress: widget.destination.tokenAddress,
      sources: fromSources.length > 0 ? fromSources : undefined,
    };
  }, [
    widget.swapBalance,
    widget.assetSelection.filter,
    widget.assetSelection.selectedChainIds,
    widget.isManualSelection,
    widget.destination.chainId,
    widget.destination.tokenAddress,
  ]);

  const handleAmountChange = useCallback(
    (amount: string) => {
      widget.setInputs({ amount });
    },
    [widget],
  );

  const handleErrorStateChange = useCallback((hasError: boolean) => {
    setHasAmountError(hasError);
  }, []);

  return (
    <>
      <WidgetHeader
        title={heading ?? ""}
        onClose={onClose}
        depositTargetLogo={widget?.destination?.depositTargetLogo}
      />
      <CardContent>
        <div className="flex flex-col gap-4">
          {!isSwapBalanceLoaded ? (
            <Skeleton className="min-h-[212px]" />
          ) : shouldShowEmptyState ? (
            <EmptyBalanceState
              mode={hasAnySwapAsset ? "zero-balance" : "no-swap-assets"}
              onRefresh={() => {
                void widget.reset();
              }}
            />
          ) : (
            <AmountCard
              totalBalance={widget.totalBalance!}
              amount={widget.inputs.amount ?? ""}
              onAmountChange={handleAmountChange}
              selectedTokenAmount={amountScreenBalance}
              maxSwapInput={maxSwapInput}
              onErrorStateChange={handleErrorStateChange}
              totalSelectedBalance={amountScreenBalance}
              destinationConfig={widget.destination}
            />
          )}

          {widget.txError && widget.status === "error" && (
            <ErrorBanner message={widget.txError} />
          )}
          {!shouldShowEmptyState && (
            <div className="flex flex-col">
              <PayUsing
                onClick={() => widget.goToStep("asset-selection")}
                selectedChainIds={widget.assetSelection.selectedChainIds}
                filter={widget.assetSelection.filter}
                isManualSelection={widget.isManualSelection}
                amount={widget.inputs.amount}
                swapBalance={widget.swapBalance}
                destination={widget.destination}
              />
              <Button
                className="rounded-t-none"
                onClick={() => widget.goToStep("confirmation")}
                disabled={
                  widget.isProcessing ||
                  hasAmountError ||
                  !widget.inputs.amount ||
                  widget.inputs.amount === "0"
                }
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </>
  );
};

export default AmountContainer;
