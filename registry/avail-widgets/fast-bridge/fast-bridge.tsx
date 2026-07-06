"use client";
import { type FC, useEffect, useState } from "react";
import { Card, CardContent } from "../ui/card";
import ChainSelect from "./components/chain-select";
import TokenSelect from "./components/token-select";
import { Button } from "../ui/button";
import { LoaderPinwheel, X } from "lucide-react";
import { useNexus } from "../nexus/NexusProvider";
import AmountInput from "./components/amount-input";
import FeeBreakdown from "./components/fee-breakdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import TransactionProgress from "./components/transaction-progress";
import AllowanceModal from "./components/allowance-modal";
import useBridge from "./hooks/useBridge";
import SourceBreakdown from "./components/source-breakdown";
import { type Address } from "viem";
import { Skeleton } from "../ui/skeleton";
import RecipientAddress from "./components/recipient-address";
import ViewHistory from "../view-history/view-history";

interface FastBridgeProps {
  connectedAddress: Address;
  maxAmount?: string | number;
  prefill?: {
    token: string;
    chainId: number;
    amount?: string;
    recipient?: Address;
  };
  onComplete?: (explorerUrl?: string) => void;
  onStart?: () => void;
  onError?: (message: string) => void;
}

const FastBridge: FC<FastBridgeProps> = ({
  connectedAddress,
  maxAmount,
  onComplete,
  onStart,
  onError,
  prefill,
}) => {
  const handleComplete = (explorerUrl?: string) => {
    onComplete?.(explorerUrl);
  };

  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const {
    nexusSDK,
    intent,
    bridgableBalance,
    allowance,
    network,
    fetchBridgableBalance,
  } = useNexus();

  const {
    inputs,
    setInputs,
    timer,
    loading,
    refreshing,
    isDialogOpen,
    txError,
    setTxError,
    handleTransaction,
    reset,
    filteredBridgableBalance,
    startTransaction,
    setIsDialogOpen,
    commitAmount,
    lastExplorerUrl,
    steps,
    status,
    availableSources,
    selectedSourceChains,
    toggleSourceChain,
    isSourceSelectionInsufficient,
    isSourceSelectionReadyForAccept,
    sourceCoverageState,
    sourceCoveragePercent,
    missingToProceed,
    missingToSafety,
    selectedTotal,
    requiredTotal,
    requiredSafetyTotal,
    maxAvailableAmount,
    isInputsValid,
  } = useBridge({
    prefill,
    network: network ?? "mainnet",
    connectedAddress,
    nexusSDK,
    intent,
    bridgableBalance,
    allowance,
    onComplete: handleComplete,
    onStart,
    onError,
    fetchBalance: fetchBridgableBalance,
    maxAmount,
    isSourceMenuOpen,
  });

  useEffect(() => {
    if (!intent.current?.intent) {
      setIsSourceMenuOpen(false);
    }
  }, [intent.current?.intent]);

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="flex flex-col gap-y-4 w-full px-2 sm:px-6 relative">
        <ViewHistory className="absolute -top-2 right-3" />
        <ChainSelect
          selectedChain={inputs?.chain}
          handleSelect={(chain) =>
            setInputs({
              ...inputs,
              chain,
            })
          }
          label="To"
          disabled={!!prefill?.chainId}
        />
        <TokenSelect
          selectedChain={inputs?.chain}
          selectedToken={inputs?.token}
          handleTokenSelect={(token) => setInputs({ ...inputs, token })}
          disabled={!!prefill?.token}
        />
        <AmountInput
          amount={inputs?.amount}
          onChange={(amount) => setInputs({ ...inputs, amount })}
          bridgableBalance={filteredBridgableBalance}
          onCommit={() => void commitAmount()}
          disabled={refreshing || !!prefill?.amount}
          inputs={inputs}
          maxAmount={maxAmount}
          maxAvailableAmount={maxAvailableAmount}
        />
        <RecipientAddress
          address={inputs?.recipient}
          onChange={(address) =>
            setInputs({ ...inputs, recipient: address as `0x${string}` })
          }
          disabled={!!prefill?.recipient}
        />
        {intent?.current?.intent && (
          <>
            <SourceBreakdown
              intent={intent?.current?.intent}
              tokenSymbol={filteredBridgableBalance?.symbol as string}
              isLoading={refreshing}
              availableSources={availableSources}
              selectedSourceChains={selectedSourceChains}
              onToggleSourceChain={toggleSourceChain}
              onSourceMenuOpenChange={setIsSourceMenuOpen}
              isSourceSelectionInsufficient={isSourceSelectionInsufficient}
              sourceCoverageState={sourceCoverageState}
              sourceCoveragePercent={sourceCoveragePercent}
              missingToProceed={missingToProceed}
              missingToSafety={missingToSafety}
              selectedTotal={selectedTotal}
              requiredTotal={requiredTotal}
              requiredSafetyTotal={requiredSafetyTotal}
            />

            <div className="w-full flex items-start justify-between gap-x-4">
              <p className="text-base font-light">You receive</p>
              <div className="flex flex-col gap-y-1 min-w-fit">
                {refreshing ? (
                  <Skeleton className="h-5 w-28" />
                ) : (
                  <p className="text-base font-light text-right">
                    {`${
                      connectedAddress === inputs?.recipient
                        ? intent?.current?.intent?.destination?.amount
                        : inputs.amount
                    } ${inputs?.token === "USDM" ? "USDM" : filteredBridgableBalance?.symbol}`}
                  </p>
                )}
                {refreshing ? (
                  <Skeleton className="h-4 w-36" />
                ) : (
                  <p className="text-sm font-light text-right">
                    on {intent?.current?.intent?.destination?.chain?.name}
                  </p>
                )}
              </div>
            </div>
            <FeeBreakdown
              intent={intent?.current?.intent}
              isLoading={refreshing}
              tokenSymbol={filteredBridgableBalance?.symbol as string}
            />
          </>
        )}

        {!intent.current && (
          <Button
            onClick={handleTransaction}
            disabled={!isInputsValid || loading}
          >
            {loading ? (
              <LoaderPinwheel className="animate-spin size-5" />
            ) : (
              "Bridge"
            )}
          </Button>
        )}

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (loading) return;
            setIsDialogOpen(open);
          }}
        >
          {intent.current && !isDialogOpen && (
            <div className="w-full flex items-center gap-x-2 justify-between">
              <Button variant={"destructive"} onClick={reset} className="w-1/2">
                Deny
              </Button>
              <DialogTrigger asChild>
                <Button
                  onClick={startTransaction}
                  className="w-1/2"
                  disabled={refreshing || !isSourceSelectionReadyForAccept}
                >
                  {refreshing ? "Refreshing..." : "Accept"}
                </Button>
              </DialogTrigger>
            </div>
          )}

          <DialogContent>
            <DialogHeader className="sr-only">
              <DialogTitle>Transaction Progress</DialogTitle>
            </DialogHeader>
            {allowance.current ? (
              <AllowanceModal
                allowance={allowance}
                callback={startTransaction}
                onCloseCallback={reset}
                onError={setTxError}
              />
            ) : (
              <TransactionProgress
                timer={timer}
                steps={steps}
                viewIntentUrl={lastExplorerUrl}
                operationType={"bridge"}
                completed={status === "success"}
              />
            )}
          </DialogContent>
        </Dialog>

        {txError && (
          <div className="rounded-md border border-destructive bg-destructive/80 px-3 py-2 text-sm text-destructive-foreground flex items-start justify-between gap-x-3 mt-3 w-full">
            <span className="flex-1 w-full truncate">{txError}</span>
            <Button
              type="button"
              size={"icon"}
              variant={"ghost"}
              onClick={() => {
                reset();
                setTxError(null);
              }}
              className="text-destructive-foreground/80 hover:text-destructive-foreground focus:outline-none"
              aria-label="Dismiss error"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FastBridge;
