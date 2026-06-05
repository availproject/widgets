"use client";
import {
  type EthereumProvider,
  type NexusNetwork,
  createNexusClient,
  type NexusClient,
  type OnAllowanceHookData,
  type OnIntentHookData,
  type OnSwapIntentHookData,
  type SupportedChainsAndTokensResult,
  type TokenBalance,
  type ChainBalance,
} from "@avail-project/nexus-sdk-v2";
import { getCoinbaseRates } from "@avail-project/nexus-sdk-v2/utils";

export type UserAsset = TokenBalance & {
  breakdown: (ChainBalance & {
    balance: string;
    balanceInFiat: number;
    chain: ChainBalance["chain"];
    contractAddress: string;
    decimals: number;
    symbol: string;
  })[];
  balanceInFiat?: number;
};

export type UserAssetDatum = UserAsset;
type SupportedChainsResult = SupportedChainsAndTokensResult;

import {
  createContext,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAccountEffect } from "wagmi";
import {
  DEFAULT_USD_PEGGED_TOKEN_SYMBOLS,
  USD_PEGGED_FALLBACK_RATE,
  buildUsdPeggedSymbolSet,
  fetchCoinGeckoUsdRate,
  fetchCoinbaseUsdRate,
  getCoinbaseSymbolCandidates,
  normalizeTokenSymbol,
  toFinitePositiveNumber,
} from "../common/utils/token-pricing";

interface NexusContextType {
  nexusSDK: NexusClient | null;
  bridgableBalance: UserAsset[] | null;
  swapBalance: UserAsset[] | null;
  intent: RefObject<OnIntentHookData | null>;
  allowance: RefObject<OnAllowanceHookData | null>;
  swapIntent: RefObject<OnSwapIntentHookData | null>;
  exchangeRate: Record<string, number> | null;
  supportedChainsAndTokens: SupportedChainsAndTokensResult | null;
  swapSupportedChainsAndTokens: SupportedChainsResult | null;
  network?: NexusNetwork;
  loading: boolean;
  handleInit: (provider: EthereumProvider) => Promise<void>;
  fetchBridgableBalance: () => Promise<void>;
  fetchSwapBalance: () => Promise<void>;
  getFiatValue: (amount: number, token: string) => number;
  resolveTokenUsdRate: (tokenSymbol: string) => Promise<number | null>;
  initializeNexus: (provider: EthereumProvider) => Promise<void>;
  deinitializeNexus: () => Promise<void>;
  attachEventHooks: () => void;
}

const NexusContext = createContext<NexusContextType | undefined>(undefined);

type NexusProviderProps = {
  children: React.ReactNode;
  config?: {
    network?: NexusNetwork;
    debug?: boolean;
  };
};

const defaultConfig: Required<NexusProviderProps["config"]> = {
  network: "mainnet",
  debug: true,
};

