import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  type NexusClient,
  type SwapExactInParams,
  type SwapExactOutParams,
  type OnSwapIntentHookData,
  type Source as SwapSource,
  type TokenBalance,
  type ChainBalance,
} from "@avail-project/nexus-core";
import { formatTokenBalance } from "@avail-project/nexus-core/utils";
import { parseUnits } from "viem";
import { type SwapStepType } from "../../common/types/transaction-flow";
import { padHex, type Hex } from "viem";
import {
  useTransactionSteps,
  SWAP_EXPECTED_STEPS,
  useNexusError,
  useDebouncedCallback,
  usePolling,
} from "../../common";
import {
  buildSourceOptionKey,
  getIntentMatchedOptionKeys,
  getIntentSourcesSignature,
} from "../utils/source-matching";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EVM_NATIVE_PLACEHOLDER = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function toComparableSdkAddress(address: string): string {
  const normalized = normalizeAddress(address);
  const effectiveAddress =
    normalized === ZERO_ADDRESS ? EVM_NATIVE_PLACEHOLDER : normalized;

  try {
    return padHex(effectiveAddress as Hex, { size: 32 }).toLowerCase();
  } catch {
    return effectiveAddress;
  }
}

import { type UserAsset } from "../../nexus/NexusProvider";

function sortSourcesByPriority(swapBalance: UserAsset[], target: { chainID: number; tokenAddress: string; symbol: string }) {
  const list = swapBalance.flatMap(asset => asset.breakdown ?? []);
  return list.sort((a, b) => Number.parseFloat(b.balance) - Number.parseFloat(a.balance)).map(cb => ({
    chainID: cb.chain.id,
    tokenAddress: cb.contractAddress,
  }));
}

type AssetBreakdownWithOptionalIcon = UserAsset["breakdown"][number] & {
  icon?: string;
};

function getBreakdownTokenIcon(
  breakdown: UserAsset["breakdown"][number],
): string {
  const icon = (breakdown as AssetBreakdownWithOptionalIcon).icon;
  return typeof icon === "string" && icon.length > 0 ? icon : "";
}

export type SourceTokenInfo = {
  contractAddress: `0x${string}`;
  decimals: number;
  logo: string;
  name: string;
  symbol: string;
  balance?: string;
  balanceInFiat?: string;
  chainId?: number;
};

export type DestinationTokenInfo = {
  tokenAddress: `0x${string}`;
  decimals: number;
  logo: string;
  name: string;
  symbol: string;
  chainId?: number;
  balance?: string;
  balanceInFiat?: string;
};

export type ExactOutSourceOption = {
  key: string;
  chainId: number;
  chainName: string;
  chainLogo: string;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenLogo: string;
  balance: string;
  decimals: number;
};

export type TransactionStatus =
  | "idle"
  | "simulating"
  | "swapping"
  | "success"
  | "error";

export type SwapMode = "exactIn" | "exactOut";

export interface SwapInputs {
  fromChainID?: number;
  fromToken?: SourceTokenInfo;
  fromAmount?: string;
  toChainID?: number;
  toToken?: DestinationTokenInfo;
  toAmount?: string;
}

export type SwapState = {
  inputs: SwapInputs;
  swapMode: SwapMode;
  status: TransactionStatus;
  error: string | null;
  explorerUrls: {
    sourceExplorerUrl: string | null;
    destinationExplorerUrl: string | null;
  };
};

type Action =
  | { type: "setInputs"; payload: Partial<SwapInputs> }
  | { type: "setStatus"; payload: TransactionStatus }
  | { type: "setError"; payload: string | null }
  | { type: "setSwapMode"; payload: SwapMode }
  | {
      type: "setExplorerUrls";
      payload: Partial<SwapState["explorerUrls"]>;
    }
  | { type: "reset" };

const initialState: SwapState = {
  inputs: {
    fromToken: undefined,
    toToken: undefined,
    fromAmount: undefined,
    toAmount: undefined,
    fromChainID: undefined,
    toChainID: undefined,
  },
  swapMode: "exactIn",
  status: "idle",
  error: null,
  explorerUrls: {
    sourceExplorerUrl: null,
    destinationExplorerUrl: null,
  },
};

