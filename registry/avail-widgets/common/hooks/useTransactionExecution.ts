import {
  type NexusClient,
  type OnAllowanceHookData,
  type OnIntentHookData,
} from "@avail-project/nexus-core";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";
import { type TransactionStatus } from "../tx/types";
import {
  type SourceSelectionValidation,
  type TransactionFlowEvent,
  type TransactionFlowExecutor,
  type TransactionFlowInputs,
  type BridgeStepType,
} from "../types/transaction-flow";

interface NexusErrorInfo {
  code: string;
  message: string;
  context?: unknown;
  details?: unknown;
}

type NexusErrorHandler = (error: unknown) => NexusErrorInfo;

interface UseTransactionExecutionProps {
  operationName: "bridge" | "transfer";
  nexusSDK: NexusClient | null;
  intent: RefObject<OnIntentHookData | null>;
  allowance: RefObject<OnAllowanceHookData | null>;
  inputs: TransactionFlowInputs;
  configuredMaxAmount?: string;
  allAvailableSourceChainIds: number[];
  sourceChainsForSdk?: number[];
  sourceSelectionKey: string;
  sourceSelection: SourceSelectionValidation;
  loading: boolean;
  txError: string | null;
  areInputsValid: boolean;
  executeTransaction: TransactionFlowExecutor;
  getMaxForCurrentSelection: () => Promise<string | undefined>;
  onStepsList: (steps: BridgeStepType[]) => void;
  onStepComplete: (step: BridgeStepType) => void;
  resetSteps: () => void;
  setStatus: (status: TransactionStatus) => void;
  resetInputs: () => void;
  setRefreshing: Dispatch<SetStateAction<boolean>>;
  setIsDialogOpen: Dispatch<SetStateAction<boolean>>;
  setTxError: Dispatch<SetStateAction<string | null>>;
  setLastExplorerUrl: Dispatch<SetStateAction<string>>;
  setSelectedSourceChains: Dispatch<SetStateAction<number[] | null>>;
  setAppliedSourceSelectionKey: Dispatch<SetStateAction<string>>;
  stopwatch: {
    start: () => void;
    stop: () => void;
    reset: () => void;
  };
  handleNexusError: NexusErrorHandler;
  onStart?: () => void;
  onComplete?: (explorerUrl?: string) => void;
  onError?: (message: string) => void;
  fetchBalance: () => Promise<void>;
  notifyHistoryRefresh?: () => void;
}

