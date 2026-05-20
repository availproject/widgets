"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  WidgetStep,
  DepositWidgetContextValue,
  DepositInputs,
  DestinationConfig,
} from "../types";
import {
  ERROR_CODES,
  NEXUS_EVENTS,
  CHAIN_METADATA,
  type SwapStepType,
  type ExecuteParams,
  type OnSwapIntentHookData,
  type SwapAndExecuteParams,
  type SwapAndExecuteResult,
  parseUnits,
} from "@avail-project/nexus-core";
import {
  SWAP_EXPECTED_STEPS,
  useNexusError,
  usePolling,
  useStopwatch,
  useTransactionSteps,
} from "../../common";
import { type Address, type Hex, formatEther } from "viem";
import { useAccount } from "wagmi";
import { useNexus } from "../../nexus/NexusProvider";
import {
  MIN_SELECTABLE_SOURCE_BALANCE_USD,
  SIMULATION_POLL_INTERVAL_MS,
} from "../constants/widget";
import { TokenPricingError } from "../../common/utils/token-pricing";

// Import extracted hooks
import {
  useDepositState,
  STEP_HISTORY,
  type SwapSkippedData,
} from "./use-deposit-state";
import { useAssetSelection } from "./use-asset-selection";
import { useDepositComputed } from "./use-deposit-computed";
import { resolveDepositSourceSelection } from "../utils";

