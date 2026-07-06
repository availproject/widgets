import {
  type NexusNetwork,
  type NexusClient,
  type OnAllowanceHookData,
  type OnIntentHookData,
  type TokenBalance,
} from "@avail-project/nexus-core";
import {
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
  useReducer,
  type RefObject,
} from "react";
import { type Address, isAddress, parseUnits } from "viem";
import { CHAIN_METADATA } from "../utils/constant";
import { useNexusError } from "./useNexusError";
import { useTransactionExecution } from "./useTransactionExecution";
import { usePolling } from "./usePolling";
import { useStopwatch } from "./useStopwatch";
import { useDebouncedCallback } from "./useDebouncedCallback";
import { type TransactionStatus } from "../tx/types";
import { useTransactionSteps } from "../tx/useTransactionSteps";
import {
  type SourceCoverageState,
  type TransactionFlowExecutor,
  type TransactionFlowInputs,
  type TransactionFlowPrefill,
  type TransactionFlowType,
  type BridgeStepType,
} from "../types/transaction-flow";
import {
  MAX_AMOUNT_DEBOUNCE_MS,
  buildInitialInputs,
  clampAmountToMax,
  formatAmountForDisplay,
  getCoverageDecimals,
  normalizeMaxAmount,
} from "../utils/transaction-flow";

interface BaseTransactionFlowProps {
  type: TransactionFlowType;
  network: NexusNetwork;
  nexusSDK: NexusClient | null;
  intent: RefObject<OnIntentHookData | null>;
  allowance: RefObject<OnAllowanceHookData | null>;
  bridgableBalance: TokenBalance[] | null;
  prefill?: TransactionFlowPrefill;
  onComplete?: (explorerUrl?: string) => void;
  onStart?: () => void;
  onError?: (message: string) => void;
  fetchBalance: () => Promise<void>;
  maxAmount?: string | number;
  isSourceMenuOpen?: boolean;
  notifyHistoryRefresh?: () => void;
  executeTransaction: TransactionFlowExecutor;
}

export interface UseTransactionFlowProps extends BaseTransactionFlowProps {
  connectedAddress?: Address;
}

type State = {
  inputs: TransactionFlowInputs;
  status: TransactionStatus;
};

type Action =
  | { type: "setInputs"; payload: Partial<TransactionFlowInputs> }
  | { type: "resetInputs" }
  | { type: "setStatus"; payload: TransactionStatus };