export function useTransactionExecution({
  operationName,
  nexusSDK,
  intent,
  allowance,
  inputs,
  configuredMaxAmount,
  allAvailableSourceChainIds,
  sourceChainsForSdk,
  sourceSelectionKey,
  sourceSelection,
  loading,
  txError,
  areInputsValid,
  executeTransaction,
  getMaxForCurrentSelection,
  onStepsList,
  onStepComplete,
  resetSteps,
  setStatus,
  resetInputs,
  setRefreshing,
  setIsDialogOpen,
  setTxError,
  setLastExplorerUrl,
  setSelectedSourceChains,
  setAppliedSourceSelectionKey,
  stopwatch,
  handleNexusError,
  onStart,
  onComplete,
  onError,
  fetchBalance,
  notifyHistoryRefresh,
}: UseTransactionExecutionProps) {
  const commitLockRef = useRef(false);
  const runIdRef = useRef(0);

  const refreshIntent = async (options?: { reportError?: boolean }) => {
    if (!intent.current) return false;
    const activeRunId = runIdRef.current;
    setRefreshing(true);
    try {
      const updated = await intent.current.refresh(sourceChainsForSdk);
      if (activeRunId !== runIdRef.current) return false;
      if (updated) {
        intent.current.intent = updated;
      }
      setAppliedSourceSelectionKey(sourceSelectionKey);
      return true;
    } catch (error) {
      if (activeRunId !== runIdRef.current) return false;
      console.error("Transaction failed:", error);
      if (options?.reportError) {
        const message = "Unable to refresh source selection. Please try again.";
        setTxError(message);
        onError?.(message);
      }
      return false;
    } finally {
      if (activeRunId === runIdRef.current) {
        setRefreshing(false);
      }
    }
  };

  const onSuccess = async (explorerUrl?: string) => {
    stopwatch.stop();
    setStatus("success");
    onComplete?.(explorerUrl);
    intent.current = null;
    allowance.current = null;
    resetInputs();
    setRefreshing(false);
    setSelectedSourceChains(null);
    setAppliedSourceSelectionKey("ALL");
    await fetchBalance();
    notifyHistoryRefresh?.();
  };

  const handleTransaction = async () => {
    if (commitLockRef.current) return;
    commitLockRef.current = true;
    const currentRunId = ++runIdRef.current;
    let didEnterExecutingState = false;
    const cleanupSupersededExecution = () => {
      if (!didEnterExecutingState) return;
      setRefreshing(false);
      setIsDialogOpen(false);
      setLastExplorerUrl("");
      stopwatch.stop();
      stopwatch.reset();
      resetSteps();
      setStatus("idle");
    };

    try {
      if (
        !inputs?.amount ||
        !inputs?.recipient ||
        !inputs?.chain ||
        !inputs?.token
      ) {
        console.error("Missing required inputs");
        return;
      }
      if (!nexusSDK) {
        const message = "Nexus SDK not initialized";
        setTxError(message);
        onError?.(message);
        return;
      }
      if (allAvailableSourceChainIds.length === 0) {
        const message =
          "No eligible source chains available for the selected token and destination.";
        setTxError(message);
        onError?.(message);
        setStatus("error");
        return;
      }

      const parsedAmount = Number(inputs.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        const message = "Enter a valid amount greater than 0.";
        setTxError(message);
        onError?.(message);
        setStatus("error");
        return;
      }

      const amountBigInt = nexusSDK.convertTokenReadableAmountToBigInt(
        inputs.amount,
        inputs.token,
        inputs.chain,
      );

      if (configuredMaxAmount) {
        const configuredMaxRaw = nexusSDK.convertTokenReadableAmountToBigInt(
          configuredMaxAmount,
          inputs.token,
          inputs.chain,
        );
        if (amountBigInt > configuredMaxRaw) {
          const message = `Amount exceeds maximum limit of ${configuredMaxAmount} ${inputs.token}.`;
          setTxError(message);
          onError?.(message);
          setStatus("error");
          return;
        }
      }

      const maxForCurrentSelection = await getMaxForCurrentSelection();
      if (currentRunId !== runIdRef.current) return;
      if (!maxForCurrentSelection) {
        const message = `Unable to determine max ${operationName} amount for selected sources. Please try again.`;
        setTxError(message);
        onError?.(message);
        setStatus("error");
        return;
      }
      const maxForSelectionRaw = nexusSDK.convertTokenReadableAmountToBigInt(
        maxForCurrentSelection,
        inputs.token,
        inputs.chain,
      );
      if (amountBigInt > maxForSelectionRaw) {
        const message = `Selected sources can provide up to ${maxForCurrentSelection} ${inputs.token}. Reduce amount or enable more sources.`;
        setTxError(message);
        onError?.(message);
        setStatus("error");
        return;
      }

      setStatus("executing");
      didEnterExecutingState = true;
      setTxError(null);
      onStart?.();
      setLastExplorerUrl("");
      setAppliedSourceSelectionKey(sourceSelectionKey);

      const onEvent = (event: TransactionFlowEvent) => {
        if (currentRunId !== runIdRef.current) return;
        if (event.type === "plan_preview" || event.type === "plan_confirmed") {
          const steps = event.plan.steps.map((step) => ({
            ...step,
            type: step.type.toUpperCase(),
            typeID: step.type.toUpperCase(),
            completed: false,
          }));
          onStepsList(steps);
        }
        if (event.type === "plan_progress") {
          if (
            event.stepType === "request_signing" &&
            event.state === "completed"
          ) {
            stopwatch.start();
          }
          const completed =
            event.state === "completed" ||
            event.state === "confirmed" ||
            event.state === "submitted";
          if (completed) {
            onStepComplete({
              ...event.step,
              type: event.stepType.toUpperCase(),
              typeID: event.stepType.toUpperCase(),
              completed: true,
            });
          }
        }
      };

      const transactionResult = await executeTransaction({
        token: inputs.token,
        amount: amountBigInt,
        toChainId: inputs.chain,
        recipient: inputs.recipient,
        sourceChains: sourceChainsForSdk,
        onEvent,
      });

      if (currentRunId !== runIdRef.current) {
        cleanupSupersededExecution();
        return;
      }
      if (!transactionResult) {
        throw new Error("Transaction rejected by user");
      }
      setLastExplorerUrl(transactionResult.explorerUrl);
      await onSuccess(transactionResult.explorerUrl);
    } catch (error) {
      if (currentRunId !== runIdRef.current) {
        cleanupSupersededExecution();
        return;
      }
      const { message, code, context, details } = handleNexusError(error);
      console.error(`Fast ${operationName} transaction failed:`, {
        code,
        message,
        context,
        details,
      });
      intent.current?.deny();
      intent.current = null;
      allowance.current = null;
      setTxError(message);
      onError?.(message);
      setIsDialogOpen(false);
      setSelectedSourceChains(null);
      setRefreshing(false);
      stopwatch.stop();
      stopwatch.reset();
      resetSteps();
      void fetchBalance();
      setStatus("error");
    } finally {
      commitLockRef.current = false;
    }
  };

  const reset = () => {
    runIdRef.current += 1;
    intent.current?.deny();
    intent.current = null;
    allowance.current = null;
    resetInputs();
    setStatus("idle");
    setRefreshing(false);
    setSelectedSourceChains(null);
    setAppliedSourceSelectionKey("ALL");
    setLastExplorerUrl("");
    stopwatch.stop();
    stopwatch.reset();
    resetSteps();
  };

  const startTransaction = () => {
    if (!intent.current) return;
    if (allAvailableSourceChainIds.length === 0) {
      const message =
        "No eligible source chains available for the selected token and destination.";
      setTxError(message);
      onError?.(message);
      return;
    }
    if (sourceSelection.isBelowRequired && inputs?.token) {
      const message = `Selected sources are not enough. Add ${sourceSelection.missingToProceed} ${inputs.token} more to make this transaction.`;
      setTxError(message);
      onError?.(message);
      return;
    }
    void (async () => {
      const refreshed = await refreshIntent({ reportError: true });
      if (!refreshed || !intent.current) return;
      intent.current.allow();
      setIsDialogOpen(true);
      setTxError(null);
    })();
  };

  const commitAmount = async () => {
    if (intent.current || loading || txError || !areInputsValid) return;
    await handleTransaction();
  };

  const invalidatePendingExecution = useCallback(() => {
    runIdRef.current += 1;
    if (intent.current) {
      intent.current.deny();
      intent.current = null;
    }
    setRefreshing(false);
    setAppliedSourceSelectionKey("ALL");
  }, [intent, setAppliedSourceSelectionKey, setRefreshing]);

  return {
    refreshIntent,
    handleTransaction,
    startTransaction,
    commitAmount,
    reset,
    invalidatePendingExecution,
  };
}