function reducer(state: SwapState, action: Action): SwapState {
  switch (action.type) {
    case "setInputs": {
      return {
        ...state,
        inputs: {
          ...state.inputs,
          ...action.payload,
        },
      };
    }
    case "setStatus":
      return { ...state, status: action.payload };
    case "setError":
      return { ...state, error: action.payload };
    case "setSwapMode":
      return { ...state, swapMode: action.payload };
    case "setExplorerUrls":
      return {
        ...state,
        explorerUrls: { ...state.explorerUrls, ...action.payload },
      };
    case "reset":
      return { ...initialState };
    default:
      return state;
  }
}

interface UseSwapsProps {
  nexusSDK: NexusClient | null;
  swapIntent: RefObject<OnSwapIntentHookData | null>;
  swapBalance: TokenBalance[] | null;
  fetchBalance: () => Promise<void>;
  onComplete?: (amount?: string) => void;
  onStart?: () => void;
  onError?: (message: string) => void;
}

const useSwaps = ({
  nexusSDK,
  swapIntent,
  swapBalance: rawSwapBalance,
  fetchBalance,
  onComplete,
  onStart,
  onError,
}: UseSwapsProps) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const swapBalance = useMemo<UserAsset[] | null>(() => {
    if (!rawSwapBalance) return null;
    return rawSwapBalance.map((asset) => {
      const breakdown = asset.chainBalances?.map((cb: any) => ({
        ...cb,
        balance: cb.balance,
        balanceInFiat: Number.parseFloat(cb.value),
        chain: cb.chain,
        contractAddress: cb.contractAddress,
        decimals: cb.decimals,
        symbol: cb.symbol,
      })) ?? (asset as any).breakdown ?? [];
      return {
        ...asset,
        breakdown,
      };
    });
  }, [rawSwapBalance]);
  const {
    steps,
    seed,
    onStepComplete,
    reset: resetSteps,
  } = useTransactionSteps<SwapStepType>();
  const swapRunIdRef = useRef(0);
  const lastSyncedIntentSourcesSignatureRef = useRef("");
  const lastSyncedIntentSelectionKeyRef = useRef("");

  const currentIntentSources = swapIntent.current?.intent?.sources ?? [];
  const currentIntentSourcesSignature = useMemo(
    () => getIntentSourcesSignature(currentIntentSources),
    [currentIntentSources],
  );

  const exactOutSourceOptions = useMemo<ExactOutSourceOption[]>(() => {
    const optionsByKey = new Map<string, ExactOutSourceOption>();
    const excludedDestinationChainId = state.inputs.toChainID;

    const upsertOption = (option: ExactOutSourceOption) => {
      optionsByKey.set(option.key, option);
    };

    for (const asset of swapBalance ?? []) {
      for (const entry of asset.breakdown ?? []) {
        const balance = entry.balance ?? "0";
        const parsed = Number.parseFloat(balance);
        if (!Number.isFinite(parsed) || parsed <= 0) continue;

        const tokenAddress = entry.contractAddress as `0x${string}`;
        const chainId = entry.chain.id;
        if (
          typeof excludedDestinationChainId === "number" &&
          chainId === excludedDestinationChainId
        ) {
          continue;
        }
        upsertOption({
          key: buildSourceOptionKey(chainId, tokenAddress),
          chainId,
          chainName: entry.chain.name,
          chainLogo: entry.chain.logo,
          tokenAddress,
          tokenSymbol: entry.symbol,
          tokenLogo: getBreakdownTokenIcon(entry),
          balance,
          decimals: entry.decimals ?? asset.decimals,
        });
      }
    }

    for (const source of currentIntentSources) {
      const chainId = source.chain.id;
      if (
        typeof excludedDestinationChainId === "number" &&
        chainId === excludedDestinationChainId
      ) {
        continue;
      }
      const tokenAddress = source.token.contractAddress as `0x${string}`;
      const key = buildSourceOptionKey(chainId, tokenAddress);
      if (optionsByKey.has(key)) continue;

      upsertOption({
        key,
        chainId,
        chainName: source.chain.name,
        chainLogo: source.chain.logo,
        tokenAddress,
        tokenSymbol: source.token.symbol,
        tokenLogo: "",
        balance: source.amount ?? "0",
        decimals: source.token.decimals,
      });
    }

    const options = [...optionsByKey.values()];

    const destinationChainId = state.inputs.toChainID;
    const destinationToken = state.inputs.toToken;
    if (!destinationChainId || !destinationToken || !swapBalance?.length) {
      return options.sort((a, b) => {
        if (a.tokenSymbol === b.tokenSymbol) {
          return a.chainName.localeCompare(b.chainName);
        }
        return a.tokenSymbol.localeCompare(b.tokenSymbol);
      });
    }

    const priorityByOptionKey = new Map<string, number>();
    const sortedSources = sortSourcesByPriority(swapBalance, {
      chainID: destinationChainId,
      tokenAddress: destinationToken.tokenAddress,
      symbol: destinationToken.symbol,
    });

    sortedSources.forEach((source, index) => {
      const sourceComparableAddress = toComparableSdkAddress(
        source.tokenAddress,
      );

      for (const option of options) {
        if (option.chainId !== source.chainID) continue;
        const optionComparableAddress = toComparableSdkAddress(
          option.tokenAddress,
        );
        if (optionComparableAddress !== sourceComparableAddress) continue;
        if (!priorityByOptionKey.has(option.key)) {
          priorityByOptionKey.set(option.key, index);
        }
      }
    });

    return options.sort((a, b) => {
      const aPriority =
        priorityByOptionKey.get(a.key) ?? Number.MAX_SAFE_INTEGER;
      const bPriority =
        priorityByOptionKey.get(b.key) ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      const aBalance = Number.parseFloat(a.balance);
      const bBalance = Number.parseFloat(b.balance);
      if (Number.isFinite(aBalance) && Number.isFinite(bBalance)) {
        if (aBalance !== bBalance) {
          return bBalance - aBalance;
        }
      }

      if (a.tokenSymbol === b.tokenSymbol) {
        return a.chainName.localeCompare(b.chainName);
      }
      return a.tokenSymbol.localeCompare(b.tokenSymbol);
    });
  }, [
    currentIntentSources,
    currentIntentSourcesSignature,
    state.inputs.toToken,
    state.inputs.toChainID,
    swapBalance,
  ]);

  const exactOutAllSourceKeys = useMemo(
    () => exactOutSourceOptions.map((opt) => opt.key),
    [exactOutSourceOptions],
  );

  const [exactOutSelectedKeys, setExactOutSelectedKeys] = useState<
    string[] | null
  >(null);
  const [appliedExactOutSelectionKey, setAppliedExactOutSelectionKey] =
    useState("ALL");
  const selectedSourceInputKey = useMemo(() => {
    const sourceToken = state.inputs.fromToken;
    const sourceChainId = state.inputs.fromChainID;
    if (!sourceToken || typeof sourceChainId !== "number") return null;
    return buildSourceOptionKey(sourceChainId, sourceToken.contractAddress);
  }, [state.inputs.fromChainID, state.inputs.fromToken]);

  const effectiveExactOutSelectedKeys = useMemo(() => {
    const allKeys = exactOutAllSourceKeys;
    if (allKeys.length === 0) return [];

    if (
      state.swapMode === "exactOut" &&
      exactOutSelectedKeys === null &&
      selectedSourceInputKey &&
      allKeys.includes(selectedSourceInputKey)
    ) {
      return [selectedSourceInputKey];
    }

    const selectedKeys = exactOutSelectedKeys ?? allKeys;
    const selectedSet = new Set(selectedKeys);
    const filtered = allKeys.filter((key) => selectedSet.has(key));
    return filtered.length > 0 ? filtered : allKeys;
  }, [
    exactOutSelectedKeys,
    exactOutAllSourceKeys,
    selectedSourceInputKey,
    state.swapMode,
  ]);

  const isExactOutAllSelected = useMemo(() => {
    if (exactOutAllSourceKeys.length === 0) return true;
    return (
      effectiveExactOutSelectedKeys.length === exactOutAllSourceKeys.length
    );
  }, [exactOutAllSourceKeys, effectiveExactOutSelectedKeys]);

  const toggleExactOutSource = useCallback(
    (key: string) => {
      setExactOutSelectedKeys((prev) => {
        const allKeys = exactOutAllSourceKeys;
        if (allKeys.length === 0) return prev;

        const current = prev ?? allKeys;
        const set = new Set(current);
        if (set.has(key)) {
          set.delete(key);
        } else {
          set.add(key);
        }

        const next = allKeys.filter((k) => set.has(k));
        if (next.length === 0) return prev ?? allKeys; // keep at least 1
        if (next.length === allKeys.length) return null; // back to default "all"
        return next;
      });
    },
    [exactOutAllSourceKeys],
  );

  const applyExactOutSelectionKeys = useCallback(
    (keys: string[]) => {
      const allKeys = exactOutAllSourceKeys;
      if (allKeys.length === 0) return;

      const selectedSet = new Set(keys);
      const filtered = allKeys.filter((k) => selectedSet.has(k));
      const unique = [...new Set(filtered)];
      if (unique.length === 0) return;

      const isAllSelected = unique.length === allKeys.length;
      const selectionKey = isAllSelected ? "ALL" : [...unique].sort().join("|");

      setExactOutSelectedKeys(isAllSelected ? null : unique);
      setAppliedExactOutSelectionKey(selectionKey);
    },
    [exactOutAllSourceKeys],
  );

  const exactOutSelectionKey = useMemo(() => {
    if (isExactOutAllSelected) return "ALL";
    return [...effectiveExactOutSelectedKeys].sort().join("|");
  }, [effectiveExactOutSelectedKeys, isExactOutAllSelected]);

  const syncExactOutSelectionFromIntent = useCallback(
    (
      intentSources: NonNullable<OnSwapIntentHookData["intent"]>["sources"],
      force = false,
    ) => {
      if (intentSources.length === 0 || exactOutSourceOptions.length === 0) {
        return false;
      }

      const signature = getIntentSourcesSignature(intentSources);
      const usedKeys = getIntentMatchedOptionKeys(
        intentSources,
        exactOutSourceOptions,
      );
      if (usedKeys.length === 0) return false;
      const usedSelectionKey = [...new Set(usedKeys)].sort().join("|");
      if (
        !force &&
        signature === lastSyncedIntentSourcesSignatureRef.current &&
        usedSelectionKey === lastSyncedIntentSelectionKeyRef.current
      ) {
        return false;
      }

      applyExactOutSelectionKeys(usedKeys);
      lastSyncedIntentSourcesSignatureRef.current = signature;
      lastSyncedIntentSelectionKeyRef.current = usedSelectionKey;
      return true;
    },
    [applyExactOutSelectionKeys, exactOutSourceOptions],
  );

  const exactOutFromSources = useMemo<SwapSource[] | undefined>(() => {
    if (state.swapMode !== "exactOut") return undefined;
    if (exactOutSourceOptions.length === 0) return undefined;

    const selectedSet = new Set(effectiveExactOutSelectedKeys);
    const sources: SwapSource[] = [];
    const seen = new Set<string>();

    for (const opt of exactOutSourceOptions) {
      if (!selectedSet.has(opt.key)) continue;
      if (seen.has(opt.key)) continue;
      seen.add(opt.key);
      sources.push({ chainId: opt.chainId, tokenAddress: opt.tokenAddress });
    }

    return sources.length > 0 ? sources : undefined;
  }, [state.swapMode, effectiveExactOutSelectedKeys, exactOutSourceOptions]);
  const isExactOutSourceSelectionDirty = useMemo(() => {
    return (
      state.swapMode === "exactOut" &&
      exactOutSelectionKey !== appliedExactOutSelectionKey
    );
  }, [state.swapMode, exactOutSelectionKey, appliedExactOutSelectionKey]);

  const [updatingExactOutSources, setUpdatingExactOutSources] = useState(false);

  // Validation for exact-in mode
  const areExactInInputsValid = useMemo(() => {
    return (
      state?.inputs?.fromChainID !== undefined &&
      state?.inputs?.toChainID !== undefined &&
      state?.inputs?.fromToken &&
      state?.inputs?.toToken &&
      state?.inputs?.fromAmount &&
      Number(state.inputs.fromAmount) > 0
    );
  }, [state.inputs]);

  // Validation for exact-out mode
  const areExactOutInputsValid = useMemo(() => {
    return (
      state?.inputs?.toChainID !== undefined &&
      state?.inputs?.toToken &&
      state?.inputs?.toAmount &&
      Number(state.inputs.toAmount) > 0
    );
  }, [state.inputs]);

  // Combined validation based on current mode
  const areInputsValid = useMemo(() => {
    return state.swapMode === "exactIn"
      ? areExactInInputsValid
      : areExactOutInputsValid;
  }, [state.swapMode, areExactInInputsValid, areExactOutInputsValid]);

  const handleNexusError = useNexusError();

  const handleExactInSwap = async (runId: number) => {
    const fromToken = state.inputs.fromToken;
    const toToken = state.inputs.toToken;
    const fromAmount = state.inputs.fromAmount;
    const toChainID = state.inputs.toChainID;
    const fromChainID = state.inputs.fromChainID;

    if (
      !nexusSDK ||
      !areExactInInputsValid ||
      !fromToken ||
      !toToken ||
      !fromAmount ||
      !toChainID ||
      !fromChainID
    )
      return;

    const sourceBalance = swapBalance
      ?.flatMap((token) => token.breakdown ?? [])
      ?.find(
        (chain) =>
          chain.chain?.id === fromChainID &&
          normalizeAddress(chain.contractAddress) ===
            normalizeAddress(fromToken.contractAddress),
      );
    if (
      !sourceBalance ||
      Number.parseFloat(sourceBalance.balance ?? "0") <= 0
    ) {
      throw new Error(
        "No balance found for this wallet on supported source chains.",
      );
    }

    const amountBigInt = parseUnits(fromAmount, fromToken.decimals);
    const swapInput: SwapExactInParams = {
      sources: [
        {
          chainId: fromChainID,
          amountRaw: amountBigInt,
          tokenAddress: fromToken.contractAddress,
        },
      ],
      toChainId: toChainID,
      toTokenAddress: toToken.tokenAddress,
    };

    await nexusSDK.swapWithExactIn(swapInput, {
      onEvent: (event) => {
        if (swapRunIdRef.current !== runId) return;
        if (event.type === "plan_preview" || event.type === "plan_confirmed") {
          const list = event.plan.steps.map((step) => {
            const { type, ...rest } = step;
            return {
              type: type.toUpperCase(),
              typeID: type.toUpperCase(),
              completed: false,
              ...rest,
            };
          });
          seed(list as any);
        }
        if (event.type === "plan_progress") {
          const completed =
            event.state === "completed" ||
            event.state === "confirmed" ||
            event.state === "submitted";
          if (completed) {
            const { type, ...restStep } = event.step;
            const step = {
              type: event.stepType.toUpperCase(),
              typeID: event.stepType.toUpperCase(),
              completed: true,
              ...restStep,
            };
            if (event.stepType === "source_swap" && (event as any).txHash) {
              dispatch({
                type: "setExplorerUrls",
                payload: { sourceExplorerUrl: (event as any).explorerUrl },
              });
            }
            if (event.stepType === "destination_swap" && (event as any).txHash) {
              dispatch({
                type: "setExplorerUrls",
                payload: { destinationExplorerUrl: (event as any).explorerUrl },
              });
            }
            onStepComplete(step as any);
          }
        }
      },
      hooks: {
        onIntent: (data) => {
          swapIntent.current = data;
        },
      },
    });
  };

  const handleExactOutSwap = async (runId: number) => {
    const toToken = state.inputs.toToken;
    const toAmount = state.inputs.toAmount;
    const toChainID = state.inputs.toChainID;

    if (
      !nexusSDK ||
      !areExactOutInputsValid ||
      !toToken ||
      !toAmount ||
      !toChainID
    )
      return;
    if (swapBalance && exactOutSourceOptions.length === 0) {
      throw new Error(
        "No balance found for this wallet on supported source chains.",
      );
    }
    if (!exactOutFromSources || exactOutFromSources.length === 0) {
      throw new Error("Select at least one source with available balance.");
    }

    const amountBigInt = parseUnits(toAmount, toToken.decimals);
    const swapInput: SwapExactOutParams = {
      toAmountRaw: amountBigInt,
      toChainId: toChainID,
      toTokenAddress: toToken.tokenAddress,
      sources: exactOutFromSources,
    };

    await nexusSDK.swapWithExactOut(swapInput, {
      onEvent: (event) => {
        if (swapRunIdRef.current !== runId) return;
        if (event.type === "plan_preview" || event.type === "plan_confirmed") {
          const list = event.plan.steps.map((step) => {
            const { type, ...rest } = step;
            return {
              type: type.toUpperCase(),
              typeID: type.toUpperCase(),
              completed: false,
              ...rest,
            };
          });
          seed(list as any);
        }
        if (event.type === "plan_progress") {
          const completed =
            event.state === "completed" ||
            event.state === "confirmed" ||
            event.state === "submitted";
          if (completed) {
            const { type, ...restStep } = event.step;
            const step = {
              type: event.stepType.toUpperCase(),
              typeID: event.stepType.toUpperCase(),
              completed: true,
              ...restStep,
            };
            if (event.stepType === "source_swap" && (event as any).txHash) {
              dispatch({
                type: "setExplorerUrls",
                payload: { sourceExplorerUrl: (event as any).explorerUrl },
              });
            }
            if (event.stepType === "destination_swap" && (event as any).txHash) {
              dispatch({
                type: "setExplorerUrls",
                payload: { destinationExplorerUrl: (event as any).explorerUrl },
              });
            }
            onStepComplete(step as any);
          }
        }
      },
      hooks: {
        onIntent: (data) => {
          swapIntent.current = data;
        },
      },
    });
  };

  const runSwap = async (runId: number) => {
    if (!nexusSDK || !areInputsValid || !swapBalance) return;

    try {
      onStart?.();
      dispatch({ type: "setStatus", payload: "simulating" });
      dispatch({ type: "setError", payload: null });
      seed(SWAP_EXPECTED_STEPS);

      if (state.swapMode === "exactOut") {
        setAppliedExactOutSelectionKey(exactOutSelectionKey);
      } else {
        setAppliedExactOutSelectionKey("ALL");
      }

      if (state.swapMode === "exactIn") {
        await handleExactInSwap(runId);
      } else {
        await handleExactOutSwap(runId);
      }

      if (swapRunIdRef.current !== runId) return;
      dispatch({ type: "setStatus", payload: "success" });
      onComplete?.(swapIntent.current?.intent?.destination?.amount);
      await fetchBalance();
    } catch (error) {
      if (swapRunIdRef.current !== runId) return;
      const { message } = handleNexusError(error);
      dispatch({ type: "setStatus", payload: "error" });
      dispatch({ type: "setError", payload: message });
      onError?.(message);
      swapIntent.current?.deny();
      swapIntent.current = null;
      setExactOutSelectedKeys(null);
      setAppliedExactOutSelectionKey("ALL");
      setUpdatingExactOutSources(false);
      lastSyncedIntentSourcesSignatureRef.current = "";
      lastSyncedIntentSelectionKeyRef.current = "";
      void fetchBalance();
    }
  };

  const startSwap = () => {
    swapRunIdRef.current += 1;
    const runId = swapRunIdRef.current;
    void runSwap(runId);
    return runId;
  };

  const debouncedSwapStart = useDebouncedCallback(startSwap, 800);

  const reset = () => {
    // invalidate any in-flight swap run
    swapRunIdRef.current += 1;
    dispatch({ type: "reset" });
    resetSteps();
    swapIntent.current?.deny();
    swapIntent.current = null;
    setExactOutSelectedKeys(null);
    setAppliedExactOutSelectionKey("ALL");
    setUpdatingExactOutSources(false);
    lastSyncedIntentSourcesSignatureRef.current = "";
    lastSyncedIntentSelectionKeyRef.current = "";
  };

  useEffect(() => {
    if (state.swapMode !== "exactOut") return;
    if (state.status !== "simulating") return;
    if (exactOutSourceOptions.length === 0) return;

    const runId = swapRunIdRef.current;
    let cancelled = false;

    void (async () => {
      const start = Date.now();
      while (!cancelled && Date.now() - start < 10000) {
        if (swapRunIdRef.current !== runId) return;

        const intentSources = swapIntent.current?.intent?.sources ?? [];
        if (intentSources.length > 0) {
          syncExactOutSelectionFromIntent(intentSources);
          return;
        }

        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    currentIntentSourcesSignature,
    exactOutSourceOptions,
    state.status,
    state.swapMode,
    syncExactOutSelectionFromIntent,
    swapIntent,
  ]);

  const availableBalance = useMemo(() => {
    if (
      !nexusSDK ||
      !swapBalance ||
      !state.inputs?.fromToken ||
      !state.inputs?.fromChainID
    )
      return undefined;
    return (
      swapBalance
        ?.flatMap((token) => token.breakdown ?? [])
        ?.find(
          (chain) =>
            chain.chain?.id === state.inputs?.fromChainID &&
            normalizeAddress(chain.contractAddress) ===
              normalizeAddress(state.inputs?.fromToken?.contractAddress ?? ""),
        ) ?? undefined
    );
  }, [
    state.inputs?.fromToken,
    state.inputs?.fromChainID,
    swapBalance,
    nexusSDK,
  ]);

  const destinationBalance = useMemo(() => {
    if (
      !nexusSDK ||
      !swapBalance ||
      !state.inputs?.toToken ||
      !state.inputs?.toChainID
    )
      return undefined;
    return (
      swapBalance
        ?.flatMap((token) => token.breakdown ?? [])
        ?.find(
          (chain) =>
            chain.chain?.id === state?.inputs?.toChainID &&
            normalizeAddress(chain.contractAddress) ===
              normalizeAddress(state?.inputs?.toToken?.tokenAddress ?? ""),
        ) ?? undefined
    );
  }, [state?.inputs?.toToken, state?.inputs?.toChainID, swapBalance, nexusSDK]);

  const availableStables = useMemo(() => {
    if (!nexusSDK || !swapBalance) return [];
    const stableSymbols = new Set(["USDT", "USDC", "ETH", "DAI", "WBTC"]);
    const filteredToken = swapBalance.filter((token) =>
      (token.breakdown ?? []).some((entry) =>
        stableSymbols.has(entry.symbol.toUpperCase()),
      ),
    );
    return filteredToken ?? [];
  }, [swapBalance, nexusSDK]);

  const formatBalance = (
    balance?: string | number,
    symbol?: string,
    decimals?: number,
  ) => {
    if (!balance || !symbol || !decimals) return undefined;
    return formatTokenBalance(balance, {
      symbol: symbol,
      decimals: decimals,
    });
  };

  useEffect(() => {
    if (!swapBalance) {
      fetchBalance();
    }
  }, [swapBalance]);

  useEffect(() => {
    // Check validity based on current swap mode
    const isValidForCurrentMode =
      state.swapMode === "exactIn"
        ? areExactInInputsValid &&
          state?.inputs?.fromAmount &&
          state?.inputs?.fromChainID &&
          state?.inputs?.fromToken &&
          state?.inputs?.toChainID &&
          state?.inputs?.toToken
        : areExactOutInputsValid &&
          state?.inputs?.toAmount &&
          state?.inputs?.toChainID &&
          state?.inputs?.toToken;

    if (!isValidForCurrentMode) {
      swapIntent.current?.deny();
      swapIntent.current = null;
      lastSyncedIntentSourcesSignatureRef.current = "";
      lastSyncedIntentSelectionKeyRef.current = "";
      return;
    }
    if (state.status === "idle") {
      debouncedSwapStart();
    }
  }, [
    state.inputs,
    state.swapMode,
    areExactInInputsValid,
    areExactOutInputsValid,
    state.status,
  ]);

  const refreshSimulation = async () => {
    try {
      const updated = await swapIntent.current?.refresh();
      if (updated) {
        swapIntent.current!.intent = updated;
      }
    } catch (e) {
      console.error(e);
    }
  };

  usePolling(
    state.status === "simulating" && Boolean(swapIntent.current),
    async () => {
      await refreshSimulation();
    },
    15000,
  );

  const continueSwap = useCallback(async () => {
    if (state.status !== "simulating") return;

    if (state.swapMode !== "exactOut" || !isExactOutSourceSelectionDirty) {
      dispatch({ type: "setStatus", payload: "swapping" });
      swapIntent.current?.allow();
      return;
    }

    if (!nexusSDK || !areInputsValid) return;

    setUpdatingExactOutSources(true);
    try {
      const previousIntent = swapIntent.current;
      swapRunIdRef.current += 1;
      const runId = swapRunIdRef.current;

      previousIntent?.deny();

      void runSwap(runId);
      const start = Date.now();
      while (Date.now() - start < 10000) {
        if (swapRunIdRef.current !== runId) return;
        const nextIntent = swapIntent.current;
        const sourcesReady =
          nextIntent &&
          nextIntent !== previousIntent &&
          (nextIntent.intent.sources?.length ?? 0) > 0;
        if (sourcesReady) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (swapRunIdRef.current !== runId) return;
      const nextIntent = swapIntent.current;
      if (!nextIntent || nextIntent === previousIntent) return;
      if ((nextIntent.intent.sources?.length ?? 0) === 0) return;
      syncExactOutSelectionFromIntent(nextIntent.intent.sources, true);
      // Updated sources are now reflected in the intent. Wait for explicit user
      // confirmation before proceeding.
      return;
    } finally {
      setUpdatingExactOutSources(false);
    }
  }, [
    areInputsValid,
    isExactOutSourceSelectionDirty,
    nexusSDK,
    runSwap,
    syncExactOutSelectionFromIntent,
    state.status,
    state.swapMode,
    swapIntent,
  ]);

  return {
    status: state.status,
    inputs: state.inputs,
    swapMode: state.swapMode,
    setSwapMode: (mode: SwapMode) =>
      dispatch({ type: "setSwapMode", payload: mode }),
    setStatus: (status: TransactionStatus) =>
      dispatch({ type: "setStatus", payload: status }),
    setInputs: (inputs: Partial<SwapInputs>) => {
      if (state.status === "error") {
        dispatch({ type: "setError", payload: null });
        dispatch({ type: "setStatus", payload: "idle" });
      }
      dispatch({ type: "setInputs", payload: inputs });
    },
    txError: state.error,
    setTxError: (error: string | null) =>
      dispatch({ type: "setError", payload: error }),
    availableBalance,
    availableStables,
    destinationBalance,
    formatBalance,
    steps,
    explorerUrls: state.explorerUrls,
    handleSwap: startSwap,
    continueSwap,
    exactOutSourceOptions,
    exactOutSelectedKeys: effectiveExactOutSelectedKeys,
    toggleExactOutSource,
    isExactOutSourceSelectionDirty,
    updatingExactOutSources,
    reset,
    areInputsValid,
  };
};

export default useSwaps;