interface UseDepositProps {
  executeDeposit: (
    tokenSymbol: string,
    tokenAddress: `0x${string}`,
    amount: bigint,
    chainId: number,
    user: Address,
  ) => Omit<ExecuteParams, "toChainId">;
  destination: DestinationConfig;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

function parseUsdAmount(value?: string): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function summarizeIntentSources(
  intentSources: OnSwapIntentHookData["intent"]["sources"] | undefined,
) {
  return (intentSources ?? []).map((source) => ({
    chainId: source.chain.id,
    chainName: source.chain.name,
    tokenAddress: source.token.contractAddress,
    tokenSymbol: source.token.symbol,
    amount: source.amount,
  }));
}

/**
 * Main deposit widget hook that orchestrates state, SDK integration,
 * and computed values via smaller focused hooks.
 */
export function useDepositWidget(
  props: UseDepositProps,
): DepositWidgetContextValue {
  const { executeDeposit, destination, onSuccess, onError } = props;

  // External dependencies
  const {
    nexusSDK,
    swapIntent,
    swapBalance,
    fetchSwapBalance,
    getFiatValue,
    exchangeRate,
    resolveTokenUsdRate,
  } = useNexus();
  const { address } = useAccount();
  const handleNexusError = useNexusError();

  // Core state management
  const { state, dispatch } = useDepositState();
  const [pollingEnabled, setPollingEnabled] = useState(false);

  // Asset selection state
  const {
    assetSelection,
    isManualSelection,
    setAssetSelection,
    resetAssetSelection,
  } = useAssetSelection(swapBalance, destination, state.inputs.amount);

  // Refs for tracking
  const hasAutoSelected = useRef(false);
  const initialSimulationDone = useRef(false);
  const determiningSwapComplete = useRef(false);
  const lastSimulationTime = useRef(0);
  const suppressNextWidgetPreviewCancelError = useRef(false);

  const denyActiveSwapIntent = useCallback(
    (options?: { suppressUiError?: boolean }) => {
      const activeSwapIntent =
        swapIntent.current ?? state.simulation?.swapIntent;

      if (options?.suppressUiError && activeSwapIntent) {
        suppressNextWidgetPreviewCancelError.current = true;
      }

      if (!activeSwapIntent) {
        return;
      }

      try {
        activeSwapIntent.deny();
      } catch (error) {
        suppressNextWidgetPreviewCancelError.current = false;
        console.error("Failed to deny active swap intent", error);
      } finally {
        swapIntent.current = null;
      }
    },
    [swapIntent, state.simulation],
  );

  // Transaction steps tracking
  const {
    seed,
    onStepComplete,
    reset: resetSteps,
    steps,
  } = useTransactionSteps<SwapStepType>();

  // Stopwatch for timing
  const stopwatch = useStopwatch({
    running:
      state.status === "executing" ||
      (state.status === "previewing" && determiningSwapComplete.current),
    intervalMs: 100,
  });

  // Derived state
  const isProcessing = state.status === "executing";
  const isSuccess = state.status === "success";
  const isError = state.status === "error";
  const activeIntent = state.simulation?.swapIntent ?? swapIntent.current;

  // Computed values
  const {
    availableAssets,
    totalSelectedBalance,
    totalBalance,
    confirmationDetails,
    feeBreakdown,
  } = useDepositComputed({
    swapBalance,
    assetSelection,
    activeIntent,
    destination,
    inputAmount: state.inputs.amount,
    exchangeRate,
    getFiatValue,
    actualGasFeeUsd: state.actualGasFeeUsd,
    swapSkippedData: state.swapSkippedData,
    skipSwap: state.skipSwap,
    nexusSDK,
  });

  // Action callbacks
  const setInputs = useCallback(
    (next: Partial<DepositInputs>) => {
      dispatch({ type: "setInputs", payload: next });
    },
    [dispatch],
  );

  const setTxError = useCallback(
    (error: string | null) => {
      dispatch({ type: "setError", payload: error });
    },
    [dispatch],
  );

  /**
   * Start the swap and execute flow with the SDK
   */
  const start = useCallback(
    (inputs: SwapAndExecuteParams, targetAmountUsd?: number) => {
      if (!nexusSDK || !inputs || isProcessing) return;

      seed(SWAP_EXPECTED_STEPS);
      const requiredAmountUsd =
        targetAmountUsd ?? parseUsdAmount(state.inputs.amount);
      const { sourcePoolIds, selectedSourceIds, fromSources } =
        resolveDepositSourceSelection({
          swapBalance,
          destination,
          filter: assetSelection.filter,
          selectedSourceIds: assetSelection.selectedChainIds,
          isManualSelection,
          minimumBalanceUsd: MIN_SELECTABLE_SOURCE_BALANCE_USD,
          targetAmountUsd: requiredAmountUsd,
        });

      if (fromSources.length === 0) {
        const message =
          "No eligible source balances found. A minimum source balance of $1.00 is required.";
        dispatch({ type: "setError", payload: message });
        dispatch({ type: "setStatus", payload: "error" });
        onError?.(message);
        return;
      }

      const inputsWithSources = {
        ...inputs,
        fromSources,
      };
      nexusSDK
        .swapAndExecute(inputsWithSources, {
          onEvent: (event) => {
            if (event.name === NEXUS_EVENTS.SWAP_STEP_COMPLETE) {
              const step = event.args as SwapStepType & {
                completed?: boolean;
                data?: SwapSkippedData;
              };

              // Handle SWAP_SKIPPED - go directly to transaction-status
              if (step?.type === "SWAP_SKIPPED") {
                dispatch({ type: "setSkipSwap", payload: true });
                dispatch({
                  type: "setSwapSkippedData",
                  payload: step.data ?? null,
                });
                dispatch({ type: "setStatus", payload: "executing" });
                dispatch({
                  type: "setStep",
                  payload: { step: "transaction-status", direction: "forward" },
                });
                stopwatch.start();
              }

              if (step?.type === "DETERMINING_SWAP" && step?.completed) {
                determiningSwapComplete.current = true;
                stopwatch.start();
                dispatch({ type: "setIntentReady", payload: true });
              }
              onStepComplete(step);
            }
          },
        })
        .then((data: SwapAndExecuteResult) => {
          suppressNextWidgetPreviewCancelError.current = false;

          // Extract source swaps from the result
          const sourceSwapsFromResult = data.swapResult?.sourceSwaps ?? [];
          sourceSwapsFromResult.forEach((sourceSwap) => {
            const chainMeta =
              CHAIN_METADATA[sourceSwap.chainId as keyof typeof CHAIN_METADATA];
            const baseUrl = chainMeta?.blockExplorerUrls?.[0] ?? "";
            const explorerUrl = baseUrl
              ? `${baseUrl}/tx/${sourceSwap.txHash}`
              : "";
            dispatch({
              type: "addSourceSwap",
              payload: {
                chainId: sourceSwap.chainId,
                chainName: chainMeta?.name ?? `Chain ${sourceSwap.chainId}`,
                explorerUrl,
              },
            });
          });

          // Set explorer URLs from the result
          if (sourceSwapsFromResult.length > 0) {
            const firstSourceSwap = sourceSwapsFromResult[0];
            const chainMeta =
              CHAIN_METADATA[
              firstSourceSwap.chainId as keyof typeof CHAIN_METADATA
              ];
            const baseUrl = chainMeta?.blockExplorerUrls?.[0] ?? "";
            const sourceExplorerUrl = baseUrl
              ? `${baseUrl}/tx/${firstSourceSwap.txHash}`
              : "";
            dispatch({
              type: "setExplorerUrls",
              payload: { sourceExplorerUrl },
            });
          }

          // Destination explorer URL
          const destChainMeta =
            CHAIN_METADATA[destination.chainId as keyof typeof CHAIN_METADATA];
          const destBaseUrl = destChainMeta?.blockExplorerUrls?.[0] ?? "";
          const destinationExplorerUrl =
            data.swapResult?.explorerURL ??
            (data.executeResponse?.txHash && destBaseUrl
              ? `${destBaseUrl}/tx/${data.executeResponse.txHash}`
              : null);

          if (destinationExplorerUrl) {
            dispatch({
              type: "setExplorerUrls",
              payload: { destinationExplorerUrl },
            });
          }

          // Store Nexus intent URL and deposit tx hash
          dispatch({
            type: "setNexusIntentUrl",
            payload: data.swapResult?.explorerURL ?? null,
          });
          dispatch({
            type: "setDepositTxHash",
            payload: data.executeResponse?.txHash ?? null,
          });

          // Calculate actual gas fee from receipt
          const receipt = data.executeResponse?.receipt;
          if (receipt?.gasUsed && receipt?.effectiveGasPrice) {
            const gasUsed = BigInt(receipt.gasUsed);
            const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
            const gasCostWei = gasUsed * effectiveGasPrice;
            const gasCostNative = parseFloat(formatEther(gasCostWei));
            const gasTokenSymbol = destination.gasTokenSymbol ?? "ETH";
            const gasCostUsd = getFiatValue(gasCostNative, gasTokenSymbol);
            dispatch({
              type: "setActualGasFeeUsd",
              payload: gasCostUsd,
            });
          }

          dispatch({
            type: "setReceiveAmount",
            payload: swapIntent.current?.intent?.destination?.amount ?? "",
          });
          onSuccess?.();
          dispatch({ type: "setStatus", payload: "success" });
          dispatch({
            type: "setStep",
            payload: { step: "transaction-complete", direction: "forward" },
          });
        })
        .catch((error) => {
          console.log("ERROR IN SWAP AND EXECUTE", error)
          const { code, message } = handleNexusError(error);
          const isUserRejectedError =
            code === ERROR_CODES.USER_DENIED_INTENT ||
            code === ERROR_CODES.USER_DENIED_INTENT_SIGNATURE ||
            code === ERROR_CODES.USER_DENIED_ALLOWANCE ||
            code === ERROR_CODES.USER_DENIED_SIWE_SIGNATURE;
          const shouldSuppressWidgetError =
            suppressNextWidgetPreviewCancelError.current && isUserRejectedError;

          suppressNextWidgetPreviewCancelError.current = false;

          if (shouldSuppressWidgetError) {
            onError?.(message);
            return;
          }

          dispatch({ type: "setError", payload: message });
          dispatch({ type: "setStatus", payload: "error" });

          if (initialSimulationDone.current) {
            dispatch({
              type: "setStep",
              payload: { step: "transaction-failed", direction: "forward" },
            });
          } else {
            dispatch({
              type: "setStep",
              payload: { step: "amount", direction: "backward" },
            });
          }
          onError?.(message);
        })
        .finally(async () => {
          await fetchSwapBalance();
        });
    },
    [
      nexusSDK,
      isProcessing,
      seed,
      onStepComplete,
      swapIntent,
      onSuccess,
      onError,
      handleNexusError,
      assetSelection.selectedChainIds,
      assetSelection.filter,
      isManualSelection,
      swapBalance,
      destination,
      getFiatValue,
      fetchSwapBalance,
      dispatch,
      stopwatch,
      state.inputs.amount,
    ],
  );

  /**
   * Handle amount input continue - starts simulation
   */
  const beginAmountSimulation = useCallback(
    async (totalAmountUsd: number) => {
      if (!nexusSDK) {
        dispatch({
          type: "setError",
          payload: "Nexus SDK is not initialized.",
        });
        dispatch({ type: "setStatus", payload: "error" });
        return false;
      }
      if (!address) {
        dispatch({
          type: "setError",
          payload: "Connect your wallet to continue.",
        });
        dispatch({ type: "setStatus", payload: "error" });
        return false;
      }
      let destinationRate: number;
      try {
        destinationRate = (await resolveTokenUsdRate(
          destination.tokenSymbol,
        )) || 0;
      } catch (error) {
        const message =
          error instanceof TokenPricingError
            ? error.message
            : "Price failure: Cannot value this token at the moment";
        dispatch({ type: "setError", payload: message });
        dispatch({ type: "setStatus", payload: "error" });
        onError?.(message);
        return false;
      }

      // Reset state and refs for a fresh simulation
      dispatch({ type: "setError", payload: null });
      dispatch({ type: "setIntentReady", payload: false });
      initialSimulationDone.current = false;
      determiningSwapComplete.current = false;
      denyActiveSwapIntent();

      const tokenAmount = destinationRate > 0 ? totalAmountUsd / destinationRate : totalAmountUsd;
      const tokenAmountStr = tokenAmount.toFixed(destination.tokenDecimals);
      const parsed = parseUnits(tokenAmountStr, destination.tokenDecimals);

      const executeParams = executeDeposit(
        destination.tokenSymbol,
        destination.tokenAddress,
        parsed,
        destination.chainId,
        address,
      );

      const newInputs: SwapAndExecuteParams = {
        toChainId: destination.chainId,
        toTokenAddress: destination.tokenAddress,
        toAmount: parsed,
        execute: {
          to: executeParams.to,
          value: executeParams.value,
          data: executeParams.data,
          gasPrice: executeParams.gasPrice,
          tokenApproval: executeParams.tokenApproval as {
            token: `0x${string}`;
            amount: bigint;
            spender: Hex;
          },
          gas: BigInt(400_000),
        },
      };

      dispatch({
        type: "setInputs",
        payload: { amount: totalAmountUsd.toString() },
      });
      dispatch({ type: "setStatus", payload: "simulation-loading" });
      dispatch({ type: "setSimulationLoading", payload: true });
      start(newInputs, totalAmountUsd);
      return true;
    },
    [
      nexusSDK,
      address,
      resolveTokenUsdRate,
      destination,
      executeDeposit,
      start,
      denyActiveSwapIntent,
      dispatch,
      onError,
    ],
  );

  const handleAmountContinue = useCallback(
    (totalAmountUsd: number) => {
      void beginAmountSimulation(totalAmountUsd);
    },
    [beginAmountSimulation],
  );

  /**
   * Handle order confirmation - allow intent to execute
   */
  const handleConfirmOrder = useCallback(() => {
    if (!activeIntent) return;
    dispatch({ type: "setStatus", payload: "executing" });
    dispatch({
      type: "setStep",
      payload: { step: "transaction-status", direction: "forward" },
    });
    activeIntent.allow();
  }, [activeIntent, dispatch]);

  /**
   * Navigate to a specific step
   */
  const goToStep = useCallback(
    (newStep: WidgetStep) => {
      if (state.step === "amount" && newStep === "confirmation") {
        const amount = state.inputs.amount;
        if (amount) {
          const totalAmountUsd = parseFloat(amount.replace(/,/g, ""));
          if (totalAmountUsd > 0) {
            void (async () => {
              const started = await beginAmountSimulation(totalAmountUsd);
              if (!started) return;
              dispatch({
                type: "setStep",
                payload: { step: newStep, direction: "forward" },
              });
            })();
            return;
          }
        }
      }
      dispatch({
        type: "setStep",
        payload: { step: newStep, direction: "forward" },
      });
    },
    [state.step, state.inputs.amount, beginAmountSimulation, dispatch],
  );

  /**
   * Navigate back to previous step
   */
  const goBack = useCallback(async () => {
    const previousStep = STEP_HISTORY[state.step];
    if (previousStep) {
      const suppressUiError = state.step === "confirmation" && !isProcessing;
      dispatch({ type: "setError", payload: null });
      dispatch({
        type: "setStep",
        payload: { step: previousStep, direction: "backward" },
      });
      denyActiveSwapIntent({ suppressUiError });
      initialSimulationDone.current = false;
      lastSimulationTime.current = 0;
      setPollingEnabled(false);
      stopwatch.stop();
      stopwatch.reset();
      await fetchSwapBalance();
    }
  }, [
    state.step,
    isProcessing,
    stopwatch,
    dispatch,
    denyActiveSwapIntent,
    fetchSwapBalance,
  ]);

  /**
   * Reset widget to initial state
   */
  const reset = useCallback(async () => {
    const suppressUiError = state.step === "confirmation" && !isProcessing;
    dispatch({ type: "reset" });
    resetAssetSelection();
    resetSteps();
    denyActiveSwapIntent({ suppressUiError });
    initialSimulationDone.current = false;
    lastSimulationTime.current = 0;
    setPollingEnabled(false);
    stopwatch.stop();
    stopwatch.reset();
    await fetchSwapBalance();
  }, [
    resetSteps,
    stopwatch,
    dispatch,
    resetAssetSelection,
    denyActiveSwapIntent,
    fetchSwapBalance,
    state.step,
    isProcessing,
  ]);

  /**
   * Refresh simulation data
   */
  const refreshSimulation = useCallback(async () => {
    const timeSinceLastSimulation = Date.now() - lastSimulationTime.current;
    if (timeSinceLastSimulation < 5000) {
      return;
    }

    try {
      dispatch({ type: "setSimulationLoading", payload: true });
      const updated = await swapIntent.current?.refresh();
      if (updated) {
        swapIntent.current!.intent = updated;

        dispatch({
          type: "setSimulation",
          payload: {
            swapIntent: swapIntent.current!,
          },
        });
      }
    } catch (e) {
      console.error("Unable to refresh intent", e);
    } finally {
      dispatch({ type: "setSimulationLoading", payload: false });
      stopwatch.reset();
      lastSimulationTime.current = Date.now();
    }
  }, [stopwatch, swapIntent, dispatch]);

  const startTransaction = useCallback(() => {
    if (isProcessing) return;
    dispatch({ type: "setError", payload: null });
  }, [isProcessing, dispatch]);

  // Effect: Handle swap intent when it arrives
  useEffect(() => {
    if (!state.intentReady || initialSimulationDone.current) {
      return;
    }

    if (!swapIntent.current) {
      return;
    }

    initialSimulationDone.current = true;
    dispatch({
      type: "setSimulation",
      payload: { swapIntent: swapIntent.current! },
    });
    dispatch({ type: "setSimulationLoading", payload: false });
    dispatch({ type: "setStatus", payload: "previewing" });
    lastSimulationTime.current = Date.now();
    setPollingEnabled(true);
  }, [state.intentReady, swapIntent, dispatch]);

  // Effect: Fetch swap balance on mount
  useEffect(() => {
    if (!nexusSDK) return;

    if (!swapBalance) {
      void fetchSwapBalance();
      return;
    }

    if (!hasAutoSelected.current && availableAssets.length > 0) {
      hasAutoSelected.current = true;
    }
  }, [nexusSDK, swapBalance, availableAssets, fetchSwapBalance]);

  // Polling for simulation refresh
  usePolling(
    pollingEnabled &&
    state.status === "previewing" &&
    Boolean(swapIntent.current) &&
    !state.simulationLoading,
    async () => {
      await refreshSimulation();
    },
    SIMULATION_POLL_INTERVAL_MS,
  );

  // Return the full context value
  return {
    step: state.step,
    inputs: state.inputs,
    setInputs,
    status: state.status,
    explorerUrls: state.explorerUrls,
    sourceSwaps: state.sourceSwaps,
    nexusIntentUrl: state.nexusIntentUrl,
    depositTxHash: state.depositTxHash,
    destination,
    isProcessing,
    isSuccess,
    isError,
    txError: state.error,
    setTxError,
    goToStep,
    goBack,
    reset,
    navigationDirection: state.navigationDirection,
    startTransaction,
    lastResult: state.lastResult,
    assetSelection,
    isManualSelection,
    setAssetSelection,
    swapBalance,
    activeIntent,
    confirmationDetails,
    feeBreakdown,
    steps,
    timer: stopwatch.seconds,
    handleConfirmOrder,
    handleAmountContinue,
    totalSelectedBalance,
    skipSwap: state.skipSwap,
    simulationLoading: state.simulationLoading,
    totalBalance,
  };
}
