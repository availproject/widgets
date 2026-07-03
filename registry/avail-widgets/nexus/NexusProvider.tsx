"use client";
import {
  type ChainBalance,
  createNexusClient,
  type EthereumProvider,
  type NexusClient,
  type NexusNetwork,
  type OnAllowanceHookData,
  type OnIntentHookData,
  type OnSwapIntentHookData,
  type SupportedChainsAndTokensResult,
  type TokenBalance,
} from "@avail-project/nexus-core";
import { getCoinbaseRates } from "@avail-project/nexus-core/utils";

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
  isSwapSupportedBySdkChainList,
  type SdkChainListWithSwapSupport,
} from "../common/utils/constant";
import {
  buildUsdPeggedSymbolSet,
  DEFAULT_USD_PEGGED_TOKEN_SYMBOLS,
  fetchCoinbaseUsdRate,
  fetchCoinGeckoUsdRate,
  getCoinbaseSymbolCandidates,
  normalizeTokenSymbol,
  resolveBaseSymbol,
  toFinitePositiveNumber,
  TOKEN_PRICE_PEGS,
  TokenPricingError,
  USD_PEGGED_FALLBACK_RATE,
} from "../common/utils/token-pricing";

interface NexusContextType {
  allowance: RefObject<OnAllowanceHookData | null>;
  attachEventHooks: () => void;
  bridgableBalance: UserAsset[] | null;
  deinitializeNexus: () => Promise<void>;
  exchangeRate: Record<string, number> | null;
  fetchBridgableBalance: () => Promise<void>;
  fetchSwapBalance: () => Promise<UserAsset[] | null>;
  getFiatValue: (amount: number, token: string) => number;
  handleInit: (provider: EthereumProvider) => Promise<void>;
  initializeNexus: (provider: EthereumProvider) => Promise<void>;
  intent: RefObject<OnIntentHookData | null>;
  loading: boolean;
  network?: NexusNetwork;
  nexusSDK: NexusClient | null;
  resolveTokenUsdRate: (tokenSymbol: string) => Promise<number | null>;
  setAllowance: (data: OnAllowanceHookData | null) => void;
  setIntent: (data: OnIntentHookData | null) => void;
  supportedChainsAndTokens: SupportedChainsAndTokensResult | null;
  swapBalance: UserAsset[] | null;
  swapIntent: RefObject<OnSwapIntentHookData | null>;
  swapSupportedChainsAndTokens: SupportedChainsResult | null;
}

export const NexusContext = createContext<NexusContextType | undefined>(
  undefined,
);

type NexusProviderProps = {
  children: React.ReactNode;
  config?: {
    network?: NexusNetwork;
    debug?: boolean;
    mode?: "deposit" | "swap" | "send";
  };
};

const defaultConfig: NexusProviderProps["config"] = {
  // this is place to switch between "canary" and "mainnet"
  network: "mainnet",
  debug: true,
};

type SourceBalance = ChainBalance & {
  balanceInFiat?: number | string;
  value?: number | string;
};

type TokenBalanceWithSources = Omit<TokenBalance, "chainBalances"> & {
  balanceInFiat?: number | string;
  breakdown?: SourceBalance[];
  chainBalances?: SourceBalance[];
  value?: number | string;
};

const sumSourceBalances = (sources: SourceBalance[]) =>
  sources.reduce((sum, source) => {
    const balance = Number.parseFloat(String(source.balance ?? "0"));
    return Number.isFinite(balance) && balance > 0 ? sum + balance : sum;
  }, 0);

const getSourceBalanceChainId = (source: SourceBalance) =>
  source.chain?.id ?? (source as SourceBalance & { chainId?: number }).chainId;

