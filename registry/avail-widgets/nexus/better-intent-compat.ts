import type {
  IntentAllowance,
  IntentBalance,
  IntentEvent,
  IntentHookData,
  IntentProvider,
  IntentQuote,
  IntentRouteConstraints,
  IntentSource,
  IntentStepError,
  IntentToken,
  NexusClient,
} from "@avail-project/nexus-core";
import { formatUnits, parseUnits } from "@avail-project/nexus-core/utils";
import Decimal from "decimal.js";
import {
  CHAIN_METADATA,
  SUPPORTED_CHAINS,
  TOKEN_CONTRACT_ADDRESSES,
  TOKEN_METADATA,
} from "../common/utils/constant";

type SupportedChain = ReturnType<NexusClient["getSupportedChains"]>[number];
export type SupportedToken = IntentToken & {
  contractAddress: string;
};

export interface IntentAllowanceHookData {
  allow: () => Promise<void> | void;
  allowances: IntentAllowance[];
  deny: () => Promise<void> | void;
}

/** Providers the Better Intent middleware can name on a quote, status, or catalog entry. */
export const BETTER_INTENT_PROVIDERS: readonly IntentProvider[] = [
  "nexus-v2",
  "mayan",
  "relay",
];

/** Providers whose intents the Nexus Explorer does not index. */
const EXTERNAL_INTENT_PROVIDERS: readonly IntentProvider[] = ["mayan", "relay"];
const INTENT_ID_URL_PATTERN = /(?:^|\/)(0x[a-fA-F0-9]{64}|\d+)(?:\/)?$/;

export const isBetterIntentProvider = (
  value: unknown
): value is IntentProvider =>
  typeof value === "string" &&
  (BETTER_INTENT_PROVIDERS as readonly string[]).includes(value);

const INTENT_PROVIDER_LABELS: Record<IntentProvider, string> = {
  "nexus-v2": "Nexus",
  mayan: "Mayan",
  relay: "Relay",
};

/** Display name for the provider a quote was routed through, or undefined if it is not one. */
export const formatIntentProviderName = (value: unknown): string | undefined =>
  isBetterIntentProvider(value) ? INTENT_PROVIDER_LABELS[value] : undefined;

export const isExternalIntentProvider = (
  value: unknown
): value is IntentProvider =>
  typeof value === "string" &&
  (EXTERNAL_INTENT_PROVIDERS as readonly string[]).includes(value);

/** Extracts either a Better Intent hash or a legacy numeric ID from an explorer URL. */
export const extractIntentIdFromUrl = (url?: string | null) => {
  if (!url) {
    return undefined;
  }
  const match = url.match(INTENT_ID_URL_PATTERN);
  return match?.[1];
};

export type SupportedChainsAndTokensResult = Array<
  Omit<SupportedChain, "logo"> & {
    logo: string;
    swapSupported: boolean;
    tokens: SupportedToken[];
  }
>;

export interface ChainBalance {
  balance: string;
  chain: { id: number; logo: string; name: string };
  contractAddress: string;
  decimals: number;
  symbol: string;
  universe: "EVM" | number;
  value: string;
  totalBalance?: string;
  usableBalance?: string;
  balanceInFiat?: number;
  totalBalanceInFiat?: number;
}

export interface TokenBalance {
  balance: string;
  chainBalances: ChainBalance[];
  decimals: number;
  logo: string;
  name: string;
  symbol: string;
  value: string;
  totalBalance?: string;
  usableBalance?: string;
  balanceInFiat?: number;
  totalBalanceInFiat?: number;
}