export function useTransactionFlow(props: UseTransactionFlowProps) {
  const {
    type,
    network,
    nexusSDK,
    intent,
    bridgableBalance,
    prefill,
    onComplete,
    onStart,
    onError,
    fetchBalance,
    allowance,
    maxAmount,
    isSourceMenuOpen = false,
    notifyHistoryRefresh,
    executeTransaction,
  } = props;

  const connectedAddress = props.connectedAddress;
  const operationName = type === "bridge" ? "bridge" : "transfer";
  const handleNexusError = useNexusError();
  const initialState: State = {
    inputs: buildInitialInputs({ type, network, connectedAddress, prefill }),
    status: "idle",
  };

  function reducer(state: State, action: Action): State {
    switch (action.type) {
      case "setInputs":
        return { ...state, inputs: { ...state.inputs, ...action.payload } };
      case "resetInputs":
        return {
          ...state,
          inputs: buildInitialInputs({
            type,
            network,
            connectedAddress,
            prefill,
          }),
        };
      case "setStatus":
        return { ...state, status: action.payload };
      default:
        return state;
    }
  }

  const [state, dispatch] = useReducer(reducer, initialState);
  const inputs = state.inputs;
  const setInputs = (
    next: TransactionFlowInputs | Partial<TransactionFlowInputs>,
  ) => {
    dispatch({
      type: "setInputs",
      payload: next as Partial<TransactionFlowInputs>,
    });
  };

  const loading = state.status === "executing";
  const [refreshing, setRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [lastExplorerUrl, setLastExplorerUrl] = useState<string>("");
  const previousConnectedAddressRef = useRef<Address | undefined>(
    connectedAddress,
  );
  const maxAmountRequestIdRef = useRef(0);
  const [selectedSourceChains, setSelectedSourceChains] = useState<
    number[] | null
  >(null);
  const [selectedSourcesMaxAmount, setSelectedSourcesMaxAmount] = useState<
    string | null
  >(null);
  const [appliedSourceSelectionKey, setAppliedSourceSelectionKey] =
    useState("ALL");
  const {
    steps,
    onStepsList,
    onStepComplete,
    reset: resetSteps,
  } = useTransactionSteps<BridgeStepType>();
  const configuredMaxAmount = useMemo(
    () => normalizeMaxAmount(maxAmount),
    [maxAmount],
  );

  const areInputsValid = useMemo(() => {
    const hasToken = inputs?.token !== undefined && inputs?.token !== null;
    const hasChain = inputs?.chain !== undefined && inputs?.chain !== null;
    const hasAmount = Boolean(inputs?.amount) && Number(inputs?.amount) > 0;
    const hasValidRecipient =
      Boolean(inputs?.recipient) && isAddress(inputs.recipient as string);
    return hasToken && hasChain && hasAmount && hasValidRecipient;
  }, [inputs]);

  const filteredBridgableBalance = useMemo(() => {
    const found = bridgableBalance?.find((bal) =>
      inputs?.token === "USDM"
        ? bal?.symbol === "USDC"
        : bal?.symbol === inputs?.token,
    );
    if (!found) return undefined;
    const breakdown = (found as any).chainBalances?.map((cb: any) => ({
      balance: cb.balance,
      balanceInFiat: Number.parseFloat(cb.value),
      chain: cb.chain,
    })) ?? (found as any).breakdown ?? [];
    return {
      ...found,
      breakdown,
    };
  }, [bridgableBalance, inputs?.token]);

  const availableSources = useMemo(() => {
    const breakdown = filteredBridgableBalance?.breakdown ?? [];
    const destinationChainId = inputs?.chain;
    const nonZero = breakdown.filter((source: any) => {
      if (Number.parseFloat(source.balance ?? "0") <= 0) return false;
      if (typeof destinationChainId === "number") {
        return source.chain.id !== destinationChainId;
      }
      return true;
    });
    const decimals = filteredBridgableBalance?.decimals;
    if (!nexusSDK || typeof decimals !== "number") {
      return nonZero.sort(
        (a: any, b: any) => Number.parseFloat(b.balance) - Number.parseFloat(a.balance),
      );
    }
    return nonZero.sort((a: any, b: any) => {
      try {
        const aRaw = parseUnits(a.balance ?? "0", decimals);
        const bRaw = parseUnits(b.balance ?? "0", decimals);
        if (aRaw === bRaw) return 0;
        return aRaw > bRaw ? -1 : 1;
      } catch {
        return Number.parseFloat(b.balance) - Number.parseFloat(a.balance);
      }
    });
  }, [
    inputs?.chain,
    filteredBridgableBalance?.breakdown,
    filteredBridgableBalance?.decimals,
    nexusSDK,
  ]);

  const allAvailableSourceChainIds = useMemo(
    () => availableSources.map((source: any) => source.chain.id),
    [availableSources],
  );

  const effectiveSelectedSourceChains = useMemo(() => {
    if (selectedSourceChains && selectedSourceChains.length > 0) {
      const availableSet = new Set(allAvailableSourceChainIds);
      const filteredSelection = selectedSourceChains.filter((id) =>
        availableSet.has(id),
      );
      if (filteredSelection.length > 0) {
        return filteredSelection;
      }
    }
    return allAvailableSourceChainIds;
  }, [selectedSourceChains, allAvailableSourceChainIds]);

  const sourceChainsForSdk =
    effectiveSelectedSourceChains.length > 0
      ? effectiveSelectedSourceChains
      : undefined;

  const sourceSelectionKey = useMemo(() => {
    if (allAvailableSourceChainIds.length === 0) return "NONE";
    if (!selectedSourceChains || selectedSourceChains.length === 0) {
      return "ALL";
    }
    return [...effectiveSelectedSourceChains].sort((a, b) => a - b).join("|");
  }, [
    allAvailableSourceChainIds.length,
    effectiveSelectedSourceChains,
    selectedSourceChains,
  ]);
  const hasPendingSourceSelectionChanges =
    sourceSelectionKey !== appliedSourceSelectionKey;
  const intentSourceSpendAmount = intent.current?.intent?.sourcesTotal;

  const getMaxForCurrentSelection = useCallback(async () => {
    if (!nexusSDK || !inputs?.token || !inputs?.chain) return undefined;
    
    let totalMax = 0;
    const selectedChainSet = new Set(sourceChainsForSdk ?? allAvailableSourceChainIds);
    
    for (const source of availableSources) {
      if (!selectedChainSet.has(source.chain.id)) continue;
      const balVal = Number.parseFloat(source.balance ?? "0");
      if (balVal <= 0) continue;
      
      let chainMax = balVal;
      const chainMeta = CHAIN_METADATA[source.chain.id];
      const nativeSymbol = chainMeta?.nativeCurrency?.symbol;
      if (nativeSymbol && inputs.token === nativeSymbol) {
        chainMax = Math.max(0, chainMax - 0.003);
      }
      totalMax += chainMax;
    }
    
    const amountStr = totalMax.toString();
    return clampAmountToMax({
      amount: amountStr,
      maxAmount: configuredMaxAmount,
      nexusSDK,
      token: inputs.token,
      chainId: inputs.chain,
    });
  }, [
    configuredMaxAmount,
    inputs?.chain,
    inputs?.token,
    nexusSDK,
    sourceChainsForSdk,
    allAvailableSourceChainIds,
    availableSources,
  ]);

  const toggleSourceChain = useCallback(
    (chainId: number) => {
      setSelectedSourceChains((prev) => {
        if (allAvailableSourceChainIds.length === 0) return prev;
        const current =
          prev && prev.length > 0 ? prev : allAvailableSourceChainIds;
        const next = current.includes(chainId)
          ? current.filter((id: number) => id !== chainId)
          : [...current, chainId];
        if (next.length === 0) {
          return current;
        }
        const isAllSelected =
          next.length === allAvailableSourceChainIds.length &&
          allAvailableSourceChainIds.every((id: number) => next.includes(id));
        return isAllSelected ? null : next;
      });
    },
    [allAvailableSourceChainIds],
  );

  const sourceSelection = useMemo(() => {
    const amount =
      intentSourceSpendAmount?.trim() ?? inputs?.amount?.trim() ?? "";
    const decimals = getCoverageDecimals({
      type,
      token: inputs?.token,
      chainId: inputs?.chain,
      fallback: filteredBridgableBalance?.decimals,
    });
    const selectedChainSet = new Set(effectiveSelectedSourceChains);
    const selectedTotalRaw =
      !nexusSDK || typeof decimals !== "number"
        ? BigInt(0)
        : availableSources.reduce((sum: bigint, source: any) => {
            if (!selectedChainSet.has(source.chain.id)) return sum;
            try {
              return sum + parseUnits(source.balance ?? "0", decimals);
            } catch {
              return sum;
            }
          }, BigInt(0));
    const selectedTotal =
      !nexusSDK || typeof decimals !== "number"
        ? "0"
        : formatAmountForDisplay(selectedTotalRaw, decimals, nexusSDK);
    const baseSelection = {
      selectedTotal,
      requiredTotal: amount || "0",
      requiredSafetyTotal: amount || "0",
      missingToProceed: "0",
      missingToSafety: "0",
      coverageState: "healthy" as SourceCoverageState,
      coverageToSafetyPercent: 100,
      isBelowRequired: false,
      isBelowSafetyBuffer: false,
    };

    if (!nexusSDK || !inputs?.token || !inputs?.chain || !amount) {
      return baseSelection;
    }

    try {
      const requiredRaw = nexusSDK.convertTokenReadableAmountToBigInt(
        amount,
        inputs.token,
        inputs.chain,
      );
      if (requiredRaw <= BigInt(0)) {
        return baseSelection;
      }

      const missingToProceedRaw =
        selectedTotalRaw >= requiredRaw
          ? BigInt(0)
          : requiredRaw - selectedTotalRaw;
      const missingToSafetyRaw = missingToProceedRaw;

      const coverageState: SourceCoverageState =
        selectedTotalRaw < requiredRaw ? "error" : "healthy";

      const coverageBasisPoints =
        requiredRaw === BigInt(0)
          ? 10_000
          : selectedTotalRaw >= requiredRaw
            ? 10_000
            : Number((selectedTotalRaw * BigInt(10_000)) / requiredRaw);

      return {
        selectedTotal,
        requiredTotal: amount,
        requiredSafetyTotal: amount,
        missingToProceed: formatAmountForDisplay(
          missingToProceedRaw,
          decimals,
          nexusSDK,
        ),
        missingToSafety: formatAmountForDisplay(
          missingToSafetyRaw,
          decimals,
          nexusSDK,
        ),
        coverageState,
        coverageToSafetyPercent: coverageBasisPoints / 100,
        isBelowRequired: coverageState === "error",
        isBelowSafetyBuffer: coverageState === "error",
      };
    } catch {
      return baseSelection;
    }
  }, [
    type,
    filteredBridgableBalance?.decimals,
    nexusSDK,
    inputs?.chain,
    inputs?.amount,
    inputs?.token,
    intentSourceSpendAmount,
    availableSources,
    effectiveSelectedSourceChains,
  ]);

  const stopwatch = useStopwatch({ intervalMs: 100 });
  const setStatus = useCallback(
    (status: TransactionStatus) =>
      dispatch({ type: "setStatus", payload: status }),
    [],
  );

  const resetInputs = useCallback(() => {
    dispatch({ type: "resetInputs" });
  }, []);

  const {
    refreshIntent,
    handleTransaction,
    startTransaction,
    commitAmount,
    reset,
    invalidatePendingExecution,
  } = useTransactionExecution({
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
  });

  usePolling(
    Boolean(intent.current) &&
      !isDialogOpen &&
      !isSourceMenuOpen &&
      !hasPendingSourceSelectionChanges,
    async () => {
      await refreshIntent();
    },
    15000,
  );

  const debouncedRefreshMaxForSelection = useDebouncedCallback(
    async (requestId: number) => {
      try {
        const maxForCurrentSelection = await getMaxForCurrentSelection();
        if (requestId !== maxAmountRequestIdRef.current) return;
        setSelectedSourcesMaxAmount(maxForCurrentSelection ?? "0");
      } catch (error) {
        if (requestId !== maxAmountRequestIdRef.current) return;
        console.error("Unable to calculate max for selected sources:", error);
        setSelectedSourcesMaxAmount("0");
      }
    },
    MAX_AMOUNT_DEBOUNCE_MS,
  );

  useEffect(() => {
    debouncedRefreshMaxForSelection.cancel();
    if (!nexusSDK || !inputs?.token || !inputs?.chain) {
      maxAmountRequestIdRef.current += 1;
      setSelectedSourcesMaxAmount(null);
      return;
    }
    if (allAvailableSourceChainIds.length === 0) {
      maxAmountRequestIdRef.current += 1;
      setSelectedSourcesMaxAmount("0");
      return;
    }
    const requestId = ++maxAmountRequestIdRef.current;
    debouncedRefreshMaxForSelection(requestId);
  }, [
    allAvailableSourceChainIds.length,
    configuredMaxAmount,
    debouncedRefreshMaxForSelection,
    inputs?.recipient,
    sourceSelectionKey,
    inputs?.chain,
    inputs?.token,
    nexusSDK,
  ]);

  useEffect(() => {
    if (type !== "bridge" || !connectedAddress) return;
    const previousConnectedAddress = previousConnectedAddressRef.current;
    if (!previousConnectedAddress) {
      previousConnectedAddressRef.current = connectedAddress;
      return;
    }
    if (connectedAddress === previousConnectedAddress) return;
    previousConnectedAddressRef.current = connectedAddress;
    if (prefill?.recipient) return;
    if (!inputs?.recipient || inputs.recipient === previousConnectedAddress) {
      dispatch({ type: "setInputs", payload: { recipient: connectedAddress } });
    }
  }, [type, connectedAddress, inputs?.recipient, prefill?.recipient]);

  useEffect(() => {
    invalidatePendingExecution();
  }, [inputs, invalidatePendingExecution]);

  useEffect(() => {
    setSelectedSourceChains(null);
  }, [inputs?.token]);

  useEffect(() => {
    if (isDialogOpen) return;
    stopwatch.stop();
    stopwatch.reset();
    if (state.status === "success" || state.status === "error") {
      resetSteps();
      setLastExplorerUrl("");
      setStatus("idle");
    }
  }, [isDialogOpen, resetSteps, setStatus, state.status, stopwatch]);

  useEffect(() => {
    if (txError) {
      setTxError(null);
    }
  }, [inputs, txError]);

  return {
    inputs,
    setInputs,
    timer: stopwatch.seconds,
    setIsDialogOpen,
    setTxError,
    loading,
    refreshing,
    isDialogOpen,
    txError,
    handleTransaction,
    reset,
    filteredBridgableBalance,
    startTransaction,
    commitAmount,
    lastExplorerUrl,
    steps,
    status: state.status,
    availableSources,
    selectedSourceChains: effectiveSelectedSourceChains,
    toggleSourceChain,
    isSourceSelectionInsufficient: sourceSelection.isBelowRequired,
    isSourceSelectionBelowSafetyBuffer: sourceSelection.isBelowSafetyBuffer,
    isSourceSelectionReadyForAccept:
      sourceSelection.coverageState === "healthy",
    sourceCoverageState: sourceSelection.coverageState,
    sourceCoveragePercent: sourceSelection.coverageToSafetyPercent,
    missingToProceed: sourceSelection.missingToProceed,
    missingToSafety: sourceSelection.missingToSafety,
    selectedTotal: sourceSelection.selectedTotal,
    requiredTotal: sourceSelection.requiredTotal,
    requiredSafetyTotal: sourceSelection.requiredSafetyTotal,
    maxAvailableAmount: selectedSourcesMaxAmount ?? undefined,
    isInputsValid: areInputsValid,
  };
}