const filterUnsupportedSwapSources = (
  assets: TokenBalance[] | null,
  swapSupportedChains?: SdkChainListWithSwapSupport,
): TokenBalance[] | null => {
  if (!assets) {
    return null;
  }

  return assets.flatMap((asset) => {
    const assetWithSources = asset as TokenBalanceWithSources;
    const sourceBalances =
      assetWithSources.chainBalances ?? assetWithSources.breakdown ?? [];
    const filteredSources = sourceBalances.filter((source) =>
      isSwapSupportedBySdkChainList(
        getSourceBalanceChainId(source),
        swapSupportedChains,
      ),
    );

    if (filteredSources.length === 0) {
      return [];
    }

    return [
      {
        ...asset,
        balance: String(sumSourceBalances(filteredSources)),
        balanceInFiat: undefined,
        breakdown: filteredSources,
        chainBalances: filteredSources,
        value: "0",
      } as TokenBalance,
    ];
  });
};

const NexusProvider = ({
  children,
  config = defaultConfig,
}: NexusProviderProps) => {
  const configNetwork = config?.network;
  const configDebug = config?.debug;
  const configMode = config?.mode;
  const stableConfig = useMemo(
    () => ({ ...defaultConfig, ...config }),
    [config],
  );

  console.log("NEXUS PROVIDER CONFIG", stableConfig, defaultConfig, config);

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
  const swapBalanceRef = useRef<UserAsset[] | null>(null);
  const [exchangeRateState, setExchangeRateState] = useState<Record<
    string,
    number
  > | null>(null);
  const exchangeRate = useRef<Record<string, number> | null>(null);
  const coinbaseUsdRateCache = useRef<Record<string, number>>({});
  const coinbaseUsdRateRequests = useRef<
    Record<string, Promise<number | null>>
  >({});
  const initRequest = useRef<Promise<void> | null>(null);
  const bridgableBalanceRequest = useRef<Promise<UserAsset[] | null> | null>(
    null,
  );
  const swapBalanceRequest = useRef<Promise<UserAsset[] | null> | null>(null);
  const lastSwapBalanceFetchAt = useRef(0);
  const usdPeggedSymbols = useRef<Set<string>>(
    new Set(DEFAULT_USD_PEGGED_TOKEN_SYMBOLS),
  );

  const intent = useRef<OnIntentHookData | null>(null);
  const allowance = useRef<OnAllowanceHookData | null>(null);
  const swapIntent = useRef<OnSwapIntentHookData | null>(null);

  useEffect(() => {
    let cancelled = false;
    console.log("NEXUS CONFIG", stableConfig);
    const nextSdk = createNexusClient({
      network: stableConfig.network,
      debug: stableConfig.debug,
    });

    void nextSdk
      .initialize()
      .then(() => {
        if (cancelled) {
          return;
        }
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
    if (!(normalized && rate)) {
      return;
    }

    coinbaseUsdRateCache.current[normalized] = rate;
    const currentRates = exchangeRate.current ?? {};
    if (currentRates[normalized] === rate) {
      return;
    }

    const nextRates = {
      ...currentRates,
      [normalized]: rate,
    };
    exchangeRate.current = nextRates;
    setExchangeRateState(nextRates);
  }, []);

  const getUsdRateFromLocalSources = useCallback((tokenSymbol: string) => {
    const normalizedSymbol = normalizeTokenSymbol(tokenSymbol);
    if (!normalizedSymbol) {
      return 0;
    }

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
        return sdkRate;
      }

      const cachedRate = toFinitePositiveNumber(
        coinbaseUsdRateCache.current[candidate],
      );
      if (cachedRate) {
        return cachedRate;
      }
    }

    // 2. Explicit pegging fallback (e.g. WCBTC→BTC, WETH→ETH) — checked
    //    BEFORE usdPeggedSymbols so the SDK's dynamic set can't override it.
    const baseSymbol = resolveBaseSymbol(normalizedSymbol);
    if (baseSymbol) {
      if (usdPeggedSymbols.current.has(baseSymbol) || baseSymbol === "USD") {
        if (_debug)
          console.debug(
            `[PRICING DEBUG] "${normalizedSymbol}" → base "${baseSymbol}" is USD-pegged, returning 1`,
          );
        return USD_PEGGED_FALLBACK_RATE;
      }
      for (const candidate of getCoinbaseSymbolCandidates(baseSymbol)) {
        const sdkRate = toFinitePositiveNumber(
          exchangeRate.current?.[candidate],
        );
        if (sdkRate) {
          if (_debug)
            console.debug(
              `[PRICING DEBUG] "${normalizedSymbol}" → base "${baseSymbol}" → SDK candidate "${candidate}" = ${sdkRate}`,
            );
          return sdkRate;
        }

        const cachedRate = toFinitePositiveNumber(
          coinbaseUsdRateCache.current[candidate],
        );
        if (cachedRate) {
          if (_debug)
            console.debug(
              `[PRICING DEBUG] "${normalizedSymbol}" → base "${baseSymbol}" → cached candidate "${candidate}" = ${cachedRate}`,
            );
          return cachedRate;
        }
      }
      if (_debug)
        console.debug(
          `[PRICING DEBUG] "${normalizedSymbol}" → base "${baseSymbol}" NOT found in any source`,
        );
    }

    // 3. Dynamic USD-pegged set (only if no explicit peg was defined)
    if (!baseSymbol && usdPeggedSymbols.current.has(normalizedSymbol)) {
      if (_debug)
        console.debug(
          `[PRICING DEBUG] "${normalizedSymbol}" → in usdPeggedSymbols, returning 1`,
        );
      return USD_PEGGED_FALLBACK_RATE;
    }

    if (_debug)
      console.debug(
        `[PRICING DEBUG] "${normalizedSymbol}" → NO RATE FOUND, returning 0`,
      );
    return 0;
  }, []);

  useEffect(() => {
    if (!sdk) {
      return;
    }

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
        if (cancelled) {
          return;
        }
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
      if (!assets) {
        return null;
      }

      return assets.map((asset) => {
        const assetWithSources = asset as TokenBalanceWithSources;
        let computedAssetUsd = 0;
        const sourceBalances =
          assetWithSources.chainBalances ?? assetWithSources.breakdown ?? [];

        const breakdown = sourceBalances.map((entry) => {
          const balance = Number.parseFloat(String(entry.balance ?? "0"));
          const safeBalance =
            Number.isFinite(balance) && balance > 0 ? balance : 0;
          const entrySymbol = normalizeTokenSymbol(
            entry.symbol ?? asset.symbol,
          );
          const existingUsd = Number.parseFloat(
            String(entry.value ?? entry.balanceInFiat ?? "0"),
          );
          const safeExistingUsd =
            Number.isFinite(existingUsd) && existingUsd >= 0 ? existingUsd : 0;

          // For pegged tokens (e.g. wcBTC→BTC) the SDK may return a
          // bogus 1:1 USD value — always recalculate with our rate.
          const hasPeg = Boolean(resolveBaseSymbol(entrySymbol));

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
          String(
            assetWithSources.value ?? assetWithSources.balanceInFiat ?? "0",
          ),
        );
        const safeAssetUsd =
          Number.isFinite(rawAssetUsd) && rawAssetUsd >= 0 ? rawAssetUsd : 0;
        const assetHasPeg = Boolean(
          resolveBaseSymbol(normalizeTokenSymbol(asset.symbol)),
        );

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
        } as UserAsset;
      });
    },
    [getUsdRateFromLocalSources],
  );

  const resolveTokenUsdRate = useCallback(
    async (tokenSymbol: string) => {
      const normalizedSymbol = normalizeTokenSymbol(tokenSymbol);
      if (!normalizedSymbol) {
        return null;
      }

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

  const initializedRef = useRef(false);

  const setIntent = useCallback((data: OnIntentHookData | null) => {
    intent.current = data;
  }, []);

  const setAllowance = useCallback((data: OnAllowanceHookData | null) => {
    allowance.current = data;
  }, []);

  const setupNexus = useCallback(async () => {
    const activeSdk = sdkRef.current;
    if (!activeSdk) {
      return;
    }
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
      const rawSwapBalance = swapBalanceResult.value;
      const filteredSwapBalance = filterUnsupportedSwapSources(
        rawSwapBalance,
        swapList,
      );
      const normalizedSwapBalance =
        normalizeUserAssetFiatValues(filteredSwapBalance);
      console.log(
        "[NexusProvider] getBalancesForSwap:init raw",
        rawSwapBalance,
      );
      setSwapBalance(normalizedSwapBalance);
    }
  }, [config?.network, normalizeUserAssetFiatValues]);

  const initializeNexus = useCallback(
    async (provider: EthereumProvider) => {
      setLoading(true);
      try {
        console.log("INITIALIZE NEXUS CONFIG", stableConfig);
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

  const deinitializeNexus = useCallback(() => {
    try {
      const activeSdk = nexusSDK ?? sdkRef.current;
      if (!activeSdk) {
        return Promise.resolve();
      }
      activeSdk.destroy();
      initializedRef.current = false;
      setNexusSDK(null);
      setBridgableBalance(null);
      swapBalanceRef.current = null;
      setSwapBalance(null);
      intent.current = null;
      swapIntent.current = null;
      allowance.current = null;
      setLoading(false);
    } catch (error) {
      console.error("Error deinitializing Nexus:", error);
    }
    return Promise.resolve();
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

      const nextInitRequest = (async () => {
        await initializeNexus(provider);
        await setupNexus();
        attachEventHooks();
      })();

      initRequest.current = nextInitRequest;
      try {
        await nextInitRequest;
      } catch (error) {
        console.error("Error during Nexus setup flow:", error);
        throw error;
      } finally {
        if (initRequest.current === nextInitRequest) {
          initRequest.current = null;
        }
      }
    },
    [loading, initializeNexus, setupNexus, attachEventHooks],
  );

  const fetchBridgableBalance = useCallback(async () => {
    let request = bridgableBalanceRequest.current;
    try {
      const activeSdk = sdkRef.current;
      if (!activeSdk) {
        return;
      }
      const updatedBalance = await activeSdk.getBalancesForBridge();
      setBridgableBalance(normalizeUserAssetFiatValues(updatedBalance));
    } catch (error) {
      console.error("Error fetching bridgable balance:", error);
    } finally {
      if (request && bridgableBalanceRequest.current === request) {
        bridgableBalanceRequest.current = null;
      }
    }
  }, [normalizeUserAssetFiatValues]);

  const fetchSwapBalance = useCallback(async () => {
    try {
      const activeSdk = sdkRef.current;
      if (!activeSdk) {
        return null;
      }
      const updatedBalance = await activeSdk.getBalancesForSwap();
      const filteredSwapBalance = filterUnsupportedSwapSources(
        updatedBalance,
        swapSupportedChainsAndTokens.current,
      );
      const normalizedSwapBalance =
        normalizeUserAssetFiatValues(filteredSwapBalance);
      console.log(
        "[NexusProvider] getBalancesForSwap:refresh raw",
        updatedBalance,
      );
      setSwapBalance(normalizedSwapBalance);
      return normalizedSwapBalance;
    } catch (error) {
      console.error("Error fetching swap balance:", error);
      return null;
    }
  }, [normalizeUserAssetFiatValues]);

  const getFiatValue = useCallback(
    (amount: number, token: string) => {
      const rate = getUsdRateFromLocalSources(token);
      const normalized = normalizeTokenSymbol(token);
      if (normalized === "WCBTC" || normalized === "CBTC") {
        console.debug(
          `[PRICING] getFiatValue("${token}") → rate=${rate}, amount=${amount}, result=${rate * amount}`,
        );
      }
      return rate * amount;
    },
    [getUsdRateFromLocalSources],
  );

  // Backfill USD values once rates arrive so downstream selectors/max logic
  // do not treat supported assets as $0 simply due to timing.
  useEffect(() => {
    if (!exchangeRateState) {
      return;
    }
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
      swapBalance,
      network: config?.network,
      loading,
      fetchBridgableBalance,
      fetchSwapBalance,
      setAllowance,
      setIntent,
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
      stableConfig.network,
      loading,
      fetchBridgableBalance,
      fetchSwapBalance,
      setAllowance,
      setIntent,
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