const NexusProvider = ({
  children,
  config = defaultConfig,
}: NexusProviderProps) => {
  const stableConfig = useMemo(
    () => ({ ...defaultConfig, ...config }),
    [config],
  );

  const sdkRef = useRef<NexusClient | null>(null);
  const [sdk, setSdk] = useState<NexusClient | null>(null);
  const [nexusSDK, setNexusSDK] = useState<NexusClient | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const supportedChainsAndTokens =
    useRef<SupportedChainsAndTokensResult | null>(null);
  const swapSupportedChainsAndTokens = useRef<SupportedChainsResult | null>(
    null,
  );
  const [supportedChainsAndTokensState, setSupportedChainsAndTokensState] =
    useState<SupportedChainsAndTokensResult | null>(null);
  const [
    swapSupportedChainsAndTokensState,
    setSwapSupportedChainsAndTokensState,
  ] = useState<SupportedChainsResult | null>(null);
  const [bridgableBalance, setBridgableBalance] = useState<UserAsset[] | null>(
    null,
  );
  const [swapBalance, setSwapBalance] = useState<UserAsset[] | null>(null);
  const [exchangeRateState, setExchangeRateState] = useState<Record<
    string,
    number
  > | null>(null);
  const exchangeRate = useRef<Record<string, number> | null>(null);
  const coinbaseUsdRateCache = useRef<Record<string, number>>({});
  const coinbaseUsdRateRequests = useRef<
    Record<string, Promise<number | null>>
  >({});
  const usdPeggedSymbols = useRef<Set<string>>(
    new Set(DEFAULT_USD_PEGGED_TOKEN_SYMBOLS),
  );

  const intent = useRef<OnIntentHookData | null>(null);
  const allowance = useRef<OnAllowanceHookData | null>(null);
  const swapIntent = useRef<OnSwapIntentHookData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const nextSdk = createNexusClient({
      network: stableConfig.network,
      debug: stableConfig.debug,
    });

    void nextSdk
      .initialize()
      .then(() => {
        if (cancelled) return;
        sdkRef.current = nextSdk;
        setSdk(nextSdk);
        console.log("ChainList", nextSdk.chainList.chains);
        console.log("SupportedChains", nextSdk.getSupportedChains());
      })
      .catch((err) => {
        console.error(
          "Failed to initialize default read-only Nexus client:",
          err,
        );
      });

    return () => {
      cancelled = true;
      nextSdk.destroy();
      if (sdkRef.current === nextSdk) {
        sdkRef.current = null;
      }
      setSdk(null);
      setNexusSDK(null);
    };
  }, [stableConfig]);

  const cacheUsdRate = useCallback((tokenSymbol: string, usdRate: number) => {
    const normalized = normalizeTokenSymbol(tokenSymbol);
    const rate = toFinitePositiveNumber(usdRate);
    if (!normalized || !rate) return;

    coinbaseUsdRateCache.current[normalized] = rate;
    const currentRates = exchangeRate.current ?? {};
    if (currentRates[normalized] === rate) return;

    const nextRates = {
      ...currentRates,
      [normalized]: rate,
    };
    exchangeRate.current = nextRates;
    setExchangeRateState(nextRates);
  }, []);

  const getUsdRateFromLocalSources = useCallback((tokenSymbol: string) => {
    const normalizedSymbol = normalizeTokenSymbol(tokenSymbol);
    if (!normalizedSymbol) return 0;

    for (const candidate of getCoinbaseSymbolCandidates(normalizedSymbol)) {
      const sdkRate = toFinitePositiveNumber(exchangeRate.current?.[candidate]);
      if (sdkRate) return sdkRate;

      const cachedRate = toFinitePositiveNumber(
        coinbaseUsdRateCache.current[candidate],
      );
      if (cachedRate) return cachedRate;
    }

    if (usdPeggedSymbols.current.has(normalizedSymbol)) {
      return USD_PEGGED_FALLBACK_RATE;
    }

    return 0;
  }, []);

  useEffect(() => {
    if (!sdk) return;

    let cancelled = false;
    let list: SupportedChainsAndTokensResult | null = null;
    let swapList: SupportedChainsAndTokensResult | null = null;
    try {
      list = sdk.getSupportedChains();
      swapList = sdk.getSupportedChains();
    } catch (e) {
      console.warn(
        "SDK getSupportedChains failed (likely not initialized yet):",
        e,
      );
    }

    supportedChainsAndTokens.current = list;
    swapSupportedChainsAndTokens.current = swapList;
    usdPeggedSymbols.current = buildUsdPeggedSymbolSet(list);
    setSupportedChainsAndTokensState(list);
    setSwapSupportedChainsAndTokensState(swapList);

    void getCoinbaseRates()
      .then((rates) => {
        if (cancelled) return;
        const usdPerUnit: Record<string, number> = {};

        for (const [symbol, value] of Object.entries(rates)) {
          const unitsPerUsd = Number.parseFloat(String(value));
          if (Number.isFinite(unitsPerUsd) && unitsPerUsd > 0) {
            usdPerUnit[normalizeTokenSymbol(symbol)] = 1 / unitsPerUsd;
          }
        }
        exchangeRate.current = usdPerUnit;
        setExchangeRateState(usdPerUnit);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Unable to preload Nexus rates", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sdk, stableConfig.network]);

  const normalizeUserAssetFiatValues = useCallback(
    (assets: TokenBalance[] | null): UserAsset[] | null => {
      if (!assets) return assets as null;

      return assets.map((asset) => {
        let computedAssetUsd = 0;
        const sourceBalances =
          (asset as any).chainBalances ?? (asset as any).breakdown ?? [];

        const breakdown = sourceBalances.map((entry: any) => {
          const balance = Number.parseFloat(String(entry.balance ?? "0"));
          const safeBalance =
            Number.isFinite(balance) && balance > 0 ? balance : 0;
          const existingUsd = Number.parseFloat(
            String(entry.value ?? entry.balanceInFiat ?? "0"),
          );
          const safeExistingUsd =
            Number.isFinite(existingUsd) && existingUsd >= 0 ? existingUsd : 0;

          let normalizedUsd = safeExistingUsd;
          if (safeBalance > 0 && normalizedUsd <= 0) {
            const rate = getUsdRateFromLocalSources(
              entry.symbol ?? asset.symbol,
            );
            if (rate > 0) {
              normalizedUsd = safeBalance * rate;
            }
          }

          computedAssetUsd += normalizedUsd;
          return {
            ...entry,
            balanceInFiat: normalizedUsd,
          };
        });

        const assetBalance = Number.parseFloat(String(asset.balance ?? "0"));
        const safeAssetBalance =
          Number.isFinite(assetBalance) && assetBalance > 0 ? assetBalance : 0;
        const rawAssetUsd = Number.parseFloat(
          String(asset.value ?? (asset as any).balanceInFiat ?? "0"),
        );
        const safeAssetUsd =
          Number.isFinite(rawAssetUsd) && rawAssetUsd >= 0 ? rawAssetUsd : 0;

        let normalizedAssetUsd = safeAssetUsd;
        if (normalizedAssetUsd <= 0) {
          if (computedAssetUsd > 0) {
            normalizedAssetUsd = computedAssetUsd;
          } else if (safeAssetBalance > 0) {
            const rate = getUsdRateFromLocalSources(asset.symbol);
            if (rate > 0) {
              normalizedAssetUsd = safeAssetBalance * rate;
            }
          }
        }

        return {
          ...asset,
          balanceInFiat: normalizedAssetUsd,
          breakdown,
        } as UserAsset;
      });
    },
    [getUsdRateFromLocalSources],
  );

  const resolveTokenUsdRate = useCallback(
    async (tokenSymbol: string) => {
      const normalizedSymbol = normalizeTokenSymbol(tokenSymbol);
      if (!normalizedSymbol) return null;

      const sdkRate = toFinitePositiveNumber(
        exchangeRate.current?.[normalizedSymbol],
      );
      if (sdkRate) {
        return sdkRate;
      }

      const cachedRate = toFinitePositiveNumber(
        coinbaseUsdRateCache.current[normalizedSymbol],
      );
      if (cachedRate) {
        return cachedRate;
      }

      const inFlightRequest = coinbaseUsdRateRequests.current[normalizedSymbol];
      if (inFlightRequest) {
        return inFlightRequest;
      }

      const requestPromise = (async (): Promise<number | null> => {
        for (const candidate of getCoinbaseSymbolCandidates(normalizedSymbol)) {
          const sdkCandidateRate = toFinitePositiveNumber(
            exchangeRate.current?.[candidate],
          );
          if (sdkCandidateRate) {
            cacheUsdRate(normalizedSymbol, sdkCandidateRate);
            return sdkCandidateRate;
          }

          const cachedCandidateRate = toFinitePositiveNumber(
            coinbaseUsdRateCache.current[candidate],
          );
          if (cachedCandidateRate) {
            cacheUsdRate(normalizedSymbol, cachedCandidateRate);
            return cachedCandidateRate;
          }
        }

        const coinbaseRate = await fetchCoinbaseUsdRate(normalizedSymbol);
        if (coinbaseRate) {
          cacheUsdRate(normalizedSymbol, coinbaseRate);
          return coinbaseRate;
        }

        const coinGeckoRate = await fetchCoinGeckoUsdRate(normalizedSymbol);
        if (coinGeckoRate) {
          cacheUsdRate(normalizedSymbol, coinGeckoRate);
          return coinGeckoRate;
        }

        if (usdPeggedSymbols.current.has(normalizedSymbol)) {
          cacheUsdRate(normalizedSymbol, USD_PEGGED_FALLBACK_RATE);
          return USD_PEGGED_FALLBACK_RATE;
        }

        return null;
      })();

      coinbaseUsdRateRequests.current[normalizedSymbol] = requestPromise;
      try {
        return await requestPromise;
      } finally {
        delete coinbaseUsdRateRequests.current[normalizedSymbol];
      }
    },
    [cacheUsdRate],
  );

  const initializedRef = useRef(false);

  const setupNexus = useCallback(async () => {
    const activeSdk = sdkRef.current;
    if (!activeSdk) return;
    const list = activeSdk.getSupportedChains();
    supportedChainsAndTokens.current = list ?? null;
    setSupportedChainsAndTokensState(list ?? null);
    usdPeggedSymbols.current = buildUsdPeggedSymbolSet(list ?? null);
    const swapList = activeSdk.getSupportedChains();
    swapSupportedChainsAndTokens.current = swapList ?? null;
    setSwapSupportedChainsAndTokensState(swapList ?? null);
    const [bridgeAbleBalanceResult, swapBalanceResult, rates] =
      await Promise.allSettled([
        activeSdk.getBalancesForBridge(),
        activeSdk.getBalancesForSwap(),
        getCoinbaseRates(),
      ]);

    if (rates?.status === "fulfilled") {
      const usdPerUnit: Record<string, number> = {};

      for (const [symbol, value] of Object.entries(rates.value)) {
        const unitsPerUsd = Number.parseFloat(String(value));
        if (Number.isFinite(unitsPerUsd) && unitsPerUsd > 0) {
          usdPerUnit[normalizeTokenSymbol(symbol)] = 1 / unitsPerUsd;
        }
      }
      exchangeRate.current = usdPerUnit;
      setExchangeRateState(usdPerUnit);
    }

    if (bridgeAbleBalanceResult.status === "fulfilled") {
      setBridgableBalance(
        normalizeUserAssetFiatValues(bridgeAbleBalanceResult.value),
      );
    }

    if (swapBalanceResult.status === "fulfilled") {
      setSwapBalance(normalizeUserAssetFiatValues(swapBalanceResult.value));
    }
  }, [config?.network, normalizeUserAssetFiatValues]);

  const initializeNexus = useCallback(
    async (provider: EthereumProvider) => {
      setLoading(true);
      try {
        const nextSdk = createNexusClient({
          network: stableConfig.network,
          debug: stableConfig.debug,
        });

        await nextSdk.initialize();
        await nextSdk.setEVMProvider(provider);

        sdkRef.current = nextSdk;
        setSdk(nextSdk);
        initializedRef.current = true;
        setNexusSDK(nextSdk);
      } catch (error) {
        console.error("Error initializing Nexus:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [stableConfig],
  );

  const deinitializeNexus = useCallback(async () => {
    try {
      const activeSdk = nexusSDK ?? sdkRef.current;
      if (!activeSdk) return;
      activeSdk.destroy();
      initializedRef.current = false;
      setNexusSDK(null);
      setBridgableBalance(null);
      setSwapBalance(null);
      intent.current = null;
      swapIntent.current = null;
      allowance.current = null;
      setLoading(false);
    } catch (error) {
      console.error("Error deinitializing Nexus:", error);
    }
  }, [nexusSDK]);

  const attachEventHooks = useCallback(() => {
    // Dummy signature for backward compatibility, hooks are now per-call
  }, []);

  const handleInit = useCallback(
    async (provider: EthereumProvider) => {
      if (initializedRef.current || loading) {
        return;
      }
      if (!provider || typeof provider.request !== "function") {
        throw new Error("Invalid EIP-1193 provider");
      }
      try {
        await initializeNexus(provider);
        await setupNexus();
        attachEventHooks();
      } catch (error) {
        console.error("Error during Nexus setup flow:", error);
        throw error;
      }
    },
    [loading, initializeNexus, setupNexus, attachEventHooks],
  );

  const fetchBridgableBalance = useCallback(async () => {
    try {
      const activeSdk = sdkRef.current;
      if (!activeSdk) return;
      const updatedBalance = await activeSdk.getBalancesForBridge();
      setBridgableBalance(normalizeUserAssetFiatValues(updatedBalance));
    } catch (error) {
      console.error("Error fetching bridgable balance:", error);
    }
  }, [normalizeUserAssetFiatValues]);

  const fetchSwapBalance = useCallback(async () => {
    try {
      const activeSdk = sdkRef.current;
      if (!activeSdk) return;
      const updatedBalance = await activeSdk.getBalancesForSwap();
      setSwapBalance(normalizeUserAssetFiatValues(updatedBalance));
    } catch (error) {
      console.error("Error fetching swap balance:", error);
    }
  }, [normalizeUserAssetFiatValues]);

  const getFiatValue = useCallback(
    (amount: number, token: string) => {
      const rate = getUsdRateFromLocalSources(token);
      return rate * amount;
    },
    [getUsdRateFromLocalSources],
  );

  // Backfill USD values once rates arrive so downstream selectors/max logic
  // do not treat supported assets as $0 simply due to timing.
  useEffect(() => {
    if (!exchangeRateState) return;
    setSwapBalance((prev) => normalizeUserAssetFiatValues(prev));
    setBridgableBalance((prev) => normalizeUserAssetFiatValues(prev));
  }, [exchangeRateState, normalizeUserAssetFiatValues]);

  useAccountEffect({
    onDisconnect() {
      deinitializeNexus();
    },
  });

  const value = useMemo(
    () => ({
      nexusSDK,
      initializeNexus,
      deinitializeNexus,
      attachEventHooks,
      intent,
      allowance,
      handleInit,
      supportedChainsAndTokens: supportedChainsAndTokensState,
      swapSupportedChainsAndTokens: swapSupportedChainsAndTokensState,
      bridgableBalance,
      swapBalance: swapBalance,
      network: config?.network,
      loading,
      fetchBridgableBalance,
      fetchSwapBalance,
      swapIntent,
      exchangeRate: exchangeRateState,
      getFiatValue,
      resolveTokenUsdRate,
    }),
    [
      nexusSDK,
      initializeNexus,
      deinitializeNexus,
      attachEventHooks,
      handleInit,
      bridgableBalance,
      swapBalance,
      config,
      loading,
      fetchBridgableBalance,
      fetchSwapBalance,
      exchangeRateState,
      getFiatValue,
      resolveTokenUsdRate,
      supportedChainsAndTokensState,
      swapSupportedChainsAndTokensState,
    ],
  );
  return (
    <NexusContext.Provider value={value}>{children}</NexusContext.Provider>
  );
};

export function useNexus() {
  const context = useContext(NexusContext);
  if (!context) {
    throw new Error("useNexus must be used within a NexusProvider");
  }
  return context;
}

export default NexusProvider;
