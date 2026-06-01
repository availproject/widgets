"use client";
import {
  type EthereumProvider,
  type NexusNetwork,
  NexusSDK,
  type OnAllowanceHookData,
  type OnIntentHookData,
  type OnSwapIntentHookData,
  type SupportedChainsAndTokensResult,
  type SupportedChainsResult,
  type UserAsset,
} from "@avail-project/nexus-core";

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
  TOKEN_PRICE_PEGS,
  TokenPricingError,
  USD_PEGGED_FALLBACK_RATE,
  buildUsdPeggedSymbolSet,
  fetchCoinGeckoUsdRate,
  fetchCoinbaseUsdRate,
  getCoinbaseSymbolCandidates,
  normalizeTokenSymbol,
  resolveBaseSymbol,
  toFinitePositiveNumber,
} from "../common/utils/token-pricing";

interface NexusContextType {
  nexusSDK: NexusSDK | null;
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

  const sdkRef = useRef<NexusSDK | null>(null);
  const [sdk, setSdk] = useState<NexusSDK | null>(null);
  const [nexusSDK, setNexusSDK] = useState<NexusSDK | null>(null);
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
    const nextSdk = new NexusSDK({
      ...stableConfig,
    });

    sdkRef.current = nextSdk;
    setSdk(nextSdk);