export interface LegacyIntent {
  bridgeProvider: string | null;
  destination: {
    amount: string;
    minAmount?: string;
    minAmountUsd?: string;
    value?: string;
    chain: { id: number; logo: string; name: string };
    token: {
      contractAddress: `0x${string}`;
      decimals: number;
      logo?: string;
      symbol: string;
    };
    gas: {
      amount: string;
      value?: string;
      token: {
        contractAddress: `0x${string}`;
        decimals: number;
        symbol: string;
      };
    };
  };
  feesAndBuffer: {
    buffer: string;
    bridge: {
      caGas: string;
      caGasUsd?: string;
      fulfillmentUsd?: string;
      protocol: string;
      protocolUsd?: string;
      solver: string;
      solverUsd?: string;
      total: string;
      totalUsd?: string;
    };
  };
  fees?: {
    caGas: string;
    caGasUsd?: string;
    fulfillmentUsd?: string;
    protocol: string;
    protocolUsd?: string;
    solver: string;
    solverUsd?: string;
    total: string;
    totalUsd?: string;
  };
  sources: Array<{
    amount: string;
    /** Stable index assigned by the Better Intent quote and used by status legs. */
    sourceIndex: number;
    chain: { id: number; logo: string; name: string };
    token: {
      contractAddress: `0x${string}`;
      decimals: number;
      logo?: string;
      symbol: string;
    };
    value?: string;
  }>;
  selectedSources?: Array<{
    amount: string;
    sourceIndex?: number;
    chain: { id: number; logo: string; name: string };
    token: {
      contractAddress: `0x${string}`;
      decimals: number;
      logo?: string;
      symbol: string;
    };
    value?: string;
  }>;
  /** Total source amount when every source uses the same token symbol. */
  sourcesTotal?: string;
}

export type BridgeIntent = LegacyIntent;

export const addIntentUsdValues = (
  intent: LegacyIntent,
  getUsdRate: (symbol: string) => number
): LegacyIntent => {
  const destinationRate = getUsdRate(intent.destination.token.symbol);
  const destinationAmount = Number(intent.destination.amount);
  return {
    ...intent,
    destination: {
      ...intent.destination,
      value:
        intent.destination.value ??
        (destinationRate > 0 && Number.isFinite(destinationAmount)
          ? String(destinationAmount * destinationRate)
          : undefined),
    },
    // Better Intent fee fields are denominated in the destination token.
    // Keep them in that unit here so consumers can convert exactly once.
    feesAndBuffer: intent.feesAndBuffer,
    sources: intent.sources.map((source) => {
      const rate = getUsdRate(source.token.symbol);
      const amount = Number(source.amount);
      return {
        ...source,
        value:
          source.value ??
          (rate > 0 && Number.isFinite(amount)
            ? String(amount * rate)
            : undefined),
      };
    }),
  };
};

export interface LegacyIntentHookData {
  allow: () => void;
  deny: () => void;
  intent: LegacyIntent;
  refresh: (sources?: number[] | IntentSource[]) => Promise<LegacyIntent>;
}

export type OnIntentHookData = LegacyIntentHookData;
export type OnSwapIntentHookData = LegacyIntentHookData;

export interface LegacyAllowanceHookData {
  allow: (customAmounts?: any) => Promise<void> | void;
  deny: () => void;
  sources: Array<{
    allowance: {
      current: string;
      currentRaw: bigint;
      minimum: string;
      minimumRaw: bigint;
    };
    chain: { id: number; logo: string; name: string };
    holderAddress: `0x${string}`;
    token: {
      contractAddress: `0x${string}`;
      decimals: number;
      logo?: string;
      symbol: string;
    };
  }>;
}

export type OnAllowanceHookData = LegacyAllowanceHookData;
export type AllowanceHookSource = LegacyAllowanceHookData["sources"][number];

export type NexusClientWithCompat = NexusClient & {
  bridge?: (params: any, options?: any) => Promise<any>;
  bridgeAndTransfer?: (params: any, options?: any) => Promise<any>;
  bridgeAndExecute?: (params: any, options?: any) => Promise<any>;
  simulateBridgeAndExecute?: (params: any) => Promise<any>;
  simulateBridge?: (params: any) => Promise<any>;
  getBalancesForBridge?: (address?: `0x${string}`) => Promise<any>;
  calculateMaxForBridge?: (params: any) => Promise<any>;
  calculateMaxForSwap?: (params: any) => Promise<any>;
  convertTokenReadableAmountToBigInt?: (
    amount: string,
    tokenSymbol: string,
    chainId: number
  ) => bigint;
};

export type BridgeAndExecuteParams = any;
export type BridgeAndExecuteResult = any;
export type BridgeAndExecuteSimulationResult = any;

export type SwapMaxParams = {
  chainId?: number;
  tokenAddress?: string;
  tokenSymbol?: string;
  user?: string;
  [key: string]: unknown;
};

const sameAddress = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