    return () => {
      void nextSdk.deinit().catch((error) => {
        console.error("Error deinitializing Nexus:", error);
      });
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

    const _debug = normalizedSymbol === "WCBTC" || normalizedSymbol === "CBTC";
    if (_debug) {
      console.debug(`[PRICING DEBUG] resolving "${normalizedSymbol}"`, {
        candidates: getCoinbaseSymbolCandidates(normalizedSymbol),
        exchangeRateKeys: Object.keys(exchangeRate.current ?? {}),
        hasBTC: exchangeRate.current?.["BTC"],
        pegBase: resolveBaseSymbol(normalizedSymbol),
      });
    }

    // 1. Direct SDK / cache lookup for the original symbol candidates
    for (const candidate of getCoinbaseSymbolCandidates(normalizedSymbol)) {
      const sdkRate = toFinitePositiveNumber(exchangeRate.current?.[candidate]);
      if (sdkRate) {
        if (_debug) console.debug(`[PRICING DEBUG] "${normalizedSymbol}" → SDK candidate "${candidate}" = ${sdkRate}`);
        return sdkRate;
      }

      const cachedRate = toFinitePositiveNumber(
        coinbaseUsdRateCache.current[candidate],
      );
      if (cachedRate) {
        if (_debug) console.debug(`[PRICING DEBUG] "${normalizedSymbol}" → cached candidate "${candidate}" = ${cachedRate}`);
        return cachedRate;
      }
    }

    // 2. Explicit pegging fallback (e.g. WCBTC→BTC, WETH→ETH) — checked
    //    BEFORE usdPeggedSymbols so the SDK's dynamic set can't override it.
    const baseSymbol = resolveBaseSymbol(normalizedSymbol);
    if (baseSymbol) {
      if (usdPeggedSymbols.current.has(baseSymbol) || baseSymbol === "USD") {
        if (_debug) console.debug(`[PRICING DEBUG] "${normalizedSymbol}" → base "${baseSymbol}" is USD-pegged, returning 1`);
        return USD_PEGGED_FALLBACK_RATE;
      }
      for (const candidate of getCoinbaseSymbolCandidates(baseSymbol)) {
        const sdkRate = toFinitePositiveNumber(
          exchangeRate.current?.[candidate],
        );
        if (sdkRate) {
          if (_debug) console.debug(`[PRICING DEBUG] "${normalizedSymbol}" → base "${baseSymbol}" → SDK candidate "${candidate}" = ${sdkRate}`);
          return sdkRate;
        }

        const cachedRate = toFinitePositiveNumber(
          coinbaseUsdRateCache.current[candidate],
        );
        if (cachedRate) {
          if (_debug) console.debug(`[PRICING DEBUG] "${normalizedSymbol}" → base "${baseSymbol}" → cached candidate "${candidate}" = ${cachedRate}`);
          return cachedRate;
        }
      }
      if (_debug) console.debug(`[PRICING DEBUG] "${normalizedSymbol}" → base "${baseSymbol}" NOT found in any source`);
    }

    // 3. Dynamic USD-pegged set (only if no explicit peg was defined)
    if (!baseSymbol && usdPeggedSymbols.current.has(normalizedSymbol)) {
      if (_debug) console.debug(`[PRICING DEBUG] "${normalizedSymbol}" → in usdPeggedSymbols, returning 1`);
      return USD_PEGGED_FALLBACK_RATE;
    }

    if (_debug) console.debug(`[PRICING DEBUG] "${normalizedSymbol}" → NO RATE FOUND, returning 0`);
    return 0;
  }, []);

  useEffect(() => {
    if (!sdk) return;

    let cancelled = false;
    const list = sdk.utils.getSupportedChains(
      stableConfig.network === "testnet" ? 0 : undefined,
    );
    const swapList = sdk.utils.getSwapSupportedChainsAndTokens();
    supportedChainsAndTokens.current = list ?? null;
    swapSupportedChainsAndTokens.current = swapList ?? null;
    usdPeggedSymbols.current = buildUsdPeggedSymbolSet(list ?? null);
    setSupportedChainsAndTokensState(list ?? null);
    setSwapSupportedChainsAndTokensState(swapList ?? null);

    void sdk.utils
      .getCoinbaseRates()
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
    (assets: UserAsset[] | null): UserAsset[] | null => {
      if (!assets) return assets;

      return assets.map((asset) => {
        let computedAssetUsd = 0;

        const breakdown = (asset.breakdown ?? []).map((entry) => {
          const balance = Number.parseFloat(String(entry.balance ?? "0"));
          const safeBalance =
            Number.isFinite(balance) && balance > 0 ? balance : 0;
          const entrySymbol = normalizeTokenSymbol(
            entry.symbol ?? asset.symbol,
          );
          const existingUsd = Number.parseFloat(
            String(entry.balanceInFiat ?? "0"),
          );
          const safeExistingUsd =
            Number.isFinite(existingUsd) && existingUsd >= 0 ? existingUsd : 0;

          // For pegged tokens (e.g. wcBTC→BTC) the SDK may return a
          // bogus 1:1 USD value — always recalculate with our rate.
          const hasPeg = Boolean(resolveBaseSymbol(entrySymbol));

          let normalizedUsd = safeExistingUsd;
          if (safeBalance > 0 && (normalizedUsd <= 0 || hasPeg)) {
            const rate = getUsdRateFromLocalSources(entrySymbol);
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
          String(asset.balanceInFiat ?? "0"),
        );
        const safeAssetUsd =
          Number.isFinite(rawAssetUsd) && rawAssetUsd >= 0 ? rawAssetUsd : 0;
        const assetHasPeg = Boolean(resolveBaseSymbol(normalizeTokenSymbol(asset.symbol)));

        let normalizedAssetUsd = safeAssetUsd;
        if (normalizedAssetUsd <= 0 || assetHasPeg) {
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
        };
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
        // 1. Check SDK / cache candidates for the original symbol
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

        // 2. Try Coinbase API for the original symbol
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

        // 5. All paths exhausted — throw a pricing error
        throw new TokenPricingError(normalizedSymbol);
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

  const setupNexus = useCallback(async () => {
    if (!sdk) return;
    const list = sdk.utils.getSupportedChains(
      config?.network === "testnet" ? 0 : undefined,
    );
    supportedChainsAndTokens.current = list ?? null;
    setSupportedChainsAndTokensState(list ?? null);
    usdPeggedSymbols.current = buildUsdPeggedSymbolSet(list ?? null);
    const swapList = sdk.utils.getSwapSupportedChainsAndTokens();
    swapSupportedChainsAndTokens.current = swapList ?? null;
    setSwapSupportedChainsAndTokensState(swapList ?? null);
    const [bridgeAbleBalanceResult, swapBalanceResult, rates] =
      await Promise.allSettled([
        sdk.getBalancesForBridge(),
        sdk.getBalancesForSwap(false),
        sdk.utils.getCoinbaseRates(),
      ]);

    if (rates?.status === "fulfilled") {
      // Coinbase returns "units per USD" (e.g., 1 USD = 0.00028 ETH).
      // Convert to "USD per unit" (e.g., 1 ETH = ~$3514) for straightforward UI calculations.
      const usdPerUnit: Record<string, number> = {};

      for (const [symbol, value] of Object.entries(rates.value)) {
        const normalized = normalizeTokenSymbol(symbol);
        // Skip tokens with an explicit peg (e.g. WCBTC→BTC) — the SDK
        // may return a bogus 1:1 USD rate for these. Our pegging map
        // will resolve them correctly via their base symbol.
        if (TOKEN_PRICE_PEGS[normalized]) continue;

        const unitsPerUsd = Number.parseFloat(String(value));
        if (Number.isFinite(unitsPerUsd) && unitsPerUsd > 0) {
          usdPerUnit[normalized] = 1 / unitsPerUsd;
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
  }, [sdk, config?.network, normalizeUserAssetFiatValues]);

  const initializeNexus = useCallback(
    async (provider: EthereumProvider) => {
      if (!sdk) {
        throw new Error("Nexus SDK is not ready");
      }
      setLoading(true);
      try {
        if (!sdk.isInitialized()) {
          await sdk.initialize(provider);
        }
        setNexusSDK(sdk);
      } catch (error) {
        console.error("Error initializing Nexus:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [sdk],
  );

  const deinitializeNexus = useCallback(async () => {
    try {
      const activeSdk = nexusSDK ?? sdkRef.current;
      if (!activeSdk) return;
      if (activeSdk.isInitialized()) {
        await activeSdk.deinit();
      }
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
    if (!sdk) return;
    sdk.setOnAllowanceHook((data: OnAllowanceHookData) => {
      /**
       * Useful when you want the user to select, min, max or a custom value
       * Can use this to capture data and then show it on the UI
       * @see - always call data.allow() to progress the flow, otherwise it will stay stuck here.
       * const {allow, sources, deny} = data
       * @example allow(['min', 'max', '0.5']), the array in allow function should match number of sources.
       * You can skip setting this hook if you want, sdk will auto progress if this hook is not attached
       */
      allowance.current = data;
    });

    sdk.setOnIntentHook((data: OnIntentHookData) => {
      /**
       * Useful when you want to capture the intent, and display it on the UI (bridge, bridgeAndTransfer, bridgeAndExecute)
       * const {allow, deny, intent, refresh} = data
       * @see - always call data.allow() to progress the flow, otherwise it will stay stuck here.
       * deny() to reject the intent
       * refresh() to refresh the intent, best to call refresh in 15 second intervals
       * data.intent -> details about the intent, useful when wanting to display info on UI
       * You can skip setting this hook if you want, sdk will auto progress if this hook is not attached
       */
      intent.current = data;
    });

    sdk.setOnSwapIntentHook((data: OnSwapIntentHookData) => {
      /**
       * Same behaviour and function as setOnIntentHook, except this one is for swaps exclusively
       */
      swapIntent.current = data;
    });
  }, [sdk]);

  const handleInit = useCallback(
    async (provider: EthereumProvider) => {
      if (!sdk) {
        throw new Error("Nexus SDK is not ready");
      }
      if (sdk.isInitialized() || loading) {
        return;
      }
      if (!provider || typeof provider.request !== "function") {
        throw new Error("Invalid EIP-1193 provider");
      }
      try {
        await initializeNexus(provider);
        if (!sdk.isInitialized()) return;
        await setupNexus();
        attachEventHooks();
      } catch (error) {
        console.error("Error during Nexus setup flow:", error);
        throw error;
      }
    },
    [sdk, loading, initializeNexus, setupNexus, attachEventHooks],
  );

  const fetchBridgableBalance = useCallback(async () => {
    try {
      if (!sdk) return;
      const updatedBalance = await sdk.getBalancesForBridge();
      setBridgableBalance(normalizeUserAssetFiatValues(updatedBalance));
    } catch (error) {
      console.error("Error fetching bridgable balance:", error);
    }
  }, [sdk, normalizeUserAssetFiatValues]);

  const fetchSwapBalance = useCallback(async () => {
    try {
      if (!sdk) return;
      const updatedBalance = await sdk.getBalancesForSwap(false);
      setSwapBalance(normalizeUserAssetFiatValues(updatedBalance));
    } catch (error) {
      console.error("Error fetching swap balance:", error);
    }
  }, [sdk, normalizeUserAssetFiatValues]);

  const getFiatValue = useCallback(
    (amount: number, token: string) => {
      const rate = getUsdRateFromLocalSources(token);
      const normalized = normalizeTokenSymbol(token);
      if (normalized === "WCBTC" || normalized === "CBTC") {
        console.debug(`[PRICING] getFiatValue("${token}") → rate=${rate}, amount=${amount}, result=${rate * amount}`);
      }
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