const chainById = (chains: SupportedChainsAndTokensResult, chainId: number) =>
  chains.find((chain) => chain.id === chainId);

type ProviderEntry = IntentProvider | { id: IntentProvider };

const getProviderId = (provider: ProviderEntry): IntentProvider =>
  typeof provider === "string" ? provider : provider.id;

export type RawSupportedChainInput = SupportedChain & {
  swapSupported?: boolean;
  tokens?: IntentToken[];
};

export interface KnownTokenInfo {
  contractAddress: string;
  decimals: number;
  logo?: string;
  name: string;
  symbol: string;
}

export const findKnownToken = (
  chainId: number | undefined,
  address: string | undefined
): KnownTokenInfo | undefined => {
  if (!(chainId && address)) {
    return undefined;
  }

  for (const [symbol, addressMap] of Object.entries(TOKEN_CONTRACT_ADDRESSES)) {
    const knownAddress = addressMap[chainId];
    if (knownAddress && sameAddress(knownAddress, address)) {
      const meta = TOKEN_METADATA[symbol as keyof typeof TOKEN_METADATA];
      const isArcUsdc = chainId === SUPPORTED_CHAINS.ARC && symbol === "USDC";
      const decimals = isArcUsdc ? 18 : (meta?.decimals ?? 6);
      return {
        contractAddress: knownAddress,
        decimals,
        logo: meta?.logo,
        name: meta?.name ?? symbol,
        symbol,
      };
    }
  }

  if (
    sameAddress(address, "0x0000000000000000000000000000000000000000") ||
    sameAddress(address, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
  ) {
    const chainMeta = CHAIN_METADATA[chainId];
    if (chainMeta?.nativeCurrency) {
      return {
        contractAddress: address,
        decimals: chainMeta.nativeCurrency.decimals ?? 18,
        logo: chainMeta.logo,
        name: chainMeta.nativeCurrency.name ?? chainMeta.nativeCurrency.symbol,
        symbol: chainMeta.nativeCurrency.symbol,
      };
    }
  }

  return undefined;
};

export const tokenByAddress = (
  chains: SupportedChainsAndTokensResult,
  chainId: number,
  address: string
): SupportedToken | KnownTokenInfo | undefined =>
  chainById(chains, chainId)?.tokens?.find((token) =>
    sameAddress(token.contractAddress ?? token.address, address)
  ) ?? findKnownToken(chainId, address);

export const populateChainsWithTokens = (
  chains: SupportedChainsAndTokensResult,
  tokens: IntentToken[] | null | undefined
): SupportedChainsAndTokensResult => {
  if (!tokens || tokens.length === 0) {
    return chains;
  }
  const tokensByChain = new Map<number, IntentToken[]>();
  for (const token of tokens) {
    const list = tokensByChain.get(token.chainId);
    if (list) {
      list.push(token);
    } else {
      tokensByChain.set(token.chainId, [token]);
    }
  }
  return chains.map((chain) => {
    const fetched = tokensByChain.get(chain.id);
    if (!fetched || fetched.length === 0) {
      return chain;
    }
    const existing = new Set(
      chain.tokens.map((t) => (t.contractAddress ?? t.address).toLowerCase())
    );
    const merged = [...chain.tokens];
    for (const token of fetched) {
      if (!existing.has(token.address.toLowerCase())) {
        merged.push({
          ...token,
          contractAddress: token.address,
        });
      }
    }
    return {
      ...chain,
      tokens: merged,
    };
  });
};

export const normalizeSupportedChains = (
  chains: RawSupportedChainInput[] | null | undefined
): SupportedChainsAndTokensResult =>
  (chains ?? []).map((chain) => ({
    ...chain,
    logo: chain.logo ?? "",
    swapSupported: chain.capabilities?.intent ?? chain.swapSupported ?? false,
    tokens:
      chain.tokens?.map((token) => ({
        ...token,
        contractAddress: token.address,
      })) ?? [],
  }));

export const isTokenSupportedForRole = (
  chains: SupportedChainsAndTokensResult | null | undefined,
  role: "source" | "destination",
  chainId: number | undefined,
  tokenAddress: string
): boolean => {
  if (!chains || chainId === undefined) {
    return true;
  }
  const chain = chainById(chains, chainId);
  if (!chain) {
    return false;
  }

  const chainDirectional =
    role === "source" ? chain.asSource : chain.asDestination;
  const chainProviderIds = new Set(
    (chainDirectional ?? chain.providers ?? []).map(getProviderId)
  );

  const tokens = chain.tokens ?? [];
  const token = tokens.find((entry) =>
    sameAddress(entry.contractAddress ?? entry.address, tokenAddress)
  );

  if (!token) {
    if (tokens.length === 0) {
      return chainProviderIds.size > 0;
    }
    return false;
  }

  const tokenDirectional =
    role === "source" ? token.asSource : token.asDestination;
  const tokenProviderIds = (tokenDirectional ?? token.providers ?? []).map(
    getProviderId
  );

  // Route-constrained chain support comes from /chains, while token support
  // comes from the combined SDK catalog. A token is selectable only when the
  // same provider supports both the chain and token in the requested role.
  return (
    tokenProviderIds.length === 0 ||
    tokenProviderIds.some((provider) => chainProviderIds.has(provider))
  );
};

export type GetRouteSupportedChains = (
  constraints: IntentRouteConstraints
) => Promise<SupportedChainsAndTokensResult>;

export const normalizeIntentBalances = (
  balances: IntentBalance[],
  chains: SupportedChainsAndTokensResult
): TokenBalance[] => {
  const grouped = new Map<string, TokenBalance>();

  for (const entry of balances) {
    if (!entry.usable) {
      continue;
    }
    const readable = formatUnits(entry.balanceRaw, entry.decimals);
    const chain = chainById(chains, entry.chainId);
    const token = tokenByAddress(chains, entry.chainId, entry.tokenAddress);
    const identity = `${entry.symbol.toUpperCase()}:${entry.decimals}`;
    const chainBalance: ChainBalance = {
      balance: readable,
      value: String(entry.valueUsd ?? 0),
      symbol: entry.symbol,
      chain: {
        id: entry.chainId,
        logo: chain?.logo ?? "",
        name: chain?.name ?? `Chain ${entry.chainId}`,
      },
      contractAddress: entry.tokenAddress,
      decimals: entry.decimals,
      universe: "EVM",
    };
    const existing = grouped.get(identity);
    if (existing) {
      existing.chainBalances.push(chainBalance);
      existing.balance = String(Number(existing.balance) + Number(readable));
      existing.value = String(
        Number(existing.value) + Number(entry.valueUsd ?? 0)
      );
      continue;
    }
    grouped.set(identity, {
      balance: readable,
      value: String(entry.valueUsd ?? 0),
      chainBalances: [chainBalance],
      decimals: entry.decimals,
      logo: token?.logo ?? entry.logo ?? "",
      name: entry.name,
      symbol: entry.symbol,
    });
  }

  return [...grouped.values()];
};

export const normalizeIntentQuote = (
  quote: IntentQuote,
  chains: SupportedChainsAndTokensResult
): LegacyIntent => {
  const outputChain = chainById(chains, quote.output.chainId);
  const outputToken = tokenByAddress(
    chains,
    quote.output.chainId,
    quote.output.tokenAddress
  );
  const inputSymbol = quote.input[0]?.tokenSymbol;
  const knownInputMeta = inputSymbol
    ? TOKEN_METADATA[inputSymbol as keyof typeof TOKEN_METADATA]
    : undefined;
  const isArcUsdcOutput =
    quote.output.chainId === SUPPORTED_CHAINS.ARC &&
    (outputToken?.symbol === "USDC" || inputSymbol === "USDC");
  const outputDecimals =
    outputToken?.decimals ??
    (isArcUsdcOutput ? 18 : knownInputMeta?.decimals) ??
    18;
  const sources = quote.input.map((entry, sourceIndex) => {
    const chain = chainById(chains, entry.chainId);
    const token = tokenByAddress(chains, entry.chainId, entry.tokenAddress);
    const knownMeta = entry.tokenSymbol
      ? TOKEN_METADATA[entry.tokenSymbol as keyof typeof TOKEN_METADATA]
      : undefined;
    const isArcUsdcSource =
      entry.chainId === SUPPORTED_CHAINS.ARC && entry.tokenSymbol === "USDC";
    const decimals =
      token?.decimals ??
      (isArcUsdcSource ? 18 : knownMeta?.decimals) ??
      outputDecimals;
    return {
      amount: formatUnits(entry.amountRaw, decimals),
      value: entry.amountUsd,
      sourceIndex,
      chain: {
        id: entry.chainId,
        logo: chain?.logo ?? "",
        name: chain?.name ?? `Chain ${entry.chainId}`,
      },
      token: {
        contractAddress: entry.tokenAddress,
        decimals,
        logo: token?.logo ?? knownMeta?.logo,
        symbol: entry.tokenSymbol,
      },
    };
  });
  const sourceSymbols = new Set(
    quote.input.map((entry) => entry.tokenSymbol.trim().toUpperCase())
  );
  const sourcesTotal =
    sourceSymbols.size === 1
      ? quote.input
          .reduce(
            (total, entry, index) =>
              total.plus(
                formatUnits(
                  entry.totalRequiredRaw,
                  sources[index]?.token.decimals ?? outputDecimals
                )
              ),
            new Decimal(0)
          )
          .toString()
      : undefined;
  const displayedFeeTotalRaw =
    quote.fees.depositRaw + quote.fees.protocolRaw + quote.fees.solverRaw;
  const displayedFeeTotalUsd = new Decimal(quote.fees.depositUsd)
    .plus(quote.fees.protocolUsd)
    .plus(quote.fees.solverUsd)
    .toString();

  const bridgeFees = {
      // The legacy UI reads `caGas` as its network-fee slot. Better Intent's
      // source-side network fee is `depositRaw`; `caGasRaw` is not shown
      // separately because it can overlap other fee components.
      caGas: formatUnits(quote.fees.depositRaw, outputDecimals),
      caGasUsd: quote.fees.depositUsd,
      fulfillmentUsd: quote.fees.fulfillmentUsd,
      protocol: formatUnits(quote.fees.protocolRaw, outputDecimals),
      protocolUsd: quote.fees.protocolUsd,
      solver: formatUnits(quote.fees.solverRaw, outputDecimals),
      solverUsd: quote.fees.solverUsd,
      total: formatUnits(displayedFeeTotalRaw, outputDecimals),
      totalUsd: displayedFeeTotalUsd,
    };

    return {
      bridgeProvider: quote.provider ?? null,
      destination: {
        amount: formatUnits(quote.output.amountRaw, outputDecimals),
        minAmount: formatUnits(quote.output.minAmountRaw, outputDecimals),
        minAmountUsd: quote.output.minAmountUsd,
        value: quote.output.amountUsd,
        chain: {
          id: quote.output.chainId,
          logo: outputChain?.logo ?? "",
          name: outputChain?.name ?? `Chain ${quote.output.chainId}`,
        },
        token: {
          contractAddress: quote.output.tokenAddress,
          decimals: outputDecimals,
          logo: outputToken?.logo ?? knownInputMeta?.logo,
          symbol: outputToken?.symbol ?? inputSymbol ?? "",
        },
        gas: {
          amount: "0",
          value: "0",
          token: {
            contractAddress: "0x0000000000000000000000000000000000000000",
            decimals:
              outputChain?.nativeCurrency?.decimals ??
              CHAIN_METADATA[quote.output.chainId]?.nativeCurrency?.decimals ??
              18,
            symbol:
              outputChain?.nativeCurrency?.symbol ??
              CHAIN_METADATA[quote.output.chainId]?.nativeCurrency?.symbol ??
              "",
          },
        },
      },
      feesAndBuffer: {
        buffer: "0",
        bridge: bridgeFees,
      },
      fees: bridgeFees,
      sources,
      selectedSources: sources,
      ...(sourcesTotal === undefined ? {} : { sourcesTotal }),
    };
  };

const normalizeRefreshSources = (
  sources: number[] | IntentSource[] | undefined,
  quote: IntentQuote
): IntentSource[] | undefined => {
  if (!sources || sources.length === 0) {
    return undefined;
  }
  if (typeof sources[0] !== "number") {
    return sources as IntentSource[];
  }
  return (sources as number[]).flatMap((chainId) => {
    const input = quote.input.find((entry) => entry.chainId === chainId);
    return input ? [{ chainId, tokenAddress: input.tokenAddress }] : [];
  });
};

export const adaptIntentHook = (
  data: IntentHookData,
  chains: SupportedChainsAndTokensResult
): LegacyIntentHookData => ({
  allow: data.allow,
  deny: data.deny,
  intent: normalizeIntentQuote(data.quote, chains),
  refresh: async (sources) =>
    normalizeIntentQuote(
      await data.refresh(normalizeRefreshSources(sources, data.quote)),
      chains
    ),
});

export const adaptAllowanceHook = (
  data: IntentAllowanceHookData,
  chains: SupportedChainsAndTokensResult
): LegacyAllowanceHookData => ({
  allow: data.allow,
  deny: data.deny,
  sources: data.allowances.map((allowance) => {
    const chain = chainById(chains, allowance.chainId);
    const token = tokenByAddress(
      chains,
      allowance.chainId,
      allowance.tokenAddress
    );
    const decimals = token?.decimals ?? 18;
    return {
      allowance: {
        current: formatUnits(allowance.currentRaw, decimals),
        currentRaw: allowance.currentRaw,
        minimum: formatUnits(allowance.requiredRaw, decimals),
        minimumRaw: allowance.requiredRaw,
      },
      chain: {
        id: allowance.chainId,
        logo: chain?.logo ?? "",
        name: chain?.name ?? `Chain ${allowance.chainId}`,
      },
      holderAddress: allowance.owner,
      token: {
        contractAddress: allowance.tokenAddress,
        decimals,
        logo: token?.logo,
        symbol: token?.symbol ?? "",
      },
    };
  }),
});

export type LegacyPlanEvent =
  | { type: "plan_preview"; plan: { steps: IntentQuote["plan"]["steps"] } }
  | { type: "plan_confirmed"; plan: { steps: IntentQuote["plan"]["steps"] } }
  | {
      type: "plan_progress";
      stepType: string;
      state: string;
      step: IntentQuote["plan"]["steps"][number];
      committed?: boolean;
      error?: unknown;
      errorDetails?: IntentStepError;
    }
  | IntentEvent;

export type BridgeEvent = LegacyPlanEvent;

export const adaptIntentEvent = (event: IntentEvent): LegacyPlanEvent => {
  if (event.type === "quote") {
    return { type: "plan_preview", plan: event.quote.plan };
  }
  if (event.type === "step") {
    return {
      type: "plan_progress",
      stepType: event.step.type,
      state: event.state,
      step: event.step,
      committed: event.committed,
      error: event.errorDetails ?? event.error,
      errorDetails: event.errorDetails,
    };
  }
  return event;
};

export const convertTokenReadableAmountToBigInt = (
  amount: string,
  tokenSymbol: string,
  chainId: number,
  chains?: SupportedChainsAndTokensResult | null,
): bigint => {
  const token =
    chains
      ?.flatMap((c) => (c.id === chainId ? c.tokens : []))
      ?.find((t) => t.symbol?.toUpperCase() === tokenSymbol.toUpperCase()) ??
    findKnownToken(
      chainId,
      TOKEN_CONTRACT_ADDRESSES[tokenSymbol.toUpperCase()]?.[chainId]
    );
  const decimals =
    token?.decimals ??
    TOKEN_METADATA[tokenSymbol as keyof typeof TOKEN_METADATA]?.decimals ??
    18;
  return parseUnits(amount, decimals);
};

export const resolveTokenContractAddress = (
  chainId: number,
  tokenSymbolOrAddress: string,
  chains?: SupportedChainsAndTokensResult | null,
): `0x${string}` => {
  if (tokenSymbolOrAddress.startsWith("0x")) {
    return tokenSymbolOrAddress as `0x${string}`;
  }
  const known = TOKEN_CONTRACT_ADDRESSES[tokenSymbolOrAddress.toUpperCase()]?.[chainId];
  if (known) return known;

  const found = chains
    ?.flatMap((c) => (c.id === chainId ? c.tokens : []))
    ?.find((t) => t.symbol?.toUpperCase() === tokenSymbolOrAddress.toUpperCase());
  if (found?.contractAddress) return found.contractAddress as `0x${string}`;
  if (found?.address) return found.address as `0x${string}`;

  return "0x0000000000000000000000000000000000000000";
};
