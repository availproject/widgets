// biome-ignore-all lint: NexusWidget registry component from shadcn registry.
"use client";

import {
  ERROR_CODES,
  type EthereumProvider,
} from "@avail-project/nexus-core";
import Decimal from "decimal.js";
import { AlertCircle, ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  http,
  isAddress,
  parseUnits,
  zeroAddress,
} from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import {
  useAccount,
  useConnect,
  useConnectorClient,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { ErrorBoundary } from "../common/components/ErrorBoundary";
import { useTransactionSteps } from "../common/tx/useTransactionSteps";
import type {
  BridgeStepType,
  SwapStepType,
} from "../common/types/transaction-flow";
import {
  CHAIN_METADATA,
  getShortChainName,
  isSwapSupportedBySdkChainList,
  SUPPORTED_CHAINS,
  TOKEN_CONTRACT_ADDRESSES,
  TOKEN_METADATA,
} from "../common/utils/constant";
import { type UserAsset, useNexus } from "../nexus/NexusProvider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { DepositIdleForm } from "./components/deposit-idle-form";
import {
  type NexusWidgetProgressEvent,
  NexusWidgetProgressScreen,
} from "./components/nexus-widget-progress-screen";
import {
  getCachedReceiveTokenMatch,
  preloadReceiveTokens,
  ReceiveAssetSelector,
} from "./components/receive-asset-selector";
import { RecipientInput } from "./components/recipient-input";
import { SendIdleForm } from "./components/send-idle-form";
import { StatusAlert } from "./components/status-alerts";
import {
  deriveTokenOptions,
  SwapAssetSelector,
  type SwapTokenOption,
} from "./components/swap-asset-selector";
import { SwapIdleForm } from "./components/swap-idle-form";
import {
  type BridgeProvider,
  type SwapIntentData,
  type SwapIntentDestination,
  type SwapIntentSource,
  SwapIntentPreview,
} from "./components/swap-intent-preview";
import {
  NEXUS_WIDGET_DEFAULT_PRIMARY_COLOR,
  nexusWidgetTheme,
} from "./theme";
import {
  type NexusWidgetAppearance,
  type NexusWidgetConfig,
  type NexusWidgetDepositConfig,
  type NexusWidgetDestination,
  type NexusWidgetDestinationToken,
  type NexusWidgetDepositOpportunityConfig,
  type NexusWidgetDepositOpportunityMetadata,
  type NexusWidgetMode,
  type NexusWidgetPrefillToken,
  type NexusWidgetProps,
  type NexusWidgetRuntimePrefill,
  type SwapType,
} from "./types";
import { findCitreaReceiveToken } from "./utils/citrea-tokens";
import {
  type DepositSourceFilter,
  getDepositSourceId,
  resolveDepositSourceSelection,
} from "./utils/deposit-source-selection";

// ---------------------------------------------------------------------------
// Types for swap step machine
// ---------------------------------------------------------------------------

type SwapStep =
  | "idle" // main screen
  | "choose-swap-asset" // pick source token
  | "choose-receive-asset" // pick receive token
  | "enter-recipient" // pick recipient (send mode)
  | "preview-intent" // intent preview card
  | "progress" // transaction in flight
  | "success" // completed seamlessly
  | "failed" // failed swap receipt
  | "history"; // transaction history

type SourceFilterTab = "all" | "native" | "stables";

type SwapHistoryStatus =
  | "pending"
  | "fulfilled"
  | "failed"
  | "timeout"
  | "refund-initiated";

interface SwapHistoryEntry {
  autoRefundAvailable?: boolean;
  createdAt: number;
  durationSeconds?: number;
  endedAt?: number;
  error?: string;
  failedStepType?: string;
  failureDescription?: string;
  failureMessage?: string;
  feeUsd?: string;
  finalExplorerUrl?: string | null;
  fromTokens: SwapTokenOption[];
  id: string;
  intentData: SwapIntentData | null;
  intentExplorerUrl?: string | null;
  intentId?: number;
  mode: NexusWidgetMode;
  opportunity?: NexusWidgetDepositOpportunityMetadata;
  recipientAddress?: string;
  requestedToAmount?: string;
  requestedToValue?: string;
  sourceExplorerUrl?: string | null;
  startedAt: number;
  status: SwapHistoryStatus;
  toToken?: SwapTokenOption;
}

type HistorySourceRow = {
  amount: string;
  chainLogo?: string;
  chainName: string;
  key: string;
  symbol: string;
  tokenLogo?: string;
  value?: unknown;
};

type SwapQuoteIssue = {
  type: "insufficientSources";
  message: string;
  missingUsd?: string;
};

type ReceiveAmountIssue = {
  ctaLabel: string;
  message: string;
  type: "configuredAmountLimit" | "receiveLimitExceeded" | "unpricedReceiveToken";
};

type CachedMaxSwapQuote = {
  decimals: number;
  maxTokenAmount: Decimal;
  maxUsdAmount?: Decimal;
  symbol: string;
};

type CachedIntentUsdRate = {
  amount: string;
  rate: string;
  updatedAt: number;
  value: string;
};

type PredictiveQuote = {
  key: string;
  mode: "exactIn" | "exactOut";
  sources?: SwapTokenOption[];
  toAmount?: string;
  toUsd?: string;
};

type PredictiveQuoteBaseline = {
  destinationUsdRate: string;
  exactInDestinationAmountPerSourceUsd?: string;
  exactOutSourceUsdPerDestinationUsd?: string;
  updatedAt: number;
};

const DESTINATION_RECEIVE_LIMIT_USD_BY_CHAIN_ID: Record<number, number> = {
  [SUPPORTED_CHAINS.MEGAETH]: 10_000,
  [SUPPORTED_CHAINS.CITREA]: 2000,
  [SUPPORTED_CHAINS.SCROLL]: 500,
};

const SCIENTIFIC_DECIMAL_REGEX = /^-?(?:\d+\.?\d*|\.\d+)e[+-]?\d+$/i;

const QUOTE_REFRESH_INTERVAL_MS = 30000;
const EXACT_OUT_INPUT_DEBOUNCE_MS = 1300;
const DRAWER_CLOSE_MS = 220;
const BALANCE_REFRESH_AFTER_TERMINAL_MS = 5000;
const MODAL_HEIGHT_TRANSITION_MS = 220;
const ROOT_HEIGHT_TRANSITION_MS = 140;
const ASSET_SELECTOR_DRAWER_HEIGHT = "90%";
const TOKEN_SELECTOR_MIN_ROOT_CONTENT_HEIGHT = 620;
const CONFIGURED_RECEIVE_SELECTOR_BASE_HEIGHT = 170;
const CONFIGURED_RECEIVE_SELECTOR_ROW_HEIGHT = 62;
const BASIS_POINTS = 10000;
const PREDICTIVE_EXACT_IN_DISCOUNT_BPS = 50;
const PREDICTIVE_EXACT_OUT_BUFFER_BPS = 100;
const PREDICTIVE_QUOTE_DISPLAY_DECIMALS = 8;
const DEPOSIT_TOKEN_DISPLAY_DECIMALS = 8;
const SWAP_HISTORY_STORAGE_KEY_PREFIX = "nexus-widget-transaction-history-v1";
const TIMEOUT_LABEL = "Timed Out";
const PROGRESS_EVENT_NAMES = {
  BRIDGE_PLAN_LIST: "bridge_plan_list",
  BRIDGE_PLAN_PROGRESS: "bridge_plan_progress",
  SWAP_PLAN_LIST: "swap_plan_list",
  SWAP_PLAN_PROGRESS: "swap_plan_progress",
} as const;
const PLAN_FINAL_STATES = new Set(["completed", "confirmed", "submitted"]);
const PLAN_STEP_FUNDS_MOVED_STATES = new Set([
  "completed",
  "confirmed",
  "submitted",
]);
const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !window.requestAnimationFrame) {
      resolve();
      return;
    }
    window.requestAnimationFrame(() => {
      window.setTimeout(() => resolve(), 0);
    });
  });
const theme = nexusWidgetTheme;
const tooltipSurface = theme.colors.surface;
const tooltipText = theme.colors.textStrong;
const tooltipBorder = theme.colors.border;
const uiFont = theme.fonts.sans;
const modalHeightTransitionStyle = {
  interpolateSize: "allow-keywords",
} as React.CSSProperties;

const getCappedTokenDisplayDecimals = (decimals?: number) => {
  const parsedDecimals = Number(decimals);
  if (!Number.isFinite(parsedDecimals) || parsedDecimals < 0) {
    return DEPOSIT_TOKEN_DISPLAY_DECIMALS;
  }
  return Math.min(Math.floor(parsedDecimals), DEPOSIT_TOKEN_DISPLAY_DECIMALS);
};
const modalHeightTransition = `height ${MODAL_HEIGHT_TRANSITION_MS}ms ease, max-height ${MODAL_HEIGHT_TRANSITION_MS}ms ease`;

const getSwapHistoryStorageKey = (ownerAddress?: string) =>
  `${SWAP_HISTORY_STORAGE_KEY_PREFIX}:${ownerAddress?.toLowerCase() || "anonymous"}`;

const getTokenSelectionKey = (token?: SwapTokenOption | null) => {
  if (!token) return "";
  if (token.isUnified) {
    return `unified:${token.unifiedSymbol ?? token.symbol}`;
  }
  return `${token.chainId ?? "unknown"}:${token.contractAddress.toLowerCase()}`;
};

const getTokenQuoteKey = (token?: SwapTokenOption | null) => {
  if (!token) return "";
  return [
    getTokenSelectionKey(token),
    token.symbol ?? "",
    token.decimals ?? "",
  ].join(":");
};

const getSourceTokensQuoteKey = (tokens: SwapTokenOption[]) =>
  tokens
    .filter((token) => {
      const amt = token.userAmount ?? "";
      const cleaned = amt.replaceAll(/[^0-9.]/g, "");
      const num = Number.parseFloat(cleaned);
      return !Number.isNaN(num) && num > 0;
    })
    .map((token) =>
      [
        getTokenSelectionKey(token),
        token.symbol ?? "",
        token.decimals ?? "",
        token.userAmount ?? "",
        token.userAmountUsd ?? "",
        token.userAmountMode ?? "",
      ].join(":")
    )
    .join("|");

const isSameTokenSelection = (
  a?: SwapTokenOption | null,
  b?: SwapTokenOption | null
) => Boolean(a && b && getTokenSelectionKey(a) === getTokenSelectionKey(b));

const getDepositConfigIdentity = (deposit?: NexusWidgetDepositOpportunityMetadata | null) => {
  if (!deposit) return "";
  return [
    deposit.chainId,
    deposit.tokenAddress.toLowerCase(),
    deposit.tokenSymbol,
    deposit.tokenDecimals,
    deposit.protocol ?? "",
    deposit.title ?? "",
  ].join(":");
};

const isSameDepositConfig = (
  a?: NexusWidgetDepositOpportunityConfig | null,
  b?: NexusWidgetDepositOpportunityConfig | null
) => {
  if (!a || !b) return false;
  return getDepositConfigIdentity(a) === getDepositConfigIdentity(b);
};

const getConfiguredReceiveSelectorRootHeight = (tokenCount: number) => {
  if (tokenCount <= 0) return TOKEN_SELECTOR_MIN_ROOT_CONTENT_HEIGHT;
  const visibleRows = Math.min(Math.max(tokenCount, 1), 6);
  return Math.min(
    TOKEN_SELECTOR_MIN_ROOT_CONTENT_HEIGHT,
    Math.ceil(
      (CONFIGURED_RECEIVE_SELECTOR_BASE_HEIGHT +
        visibleRows * CONFIGURED_RECEIVE_SELECTOR_ROW_HEIGHT) /
        0.9
    )
  );
};

const getConfiguredDeposit = (
  config: RuntimeNexusWidgetConfig
): NexusWidgetDepositOpportunityConfig | undefined => config.deposit ?? config.deposits?.[0];

type RuntimeDestinationPair = {
  chain: number;
  decimals?: number;
  logo?: string;
  symbol?: string;
  token: `0x${string}`;
};

type RuntimeNexusWidgetAppearance = NexusWidgetAppearance & {
  logoUrl?: string;
  themeMode?: "auto" | "light" | "dark";
  widgetHeading?: string;
};

type RuntimeNexusWidgetConfig = {
  allowedDestinationChains?: number[];
  allowedDestinationPairs?: RuntimeDestinationPair[];
  allowedSourcePairs?: RuntimeDestinationPair[];
  appearance?: RuntimeNexusWidgetAppearance;
  deposit?: NexusWidgetDepositOpportunityConfig;
  deposits?: NexusWidgetDepositOpportunityConfig[];
  mode: NexusWidgetMode;
  prefill?: NexusWidgetRuntimePrefill;
};

type RuntimeNexusWidgetAmountInput = {
  max?: string;
  min?: string;
  mode: "fixed" | "user";
  value?: string;
};

type NormalizedNexusWidgetConfig = {
  activeMode: NexusWidgetMode;
  amountInput?: RuntimeNexusWidgetAmountInput;
  appearance?: RuntimeNexusWidgetAppearance;
  config: RuntimeNexusWidgetConfig;
  depositOptions: NexusWidgetDepositOpportunityConfig[];
  isAmountFixed: boolean;
  isRecipientLocked: boolean;
};

const normalizeConfiguredString = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text || undefined;
};

const normalizeConfiguredAddress = (value: unknown) => {
  const text = normalizeConfiguredString(value);
  return text && isAddress(text) ? text : undefined;
};

const normalizePositiveNumericString = (value: unknown) => {
  const text = normalizeConfiguredString(value);
  if (!text) return undefined;
  try {
    const decimal = new Decimal(text);
    return decimal.isFinite() && decimal.gt(0) ? text : undefined;
  } catch {
    return undefined;
  }
};

const normalizeNonNegativeNumericString = (value: unknown) => {
  const text = normalizeConfiguredString(value);
  if (!text) return undefined;
  try {
    const decimal = new Decimal(text);
    return decimal.isFinite() && decimal.gte(0) ? text : undefined;
  } catch {
    return undefined;
  }
};

const normalizeHttpUrlString = (value: unknown) => {
  const text = normalizeConfiguredString(value);
  if (!text) return undefined;
  return /^https?:\/\//i.test(text) ? text : undefined;
};

const normalizeNexusWidgetPrimaryColor = (value?: string) => {
  return normalizeConfiguredString(value);
};

const expandHexColor = (value: string) => {
  const text = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text;
  if (/^#[0-9a-fA-F]{3}$/.test(text)) {
    const [r, g, b] = text.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return undefined;
};

const parseNumberComponent = (value: string, max: number) => {
  const text = value.trim();
  if (!text) return undefined;
  if (text.endsWith("%")) {
    const percent = Number.parseFloat(text.slice(0, -1));
    return Number.isFinite(percent)
      ? Math.max(0, Math.min(max, (percent / 100) * max))
      : undefined;
  }
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(max, parsed)) : undefined;
};

const parseAngleComponent = (value: string) => {
  const parsed = Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed)) return undefined;
  return ((parsed % 360) + 360) % 360;
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp >= 1 && hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp >= 2 && hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp >= 3 && hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp >= 4 && hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  const m = lightness - c / 2;
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
};

const parseCssColorToRgb = (
  color: string,
  allowBrowserResolution = true
): [number, number, number] | undefined => {
  const text = normalizeConfiguredString(color);
  if (!text) return undefined;

  const hex = expandHexColor(text);
  if (hex) {
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
  }

  const rgbMatch = text.match(/^rgba?\((.*)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].trim().split(/[\s,\/]+/).filter(Boolean);
    if (parts.length >= 3) {
      const r = parseNumberComponent(parts[0], 255);
      const g = parseNumberComponent(parts[1], 255);
      const b = parseNumberComponent(parts[2], 255);
      if (r !== undefined && g !== undefined && b !== undefined) {
        return [Math.round(r), Math.round(g), Math.round(b)];
      }
    }
  }

  const hslMatch = text.match(/^hsla?\((.*)\)$/i);
  if (hslMatch) {
    const parts = hslMatch[1].trim().split(/[\s,\/]+/).filter(Boolean);
    if (parts.length >= 3) {
      const h = parseAngleComponent(parts[0]);
      const s = parseNumberComponent(parts[1], 100);
      const l = parseNumberComponent(parts[2], 100);
      if (h !== undefined && s !== undefined && l !== undefined) {
        return hslToRgb(h, s, l);
      }
    }
  }

  if (allowBrowserResolution && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      const baseline = "#010203";
      context.fillStyle = baseline;
      context.fillStyle = text;
      const resolved = String(context.fillStyle);
      if (resolved !== baseline || text.toLowerCase() === baseline) {
        return parseCssColorToRgb(resolved, false);
      }
    }
  }

  return undefined;
};

const getReadableTextColor = (background: string) => {
  const rgb = parseCssColorToRgb(background);
  if (!rgb) return "#FFFFFE";
  const [rValue, gValue, bValue] = rgb;
  const r = rValue / 255;
  const g = gValue / 255;
  const b = bValue / 255;
  const linear = [r, g, b].map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4)
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.54 ? "#161615" : "#FFFFFE";
};

const normalizeNexusWidgetAmountInput = (
  config: NexusWidgetConfig
): RuntimeNexusWidgetAmountInput | undefined => {
  if (config.mode === "swap") return undefined;
  const value = normalizePositiveNumericString(
    "amount" in (config.prefill ?? {}) ? config.prefill?.amount : undefined
  );
  const min = normalizeNonNegativeNumericString(config.validation?.minAmount);
  const max = normalizePositiveNumericString(config.validation?.maxAmount);
  return value || min || max ? { mode: "user", value, min, max } : undefined;
};

const normalizeNexusWidgetAppearance = (
  appearance?: NexusWidgetAppearance
): RuntimeNexusWidgetAppearance | undefined => {
  if (!appearance) return undefined;
  const appName = normalizeConfiguredString(appearance.appName);
  const appLogoURL = normalizeHttpUrlString(appearance.appLogoURL);
  const heading = normalizeConfiguredString(appearance.heading);
  const mode =
    appearance.mode === "dark" || appearance.mode === "light"
      ? appearance.mode
      : "system";
  const primaryColor = normalizeConfiguredString(appearance.primaryColor);
  return {
    ...appearance,
    appLogoURL,
    appName,
    heading,
    logoUrl: appLogoURL,
    mode,
    primaryColor,
    themeMode: mode === "system" ? "auto" : mode,
    widgetHeading: heading,
  };
};

const normalizeConfiguredChainId = (value: unknown) => {
  const chainId = Number(value);
  return Number.isFinite(chainId) && chainId > 0 ? chainId : undefined;
};

const getConfiguredDestinationChainId = (
  destination?: NexusWidgetDestination
) => normalizeConfiguredChainId(destination?.chain);

const getConfiguredDestinationTokenSymbol = (
  token: NexusWidgetDestinationToken
) => normalizeConfiguredString(token.symbol);

const getConfiguredDestinationTokenAddress = (
  token: NexusWidgetDestinationToken
) => normalizeConfiguredAddress(token.address);

const toSwapTokenOptionFromConfiguredDestinationToken = (
  token: NexusWidgetDestinationToken,
  chainId: number
): SwapTokenOption | undefined => {
  const contractAddress = getConfiguredDestinationTokenAddress(token);
  const symbol = getConfiguredDestinationTokenSymbol(token);
  if (!contractAddress || !symbol) return undefined;
  const chainMeta = CHAIN_METADATA[chainId];
  return {
    balance: "0",
    balanceInFiat: "$0.00",
    chainId,
    chainLogo: chainMeta?.logo,
    chainName: getShortChainName(chainId, chainMeta?.name ?? `Chain ${chainId}`),
    contractAddress,
    decimals: token.decimals ?? 18,
    logo: token.logo ?? "",
    name: symbol,
    symbol,
  };
};

const toSwapTokenOptionFromDepositConfig = (
  deposit: NexusWidgetDepositOpportunityConfig
): SwapTokenOption => {
  const chainMeta = CHAIN_METADATA[deposit.chainId];
  return {
    balance: "0",
    balanceInFiat: "$0.00",
    chainId: deposit.chainId,
    chainLogo: chainMeta?.logo,
    chainName: getShortChainName(
      deposit.chainId,
      chainMeta?.name ?? `Chain ${deposit.chainId}`
    ),
    contractAddress: deposit.tokenAddress,
    decimals: deposit.tokenDecimals,
    logo: deposit.tokenLogo || deposit.logo || "",
    name: deposit.tokenSymbol,
    symbol: deposit.tokenSymbol,
  };
};

const applyNexusWidgetAppearanceToDeposit = (
  deposit: NexusWidgetDepositOpportunityConfig,
  appearance?: RuntimeNexusWidgetAppearance
): NexusWidgetDepositOpportunityConfig => {
  const appName = normalizeConfiguredString(appearance?.appName);
  const logoUrl = normalizeConfiguredString(appearance?.logoUrl);
  if (!appName && !logoUrl) return deposit;
  return {
    ...deposit,
    depositTargetLogo: logoUrl ?? deposit.depositTargetLogo,
    logo: logoUrl ?? deposit.logo,
    protocol: appName ?? deposit.protocol,
    title: appName ?? deposit.title,
  };
};

const getConfiguredDestinationPairs = (
  destination?: NexusWidgetDestination
) => {
  const pairs: RuntimeNexusWidgetConfig["allowedDestinationPairs"] = [];
  const chain = getConfiguredDestinationChainId(destination);
  if (!chain) return pairs;
  for (const token of destination?.tokens ?? []) {
    const address = getConfiguredDestinationTokenAddress(token);
    if (!address) continue;
    pairs.push({ chain, token: address });
  }
  return pairs;
};

const hasConfiguredDestinationTokenList = (
  destination?: NexusWidgetDestination
) => Boolean(destination?.tokens?.length);

const getConfiguredPrefillTokenPair = (
  prefill?: { token?: NexusWidgetPrefillToken }
): RuntimeDestinationPair | undefined => {
  const token = prefill?.token;
  if (!token) return undefined;
  const chain = normalizeConfiguredChainId(token.chain);
  const address = getConfiguredDestinationTokenAddress(token);
  const symbol = getConfiguredDestinationTokenSymbol(token);
  if (!chain || !address || !symbol) return undefined;
  return {
    chain,
    decimals: token.decimals,
    logo: normalizeConfiguredString(token.logo),
    symbol,
    token: address,
  };
};

const getConfiguredDestinationChainIds = (
  destination?: NexusWidgetDestination
) => {
  const chain = getConfiguredDestinationChainId(destination);
  return chain ? [chain] : [];
};

const toDepositConfigFromDestination = (
  config: NexusWidgetDepositConfig,
  token: NexusWidgetDestinationToken,
  appearance?: RuntimeNexusWidgetAppearance
): NexusWidgetDepositOpportunityConfig | undefined => {
  const chainId = getConfiguredDestinationChainId(config.destination);
  const depositAddress = normalizeConfiguredAddress(config.depositAddress);
  const tokenAddress = getConfiguredDestinationTokenAddress(token);
  const tokenSymbol = getConfiguredDestinationTokenSymbol(token);
  if (
    !chainId ||
    !depositAddress ||
    !tokenAddress ||
    !tokenSymbol ||
    typeof config.executeDeposit !== "function"
  ) {
    return undefined;
  }

  const chainMeta = CHAIN_METADATA[chainId];
  return {
    chainId,
    depositTargetLogo: appearance?.logoUrl,
    executeDeposit: config.executeDeposit,
    logo: appearance?.logoUrl ?? token.logo ?? undefined,
    protocol:
      appearance?.appName ??
      appearance?.widgetHeading ??
      "Deposit",
    subtitle:
      chainMeta?.name
        ? `on ${getShortChainName(chainId, chainMeta.name)}`
        : undefined,
    title: appearance?.appName ?? appearance?.widgetHeading ?? "Deposit",
    tokenAddress,
    tokenDecimals: token.decimals ?? 18,
    tokenLogo: token.logo,
    tokenSymbol,
  };
};

const getNexusWidgetDepositOptions = (
  config: NexusWidgetConfig,
  appearance?: RuntimeNexusWidgetAppearance
) => {
  if (config.mode !== "deposit") return [];
  return (config.destination.tokens ?? [])
    .map((token) => toDepositConfigFromDestination(config, token, appearance))
    .filter((deposit): deposit is NexusWidgetDepositOpportunityConfig => Boolean(deposit));
};

const normalizeNexusWidgetConfig = (
  rawConfig: NexusWidgetConfig
): NormalizedNexusWidgetConfig => {
  const appearance = normalizeNexusWidgetAppearance(rawConfig.appearance);
  const amountInput = normalizeNexusWidgetAmountInput(rawConfig);
  const prefill: NexusWidgetRuntimePrefill = {};
  let activeMode: NexusWidgetMode =
    rawConfig.mode === "deposit" ||
    rawConfig.mode === "send" ||
    rawConfig.mode === "swap"
      ? rawConfig.mode
      : "swap";
  let isRecipientLocked = false;
  const depositOptions = getNexusWidgetDepositOptions(rawConfig, appearance).map(
    (deposit) => applyNexusWidgetAppearanceToDeposit(deposit, appearance)
  );
  let allowedDestinationPairs:
    | RuntimeNexusWidgetConfig["allowedDestinationPairs"]
    | undefined;
  let allowedDestinationChains:
    | RuntimeNexusWidgetConfig["allowedDestinationChains"]
    | undefined;

  if (amountInput?.value) {
    prefill.amount = amountInput.value;
  }

  if (rawConfig.mode === "deposit") {
    activeMode = "deposit";
    const pairs = getConfiguredDestinationPairs(rawConfig.destination);
    if (pairs.length > 0) {
      allowedDestinationPairs = pairs;
      prefill.destination = pairs[0];
    }
    const chainIds = getConfiguredDestinationChainIds(rawConfig.destination);
    if (chainIds.length > 0) {
      allowedDestinationChains = chainIds;
    }
  } else if (rawConfig.mode === "send") {
    const recipient = normalizeConfiguredAddress(rawConfig.recipientAddress);
    if (recipient) {
      prefill.recipient = recipient;
      isRecipientLocked = true;
    }

    const hasDestinationTokens = hasConfiguredDestinationTokenList(
      rawConfig.destination
    );
    const pairs = getConfiguredDestinationPairs(rawConfig.destination);
    if (pairs.length > 0) {
      allowedDestinationPairs = pairs;
      prefill.destination ??= pairs[0];
    } else if (!hasDestinationTokens) {
      const prefillToken = getConfiguredPrefillTokenPair(rawConfig.prefill);
      const chainIds = getConfiguredDestinationChainIds(rawConfig.destination);
      if (
        prefillToken &&
        (!chainIds.length || chainIds.includes(prefillToken.chain))
      ) {
        prefill.destination = prefillToken;
      }
    }

    const chainIds = getConfiguredDestinationChainIds(rawConfig.destination);
    if (chainIds.length > 0) {
      allowedDestinationChains = chainIds;
    }
  } else if (rawConfig.mode === "swap") {
    const recipient = normalizeConfiguredAddress(rawConfig.recipientAddress);
    if (recipient) {
      prefill.recipient = recipient;
    }

    const hasDestinationTokens = hasConfiguredDestinationTokenList(
      rawConfig.destination
    );
    const pairs = getConfiguredDestinationPairs(rawConfig.destination);
    if (pairs.length > 0) {
      allowedDestinationPairs = pairs;
      prefill.destination ??= pairs[0];
    } else if (!hasDestinationTokens) {
      const prefillToken = getConfiguredPrefillTokenPair(rawConfig.prefill);
      const chainIds = getConfiguredDestinationChainIds(rawConfig.destination);
      if (
        prefillToken &&
        (!chainIds.length || chainIds.includes(prefillToken.chain))
      ) {
        prefill.destination = prefillToken;
      }
    }

    const chainIds = getConfiguredDestinationChainIds(rawConfig.destination);
    if (chainIds.length > 0) {
      allowedDestinationChains = chainIds;
    }
  }

  const runtimeConfig: RuntimeNexusWidgetConfig = {
    allowedDestinationChains,
    allowedDestinationPairs,
    deposit:
      activeMode === "deposit"
        ? depositOptions[0]
        : undefined,
    deposits: activeMode === "deposit" ? depositOptions : [],
    appearance,
    mode: activeMode,
    prefill,
  };

  return {
    activeMode,
    amountInput,
    appearance,
    config: runtimeConfig,
    depositOptions,
    isAmountFixed: false,
    isRecipientLocked,
  };
};

const getDepositForTokenSelection = (
  deposits: NexusWidgetDepositOpportunityConfig[],
  token?: SwapTokenOption | null
) => {
  if (!token) return undefined;
  return deposits.find(
    (deposit) =>
      deposit.chainId === token.chainId &&
      deposit.tokenAddress.toLowerCase() ===
        token.contractAddress.toLowerCase()
  );
};

const sanitizeOpportunityForHistory = (
  opportunity?: NexusWidgetDepositOpportunityMetadata
): NexusWidgetDepositOpportunityMetadata | undefined => {
  if (!opportunity) return undefined;
  return {
    label: opportunity.label,
    protocol: opportunity.protocol,
    logo: opportunity.logo,
    title: opportunity.title,
    subtitle: opportunity.subtitle,
    chainId: opportunity.chainId,
    tokenSymbol: opportunity.tokenSymbol,
    tokenDecimals: opportunity.tokenDecimals,
    tokenLogo: opportunity.tokenLogo,
    tokenAddress: opportunity.tokenAddress,
    apy: opportunity.apy,
    description: opportunity.description,
  };
};

const sanitizeHistoryEntry = (entry: SwapHistoryEntry): SwapHistoryEntry => ({
  ...entry,
  createdAt: entry.createdAt ?? entry.startedAt ?? Date.now(),
  failureMessage:
    entry.status === "timeout" ? TIMEOUT_LABEL : entry.failureMessage,
  opportunity: sanitizeOpportunityForHistory(entry.opportunity),
});

const sortSwapHistoryEntries = (entries: SwapHistoryEntry[]) =>
  [...entries].sort(
    (a, b) =>
      (b.createdAt ?? b.startedAt ?? 0) - (a.createdAt ?? a.startedAt ?? 0)
  );

const isStoredHistoryStatus = (value: unknown): value is SwapHistoryStatus =>
  value === "pending" ||
  value === "fulfilled" ||
  value === "failed" ||
  value === "timeout" ||
  value === "refund-initiated";

const isStoredMode = (value: unknown): value is NexusWidgetMode =>
  value === "swap" || value === "deposit" || value === "send";

const normalizeStoredHistoryEntry = (
  value: unknown
): SwapHistoryEntry | null => {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<SwapHistoryEntry>;
  const startedAt =
    typeof entry.startedAt === "number" && Number.isFinite(entry.startedAt)
      ? entry.startedAt
      : undefined;
  const createdAt =
    typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt)
      ? entry.createdAt
      : startedAt;

  if (
    !entry.id ||
    typeof entry.id !== "string" ||
    !isStoredMode(entry.mode) ||
    !isStoredHistoryStatus(entry.status) ||
    !createdAt ||
    !startedAt
  ) {
    return null;
  }

  return {
    ...entry,
    id: entry.id,
    mode: entry.mode,
    status: entry.status,
    createdAt,
    startedAt,
    failureMessage:
      entry.status === "timeout" ? TIMEOUT_LABEL : entry.failureMessage,
    intentData: entry.intentData ?? null,
    fromTokens: Array.isArray(entry.fromTokens) ? entry.fromTokens : [],
    opportunity: sanitizeOpportunityForHistory(entry.opportunity),
  } as SwapHistoryEntry;
};

const readSwapHistoryFromStorage = (storageKey: string): SwapHistoryEntry[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortSwapHistoryEntries(
      parsed
        .map(normalizeStoredHistoryEntry)
        .filter((entry): entry is SwapHistoryEntry => Boolean(entry))
    );
  } catch {
    return [];
  }
};

const writeSwapHistoryToStorage = (
  storageKey: string,
  entries: SwapHistoryEntry[]
) => {
  if (typeof window === "undefined") return;

  try {
    const persistableEntries =
      sortSwapHistoryEntries(entries).map(sanitizeHistoryEntry);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(persistableEntries, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );
  } catch {
    // localStorage can be unavailable or full; in-memory history still works.
  }
};

function QuoteRefreshCountdown({
  progress,
  isRefreshing,
  secondsRemaining,
}: {
  progress: number;
  isRefreshing: boolean;
  secondsRemaining: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const tooltipLabel = isRefreshing
    ? "Refreshing quotes..."
    : `Refreshing quotes in ${Math.max(0, secondsRemaining)} second${
        secondsRemaining === 1 ? "" : "s"
      }`;

  return (
    <div
      aria-label={tooltipLabel}
      onBlur={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        alignItems: "center",
        backgroundColor: "#FFFFFE",
        borderRadius: "999px",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        height: "22px",
        justifyContent: "center",
        outline: "1px solid #E8E8E7",
        position: "relative",
        width: "22px",
      }}
      tabIndex={0}
    >
      {showTooltip && (
        <div
          role="tooltip"
          style={{
            background: tooltipSurface,
            border: `1px solid ${tooltipBorder}`,
            boxShadow: "0 6px 18px rgba(22,22,21,0.10)",
            color: tooltipText,
            fontFamily: uiFont,
            fontSize: "13px",
            fontWeight: 500,
            maxWidth: "190px",
            lineHeight: "17px",
            padding: "7px 9px",
            pointerEvents: "none",
            position: "absolute",
            right: 0,
            textAlign: "center",
            top: "calc(100% + 8px)",
            whiteSpace: "normal",
            width: "max-content",
            zIndex: 10000,
          }}
        >
          {tooltipLabel}
        </div>
      )}
      <svg
        fill="none"
        height="16"
        style={{
          opacity: isRefreshing ? 0.55 : 1,
          transform: "rotate(-90deg)",
          transition: "opacity 0.18s ease-out",
        }}
        viewBox="0 0 18 18"
        width="16"
      >
        <circle cx="9" cy="9" r={radius} stroke="#E8E8E7" strokeWidth="2" />
        <circle
          cx="9"
          cy="9"
          r={radius}
          stroke="var(--foreground-brand)"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clampedProgress)}
          strokeLinecap="round"
          strokeWidth="2"
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
    </div>
  );
}

const normalizeDecimalInputText = (value: unknown) => {
  const raw = String(value).trim();
  if (!raw) return "";
  if (SCIENTIFIC_DECIMAL_REGEX.test(raw)) return raw;
  return raw.replace(/[^0-9.-]/g, "");
};

const parseDecimalLoose = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  if (Decimal.isDecimal(value)) return value;
  const cleaned = normalizeDecimalInputText(value);
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") {
    return undefined;
  }
  try {
    const parsed = new Decimal(cleaned);
    return parsed.isFinite() ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const toViemDecimalString = (value: unknown, decimals: number) => {
  const parsed = parseDecimalLoose(value);
  if (!parsed || parsed.lte(0)) return "0";
  return parsed
    .toDecimalPlaces(Math.max(0, decimals), Decimal.ROUND_DOWN)
    .toFixed();
};

const formatDecimalDisplay = (
  value: unknown,
  options: { min?: number; max?: number } = {}
) => {
  const amount = parseDecimalLoose(value) ?? new Decimal(0);
  const max = options.max ?? 2;
  return amount.toDecimalPlaces(max).toFixed();
};

const formatUsdDisplay = (value: unknown) => {
  const amount = parseDecimalLoose(value) ?? new Decimal(0);
  if (amount.gt(0) && amount.lt(0.01)) return "<$0.01";
  return `$${formatDecimalDisplay(amount, { min: 2, max: 2 })}`;
};

const formatTokenDisplay = (value: unknown) => {
  const amount = parseDecimalLoose(value) ?? new Decimal(0);
  return formatDecimalDisplay(amount, { max: 8 });
};

const getSwapTokenUsdValue = (token: SwapTokenOption) =>
  parseDecimalLoose(token.userAmountUsd) ??
  parseDecimalLoose(token.balanceInFiat) ??
  new Decimal(0);

const sortSwapTokensByUsdDesc = (tokens: SwapTokenOption[]) =>
  [...tokens].sort((a, b) => {
    const usdDelta = getSwapTokenUsdValue(b).cmp(getSwapTokenUsdValue(a));
    if (usdDelta !== 0) return usdDelta;
    return (a.symbol ?? "").localeCompare(b.symbol ?? "");
  });

const getIntentSourceUsdValue = (source: SwapIntentData["sources"][number]) =>
  parseDecimalLoose(source.value) ?? new Decimal(0);

const sortIntentSourcesByUsdDesc = (sources: SwapIntentData["sources"]) =>
  [...sources].sort((a, b) => {
    const usdDelta = getIntentSourceUsdValue(b).cmp(getIntentSourceUsdValue(a));
    if (usdDelta !== 0) return usdDelta;
    return (a.token?.symbol ?? "").localeCompare(b.token?.symbol ?? "");
  });

const extractIntentIdFromUrl = (url?: string | null) => {
  if (!url) return undefined;
  const match = url.match(/(\d+)(?:\/)?$/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const getNonEmptyString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
};

const isHttpUrl = (value?: string | null): value is string =>
  Boolean(value && /^https?:\/\//i.test(value));

const hasValidIntentExplorer = (
  entry: Pick<SwapHistoryEntry, "intentExplorerUrl">
) => isHttpUrl(entry.intentExplorerUrl);

const getHistoryExplorerUrl = (
  entry: Pick<
    SwapHistoryEntry,
    "finalExplorerUrl" | "intentExplorerUrl" | "sourceExplorerUrl"
  >
) =>
  [
    entry.intentExplorerUrl,
    entry.finalExplorerUrl,
    entry.sourceExplorerUrl,
  ].find(isHttpUrl) ?? null;

const getFiniteNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const getObjectChainId = (value: any) =>
  getFiniteNumber(
    value?.chainId,
    value?.chain?.id,
    value?.chain?.chainId,
    value?.toChainId,
    value?.destinationChainId,
    value?.data?.chainId,
    value?.data?.chain?.id,
    value?.data?.chain?.chainId,
    value?.data?.toChainId,
    value?.data?.destinationChainId,
    value?.result?.chainId,
    value?.result?.chain?.id
  );

const getExplorerBaseUrl = (chainId?: number, ...candidates: unknown[]) => {
  const directCandidates = candidates.flatMap((candidate: any) => [
    candidate?.blockExplorerUrl,
    candidate?.blockExplorerURL,
    candidate?.chainBlockExplorerUrl,
    candidate?.explorerBaseUrl,
    candidate?.explorerUrlBase,
    candidate?.blockExplorerUrls?.[0],
    candidate?.blockExplorers?.default?.url,
    candidate?.chain?.blockExplorerUrl,
    candidate?.chain?.blockExplorerURL,
    candidate?.chain?.chainBlockExplorerUrl,
    candidate?.chain?.explorerBaseUrl,
    candidate?.chain?.explorerUrlBase,
    candidate?.chain?.blockExplorerUrls?.[0],
    candidate?.chain?.blockExplorers?.default?.url,
    candidate?.data?.blockExplorerUrl,
    candidate?.data?.blockExplorerURL,
    candidate?.data?.chainBlockExplorerUrl,
    candidate?.data?.blockExplorerUrls?.[0],
    candidate?.data?.blockExplorers?.default?.url,
    candidate?.data?.chain?.blockExplorerUrl,
    candidate?.data?.chain?.blockExplorerURL,
    candidate?.data?.chain?.chainBlockExplorerUrl,
    candidate?.data?.chain?.blockExplorerUrls?.[0],
    candidate?.data?.chain?.blockExplorers?.default?.url,
  ]);
  return getNonEmptyString(
    ...directCandidates,
    chainId ? CHAIN_METADATA[chainId]?.blockExplorerUrls?.[0] : undefined,
    chainId
      ? (CHAIN_METADATA[chainId] as any)?.blockExplorers?.default?.url
      : undefined
  );
};

const getTransactionHash = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) return trimmed;
  }
  return null;
};

const getIntentHash = (...values: unknown[]) => getTransactionHash(...values);

const getObjectIntentHash = (value: any) =>
  getIntentHash(
    value?.intentHash,
    value?.intent_hash,
    value?.intent?.hash,
    value?.intent?.intentHash,
    value?.intent?.intent_hash,
    value?.requestHash,
    value?.request_hash,
    value?.request?.hash,
    value?.request?.requestHash,
    value?.rffHash,
    value?.rff_hash,
    value?.rff?.hash,
    value?.data?.intentHash,
    value?.data?.intent_hash,
    value?.data?.intent?.hash,
    value?.data?.intent?.intentHash,
    value?.data?.intent?.intent_hash,
    value?.data?.requestHash,
    value?.data?.request_hash,
    value?.data?.request?.hash,
    value?.data?.request?.requestHash,
    value?.data?.rffHash,
    value?.data?.rff_hash,
    value?.data?.rff?.hash,
    value?.result?.intentHash,
    value?.result?.intent_hash,
    value?.result?.intent?.hash,
    value?.result?.requestHash,
    value?.result?.request_hash,
    value?.result?.rffHash,
    value?.result?.rff_hash
  );

const getNexusExplorerNetwork = (network?: unknown) => {
  const normalized =
    typeof network === "string" ? network.trim().toLowerCase() : "";
  if (normalized === "canary" || normalized === "testnet") return normalized;
  return "mainnet";
};

const getRffExplorerUrl = (network: unknown, intentHash?: string | null) =>
  intentHash
    ? `https://nexus-v2.${getNexusExplorerNetwork(network)}.avail.so/rff/${intentHash}`
    : null;

const getObjectTransactionHash = (value: any) =>
  getTransactionHash(
    value?.txHash,
    value?.transactionHash,
    value?.executeTxHash,
    value?.executeTransactionHash,
    value?.transferTransactionHash,
    value?.receipt?.transactionHash,
    value?.tx?.hash,
    value?.transaction?.hash,
    value?.data?.txHash,
    value?.data?.transactionHash,
    value?.data?.executeTxHash,
    value?.data?.executeTransactionHash,
    value?.data?.transferTransactionHash,
    value?.data?.receipt?.transactionHash,
    value?.data?.tx?.hash,
    value?.data?.transaction?.hash,
    value?.result?.txHash,
    value?.result?.transactionHash,
    value?.result?.receipt?.transactionHash
  );

const getExplorerTxUrl = (
  chainId?: number,
  txHash?: string | null,
  ...candidates: unknown[]
) => {
  if (!chainId || !txHash) return null;
  const baseUrl = getExplorerBaseUrl(chainId, ...candidates);
  return baseUrl ? `${String(baseUrl).replace(/\/$/, "")}/tx/${txHash}` : null;
};

const getSdkSwapResult = (result: any) => {
  const candidate = result?.swapResult ?? result?.result;
  return candidate && typeof candidate === "object" ? candidate : null;
};

const getSdkTransactionHash = (result: any) =>
  getObjectTransactionHash(result) ||
  getObjectTransactionHash(result?.executeResponse) ||
  getObjectTransactionHash(result?.execute) ||
  getObjectTransactionHash(result?.transfer) ||
  getObjectTransactionHash(result?.swapResult) ||
  getObjectTransactionHash(result?.result) ||
  null;

const getSdkExplorerUrl = (result: any) =>
  getNonEmptyString(
    result?.explorerUrl,
    result?.explorerURL,
    result?.txExplorerUrl,
    result?.transactionExplorerUrl,
    result?.execute?.explorerUrl,
    result?.execute?.explorerURL,
    result?.execute?.txExplorerUrl,
    result?.execute?.transactionExplorerUrl,
    result?.executeResponse?.explorerUrl,
    result?.executeResponse?.explorerURL,
    result?.executeResponse?.txExplorerUrl,
    result?.executeResponse?.transactionExplorerUrl,
    result?.executeExplorerUrl,
    result?.transferExplorerUrl,
    result?.swapResult?.explorerUrl,
    result?.swapResult?.explorerURL,
    result?.swapResult?.txExplorerUrl,
    result?.swapResult?.transactionExplorerUrl,
    result?.result?.explorerUrl,
    result?.result?.explorerURL,
    result?.result?.txExplorerUrl,
    result?.result?.transactionExplorerUrl
  );

const getSdkIntentExplorerUrl = (result: any, swapResult?: any) =>
  getNonEmptyString(
    swapResult?.intentExplorerUrl,
    swapResult?.intentExplorerURL,
    swapResult?.intentUrl,
    swapResult?.intentURL,
    swapResult?.rffUrl,
    swapResult?.rffURL,
    swapResult?.rffExplorerUrl,
    swapResult?.rffExplorerURL,
    swapResult?.explorerUrl,
    swapResult?.explorerURL,
    result?.intentExplorerUrl,
    result?.intentExplorerURL,
    result?.intentUrl,
    result?.intentURL,
    result?.rffUrl,
    result?.rffURL,
    result?.rffExplorerUrl,
    result?.rffExplorerURL,
    result?.swapResult?.intentExplorerUrl,
    result?.swapResult?.intentExplorerURL,
    result?.swapResult?.intentUrl,
    result?.swapResult?.intentURL,
    result?.swapResult?.rffUrl,
    result?.swapResult?.rffURL,
    result?.swapResult?.rffExplorerUrl,
    result?.swapResult?.rffExplorerURL,
    result?.swapResult?.explorerUrl,
    result?.swapResult?.explorerURL,
    result?.result?.intentExplorerUrl,
    result?.result?.intentExplorerURL,
    result?.result?.intentUrl,
    result?.result?.intentURL,
    result?.result?.rffUrl,
    result?.result?.rffURL,
    result?.result?.rffExplorerUrl,
    result?.result?.rffExplorerURL,
    result?.result?.explorerUrl,
    result?.result?.explorerURL
  );

const getSdkIntentExplorerUrlForNetwork = (
  network: unknown,
  result: any,
  swapResult?: any
) =>
  getSdkIntentExplorerUrl(result, swapResult) ||
  getRffExplorerUrl(
    network,
    getObjectIntentHash(swapResult) || getObjectIntentHash(result)
  );

function MiniLogo({
  src,
  label,
  size = 30,
  fontSize = 13,
  outline,
  style,
}: {
  src?: string;
  label?: string;
  size?: number;
  fontSize?: number;
  outline?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(!src);

  useEffect(() => {
    setFailed(!src);
  }, [src]);

  if (!failed && src) {
    return (
      <img
        alt={label || ""}
        onError={() => setFailed(true)}
        src={src}
        style={{
          background: "#FFFFFE",
          borderRadius: "999px",
          height: size,
          objectFit: "cover",
          outline,
          width: size,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      style={{
        alignItems: "center",
        background: "#E8F0FF",
        borderRadius: "999px",
        color: "var(--foreground-brand)",
        display: "flex",
        fontFamily: uiFont,
        fontSize,
        fontWeight: 700,
        height: size,
        justifyContent: "center",
        outline,
        width: size,
        ...style,
      }}
    >
      {(label || "?").trim().slice(0, 1).toUpperCase()}
    </div>
  );
}

function TokenLogoPair({
  tokenLogo,
  chainLogo,
  tokenSymbol,
  chainName,
  tokenOutline,
  size = 34,
}: {
  tokenLogo?: string;
  chainLogo?: string;
  tokenSymbol?: string;
  chainName?: string;
  tokenOutline?: string;
  size?: number;
}) {
  return (
    <div
      style={{ flexShrink: 0, height: size, position: "relative", width: size }}
    >
      <MiniLogo
        fontSize={14}
        label={tokenSymbol}
        outline={tokenOutline}
        size={size}
        src={tokenLogo}
      />
      {chainLogo && (
        <MiniLogo
          fontSize={6}
          label={chainName}
          outline="1px solid #FFFFFE"
          size={Math.round(size * 0.44)}
          src={chainLogo}
          style={{ bottom: -2, position: "absolute", right: -2 }}
        />
      )}
    </div>
  );
}

function SourceLogoStack({
  sources,
  size = 24,
  maxVisible = 3,
}: {
  sources: HistorySourceRow[];
  size?: number;
  maxVisible?: number;
}) {
  const visibleSources = sources.slice(0, maxVisible);
  const hiddenCount = Math.max(0, sources.length - visibleSources.length);

  return (
    <div
      aria-label={`${sources.length} source asset${sources.length === 1 ? "" : "s"}`}
      style={{
        alignItems: "center",
        display: "flex",
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      {visibleSources.map((source, index) => (
        <div
          key={source.key}
          style={{
            marginLeft: index === 0 ? 0 : -7,
            position: "relative",
            zIndex: visibleSources.length - index,
          }}
        >
          <TokenLogoPair
            chainLogo={source.chainLogo}
            chainName={source.chainName}
            size={size}
            tokenLogo={source.tokenLogo}
            tokenOutline={
              index < visibleSources.length - 1
                ? "1px solid #FFFFFE"
                : undefined
            }
            tokenSymbol={source.symbol}
          />
        </div>
      ))}
      {hiddenCount > 0 && (
        <span
          style={{
            color: "#848483",
            flexShrink: 0,
            fontFamily: uiFont,
            fontSize: size <= 21 ? "12px" : "14px",
            fontWeight: 600,
            marginLeft: "3px",
          }}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

function TruncatedAddress({
  address,
  color = "var(--foreground-brand)",
}: {
  address: string;
  color?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const label =
    address.length > 12
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address;

  return (
    <span
      onBlur={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        color,
        display: "inline-flex",
        fontFamily: uiFont,
        fontSize: "15px",
        fontWeight: 500,
        lineHeight: "20px",
        outline: "none",
        position: "relative",
      }}
      tabIndex={0}
    >
      {label}
      {showTooltip && (
        <span
          role="tooltip"
          style={{
            background: "#FFFFFE",
            border: "1px solid #E8E8E7",
            boxShadow: "0 6px 18px rgba(22,22,21,0.10)",
            color: "#161615",
            fontFamily: uiFont,
            fontSize: "13px",
            fontWeight: 500,
            lineHeight: "17px",
            padding: "7px 9px",
            pointerEvents: "none",
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            whiteSpace: "nowrap",
            zIndex: 10000,
          }}
        >
          {address}
        </span>
      )}
    </span>
  );
}

const getDisplayDestinationSourceRow = (
  entry: SwapHistoryEntry
): HistorySourceRow | null => {
  if (entry.mode !== "deposit" && entry.mode !== "send") return null;
  if (!entry.toToken || !entry.requestedToAmount) return null;

  const requestedAmount = parseDecimalLoose(entry.requestedToAmount);
  const intentDestinationAmount = parseDecimalLoose(
    entry.intentData?.destination.amount
  );
  const destinationBalanceAmount = parseDecimalLoose(
    entry.toToken.balance?.replace(entry.toToken.symbol, "")
  );
  if (
    !requestedAmount ||
    !destinationBalanceAmount ||
    requestedAmount.lte(0) ||
    destinationBalanceAmount.lte(0)
  ) {
    return null;
  }

  const intentCoversAmount = intentDestinationAmount ?? new Decimal(0);
  const displayAmount = Decimal.min(
    destinationBalanceAmount,
    Decimal.max(0, requestedAmount.minus(intentCoversAmount))
  );
  if (displayAmount.lte(0)) return null;

  const requestedValue = parseDecimalLoose(entry.requestedToValue);
  const destinationValue = parseDecimalLoose(
    entry.intentData?.destination.value
  );
  const rate =
    requestedValue && requestedAmount.gt(0)
      ? requestedValue.div(requestedAmount)
      : destinationValue && intentCoversAmount.gt(0)
        ? destinationValue.div(intentCoversAmount)
        : undefined;

  return {
    key: `destination-balance-${entry.toToken.chainId}-${entry.toToken.contractAddress}`,
    tokenLogo: entry.toToken.logo,
    chainLogo: entry.toToken.chainLogo,
    symbol: entry.toToken.symbol,
    chainName: getShortChainName(
      entry.toToken.chainId,
      entry.toToken.chainName
    ),
    amount: displayAmount
      .toDecimalPlaces(
        Math.max(0, entry.toToken.decimals ?? 18),
        Decimal.ROUND_DOWN
      )
      .toFixed(),
    value: rate
      ? displayAmount.mul(rate).toFixed()
      : entry.toToken.balanceInFiat,
  };
};

const getProgressStepType = (step?: SwapStepType | BridgeStepType | null) =>
  String((step as any)?.type ?? (step as any)?.typeID ?? "").toUpperCase();

const isBridgeRefundStepType = (type: string) =>
  type.includes("BRIDGE_INTENT_SUBMISSION") || type.includes("BRIDGE_DEPOSIT");

const isSwapSkippedStepType = (type: string) => type.includes("SWAP_SKIPPED");

const isAutoRefundAvailableProgressEvent = (event?: NexusWidgetProgressEvent) =>
  event?.name === PROGRESS_EVENT_NAMES.SWAP_PLAN_PROGRESS &&
  isBridgeRefundStepType(getProgressStepType(event.step));

const normalizeBridgeProvider = (
  value: unknown
): BridgeProvider | undefined => {
  if (value === "nexus" || value === "mayan" || value === null) {
    return value;
  }
  return undefined;
};

const normalizePlanStepType = (stepType: unknown, state?: unknown) => {
  const normalized = String(stepType ?? "").toLowerCase();
  const normalizedState = String(state ?? "").toLowerCase();

  if (normalized === "execute_transaction") {
    return normalizedState === "confirmed" || normalizedState === "completed"
      ? "TRANSACTION_CONFIRMED"
      : "TRANSACTION_SENT";
  }

  const mapped: Record<string, string> = {
    allowance_approval: "APPROVAL",
    bridge_deposit: "BRIDGE_DEPOSIT",
    bridge_fill: "BRIDGE_FILL",
    bridge_intent_submission: "BRIDGE_INTENT_SUBMISSION",
    destination_swap: "DESTINATION_SWAP",
    eoa_to_ephemeral_transfer: "EOA_TO_EPHEMERAL_TRANSFER",
    execute_approval: "APPROVAL",
    request_signing: "REQUEST_SIGNING",
    request_submission: "REQUEST_SUBMISSION",
    source_swap: "SOURCE_SWAP",
    vault_deposit: "BRIDGE_DEPOSIT",
  };

  return mapped[normalized] ?? normalized.toUpperCase();
};

const normalizePlanStep = (
  stepLike: unknown,
  fallbackStepType?: unknown,
  state?: unknown,
  completed?: boolean
): SwapStepType | BridgeStepType => {
  const source =
    stepLike && typeof stepLike === "object" ? (stepLike as any) : {};
  const rawStepType = fallbackStepType ?? source.stepType ?? source.type;
  const progressType = normalizePlanStepType(
    rawStepType ?? source.typeID,
    state
  );
  const progressKey =
    source.id ?? source.stepId ?? source.typeID ?? progressType;

  return {
    ...source,
    completed,
    rawType: rawStepType,
    type: progressType,
    typeID: String(progressKey),
  } as SwapStepType | BridgeStepType;
};

const getPlanStepChainId = (event: any, step: any) =>
  getObjectChainId(event) ?? getObjectChainId(step);

const getPlanStepTransactionHash = (event: any, step: any) =>
  getObjectTransactionHash(event) ?? getObjectTransactionHash(step);

const getPlanStepExplorerUrl = (event: any, step: any) => {
  const directExplorerUrl = getNonEmptyString(
    event?.explorerUrl,
    event?.explorerURL,
    event?.txExplorerUrl,
    event?.transactionExplorerUrl,
    step?.explorerUrl,
    step?.explorerURL,
    step?.txExplorerUrl,
    step?.transactionExplorerUrl,
    step?.data?.explorerUrl,
    step?.data?.explorerURL,
    step?.data?.txExplorerUrl,
    step?.data?.transactionExplorerUrl
  );
  if (directExplorerUrl) return directExplorerUrl;

  return getExplorerTxUrl(
    getPlanStepChainId(event, step),
    getPlanStepTransactionHash(event, step),
    event,
    step
  );
};

const getPlanStepIntentExplorerUrl = (event: any, step: any) =>
  getNonEmptyString(
    event?.intentExplorerUrl,
    event?.intentExplorerURL,
    event?.intentUrl,
    event?.intentURL,
    event?.rffUrl,
    event?.rffURL,
    event?.rffExplorerUrl,
    event?.rffExplorerURL,
    step?.intentExplorerUrl,
    step?.intentExplorerURL,
    step?.intentUrl,
    step?.intentURL,
    step?.rffUrl,
    step?.rffURL,
    step?.rffExplorerUrl,
    step?.rffExplorerURL,
    step?.data?.intentExplorerUrl,
    step?.data?.intentExplorerURL,
    step?.data?.intentUrl,
    step?.data?.intentURL,
    step?.data?.rffUrl,
    step?.data?.rffURL,
    step?.data?.rffExplorerUrl,
    step?.data?.rffExplorerURL
  );

const isIntentSubmissionLikeEvent = (event: any, step?: any) => {
  const text = [
    event?.type,
    event?.event,
    event?.name,
    event?.status,
    event?.stepType,
    step?.type,
    step?.typeID,
    step?.rawType,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("intent") ||
    text.includes("request_submission") ||
    text.includes("rff")
  );
};

const getGenericEventHash = (event: any, step?: any) =>
  getTransactionHash(
    event?.hash,
    event?.data?.hash,
    event?.result?.hash,
    step?.hash,
    step?.data?.hash,
    step?.result?.hash
  );

const getEventIntentExplorerUrl = (
  network: unknown,
  event: any,
  step?: any
) => {
  const directUrl = step
    ? getPlanStepIntentExplorerUrl(event, step)
    : getNonEmptyString(
        event?.intentExplorerUrl,
        event?.intentExplorerURL,
        event?.intentUrl,
        event?.intentURL,
        event?.rffUrl,
        event?.rffURL,
        event?.rffExplorerUrl,
        event?.rffExplorerURL,
        event?.data?.intentExplorerUrl,
        event?.data?.intentExplorerURL,
        event?.data?.intentUrl,
        event?.data?.intentURL,
        event?.data?.rffUrl,
        event?.data?.rffURL,
        event?.data?.rffExplorerUrl,
        event?.data?.rffExplorerURL
      );
  if (directUrl) return directUrl;

  return getRffExplorerUrl(
    network,
    getObjectIntentHash(event) ||
      getObjectIntentHash(step) ||
      (isIntentSubmissionLikeEvent(event, step)
        ? getGenericEventHash(event, step)
        : null)
  );
};

const isTimeoutLikeError = (error: unknown) => {
  const err = error as {
    code?: unknown;
    name?: unknown;
    message?: unknown;
    shortMessage?: unknown;
  };
  const text = [
    err?.code,
    err?.name,
    err?.message,
    err?.shortMessage,
    typeof error === "string" ? error : undefined,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(" ");

  return /timeout|timed out|time out|deadline exceeded|expired while waiting|wait.*expired|poll.*expired/i.test(
    text
  );
};

const getSdkEventType = (event: any) =>
  event?.type ?? event?.name ?? event?.event ?? "unknown";

const summarizeSdkProgressStep = (
  step: SwapStepType | BridgeStepType | null | undefined,
  index?: number
) => ({
  completed: (step as any)?.completed,
  index,
  rawType: (step as any)?.rawType ?? (step as any)?.stepType,
  state: (step as any)?.state,
  type: getProgressStepType(step),
});

const logSdkSwapEvent = (
  label: string,
  event: any,
  meta?: Record<string, unknown>
) => {
  console.log(`[NexusWidget SDK][swap] ${label}`, {
    event,
    eventType: getSdkEventType(event),
    ...meta,
  });
};

const logSdkIntentEvent = (
  label: string,
  data: any,
  meta?: Record<string, unknown>
) => {
  console.log(`[NexusWidget SDK][intent] ${label}`, {
    hasAllow: typeof data?.allow === "function",
    hasDeny: typeof data?.deny === "function",
    hasRefresh: typeof data?.refresh === "function",
    intent: data?.intent,
    raw: data,
    ...meta,
  });
};

const logSdkIntentInput = (
  operation: string,
  input: unknown,
  meta?: Record<string, unknown>
) => {
  console.log(`[NexusWidget SDK][intent input] ${operation}`, {
    input,
    ...meta,
  });
};

const normalizeSdkIntentString = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
};

const normalizeSdkIntentAmount = (
  value: unknown,
  fallback: string = "0"
) => normalizeSdkIntentString(value) ?? fallback;

const normalizeSdkIntentChain = (chain: any) => {
  const id = Number(chain?.id ?? chain?.chainId);
  if (!Number.isFinite(id)) return undefined;
  const chainMeta = CHAIN_METADATA[id];
  return {
    id,
    logo: chain?.logo ?? chainMeta?.logo ?? "",
    name: chain?.name ?? chainMeta?.name ?? "",
  };
};

const normalizeSdkIntentToken = (token: any, chainId?: number) => {
  const chainMeta = chainId ? CHAIN_METADATA[chainId] : undefined;
  const decimals = Number(token?.decimals ?? chainMeta?.nativeCurrency.decimals);
  return {
    contractAddress:
      token?.contractAddress ??
      token?.address ??
      token?.tokenAddress ??
      zeroAddress,
    decimals: Number.isFinite(decimals) ? decimals : 18,
    symbol: token?.symbol ?? token?.tokenSymbol ?? "",
  };
};

const normalizeSdkIntentGas = (
  gas: any,
  chainId?: number
): SwapIntentDestination["gas"] => ({
  amount: normalizeSdkIntentAmount(gas?.amount),
  value: normalizeSdkIntentString(gas?.value),
  token: normalizeSdkIntentToken(gas?.token ?? gas, chainId),
});

const normalizeSdkIntentSource = (
  source: any
): SwapIntentSource | undefined => {
  const chain = normalizeSdkIntentChain(source?.chain);
  if (!chain) return undefined;
  return {
    ...source,
    amount: normalizeSdkIntentAmount(source?.amount),
    chain,
    token: normalizeSdkIntentToken(source?.token, chain.id),
    value: normalizeSdkIntentString(source?.value),
  };
};

const normalizeSdkIntentDestination = (
  destination: any
): SwapIntentDestination | undefined => {
  const chain = normalizeSdkIntentChain(destination?.chain);
  if (!chain) return undefined;
  return {
    ...destination,
    amount: normalizeSdkIntentAmount(destination?.amount),
    chain,
    gas: normalizeSdkIntentGas(destination?.gas, chain.id),
    token: normalizeSdkIntentToken(destination?.token, chain.id),
    value: normalizeSdkIntentString(destination?.value),
  };
};

const normalizeSwapIntentData = (intent: any): SwapIntentData | null => {
  const destination = normalizeSdkIntentDestination(intent?.destination);
  if (!destination) return null;

  return {
    ...intent,
    destination,
    sources: Array.isArray(intent?.sources)
      ? intent.sources
          .map(normalizeSdkIntentSource)
          .filter(
            (source: SwapIntentSource | undefined): source is SwapIntentSource =>
              Boolean(source)
          )
      : [],
  };
};

const normalizeSwapAndExecuteRequirementIntent = (
  intent: any
): SwapIntentData | null => {
  const requirement = intent?.executeRequirement ?? intent?.executionRequirement;
  if (!requirement) return null;
  const destination = normalizeSdkIntentDestination({
    amount: requirement?.token?.amount,
    chain: requirement?.chain,
    gas: requirement?.gas,
    token: requirement?.token,
    value: requirement?.token?.value,
  });
  if (!destination) return null;

  return {
    ...intent,
    bridgeProvider: normalizeBridgeProvider(intent?.bridgeProvider),
    destination,
    feesAndBuffer: intent?.feesAndBuffer,
    sources: [],
  };
};

const normalizeRenderableSwapIntentData = (
  rawIntent: any,
  bridgeProvider?: BridgeProvider
): SwapIntentData | null => {
  const direct = normalizeSwapIntentData(rawIntent);
  const nestedSwap = direct ? null : normalizeSwapIntentData(rawIntent?.swap);
  const requirement = direct || nestedSwap
    ? null
    : normalizeSwapAndExecuteRequirementIntent(rawIntent);
  const normalized = direct ?? nestedSwap ?? requirement;
  if (!normalized) return null;

  return bridgeProvider === undefined
    ? normalized
    : { ...normalized, bridgeProvider };
};

const logSwapPlanSteps = (
  eventType: "plan_preview" | "plan_confirmed",
  stepList: Array<SwapStepType | BridgeStepType>,
  rawSteps: unknown
) => {
  console.log(`[NexusWidget SDK][swap] ${eventType} step list`, {
    count: stepList.length,
    eventType,
    rawSteps,
    steps: stepList.map((step, index) => summarizeSdkProgressStep(step, index)),
  });
};

const logSwapPlanProgress = (
  event: any,
  step: SwapStepType | BridgeStepType,
  eventName: string,
  completed: boolean
) => {
  console.log("[NexusWidget SDK][swap] plan_progress", {
    completed,
    eventName,
    eventType: getSdkEventType(event),
    normalizedStep: summarizeSdkProgressStep(step),
    rawEvent: event,
    rawStep: event?.step,
    state: event?.state,
    stepType: event?.stepType,
  });
};

const getFailureMessageForProgressStep = (
  step: SwapStepType | BridgeStepType | null | undefined,
  mode: NexusWidgetMode,
  autoRefundAvailable = false
) => {
  if (autoRefundAvailable) {
    return "Swap Failed. Refund Initiated";
  }

  const type = getProgressStepType(step);
  if (
    type.includes("CREATE_PERMIT_FOR_SOURCE_SWAP") ||
    type.includes("CREATE_PERMIT_EOA_TO_EPHEMERAL") ||
    type.includes("EOA_EXECUTE_CALL") ||
    type.includes("SOURCE_SWAP") ||
    type.includes("COLLECTION")
  ) {
    return "Collection Failed";
  }
  if (type.includes("DESTINATION_SWAP") || type.includes("FULFIL")) {
    return "Destination Swap Failed";
  }
  if (
    type.includes("TRANSACTION") ||
    type.includes("APPROVAL") ||
    type.includes("DEPOSIT")
  ) {
    return mode === "send"
      ? "Send failed. Funds are in your wallet"
      : mode === "deposit"
        ? "Deposit failed. Funds are in your wallet"
        : "Swap Failed";
  }
  if (
    type.includes("SWAP") ||
    type.includes("BRIDGE") ||
    type.includes("INTENT") ||
    type.includes("DETERMINING")
  ) {
    return "Swap Failed";
  }
  return mode === "send"
    ? "Send failed. Funds are in your wallet"
    : mode === "deposit"
      ? "Deposit failed. Funds are in your wallet"
      : "Swap Failed";
};

const getBridgeTokenSymbolForProgressStep = (
  step: SwapStepType | BridgeStepType | null | undefined
) => {
  const rawStep = step as any;
  return (
    getNonEmptyString(
      rawStep?.bridgeToken?.symbol,
      rawStep?.data?.bridgeToken?.symbol,
      rawStep?.bridgeTokenSymbol,
      rawStep?.data?.bridgeTokenSymbol,
      rawStep?.swaps?.[0]?.input?.symbol,
      rawStep?.data?.swaps?.[0]?.input?.symbol,
      rawStep?.input?.symbol,
      rawStep?.data?.input?.symbol,
      rawStep?.asset?.symbol,
      rawStep?.data?.asset?.symbol
    ) ?? "USDC"
  );
};

const getFailureDescriptionForProgressStep = (
  step: SwapStepType | BridgeStepType | null | undefined,
  autoRefundAvailable = false
) => {
  if (autoRefundAvailable) return undefined;
  const type = getProgressStepType(step);
  if (!type.includes("DESTINATION_SWAP")) return undefined;
  const bridgeTokenSymbol = getBridgeTokenSymbolForProgressStep(step);
  return `${bridgeTokenSymbol} has been bridged and you have those funds in your wallet.`;
};

const getSourceRows = (entry: SwapHistoryEntry): HistorySourceRow[] => {
  const sources = entry.intentData?.sources ?? [];
  const displayDestinationSourceRow = getDisplayDestinationSourceRow(entry);
  if (sources.length > 0) {
    const sourceRows = sources.map((source, index) => {
      const fallback = entry.fromTokens.find(
        (token) =>
          token.chainId === source.chain.id &&
          (token.contractAddress?.toLowerCase() ===
            source.token.contractAddress?.toLowerCase() ||
            token.symbol === source.token.symbol)
      );

      return {
        key: `${source.chain.id}-${source.token.contractAddress}-${index}`,
        tokenLogo: fallback?.logo,
        chainLogo: source.chain.logo || fallback?.chainLogo,
        symbol: source.token.symbol,
        chainName: getShortChainName(source.chain.id, source.chain.name),
        amount: source.amount,
        value: source.value,
      };
    });

    return displayDestinationSourceRow
      ? [displayDestinationSourceRow, ...sourceRows]
      : sourceRows;
  }

  const fallbackRows = entry.fromTokens.map((token, index) => ({
    key: `${token.chainId}-${token.contractAddress}-${index}`,
    tokenLogo: token.logo,
    chainLogo: token.chainLogo,
    symbol: token.symbol,
    chainName: getShortChainName(token.chainId, token.chainName),
    amount: token.userAmount || "0",
    value: token.balanceInFiat,
  }));

  return displayDestinationSourceRow
    ? [displayDestinationSourceRow, ...fallbackRows]
    : fallbackRows;
};

function SourceRowsList({
  entry,
  maxHeight = 236,
  borderTopFirst = true,
  scrollAfterRows = 4,
}: {
  entry: SwapHistoryEntry;
  maxHeight?: number;
  borderTopFirst?: boolean;
  scrollAfterRows?: number;
}) {
  const rows = getSourceRows(entry);
  const shouldScroll = rows.length > scrollAfterRows;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={scrollRef}
        style={{
          maxHeight: shouldScroll ? maxHeight : undefined,
          overflowY: shouldScroll ? "auto" : undefined,
        }}
      >
        {rows.map((row, index) => (
          <div
            key={row.key}
            style={{
              alignItems: "center",
              borderTop:
                borderTopFirst || index > 0 ? "1px solid #E8E8E7" : "none",
              display: "flex",
              justifyContent: "space-between",
              minHeight: "64px",
              padding: "10px 20px",
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: "10px",
                minWidth: 0,
              }}
            >
              <TokenLogoPair
                chainLogo={row.chainLogo}
                chainName={row.chainName}
                tokenLogo={row.tokenLogo}
                tokenSymbol={row.symbol}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span
                  style={{
                    color: "#161615",
                    fontFamily: uiFont,
                    fontSize: "15px",
                    fontWeight: 600,
                  }}
                >
                  {row.symbol}
                </span>
                <span
                  style={{
                    color: "#848483",
                    fontFamily: uiFont,
                    fontSize: "14px",
                  }}
                >
                  on {row.chainName || "Unknown chain"}
                </span>
              </div>
            </div>
            <div
              style={{
                alignItems: "flex-end",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                textAlign: "right",
              }}
            >
              <span
                style={{
                  color: "#161615",
                  fontFamily: uiFont,
                  fontSize: "15px",
                }}
              >
                {formatTokenDisplay(row.amount)} {row.symbol}
              </span>
              <span
                style={{
                  color: "#848483",
                  fontFamily: uiFont,
                  fontSize: "14px",
                }}
              >
                {formatUsdDisplay(row.value)}
              </span>
            </div>
          </div>
        ))}
      </div>
      {shouldScroll && (
        <button
          aria-label="Scroll source assets"
          onClick={() =>
            scrollRef.current?.scrollBy({ top: 72, behavior: "smooth" })
          }
          style={{
            alignItems: "center",
            background: "#FFFFFE",
            border: "1px solid #E8E8E7",
            borderRadius: "999px",
            bottom: "6px",
            boxShadow: "0 2px 8px rgba(22,22,21,0.08)",
            display: "flex",
            height: "22px",
            justifyContent: "center",
            left: "50%",
            padding: 0,
            position: "absolute",
            transform: "translateX(-50%)",
            width: "22px",
          }}
          type="button"
        >
          <ChevronDown color="#848483" size={14} />
        </button>
      )}
    </div>
  );
}

function SwapReceiptPanel({
  entry,
  onDone,
}: {
  entry: SwapHistoryEntry;
  onDone: () => void;
}) {
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  const destination = entry.intentData?.destination;
  const isFailed = entry.status === "failed";
  const isTimeout = entry.status === "timeout";
  const isDeposit = entry.mode === "deposit";
  const isSend = entry.mode === "send";
  const isRecipientTransfer = isSend || Boolean(entry.recipientAddress);
  const tokenSymbol = destination?.token.symbol || entry.toToken?.symbol || "";
  const chainName = getShortChainName(
    destination?.chain.id ?? entry.toToken?.chainId,
    destination?.chain.name || entry.toToken?.chainName || ""
  );
  const depositVenue =
    entry.opportunity?.title || entry.opportunity?.protocol || chainName;
  const amount = destination?.amount || "";
  const requestedExactOutAmount =
    (isDeposit || isSend) && entry.requestedToAmount
      ? entry.requestedToAmount
      : undefined;
  const requestedExactOutValue =
    (isDeposit || isSend) && entry.requestedToValue
      ? entry.requestedToValue
      : undefined;
  const value = requestedExactOutValue || destination?.value;
  const displayAmount = requestedExactOutAmount || amount;
  const showIntentExplorer = hasValidIntentExplorer(entry);
  const intentLabel = entry.intentId
    ? `Intent #${entry.intentId}`
    : "View Explorer";
  const sourceRows = getSourceRows(entry);
  const sourceCount = sourceRows.length;
  const sourceTotalUsd = sourceRows.reduce(
    (sum, source) => sum.plus(parseDecimalLoose(source.value) ?? 0),
    new Decimal(0)
  );
  const defaultSwapFailureHeadline = entry.autoRefundAvailable
    ? "Swap Failed. Refund Initiated"
    : "Swap Failed";
  const entryFailureMessage =
    entry.status === "timeout" ? TIMEOUT_LABEL : entry.failureMessage;
  const storedFailureMessage =
    !entry.autoRefundAvailable && entryFailureMessage?.includes("Refund")
      ? undefined
      : entryFailureMessage;
  const failureHeadline =
    storedFailureMessage ||
    (isDeposit
      ? "Deposit failed. Funds are in your wallet"
      : isRecipientTransfer
        ? "Send failed. Funds are in your wallet"
        : defaultSwapFailureHeadline);
  const failureDescription = isFailed ? entry.failureDescription : undefined;
  const timeoutHeadline = TIMEOUT_LABEL;
  const timeoutDescription = isTimeout
    ? entry.failureDescription ||
      "This transaction is still pending. Check the intent explorer for the latest status."
    : undefined;
  const receiptLocation = isDeposit ? depositVenue : chainName;
  const receiptSummary = receiptLocation ? `on ${receiptLocation}` : "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "7px",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#FFFFFE",
          border: "1px solid #E8E8E7",
          borderRadius: "9px",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D",
          padding: "16px 13px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            marginBottom: "10px",
            position: "relative",
          }}
        >
          <MiniLogo
            fontSize={17}
            label={tokenSymbol}
            size={45}
            src={
              isDeposit
                ? entry.opportunity?.logo || entry.toToken?.logo
                : entry.toToken?.logo
            }
          />
          <div
            style={{
              alignItems: "center",
              background: isFailed
                ? "#E92C2C"
                : isTimeout
                  ? "#B7791F"
                  : "var(--foreground-brand)",
              border: "2px solid #FFFFFE",
              borderRadius: "999px",
              bottom: -2,
              color: "#FFFFFE",
              display: "flex",
              fontFamily: uiFont,
              fontSize: "14px",
              fontWeight: 700,
              height: "18px",
              justifyContent: "center",
              position: "absolute",
              right: -4,
              width: "18px",
            }}
          >
            {isFailed ? "x" : isTimeout ? "!" : "✓"}
          </div>
        </div>
        <div style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
          {isTimeout
            ? timeoutHeadline
            : isFailed
              ? failureHeadline
              : isDeposit
                ? "You deposited"
                : isRecipientTransfer
                  ? "You sent"
                  : "You received"}
        </div>
        {(failureDescription || timeoutDescription) && (
          <div
            style={{
              color: "#848483",
              fontFamily: uiFont,
              fontSize: "12px",
              lineHeight: "16px",
              margin: "6px auto 0",
              maxWidth: "260px",
            }}
          >
            {failureDescription || timeoutDescription}
          </div>
        )}
        <div
          style={{
            alignItems: "baseline",
            color: "#161615",
            display: "flex",
            fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
            fontSize: "36px",
            fontWeight: 500,
            gap: "7px",
            justifyContent: "center",
            lineHeight: "40px",
            marginTop: "5px",
          }}
        >
          {displayAmount ? formatTokenDisplay(displayAmount) : "--"}
          <span
            style={{ fontFamily: uiFont, fontSize: "14px", fontWeight: 600 }}
          >
            {tokenSymbol}
          </span>
        </div>
        <div style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
          ≈ {formatUsdDisplay(value)}
        </div>
        {receiptSummary && (
          <div
            style={{
              color: "#848483",
              fontFamily: uiFont,
              fontSize: "13px",
              marginTop: "8px",
            }}
          >
            {receiptSummary}
          </div>
        )}
      </div>

      <div
        style={{
          background: "#FFFFFE",
          border: "1px solid #E8E8E7",
          borderRadius: "9px",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            padding: "12px 14px",
          }}
        >
          <span
            style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}
          >
            {isDeposit || isSend ? "You Paid" : "You Swapped"}
          </span>
          <div
            style={{
              alignItems: "flex-end",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              textAlign: "right",
            }}
          >
            <div
              style={{
                color: "#161615",
                fontFamily: uiFont,
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              {formatUsdDisplay(sourceTotalUsd)}
            </div>
            <button
              onClick={() => setShowSourceDetails((current) => !current)}
              style={{
                alignItems: "center",
                background: "transparent",
                border: "none",
                color: "var(--foreground-brand)",
                cursor: "pointer",
                display: "inline-flex",
                fontFamily: uiFont,
                fontSize: "12px",
                gap: "4px",
                padding: 0,
              }}
              type="button"
            >
              {showSourceDetails
                ? "Hide Details"
                : `${sourceCount} asset${sourceCount === 1 ? "" : "s"}`}
              <ChevronDown
                size={12}
                style={{
                  transform: showSourceDetails
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                  transition: "transform 180ms ease",
                }}
              />
            </button>
          </div>
        </div>
        <div
          aria-hidden={!showSourceDetails}
          style={{
            borderTop: showSourceDetails ? "1px solid #E8E8E7" : 0,
            display: "grid",
            gridTemplateRows: showSourceDetails ? "1fr" : "0fr",
            opacity: showSourceDetails ? 1 : 0,
            overflow: "hidden",
            transition:
              "grid-template-rows 220ms ease, opacity 180ms ease, border-top-width 220ms ease",
          }}
        >
          <div style={{ minHeight: 0, overflow: "hidden" }}>
            <SourceRowsList
              borderTopFirst={false}
              entry={entry}
              maxHeight={isDeposit ? 184 : 212}
              scrollAfterRows={isDeposit ? 3 : 4}
            />
          </div>
        </div>
        {isRecipientTransfer && entry.recipientAddress && (
          <div
            style={{
              alignItems: "center",
              borderTop: "1px solid #E8E8E7",
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 14px",
            }}
          >
            <span
              style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}
            >
              Recipient
            </span>
            <TruncatedAddress address={entry.recipientAddress} />
          </div>
        )}
        {showIntentExplorer && (
          <div
            style={{
              alignItems: "center",
              borderTop: "1px solid #E8E8E7",
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 14px",
            }}
          >
            <span
              style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}
            >
              Intent Explorer
            </span>
            <a
              href={entry.intentExplorerUrl ?? undefined}
              rel="noopener noreferrer"
              style={{
                color: "var(--foreground-brand)",
                fontFamily: uiFont,
                fontSize: "13px",
              }}
              target="_blank"
            >
              {intentLabel} ↗
            </a>
          </div>
        )}
        {entry.finalExplorerUrl && (
          <div
            style={{
              alignItems: "center",
              borderTop: "1px solid #E8E8E7",
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 14px",
            }}
          >
            <span
              style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}
            >
              Final Transaction
            </span>
            <a
              href={entry.finalExplorerUrl}
              rel="noopener noreferrer"
              style={{
                color: "var(--foreground-brand)",
                fontFamily: uiFont,
                fontSize: "13px",
              }}
              target="_blank"
            >
              View Explorer ↗
            </a>
          </div>
        )}
        <div
          style={{
            alignItems: "center",
            borderTop: "1px solid #E8E8E7",
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 14px",
          }}
        >
          <span
            style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}
          >
            Total Fees
          </span>
          <span
            style={{ color: "#161615", fontFamily: uiFont, fontSize: "13px" }}
          >
            {formatUsdDisplay(entry.feeUsd)}
          </span>
        </div>
      </div>

      <button
        onClick={onDone}
        style={{
          alignItems: "center",
          background: "var(--nexus-widget-primary, #1F1F1F)",
          border: "none",
          borderRadius: "10px",
          boxShadow: "0px 1px 4px 0px #5555550D",
          color: "var(--nexus-widget-primary-foreground, #FFFFFE)",
          cursor: "pointer",
          display: "flex",
          fontFamily: uiFont,
          fontSize: "15px",
          fontWeight: 600,
          height: "40px",
          justifyContent: "center",
          width: "100%",
        }}
      >
        Done
      </button>
    </div>
  );
}

const getRelativeTime = (time: number, now: number) => {
  const seconds = Math.max(1, Math.floor((now - time) / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

function HistoryStatusPill({ status }: { status: SwapHistoryStatus }) {
  const config =
    status === "fulfilled"
      ? { label: "Fulfilled", bg: "#E8F6EF", fg: "#168A47" }
      : status === "pending"
        ? { label: "Pending", bg: "#FFF3DE", fg: "#B7791F" }
        : status === "timeout"
          ? { label: TIMEOUT_LABEL, bg: "#FFF3DE", fg: "#B7791F" }
          : status === "refund-initiated"
            ? { label: "Refund Initiated", bg: "#FFF3DE", fg: "#B7791F" }
            : { label: "Failed", bg: "#FFE6EA", fg: "#E92C2C" };

  return (
    <span
      style={{
        background: config.bg,
        borderRadius: "999px",
        color: config.fg,
        fontFamily: uiFont,
        fontSize: "12px",
        fontWeight: 600,
        lineHeight: "16px",
        padding: "3px 8px",
      }}
    >
      {config.label}
    </span>
  );
}

function SwapHistoryPanel({
  entries,
  now,
}: {
  entries: SwapHistoryEntry[];
  now: number;
}) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          alignItems: "center",
          backgroundColor: "#FFFFFE",
          border: "1px solid #E8E8E7",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          justifyContent: "center",
          padding: "48px 24px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            backgroundColor: "#F4F4F3",
            borderRadius: "999px",
            display: "flex",
            height: "48px",
            justifyContent: "center",
            width: "48px",
          }}
        >
          <span
            style={{ color: "#848483", fontFamily: uiFont, fontSize: "25px" }}
          >
            ↻
          </span>
        </div>
        <div
          style={{
            color: "#161615",
            fontFamily: uiFont,
            fontSize: "16px",
            fontWeight: 500,
          }}
        >
          No transactions yet
        </div>
        <div
          style={{
            color: "#848483",
            fontFamily: uiFont,
            fontSize: "13px",
            lineHeight: "17px",
            maxWidth: "280px",
            textAlign: "center",
          }}
        >
          Your transaction history will appear here once you make your first
          swap, deposit, or send.
        </div>
      </div>
    );
  }

  const sortedEntries = sortSwapHistoryEntries(entries);
  const shouldScroll = sortedEntries.length > 5;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxHeight: shouldScroll ? "660px" : undefined,
        overflowY: shouldScroll ? "auto" : undefined,
        paddingRight: shouldScroll ? "4px" : undefined,
        width: "100%",
      }}
    >
      {sortedEntries.map((entry) => {
        const destination = entry.intentData?.destination;
        const destinationLogo = entry.toToken?.logo;
        const destinationChainLogo =
          destination?.chain.logo || entry.toToken?.chainLogo || "";
        const destinationChainName = getShortChainName(
          destination?.chain.id ?? entry.toToken?.chainId,
          destination?.chain.name || entry.toToken?.chainName || ""
        );
        const destinationSymbol =
          destination?.token.symbol || entry.toToken?.symbol || "";
        const destinationValue =
          (entry.mode === "deposit" || entry.mode === "send") &&
          entry.requestedToValue
            ? entry.requestedToValue
            : destination?.value;
        const destinationAmount =
          (entry.mode === "deposit" || entry.mode === "send") &&
          entry.requestedToAmount
            ? entry.requestedToAmount
            : destination?.amount || "";
        const canShowRefund =
          entry.status === "failed" && Boolean(entry.autoRefundAvailable);
        const status = canShowRefund ? "refund-initiated" : entry.status;
        const sourceRows = getSourceRows(entry);
        const historyExplorerUrl = getHistoryExplorerUrl(entry);

        return (
          <div
            key={entry.id}
            style={{
              background: "#FFFFFE",
              border: "1px solid #E8E8E7",
              borderRadius: "10px",
              boxShadow: "0px 1px 12px 0px #5B5B5B0D",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{ alignItems: "center", display: "flex", gap: "12px" }}
              >
                <TokenLogoPair
                  chainLogo={destinationChainLogo}
                  chainName={destinationChainName}
                  size={34}
                  tokenLogo={destinationLogo}
                  tokenSymbol={destinationSymbol}
                />
                <div>
                  <div
                    style={{
                      alignItems: "baseline",
                      color: "#161615",
                      display: "flex",
                      fontFamily: uiFont,
                      fontSize: "17px",
                      fontWeight: 700,
                      gap: "6px",
                      lineHeight: "22px",
                    }}
                  >
                    {destinationAmount
                      ? formatTokenDisplay(destinationAmount)
                      : "--"}
                    <span
                      style={{
                        color: "#848483",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {destinationSymbol}
                    </span>
                  </div>
                  <div
                    style={{
                      color: "#848483",
                      fontFamily: uiFont,
                      fontSize: "13px",
                      lineHeight: "17px",
                    }}
                  >
                    ≈ {formatUsdDisplay(destinationValue)}
                  </div>
                </div>
              </div>
              <div
                style={{
                  alignItems: "flex-end",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <HistoryStatusPill status={status} />
                <span
                  style={{
                    color: "#848483",
                    fontFamily: uiFont,
                    fontSize: "12px",
                    lineHeight: "16px",
                  }}
                >
                  {getRelativeTime(entry.createdAt ?? entry.startedAt, now)}
                </span>
              </div>
            </div>

            {canShowRefund && (
              <div
                style={{
                  alignItems: "center",
                  background: "#FFF3F3",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "12px",
                  padding: "8px 10px",
                }}
              >
                <span
                  style={{
                    color: "#161615",
                    fontFamily: uiFont,
                    fontSize: "13px",
                  }}
                >
                  Refund Initiated
                </span>
              </div>
            )}

            <div
              style={{
                alignItems: "center",
                borderTop: "1px solid #E8E8E7",
                display: "flex",
                justifyContent: "space-between",
                marginTop: "12px",
                paddingTop: "10px",
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: "8px",
                  minWidth: 0,
                }}
              >
                {sourceRows.length > 0 && (
                  <SourceLogoStack size={21} sources={sourceRows} />
                )}
                <span
                  style={{
                    color: "#848483",
                    fontFamily: uiFont,
                    fontSize: "13px",
                  }}
                >
                  →
                </span>
                <TokenLogoPair
                  chainLogo={destinationChainLogo}
                  chainName={destinationChainName}
                  size={21}
                  tokenLogo={destinationLogo}
                  tokenSymbol={destinationSymbol}
                />
              </div>
              {historyExplorerUrl && (
                <a
                  aria-label="View transaction"
                  href={historyExplorerUrl}
                  rel="noopener noreferrer"
                  style={{
                    alignItems: "center",
                    boxSizing: "border-box",
                    color: "var(--foreground-brand)",
                    display: "inline-flex",
                    fontSize: "12px",
                    fontSynthesis: "none",
                    lineHeight: "16px",
                    MozOsxFontSmoothing: "grayscale",
                    textDecoration: "none",
                    WebkitFontSmoothing: "antialiased",
                  }}
                  target="_blank"
                >
                  <span
                    style={{
                      boxSizing: "border-box",
                      color: "var(--foreground-brand)",
                      fontFamily: uiFont,
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: "20px",
                      whiteSpace: "pre",
                    }}
                  >
                    View
                  </span>
                  <svg
                    height="11"
                    style={{
                      flexShrink: 0,
                      height: "auto",
                      width: "13px",
                    }}
                    viewBox="0 0 14 14"
                    width="11"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5 5H9V9"
                      fill="none"
                      stroke="var(--foreground-brand)"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M5 9L9 5"
                      fill="none"
                      stroke="var(--foreground-brand)"
                      strokeLinecap="round"
                      strokeWidth="1.4"
                    />
                  </svg>
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NexusWidget
// ---------------------------------------------------------------------------

export function NexusWidget(props: NexusWidgetProps) {
  return (
    <ErrorBoundary
      fallback={
        <div
          style={{
            alignItems: "center",
            backgroundColor: "#FFFFFE",
            borderColor: "#E8E8E7",
            borderRadius: "12px",
            borderStyle: "solid",
            borderWidth: "1px",
            boxShadow: "#1616150A 0px 1px 2px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            minHeight: "300px",
            maxWidth: "460px",
            margin: "0 auto",
            fontFamily: '"Geist", system-ui, sans-serif',
          }}
        >
          <div style={{ color: "#D32F2F", fontSize: "18px", fontWeight: 600 }}>
            Something went wrong
          </div>
          <div
            style={{ color: "#848483", fontSize: "15px", lineHeight: "20px" }}
          >
            An unexpected error occurred. Please refresh the page or try
            resetting the widget.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: "var(--foreground-brand)",
              border: "none",
              borderRadius: "8px",
              color: "#FFFFFE",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: 500,
              padding: "8px 16px",
              transition: "background-color 0.15s ease-out",
            }}
            type="button"
          >
            Reload Page
          </button>
        </div>
      }
    >
      <NexusWidgetInner {...props} />
    </ErrorBoundary>
  );
}

function NexusWidgetInner({
  config: rawConfig,
  embed = true,
  className,
  connectedAddress,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  onComplete,
  onConnectClick,
  onStart,
  onError,
  onReceiveAssetChange,
  onClose,
  onConnectWallet,
}: NexusWidgetProps) {
  const {
    nexusSDK,
    bridgableBalance,
    swapBalance,
    getFiatValue,
    resolveTokenUsdRate,
    swapSupportedChainsAndTokens,
    supportedChainsAndTokens,
    fetchSwapBalance,
    handleInit,
    swapIntent: providerSwapIntent,
    network,
    loading: nexusLoading,
  } = useNexus();
  const appConfig = useMemo(
    () => ({
      nexusNetwork: network ?? "mainnet",
    }),
    [network]
  );

  const normalizedWidgetConfig = useMemo(
    () => normalizeNexusWidgetConfig(rawConfig),
    [rawConfig]
  );
  const config = normalizedWidgetConfig.config;
  const activeMode = normalizedWidgetConfig.activeMode;
  const amountInputConfig = normalizedWidgetConfig.amountInput;
  const appearanceConfig = normalizedWidgetConfig.appearance;
  const configuredDepositOptions = normalizedWidgetConfig.depositOptions;
  const isConfiguredAmountFixed = normalizedWidgetConfig.isAmountFixed;
  const isConfiguredRecipientLocked =
    normalizedWidgetConfig.isRecipientLocked;
  const primaryColor = normalizeNexusWidgetPrimaryColor(
    appearanceConfig?.primaryColor
  );
  const primaryButtonBackground = primaryColor ?? nexusWidgetTheme.colors.text;
  const primaryButtonForeground = getReadableTextColor(
    primaryButtonBackground
  );
  const theme = useMemo(
    () => ({
      ...nexusWidgetTheme,
      colors: {
        ...nexusWidgetTheme.colors,
        primary: "var(--foreground-brand)",
        primaryText: "var(--foreground-brand)",
      },
    }),
    [primaryColor]
  );
  const configuredDeposit = getConfiguredDeposit(config);
  const configuredDepositIdentity = getDepositConfigIdentity(configuredDeposit);
  const configuredDestinationTokenOptions = useMemo(() => {
    const destination = rawConfig.destination;
    const destinationChainId = getConfiguredDestinationChainId(destination);
    const destinationTokens =
      rawConfig.mode === "deposit"
        ? configuredDepositOptions.map(toSwapTokenOptionFromDepositConfig)
        : destination?.tokens && destinationChainId
          ? destination.tokens
              .map((token) =>
                toSwapTokenOptionFromConfiguredDestinationToken(
                  token,
                  destinationChainId
                )
              )
              .filter((token): token is SwapTokenOption => Boolean(token))
          : [];

    const tokensByKey = new Map<string, SwapTokenOption>();
    for (const token of destinationTokens) {
      tokensByKey.set(getTokenSelectionKey(token), token);
    }
    return Array.from(tokensByKey.values());
  }, [configuredDepositOptions, rawConfig.destination]);
  if (activeMode === "deposit" && !configuredDeposit) {
    throw new Error(
      "NexusWidget deposit mode requires destination.chain, at least one destination token, depositAddress, and executeDeposit."
    );
  }
  const showCloseButton = !embed && Boolean(onClose);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlledOpen = controlledOpen !== undefined;
  const isModalOpen = isControlledOpen ? controlledOpen : internalOpen;

  // Preload receive tokens once SDK is available
  useEffect(() => {
    if (nexusSDK) {
      console.log(
        "[preloadReceiveTokens] Calling preloadReceiveTokens from NexusWidget useEffect (nexusSDK available)"
      );
      preloadReceiveTokens();
    }
  }, [nexusSDK]);

  const { connector, status: walletStatus } = useAccount();
  const {
    connectors,
    connectAsync,
    isPending: isWalletConnectPending,
  } = useConnect();
  const { data: walletClient } = useWalletClient();
  const { data: connectorClient } = useConnectorClient();
  const publicClient = usePublicClient();
  const walletClientAddress = walletClient?.account?.address;
  const ownerAddress =
    connectedAddress &&
    isAddress(connectedAddress) &&
    connectedAddress.toLowerCase() !== zeroAddress
      ? connectedAddress
      : walletClientAddress &&
          isAddress(walletClientAddress) &&
          walletClientAddress.toLowerCase() !== zeroAddress
        ? walletClientAddress
        : undefined;
  const historyStorageKey = getSwapHistoryStorageKey(ownerAddress);

  // Global form state
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(
    null
  );
  const [txError, setTxError] = useState<string | null>(null);
  const [walletActionPending, setWalletActionPending] = useState(false);
  const defaultRecipientAddress = ownerAddress ?? "";
  const effectiveRecipientAddress =
    activeMode === "swap"
      ? recipientAddress || defaultRecipientAddress
      : recipientAddress;
  const hasSameOwnerSendRecipient =
    activeMode === "send" &&
    Boolean(
      ownerAddress &&
        recipientAddress &&
        isAddress(recipientAddress) &&
        recipientAddress.toLowerCase() === ownerAddress.toLowerCase()
    );
  const hasCustomSwapRecipient =
    activeMode === "swap" &&
    Boolean(
      recipientAddress &&
        (!defaultRecipientAddress ||
          recipientAddress.toLowerCase() !==
            defaultRecipientAddress.toLowerCase())
    );
  const transferRecipientAddress =
    activeMode === "send"
      ? recipientAddress
      : hasCustomSwapRecipient
        ? recipientAddress
        : undefined;
  const previousDefaultRecipientRef = useRef(defaultRecipientAddress);

  // Swap-specific
  const [swapType, setSwapType] = useState<SwapType>("exactIn");
  const [swapStep, setSwapStep] = useState<SwapStep>("idle");
  const drawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const terminalBalanceRefreshTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [closingDrawerStep, setClosingDrawerStep] = useState<SwapStep | null>(
    null
  );
  const rootContentRef = useRef<HTMLDivElement | null>(null);
  const [rootContentHeight, setRootContentHeight] = useState<number | null>(
    null
  );
  const rootContentHeightRef = useRef<number | null>(null);
  const [hasMeasuredRootContent, setHasMeasuredRootContent] = useState(false);
  const [shouldAnimateRootHeight, setShouldAnimateRootHeight] = useState(false);
  const [isPreviewTransitioning, setIsPreviewTransitioning] = useState(false);
  const rootHeightTransitionTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [fromTokens, setFromTokens] = useState<SwapTokenOption[]>([]);
  const [sourceSelectionTouched, setSourceSelectionTouched] = useState(false);
  const [sourceSelectionRevision, setSourceSelectionRevision] = useState(0);
  const [exactOutQuoteSourceMode, setExactOutQuoteSourceMode] = useState<
    "all" | "selected"
  >("all");
  const exactOutQuoteSourceModeRef = useRef<"all" | "selected">("all");
  const [toToken, setToToken] = useState<SwapTokenOption | undefined>(
    undefined
  );
  const [fromTokensQuoteKey, setFromTokensQuoteKey] = useState("");

  useEffect(() => {
    const key = getSourceTokensQuoteKey(
      activeMode === "swap" && swapType === "exactIn"
        ? getReadyExactInSourceTokens(fromTokens)
        : fromTokens
    );
    setFromTokensQuoteKey(key);
  }, [activeMode, swapType, fromTokens]);
  const toTokenQuoteKey = getTokenQuoteKey(toToken);
  const appliedTokenPrefillRef = useRef<string | null>(null);

  useEffect(() => {
    if (!toToken?.chainId || !toToken.contractAddress) return;

    let active = true;
    const selectedTokenKey = getTokenSelectionKey(toToken);
    const applyLoadedReceiveToken = () => {
      if (!active) return;
      const loadedToken = getCachedReceiveTokenMatch(toToken);
      if (!loadedToken) return;

      setToToken((current) => {
        if (!current || getTokenSelectionKey(current) !== selectedTokenKey) {
          return current;
        }

        const chainMeta = current.chainId
          ? CHAIN_METADATA[current.chainId]
          : undefined;
        const next = {
          ...current,
          chainLogo:
            loadedToken.chainLogo || current.chainLogo || chainMeta?.logo,
          chainName: getShortChainName(
            current.chainId,
            loadedToken.chainName || current.chainName || chainMeta?.name
          ),
          decimals: loadedToken.decimals ?? current.decimals,
          logo: loadedToken.logo || current.logo,
          name: loadedToken.name || current.name,
          priceUSD: loadedToken.priceUSD ?? current.priceUSD,
          symbol: loadedToken.symbol || current.symbol,
        };

        if (
          current.decimals === next.decimals &&
          current.chainLogo === next.chainLogo &&
          current.chainName === next.chainName &&
          current.logo === next.logo &&
          current.name === next.name &&
          current.priceUSD === next.priceUSD &&
          current.symbol === next.symbol
        ) {
          return current;
        }

        return next;
      });
    };

    applyLoadedReceiveToken();
    const receiveTokensPromise = preloadReceiveTokens();
    receiveTokensPromise?.then(applyLoadedReceiveToken).catch((error) => {
      if (active) {
        console.warn("Unable to refresh receive token metadata", error);
      }
    });

    return () => {
      active = false;
    };
  }, [
    toToken?.chainId,
    toToken?.contractAddress,
    toToken?.decimals,
    toToken?.symbol,
  ]);

  const setExactOutQuoteSourceModeValue = useCallback(
    (mode: "all" | "selected") => {
      exactOutQuoteSourceModeRef.current = mode;
      setExactOutQuoteSourceMode(mode);
    },
    []
  );

  useEffect(() => {
    if (!nexusSDK) return;
    void fetchSwapBalance();
  }, [fetchSwapBalance, nexusSDK]);

  useEffect(() => {
    setSourceSelectionTouched(false);
    setExactOutQuoteSourceModeValue("all");
  }, [activeMode, setExactOutQuoteSourceModeValue]);

  useEffect(() => {
    const previousDefault = previousDefaultRecipientRef.current;
    previousDefaultRecipientRef.current = defaultRecipientAddress;

    if (activeMode !== "swap" || !defaultRecipientAddress) return;

    setRecipientAddress((current) => {
      if (
        !current ||
        (previousDefault &&
          current.toLowerCase() === previousDefault.toLowerCase())
      ) {
        return defaultRecipientAddress;
      }
      return current;
    });
  }, [activeMode, defaultRecipientAddress]);

  const {
    steps,
    seed,
    onStepsList,
    onStepComplete,
    reset: resetSteps,
  } = useTransactionSteps<SwapStepType>();
  const [progressEvents, setProgressEvents] = useState<NexusWidgetProgressEvent[]>(
    []
  );
  const progressEventsRef = useRef<NexusWidgetProgressEvent[]>([]);
  const swapStepsListRef = useRef<SwapStepType[]>([]);
  const [failedProgressStep, setFailedProgressStep] = useState<
    SwapStepType | BridgeStepType | null
  >(null);
  const [explorerUrls, setExplorerUrls] = useState<{
    sourceExplorerUrl: string | null;
    destinationExplorerUrl: string | null;
  }>({ sourceExplorerUrl: null, destinationExplorerUrl: null });
  const swapRunIdRef = useRef(0);

  const widgetSessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const widgetAttemptIdRef = useRef<string | null>(null);
  const widgetOpenedTsRef = useRef<number>(Date.now());
  const previewViewedTsRef = useRef<number | null>(null);
  const previewConfirmedTsRef = useRef<number | null>(null);
  const attemptCountRef = useRef(0);
  const fundsMovedRef = useRef(false);
  const intentUrlRef = useRef<string | null>(null);
  const hadSimulationSuccessRef = useRef(false);
  const hadPreviewViewedRef = useRef(false);
  const widgetOpenedFiredRef = useRef(false);
  const reachedTerminalRef = useRef(false);
  const lastIntentSourceTokensRef = useRef<SwapTokenOption[]>([]);
  const immediateQuoteAfterSourceEditRef = useRef(false);
  const amountEnteredLastValueRef = useRef<string>("");
  const lastInputMethodRef = useRef<
    | "typed"
    | "percent_20"
    | "percent_25"
    | "percent_50"
    | "percent_75"
    | "percent_max"
  >("typed");
  const prevSourceTouchedRef = useRef(false);
  const previousAutoSourceCountRef = useRef(0);
  const analyticsRef = useRef<{
    track: (event: string, properties?: Record<string, unknown>) => void;
  } | null>(null);
  const selectedOpportunityRef = useRef<NexusWidgetDepositOpportunityConfig | undefined>(
    undefined
  );

  const newAttemptId = useCallback(() => {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, []);

  const rotateAttempt = useCallback(() => {
    widgetAttemptIdRef.current = newAttemptId();
    previewViewedTsRef.current = null;
    previewConfirmedTsRef.current = null;
    fundsMovedRef.current = false;
    intentUrlRef.current = null;
    hadSimulationSuccessRef.current = false;
    hadPreviewViewedRef.current = false;
    reachedTerminalRef.current = false;
  }, [newAttemptId]);
  const [intentToAmount, setIntentToAmount] = useState<string | undefined>(
    undefined
  );
  const [intentFeeUsd, setIntentFeeUsd] = useState<string | undefined>(
    undefined
  );
  const [intentLoading, setIntentLoading] = useState(false);
  const [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const [receiveMaxCalculating, setReceiveMaxCalculating] = useState(false);
  const [maxCalculationPercent, setMaxCalculationPercent] = useState<
    number | null
  >(null);
  const maxSwapQuoteCacheRef = useRef<Record<string, CachedMaxSwapQuote>>({});
  const intentDestinationUsdRateCacheRef = useRef<
    Record<string, CachedIntentUsdRate>
  >({});
  const intentSymbolUsdRateCacheRef = useRef<
    Record<string, CachedIntentUsdRate>
  >({});
  const predictiveQuoteCacheRef = useRef<
    Record<string, PredictiveQuoteBaseline>
  >({});
  const predictiveQuoteRunRef = useRef(0);
  const [predictiveQuote, setPredictiveQuote] =
    useState<PredictiveQuote | null>(null);
  const maxPercentRunRef = useRef(0);
  const [previewQuoteRefreshing, setPreviewQuoteRefreshing] = useState(false);
  const [quoteRefreshProgress, setQuoteRefreshProgress] = useState(0);
  const [quoteRefreshSecondsRemaining, setQuoteRefreshSecondsRemaining] =
    useState(0);
  const [intentData, setIntentData] = useState<SwapIntentData | null>(null);
  const [swapQuoteIssue, setSwapQuoteIssue] = useState<SwapQuoteIssue | null>(
    null
  );
  const [receiveAmountIssue, setReceiveAmountIssue] =
    useState<ReceiveAmountIssue | null>(null);
  const receiveAmountIssueRef = useRef<ReceiveAmountIssue | null>(null);
  const receiveAmountIssueKeyRef = useRef("");
  const [transferExplorerUrl, setTransferExplorerUrl] = useState<string | null>(
    null
  );
  const swapStepRef = useRef<SwapStep>(swapStep);
  const syncingIntentSourcesRef = useRef(false);
  const lastSwapIntentRefreshAtRef = useRef(0);
  const [destinationBalance, setDestinationBalance] = useState<string | null>(
    null
  );
  const [swapHistory, setSwapHistory] = useState<SwapHistoryEntry[]>(() =>
    readSwapHistoryFromStorage(historyStorageKey)
  );
  const [currentSwapId, setCurrentSwapId] = useState<string | null>(null);
  const [historyNow, setHistoryNow] = useState(() => Date.now());
  const currentSwapIdRef = useRef<string | null>(null);
  const currentSwapStartedAtRef = useRef(0);
  const historyStorageKeyRef = useRef(historyStorageKey);
  const skipNextHistoryPersistRef = useRef(false);
  const explorerUrlsRef = useRef<{
    sourceExplorerUrl: string | null;
    destinationExplorerUrl: string | null;
  }>({ sourceExplorerUrl: null, destinationExplorerUrl: null });
  const activeQuoteInputKeyRef = useRef("");

  // Ref to store swap intent hook allow/deny callbacks
  const swapIntentRef = useRef<{
    intent?: SwapIntentData;
    allow: () => void;
    deny: () => void;
    refresh: () => Promise<any>;
    runId?: number;
    quoteInputKey?: string;
  } | null>(null);

  useEffect(() => {
    swapStepRef.current = swapStep;
  }, [swapStep]);

  useEffect(() => {
    return () => {
      if (drawerCloseTimerRef.current) {
        clearTimeout(drawerCloseTimerRef.current);
      }
      if (terminalBalanceRefreshTimerRef.current) {
        clearTimeout(terminalBalanceRefreshTimerRef.current);
      }
      if (rootHeightTransitionTimerRef.current) {
        clearTimeout(rootHeightTransitionTimerRef.current);
      }
    };
  }, []);

  const isQuoteEditLocked = useCallback(
    () => swapStepRef.current === "choose-swap-asset",
    []
  );

  const getQuoteRequestDelay = useCallback(() => {
    if (immediateQuoteAfterSourceEditRef.current) {
      immediateQuoteAfterSourceEditRef.current = false;
      return 0;
    }
    return EXACT_OUT_INPUT_DEBOUNCE_MS;
  }, []);

  const startRootHeightTransition = useCallback(() => {
    setShouldAnimateRootHeight(true);
    if (rootHeightTransitionTimerRef.current) {
      clearTimeout(rootHeightTransitionTimerRef.current);
    }
    rootHeightTransitionTimerRef.current = setTimeout(() => {
      setShouldAnimateRootHeight(false);
      rootHeightTransitionTimerRef.current = null;
    }, ROOT_HEIGHT_TRANSITION_MS);
  }, []);

  const closeDrawerToIdle = useCallback(() => {
    const isDrawerStep =
      swapStep === "choose-swap-asset" ||
      swapStep === "choose-receive-asset" ||
      swapStep === "enter-recipient";

    if (!isDrawerStep) {
      swapStepRef.current = "idle";
      setSwapStep("idle");
      return;
    }

    if (drawerCloseTimerRef.current) {
      clearTimeout(drawerCloseTimerRef.current);
    }

    setClosingDrawerStep(swapStep);
    drawerCloseTimerRef.current = setTimeout(() => {
      if (
        swapStep === "choose-swap-asset" ||
        swapStep === "choose-receive-asset"
      ) {
        startRootHeightTransition();
      }
      swapStepRef.current = "idle";
      setSwapStep("idle");
      setClosingDrawerStep(null);
      drawerCloseTimerRef.current = null;
    }, DRAWER_CLOSE_MS);
  }, [startRootHeightTransition, swapStep]);

  const openDrawerStep = useCallback((nextStep: SwapStep) => {
    if (drawerCloseTimerRef.current) {
      clearTimeout(drawerCloseTimerRef.current);
      drawerCloseTimerRef.current = null;
    }
    if (
      nextStep === "choose-swap-asset" ||
      nextStep === "choose-receive-asset"
    ) {
      startRootHeightTransition();
    }
    setClosingDrawerStep(null);
    swapStepRef.current = nextStep;
    setSwapStep(nextStep);
  }, [startRootHeightTransition]);

  const syncRootContentHeight = useCallback((animate = false) => {
    const element = rootContentRef.current;
    if (!element) return;

    const nextHeight = Math.ceil(
      Math.max(element.getBoundingClientRect().height, element.scrollHeight)
    );
    if (nextHeight <= 0) return;

    if (rootContentHeightRef.current === nextHeight) {
      setHasMeasuredRootContent(true);
      return;
    }

    rootContentHeightRef.current = nextHeight;
    setShouldAnimateRootHeight(animate);
    if (rootHeightTransitionTimerRef.current) {
      clearTimeout(rootHeightTransitionTimerRef.current);
      rootHeightTransitionTimerRef.current = null;
    }
    if (animate) {
      rootHeightTransitionTimerRef.current = setTimeout(() => {
        setShouldAnimateRootHeight(false);
        rootHeightTransitionTimerRef.current = null;
      }, ROOT_HEIGHT_TRANSITION_MS);
    }
    setRootContentHeight(nextHeight);
    setHasMeasuredRootContent(true);
  }, []);

  useLayoutEffect(() => {
    syncRootContentHeight(true);

    const element = rootContentRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        syncRootContentHeight(false);
      });
    });

    observer.observe(element);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
  }, [activeMode, swapStep, syncRootContentHeight]);

  useEffect(() => {
    currentSwapIdRef.current = currentSwapId;
  }, [currentSwapId]);

  useEffect(() => {
    if (historyStorageKeyRef.current === historyStorageKey) return;
    historyStorageKeyRef.current = historyStorageKey;
    skipNextHistoryPersistRef.current = true;
    setSwapHistory(readSwapHistoryFromStorage(historyStorageKey));
  }, [historyStorageKey]);

  useEffect(() => {
    if (skipNextHistoryPersistRef.current) {
      skipNextHistoryPersistRef.current = false;
      return;
    }

    writeSwapHistoryToStorage(historyStorageKey, swapHistory);
  }, [historyStorageKey, swapHistory]);

  useEffect(() => {
    if (swapStep !== "history") return;
    const timer = window.setInterval(() => setHistoryNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [swapStep]);

  const normalizeAddress = (value?: string | null) =>
    (value ?? "").toLowerCase();

  const buildIntentSourceToken = (
    source: SwapIntentData["sources"][number]
  ): SwapTokenOption => {
    let matchedAsset: any;
    let matchedBreakdown: any;
    const sourceAddress = normalizeAddress(source.token.contractAddress);

    for (const asset of swapBalance ?? []) {
      for (const breakdown of asset.breakdown ?? []) {
        const addressMatches =
          normalizeAddress(breakdown.contractAddress) === sourceAddress;
        const symbolMatches =
          breakdown.symbol === source.token.symbol ||
          asset.symbol === source.token.symbol;
        if (
          breakdown.chain?.id === source.chain.id &&
          (addressMatches || symbolMatches)
        ) {
          matchedAsset = asset;
          matchedBreakdown = breakdown;
          break;
        }
      }
      if (matchedBreakdown) break;
    }

    const chainMeta = CHAIN_METADATA[source.chain.id];
    const sourceValue = Number((source as any).value ?? 0);
    const isNativeSource = isNativeTokenAddress(source.token.contractAddress);
    const nativeCurrency = chainMeta?.nativeCurrency;
    const sourceSymbol =
      isNativeSource && (!source.token.symbol || !matchedAsset?.logo)
        ? nativeCurrency?.symbol || source.token.symbol
        : source.token.symbol || nativeCurrency?.symbol || "";
    const sourceDecimals =
      isNativeSource && nativeCurrency?.decimals !== undefined
        ? nativeCurrency.decimals
        : source.token.decimals;
    const sourceLogo =
      matchedAsset?.logo ?? (isNativeSource ? chainMeta?.logo : "");

    return {
      contractAddress: source.token.contractAddress,
      symbol: sourceSymbol,
      name: sourceSymbol,
      logo: sourceLogo ?? "",
      decimals: sourceDecimals,
      balance: matchedBreakdown?.balance
        ? `${matchedBreakdown.balance} ${sourceSymbol}`
        : `${source.amount} ${sourceSymbol}`,
      balanceInFiat:
        matchedBreakdown?.balanceInFiat != null
          ? `$${Number(matchedBreakdown.balanceInFiat).toFixed(2)}`
          : Number.isFinite(sourceValue)
            ? `$${sourceValue.toFixed(2)}`
            : "$0.00",
      chainId: source.chain.id,
      chainName: getShortChainName(
        source.chain.id,
        chainMeta?.name ?? source.chain.name
      ),
      chainLogo: chainMeta?.logo ?? source.chain.logo,
      userAmount: source.amount,
      userAmountUsd: Number.isFinite(sourceValue) ? source.value : undefined,
      userAmountMode: "token",
    };
  };

  const clearPendingSwapIntent = (
    clearQuote = true,
    options: { keepQuoteRefreshing?: boolean } = {}
  ) => {
    swapRunIdRef.current += 1;
    swapIntentRef.current?.deny();
    swapIntentRef.current = null;
    setIntentLoading(false);
    setTxError(null);
    if (!options.keepQuoteRefreshing) {
      setQuoteRefreshing(false);
    }
    setReceiveMaxCalculating(false);
    setPreviewQuoteRefreshing(false);
    setSwapQuoteIssue(null);
    resetProgressEvents();
    if (swapStepsListRef.current.length > 0 || steps.length > 0) {
      swapStepsListRef.current = [];
      resetSteps();
    } else {
      swapStepsListRef.current = [];
    }
    if (clearQuote) {
      setIntentToAmount(undefined);
      setIntentFeeUsd(undefined);
      setIntentData(null);
      if (!options.keepQuoteRefreshing) {
        setPredictiveQuote(null);
      }
    }
  };

  const clearSelectedSources = () => {
    setFromTokens((current) => (current.length === 0 ? current : []));
    setSourceSelectionTouched(false);
    setDepositSourceFilter("all");
    setExactOutQuoteSourceModeValue("all");
  };

  const resetExactOutSourcesToAuto = () => {
    setFromTokens((current) => (current.length === 0 ? current : []));
    setSourceSelectionTouched(false);
    setDepositSourceFilter("all");
    setExactOutQuoteSourceModeValue("all");
    setSourceSelectionRevision((current) => current + 1);
  };

  const getSourceAmountInput = (tokens: SwapTokenOption[]) => {
    const total = tokens.reduce(
      (sum, token) => sum + Number(token.userAmount || 0),
      0
    );
    return total > 0 ? String(total) : "";
  };

  const parseFiatNumber = (value: unknown) => {
    if (value === null || value === undefined || value === "") return undefined;
    if (Decimal.isDecimal(value)) return value;
    const cleaned = normalizeDecimalInputText(value);
    if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") {
      return undefined;
    }
    try {
      const parsed = new Decimal(cleaned);
      return parsed.isFinite() ? parsed : undefined;
    } catch {
      return undefined;
    }
  };

  const minimumSourceUsd = new Decimal(0);
  const hasMinimumSourceUsdBalance = (
    token: Pick<SwapTokenOption, "balanceInFiat">
  ) =>
    (parseFiatNumber(token.balanceInFiat) ?? new Decimal(0)).gte(
      minimumSourceUsd
    );
  const filterMinimumSourceUsdTokens = (tokens: SwapTokenOption[]) =>
    tokens.filter(hasMinimumSourceUsdBalance);

  const getTokenUsdRateCacheKeyFromParts = (
    chainId?: number,
    contractAddress?: string,
    symbol?: string
  ) => {
    if (!chainId || !symbol) return "";
    return [
      chainId,
      (contractAddress || zeroAddress).toLowerCase(),
      symbol.toUpperCase(),
    ].join(":");
  };

  const getTokenUsdRateCacheKey = (
    token?: Pick<SwapTokenOption, "chainId" | "contractAddress" | "symbol">
  ) =>
    getTokenUsdRateCacheKeyFromParts(
      token?.chainId,
      token?.contractAddress,
      token?.symbol
    );

  const getSymbolUsdRateCacheKey = (symbol?: string) =>
    symbol ? symbol.trim().toUpperCase() : "";

  const getCachedIntentUsdRate = (
    token?: Pick<SwapTokenOption, "chainId" | "contractAddress" | "symbol">
  ) => {
    const tokenKey = getTokenUsdRateCacheKey(token);
    const cached = tokenKey
      ? intentDestinationUsdRateCacheRef.current[tokenKey]
      : undefined;
    const rate = parseFiatNumber(cached?.rate);
    return rate && rate.gt(0) ? rate : undefined;
  };

  const cacheDestinationUsdRateFromIntent = (
    intent?: SwapIntentData | null
  ) => {
    const destination = intent?.destination;
    const amount = parseFiatNumber(destination?.amount);
    const value = parseFiatNumber(destination?.value);
    const chainId = destination?.chain?.id;
    const symbol = destination?.token?.symbol;

    if (
      !amount ||
      !value ||
      amount.lte(0) ||
      value.lte(0) ||
      !chainId ||
      !symbol
    ) {
      return;
    }

    const rate = value.div(amount);
    if (!rate.isFinite() || rate.lte(0)) return;

    const cached: CachedIntentUsdRate = {
      amount: amount.toFixed(),
      rate: rate.toDecimalPlaces(18).toFixed(),
      updatedAt: Date.now(),
      value: value.toFixed(),
    };
    const tokenKey = getTokenUsdRateCacheKeyFromParts(
      chainId,
      destination?.token?.contractAddress,
      symbol
    );
    if (tokenKey) {
      intentDestinationUsdRateCacheRef.current[tokenKey] = cached;
    }

    const symbolKey = getSymbolUsdRateCacheKey(symbol);
    if (symbolKey) {
      intentSymbolUsdRateCacheRef.current[symbolKey] = cached;
    }
  };

  const getSwapBalanceTotalUsd = () =>
    (swapBalance ?? []).reduce((sum, asset) => {
      const breakdown = asset.breakdown ?? [];
      if (breakdown.length > 0) {
        return sum.plus(
          breakdown.reduce((breakdownSum, item) => {
            const value = parseFiatNumber(item.balanceInFiat) ?? new Decimal(0);
            return value.gte(minimumSourceUsd)
              ? breakdownSum.plus(value)
              : breakdownSum;
          }, new Decimal(0))
        );
      }

      const value = parseFiatNumber(asset.balanceInFiat) ?? new Decimal(0);
      return value.gte(minimumSourceUsd) ? sum.plus(value) : sum;
    }, new Decimal(0));

  const getTokenUsdRate = (token: SwapTokenOption) => {
    const tokenBalance = parseFiatNumber(token.balance) ?? new Decimal(0);
    const fiatBalance = parseFiatNumber(token.balanceInFiat) ?? new Decimal(0);
    if (tokenBalance.gt(0) && fiatBalance.gt(0)) {
      return fiatBalance.div(tokenBalance);
    }

    const fallbackRate = getFiatValue(1, token.symbol);
    if (Number.isFinite(fallbackRate) && fallbackRate > 0) {
      return new Decimal(fallbackRate);
    }

    return getCachedIntentUsdRate(token) ?? new Decimal(0);
  };
  const getUsdRateForSymbol = (symbol?: string) => {
    if (!symbol) return new Decimal(0);
    const fiat = getFiatValue(1, symbol);
    if (Number.isFinite(fiat) && fiat > 0) {
      return new Decimal(fiat);
    }

    const cached =
      intentSymbolUsdRateCacheRef.current[getSymbolUsdRateCacheKey(symbol)];
    const rate = parseFiatNumber(cached?.rate);
    return rate && rate.gt(0) ? rate : new Decimal(0);
  };
  const getTotalBalancePercentUsdAmount = (pct: number) =>
    getSwapBalanceTotalUsd().mul(pct).div(100);
  const formatTokenAmountFromUsd = (
    usdAmount: Decimal,
    token: Pick<SwapTokenOption, "symbol" | "decimals">
  ) => {
    const rate = getUsdRateForSymbol(token.symbol);
    if (rate.lte(0)) return undefined;
    return usdAmount
      .div(rate)
      .toDecimalPlaces(Math.max(0, token.decimals ?? 18), Decimal.ROUND_DOWN)
      .toFixed();
  };

  const getMaxSwapQuoteCacheKey = (token?: SwapTokenOption) => {
    if (!token?.chainId) return "";
    return [
      token.chainId,
      (token.contractAddress || zeroAddress).toLowerCase(),
      token.symbol.toUpperCase(),
    ].join(":");
  };

  const getCachedMaxSwapQuote = (token?: SwapTokenOption) => {
    const key = getMaxSwapQuoteCacheKey(token);
    return key ? maxSwapQuoteCacheRef.current[key] : undefined;
  };

  const getCachedDestinationUsdRate = (token?: SwapTokenOption) => {
    const intentCachedRate = getCachedIntentUsdRate(token);
    if (intentCachedRate && intentCachedRate.gt(0)) {
      return intentCachedRate;
    }

    const cached = getCachedMaxSwapQuote(token);
    if (
      !cached ||
      !cached.maxUsdAmount ||
      cached.maxUsdAmount.lte(0) ||
      cached.maxTokenAmount.lte(0)
    ) {
      return undefined;
    }
    return cached.maxUsdAmount.div(cached.maxTokenAmount);
  };

  const resolveUsdRateForSymbol = async (symbol?: string) => {
    if (!symbol) return new Decimal(0);

    const localRate = getUsdRateForSymbol(symbol);
    if (localRate.gt(0)) return localRate;

    try {
      const resolvedRate = await resolveTokenUsdRate(symbol);
      return resolvedRate && resolvedRate > 0
        ? new Decimal(resolvedRate)
        : new Decimal(0);
    } catch {
      return new Decimal(0);
    }
  };

  const resolveMaxSwapQuote = async (token: SwapTokenOption) => {
    const key = getMaxSwapQuoteCacheKey(token);
    if (!key) return undefined;

    const cached = maxSwapQuoteCacheRef.current[key];
    if (cached) return cached;

    const calculateMaxForSwap = nexusSDK?.calculateMaxForSwap;
    if (typeof calculateMaxForSwap !== "function" || !token.chainId) {
      return undefined;
    }

    const max = await calculateMaxForSwap({
      toChainId: token.chainId,
      toTokenAddress: (token.contractAddress || zeroAddress) as `0x${string}`,
    });
    const decimals = Number.isFinite(Number(max.decimals))
      ? Number(max.decimals)
      : token.decimals || 18;
    const maxAmount =
      parseFiatNumber(max.maxAmount) ??
      (max.maxAmountRaw !== undefined
        ? new Decimal(max.maxAmountRaw.toString()).div(
            new Decimal(10).pow(decimals)
          )
        : undefined);

    if (!maxAmount || maxAmount.lte(0)) return undefined;

    const safeMaxAmount = maxAmount.mul(receiveMaxSafetyMultiplier);
    const destinationRate = await resolveUsdRateForSymbol(
      max.symbol || token.symbol
    );
    let maxUsdAmount = destinationRate.gt(0)
      ? safeMaxAmount.mul(destinationRate)
      : undefined;

    if (!maxUsdAmount || maxUsdAmount.lte(0)) {
      const sourcesUsd = await (max.sources ?? []).reduce(
        async (sumPromise, source) => {
          const sum = await sumPromise;
          const amount = parseFiatNumber(source.amount) ?? new Decimal(0);
          if (amount.lte(0)) return sum;

          const sourceRate = await resolveUsdRateForSymbol(source.symbol);
          return sourceRate.gt(0) ? sum.plus(amount.mul(sourceRate)) : sum;
        },
        Promise.resolve(new Decimal(0))
      );

      if (sourcesUsd.gt(0)) {
        maxUsdAmount = sourcesUsd.mul(receiveMaxSafetyMultiplier);
      }
    }

    const quote: CachedMaxSwapQuote = {
      decimals,
      maxTokenAmount: safeMaxAmount,
      maxUsdAmount,
      symbol: max.symbol || token.symbol,
    };
    maxSwapQuoteCacheRef.current[key] = quote;
    return quote;
  };

  const getPercentAmountFromMaxQuote = async (
    token: SwapTokenOption,
    pct: number,
    preferUsd: boolean
  ) => {
    const maxQuote = await resolveMaxSwapQuote(token);
    if (!maxQuote) return undefined;

    const ratio = new Decimal(pct).div(100);
    if (preferUsd && maxQuote.maxUsdAmount && maxQuote.maxUsdAmount.gt(0)) {
      return {
        amount: maxQuote.maxUsdAmount
          .mul(ratio)
          .toDecimalPlaces(2, Decimal.ROUND_DOWN)
          .toFixed(),
        mode: "usd" as const,
      };
    }

    return {
      amount: maxQuote.maxTokenAmount
        .mul(ratio)
        .toDecimalPlaces(Math.max(0, maxQuote.decimals), Decimal.ROUND_DOWN)
        .toFixed(),
      mode: "token" as const,
    };
  };

  const getTokenUsdValue = (
    token: SwapTokenOption,
    fallbackAmount?: string
  ) => {
    const amountNumber =
      parseFiatNumber(token.userAmount || fallbackAmount) ?? new Decimal(0);
    if (amountNumber.lte(0)) return new Decimal(0);
    const quotedUsd = parseFiatNumber(token.userAmountUsd);
    if (quotedUsd && quotedUsd.gte(0)) return quotedUsd;
    if (token.userAmountMode === "usd") return amountNumber;

    const rate = getTokenUsdRate(token);
    return rate.gt(0) ? amountNumber.mul(rate) : new Decimal(0);
  };

  const getTokenBalanceAmount = (token: SwapTokenOption) =>
    parseFiatNumber(token.balance) ?? new Decimal(0);

  const getTokenBalanceUsd = (token: SwapTokenOption) =>
    parseFiatNumber(token.balanceInFiat) ?? new Decimal(0);

  const getTokenAmountForUsd = (token: SwapTokenOption, usdAmount: Decimal) => {
    const rate = getTokenUsdRate(token);
    if (rate.lte(0) || usdAmount.lte(0)) return new Decimal(0);
    return usdAmount.div(rate);
  };

  const getUsdForTokenAmount = (
    token: SwapTokenOption,
    tokenAmount: Decimal
  ) => {
    const rate = getTokenUsdRate(token);
    if (rate.lte(0) || tokenAmount.lte(0)) return new Decimal(0);
    return tokenAmount.mul(rate);
  };

  const getExactOutDestinationBalanceCoverage = ({
    requestedAmount,
    requestedUsd,
    producedAmount,
    producedUsd,
    token = toToken,
  }: {
    requestedAmount?: Decimal;
    requestedUsd?: Decimal;
    producedAmount?: Decimal;
    producedUsd?: Decimal;
    token?: SwapTokenOption;
  }) => {
    if (
      (activeMode !== "deposit" && activeMode !== "send") ||
      !token ||
      !requestedAmount ||
      requestedAmount.lte(0)
    ) {
      return null;
    }

    const balanceAmount =
      parseFiatNumber(destinationBalance) ??
      parseFiatNumber(token.balance) ??
      new Decimal(0);
    if (balanceAmount.lte(0)) return null;

    const externalAmount =
      producedAmount && producedAmount.gt(0) ? producedAmount : new Decimal(0);
    const uncoveredAmount = Decimal.max(
      requestedAmount.minus(externalAmount),
      new Decimal(0)
    );
    const coveredAmount = Decimal.min(balanceAmount, uncoveredAmount);
    if (coveredAmount.lte(0)) return null;

    const requestedRate =
      requestedUsd && requestedUsd.gt(0)
        ? requestedUsd.div(requestedAmount)
        : undefined;
    const producedRate =
      producedUsd && producedUsd.gt(0) && producedAmount && producedAmount.gt(0)
        ? producedUsd.div(producedAmount)
        : undefined;
    const fallbackRate = getTokenUsdRate(token);
    const usdRate =
      requestedRate && requestedRate.gt(0)
        ? requestedRate
        : producedRate && producedRate.gt(0)
          ? producedRate
          : fallbackRate.gt(0)
            ? fallbackRate
            : undefined;

    return {
      amount: coveredAmount,
      usd: usdRate ? coveredAmount.mul(usdRate) : undefined,
    };
  };

  const buildDestinationBalanceDisplayToken = (
    coverage: ReturnType<typeof getExactOutDestinationBalanceCoverage>,
    token?: SwapTokenOption
  ): SwapTokenOption | null => {
    if (!coverage || !token || coverage.amount.lte(0)) return null;

    const amount = coverage.amount
      .toDecimalPlaces(Math.max(0, token.decimals ?? 18), Decimal.ROUND_DOWN)
      .toFixed();
    const usd = coverage.usd?.toDecimalPlaces(6, Decimal.ROUND_DOWN).toFixed();
    const balanceUsd = coverage.usd
      ? `$${coverage.usd.toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed()}`
      : token.balanceInFiat || "$0.00";

    return {
      ...token,
      balance: `${amount} ${token.symbol}`,
      balanceInFiat: balanceUsd,
      userAmount: amount,
      userAmountMode: "token",
      userAmountUsd: usd,
    };
  };

  const cacheSymbolUsdRate = (symbol: string | undefined, rate: Decimal) => {
    const symbolKey = getSymbolUsdRateCacheKey(symbol);
    if (!symbolKey || rate.lte(0)) return;

    intentSymbolUsdRateCacheRef.current[symbolKey] = {
      amount: "1",
      rate: rate.toDecimalPlaces(18).toFixed(),
      updatedAt: Date.now(),
      value: rate.toFixed(),
    };
  };

  const getPredictiveDestinationKey = (token?: SwapTokenOption) => {
    const tokenKey = getTokenUsdRateCacheKey(token);
    return tokenKey ? `destination:${tokenKey}` : "";
  };

  const getPredictiveSourceKey = (token: SwapTokenOption) =>
    [
      token.chainId ?? "unknown",
      (token.contractAddress || zeroAddress).toLowerCase(),
      token.symbol.toUpperCase(),
    ].join(":");

  const getPredictiveQuoteCacheKey = (
    mode = activeMode,
    type = swapType,
    destination = toToken,
    sources = fromTokens
  ) => {
    const destinationKey = getPredictiveDestinationKey(destination);
    if (!destinationKey) return "";
    if (mode !== "swap" || type !== "exactIn") {
      return `exactOut:${destinationKey}`;
    }

    const sourceKey = getExpandedSourceTokens(sources)
      .map(getPredictiveSourceKey)
      .sort()
      .join("+");
    return sourceKey ? `exactIn:${sourceKey}->${destinationKey}` : "";
  };

  const getPredictiveDisplayAmount = (
    amount: Decimal,
    token?: Pick<SwapTokenOption, "decimals">
  ) => {
    const decimals = Math.min(
      PREDICTIVE_QUOTE_DISPLAY_DECIMALS,
      Math.max(0, token?.decimals ?? 18)
    );
    return amount.toDecimalPlaces(decimals, Decimal.ROUND_DOWN).toFixed();
  };

  const resolveUsdRateForToken = async (token?: SwapTokenOption) => {
    if (!token?.symbol) return new Decimal(0);

    const localRate = getTokenUsdRate(token);
    if (localRate.gt(0)) return localRate;

    const resolvedRate = await resolveUsdRateForSymbol(token.symbol);
    if (resolvedRate.gt(0)) {
      cacheSymbolUsdRate(token.symbol, resolvedRate);
    }
    return resolvedRate;
  };

  const getDestinationReceiveLimitUsd = (token?: SwapTokenOption) => {
    if (!token?.chainId) return undefined;
    const limit = DESTINATION_RECEIVE_LIMIT_USD_BY_CHAIN_ID[token.chainId];
    return limit ? new Decimal(limit) : undefined;
  };

  const getImmediateDestinationReceiveUsdRate = (token?: SwapTokenOption) => {
    const priceUsd = parseFiatNumber(token?.priceUSD);
    if (priceUsd && priceUsd.gt(0)) return priceUsd;

    const cachedRate = getCachedDestinationUsdRate(token);
    if (cachedRate && cachedRate.gt(0)) return cachedRate;

    if (!token) return undefined;
    const localRate = getTokenUsdRate(token);
    return localRate.gt(0) ? localRate : undefined;
  };

  const getExactInSourceUsdForReceiveLimit = (
    sourceTokens: SwapTokenOption[],
    inputAmount: string
  ) => {
    if (sourceTokens.length === 0) return undefined;
    let hasPositiveSourceAmount = false;
    let totalUsd = new Decimal(0);

    for (const token of sourceTokens) {
      const fallbackAmount =
        sourceTokens.length === 1 ? inputAmount : undefined;
      const sourceAmount = parseFiatNumber(token.userAmount || fallbackAmount);
      if (!sourceAmount || sourceAmount.lte(0)) continue;

      hasPositiveSourceAmount = true;
      const sourceUsd = getTokenUsdValue(token, fallbackAmount);
      if (sourceUsd.lte(0)) return undefined;
      totalUsd = totalUsd.plus(sourceUsd);
    }

    return hasPositiveSourceAmount ? totalUsd : undefined;
  };

  const buildReceiveAmountIssue = ({
    destinationRate,
    destinationToken = toToken,
    inputAmount = amount,
    mode = activeMode,
    sourceTokens = fromTokens,
    type = swapType,
  }: {
    destinationRate?: Decimal;
    destinationToken?: SwapTokenOption;
    inputAmount?: string;
    mode?: NexusWidgetMode;
    sourceTokens?: SwapTokenOption[];
    type?: SwapType;
  } = {}): ReceiveAmountIssue | null => {
    const limit = getDestinationReceiveLimitUsd(destinationToken);
    if (!limit || !destinationToken) return null;

    const parsedAmount = parseFiatNumber(inputAmount);
    if (!parsedAmount || parsedAmount.lte(0)) return null;
    if (mode === "swap" && type === "exactIn" && sourceTokens.length === 0) {
      return null;
    }

    const chainName = getShortChainName(
      destinationToken.chainId,
      destinationToken.chainName
    );
    const resolvedDestinationRate =
      destinationRate ??
      getImmediateDestinationReceiveUsdRate(destinationToken);

    if (!resolvedDestinationRate || resolvedDestinationRate.lte(0)) {
      return {
        ctaLabel: "Price unavailable",
        message: `Unable to price ${destinationToken.symbol} on ${chainName}. Select another receive token.`,
        type: "unpricedReceiveToken",
      };
    }

    let receiveUsd: Decimal | undefined;
    if (mode === "swap" && type === "exactIn") {
      receiveUsd = getExactInSourceUsdForReceiveLimit(
        sourceTokens,
        inputAmount
      );
      if (!receiveUsd || receiveUsd.lte(0)) {
        return {
          ctaLabel: "Price unavailable",
          message: `Unable to price selected assets for ${chainName}'s receive limit.`,
          type: "unpricedReceiveToken",
        };
      }
    } else if (mode === "deposit" && depositAmountMode === "usd") {
      receiveUsd = parsedAmount;
    } else {
      receiveUsd = parsedAmount.mul(resolvedDestinationRate);
    }

    if (receiveUsd.gt(limit)) {
      return {
        ctaLabel: "Receive limit exceeded",
        message: `Maximum receive amount on ${chainName} is ${formatUsdDisplay(limit)}.`,
        type: "receiveLimitExceeded",
      };
    }

    return null;
  };

  const buildConfiguredAmountIssue = (
    inputAmount = amount
  ): ReceiveAmountIssue | null => {
    if (!amountInputConfig || !inputAmount) return null;
    const parsedAmount = parseFiatNumber(inputAmount);
    if (!parsedAmount || parsedAmount.lte(0)) return null;

    const minAmount = parseFiatNumber(amountInputConfig.min);
    if (minAmount && parsedAmount.lt(minAmount)) {
      return {
        ctaLabel: "Below minimum",
        message: `Minimum amount is ${minAmount.toFixed()}.`,
        type: "configuredAmountLimit",
      };
    }

    const maxAmount = parseFiatNumber(amountInputConfig.max);
    if (maxAmount && parsedAmount.gt(maxAmount)) {
      return {
        ctaLabel: "Above maximum",
        message: `Maximum amount is ${maxAmount.toFixed()}.`,
        type: "configuredAmountLimit",
      };
    }

    return null;
  };

  const clearPreviewForBlockingAmountIssue = () => {
    clearPendingSwapIntent(true);
    setQuoteRefreshing(false);
    setIntentLoading(false);
    setReceiveMaxCalculating(false);
    setPreviewQuoteRefreshing(false);
    setTxError(null);
    setSwapQuoteIssue(null);
  };

  const applyReceiveAmountIssue = (issue: ReceiveAmountIssue | null) => {
    const key = issue ? `${issue.type}:${issue.message}` : "";
    receiveAmountIssueRef.current = issue;
    if (receiveAmountIssueKeyRef.current !== key) {
      receiveAmountIssueKeyRef.current = key;
      setReceiveAmountIssue(issue);
    }
    if (!issue) return;

    clearPendingSwapIntent(true);
    setQuoteRefreshing(false);
    setIntentLoading(false);
    setReceiveMaxCalculating(false);
    setPreviewQuoteRefreshing(false);
    setTxError(null);
  };

  const getPredictiveExactInSourceTokens = () => {
    const expanded = getExpandedSourceTokens(fromTokens);
    if (expanded.length === 0) return [];

    return expanded
      .map((token) => {
        const userAmount =
          token.userAmount ||
          (expanded.length === 1 && hasPositiveDecimalInput(amount)
            ? amount
            : "");
        return { ...token, userAmount };
      })
      .filter((token) => hasPositiveDecimalInput(token.userAmount));
  };

  const sortUnifiedSourceTokens = (tokens: SwapTokenOption[]) =>
    [...tokens].sort((a, b) => {
      const fiatDiff = getTokenBalanceUsd(b).cmp(getTokenBalanceUsd(a));
      if (fiatDiff !== 0) return fiatDiff;
      return getTokenBalanceAmount(b).cmp(getTokenBalanceAmount(a));
    });

  const allocateUnifiedExactInToken = (
    token: SwapTokenOption,
    fallbackAmount?: string
  ) => {
    if (!token.isUnified || !token.sourceTokens?.length) return [token];

    const rawAmount =
      parseFiatNumber(token.userAmount || fallbackAmount) ?? new Decimal(0);
    if (rawAmount.lte(0)) return [];

    const sortedSources = sortUnifiedSourceTokens(token.sourceTokens).filter(
      (source) =>
        source.chainId &&
        source.contractAddress &&
        getTokenBalanceAmount(source).gt(0) &&
        hasMinimumSourceUsdBalance(source)
    );
    const allocated: SwapTokenOption[] = [];

    if (token.userAmountMode === "usd") {
      let remainingUsd = rawAmount;

      for (const source of sortedSources) {
        if (remainingUsd.lte(0)) break;

        const availableUsd = getTokenBalanceUsd(source);
        if (availableUsd.lte(0)) continue;

        const targetUsd = Decimal.min(remainingUsd, availableUsd);
        const tokenAmount = getTokenAmountForUsd(
          source,
          targetUsd
        ).toDecimalPlaces(
          Math.max(0, source.decimals || 18),
          Decimal.ROUND_DOWN
        );
        if (tokenAmount.lte(0)) continue;

        const actualUsd = getUsdForTokenAmount(source, tokenAmount);
        allocated.push({
          ...source,
          userAmount: tokenAmount.toFixed(),
          userAmountMode: "token",
          userAmountUsd: actualUsd
            .toDecimalPlaces(6, Decimal.ROUND_DOWN)
            .toFixed(),
        });
        remainingUsd = remainingUsd.minus(targetUsd);
      }

      return allocated;
    }

    let remainingTokenAmount = rawAmount;

    for (const source of sortedSources) {
      if (remainingTokenAmount.lte(0)) break;

      const availableTokenAmount = getTokenBalanceAmount(source);
      if (availableTokenAmount.lte(0)) continue;

      const tokenAmount = Decimal.min(
        remainingTokenAmount,
        availableTokenAmount
      ).toDecimalPlaces(Math.max(0, source.decimals || 18), Decimal.ROUND_DOWN);
      if (tokenAmount.lte(0)) continue;

      const actualUsd = getUsdForTokenAmount(source, tokenAmount);
      allocated.push({
        ...source,
        userAmount: tokenAmount.toFixed(),
        userAmountMode: "token",
        userAmountUsd: actualUsd
          .toDecimalPlaces(6, Decimal.ROUND_DOWN)
          .toFixed(),
      });
      remainingTokenAmount = remainingTokenAmount.minus(tokenAmount);
    }

    return allocated;
  };

  const getExactInSourceTokens = (
    tokens: SwapTokenOption[],
    fallbackAmount?: string
  ) =>
    tokens
      .flatMap((token) =>
        token.isUnified
          ? allocateUnifiedExactInToken(token, fallbackAmount)
          : [token]
      )
      .filter(hasMinimumSourceUsdBalance);

  const hasPositiveDecimalInput = (value: unknown) =>
    Boolean(parseFiatNumber(value)?.gt(0));

  const getReadyExactInSourceTokens = (tokens: SwapTokenOption[]) =>
    getExactInSourceTokens(tokens).filter(
      (token) =>
        Boolean(token.chainId && token.contractAddress) &&
        hasPositiveDecimalInput(token.userAmount)
    );

  const hasReadyExactInSwapInput = (
    tokens: SwapTokenOption[],
    destination?: SwapTokenOption
  ) =>
    Boolean(
      destination?.chainId &&
        destination.contractAddress &&
        getReadyExactInSourceTokens(tokens).length > 0
    );

  const getExpandedSourceTokens = (tokens: SwapTokenOption[]) => {
    const expanded = tokens.flatMap((token) =>
      token.isUnified && token.sourceTokens?.length
        ? token.sourceTokens
        : [token]
    );
    const seen = new Set<string>();
    return expanded.filter((token) => {
      if (!token.chainId || !token.contractAddress) return false;
      if (
        !isSwapSupportedBySdkChainList(
          token.chainId,
          swapSupportedChainsAndTokens
        )
      ) {
        return false;
      }
      const key = `${token.chainId}-${token.contractAddress.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const getNativeGasBalanceForChain = (chainId: number) => {
    const nativeSymbol =
      CHAIN_METADATA[chainId]?.nativeCurrency?.symbol?.toUpperCase();
    let balance = new Decimal(0);

    for (const asset of swapBalance ?? []) {
      for (const breakdown of asset.breakdown ?? []) {
        if (breakdown.chain?.id !== chainId) continue;
        const breakdownSymbol = (
          breakdown.symbol ??
          asset.symbol ??
          ""
        ).toUpperCase();
        const assetSymbol = (asset.symbol ?? "").toUpperCase();
        const isNativeBalance =
          isNativeTokenAddress(breakdown.contractAddress) ||
          Boolean(
            nativeSymbol &&
              (breakdownSymbol === nativeSymbol || assetSymbol === nativeSymbol)
          );

        if (!isNativeBalance) continue;
        balance = balance.plus(
          parseFiatNumber(breakdown.balance) ?? new Decimal(0)
        );
      }
    }

    return balance;
  };

  const hasGasForSource = (token: SwapTokenOption) => {
    if (!token.chainId || !token.contractAddress) return false;
    const tokenBalance = parseFiatNumber(token.balance) ?? new Decimal(0);
    if (tokenBalance.lte(0)) return false;
    if (isNativeTokenAddress(token.contractAddress)) return true;
    return getNativeGasBalanceForChain(token.chainId).gt(0);
  };

  const getGasCapableBalanceSourceTokens = () => {
    const tokens: SwapTokenOption[] = [];

    for (const asset of swapBalance ?? []) {
      for (const breakdown of asset.breakdown ?? []) {
        const chainId = breakdown.chain?.id;
        const contractAddress = breakdown.contractAddress;
        const balance = parseFiatNumber(breakdown.balance) ?? new Decimal(0);
        const fiatBalance = parseFiatNumber(breakdown.balanceInFiat);
        if (
          !chainId ||
          !contractAddress ||
          balance.lte(0) ||
          !fiatBalance ||
          fiatBalance.lt(minimumSourceUsd)
        )
          continue;

        const chainMeta = CHAIN_METADATA[chainId];
        const symbol = breakdown.symbol ?? asset.symbol;
        tokens.push({
          chainId,
          chainLogo: chainMeta?.logo ?? breakdown.chain?.logo,
          chainName: getShortChainName(
            chainId,
            chainMeta?.name ?? breakdown.chain?.name
          ),
          contractAddress,
          decimals: breakdown.decimals ?? asset.decimals ?? 18,
          logo: asset.logo ?? "",
          name: symbol,
          symbol,
          balance: `${breakdown.balance} ${symbol}`,
          balanceInFiat:
            fiatBalance !== undefined
              ? `$${fiatBalance.toDecimalPlaces(2).toFixed()}`
              : "$0.00",
        });
      }
    }

    return getExpandedSourceTokens(tokens).filter(hasGasForSource);
  };

  const getDepositDestinationForSourceSelection = () => {
    const destination =
      activeMode === "deposit" ? selectedOpportunity : toToken;
    const chainId = destination?.chainId;
    const tokenAddress =
      activeMode === "deposit"
        ? selectedOpportunity?.tokenAddress
        : toToken?.contractAddress;
    const tokenSymbol =
      activeMode === "deposit"
        ? selectedOpportunity?.tokenSymbol
        : toToken?.symbol;

    if (!chainId || !tokenAddress || !tokenSymbol) return undefined;

    return {
      chainId,
      tokenAddress: tokenAddress as `0x${string}`,
      tokenSymbol,
    };
  };
  const getDestinationSourceIdForDeposit = () => {
    const destination = getDepositDestinationForSourceSelection();
    return destination
      ? getDepositSourceId(destination.tokenAddress, destination.chainId)
      : undefined;
  };
  const getDepositSourceTargetUsd = () => {
    if (activeMode !== "deposit") return undefined;
    const requestedUsd = depositUsdDecimal;
    if (!requestedUsd || requestedUsd.lte(0)) return undefined;

    const coverage = getExactOutDestinationBalanceCoverage({
      requestedAmount: depositTokenAmountForQuote,
      requestedUsd,
      token: toToken,
    });
    return Decimal.max(
      requestedUsd.minus(coverage?.usd ?? new Decimal(0)),
      new Decimal(0)
    );
  };

  const getDepositSourceIdsFromTokens = (tokens: SwapTokenOption[]) =>
    getExpandedSourceTokens(tokens)
      .filter((token) => token.chainId && token.contractAddress)
      .map((token) =>
        getDepositSourceId(token.contractAddress, token.chainId!)
      );

  const getDepositTokenOptionsBySourceId = () => {
    const map = new Map<string, SwapTokenOption>();
    const sourceTokens = [
      ...(swapBalance
        ? deriveTokenOptions(swapBalance, swapSupportedChainsAndTokens)
        : []),
      ...fromTokens,
    ];

    for (const token of getExpandedSourceTokens(sourceTokens)) {
      if (!token.chainId || !token.contractAddress) continue;
      const id = getDepositSourceId(token.contractAddress, token.chainId);
      if (!map.has(id)) {
        map.set(id, {
          ...token,
          userAmount: "",
        });
      }
    }

    return map;
  };

  const getDepositSourceTokensForIds = (sourceIds: string[]) => {
    const tokenBySourceId = getDepositTokenOptionsBySourceId();
    return sourceIds
      .map((sourceId) => tokenBySourceId.get(sourceId))
      .filter((token): token is SwapTokenOption => Boolean(token))
      .map((token) => ({ ...token, userAmount: "" }));
  };

  const getResolvedDepositSourceSelection = (options?: {
    filter?: DepositSourceFilter;
    selectedTokens?: SwapTokenOption[];
    isManualSelection?: boolean;
    targetAmountUsd?: Decimal;
  }) => {
    const destination = getDepositDestinationForSourceSelection();
    if (!destination) {
      return { sourcePoolIds: [], selectedSourceIds: [], fromSources: [] };
    }

    const manualSelection =
      options?.isManualSelection ?? sourceSelectionTouched;
    const selectedTokensForResolution = options?.selectedTokens ?? fromTokens;
    const selectedSourceIds = getDepositSourceIdsFromTokens(
      selectedTokensForResolution
    );
    const destinationSourceId = getDestinationSourceIdForDeposit();
    const targetAmountUsd =
      options?.targetAmountUsd ??
      (activeMode === "deposit"
        ? getDepositSourceTargetUsd()
        : activeMode === "send"
          ? new Decimal(sendAmountUsd || 0)
          : undefined);

    return resolveDepositSourceSelection({
      swapBalance,
      destination,
      filter: manualSelection
        ? "custom"
        : (options?.filter ?? depositSourceFilter),
      selectedSourceIds,
      isManualSelection: manualSelection,
      minimumBalanceUsd: minimumSourceUsd.toNumber(),
      targetAmountUsd: targetAmountUsd?.toNumber(),
      excludedSourceIds: destinationSourceId ? [destinationSourceId] : [],
    });
  };

  const getExactOutSourceTokens = (
    mode: "all" | "selected" = exactOutQuoteSourceModeRef.current,
    targetAmountUsd?: Decimal
  ) => {
    if (activeMode === "deposit") {
      const selection = getResolvedDepositSourceSelection({ targetAmountUsd });
      return getDepositSourceTokensForIds(selection.selectedSourceIds);
    }

    if (activeMode === "send" && mode === "selected" && fromTokens.length > 0) {
      return filterMinimumSourceUsdTokens(
        getExpandedSourceTokens(fromTokens)
      ).filter(hasGasForSource);
    }

    return getGasCapableBalanceSourceTokens();
  };

  const buildExplicitSourcesPayload = (tokens: SwapTokenOption[]) => {
    const eligibleTokens = filterMinimumSourceUsdTokens(tokens).filter(
      (token) => token.chainId && token.contractAddress
    );
    return {
      sources: eligibleTokens.map((token) => ({
        chainId: token.chainId!,
        tokenAddress: token.contractAddress as `0x${string}`,
      })),
    };
  };

  const getSdkSourceKey = (source: {
    chainId: number;
    tokenAddress: `0x${string}`;
  }) => {
    const normalizedAddress = isNativeTokenAddress(source.tokenAddress)
      ? zeroAddress
      : source.tokenAddress.toLowerCase();
    return `${source.chainId}:${normalizedAddress}`;
  };

  const dedupeSdkSources = (
    sources: Array<
      | {
          chainId: number;
          tokenAddress: `0x${string}`;
        }
      | undefined
    >
  ) => {
    const seen = new Set<string>();
    return sources.filter(
      (
        source
      ): source is {
        chainId: number;
        tokenAddress: `0x${string}`;
      } => {
        if (!source) return false;
        const key = getSdkSourceKey(source);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }
    );
  };

  const getHeldNativeGasSourceForChain = (chainId?: number) => {
    if (!chainId) return undefined;

    const nativeSymbol =
      CHAIN_METADATA[chainId]?.nativeCurrency?.symbol?.toUpperCase();
    for (const asset of swapBalance ?? []) {
      for (const breakdown of asset.breakdown ?? []) {
        if (breakdown.chain?.id !== chainId) continue;

        const breakdownSymbol = (
          breakdown.symbol ??
          asset.symbol ??
          ""
        ).toUpperCase();
        const assetSymbol = (asset.symbol ?? "").toUpperCase();
        const isNativeBalance =
          isNativeTokenAddress(breakdown.contractAddress) ||
          Boolean(
            nativeSymbol &&
              (breakdownSymbol === nativeSymbol || assetSymbol === nativeSymbol)
          );
        const balance = parseFiatNumber(breakdown.balance) ?? new Decimal(0);

        if (!isNativeBalance || balance.lte(0)) continue;
        return {
          chainId,
          tokenAddress: (breakdown.contractAddress ||
            zeroAddress) as `0x${string}`,
        };
      }
    }

    return undefined;
  };

  const getHeldDestinationTokenSource = () => {
    if (!toToken?.chainId || !toToken.contractAddress) return undefined;

    for (const asset of swapBalance ?? []) {
      for (const breakdown of asset.breakdown ?? []) {
        const chainId = breakdown.chain?.id;
        if (chainId !== toToken.chainId) continue;

        const breakdownAddress = breakdown.contractAddress;
        const addressMatches =
          breakdownAddress &&
          (breakdownAddress.toLowerCase() ===
            toToken.contractAddress.toLowerCase() ||
            (isNativeTokenAddress(breakdownAddress) &&
              isNativeTokenAddress(toToken.contractAddress)));
        const symbolMatches =
          (breakdown.symbol ?? asset.symbol ?? "").toUpperCase() ===
          toToken.symbol.toUpperCase();
        const balance = parseFiatNumber(breakdown.balance) ?? new Decimal(0);

        if ((!addressMatches && !symbolMatches) || balance.lte(0)) continue;
        return {
          chainId,
          tokenAddress: (breakdown.contractAddress ||
            toToken.contractAddress) as `0x${string}`,
        };
      }
    }

    return undefined;
  };

  const shouldSendExactOutSourceAllowlist = () => {
    if (activeMode === "deposit") {
      return sourceSelectionTouched || depositSourceFilter !== "all";
    }

    if (activeMode === "send") {
      return exactOutQuoteSourceModeRef.current === "selected";
    }

    return true;
  };

  const buildExactOutSourcesPayload = (tokens: SwapTokenOption[]) => {
    if (activeMode !== "deposit" && activeMode !== "send") {
      return buildExplicitSourcesPayload(tokens);
    }

    if (!shouldSendExactOutSourceAllowlist()) {
      return {};
    }

    const explicitSources = buildExplicitSourcesPayload(tokens).sources;
    const sources = dedupeSdkSources([
      ...explicitSources,
      getHeldDestinationTokenSource(),
      getHeldNativeGasSourceForChain(toToken?.chainId),
    ]);

    return sources.length > 0 ? { sources } : {};
  };

  const buildPredictiveExactOutSources = async (requiredSourceUsd: Decimal) => {
    if (requiredSourceUsd.lte(0)) return [];

    const destinationKey = getTokenSelectionKey(toToken);
    const candidates = getExactOutSourceTokens(
      exactOutQuoteSourceModeRef.current,
      requiredSourceUsd
    )
      .filter((token) => getTokenSelectionKey(token) !== destinationKey)
      .filter((token) => getTokenBalanceUsd(token).gt(0));
    const sources: SwapTokenOption[] = [];
    let remainingUsd = requiredSourceUsd;

    for (const token of candidates) {
      if (remainingUsd.lte(0)) break;

      const availableUsd = getTokenBalanceUsd(token);
      if (availableUsd.lte(0)) continue;

      const rate = await resolveUsdRateForToken(token);
      if (rate.lte(0)) continue;

      const targetUsd = Decimal.min(remainingUsd, availableUsd);
      const tokenAmount = targetUsd
        .div(rate)
        .toDecimalPlaces(Math.max(0, token.decimals || 18), Decimal.ROUND_DOWN);
      if (tokenAmount.lte(0)) continue;

      sources.push({
        ...token,
        userAmount: tokenAmount.toFixed(),
        userAmountMode: "token",
        userAmountUsd: targetUsd
          .toDecimalPlaces(6, Decimal.ROUND_DOWN)
          .toFixed(),
      });
      remainingUsd = remainingUsd.minus(targetUsd);
    }

    return remainingUsd.gt(0.01) ? [] : sources;
  };

  const getErrorText = (error: unknown) => {
    const err = error as any;
    const parts = [
      err?.message,
      typeof error === "string" ? error : undefined,
      err?.code,
    ];

    try {
      if (err?.data) parts.push(JSON.stringify(err.data));
    } catch {
      // Ignore non-serializable SDK error metadata.
    }

    return parts.filter(Boolean).join(" ");
  };

  const isInsufficientSourcesError = (error: unknown) => {
    const err = error as any;
    const message = getErrorText(error).toLowerCase();

    return (
      err?.code === ERROR_CODES.INSUFFICIENT_BALANCE ||
      message.includes("insufficient balance") ||
      message.includes("sources are not enough") ||
      (message.includes("source") && message.includes("not enough"))
    );
  };

  const isViemInvalidDecimalError = (error: unknown) =>
    getErrorText(error).toLowerCase().includes("not a valid decimal number");

  const parseLabeledErrorDecimal = (text: string, label: string) => {
    const match = text.match(
      new RegExp(`${label}\\s*:\\s*\\$?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)`, "i")
    );
    return match ? parseFiatNumber(match[1]) : undefined;
  };

  const getExactOutRequestedUsd = () => {
    const amountNumber = parseFiatNumber(amount);
    if (!amountNumber || amountNumber.lte(0) || !toToken?.symbol) {
      return undefined;
    }

    if (activeMode === "deposit" && depositAmountMode === "usd") {
      return amountNumber;
    }

    const fiatValue = getFiatValue(amountNumber.toNumber(), toToken.symbol);
    return Number.isFinite(fiatValue) && fiatValue > 0
      ? new Decimal(fiatValue)
      : undefined;
  };

  const getExactOutAvailableSourceUsd = () => {
    if (exactOutQuoteSourceModeRef.current === "selected") {
      return fromTokens.reduce((sum, token) => {
        const value = parseFiatNumber(token.balanceInFiat) ?? new Decimal(0);
        return value.gte(minimumSourceUsd) ? sum.plus(value) : sum;
      }, new Decimal(0));
    }

    const allSourceTotal = getGasCapableBalanceSourceTokens().reduce(
      (sum, token) => {
        const value = parseFiatNumber(token.balanceInFiat) ?? new Decimal(0);
        return value.gte(minimumSourceUsd) ? sum.plus(value) : sum;
      },
      new Decimal(0)
    );

    return allSourceTotal.gt(0) ? allSourceTotal : getSwapBalanceTotalUsd();
  };

  const getExactInSourceDeficitUsd = () => {
    if (swapType !== "exactIn" || fromTokens.length === 0) return undefined;

    return fromTokens.reduce((sum, token) => {
      const requestedAmount = parseFiatNumber(token.userAmount);
      if (!requestedAmount || requestedAmount.lte(0)) return sum;

      if (token.userAmountMode === "usd") {
        const availableUsd = parseFiatNumber(token.balanceInFiat);
        if (!availableUsd || requestedAmount.lte(availableUsd)) return sum;
        return sum.plus(requestedAmount.minus(availableUsd));
      }

      const availableTokenAmount = parseFiatNumber(token.balance);
      if (!availableTokenAmount || requestedAmount.lte(availableTokenAmount)) {
        return sum;
      }

      const missingTokenAmount = requestedAmount.minus(availableTokenAmount);
      const fiatBalance = parseFiatNumber(token.balanceInFiat);
      if (fiatBalance && availableTokenAmount.gt(0)) {
        return sum.plus(
          missingTokenAmount.mul(fiatBalance.div(availableTokenAmount))
        );
      }

      return sum;
    }, new Decimal(0));
  };

  const buildInsufficientSourcesIssue = (error: unknown): SwapQuoteIssue => {
    const errorText = getErrorText(error);
    const details =
      (error as any)?.data?.details ?? (error as any)?.details ?? {};
    const requiredFromError =
      parseFiatNumber(
        details.requiredUsd ??
          details.requiredUSD ??
          details.requiredAmountUsd ??
          details.requiredAmount ??
          details.required
      ) ?? parseLabeledErrorDecimal(errorText, "required");
    const availableFromError =
      parseFiatNumber(
        details.availableUsd ??
          details.availableUSD ??
          details.availableAmountUsd ??
          details.availableAmount ??
          details.available
      ) ?? parseLabeledErrorDecimal(errorText, "available");
    const requestedUsd = getExactOutRequestedUsd();
    const availableUsd = getExactOutAvailableSourceUsd();
    const exactInSourceDeficitUsd = getExactInSourceDeficitUsd();

    let missingUsd =
      exactInSourceDeficitUsd && exactInSourceDeficitUsd.gt(0)
        ? exactInSourceDeficitUsd
        : requiredFromError && availableFromError
          ? requiredFromError.minus(availableFromError)
          : undefined;

    if (
      requestedUsd &&
      (!missingUsd || missingUsd.lte(0) || missingUsd.gt(requestedUsd.mul(5)))
    ) {
      missingUsd = requestedUsd.minus(availableUsd);
    }

    if (missingUsd && missingUsd.gt(0)) {
      const formattedMissing =
        missingUsd.gt(0) && missingUsd.lt(0.01)
          ? "<$0.01"
          : formatUsdDisplay(missingUsd);

      return {
        type: "insufficientSources",
        missingUsd: missingUsd.toDecimalPlaces(2).toFixed(),
        message: `Need ${formattedMissing} more across your assets`,
      };
    }

    return {
      type: "insufficientSources",
      message: "Add more source balance across your assets",
    };
  };

  const buildExactOutSourceBalanceIssue = (): SwapQuoteIssue | null => {
    if (activeMode !== "deposit" && activeMode !== "send") return null;
    const requestedUsd = getExactOutRequestedUsd();
    const availableUsd = getExactOutAvailableSourceUsd();
    if (!requestedUsd || requestedUsd.lte(0) || !availableUsd) return null;

    const missingUsd = requestedUsd.minus(availableUsd);
    if (missingUsd.lte(0.01)) return null;

    const formattedMissing =
      missingUsd.gt(0) && missingUsd.lt(0.01)
        ? "<$0.01"
        : formatUsdDisplay(missingUsd);

    return {
      type: "insufficientSources",
      missingUsd: missingUsd.toDecimalPlaces(2).toFixed(),
      message: `Need ${formattedMissing} more across your assets`,
    };
  };

  const isNativeTokenAddress = (address?: string) =>
    !address ||
    address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
    address.toLowerCase() === "0x0000000000000000000000000000000000000000";

  const formatReadableTokenAmount = (rawAmount: bigint, decimals: number) =>
    new Decimal(rawAmount.toString())
      .div(new Decimal(10).pow(decimals))
      .toFixed();

  const formatReadableTokenBalanceAmount = (
    rawAmount: bigint,
    decimals: number
  ) =>
    new Decimal(rawAmount.toString())
      .div(new Decimal(10).pow(decimals))
      .toDecimalPlaces(6)
      .toFixed();

  const trimDecimalString = (value: string) =>
    value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

  const buildSourceTokenSnapshotMap = useCallback(
    (balances: UserAsset[] | null | undefined) => {
      const snapshots = new Map<string, SwapTokenOption>();

      for (const asset of balances ?? []) {
        for (const breakdown of asset.breakdown ?? []) {
          const chainId = breakdown.chain?.id;
          const contractAddress = breakdown.contractAddress;
          const symbol = breakdown.symbol ?? asset.symbol;

          if (
            !chainId ||
            !contractAddress ||
            !symbol ||
            !isSwapSupportedBySdkChainList(
              chainId,
              swapSupportedChainsAndTokens
            )
          ) {
            continue;
          }

          const chainMeta = CHAIN_METADATA[chainId];
          const fiatBalance = parseFiatNumber(breakdown.balanceInFiat);
          const snapshot: SwapTokenOption = {
            balance: `${breakdown.balance ?? "0"} ${symbol}`,
            balanceInFiat: fiatBalance
              ? formatUsdDisplay(fiatBalance)
              : "$0.00",
            chainId,
            chainLogo: chainMeta?.logo ?? breakdown.chain?.logo,
            chainName: getShortChainName(
              chainId,
              chainMeta?.name ?? breakdown.chain?.name
            ),
            contractAddress,
            decimals: breakdown.decimals ?? asset.decimals ?? 18,
            logo: asset.logo ?? "",
            name: symbol,
            symbol,
          };
          snapshots.set(getTokenSelectionKey(snapshot), snapshot);
        }
      }

      return snapshots;
    },
    [swapSupportedChainsAndTokens]
  );

  const patchSourceTokensWithBalances = useCallback(
    (tokens: SwapTokenOption[], balances: UserAsset[]) => {
      const snapshots = buildSourceTokenSnapshotMap(balances);

      const updateToken = (token: SwapTokenOption): SwapTokenOption => {
        const preservedAmounts = {
          userAmount: token.userAmount,
          userAmountMode: token.userAmountMode,
          userAmountUsd: token.userAmountUsd,
        };

        if (token.isUnified) {
          const sourceTokens = (token.sourceTokens ?? []).map(updateToken);
          const totalBalance = sourceTokens.reduce(
            (sum, source) =>
              sum.plus(parseFiatNumber(source.balance) ?? new Decimal(0)),
            new Decimal(0)
          );
          const totalFiat = sourceTokens.reduce(
            (sum, source) =>
              sum.plus(parseFiatNumber(source.balanceInFiat) ?? new Decimal(0)),
            new Decimal(0)
          );

          return {
            ...token,
            ...preservedAmounts,
            balance: totalBalance.toDecimalPlaces(8).toFixed(),
            balanceInFiat: formatUsdDisplay(totalFiat),
            sourceTokens,
          };
        }

        const snapshot = snapshots.get(getTokenSelectionKey(token));
        if (!snapshot) {
          return {
            ...token,
            ...preservedAmounts,
            balance: `0 ${token.symbol}`,
            balanceInFiat: "$0.00",
            chainLogo:
              token.chainLogo ??
              (token.chainId ? CHAIN_METADATA[token.chainId]?.logo : undefined),
            chainName: getShortChainName(token.chainId, token.chainName),
          };
        }

        return {
          ...token,
          ...snapshot,
          ...preservedAmounts,
        };
      };

      return tokens.map(updateToken);
    },
    [buildSourceTokenSnapshotMap]
  );

  const refreshSelectedSourceBalances = useCallback(async () => {
    const refreshedBalance = await fetchSwapBalance();
    const balances = refreshedBalance ?? swapBalance;
    if (!balances) return;

    setFromTokens((current) =>
      current.length === 0
        ? current
        : patchSourceTokensWithBalances(current, balances)
    );
    setSourceSelectionRevision((current) => current + 1);
  }, [fetchSwapBalance, patchSourceTokensWithBalances, swapBalance]);

  const receiveMaxSafetyMultiplier = new Decimal("0.9");
  const currentSwapEntry =
    currentSwapId !== null
      ? swapHistory.find((entry) => entry.id === currentSwapId)
      : undefined;

  const scheduleTerminalBalanceRefresh = () => {
    if (terminalBalanceRefreshTimerRef.current) {
      clearTimeout(terminalBalanceRefreshTimerRef.current);
    }

    terminalBalanceRefreshTimerRef.current = setTimeout(() => {
      terminalBalanceRefreshTimerRef.current = null;
      void fetchSwapBalance();
    }, BALANCE_REFRESH_AFTER_TERMINAL_MS);
  };

  const patchSwapHistoryEntry = (
    id: string | null | undefined,
    patch: Partial<SwapHistoryEntry>
  ) => {
    if (!id) return;
    setSwapHistory((prev) =>
      sortSwapHistoryEntries(
        prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
      )
    );
  };

  const patchCurrentSwapHistoryEntry = (patch: Partial<SwapHistoryEntry>) => {
    patchSwapHistoryEntry(currentSwapIdRef.current, patch);
  };

  const patchCurrentIntentExplorerUrl = (url?: string | null) => {
    if (!isHttpUrl(url)) return;
    if (intentUrlRef.current === url) return;

    intentUrlRef.current = url;
    const intentId = extractIntentIdFromUrl(url);
    patchCurrentSwapHistoryEntry({
      intentExplorerUrl: url,
      ...(intentId ? { intentId } : {}),
    });
  };

  const resetExplorerUrls = () => {
    const next = { sourceExplorerUrl: null, destinationExplorerUrl: null };
    explorerUrlsRef.current = next;
    setExplorerUrls(next);
  };

  const mergeExplorerUrls = (
    patch: Partial<{
      sourceExplorerUrl: string | null;
      destinationExplorerUrl: string | null;
    }>
  ) => {
    const next = { ...explorerUrlsRef.current, ...patch };
    explorerUrlsRef.current = next;
    setExplorerUrls(next);
    patchCurrentSwapHistoryEntry({
      sourceExplorerUrl: next.sourceExplorerUrl,
      finalExplorerUrl: next.destinationExplorerUrl ?? next.sourceExplorerUrl,
    });
  };

  const resetProgressEvents = () => {
    progressEventsRef.current = [];
    setProgressEvents((current) => (current.length === 0 ? current : []));
    setFailedProgressStep((current) => (current === null ? current : null));
  };

  const appendProgressEvent = (
    name: string,
    step: SwapStepType | BridgeStepType | undefined,
    defaultCompleted: boolean,
    event?: unknown
  ) => {
    if (!step) return;
    const completed =
      typeof (step as any).completed === "boolean"
        ? Boolean((step as any).completed)
        : defaultCompleted;

    setProgressEvents((prev) => {
      const next = [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}-${(step as any).typeID ?? (step as any).type ?? name}`,
          name,
          completed,
          event,
          step,
        },
      ];
      progressEventsRef.current = next;
      return next;
    });
  };

  const appendProgressListEvent = (
    name: string,
    stepList: Array<SwapStepType | BridgeStepType>
  ) => {
    if (stepList.length === 0) return;

    setProgressEvents((prev) => {
      const next = [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}-${name}`,
          name,
          completed: false,
          step: stepList[0],
          steps: stepList,
        },
      ];
      progressEventsRef.current = next;
      return next;
    });
  };

  const startSwapHistoryEntry = () => {
    const id = `${Date.now()}-${swapRunIdRef.current}`;
    const now = Date.now();
    const resolvedToToken =
      toToken && destinationBalance
        ? { ...toToken, balance: destinationBalance }
        : toToken;
    const entry: SwapHistoryEntry = {
      id,
      mode: activeMode,
      status: "pending",
      createdAt: now,
      startedAt: now,
      intentData,
      fromTokens,
      toToken: resolvedToToken,
      requestedToAmount:
        activeMode === "deposit" || activeMode === "send"
          ? previewDestinationAmount
          : undefined,
      requestedToValue:
        activeMode === "deposit" || activeMode === "send"
          ? previewToAmountUsd
          : undefined,
      recipientAddress: transferRecipientAddress,
      opportunity: selectedOpportunity,
      feeUsd: intentFeeUsd,
      sourceExplorerUrl: null,
      finalExplorerUrl: null,
      intentExplorerUrl: isHttpUrl(intentUrlRef.current)
        ? intentUrlRef.current
        : null,
      intentId: extractIntentIdFromUrl(intentUrlRef.current),
      autoRefundAvailable: false,
    };

    currentSwapStartedAtRef.current = 0;
    currentSwapIdRef.current = id;
    setCurrentSwapId(id);
    setSwapHistory((prev) => sortSwapHistoryEntries([entry, ...prev]));
    return id;
  };

  const finishCurrentSwapHistoryEntry = (
    status: "fulfilled" | "failed" | "timeout",
    patch: Partial<SwapHistoryEntry> = {}
  ) => {
    const now = Date.now();
    const startedAt = currentSwapStartedAtRef.current || now;
    patchSwapHistoryEntry(currentSwapIdRef.current, {
      status,
      endedAt: now,
      durationSeconds: Math.max(1, Math.round((now - startedAt) / 1000)),
      sourceExplorerUrl: explorerUrlsRef.current.sourceExplorerUrl,
      finalExplorerUrl:
        explorerUrlsRef.current.destinationExplorerUrl ??
        explorerUrlsRef.current.sourceExplorerUrl,
      ...patch,
    });
    scheduleTerminalBalanceRefresh();
  };

  const markSwapExecutionStarted = () => {
    if (currentSwapStartedAtRef.current > 0) return;
    const now = Date.now();
    currentSwapStartedAtRef.current = now;
    patchCurrentSwapHistoryEntry({ startedAt: now });
  };

  const enterSkippedSwapProgress = () => {
    if (activeMode !== "deposit" && activeMode !== "send") return;

    const shouldInitializeProgress = swapStepRef.current !== "progress";
    if (!currentSwapIdRef.current) {
      onStart?.();
      startSwapHistoryEntry();
    }

    setIntentLoading(false);
    setQuoteRefreshing(false);
    setPreviewQuoteRefreshing(false);
    setReceiveMaxCalculating(false);
    setSwapQuoteIssue(null);

    if (shouldInitializeProgress) {
      resetProgressEvents();
      swapStepsListRef.current = [];
      resetSteps();
      swapStepRef.current = "progress";
      setSwapStep("progress");
    }
  };

  const cachePredictiveBaselineFromIntent = (intent: SwapIntentData) => {
    const destinationAmount = parseFiatNumber(intent.destination?.amount);
    const destinationValue = parseFiatNumber(intent.destination?.value);
    const sourceUsd = (intent.sources ?? []).reduce(
      (sum, source) =>
        sum.plus(parseFiatNumber((source as any).value) ?? new Decimal(0)),
      new Decimal(0)
    );

    if (!destinationAmount || destinationAmount.lte(0)) return;

    const destinationUsdRate =
      destinationValue && destinationValue.gt(0)
        ? destinationValue.div(destinationAmount)
        : getUsdRateForSymbol(intent.destination?.token?.symbol);
    if (destinationUsdRate.lte(0)) return;

    cacheSymbolUsdRate(intent.destination?.token?.symbol, destinationUsdRate);

    const key = getPredictiveQuoteCacheKey();
    if (!key) return;

    const baseline: PredictiveQuoteBaseline = {
      destinationUsdRate: destinationUsdRate.toDecimalPlaces(18).toFixed(),
      updatedAt: Date.now(),
    };

    if (activeMode === "swap" && swapType === "exactIn" && sourceUsd.gt(0)) {
      baseline.exactInDestinationAmountPerSourceUsd = destinationAmount
        .div(sourceUsd)
        .toDecimalPlaces(18)
        .toFixed();
    }

    const resolvedDestinationValue =
      destinationValue && destinationValue.gt(0)
        ? destinationValue
        : destinationAmount.mul(destinationUsdRate);
    if (
      (activeMode === "deposit" || activeMode === "send") &&
      resolvedDestinationValue.gt(0) &&
      sourceUsd.gt(0)
    ) {
      baseline.exactOutSourceUsdPerDestinationUsd = sourceUsd
        .div(resolvedDestinationValue)
        .toDecimalPlaces(18)
        .toFixed();
    }

    predictiveQuoteCacheRef.current[key] = baseline;
  };

  const applySwapIntent = useCallback(
    (intent: SwapIntentData) => {
      const sortedIntent = {
        ...intent,
        sources: sortIntentSourcesByUsdDesc(intent.sources ?? []),
      };
      const sortedIntentSourceTokens = sortSwapTokensByUsdDesc(
        (sortedIntent.sources ?? []).map(buildIntentSourceToken)
      );

      lastSwapIntentRefreshAtRef.current = Date.now();
      lastIntentSourceTokensRef.current = sortedIntentSourceTokens;
      cacheDestinationUsdRateFromIntent(sortedIntent);
      cachePredictiveBaselineFromIntent(sortedIntent);
      setIntentData(sortedIntent);
      setIntentToAmount(sortedIntent.destination?.amount || undefined);
      setSwapQuoteIssue(null);

      if (
        !sourceSelectionTouched &&
        (activeMode === "send" ||
          (activeMode === "deposit" && swapType === "exactOut"))
      ) {
        syncingIntentSourcesRef.current = true;
        setFromTokens(sortedIntentSourceTokens);
      }

      try {
        const bridgeFees = sortedIntent.feesAndBuffer?.bridge;
        const bridgeFeeData =
          bridgeFees && typeof bridgeFees === "object" ? bridgeFees : undefined;
        const collectionFee = parseFiatNumber(bridgeFeeData?.collection);
        const fulfilmentFee = parseFiatNumber(bridgeFeeData?.fulfilment);
        const executionGasFee =
          parseFiatNumber(bridgeFeeData?.caGas) ??
          (collectionFee !== undefined || fulfilmentFee !== undefined
            ? (collectionFee ?? new Decimal(0)).plus(
                fulfilmentFee ?? new Decimal(0)
              )
            : undefined);
        const bridgeComponentsTotal = bridgeFeeData
          ? [
              executionGasFee,
              parseFiatNumber(bridgeFeeData.protocol),
              parseFiatNumber(bridgeFeeData.solver),
              parseFiatNumber(bridgeFeeData.gasSupplied),
            ].reduce<Decimal>(
              (sum, value) => sum.plus(value ?? new Decimal(0)),
              new Decimal(0)
            )
          : undefined;
        const bridgeTotal =
          typeof bridgeFees === "string"
            ? parseFiatNumber(bridgeFees)
            : (parseFiatNumber(bridgeFeeData?.total) ??
              (bridgeComponentsTotal && bridgeComponentsTotal.gt(0)
                ? bridgeComponentsTotal
                : undefined));

        if (bridgeTotal !== undefined) {
          setIntentFeeUsd(
            bridgeTotal.gt(0) ? bridgeTotal.toDecimalPlaces(6).toFixed() : "0"
          );
        } else {
          setIntentFeeUsd(undefined);
        }
      } catch (err) {
        console.warn("Could not resolve bridge fee total", err);
        setIntentFeeUsd(undefined);
      }
    },
    [
      activeMode,
      fromTokens,
      sourceSelectionTouched,
      swapType,
      swapBalance,
      toToken,
    ]
  );

  const handleSwapIntentCallback = useCallback(
    (data: any, runId: number, quoteInputKey: string) => {
      const { intent, allow, deny, refresh } = data;
      const bridgeProvider = normalizeBridgeProvider(
        data?.bridgeProvider ?? intent?.bridgeProvider ?? intent?.swap?.bridgeProvider
      );
      const intentWithBridgeProvider = normalizeRenderableSwapIntentData(
        intent,
        bridgeProvider
      );
      logSdkIntentEvent("onIntent", data, {
        bridgeProvider,
        currentRunId: swapRunIdRef.current,
        normalizedIntent: intentWithBridgeProvider,
        isCurrentRun: swapRunIdRef.current === runId,
        quoteInputKey,
        runId,
      });
      if (swapRunIdRef.current !== runId) {
        logSdkIntentEvent("ignored stale onIntent", data, {
          currentRunId: swapRunIdRef.current,
          quoteInputKey,
          runId,
        });
        deny();
        return;
      }
      if (!intentWithBridgeProvider) {
        console.warn("[NexusWidget SDK][intent] Unsupported intent shape", {
          intent,
          raw: data,
        });
        deny();
        setIntentLoading(false);
        setQuoteRefreshing(false);
        setReceiveMaxCalculating(false);
        setPreviewQuoteRefreshing(false);
        setTxError("Quote unavailable");
        return;
      }
      const resolvedQuoteInputKey =
        activeQuoteInputKeyRef.current || quoteInputKey;
      const normalizedRefresh =
        typeof refresh === "function"
          ? async (...args: unknown[]) => {
              const refreshed = await refresh(...args);
              const refreshedBridgeProvider = normalizeBridgeProvider(
                refreshed?.bridgeProvider ??
                  refreshed?.swap?.bridgeProvider ??
                  bridgeProvider
              );
              return (
                normalizeRenderableSwapIntentData(
                  refreshed,
                  refreshedBridgeProvider
                ) ?? refreshed
              );
            }
          : refresh;
      providerSwapIntent.current = {
        intent: intentWithBridgeProvider as any,
        allow,
        deny,
        refresh: normalizedRefresh,
      };
      swapIntentRef.current = {
        intent: intentWithBridgeProvider,
        allow,
        deny,
        refresh: normalizedRefresh,
        runId,
        quoteInputKey: resolvedQuoteInputKey,
      };
      flushSync(() => {
        applySwapIntent(intentWithBridgeProvider);
        setIntentLoading(false);
        setQuoteRefreshing(false);
        setReceiveMaxCalculating(false);
        setPreviewQuoteRefreshing(false);
      });
    },
    [applySwapIntent, providerSwapIntent]
  );

  // Deposit-specific
  const [selectedOpportunity, setSelectedOpportunity] = useState<
    NexusWidgetDepositOpportunityConfig | undefined
  >(() => (activeMode === "deposit" ? configuredDeposit : undefined));
  const selectedOpportunityIdentity =
    getDepositConfigIdentity(selectedOpportunity);
  const [depositAmountMode, setDepositAmountMode] = useState<"token" | "usd">(
    "token"
  );
  const [depositSourceFilter, setDepositSourceFilter] =
    useState<DepositSourceFilter>("all");

  useEffect(() => {
    const immediateIssue = buildReceiveAmountIssue();
    applyReceiveAmountIssue(immediateIssue);

    if (!toToken || !getDestinationReceiveLimitUsd(toToken)) return;
    if (!parseFiatNumber(amount)?.gt(0)) return;
    if (getImmediateDestinationReceiveUsdRate(toToken)?.gt(0)) return;

    let cancelled = false;
    void resolveUsdRateForToken(toToken)
      .then((resolvedRate) => {
        if (cancelled) return;
        const issue = buildReceiveAmountIssue({
          destinationRate: resolvedRate.gt(0) ? resolvedRate : undefined,
        });
        applyReceiveAmountIssue(issue);
      })
      .catch(() => {
        if (!cancelled) {
          applyReceiveAmountIssue(buildReceiveAmountIssue());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeMode,
    amount,
    depositAmountMode,
    fromTokens,
    swapType,
    toToken?.chainId,
    toToken?.chainName,
    toToken?.contractAddress,
    toToken?.priceUSD,
    toToken?.symbol,
  ]);

  const trackDeposit = useCallback(
    (event: string, props?: Record<string, unknown>) => {
      const analytics = nexusSDK?.analytics;
      if (!analytics) return;
      analytics.track(event, {
        widgetSessionId: widgetSessionIdRef.current,
        widgetAttemptId: widgetAttemptIdRef.current,
        opportunityProtocol: selectedOpportunity?.protocol ?? null,
        destinationChainId: selectedOpportunity?.chainId ?? null,
        destinationToken: selectedOpportunity?.tokenSymbol ?? null,
        ...props,
      });
    },
    [nexusSDK, selectedOpportunity]
  );

  useEffect(() => {
    if (activeMode !== "deposit") return;
    if (!nexusSDK?.analytics) return;
    if (widgetOpenedFiredRef.current) return;
    widgetOpenedFiredRef.current = true;
    widgetOpenedTsRef.current = Date.now();
    rotateAttempt();
    trackDeposit("deposit_widget_opened", {
      embed: Boolean(embed),
      depositConfigured: Boolean(configuredDeposit),
      prefillAmountPresent: Boolean(config.prefill?.amount),
    });
  }, [
    activeMode,
    nexusSDK,
    embed,
    configuredDeposit,
    config.prefill,
    rotateAttempt,
    trackDeposit,
  ]);

  useEffect(() => {
    analyticsRef.current = nexusSDK?.analytics ?? null;
  }, [nexusSDK]);

  useEffect(() => {
    selectedOpportunityRef.current = selectedOpportunity;
  }, [selectedOpportunity]);

  useEffect(() => {
    return () => {
      if (!widgetOpenedFiredRef.current) return;
      const analytics = analyticsRef.current;
      if (!analytics) return;
      const opp = selectedOpportunityRef.current;
      analytics.track("deposit_widget_closed", {
        widgetSessionId: widgetSessionIdRef.current,
        widgetAttemptId: widgetAttemptIdRef.current,
        opportunityProtocol: opp?.protocol ?? null,
        lastStep: swapStepRef.current,
        reachedTerminal: reachedTerminalRef.current,
        hadSimulationSuccess: hadSimulationSuccessRef.current,
        hadPreviewViewed: hadPreviewViewedRef.current,
        timeInWidgetMs: Date.now() - widgetOpenedTsRef.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toTokenFromOpportunity = (
    opp: NexusWidgetDepositOpportunityMetadata
  ): SwapTokenOption => {
    const citreaToken = findCitreaReceiveToken({
      address: opp.tokenAddress,
      chainId: opp.chainId,
      symbol: opp.tokenSymbol,
    });
    const chainTokens = supportedChainsAndTokens?.find(
      (chain) => chain.id === opp.chainId
    )?.tokens;
    const matchedToken = chainTokens?.find(
      (token) =>
        token.contractAddress.toLowerCase() ===
          opp.tokenAddress.toLowerCase() || token.symbol === opp.tokenSymbol
    );
    const tokenSymbol =
      citreaToken?.symbol ?? matchedToken?.symbol ?? opp.tokenSymbol;
    const tokenMeta =
      TOKEN_METADATA[tokenSymbol as keyof typeof TOKEN_METADATA];

    return {
      chainId: opp.chainId,
      contractAddress: citreaToken?.contractAddress ?? opp.tokenAddress,
      symbol: tokenSymbol,
      name: matchedToken?.name || citreaToken?.name || tokenSymbol,
      balance: "0",
      balanceInFiat: "$0.00",
      decimals:
        matchedToken?.decimals ??
        citreaToken?.decimals ??
        opp.tokenDecimals ??
        tokenMeta?.decimals ??
        18,
      logo:
        opp.tokenLogo ||
        matchedToken?.logo ||
        citreaToken?.logo ||
        tokenMeta?.logo,
      chainName: getShortChainName(
        opp.chainId,
        CHAIN_METADATA[opp.chainId]?.name ?? citreaToken?.chainName
      ),
      chainLogo: CHAIN_METADATA[opp.chainId]?.logo ?? citreaToken?.chainLogo,
    };
  };

  const getDestinationBalanceFromSwapBalances = (token?: SwapTokenOption) => {
    if (!token?.chainId || !token.contractAddress) return null;

    const targetAddress = token.contractAddress.toLowerCase();
    const targetSymbol = token.symbol.toUpperCase();

    for (const asset of swapBalance ?? []) {
      for (const breakdown of asset.breakdown ?? []) {
        if (breakdown.chain?.id !== token.chainId) continue;

        const breakdownAddress = breakdown.contractAddress?.toLowerCase();
        const addressMatches =
          (breakdownAddress && breakdownAddress === targetAddress) ||
          (isNativeTokenAddress(breakdownAddress) &&
            isNativeTokenAddress(targetAddress));
        const symbolMatches =
          (breakdown.symbol ?? asset.symbol ?? "").toUpperCase() ===
          targetSymbol;

        if (!addressMatches && !symbolMatches) continue;

        const balance = parseFiatNumber(breakdown.balance);
        if (!balance) return null;

        return `${balance.toDecimalPlaces(6).toFixed()} ${token.symbol}`;
      }
    }

    return null;
  };

  const resolvePrefillToken = useCallback(
    (pair?: RuntimeDestinationPair) => {
      if (!pair?.token || !pair.chain) return undefined;

      const normalizeAddress = (address?: string) => {
        if (!address) return "";
        return isNativeTokenAddress(address)
          ? zeroAddress
          : address.toLowerCase();
      };
      const targetAddress = normalizeAddress(pair.token);

      const balanceToken = deriveTokenOptions(
        swapBalance ?? [],
        swapSupportedChainsAndTokens
      ).find(
        (token) =>
          token.chainId === pair.chain &&
          normalizeAddress(token.contractAddress) === targetAddress
      );
      if (balanceToken) return balanceToken;

      const chain = supportedChainsAndTokens?.find(
        (item) => item.id === pair.chain
      );
      const matchedToken = chain?.tokens?.find(
        (token) => normalizeAddress(token.contractAddress) === targetAddress
      );
      const citreaToken = findCitreaReceiveToken({
        address: pair.token,
        chainId: pair.chain,
      });
      const tokenAddressSymbol = Object.entries(
        TOKEN_CONTRACT_ADDRESSES as Record<string, Record<number, string>>
      ).find(
        ([, addresses]) =>
          normalizeAddress(addresses[pair.chain]) === targetAddress
      )?.[0];
      const chainMeta = CHAIN_METADATA[pair.chain];
      const isNativePrefill = isNativeTokenAddress(pair.token);
      const tokenSymbol =
        matchedToken?.symbol ??
        citreaToken?.symbol ??
        pair.symbol ??
        tokenAddressSymbol ??
        (isNativePrefill ? chainMeta?.nativeCurrency?.symbol : undefined) ??
        "Token";
      const tokenMeta =
        TOKEN_METADATA[tokenSymbol as keyof typeof TOKEN_METADATA];

      if (
        !chain &&
        !matchedToken &&
        !citreaToken &&
        !tokenAddressSymbol &&
        !pair.symbol &&
        !isNativePrefill
      ) {
        return undefined;
      }

      return {
        chainId: pair.chain,
        contractAddress: citreaToken?.contractAddress ?? pair.token,
        symbol: tokenSymbol,
        name: matchedToken?.name || citreaToken?.name || tokenSymbol,
        balance: `0 ${tokenSymbol}`,
        balanceInFiat: "$0.00",
        decimals:
          matchedToken?.decimals ??
          citreaToken?.decimals ??
          pair.decimals ??
          tokenMeta?.decimals ??
          (isNativePrefill ? chainMeta?.nativeCurrency?.decimals : undefined) ??
          18,
        logo:
          matchedToken?.logo ||
          citreaToken?.logo ||
          pair.logo ||
          tokenMeta?.logo,
        chainName: getShortChainName(
          pair.chain,
          chain?.name ?? chainMeta?.name ?? citreaToken?.chainName
        ),
        chainLogo: chainMeta?.logo ?? chain?.logo ?? citreaToken?.chainLogo,
      } satisfies SwapTokenOption;
    },
    [supportedChainsAndTokens, swapBalance]
  );

  useEffect(() => {
    if (activeMode !== "swap") return;

    const sourcePrefill = config.prefill?.source;
    const destinationPrefill = config.prefill?.destination;
    if (!sourcePrefill && !destinationPrefill) return;

    const prefillKey = [
      sourcePrefill
        ? `source:${sourcePrefill.chain}:${sourcePrefill.token.toLowerCase()}`
        : "",
      destinationPrefill
        ? `destination:${destinationPrefill.chain}:${destinationPrefill.token.toLowerCase()}`
        : "",
      config.prefill?.amount ? `amount:${config.prefill.amount}` : "",
    ].join("|");

    if (appliedTokenPrefillRef.current === prefillKey) return;

    const sourceToken = resolvePrefillToken(sourcePrefill);
    const destinationToken = resolvePrefillToken(destinationPrefill);

    if (sourcePrefill && !sourceToken) return;
    if (destinationPrefill && !destinationToken) return;

    if (sourceToken) {
      setFromTokens((current) => {
        const nextSourceToken = {
          ...sourceToken,
          userAmount: config.prefill?.amount ?? "",
        };
        const currentSourceToken = current[0];
        if (
          current.length === 1 &&
          isSameTokenSelection(currentSourceToken, nextSourceToken) &&
          currentSourceToken.userAmount === nextSourceToken.userAmount
        ) {
          return current;
        }
        return [nextSourceToken];
      });
      setSourceSelectionTouched(true);
    }
    if (destinationToken) {
      setToToken((current) =>
        isSameTokenSelection(current, destinationToken)
          ? current
          : destinationToken
      );
    }
    setSwapType("exactIn");
    appliedTokenPrefillRef.current = prefillKey;
  }, [
    activeMode,
    config.prefill?.amount,
    config.prefill?.destination?.chain,
    config.prefill?.destination?.decimals,
    config.prefill?.destination?.logo,
    config.prefill?.destination?.symbol,
    config.prefill?.destination?.token,
    config.prefill?.source?.chain,
    config.prefill?.source?.decimals,
    config.prefill?.source?.logo,
    config.prefill?.source?.symbol,
    config.prefill?.source?.token,
    resolvePrefillToken,
  ]);

  useEffect(() => {
    if (activeMode !== "send") return;

    const sendPrefill =
      config.prefill?.token && config.prefill?.chain
        ? {
            token: config.prefill.token,
            chain: config.prefill.chain,
          }
        : config.prefill?.destination;
    if (!sendPrefill) return;

    const prefillKey = `send:${sendPrefill.chain}:${sendPrefill.token.toLowerCase()}`;
    if (appliedTokenPrefillRef.current === prefillKey) return;

    const token = resolvePrefillToken(sendPrefill);
    if (!token) return;

    setToToken(token);
    setSwapType("exactOut");
    appliedTokenPrefillRef.current = prefillKey;
  }, [
    activeMode,
    config.prefill?.chain,
    config.prefill?.destination?.chain,
    config.prefill?.destination?.decimals,
    config.prefill?.destination?.logo,
    config.prefill?.destination?.symbol,
    config.prefill?.destination?.token,
    config.prefill?.token,
    resolvePrefillToken,
  ]);

  useEffect(() => {
    if (config.prefill?.amount) setAmount(config.prefill.amount);
    if (config.prefill?.recipient)
      setRecipientAddress(config.prefill.recipient);
  }, [config.prefill?.amount, config.prefill?.recipient]);

  useEffect(() => {
    setDestinationBalance(null);

    const balanceToken =
      toToken ??
      (activeMode === "deposit" && selectedOpportunity
        ? toTokenFromOpportunity(selectedOpportunity)
        : undefined);

    if (!balanceToken?.chainId || !ownerAddress) return;

    const swapBalanceValue =
      getDestinationBalanceFromSwapBalances(balanceToken);
    if (swapBalanceValue) {
      setDestinationBalance(swapBalanceValue);
    }
  }, [
    activeMode,
    ownerAddress,
    selectedOpportunity?.chainId,
    selectedOpportunity?.tokenAddress,
    selectedOpportunity?.tokenLogo,
    selectedOpportunity?.tokenSymbol,
    swapBalance,
    toToken?.chainId,
    toToken?.chainName,
    toToken?.contractAddress,
    toToken?.decimals,
    toToken?.symbol,
  ]);

  useEffect(() => {
    if (activeMode !== "deposit" || !configuredDeposit) return;
    setSelectedOpportunity((current) =>
      isSameDepositConfig(current, configuredDeposit)
        ? current
        : configuredDeposit
    );
    setSwapType("exactOut");
    setToToken((current) => {
      const next = {
        ...toTokenFromOpportunity(configuredDeposit),
        balance: current?.balance ?? "0",
        balanceInFiat: current?.balanceInFiat ?? "$0.00",
      };
      if (
        current &&
        current.chainId === next.chainId &&
        current.contractAddress.toLowerCase() ===
          next.contractAddress.toLowerCase() &&
        current.symbol === next.symbol &&
        current.decimals === next.decimals &&
        current.logo === next.logo &&
        current.chainLogo === next.chainLogo &&
        current.chainName === next.chainName &&
        current.balance === next.balance &&
        current.balanceInFiat === next.balanceInFiat
      ) {
        return current;
      }
      return next;
    });
  }, [
    activeMode,
    configuredDepositIdentity,
    configuredDeposit?.chainId,
    configuredDeposit?.tokenAddress,
    configuredDeposit?.tokenLogo,
    configuredDeposit?.tokenSymbol,
    supportedChainsAndTokens,
  ]);

  useEffect(() => {
    if (activeMode !== "deposit" || !selectedOpportunity) return;
    setToToken((current) => {
      const next = {
        ...toTokenFromOpportunity(selectedOpportunity),
        balance: current?.balance ?? "0",
        balanceInFiat: current?.balanceInFiat ?? "$0.00",
      };
      if (
        current &&
        current.chainId === next.chainId &&
        current.contractAddress.toLowerCase() ===
          next.contractAddress.toLowerCase() &&
        current.symbol === next.symbol &&
        current.decimals === next.decimals &&
        current.logo === next.logo &&
        current.chainLogo === next.chainLogo &&
        current.chainName === next.chainName &&
        current.balance === next.balance &&
        current.balanceInFiat === next.balanceInFiat
      ) {
        return current;
      }
      return next;
    });
  }, [activeMode, selectedOpportunity, supportedChainsAndTokens]);

  useEffect(() => {
    if (activeMode !== "send") return;
    setSwapType("exactOut");
  }, [activeMode]);

  useEffect(() => {
    if (activeMode === "swap" && swapType !== "exactIn") {
      setSwapType("exactIn");
    }
  }, [activeMode, swapType]);

  useEffect(() => {
    if (!toToken?.symbol) return;
    if (getFiatValue(1, toToken.symbol) > 0) return;

    let cancelled = false;
    void resolveTokenUsdRate(toToken.symbol).catch((error) => {
      if (!cancelled) {
        console.warn("Unable to resolve Nexus Widget token USD rate", {
          symbol: toToken.symbol,
          error,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeMode, getFiatValue, resolveTokenUsdRate, toToken?.symbol]);

  // Balance helpers
  const activeBalanceArray = swapBalance;
  const selectedToken = config.prefill?.token ?? "USDC";
  const currentAsset =
    activeBalanceArray?.find((a) => a.symbol === selectedToken) ||
    activeBalanceArray?.[0];
  const maxBalance = currentAsset?.balance
    ? String(currentAsset.balance)
    : undefined;
  const usdValue = getFiatValue(
    Number(amount) || 0,
    currentAsset?.symbol || "USDC"
  );
  const getDepositTokenUsdRate = () => {
    if (!selectedOpportunity?.tokenSymbol) return new Decimal(0);
    const fiat = getFiatValue(1, selectedOpportunity.tokenSymbol);
    if (Number.isFinite(fiat) && fiat > 0) {
      return new Decimal(fiat);
    }

    return getCachedDestinationUsdRate(toToken) ?? new Decimal(0);
  };
  const getDepositTokenAmountForQuote = () => {
    const parsedAmount = parseFiatNumber(amount) ?? new Decimal(0);
    if (parsedAmount.lte(0)) return undefined;
    if (depositAmountMode === "token") return parsedAmount;

    const rate = getDepositTokenUsdRate();
    if (rate.lte(0)) return undefined;
    return parsedAmount.div(rate);
  };
  const depositTokenAmountForQuote = getDepositTokenAmountForQuote();
  const depositQuoteAmountKey = depositTokenAmountForQuote?.toFixed() ?? "";
  const depositUsdDecimal =
    depositAmountMode === "usd"
      ? (parseFiatNumber(amount) ?? new Decimal(0))
      : depositTokenAmountForQuote
        ? depositTokenAmountForQuote.mul(getDepositTokenUsdRate())
        : new Decimal(0);
  const depositUsdDisplay = depositUsdDecimal.toDecimalPlaces(2).toFixed();
  const depositTokenDisplay =
    depositTokenAmountForQuote
      ?.toDecimalPlaces(
        getCappedTokenDisplayDecimals(toToken?.decimals),
        Decimal.ROUND_DOWN
      )
      .toFixed() ?? "0";
  const depositSourceTargetUsdKey =
    activeMode === "deposit"
      ? (getDepositSourceTargetUsd()?.toFixed() ?? "")
      : "";
  const normalizedQuoteAmountKey = parseFiatNumber(amount)?.toFixed() ?? "";
  const quoteRecipientKey =
    activeMode === "swap"
      ? effectiveRecipientAddress
      : activeMode === "send"
        ? recipientAddress
        : "";
  const activeQuoteInputKey = [
    activeMode,
    swapType,
    normalizedQuoteAmountKey,
    toTokenQuoteKey,
    quoteRecipientKey.toLowerCase(),
    activeMode === "swap" ? fromTokensQuoteKey : "",
    activeMode === "deposit"
      ? [
          depositAmountMode,
          depositQuoteAmountKey,
          selectedOpportunityIdentity,
          depositSourceTargetUsdKey,
          depositSourceFilter,
          sourceSelectionTouched ? "manual" : "auto",
          sourceSelectionRevision,
          exactOutQuoteSourceMode,
        ].join(":")
      : "",
    activeMode === "send"
      ? [
          sourceSelectionTouched ? "manual" : "auto",
          sourceSelectionRevision,
          exactOutQuoteSourceMode,
        ].join(":")
      : "",
  ].join("|");

  useEffect(() => {
    activeQuoteInputKeyRef.current = activeQuoteInputKey;
    setTxError(null);
  }, [activeQuoteInputKey]);
  const hasCurrentQuoteIntent = Boolean(
    intentData &&
      swapIntentRef.current &&
      swapIntentRef.current.runId === swapRunIdRef.current &&
      swapIntentRef.current.quoteInputKey === activeQuoteInputKey
  );

  useEffect(() => {
    if (activeMode !== "deposit") return;
    if (!nexusSDK?.analytics) return;
    const parsed = parseFiatNumber(amount);
    if (!parsed || parsed.lte(0)) return;
    if (amount === amountEnteredLastValueRef.current) return;
    const timeout = setTimeout(() => {
      amountEnteredLastValueRef.current = amount;
      trackDeposit("deposit_amount_entered", {
        amountToken: depositTokenDisplay,
        amountUsd: Number(depositUsdDisplay) || 0,
        inputMethod: lastInputMethodRef.current,
      });
      lastInputMethodRef.current = "typed";
    }, 500);
    return () => clearTimeout(timeout);
  }, [
    amount,
    activeMode,
    nexusSDK,
    depositTokenDisplay,
    depositUsdDisplay,
    trackDeposit,
  ]);

  useEffect(() => {
    if (activeMode !== "deposit") return;
    if (intentData) hadSimulationSuccessRef.current = true;
  }, [intentData, activeMode]);

  useEffect(() => {
    if (activeMode !== "deposit") return;
    if (sourceSelectionTouched) return;
    previousAutoSourceCountRef.current = (intentData?.sources ?? []).length;
  }, [intentData, activeMode, sourceSelectionTouched]);

  useEffect(() => {
    if (activeMode !== "deposit") return;
    const prev = prevSourceTouchedRef.current;
    const curr = sourceSelectionTouched;
    if (prev === curr) return;
    prevSourceTouchedRef.current = curr;
    if (!prev && curr) {
      trackDeposit("deposit_source_selection_changed", {
        sourceCount: fromTokens.length,
        sourceChainIds: fromTokens.map((t) => t.chainId).filter(Boolean),
        sourceTokenSymbols: fromTokens.map((t) => t.symbol).filter(Boolean),
        previousSourceCount: previousAutoSourceCountRef.current,
      });
    } else if (prev && !curr) {
      trackDeposit("deposit_source_selection_reverted_to_auto", {
        previousSourceCount: fromTokens.length,
      });
    }
  }, [sourceSelectionTouched, activeMode, fromTokens, trackDeposit]);

  useEffect(() => {
    if (activeMode !== "deposit") return;
    if (swapStep !== "preview-intent") return;
    if (intentLoading) return;
    if (!intentData) return;
    if (hadPreviewViewedRef.current) return;
    hadPreviewViewedRef.current = true;
    previewViewedTsRef.current = Date.now();
    trackDeposit("deposit_preview_viewed", {
      totalFeeUsd: Number(intentFeeUsd) || 0,
      toAmountUsd: Number(depositUsdDisplay) || 0,
      sourceCount: (intentData?.sources ?? []).length,
    });
  }, [
    swapStep,
    intentLoading,
    intentData,
    activeMode,
    intentFeeUsd,
    depositUsdDisplay,
    trackDeposit,
  ]);
  const requiredDestinationTokenAmount =
    activeMode === "deposit"
      ? depositTokenAmountForQuote
      : activeMode === "send"
        ? parseFiatNumber(amount)
        : undefined;
  const canRefreshExactOutQuote = () =>
    activeMode === "deposit"
      ? Boolean(
          hasPositiveDecimalInput(amount) &&
            toToken &&
            selectedOpportunity &&
            depositTokenAmountForQuote &&
            depositTokenAmountForQuote.gt(0)
        )
      : activeMode === "send"
        ? Boolean(hasPositiveDecimalInput(amount) && toToken)
        : false;
  const invalidateExactOutQuoteForRefresh = () => {
    immediateQuoteAfterSourceEditRef.current = true;
    const receiveIssue = buildReceiveAmountIssue();
    applyReceiveAmountIssue(receiveIssue);
    const configuredIssue = buildConfiguredAmountIssue();
    if (configuredIssue) {
      clearPreviewForBlockingAmountIssue();
    }
    const sourceBalanceIssue = buildExactOutSourceBalanceIssue();
    if (sourceBalanceIssue) {
      clearPreviewForBlockingAmountIssue();
      setSwapQuoteIssue(sourceBalanceIssue);
    }
    const shouldLoadQuote = Boolean(
      !receiveIssue &&
        !configuredIssue &&
        !sourceBalanceIssue &&
        nexusSDK &&
        canRefreshExactOutQuote()
    );
    if (!receiveIssue && !configuredIssue && !sourceBalanceIssue) {
      clearPendingSwapIntent(true, { keepQuoteRefreshing: shouldLoadQuote });
    }
    if (shouldLoadQuote) {
      setQuoteRefreshing(true);
      setTxError(null);
      setSwapQuoteIssue(null);
    }
    return shouldLoadQuote;
  };

  useEffect(() => {
    if (
      activeMode !== "swap" ||
      swapStep !== "idle" ||
      swapType !== "exactIn"
    ) {
      setPredictiveQuote((current) =>
        current?.mode === "exactIn" ? null : current
      );
      return;
    }

    const sources = getPredictiveExactInSourceTokens();
    const key = getPredictiveQuoteCacheKey();
    if (!toToken || sources.length === 0 || !key) {
      setPredictiveQuote((current) =>
        current?.mode === "exactIn" ? null : current
      );
      return;
    }

    const runId = ++predictiveQuoteRunRef.current;
    let cancelled = false;

    void (async () => {
      const baseline = predictiveQuoteCacheRef.current[key];
      const cachedDestinationRate = parseFiatNumber(
        baseline?.destinationUsdRate
      );
      const destinationRate =
        cachedDestinationRate && cachedDestinationRate.gt(0)
          ? cachedDestinationRate
          : await resolveUsdRateForToken(toToken);

      if (cancelled || runId !== predictiveQuoteRunRef.current) return;
      if (destinationRate.lte(0)) {
        setPredictiveQuote((current) =>
          current?.mode === "exactIn" ? null : current
        );
        return;
      }

      let sourceUsd = new Decimal(0);
      for (const source of sources) {
        const sourceAmount =
          parseFiatNumber(source.userAmount) ?? new Decimal(0);
        if (sourceAmount.lte(0)) continue;

        if (source.userAmountMode === "usd") {
          sourceUsd = sourceUsd.plus(sourceAmount);
          continue;
        }

        const sourceRate = await resolveUsdRateForToken(source);
        if (cancelled || runId !== predictiveQuoteRunRef.current) return;
        if (sourceRate.lte(0)) {
          setPredictiveQuote((current) =>
            current?.mode === "exactIn" ? null : current
          );
          return;
        }
        sourceUsd = sourceUsd.plus(sourceAmount.mul(sourceRate));
      }

      if (sourceUsd.lte(0)) {
        setPredictiveQuote((current) =>
          current?.mode === "exactIn" ? null : current
        );
        return;
      }

      const cachedAmountPerSourceUsd = parseFiatNumber(
        baseline?.exactInDestinationAmountPerSourceUsd
      );
      const predictedDestinationAmount =
        cachedAmountPerSourceUsd && cachedAmountPerSourceUsd.gt(0)
          ? sourceUsd.mul(cachedAmountPerSourceUsd)
          : sourceUsd
              .mul(BASIS_POINTS - PREDICTIVE_EXACT_IN_DISCOUNT_BPS)
              .div(BASIS_POINTS)
              .div(destinationRate);
      const predictedDestinationUsd =
        cachedAmountPerSourceUsd && cachedAmountPerSourceUsd.gt(0)
          ? predictedDestinationAmount.mul(destinationRate)
          : sourceUsd
              .mul(BASIS_POINTS - PREDICTIVE_EXACT_IN_DISCOUNT_BPS)
              .div(BASIS_POINTS);

      if (
        cancelled ||
        runId !== predictiveQuoteRunRef.current ||
        predictedDestinationAmount.lte(0)
      ) {
        return;
      }

      setPredictiveQuote({
        key,
        mode: "exactIn",
        toAmount: getPredictiveDisplayAmount(
          predictedDestinationAmount,
          toToken
        ),
        toUsd: predictedDestinationUsd.toDecimalPlaces(6).toFixed(),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeMode,
    amount,
    fromTokens,
    swapStep,
    swapType,
    toToken?.chainId,
    toToken?.contractAddress,
    toToken?.decimals,
    toToken?.symbol,
  ]);

  useEffect(() => {
    if (
      (activeMode !== "deposit" && activeMode !== "send") ||
      swapStep !== "idle" ||
      swapType !== "exactOut" ||
      !nexusSDK
    ) {
      setPredictiveQuote((current) =>
        current?.mode === "exactOut" ? null : current
      );
      return;
    }

    const parsedAmount = parseFiatNumber(amount);
    const key = getPredictiveQuoteCacheKey();
    if (
      !toToken ||
      !parsedAmount ||
      parsedAmount.lte(0) ||
      !key ||
      (activeMode === "deposit" && !selectedOpportunity)
    ) {
      setPredictiveQuote((current) =>
        current?.mode === "exactOut" ? null : current
      );
      return;
    }

    const runId = ++predictiveQuoteRunRef.current;
    let cancelled = false;

    void (async () => {
      const baseline = predictiveQuoteCacheRef.current[key];
      const cachedDestinationRate = parseFiatNumber(
        baseline?.destinationUsdRate
      );
      const destinationRate =
        cachedDestinationRate && cachedDestinationRate.gt(0)
          ? cachedDestinationRate
          : await resolveUsdRateForToken(toToken);

      if (cancelled || runId !== predictiveQuoteRunRef.current) return;
      if (destinationRate.lte(0)) {
        setPredictiveQuote((current) =>
          current?.mode === "exactOut" ? null : current
        );
        return;
      }

      const destinationAmount =
        activeMode === "deposit" && depositAmountMode === "usd"
          ? parsedAmount.div(destinationRate)
          : parsedAmount;
      const destinationUsd =
        activeMode === "deposit" && depositAmountMode === "usd"
          ? parsedAmount
          : destinationAmount.mul(destinationRate);
      const destinationCoverage = getExactOutDestinationBalanceCoverage({
        requestedAmount: destinationAmount,
        requestedUsd: destinationUsd,
        token: toToken,
      });
      const destinationUsdNeedingSources = Decimal.max(
        destinationUsd.minus(destinationCoverage?.usd ?? new Decimal(0)),
        new Decimal(0)
      );
      const cachedSourceUsdRatio = parseFiatNumber(
        baseline?.exactOutSourceUsdPerDestinationUsd
      );
      const requiredSourceUsd = destinationUsdNeedingSources.lte(0)
        ? new Decimal(0)
        : cachedSourceUsdRatio && cachedSourceUsdRatio.gt(0)
          ? destinationUsdNeedingSources.mul(cachedSourceUsdRatio)
          : destinationUsdNeedingSources
              .mul(BASIS_POINTS + PREDICTIVE_EXACT_OUT_BUFFER_BPS)
              .div(BASIS_POINTS);
      const sources = requiredSourceUsd.gt(0)
        ? await buildPredictiveExactOutSources(requiredSourceUsd)
        : [];

      if (
        cancelled ||
        runId !== predictiveQuoteRunRef.current ||
        (requiredSourceUsd.gt(0) && sources.length === 0)
      ) {
        setPredictiveQuote((current) =>
          current?.mode === "exactOut" ? null : current
        );
        return;
      }

      setPredictiveQuote({
        key,
        mode: "exactOut",
        sources,
        toAmount: getPredictiveDisplayAmount(destinationAmount, toToken),
        toUsd: destinationUsd.toDecimalPlaces(6).toFixed(),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeMode,
    amount,
    depositAmountMode,
    destinationBalance,
    fromTokensQuoteKey,
    nexusSDK,
    selectedOpportunityIdentity,
    sourceSelectionRevision,
    swapBalance,
    swapStep,
    swapType,
    toToken?.balance,
    toToken?.balanceInFiat,
    toToken?.chainId,
    toToken?.contractAddress,
    toToken?.decimals,
    toToken?.symbol,
  ]);

  const resolvedDepositSourceTokens = useMemo<SwapTokenOption[]>(() => {
    if (activeMode !== "deposit" || !swapBalance) return [];
    const selection = getResolvedDepositSourceSelection();
    return getDepositSourceTokensForIds(selection.selectedSourceIds);
  }, [
    activeMode,
    depositSourceFilter,
    depositQuoteAmountKey,
    depositSourceTargetUsdKey,
    depositUsdDecimal.toFixed(),
    fromTokensQuoteKey,
    selectedOpportunity?.chainId,
    selectedOpportunity?.tokenAddress,
    selectedOpportunity?.tokenSymbol,
    sourceSelectionRevision,
    sourceSelectionTouched,
    swapBalance,
    toToken?.chainId,
    toToken?.contractAddress,
    toToken?.symbol,
  ]);
  const lockedDestinationSourceTokens = useMemo<SwapTokenOption[]>(() => {
    if (
      (activeMode !== "deposit" && activeMode !== "send") ||
      !toToken?.chainId ||
      !requiredDestinationTokenAmount ||
      requiredDestinationTokenAmount.lte(0)
    ) {
      return [];
    }

    for (const asset of swapBalance ?? []) {
      for (const breakdown of asset.breakdown ?? []) {
        const chainId = breakdown.chain?.id;
        if (chainId !== toToken.chainId) continue;

        const breakdownAddress = breakdown.contractAddress;
        const addressMatches =
          breakdownAddress &&
          toToken.contractAddress &&
          (breakdownAddress.toLowerCase() ===
            toToken.contractAddress.toLowerCase() ||
            (isNativeTokenAddress(breakdownAddress) &&
              isNativeTokenAddress(toToken.contractAddress)));
        const symbolMatches =
          (breakdown.symbol ?? asset.symbol ?? "").toUpperCase() ===
          toToken.symbol.toUpperCase();

        if (!addressMatches && !symbolMatches) continue;

        const balanceAmount = parseFiatNumber(breakdown.balance);
        if (!balanceAmount || balanceAmount.lte(0)) continue;

        const chainMeta = CHAIN_METADATA[chainId];
        const symbol = breakdown.symbol ?? asset.symbol ?? toToken.symbol;
        const fiatBalance = parseFiatNumber(breakdown.balanceInFiat);
        if (!fiatBalance || fiatBalance.lt(minimumSourceUsd)) continue;
        return [
          {
            chainId,
            chainLogo:
              chainMeta?.logo ?? breakdown.chain?.logo ?? toToken.chainLogo,
            chainName: getShortChainName(
              chainId,
              chainMeta?.name ?? breakdown.chain?.name ?? toToken.chainName
            ),
            contractAddress:
              breakdown.contractAddress ?? toToken.contractAddress,
            decimals:
              breakdown.decimals ?? asset.decimals ?? toToken.decimals ?? 18,
            logo: asset.logo ?? toToken.logo,
            name: symbol,
            symbol,
            balance: `${breakdown.balance} ${symbol}`,
            balanceInFiat:
              fiatBalance !== undefined
                ? `$${fiatBalance.toDecimalPlaces(2).toFixed()}`
                : "$0.00",
          },
        ];
      }
    }

    return [];
  }, [
    activeMode,
    requiredDestinationTokenAmount?.toFixed(),
    swapBalance,
    toToken?.chainId,
    toToken?.chainLogo,
    toToken?.chainName,
    toToken?.contractAddress,
    toToken?.decimals,
    toToken?.logo,
    toToken?.symbol,
  ]);

  useEffect(() => {
    if (activeMode !== "deposit" && activeMode !== "send") return;
    if (lockedDestinationSourceTokens.length === 0) return;
    if (activeMode === "deposit" && !sourceSelectionTouched) return;

    setFromTokens((current) => {
      const missing = lockedDestinationSourceTokens.filter(
        (locked) =>
          !current.some(
            (token) =>
              getTokenSelectionKey(token) === getTokenSelectionKey(locked)
          )
      );
      if (missing.length === 0) return current;
      return [
        ...current,
        ...missing.map((token) => ({ ...token, userAmount: "" })),
      ];
    });
  }, [activeMode, lockedDestinationSourceTokens, sourceSelectionTouched]);

  useEffect(() => {
    if (activeMode !== "deposit") return;
    if (sourceSelectionTouched) return;
    if (
      !toToken ||
      !depositTokenAmountForQuote ||
      depositTokenAmountForQuote.lte(0)
    ) {
      return;
    }
    if (resolvedDepositSourceTokens.length === 0) {
      return;
    }

    setFromTokens((current) => {
      const canInitialize = current.length === 0;
      if (!canInitialize) return current;

      const next: SwapTokenOption[] = [];
      const seen = new Set<string>();
      for (const token of resolvedDepositSourceTokens) {
        const key = getTokenSelectionKey(token);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        next.push({ ...token, userAmount: "" });
      }

      const currentKeys = current.map(getTokenSelectionKey).sort().join("|");
      const nextKeys = next.map(getTokenSelectionKey).sort().join("|");
      if (currentKeys === nextKeys) return current;
      return next;
    });
  }, [
    activeMode,
    depositQuoteAmountKey,
    resolvedDepositSourceTokens,
    sourceSelectionTouched,
    toTokenQuoteKey,
  ]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const applyConfiguredPrefillsAfterReset = () => {
    const prefillAmount = config.prefill?.amount ?? "";
    const prefillRecipient = config.prefill?.recipient ?? "";

    appliedTokenPrefillRef.current = null;
    syncingIntentSourcesRef.current = false;
    maxPercentRunRef.current += 1;
    setAmount(prefillAmount);
    setRecipientAddress(prefillRecipient);
    setTxError(null);
    setSwapQuoteIssue(null);
    setIntentToAmount(undefined);
    setIntentFeeUsd(undefined);
    setIntentData(null);
    setPredictiveQuote(null);
    setQuoteRefreshing(false);
    setReceiveMaxCalculating(false);
    setPreviewQuoteRefreshing(false);
    setMaxCalculationPercent(null);
    setSourceSelectionTouched(false);
    setDepositSourceFilter("all");
    setExactOutQuoteSourceModeValue("all");
    setSourceSelectionRevision((current) => current + 1);
    setDepositAmountMode("token");

    if (activeMode === "swap") {
      const sourcePrefill = config.prefill?.source;
      const destinationPrefill = config.prefill?.destination;
      const sourceToken = resolvePrefillToken(sourcePrefill);
      const destinationToken = resolvePrefillToken(destinationPrefill);

      setFromTokens(
        sourceToken
          ? [
              {
                ...sourceToken,
                userAmount: prefillAmount,
              },
            ]
          : []
      );
      setSourceSelectionTouched(Boolean(sourceToken));
      setToToken(destinationToken);
      setSelectedOpportunity(undefined);
      setSwapType("exactIn");

      if (
        (!sourcePrefill || sourceToken) &&
        (!destinationPrefill || destinationToken) &&
        (sourcePrefill || destinationPrefill)
      ) {
        appliedTokenPrefillRef.current = [
          sourcePrefill
            ? `source:${sourcePrefill.chain}:${sourcePrefill.token.toLowerCase()}`
            : "",
          destinationPrefill
            ? `destination:${destinationPrefill.chain}:${destinationPrefill.token.toLowerCase()}`
            : "",
          config.prefill?.amount ? `amount:${config.prefill.amount}` : "",
        ].join("|");
      }
      return;
    }

    if (activeMode === "send") {
      const sendPrefill =
        config.prefill?.token && config.prefill?.chain
          ? {
              token: config.prefill.token,
              chain: config.prefill.chain,
            }
          : config.prefill?.destination;
      const token = resolvePrefillToken(sendPrefill);

      setFromTokens([]);
      setSelectedOpportunity(undefined);
      setToToken(token);
      setSwapType("exactOut");

      if (sendPrefill && token) {
        appliedTokenPrefillRef.current = `send:${sendPrefill.chain}:${sendPrefill.token.toLowerCase()}`;
      }
      return;
    }

    const destinationPrefill = config.prefill?.destination;
    const configuredPrefillDeposit = destinationPrefill
      ? configuredDepositOptions.find(
          (deposit) =>
            deposit.chainId === destinationPrefill.chain &&
            deposit.tokenAddress.toLowerCase() ===
              destinationPrefill.token.toLowerCase()
        )
      : undefined;
    const nextDeposit = configuredPrefillDeposit ?? configuredDeposit;

    setFromTokens([]);
    setSelectedOpportunity(nextDeposit);
    setToToken(nextDeposit ? toTokenFromOpportunity(nextDeposit) : undefined);
    setSwapType("exactOut");
  };

  const handleReset = () => {
    clearPendingSwapIntent();
    setSwapStep("idle");
    setCurrentSwapId(null);
    currentSwapIdRef.current = null;
    currentSwapStartedAtRef.current = 0;
    amountEnteredLastValueRef.current = config.prefill?.amount ?? "";
    applyConfiguredPrefillsAfterReset();
    rotateAttempt();
  };

  const handleFailureBack = () => {
    clearPendingSwapIntent();
    setTxError(null);
    void refreshSelectedSourceBalances();
    setSwapStep("idle");
    setCurrentSwapId(null);
    currentSwapIdRef.current = null;
    currentSwapStartedAtRef.current = 0;
    rotateAttempt();
  };

  const resetInputsAfterSuccessfulExecution = () => {
    setAmount("");
    setRecipientAddress("");
    setTxError(null);
    setSwapQuoteIssue(null);
    setIntentToAmount(undefined);
    setIntentFeeUsd(undefined);
    setIntentData(null);
    setFromTokens((current) => (current.length === 0 ? current : []));
    setSourceSelectionTouched(false);
    setDepositSourceFilter("all");
    setDepositAmountMode("token");
    if (activeMode === "deposit") {
      setSelectedOpportunity(configuredDeposit);
      setToToken(
        configuredDeposit
          ? toTokenFromOpportunity(configuredDeposit)
          : undefined
      );
    } else {
      setToToken(undefined);
    }
  };

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      if (!open && swapStepRef.current === "progress") return;
      if (!isControlledOpen) {
        setInternalOpen(open);
      }
      onOpenChange?.(open);
      if (!open) {
        clearPendingSwapIntent();
        onClose?.();
      }
    },
    [clearPendingSwapIntent, isControlledOpen, onClose, onOpenChange]
  );

  const handleClose = () => {
    if (!embed) {
      handleModalOpenChange(false);
      return;
    }
    clearPendingSwapIntent();
    onClose?.();
  };

  const handleConnectWallet = async () => {
    if (walletActionPending || nexusLoading) return;

    const clickHandler = onConnectClick || onConnectWallet;
    if (clickHandler) {
      setWalletActionPending(true);
      setTxError(null);
      try {
        await clickHandler();
      } catch (error: any) {
        setTxError(error?.message || "Unable to connect wallet.");
      } finally {
        setWalletActionPending(false);
      }
      return;
    }

    if (isWalletConnectPending) return;

    setWalletActionPending(true);
    setTxError(null);
    try {
      let activeConnector = connector;

      if (walletStatus !== "connected") {
        const nextConnector = connectors[0];
        if (!nextConnector) {
          throw new Error("No wallet connector available.");
        }
        await connectAsync({ connector: nextConnector });
        activeConnector = nextConnector;
      }

      const connectorProvider = await activeConnector
        ?.getProvider()
        .catch(() => undefined);
      const connectorClientProvider = connectorClient
        ? {
            request: (args: unknown) => connectorClient.request(args as any),
          }
        : undefined;
      const walletClientProvider = walletClient
        ? {
            request: (args: unknown) => walletClient.request(args as any),
          }
        : undefined;
      const windowProvider =
        typeof window !== "undefined"
          ? (window as Window & { ethereum?: EthereumProvider }).ethereum
          : undefined;
      const effectiveProvider =
        connectorProvider &&
        typeof (connectorProvider as EthereumProvider).request === "function"
          ? (connectorProvider as EthereumProvider)
          : (connectorClientProvider ?? walletClientProvider ?? windowProvider);

      if (
        !effectiveProvider ||
        typeof effectiveProvider.request !== "function"
      ) {
        throw new Error("Wallet provider is not ready yet.");
      }

      await handleInit(effectiveProvider as EthereumProvider);
    } catch (error: any) {
      setTxError(error?.message || "Unable to connect wallet.");
    } finally {
      setWalletActionPending(false);
    }
  };

  const handleOpenRecipientEditor = () => {
    if (activeMode === "swap" && !recipientAddress && defaultRecipientAddress) {
      setRecipientAddress(defaultRecipientAddress);
    }
    setTxError(null);
    openDrawerStep("enter-recipient");
  };

  const handleResetRecipientToDefault = () => {
    setRecipientAddress(defaultRecipientAddress);
    setTxError(null);
  };

  const handleSaveRecipient = () => {
    const next = recipientAddress.trim();
    if (!next) {
      setTxError("Recipient address is required");
      return;
    }
    if (!next.endsWith(".eth") && !isAddress(next)) {
      setTxError("Incorrect address");
      return;
    }
    if (
      activeMode === "send" &&
      ownerAddress &&
      isAddress(next) &&
      next.toLowerCase() === ownerAddress.toLowerCase()
    ) {
      setTxError("Recipient cannot be the connected wallet.");
      return;
    }
    setRecipientAddress(next);
    setTxError(null);
    closeDrawerToIdle();
  };

  /** Start swap flow — v2 SDK per-operation onIntent hooks populate preview. */
  const handleEnterPreview = async (options: { background?: boolean } = {}) => {
    const { background = false } = options;
    const isExactOutFlow = activeMode === "deposit" || activeMode === "send";
    const quoteInputKey = activeQuoteInputKeyRef.current;
    const isCurrentQuoteInput = () =>
      activeQuoteInputKeyRef.current === quoteInputKey;

    if (!toToken) {
      return;
    }

    if (isExactOutFlow) {
      if (!hasPositiveDecimalInput(amount)) {
        return;
      }
    } else if (!hasReadyExactInSwapInput(fromTokens, toToken)) {
      if (!background) {
        setTxError(null);
        setSwapQuoteIssue(null);
      }
      return;
    }

    const receiveIssue = buildReceiveAmountIssue();
    if (receiveIssue) {
      applyReceiveAmountIssue(receiveIssue);
      if (!background && swapStepRef.current !== "idle") {
        swapStepRef.current = "idle";
        setSwapStep("idle");
      }
      return;
    }

    const configuredIssue = buildConfiguredAmountIssue();
    if (configuredIssue) {
      clearPreviewForBlockingAmountIssue();
      if (!background && swapStepRef.current !== "idle") {
        swapStepRef.current = "idle";
        setSwapStep("idle");
      }
      return;
    }

    const sourceBalanceIssue = isExactOutFlow
      ? buildExactOutSourceBalanceIssue()
      : null;
    if (sourceBalanceIssue) {
      clearPreviewForBlockingAmountIssue();
      setSwapQuoteIssue(sourceBalanceIssue);
      if (!background && swapStepRef.current !== "idle") {
        swapStepRef.current = "idle";
        setSwapStep("idle");
      }
      return;
    }

    if (!background && activeMode === "deposit") {
      trackDeposit("deposit_confirm_clicked", {
        amountToken: depositTokenDisplay,
        amountUsd: Number(depositUsdDisplay) || 0,
        selectionMode: sourceSelectionTouched ? "manual" : "auto",
        sourceCount: (intentData?.sources ?? []).length,
      });
    }

    setTxError(null);
    setSwapQuoteIssue(null);

    if (
      !background &&
      swapIntentRef.current?.runId === swapRunIdRef.current &&
      swapIntentRef.current?.quoteInputKey === quoteInputKey &&
      intentData &&
      (activeMode !== "send" || Boolean(recipientAddress)) &&
      ((activeMode !== "deposit" && activeMode !== "send") ||
        (intentData.sources ?? []).length > 0 ||
        Boolean(intentData.destination))
    ) {
      swapStepRef.current = "preview-intent";
      setSwapStep("preview-intent");
      return;
    }

    let resolvedRecipientAddress =
      activeMode === "swap" ? effectiveRecipientAddress : recipientAddress;

    if (!background && activeMode === "send" && !resolvedRecipientAddress) {
      setTxError("Recipient address is required");
      return;
    }

    if ((!background && activeMode === "send") || hasCustomSwapRecipient) {
      if (!resolvedRecipientAddress) {
        setTxError("Recipient address is required");
        return;
      }

      if (
        activeMode === "send" &&
        ownerAddress &&
        isAddress(resolvedRecipientAddress) &&
        resolvedRecipientAddress.toLowerCase() === ownerAddress.toLowerCase()
      ) {
        setTxError("Recipient cannot be the connected wallet.");
        return;
      }

      if (resolvedRecipientAddress.endsWith(".eth")) {
        try {
          const mainnetClient =
            publicClient?.chain?.id === 1
              ? publicClient
              : createPublicClient({
                  chain: mainnet,
                  transport: http(),
                });
          const ensAddr = await mainnetClient.getEnsAddress({
            name: normalize(resolvedRecipientAddress),
          });
          if (!ensAddr) {
            setTxError("Could not resolve ENS name to an address.");
            return;
          }
          resolvedRecipientAddress = ensAddr;
        } catch (e: any) {
          setTxError(e.message || "Failed to resolve ENS name.");
          return;
        }
      } else {
        if (!isAddress(resolvedRecipientAddress)) {
          setTxError("Invalid recipient address.");
          return;
        }
      }

      if (
        activeMode === "send" &&
        ownerAddress &&
        isAddress(resolvedRecipientAddress) &&
        resolvedRecipientAddress.toLowerCase() === ownerAddress.toLowerCase()
      ) {
        setTxError("Recipient cannot be the connected wallet.");
        return;
      }
    }

    if (!isCurrentQuoteInput()) {
      return;
    }

    if (!background) {
      swapStepRef.current = "preview-intent";
      setSwapStep("preview-intent");
    }
    setIntentLoading(true);
    setQuoteRefreshing(background);
    setIntentToAmount(undefined);
    setIntentFeeUsd(undefined);
    setIntentData(null);
    swapIntentRef.current?.deny();
    swapIntentRef.current = null;
    if (!background) {
      resetProgressEvents();
      swapStepsListRef.current = [];
      resetSteps();
    }

    if (!nexusSDK) {
      setTxError("SDK not initialized");
      if (!background) {
        setSwapStep("idle");
      }
      setIntentLoading(false);
      setQuoteRefreshing(false);
      setReceiveMaxCalculating(false);
      return;
    }

    swapRunIdRef.current += 1;
    const runId = swapRunIdRef.current;

    const isActionPlanStep = (step: SwapStepType | BridgeStepType) => {
      const type = getProgressStepType(step);
      return (
        type === "APPROVAL" ||
        type === "TRANSACTION_SENT" ||
        type === "TRANSACTION_CONFIRMED"
      );
    };

    const hasSwapPlanSteps = (stepList: Array<SwapStepType | BridgeStepType>) =>
      stepList.some((step) => !isActionPlanStep(step));

    const handleProgressStepSideEffects = (
      event: any,
      step: SwapStepType | BridgeStepType,
      completed: boolean
    ) => {
      const type = getProgressStepType(step);
      const rawStepType = String(
        event?.stepType ?? (step as any)?.type ?? (step as any)?.typeID ?? ""
      ).toLowerCase();
      const rawState = String(event?.state ?? "").toLowerCase();
      const explorerUrl = getPlanStepExplorerUrl(event, step);
      const intentExplorerUrl = getEventIntentExplorerUrl(
        appConfig.nexusNetwork,
        event,
        step
      );

      patchCurrentIntentExplorerUrl(intentExplorerUrl);

      if (
        type === "TRANSACTION_SENT" ||
        type === "TRANSACTION_CONFIRMED" ||
        type === "SOURCE_SWAP" ||
        type === "BRIDGE_DEPOSIT" ||
        type === "BRIDGE_INTENT_SUBMISSION" ||
        type === "BRIDGE_FILL" ||
        type === "DESTINATION_SWAP" ||
        type === "SWAP_COMPLETE" ||
        type === "SWAP_SKIPPED"
      ) {
        markSwapExecutionStarted();
      }

      if (
        PLAN_STEP_FUNDS_MOVED_STATES.has(rawState) &&
        (rawStepType === "source_swap" ||
          rawStepType === "eoa_to_ephemeral_transfer" ||
          rawStepType === "bridge_deposit" ||
          type.includes("SOURCE_SWAP") ||
          type === "BRIDGE_DEPOSIT")
      ) {
        fundsMovedRef.current = true;
      }

      if (explorerUrl) {
        if (
          rawStepType === "destination_swap" ||
          rawStepType === "execute_transaction" ||
          type.includes("DESTINATION_SWAP") ||
          type === "TRANSACTION_SENT" ||
          type === "TRANSACTION_CONFIRMED"
        ) {
          mergeExplorerUrls({ destinationExplorerUrl: explorerUrl });
        } else if (
          rawStepType === "source_swap" ||
          rawStepType === "eoa_to_ephemeral_transfer" ||
          rawStepType === "bridge_deposit" ||
          type.includes("SOURCE_SWAP") ||
          type === "BRIDGE_DEPOSIT"
        ) {
          mergeExplorerUrls({ sourceExplorerUrl: explorerUrl });
        }

        if (
          !intentUrlRef.current &&
          (rawStepType === "bridge_intent_submission" ||
            rawStepType === "request_submission" ||
            type === "BRIDGE_INTENT_SUBMISSION")
        ) {
          patchCurrentIntentExplorerUrl(explorerUrl);
        }
      }

      if (completed) {
        onStepComplete(step as SwapStepType);
      }
    };

    const handlePlanEvent = (event: any) => {
      if (event.type === "plan_preview" || event.type === "plan_confirmed") {
        const stepList = Array.isArray(event.plan?.steps)
          ? event.plan.steps.map((step: any) =>
              normalizePlanStep(step, step?.type, undefined, false)
            )
          : [];
        logSwapPlanSteps(event.type, stepList, event.plan?.steps);
        if (stepList.length === 0) return;

        if (hasSwapPlanSteps(stepList)) {
          swapStepsListRef.current = stepList as SwapStepType[];
          appendProgressListEvent(
            PROGRESS_EVENT_NAMES.SWAP_PLAN_LIST,
            stepList
          );
        } else {
          appendProgressListEvent(
            PROGRESS_EVENT_NAMES.BRIDGE_PLAN_LIST,
            stepList
          );
        }
        onStepsList(stepList as SwapStepType[]);
        return;
      }

      if (event.type !== "plan_progress") {
        logSdkSwapEvent("unhandled typed event", event);
        return;
      }

      const state = String(event.state ?? "").toLowerCase();
      const completed = PLAN_FINAL_STATES.has(state);
      const step = normalizePlanStep(
        event.step,
        event.stepType,
        event.state,
        completed
      );
      const eventName = isActionPlanStep(step)
        ? PROGRESS_EVENT_NAMES.BRIDGE_PLAN_PROGRESS
        : PROGRESS_EVENT_NAMES.SWAP_PLAN_PROGRESS;

      logSwapPlanProgress(event, step, eventName, completed);
      appendProgressEvent(eventName, step, completed, event);
      handleProgressStepSideEffects(event, step, completed);
    };

    const appendSkippedSwapProgress = () => {
      const step = {
        completed: true,
        type: "SWAP_SKIPPED",
        typeID: "SWAP_SKIPPED",
      } as SwapStepType;
      enterSkippedSwapProgress();
      appendProgressEvent(PROGRESS_EVENT_NAMES.SWAP_PLAN_PROGRESS, step, true);
      onStepComplete(step);
    };

    const handleSwapEvent = (event: any) => {
      if (!event || typeof event !== "object") return;
      if (typeof event.type === "string") {
        handlePlanEvent(event);
        return;
      }
      logSdkSwapEvent("ignored event without string type", event);
    };

    const onEvent = (event: any) => {
      const isCurrentRun = swapRunIdRef.current === runId;
      const isCurrentQuote = isCurrentQuoteInput();
      logSdkSwapEvent("onEvent", event, {
        currentRunId: swapRunIdRef.current,
        isCurrentQuote,
        isCurrentRun,
        quoteInputKey,
        runId,
      });
      if (!isCurrentRun || !isCurrentQuote) {
        logSdkSwapEvent("ignored stale onEvent", event, {
          currentRunId: swapRunIdRef.current,
          isCurrentQuote,
          quoteInputKey,
          runId,
        });
        return;
      }
      patchCurrentIntentExplorerUrl(
        getEventIntentExplorerUrl(appConfig.nexusNetwork, event)
      );
      handleSwapEvent(event);
    };

    const buildRecipientTransferExecuteConfig = (transferAmount: bigint) => {
      if (!resolvedRecipientAddress) {
        throw new Error("Recipient address is required");
      }

      const isNative =
        !toToken.contractAddress ||
        toToken.contractAddress.toLowerCase() ===
          "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
        toToken.contractAddress ===
          "0x0000000000000000000000000000000000000000";

      if (isNative) {
        return {
          to: resolvedRecipientAddress as `0x${string}`,
          value: transferAmount,
          gas: BigInt(100000),
        };
      }

      return {
        to: toToken.contractAddress as `0x${string}`,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [resolvedRecipientAddress as `0x${string}`, transferAmount],
        }),
        gas: BigInt(100000),
      };
    };

    const executeRecipientTransfer = async (transferAmount: bigint) => {
      const result = await nexusSDK.execute(
        {
          toChainId: toToken.chainId!,
          ...buildRecipientTransferExecuteConfig(transferAmount),
        },
        { onEvent }
      );
      const finalExplorerUrl =
        getSdkExplorerUrl(result) ||
        getExplorerTxUrl(
          toToken.chainId,
          getSdkTransactionHash(result),
          result
        );
      if (finalExplorerUrl) {
        setTransferExplorerUrl(finalExplorerUrl);
        mergeExplorerUrls({ destinationExplorerUrl: finalExplorerUrl });
      }
      return finalExplorerUrl;
    };

    try {
      if (!isExactOutFlow) {
        const fromPayload: {
          chainId: number;
          tokenAddress: `0x${string}`;
          amountRaw: bigint;
        }[] = [];

        const exactInSourceTokens = getReadyExactInSourceTokens(fromTokens);

        for (const token of exactInSourceTokens) {
          // Determine the amount to use for this specific token
          let rawAmountStr = token.userAmount;
          if (!rawAmountStr && exactInSourceTokens.length === 1) {
            rawAmountStr = amount; // fallback for single-token case
          }

          let cleanAmount = parseFiatNumber(rawAmountStr) ?? new Decimal(0);
          if (cleanAmount.lte(0)) continue;

          if (token.userAmountMode === "usd") {
            const tokenBalance =
              parseFiatNumber(token.balance) ?? new Decimal(0);
            const fiatBalance =
              parseFiatNumber(token.balanceInFiat) ?? new Decimal(0);
            const price = tokenBalance.gt(0)
              ? fiatBalance.div(tokenBalance)
              : new Decimal(0);
            if (price.gt(0)) {
              cleanAmount = cleanAmount.div(price);
            } else {
              cleanAmount = new Decimal(0);
            }
          }

          if (cleanAmount.lte(0)) continue;

          const safeTokenAmountStr = toViemDecimalString(
            cleanAmount,
            token.decimals || 18
          );

          fromPayload.push({
            chainId: token.chainId!,
            tokenAddress: token.contractAddress as `0x${string}`,
            amountRaw: parseUnits(safeTokenAmountStr, token.decimals || 18),
          });
        }

        if (fromPayload.length === 0) {
          throw new Error("No source amount available for swap.");
        }

        resetExplorerUrls();
        const exactInSwapPayload = {
          sources: fromPayload,
          toChainId: toToken.chainId!,
          toTokenAddress: toToken.contractAddress as `0x${string}`,
        };
        let intentExplorerUrl: string | null = null;
        let intentId = currentSwapEntry?.intentId;
        let finalExplorerUrl: string | null =
          explorerUrlsRef.current.destinationExplorerUrl ||
          explorerUrlsRef.current.sourceExplorerUrl;

        if (hasCustomSwapRecipient && resolvedRecipientAddress) {
          const sdkWithOptionalTransfer = nexusSDK as any;

          if (typeof sdkWithOptionalTransfer.swapAndTransfer === "function") {
            const swapAndTransferExactInInput = {
              mode: "exactIn",
              recipient: resolvedRecipientAddress as `0x${string}`,
              ...exactInSwapPayload,
            };
            logSdkIntentInput("swapAndTransfer exactIn", swapAndTransferExactInInput, {
              activeMode,
              quoteInputKey,
              runId,
            });
            const result = await sdkWithOptionalTransfer.swapAndTransfer(
              swapAndTransferExactInInput,
              { onEvent }
            );
            if (result?.success === false) {
              throw new Error(result?.error || "Swap and transfer failed");
            }

            const swapResult = getSdkSwapResult(result);
            intentExplorerUrl = getSdkIntentExplorerUrlForNetwork(
              appConfig.nexusNetwork,
              result,
              swapResult
            );
            intentId =
              extractIntentIdFromUrl(intentExplorerUrl) ??
              currentSwapEntry?.intentId;
            const resultFinalExplorerUrl =
              getSdkExplorerUrl(result) ||
              getExplorerTxUrl(
                toToken.chainId,
                getSdkTransactionHash(result),
                result,
                swapResult
              );
            finalExplorerUrl = resultFinalExplorerUrl || finalExplorerUrl;
            if (resultFinalExplorerUrl) {
              setTransferExplorerUrl(resultFinalExplorerUrl);
              mergeExplorerUrls({
                destinationExplorerUrl: resultFinalExplorerUrl,
              });
            }
          } else {
            logSdkIntentInput("swapWithExactIn", exactInSwapPayload, {
              activeMode,
              quoteInputKey,
              runId,
            });
            const result = await nexusSDK.swapWithExactIn(exactInSwapPayload, {
              hooks: {
                onIntent: (data) =>
                  handleSwapIntentCallback(data, runId, quoteInputKey),
              },
              onEvent,
            });

            intentExplorerUrl = getSdkIntentExplorerUrlForNetwork(
              appConfig.nexusNetwork,
              result
            );
            intentId =
              extractIntentIdFromUrl(intentExplorerUrl) ??
              currentSwapEntry?.intentId;

            const latestSwapIntent = (
              swapIntentRef.current as unknown as {
                intent?: SwapIntentData;
              } | null
            )?.intent;
            const transferAmount = latestSwapIntent?.destination?.amount;
            if (!transferAmount) {
              throw new Error(
                "Unable to determine received amount to transfer."
              );
            }

            const transferAmountBigInt = parseUnits(
              toViemDecimalString(transferAmount, toToken.decimals || 18),
              toToken.decimals || 18
            );
            finalExplorerUrl =
              (await executeRecipientTransfer(transferAmountBigInt)) ||
              finalExplorerUrl;
          }
        } else {
          // Start exact-in swap — the intent hook will fire and populate preview
          logSdkIntentInput("swapWithExactIn", exactInSwapPayload, {
            activeMode,
            quoteInputKey,
            runId,
          });
          const result = await nexusSDK.swapWithExactIn(exactInSwapPayload, {
            hooks: {
              onIntent: (data) =>
                handleSwapIntentCallback(data, runId, quoteInputKey),
            },
            onEvent,
          });
          intentExplorerUrl = getSdkIntentExplorerUrlForNetwork(
            appConfig.nexusNetwork,
            result
          );
          intentId =
            extractIntentIdFromUrl(intentExplorerUrl) ??
            currentSwapEntry?.intentId;
          const swapResult = getSdkSwapResult(result);
          const resultFinalExplorerUrl =
            getSdkExplorerUrl(result) ||
            getExplorerTxUrl(
              toToken.chainId,
              getSdkTransactionHash(result),
              result,
              swapResult
            );
          finalExplorerUrl = resultFinalExplorerUrl || finalExplorerUrl;
          if (resultFinalExplorerUrl) {
            setTransferExplorerUrl(resultFinalExplorerUrl);
            mergeExplorerUrls({
              destinationExplorerUrl: resultFinalExplorerUrl,
            });
          }
        }

        if (
          swapRunIdRef.current === runId &&
          swapStepRef.current === "progress"
        ) {
          const resolvedFinalExplorerUrl =
            finalExplorerUrl ||
            explorerUrlsRef.current.destinationExplorerUrl ||
            explorerUrlsRef.current.sourceExplorerUrl;
          const resolvedIntentExplorerUrl =
            intentExplorerUrl || intentUrlRef.current;
          finishCurrentSwapHistoryEntry("fulfilled", {
            finalExplorerUrl: resolvedFinalExplorerUrl,
            ...(resolvedIntentExplorerUrl
              ? { intentExplorerUrl: resolvedIntentExplorerUrl }
              : {}),
            ...(intentId ? { intentId } : {}),
          });
          resetInputsAfterSuccessfulExecution();
          onComplete?.();
          setSwapStep("success");
        }
      } else {
        const exactOutAmountString =
          activeMode === "deposit"
            ? depositTokenAmountForQuote
                ?.toDecimalPlaces(toToken.decimals || 18, Decimal.ROUND_DOWN)
                .toFixed()
            : amount;
        if (!exactOutAmountString || new Decimal(exactOutAmountString).lte(0)) {
          setTxError(
            depositAmountMode === "usd"
              ? "Unable to convert USD amount into the destination token amount."
              : "Enter a valid amount."
          );
          setIntentLoading(false);
          setQuoteRefreshing(false);
          setReceiveMaxCalculating(false);
          return;
        }
        const amountBigInt = parseUnits(
          toViemDecimalString(exactOutAmountString, toToken.decimals || 18),
          toToken.decimals || 18
        );

        resetExplorerUrls();

        const fromSourcesPayload = buildExactOutSourcesPayload(
          getExactOutSourceTokens()
        );

        let executeConfig: any;
        if (activeMode === "deposit" && !selectedOpportunity?.executeDeposit) {
          throw new Error("Deposit config is missing executeDeposit.");
        }

        if (activeMode === "deposit" && selectedOpportunity) {
          const user = (ownerAddress ?? connectedAddress) as `0x${string}`;

          const executeParams = selectedOpportunity.executeDeposit(
            selectedOpportunity.tokenSymbol,
            selectedOpportunity.tokenAddress,
            amountBigInt,
            selectedOpportunity.chainId,
            user
          );
          executeConfig = {
            to: executeParams.to,
            value: executeParams.value,
            data: executeParams.data,
            tokenApproval: executeParams.tokenApproval,
            gas: executeParams.gas ?? BigInt(400_000),
          };
        } else if (
          (activeMode === "send" || hasCustomSwapRecipient) &&
          resolvedRecipientAddress
        ) {
          executeConfig = buildRecipientTransferExecuteConfig(amountBigInt);
        }

        if (executeConfig?.tokenApproval) {
          executeConfig = {
            ...executeConfig,
            tokenApproval: {
              toTokenAddress:
                executeConfig.tokenApproval.toTokenAddress ||
                toToken.contractAddress,
              amount: executeConfig.tokenApproval.amount,
              spender: executeConfig.tokenApproval.spender,
            },
          };
        }

        if (executeConfig) {
          const sdkWithOptionalTransfer = nexusSDK as any;
          const isTransferExactOut =
            (activeMode === "send" || hasCustomSwapRecipient) &&
            typeof sdkWithOptionalTransfer.swapAndTransfer === "function";
          const exactOutOperationInput = isTransferExactOut
            ? {
                mode: "exactOut",
                toChainId: toToken.chainId!,
                toTokenAddress: toToken.contractAddress as `0x${string}`,
                toAmountRaw: amountBigInt,
                recipient: resolvedRecipientAddress as `0x${string}`,
                ...fromSourcesPayload,
              }
            : {
                toChainId: toToken.chainId!,
                toTokenAddress: toToken.contractAddress as `0x${string}`,
                toAmountRaw: amountBigInt,
                execute: executeConfig,
                ...fromSourcesPayload,
              };
          logSdkIntentInput(
            isTransferExactOut
              ? "swapAndTransfer exactOut"
              : "swapAndExecute exactOut",
            exactOutOperationInput,
            {
              activeMode,
              quoteInputKey,
              runId,
            }
          );
          const result =
            isTransferExactOut
              ? await sdkWithOptionalTransfer.swapAndTransfer(
                  exactOutOperationInput,
                  {
                    onEvent,
                    onIntent: (data: any) =>
                      handleSwapIntentCallback(data, runId, quoteInputKey),
                  }
                )
              : await nexusSDK.swapAndExecute(
                  exactOutOperationInput as any,
                  {
                    onEvent,
                    onIntent: (data) =>
                      handleSwapIntentCallback(data, runId, quoteInputKey),
                  }
                );

          const swapResult = result?.swapResult ?? result?.result ?? null;
          const swapSkipped = Boolean((result as any)?.swapSkipped);
          if (swapSkipped) {
            appendSkippedSwapProgress();
          }
          if (
            !swapResult &&
            !swapSkipped &&
            activeMode !== "send" &&
            !hasCustomSwapRecipient
          ) {
            throw new Error("Swap failed");
          }
          const executeTxHash = getSdkTransactionHash(result);
          const intentExplorerUrl = getSdkIntentExplorerUrlForNetwork(
            appConfig.nexusNetwork,
            result,
            swapResult
          );
          const intentId =
            extractIntentIdFromUrl(intentExplorerUrl) ??
            currentSwapEntry?.intentId;
          const finalExplorerUrl =
            getSdkExplorerUrl(result) ||
            getExplorerTxUrl(
              toToken.chainId,
              executeTxHash,
              result,
              swapResult
            );
          if (finalExplorerUrl) {
            if (activeMode === "send" || hasCustomSwapRecipient) {
              setTransferExplorerUrl(finalExplorerUrl);
            }
            mergeExplorerUrls({ destinationExplorerUrl: finalExplorerUrl });
          }
          patchCurrentSwapHistoryEntry({
            ...(finalExplorerUrl ? { finalExplorerUrl } : {}),
            ...(intentExplorerUrl ? { intentExplorerUrl } : {}),
            ...(intentId ? { intentId } : {}),
          });
        } else {
          const exactOutSwapInput = {
            toChainId: toToken.chainId!,
            toTokenAddress: toToken.contractAddress as `0x${string}`,
            toAmountRaw: amountBigInt,
            ...fromSourcesPayload,
          };
          logSdkIntentInput("swapWithExactOut", exactOutSwapInput, {
            activeMode,
            quoteInputKey,
            runId,
          });
          const result = await nexusSDK.swapWithExactOut(
            exactOutSwapInput,
            {
              hooks: {
                onIntent: (data) =>
                  handleSwapIntentCallback(data, runId, quoteInputKey),
              },
              onEvent,
            }
          );
          const intentExplorerUrl = getSdkIntentExplorerUrlForNetwork(
            appConfig.nexusNetwork,
            result
          );
          const intentId =
            extractIntentIdFromUrl(intentExplorerUrl) ??
            currentSwapEntry?.intentId;
          const swapResult = getSdkSwapResult(result);
          const finalExplorerUrl =
            getSdkExplorerUrl(result) ||
            getExplorerTxUrl(
              toToken.chainId,
              getSdkTransactionHash(result),
              result,
              swapResult
            );
          if (finalExplorerUrl) {
            mergeExplorerUrls({ destinationExplorerUrl: finalExplorerUrl });
          }
          patchCurrentSwapHistoryEntry({
            ...(finalExplorerUrl ? { finalExplorerUrl } : {}),
            ...(intentExplorerUrl ? { intentExplorerUrl } : {}),
            ...(intentId ? { intentId } : {}),
          });
        }

        if (
          swapRunIdRef.current === runId &&
          swapStepRef.current === "progress"
        ) {
          finishCurrentSwapHistoryEntry("fulfilled");
          resetInputsAfterSuccessfulExecution();
          onComplete?.();
          if (activeMode === "deposit") {
            reachedTerminalRef.current = true;
            const now = Date.now();
            trackDeposit("deposit_completed", {
              postConfirmDurationMs: previewConfirmedTsRef.current
                ? now - previewConfirmedTsRef.current
                : 0,
              totalDurationMs: now - widgetOpenedTsRef.current,
              attemptCount: attemptCountRef.current,
              amountToken: depositTokenDisplay,
              amountUsd: Number(depositUsdDisplay) || 0,
            });
          }
          setSwapStep("success");
        }
      }
    } catch (err: any) {
      const caughtTimeout = isTimeoutLikeError(err);
      if (caughtTimeout) {
        console.warn("Timeout in handleEnterPreview:", err);
      } else {
        console.error("Error in handleEnterPreview:", err);
      }
      if (swapRunIdRef.current !== runId || !isCurrentQuoteInput()) {
        return;
      }
      if (activeMode === "deposit" && err?.code !== "USER_DENIED_INTENT") {
        const hasActiveExecution =
          swapStepRef.current === "progress" &&
          Boolean(currentSwapIdRef.current);
        const isInsufficient = isInsufficientSourcesError(err);
        const errMessage =
          (typeof err?.message === "string" ? err.message : "") ||
          (typeof err === "string" ? err : "");
        const errName = typeof err?.name === "string" ? err.name : "";
        const isTimeout = isTimeoutLikeError(err);
        const isUserRejected =
          err?.code === 4001 ||
          err?.code === "ACTION_REJECTED" ||
          errName === "UserRejectedRequestError" ||
          /user rejected|user denied/i.test(errMessage);
        const failedAtStep:
          | "simulation"
          | "nexus_operation"
          | "execute_leg"
          | "unknown" = !hasActiveExecution ? "simulation" : "nexus_operation";
        const errorCategory: string = isUserRejected
          ? "user_rejected"
          : isTimeout
            ? "timeout"
            : isInsufficient
              ? "no_eligible_sources"
              : !hasActiveExecution
                ? "quote_failed"
                : "execution_failed";
        reachedTerminalRef.current = true;
        if (fundsMovedRef.current) {
          trackDeposit("deposit_partial_movement_detected", {
            intentUrl: intentUrlRef.current,
          });
        }
        trackDeposit("deposit_failed", {
          errorCode: err?.code ?? "UNKNOWN",
          errorCategory,
          errorMessage: errMessage || "Transaction failed.",
          failedAtStep,
        });
      }
      setQuoteRefreshing(false);
      setIntentLoading(false);
      setReceiveMaxCalculating(false);
      const hasActiveExecution =
        swapStepRef.current === "progress" && Boolean(currentSwapIdRef.current);
      const isTimeout = caughtTimeout;
      const showFailedProgressThenReceipt = (
        error: string,
        patch: Partial<SwapHistoryEntry> = {}
      ) => {
        const failedProgressEvent = progressEventsRef.current.at(-1);
        const isTransferExecution =
          activeMode === "send" || hasCustomSwapRecipient;
        const fallbackFailedStep =
          activeMode === "deposit" || isTransferExecution
            ? ({ type: "APPROVAL", typeID: "AP" } as BridgeStepType)
            : ({
                type: "DETERMINING_SWAP",
                typeID: "DETERMINING_SWAP",
              } as unknown as SwapStepType);
        const failedStep = failedProgressEvent?.step ?? fallbackFailedStep;
        const autoRefundAvailable =
          isAutoRefundAvailableProgressEvent(failedProgressEvent);
        setFailedProgressStep(failedStep);
        finishCurrentSwapHistoryEntry("failed", {
          error,
          autoRefundAvailable,
          failureDescription: getFailureDescriptionForProgressStep(
            failedStep,
            autoRefundAvailable
          ),
          failureMessage: getFailureMessageForProgressStep(
            failedStep,
            hasCustomSwapRecipient ? "send" : activeMode,
            autoRefundAvailable
          ),
          failedStepType: getProgressStepType(failedStep),
          ...patch,
        });
        window.setTimeout(() => {
          if (
            swapRunIdRef.current === runId &&
            swapStepRef.current === "progress"
          ) {
            setSwapStep("failed");
          }
        }, 700);
      };
      const showTimeoutReceipt = (
        message = "Transaction timed out",
        patch: Partial<SwapHistoryEntry> = {}
      ) => {
        finishCurrentSwapHistoryEntry("timeout", {
          error: message,
          failureDescription:
            "This transaction is still pending. Check the intent explorer for the latest status.",
          failureMessage: TIMEOUT_LABEL,
          ...patch,
        });
        window.setTimeout(() => {
          if (
            swapRunIdRef.current === runId &&
            swapStepRef.current === "progress"
          ) {
            setSwapStep("failed");
          }
        }, 700);
      };
      if (err?.code === "USER_DENIED_INTENT") {
        if (hasActiveExecution) {
          showFailedProgressThenReceipt("Transaction cancelled by user");
        } else if (!background && swapStepRef.current === "preview-intent") {
          setSwapStep("idle");
        }
        return;
      }
      if (isInsufficientSourcesError(err) && !hasActiveExecution) {
        const issue = buildInsufficientSourcesIssue(err);
        if (!background || swapStepRef.current === "preview-intent") {
          setSwapStep("idle");
        }
        setTxError(null);
        setSwapQuoteIssue(issue);
        onError?.(issue.message);
        return;
      }
      if (isExactOutFlow && isViemInvalidDecimalError(err) && !hasActiveExecution) {
        const issue = buildExactOutSourceBalanceIssue();
        if (issue) {
          if (!background || swapStepRef.current === "preview-intent") {
            setSwapStep("idle");
          }
          setTxError(null);
          setSwapQuoteIssue(issue);
          onError?.(issue.message);
          return;
        }
      }
      const errorMessage =
        err?.message ||
        (typeof err === "string"
          ? err
          : "Transaction failed. Please try again or check console.");
      if (isTimeout && hasActiveExecution) {
        showTimeoutReceipt(errorMessage);
        setTxError(null);
        return;
      }
      if (hasActiveExecution) {
        showFailedProgressThenReceipt(errorMessage);
      } else if (!background || swapStepRef.current === "preview-intent") {
        setSwapStep("idle");
      }
      setTxError(errorMessage);
      onError?.(errorMessage);
    }
  };

  const hasInsufficientSourcesQuoteIssue =
    swapQuoteIssue?.type === "insufficientSources";
  const hasReceiveAmountQuoteIssue = Boolean(receiveAmountIssue);

  useEffect(() => {
    if (activeMode !== "swap" || swapStep !== "idle" || !nexusSDK) return;

    if (syncingIntentSourcesRef.current) {
      syncingIntentSourcesRef.current = false;
      return;
    }

    if (hasReceiveAmountQuoteIssue) {
      clearPendingSwapIntent(true);
      setIntentLoading(false);
      setQuoteRefreshing(false);
      setReceiveMaxCalculating(false);
      return;
    }

    if (hasInsufficientSourcesQuoteIssue) {
      setIntentLoading(false);
      setQuoteRefreshing(false);
      setReceiveMaxCalculating(false);
      return;
    }

    const hasEnoughForQuote = hasReadyExactInSwapInput(fromTokens, toToken);

    if (!hasEnoughForQuote) {
      clearPendingSwapIntent();
      setSwapQuoteIssue(null);
      setTxError(null);
      return;
    }

    if (hasCurrentQuoteIntent) {
      setIntentLoading(false);
      setQuoteRefreshing(false);
      return;
    }

    clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
    setQuoteRefreshing(true);
    let quoteStarted = false;
    const timer = window.setTimeout(() => {
      quoteStarted = true;
      void handleEnterPreview({ background: true });
    }, EXACT_OUT_INPUT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (syncingIntentSourcesRef.current) return;
      if (!quoteStarted && swapStepRef.current === "idle") {
        clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
      }
    };
  }, [
    activeMode,
    activeQuoteInputKey,
    amount,
    defaultRecipientAddress,
    fromTokensQuoteKey,
    hasCurrentQuoteIntent,
    hasInsufficientSourcesQuoteIssue,
    hasReceiveAmountQuoteIssue,
    nexusSDK,
    recipientAddress,
    swapStep,
    toTokenQuoteKey,
  ]);

  useEffect(() => {
    if (activeMode !== "deposit" || swapStep !== "idle" || !nexusSDK) return;

    if (syncingIntentSourcesRef.current) {
      syncingIntentSourcesRef.current = false;
      return;
    }

    if (hasReceiveAmountQuoteIssue) {
      clearPendingSwapIntent(true);
      setIntentLoading(false);
      setQuoteRefreshing(false);
      setReceiveMaxCalculating(false);
      return;
    }

    if (hasInsufficientSourcesQuoteIssue) {
      setIntentLoading(false);
      setQuoteRefreshing(false);
      setReceiveMaxCalculating(false);
      return;
    }

    const parsedAmount = parseFiatNumber(amount);
    const hasEnoughForQuote = Boolean(
      parsedAmount?.gt(0) &&
        toToken &&
        selectedOpportunity &&
        depositTokenAmountForQuote
    );

    if (!hasEnoughForQuote) {
      clearPendingSwapIntent();
      clearSelectedSources();
      return;
    }

    if (hasCurrentQuoteIntent) {
      setIntentLoading(false);
      setQuoteRefreshing(false);
      return;
    }

    clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
    setQuoteRefreshing(true);
    let quoteStarted = false;
    const timer = window.setTimeout(() => {
      quoteStarted = true;
      void handleEnterPreview({ background: true });
    }, EXACT_OUT_INPUT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (syncingIntentSourcesRef.current) return;
      if (!quoteStarted && swapStepRef.current === "idle") {
        clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
      }
    };
  }, [
    activeMode,
    amount,
    activeQuoteInputKey,
    depositAmountMode,
    depositQuoteAmountKey,
    hasCurrentQuoteIntent,
    hasInsufficientSourcesQuoteIssue,
    hasReceiveAmountQuoteIssue,
    nexusSDK,
    sourceSelectionRevision,
    selectedOpportunityIdentity,
    swapStep,
    toTokenQuoteKey,
  ]);

  useEffect(() => {
    if (activeMode !== "send" || swapStep !== "idle" || !nexusSDK) return;

    if (syncingIntentSourcesRef.current) {
      syncingIntentSourcesRef.current = false;
      return;
    }

    if (hasReceiveAmountQuoteIssue) {
      clearPendingSwapIntent(true);
      setIntentLoading(false);
      setQuoteRefreshing(false);
      setReceiveMaxCalculating(false);
      return;
    }

    if (hasInsufficientSourcesQuoteIssue) {
      setIntentLoading(false);
      setQuoteRefreshing(false);
      setReceiveMaxCalculating(false);
      return;
    }

    const parsedAmount = parseFiatNumber(amount);
    const hasEnoughForQuote = Boolean(parsedAmount?.gt(0) && toToken);

    if (!hasEnoughForQuote) {
      clearPendingSwapIntent();
      clearSelectedSources();
      return;
    }

    if (hasCurrentQuoteIntent) {
      setIntentLoading(false);
      setQuoteRefreshing(false);
      return;
    }

    clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
    setQuoteRefreshing(true);
    let quoteStarted = false;
    const timer = window.setTimeout(() => {
      quoteStarted = true;
      void handleEnterPreview({ background: true });
    }, EXACT_OUT_INPUT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (syncingIntentSourcesRef.current) return;
      if (!quoteStarted && swapStepRef.current === "idle") {
        clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
      }
    };
  }, [
    activeMode,
    amount,
    activeQuoteInputKey,
    hasCurrentQuoteIntent,
    hasInsufficientSourcesQuoteIssue,
    hasReceiveAmountQuoteIssue,
    nexusSDK,
    sourceSelectionRevision,
    swapStep,
    toTokenQuoteKey,
  ]);

  const refreshActiveSwapIntent = useCallback(async () => {
    if (receiveAmountIssueRef.current) return;

    const activeIntent = swapIntentRef.current;
    if (
      !activeIntent ||
      intentLoading ||
      quoteRefreshing ||
      receiveMaxCalculating ||
      previewQuoteRefreshing
    ) {
      return;
    }

    const runId = activeIntent.runId;
    const quoteInputKey = activeIntent.quoteInputKey;
    if (!quoteInputKey || activeQuoteInputKeyRef.current !== quoteInputKey) {
      return;
    }
    const isPreviewRefresh = swapStepRef.current === "preview-intent";
    if (isPreviewRefresh) {
      setPreviewQuoteRefreshing(true);
    } else {
      setQuoteRefreshing(true);
    }
    try {
      const updatedRaw = await activeIntent.refresh();
      const updatedBridgeProvider = normalizeBridgeProvider(
        (updatedRaw as any)?.bridgeProvider ??
          (updatedRaw as any)?.swap?.bridgeProvider ??
          activeIntent.intent?.bridgeProvider
      );
      const updated = normalizeRenderableSwapIntentData(
        updatedRaw,
        updatedBridgeProvider
      );
      if (
        !updated ||
        swapRunIdRef.current !== runId ||
        activeQuoteInputKeyRef.current !== quoteInputKey
      ) {
        return;
      }

      if (swapIntentRef.current) {
        swapIntentRef.current.intent = updated;
      }
      applySwapIntent(updated);
    } catch (err) {
      console.error("Unable to refresh swap intent", err);
    } finally {
      if (
        swapRunIdRef.current === runId &&
        activeQuoteInputKeyRef.current === quoteInputKey
      ) {
        if (isPreviewRefresh) {
          setPreviewQuoteRefreshing(false);
        } else {
          setQuoteRefreshing(false);
        }
      }
    }
  }, [
    applySwapIntent,
    intentLoading,
    previewQuoteRefreshing,
    quoteRefreshing,
    receiveMaxCalculating,
  ]);

  useEffect(() => {
    const hasRefreshableIntent =
      (activeMode === "swap" ||
        activeMode === "deposit" ||
        activeMode === "send") &&
      Boolean(
        intentData &&
          swapIntentRef.current &&
          swapIntentRef.current.quoteInputKey === activeQuoteInputKey
      ) &&
      (swapStep === "idle" || swapStep === "preview-intent");

    if (!hasRefreshableIntent || receiveAmountIssue) {
      setQuoteRefreshProgress(0);
      setQuoteRefreshSecondsRemaining(0);
      return;
    }

    let cancelled = false;
    let timeout: number | undefined;

    const scheduleRefresh = () => {
      const quoteAge = Date.now() - lastSwapIntentRefreshAtRef.current;
      const delay = Math.max(0, QUOTE_REFRESH_INTERVAL_MS - quoteAge);
      timeout = window.setTimeout(() => {
        if (receiveAmountIssueRef.current) {
          clearPendingSwapIntent(true);
          setQuoteRefreshProgress(0);
          setQuoteRefreshSecondsRemaining(0);
          return;
        }

        if (
          intentLoading ||
          quoteRefreshing ||
          receiveMaxCalculating ||
          previewQuoteRefreshing
        ) {
          if (!cancelled) {
            timeout = window.setTimeout(scheduleRefresh, 1000);
          }
          return;
        }

        void refreshActiveSwapIntent().finally(() => {
          if (!cancelled) {
            scheduleRefresh();
          }
        });
      }, delay);
    };

    scheduleRefresh();

    return () => {
      cancelled = true;
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
    };
  }, [
    activeMode,
    activeQuoteInputKey,
    intentData,
    intentLoading,
    receiveAmountIssue,
    previewQuoteRefreshing,
    quoteRefreshing,
    receiveMaxCalculating,
    refreshActiveSwapIntent,
    swapStep,
  ]);

  useEffect(() => {
    const hasRefreshableIntent =
      (activeMode === "swap" ||
        activeMode === "deposit" ||
        activeMode === "send") &&
      Boolean(
        intentData &&
          swapIntentRef.current &&
          swapIntentRef.current.quoteInputKey === activeQuoteInputKey
      ) &&
      (swapStep === "idle" || swapStep === "preview-intent");

    if (!hasRefreshableIntent || receiveAmountIssue) {
      setQuoteRefreshProgress(0);
      setQuoteRefreshSecondsRemaining(0);
      return;
    }

    const updateProgress = () => {
      const quoteAge = Date.now() - lastSwapIntentRefreshAtRef.current;
      const remaining = Math.max(0, QUOTE_REFRESH_INTERVAL_MS - quoteAge);
      setQuoteRefreshProgress(remaining / QUOTE_REFRESH_INTERVAL_MS);
      setQuoteRefreshSecondsRemaining(Math.ceil(remaining / 1000));
    };

    updateProgress();
    const interval = window.setInterval(updateProgress, 250);

    return () => window.clearInterval(interval);
  }, [
    activeMode,
    activeQuoteInputKey,
    intentData,
    receiveAmountIssue,
    swapStep,
  ]);

  /** User accepted swap from the preview — call allow() from the intent hook */
  const handleSwapAccept = () => {
    const activeIntent = swapIntentRef.current;
    if (activeIntent) {
      if (
        activeIntent.quoteInputKey &&
        activeQuoteInputKeyRef.current !== activeIntent.quoteInputKey
      ) {
        clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
        setQuoteRefreshing(true);
        setSwapStep("idle");
        return;
      }
      if (activeMode === "deposit") {
        previewConfirmedTsRef.current = Date.now();
        attemptCountRef.current += 1;
        const timeInPreviewMs = previewViewedTsRef.current
          ? previewConfirmedTsRef.current - previewViewedTsRef.current
          : 0;
        trackDeposit("deposit_preview_confirmed", {
          timeInPreviewMs,
          totalFeeUsd: Number(intentFeeUsd) || 0,
          sourceCount: (intentData?.sources ?? []).length,
        });
      }
      onStart?.();
      startSwapHistoryEntry();
      setSwapStep("progress");
      setQuoteRefreshing(false);
      resetProgressEvents();
      if (swapStepsListRef.current.length > 0) {
        seed(swapStepsListRef.current);
      } else {
        resetSteps();
      }
      activeIntent.allow();
    }
  };

  // ---------------------------------------------------------------------------
  // Header title
  // ---------------------------------------------------------------------------
  const getTitle = () => {
    const configuredWidgetHeading = normalizeConfiguredString(
      appearanceConfig?.widgetHeading
    );
    if (swapStep === "history") return "Transaction History";
    // Drawer panels overlay the main page,
    // so the header should still show the main page title.

    if (swapStep === "preview-intent") {
      return activeMode === "deposit"
        ? "Confirm Deposit"
        : activeMode === "send"
          ? "Confirm Send"
          : "Confirm Swap";
    }

    if (activeMode === "swap") {
      if (swapStep === "progress") return "Swapping…";
      if (swapStep === "success") return "Swap Complete";
      if (swapStep === "failed" && currentSwapEntry?.status === "timeout") {
        return TIMEOUT_LABEL;
      }
      if (swapStep === "failed") return "Swap Failed";
      return configuredWidgetHeading ?? "Swap and Bridge";
    }
    if (activeMode === "deposit") {
      if (swapStep === "progress") return "Depositing…";
      if (swapStep === "success") return "Deposit Complete";
      if (swapStep === "failed" && currentSwapEntry?.status === "timeout") {
        return TIMEOUT_LABEL;
      }
      if (swapStep === "failed") return "Deposit Failed";
      return configuredWidgetHeading ?? "Deposit";
    }
    if (activeMode === "send") {
      if (swapStep === "progress") return "Sending…";
      if (swapStep === "success") return "Send Complete";
      if (swapStep === "failed" && currentSwapEntry?.status === "timeout") {
        return TIMEOUT_LABEL;
      }
      if (swapStep === "failed") return "Send Failed";
      return configuredWidgetHeading ?? "Send";
    }
    return configuredWidgetHeading ?? "Nexus Widget";
  };

  // Titles that should be center-aligned (main screens / confirm screens)
  // Left-aligned: choose-swap-asset, choose-receive-asset (sub-screens with subtitles)
  const isTitleCentered = () => {
    if (swapStep === "history") return false;
    return true; // idle, drawer panels, preview-intent, progress, etc.
  };

  const canGoBack = swapStep === "preview-intent" || swapStep === "history";
  const handleBack = () => {
    if (swapStep === "history") {
      setSwapStep("idle");
      return;
    }
    if (swapStep === "choose-swap-asset") {
      closeDrawerToIdle();
      return;
    }
    if (swapStep === "choose-receive-asset") {
      closeDrawerToIdle();
      return;
    }
    if (swapStep === "enter-recipient") {
      closeDrawerToIdle();
      return;
    }
    if (swapStep === "preview-intent") {
      const canRequoteAfterPreviewBack =
        activeMode === "swap"
          ? hasReadyExactInSwapInput(fromTokens, toToken)
          : canRefreshExactOutQuote();

      if (
        canRequoteAfterPreviewBack &&
        (activeMode === "deposit" || activeMode === "send")
      ) {
        setExactOutQuoteSourceModeValue("all");
      }
      if (activeMode === "deposit" || activeMode === "send") {
        invalidateExactOutQuoteForRefresh();
      } else {
        clearPendingSwapIntent(true, {
          keepQuoteRefreshing: canRequoteAfterPreviewBack,
        });
      }
      if (canRequoteAfterPreviewBack && activeMode === "swap") {
        setQuoteRefreshing(true);
        setTxError(null);
        setSwapQuoteIssue(null);
      }
      setSwapStep("idle");
      return;
    }
    if (swapStep === "progress") {
      return;
    } // can't go back during tx
    setSwapStep("idle");
  };

  const handleSwapAmountChange = (val: string, panel: "send" | "receive") => {
    if (isConfiguredAmountFixed) return;
    syncingIntentSourcesRef.current = false;
    setSwapQuoteIssue(null);
    setTxError(null);
    const nextAmount = parseFiatNumber(val);
    const receiveIssue = buildReceiveAmountIssue({ inputAmount: val });
    applyReceiveAmountIssue(receiveIssue);
    const hasSelectedSourceToken = fromTokens.some(
      (token) => token.chainId && token.contractAddress
    );
    const shouldLoadQuote = Boolean(
      !receiveIssue &&
        nexusSDK &&
        nextAmount?.gt(0) &&
        toToken &&
        hasSelectedSourceToken
    );
    if (!receiveIssue) {
      clearPendingSwapIntent(true, { keepQuoteRefreshing: shouldLoadQuote });
    }
    if (shouldLoadQuote) {
      setQuoteRefreshing(true);
    }
    setAmount(val);
    if (panel === "receive") {
      setFromTokens((prev) =>
        prev.map((token) => ({ ...token, userAmount: "" }))
      );
    }
    // Nexus Widget swaps are exact-in only. Exact-out is reserved for Deposit and Send.
    if (swapType !== "exactIn") {
      setSwapType("exactIn");
    }
  };

  const handleSwapTokensUpdate = (tokens: SwapTokenOption[]) => {
    setSwapQuoteIssue(null);
    setTxError(null);
    applyReceiveAmountIssue(buildReceiveAmountIssue({ sourceTokens: tokens }));
    setFromTokens(tokens);
  };

  const handleDepositAmountChange = (val: string) => {
    if (isConfiguredAmountFixed) return;
    syncingIntentSourcesRef.current = false;
    resetExactOutSourcesToAuto();
    maxPercentRunRef.current += 1;
    setReceiveMaxCalculating(false);
    setMaxCalculationPercent(null);
    setSwapQuoteIssue(null);
    const nextAmount = parseFiatNumber(val);
    const receiveIssue = buildReceiveAmountIssue({ inputAmount: val });
    applyReceiveAmountIssue(receiveIssue);
    const shouldLoadQuote = Boolean(
      !receiveIssue &&
        nexusSDK &&
        nextAmount?.gt(0) &&
        toToken &&
        selectedOpportunity
    );
    if (!receiveIssue) {
      clearPendingSwapIntent(true, { keepQuoteRefreshing: shouldLoadQuote });
    }
    if (shouldLoadQuote) {
      setQuoteRefreshing(true);
    } else {
      clearSelectedSources();
    }
    setAmount(val);
  };

  const handleSendAmountChange = (val: string) => {
    if (isConfiguredAmountFixed) return;
    syncingIntentSourcesRef.current = false;
    resetExactOutSourcesToAuto();
    maxPercentRunRef.current += 1;
    setReceiveMaxCalculating(false);
    setMaxCalculationPercent(null);
    setSwapQuoteIssue(null);
    setSwapType("exactOut");
    const nextAmount = parseFiatNumber(val);
    const receiveIssue = buildReceiveAmountIssue({
      inputAmount: val,
      type: "exactOut",
    });
    applyReceiveAmountIssue(receiveIssue);
    const shouldLoadQuote = Boolean(
      !receiveIssue && nexusSDK && nextAmount?.gt(0) && toToken
    );
    if (!receiveIssue) {
      clearPendingSwapIntent(true, { keepQuoteRefreshing: shouldLoadQuote });
    }
    if (shouldLoadQuote) {
      setQuoteRefreshing(true);
    } else {
      clearSelectedSources();
    }
    setAmount(val);
  };

  const handleDepositAmountModeToggle = () => {
    if (isConfiguredAmountFixed) return;
    syncingIntentSourcesRef.current = false;
    resetExactOutSourcesToAuto();
    const rate = getDepositTokenUsdRate();
    const parsedAmount = parseFiatNumber(amount) ?? new Decimal(0);
    if (parsedAmount.gt(0) && rate.gt(0)) {
      const converted =
        depositAmountMode === "token"
          ? parsedAmount.mul(rate).toDecimalPlaces(2)
          : parsedAmount
              .div(rate)
              .toDecimalPlaces(
                getCappedTokenDisplayDecimals(toToken?.decimals),
                Decimal.ROUND_DOWN
              );
      setAmount(converted.toFixed());
    }
    clearPendingSwapIntent();
    setDepositAmountMode((current) => (current === "token" ? "usd" : "token"));
  };

  const handleDepositPercentSelect = async (pct: number) => {
    if (isConfiguredAmountFixed) return;
    if (!toToken) return;

    syncingIntentSourcesRef.current = false;
    setTxError(null);
    setSwapQuoteIssue(null);
    const runId = ++maxPercentRunRef.current;
    lastInputMethodRef.current =
      pct === 20
        ? "percent_20"
        : pct === 25
          ? "percent_25"
          : pct === 50
            ? "percent_50"
            : pct === 75
              ? "percent_75"
              : "percent_max";

    if (pct !== 100) {
      const usdAmount = getTotalBalancePercentUsdAmount(pct);
      const shouldUseMaxQuoteFallback =
        depositAmountMode === "usd" && getDepositTokenUsdRate().lte(0);
      const nextAmount =
        depositAmountMode === "usd"
          ? usdAmount.toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed()
          : formatTokenAmountFromUsd(usdAmount, toToken);

      if (nextAmount && !shouldUseMaxQuoteFallback) {
        setQuoteRefreshing(false);
        setReceiveMaxCalculating(false);
        setMaxCalculationPercent(null);
        handleDepositAmountChange(nextAmount);
        return;
      }

      setQuoteRefreshing(false);
      setReceiveMaxCalculating(true);
      setMaxCalculationPercent(pct);
      try {
        await waitForNextPaint();
        const fallback = await getPercentAmountFromMaxQuote(
          toToken,
          pct,
          depositAmountMode === "usd"
        );
        if (runId !== maxPercentRunRef.current) return;
        if (!fallback) {
          setQuoteRefreshing(false);
          setReceiveMaxCalculating(false);
          setMaxCalculationPercent(null);
          setTxError(
            "Unable to calculate this percentage for the deposit asset."
          );
          return;
        }

        setDepositAmountMode(fallback.mode);
        setReceiveMaxCalculating(false);
        setMaxCalculationPercent(null);
        handleDepositAmountChange(fallback.amount);
      } catch (error: any) {
        if (runId !== maxPercentRunRef.current) return;
        console.error("Unable to calculate percentage deposit amount", error);
        setReceiveMaxCalculating(false);
        setMaxCalculationPercent(null);
        setQuoteRefreshing(false);
        if (isInsufficientSourcesError(error)) {
          setSwapQuoteIssue(buildInsufficientSourcesIssue(error));
          return;
        }
        setTxError(
          error?.message ||
            "Unable to calculate this percentage for the deposit asset."
        );
      }
      return;
    }

    setQuoteRefreshing(false);
    setReceiveMaxCalculating(true);
    setMaxCalculationPercent(100);
    try {
      await waitForNextPaint();
      const maxAmount = await getPercentAmountFromMaxQuote(
        toToken,
        100,
        depositAmountMode === "usd"
      );
      if (runId !== maxPercentRunRef.current) return;
      if (!maxAmount) {
        setReceiveMaxCalculating(false);
        setMaxCalculationPercent(null);
        setQuoteRefreshing(false);
        setTxError("No depositable amount is available for this deposit.");
        return;
      }

      setDepositAmountMode(maxAmount.mode);
      setReceiveMaxCalculating(false);
      setMaxCalculationPercent(null);
      handleDepositAmountChange(maxAmount.amount);
    } catch (error: any) {
      if (runId !== maxPercentRunRef.current) return;
      console.error("Unable to calculate max deposit amount", error);
      setReceiveMaxCalculating(false);
      setMaxCalculationPercent(null);
      setQuoteRefreshing(false);
      if (isInsufficientSourcesError(error)) {
        setSwapQuoteIssue(buildInsufficientSourcesIssue(error));
        return;
      }
      setTxError(
        error?.message || "Unable to calculate the max deposit amount."
      );
    }
  };

  const handleSendPercentSelect = async (pct: number) => {
    if (isConfiguredAmountFixed) return;
    if (!toToken) return;

    syncingIntentSourcesRef.current = false;
    setTxError(null);
    setSwapQuoteIssue(null);
    const runId = ++maxPercentRunRef.current;
    lastInputMethodRef.current =
      pct === 20
        ? "percent_20"
        : pct === 25
          ? "percent_25"
          : pct === 50
            ? "percent_50"
            : pct === 75
              ? "percent_75"
              : "percent_max";

    if (pct !== 100) {
      const usdAmount = getTotalBalancePercentUsdAmount(pct);
      const nextAmount = formatTokenAmountFromUsd(usdAmount, toToken);

      if (nextAmount) {
        setQuoteRefreshing(false);
        setReceiveMaxCalculating(false);
        setMaxCalculationPercent(null);
        handleSendAmountChange(nextAmount);
        return;
      }

      setQuoteRefreshing(false);
      setReceiveMaxCalculating(true);
      setMaxCalculationPercent(pct);
      try {
        await waitForNextPaint();
        const fallback = await getPercentAmountFromMaxQuote(
          toToken,
          pct,
          false
        );
        if (runId !== maxPercentRunRef.current) return;
        if (!fallback) {
          setQuoteRefreshing(false);
          setReceiveMaxCalculating(false);
          setMaxCalculationPercent(null);
          setTxError("Unable to calculate this percentage for the send asset.");
          return;
        }

        setReceiveMaxCalculating(false);
        setMaxCalculationPercent(null);
        handleSendAmountChange(fallback.amount);
      } catch (error: any) {
        if (runId !== maxPercentRunRef.current) return;
        console.error("Unable to calculate percentage send amount", error);
        setReceiveMaxCalculating(false);
        setMaxCalculationPercent(null);
        setQuoteRefreshing(false);
        if (isInsufficientSourcesError(error)) {
          setSwapQuoteIssue(buildInsufficientSourcesIssue(error));
          return;
        }
        setTxError(
          error?.message ||
            "Unable to calculate this percentage for the send asset."
        );
      }
      return;
    }

    setQuoteRefreshing(false);
    setReceiveMaxCalculating(true);
    setMaxCalculationPercent(100);
    try {
      await waitForNextPaint();
      const maxAmount = await getPercentAmountFromMaxQuote(toToken, 100, false);
      if (runId !== maxPercentRunRef.current) return;
      if (!maxAmount) {
        setReceiveMaxCalculating(false);
        setMaxCalculationPercent(null);
        setQuoteRefreshing(false);
        setTxError("No transferable amount is available for this asset.");
        return;
      }

      setReceiveMaxCalculating(false);
      setMaxCalculationPercent(null);
      handleSendAmountChange(maxAmount.amount);
    } catch (error: any) {
      if (runId !== maxPercentRunRef.current) return;
      console.error("Unable to calculate max send amount", error);
      setReceiveMaxCalculating(false);
      setMaxCalculationPercent(null);
      setQuoteRefreshing(false);
      if (isInsufficientSourcesError(error)) {
        setSwapQuoteIssue(buildInsufficientSourcesIssue(error));
        return;
      }
      setTxError(error?.message || "Unable to calculate the max send amount.");
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const insufficientSourceIssue =
    swapQuoteIssue?.type === "insufficientSources" ? swapQuoteIssue : null;
  const configuredAmountIssue = buildConfiguredAmountIssue();
  const blockingQuoteIssue =
    insufficientSourceIssue ?? receiveAmountIssue ?? configuredAmountIssue;
  const isExactOutPaymentFlow =
    activeMode === "deposit" || activeMode === "send";
  const hasCurrentRunnableIntent = hasCurrentQuoteIntent;
  const hasIntentSources = Boolean((intentData?.sources ?? []).length > 0);
  const hasCurrentExactOutPaymentIntent =
    hasCurrentRunnableIntent &&
    (hasIntentSources ||
      (isExactOutPaymentFlow && Boolean(intentData?.destination)));
  const isExactOutRouteLoading =
    isExactOutPaymentFlow &&
    swapStep === "idle" &&
    swapType === "exactOut" &&
    Boolean(
      toToken && (receiveMaxCalculating || (amount && Number(amount) > 0))
    ) &&
    !blockingQuoteIssue &&
    !hasCurrentExactOutPaymentIntent &&
    (quoteRefreshing || intentLoading || receiveMaxCalculating);
  const isQuoteUnavailableForAutoSourceFlow =
    isExactOutPaymentFlow &&
    Boolean(hasPositiveDecimalInput(amount) && toToken) &&
    !quoteRefreshing &&
    !receiveMaxCalculating &&
    !intentLoading &&
    !blockingQuoteIssue &&
    !hasCurrentExactOutPaymentIntent;
  const hasPositiveRootAmount = hasPositiveDecimalInput(amount);
  const hasReadySwapQuoteInput = hasReadyExactInSwapInput(fromTokens, toToken);
  const needsWalletConnection = !ownerAddress || !nexusSDK;
  const walletConnectBusy =
    walletActionPending ||
    nexusLoading ||
    isWalletConnectPending ||
    walletStatus === "connecting";
  const hasConnectWalletHandler = Boolean(
    onConnectClick || onConnectWallet || connectors.length > 0
  );
  const walletCtaLabel = hasConnectWalletHandler
    ? walletConnectBusy
      ? "Connecting..."
      : "Connect Wallet"
    : "Connect your wallet to proceed";
  const isSwapCtaDisabled = needsWalletConnection
    ? !hasConnectWalletHandler || walletConnectBusy
    : !hasReadySwapQuoteInput ||
      receiveMaxCalculating ||
      quoteRefreshing ||
      Boolean(blockingQuoteIssue);
  const isDepositCtaDisabled = needsWalletConnection
    ? !hasConnectWalletHandler || walletConnectBusy
    : !hasPositiveRootAmount ||
      !toToken ||
      receiveMaxCalculating ||
      (!hasCurrentExactOutPaymentIntent &&
        (quoteRefreshing ||
          intentLoading ||
          isQuoteUnavailableForAutoSourceFlow)) ||
      Boolean(blockingQuoteIssue);
  const sendNeedsRecipient = activeMode === "send" && !recipientAddress;
  const isSendCtaDisabled = needsWalletConnection
    ? !hasConnectWalletHandler || walletConnectBusy
    : !hasPositiveRootAmount ||
      !toToken ||
      hasSameOwnerSendRecipient ||
      receiveMaxCalculating ||
      (!sendNeedsRecipient &&
        !hasCurrentExactOutPaymentIntent &&
        (quoteRefreshing ||
          intentLoading ||
          isQuoteUnavailableForAutoSourceFlow)) ||
      Boolean(blockingQuoteIssue);
  const quoteCtaLabel = (fallback: string) => {
    if (needsWalletConnection) return walletCtaLabel;
    if (insufficientSourceIssue) return "Insufficient balance";
    if (receiveAmountIssue) return receiveAmountIssue.ctaLabel;
    if (configuredAmountIssue) return configuredAmountIssue.ctaLabel;
    if (receiveMaxCalculating) return "Calculating...";
    if (!hasCurrentExactOutPaymentIntent && (quoteRefreshing || intentLoading)) {
      return "Fetching quotes...";
    }
    if (isQuoteUnavailableForAutoSourceFlow) return "Quote unavailable";
    if (!hasPositiveRootAmount) return "Enter amount";
    return fallback;
  };
  const sendCtaLabel = (() => {
    if (needsWalletConnection) return walletCtaLabel;
    if (insufficientSourceIssue) return "Insufficient balance";
    if (receiveAmountIssue) return receiveAmountIssue.ctaLabel;
    if (configuredAmountIssue) return configuredAmountIssue.ctaLabel;
    if (!hasPositiveRootAmount) return "Enter amount";
    if (!toToken) return "Select token";
    if (hasSameOwnerSendRecipient) return "Change recipient";
    if (sendNeedsRecipient) return "Add recipient";
    return quoteCtaLabel("Review send");
  })();
  const previewIntentSourceUsdNumber = (intentData?.sources ?? []).reduce(
    (sum, source) =>
      sum.plus(parseFiatNumber((source as any).value) ?? new Decimal(0)),
    new Decimal(0)
  );
  const previewSourceUsdNumber = previewIntentSourceUsdNumber.gt(0)
    ? previewIntentSourceUsdNumber
    : fromTokens.length > 0
      ? fromTokens.reduce(
          (sum, token) =>
            sum.plus(
              getTokenUsdValue(
                token,
                swapType === "exactIn" && fromTokens.length === 1
                  ? amount
                  : undefined
              )
            ),
          new Decimal(0)
        )
      : undefined;
  const previewExactOutDestinationAmount =
    activeMode === "deposit"
      ? depositTokenAmountForQuote
      : activeMode === "send"
        ? parseFiatNumber(amount)
        : undefined;
  const previewExactOutDestinationUsdNumber =
    activeMode === "deposit"
      ? depositUsdDecimal
      : activeMode === "send" && amount && toToken
        ? getTokenUsdValue(
            {
              ...toToken,
              userAmount: amount,
              userAmountMode: "token",
            },
            amount
          )
        : undefined;
  const previewDestinationUsdNumber =
    (activeMode === "deposit" || activeMode === "send") &&
    previewExactOutDestinationUsdNumber?.gt(0)
      ? previewExactOutDestinationUsdNumber
      : parseFiatNumber((intentData?.destination as any)?.value);
  const previewDestinationAmount =
    (activeMode === "deposit" || activeMode === "send") &&
    previewExactOutDestinationAmount?.gt(0)
      ? previewExactOutDestinationAmount
          .toDecimalPlaces(toToken?.decimals ?? 18, Decimal.ROUND_DOWN)
          .toFixed()
      : intentToAmount;
  const previewFromAmountUsd =
    previewSourceUsdNumber && previewSourceUsdNumber.gt(0)
      ? previewSourceUsdNumber.toDecimalPlaces(6).toFixed()
      : undefined;
  const previewToAmountUsd =
    previewDestinationUsdNumber && previewDestinationUsdNumber.gt(0)
      ? previewDestinationUsdNumber.toDecimalPlaces(6).toFixed()
      : undefined;
  const predictiveExactInQuote =
    predictiveQuote?.mode === "exactIn" &&
    predictiveQuote.key === getPredictiveQuoteCacheKey("swap", "exactIn")
      ? predictiveQuote
      : null;
  const predictiveExactOutQuote =
    predictiveQuote?.mode === "exactOut" &&
    predictiveQuote.key === getPredictiveQuoteCacheKey(activeMode, "exactOut")
      ? predictiveQuote
      : null;
  const resolvedToToken =
    toToken ??
    (activeMode === "deposit" && selectedOpportunity
      ? toTokenFromOpportunity(selectedOpportunity)
      : undefined);
  const toTokenWithFetchedBalance =
    resolvedToToken && destinationBalance
      ? { ...resolvedToToken, balance: destinationBalance }
      : resolvedToToken;
  const idleReceiveQuoteAmount =
    activeMode === "swap" && swapType === "exactIn"
      ? (intentToAmount ?? predictiveExactInQuote?.toAmount)
      : undefined;
  const idleReceiveQuoteUsd =
    activeMode === "swap" && swapType === "exactIn"
      ? (previewToAmountUsd ?? predictiveExactInQuote?.toUsd)
      : previewToAmountUsd;
  const exactOutDestinationCoverage = getExactOutDestinationBalanceCoverage({
    requestedAmount: previewExactOutDestinationAmount,
    requestedUsd: previewExactOutDestinationUsdNumber,
    producedAmount: hasIntentSources
      ? parseFiatNumber(intentData?.destination?.amount)
      : undefined,
    producedUsd: hasIntentSources
      ? parseFiatNumber(intentData?.destination?.value)
      : undefined,
    token: toTokenWithFetchedBalance,
  });
  const destinationBalanceDisplayToken = buildDestinationBalanceDisplayToken(
    exactOutDestinationCoverage,
    toTokenWithFetchedBalance
  );
  const shouldShowPredictiveExactOutDisplay =
    (activeMode === "deposit" || activeMode === "send") &&
    (quoteRefreshing || intentLoading) &&
    !hasIntentSources &&
    Boolean(
      predictiveExactOutQuote &&
        ((predictiveExactOutQuote.sources?.length ?? 0) > 0 ||
          destinationBalanceDisplayToken)
    );
  const baseDisplayFromTokens = shouldShowPredictiveExactOutDisplay
    ? (predictiveExactOutQuote?.sources ?? fromTokens)
    : fromTokens;
  const displayFromTokens = (() => {
    if (
      !destinationBalanceDisplayToken ||
      (activeMode !== "deposit" && activeMode !== "send")
    ) {
      return baseDisplayFromTokens;
    }

    const destinationKey = getTokenSelectionKey(destinationBalanceDisplayToken);
    let replacedEmptyDestinationToken = false;
    const tokens = baseDisplayFromTokens.map((token) => {
      const isDestinationToken = getTokenSelectionKey(token) === destinationKey;
      if (
        isDestinationToken &&
        !hasPositiveDecimalInput(token.userAmount) &&
        !hasPositiveDecimalInput(token.userAmountUsd)
      ) {
        replacedEmptyDestinationToken = true;
        return destinationBalanceDisplayToken;
      }
      return token;
    });

    return replacedEmptyDestinationToken
      ? tokens
      : [...tokens, destinationBalanceDisplayToken];
  })();
  const displayExactOutRouteLoading =
    isExactOutRouteLoading && !shouldShowPredictiveExactOutDisplay;
  const exactOutRequiredUsdDisplay =
    activeMode === "deposit"
      ? previewDestinationUsdNumber?.gt(0)
        ? previewDestinationUsdNumber.toDecimalPlaces(2).toFixed()
        : depositUsdDisplay
      : activeMode === "send" && sendAmountUsd > 0
        ? sendAmountUsd.toFixed(2)
        : undefined;
  const totalSwapBalanceUsd = getSwapBalanceTotalUsd()
    .toDecimalPlaces(2)
    .toFixed();
  const sendAmountUsd =
    amount && toToken
      ? getTokenUsdValue(
          {
            ...toToken,
            userAmount: amount,
            userAmountMode: "token",
          },
          amount
        ).toNumber()
      : 0;
  const isIdleSwapQuoteLoading =
    activeMode === "swap" &&
    swapStep === "idle" &&
    (quoteRefreshing || intentLoading);
  const isReceiveAmountLoading =
    receiveMaxCalculating ||
    (isIdleSwapQuoteLoading &&
      swapType === "exactIn" &&
      !idleReceiveQuoteAmount);
  const isReceiveUsdLoading =
    receiveMaxCalculating ||
    (isIdleSwapQuoteLoading && swapType === "exactIn" && !idleReceiveQuoteUsd);
  const hasQuoteRefreshCountdown =
    (activeMode === "swap" ||
      activeMode === "deposit" ||
      activeMode === "send") &&
    hasCurrentQuoteIntent &&
    (swapStep === "idle" || swapStep === "preview-intent");
  const isRecipientDrawerClosing = closingDrawerStep === "enter-recipient";
  const isSwapAssetDrawerClosing = closingDrawerStep === "choose-swap-asset";
  const isReceiveAssetDrawerClosing =
    closingDrawerStep === "choose-receive-asset";
  const isReceiveAssetPickerLocked =
    activeMode === "deposit"
      ? configuredDepositOptions.length <= 1
      : (config.allowedDestinationPairs?.length ?? 0) === 1;
  const hideDestinationTokenDropdownIcon =
    activeMode === "deposit"
      ? configuredDepositOptions.length === 1
      : (config.allowedDestinationPairs?.length ?? 0) === 1;
  const isTokenAssetDrawerActive =
    swapStep === "choose-swap-asset" ||
    swapStep === "choose-receive-asset" ||
    closingDrawerStep === "choose-swap-asset" ||
    closingDrawerStep === "choose-receive-asset";
  const configuredReceiveTokenCount =
    activeMode === "deposit" || activeMode === "send"
      ? Math.max(
          configuredDestinationTokenOptions.length,
          config.allowedDestinationPairs?.length ?? 0
        )
      : 0;
  const isConfiguredReceiveAssetDrawerActive =
    (activeMode === "deposit" || activeMode === "send") &&
    (swapStep === "choose-receive-asset" ||
      closingDrawerStep === "choose-receive-asset") &&
    Boolean(config.allowedDestinationPairs?.length);
  const tokenAssetDrawerMinRootContentHeight =
    isConfiguredReceiveAssetDrawerActive
      ? getConfiguredReceiveSelectorRootHeight(configuredReceiveTokenCount)
      : isTokenAssetDrawerActive
        ? TOKEN_SELECTOR_MIN_ROOT_CONTENT_HEIGHT
        : 0;
  const isDrawerOverlayActive =
    swapStep === "choose-swap-asset" ||
    swapStep === "choose-receive-asset" ||
    swapStep === "enter-recipient" ||
    closingDrawerStep !== null;
  const displayedRootContentHeight =
    hasMeasuredRootContent && rootContentHeight
      ? Math.max(
          rootContentHeight,
          tokenAssetDrawerMinRootContentHeight
        )
      : null;

  const widgetContent = (
    <div
      className={className}
      data-nexus-widget-root
      style={{
        ["--nexus-widget-primary" as any]:
          primaryColor ?? NEXUS_WIDGET_DEFAULT_PRIMARY_COLOR,
        ["--nexus-widget-primary-foreground" as any]:
          primaryButtonForeground,
        ["--foreground-brand" as any]:
          primaryColor ?? NEXUS_WIDGET_DEFAULT_PRIMARY_COLOR,
        ["--interactive-button-primary-background" as any]:
          primaryColor ?? NEXUS_WIDGET_DEFAULT_PRIMARY_COLOR,
        ["--interactive-button-primary-foreground" as any]:
          primaryButtonForeground,
        backgroundColor: "#F9F9F8",
        backgroundImage:
          "url(https://files.availproject.org/nexus-elements/nexus-one/card-bg.png)",
        backgroundPosition: "center",
        backgroundPositionX: "center",
        backgroundPositionY: "center",
        backgroundSize: "cover",
        borderRadius: "20px",
        boxShadow: "none",
        boxSizing: "border-box",
        colorScheme:
          appearanceConfig?.themeMode === "dark"
            ? "dark"
            : appearanceConfig?.themeMode === "light"
              ? "light"
              : undefined,
        display: "flex",
        flexDirection: "column",
        fontFeatureSettings: '"tnum"',
        fontSize: "12px",
        fontSynthesis: "none",
        fontVariantNumeric: "tabular-nums",
        gap: "16px",
        height:
          displayedRootContentHeight
            ? `${displayedRootContentHeight + 32}px`
            : "fit-content",
        maxHeight: "90dvh",
        lineHeight: "17px",
        margin: "auto",
        overflowX: "hidden",
        overflowY: isDrawerOverlayActive ? "hidden" : "auto",
        overscrollBehavior: isDrawerOverlayActive ? "contain" : "auto",
        padding: "16px",
        scrollbarColor: `${theme.colors.textEmpty} transparent`,
        scrollbarWidth: "thin",
        position: "relative",
        transition: (() => {
          const transitions = [];
          if (hasMeasuredRootContent && shouldAnimateRootHeight) {
            transitions.push(`height ${ROOT_HEIGHT_TRANSITION_MS}ms ease-out`);
          }
          return transitions.join(", ");
        })(),
        willChange: "height",
        width: "450px",
        maxWidth: "100%",
        minWidth: "320px",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <div
        ref={rootContentRef}
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          gap: "16px",
          minHeight: 0,
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            boxSizing: "border-box",
            display: "flex",
            flexShrink: 0,
            justifyContent: "space-between",
            padding: 0,
            width: "100%",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div className="flex items-center gap-x-2">
            {canGoBack && (
              <button
                aria-label="Back"
                onClick={handleBack}
                style={{
                  alignItems: "center",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  padding: "4px",
                  marginRight: "4px",
                }}
              >
                <ArrowLeft
                  className="w-5 h-5"
                  style={{ color: theme.colors.textStrong }}
                />
              </button>
            )}
            <div
              style={{
                boxSizing: "border-box",
                color: theme.colors.text,
                ...theme.typography.headingPanel,
              }}
            >
              {getTitle()}
            </div>

            {/* Sub-screen asset counts */}
            {!isTitleCentered() &&
              activeMode === "swap" &&
              swapStep === "choose-swap-asset" &&
              swapType === "exactIn" && (
                <span
                  style={{
                    color: theme.colors.muted,
                    fontFamily: theme.fonts.sans,
                    fontSize: "14px",
                    marginLeft: "7px",
                  }}
                >
                  {fromTokens.length} asset(s) selected
                </span>
              )}
          </div>

          {/* Right side icons */}
          <div
            style={{
              alignItems: "center",
              boxSizing: "border-box",
              display: "flex",
              gap: "9px",
            }}
          >
            {hasQuoteRefreshCountdown && (
              <QuoteRefreshCountdown
                isRefreshing={quoteRefreshing || previewQuoteRefreshing}
                progress={quoteRefreshProgress}
                secondsRemaining={quoteRefreshSecondsRemaining}
              />
            )}
            <button
              onClick={() => setSwapStep("history")}
              style={{
                alignItems: "center",
                backgroundColor: theme.primitives.iconButton.backgroundColor,
                borderColor: theme.primitives.iconButton.borderColor,
                borderRadius: theme.radius.iconButton,
                borderStyle: "solid",
                borderWidth: "1px",
                boxShadow: theme.primitives.iconButton.boxShadow,
                boxSizing: "border-box",
                display: "flex",
                flexShrink: 0,
                height: "28px",
                justifyContent: "center",
                width: "28px",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <svg
                fill="none"
                height="14"
                style={{ width: "14px", height: "14px", flexShrink: 0 }}
                viewBox="0 0 16 16"
                width="14"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 4V8L10.5 9.5"
                  stroke={theme.colors.textStrong}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.4"
                />
                <path
                  d="M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C10.196 2 12.117 3.179 13.163 4.936"
                  stroke={theme.colors.textStrong}
                  strokeLinecap="round"
                  strokeWidth="1.4"
                />
                <path
                  d="M13.5 2V5H10.5"
                  stroke={theme.colors.textStrong}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.4"
                />
              </svg>
            </button>
            {showCloseButton && (
              <button
                aria-label="Close"
                onClick={handleClose}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.primitives.iconButton.backgroundColor,
                  borderColor: theme.primitives.iconButton.borderColor,
                  borderRadius: theme.radius.iconButton,
                  borderStyle: "solid",
                  borderWidth: "1px",
                  boxShadow: theme.primitives.iconButton.boxShadow,
                  boxSizing: "border-box",
                  cursor: "pointer",
                  display: "flex",
                  flexShrink: 0,
                  height: "28px",
                  justifyContent: "center",
                  padding: 0,
                  width: "28px",
                }}
              >
                <svg
                  fill="none"
                  height="14"
                  style={{ width: "14px", height: "14px", flexShrink: 0 }}
                  viewBox="0 0 16 16"
                  width="14"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 4L12 12M12 4L4 12"
                    stroke={theme.colors.textStrong}
                    strokeLinecap="round"
                    strokeWidth="1.4"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Main content area */}
        {/* ------------------------------------------------------------------ */}
        <div
          style={{
            boxSizing: "border-box",
            display: "flex",
            flex: 1,
            flexDirection: "column",
            gap: "7px",
            minHeight: 0,
            padding: 0,
            width: "100%",
          }}
        >
          {/* =============================================================== */}
          {/* SHARED SUB-SCREENS (non-drawer panels)                        */}
          {/* =============================================================== */}
          {(activeMode === "swap" ||
            activeMode === "send" ||
            activeMode === "deposit") &&
            swapStep !== "idle" &&
            swapStep !== "choose-swap-asset" &&
            swapStep !== "choose-receive-asset" &&
            swapStep !== "enter-recipient" && (
              <>
                {/* Panel: preview. */}
                {swapStep === "preview-intent" && (
                  <div
                    className="w-full"
                    style={{
                      maxHeight: "calc(90dvh - 66px)",
                      minHeight: 0,
                      overflowX: "hidden",
                      overflowY: isPreviewTransitioning ? "hidden" : "auto",
                      overscrollBehavior: "contain",
                      scrollbarColor: "#C8C8C7 transparent",
                      scrollbarWidth: "thin",
                      width: "100%",
                    }}
                  >
                    <SwapIntentPreview
                      activeMode={activeMode}
                      estimatedTime="10s"
                      explorerUrls={explorerUrls}
                      fromAmount={amount}
                      fromAmountUsd={previewFromAmountUsd}
                      fromToken={fromTokens[0]}
                      fromTokens={fromTokens}
                      intentData={intentData}
                      isLoading={intentLoading}
                      isRefreshing={previewQuoteRefreshing}
                      mode={activeMode}
                      onAccept={handleSwapAccept}
                      onReject={() => {
                        clearPendingSwapIntent();
                        setSwapStep("idle");
                      }}
                      onTransitionChange={setIsPreviewTransitioning}
                      opportunity={selectedOpportunity}
                      recipientAddress={transferRecipientAddress}
                      steps={steps}
                      supportedTokenAssets={supportedChainsAndTokens}
                      swapBalances={swapBalance}
                      swapType={swapType}
                      toAmount={previewDestinationAmount}
                      toAmountTokens={
                        previewDestinationAmount
                          ? `${previewDestinationAmount}`
                          : undefined
                      }
                      toAmountUsd={previewToAmountUsd}
                      toToken={toTokenWithFetchedBalance}
                      totalFeeUsd={intentFeeUsd}
                    />
                  </div>
                )}

                {swapStep === "progress" && (
                  <NexusWidgetProgressScreen
                    failedStep={failedProgressStep}
                    fromAmountUsd={previewFromAmountUsd}
                    fromTokens={fromTokens}
                    intentData={intentData}
                    mode={activeMode}
                    opportunity={selectedOpportunity}
                    progressEvents={progressEvents}
                    recipientAddress={transferRecipientAddress}
                    steps={steps}
                    toAmount={previewDestinationAmount}
                    toAmountUsd={previewToAmountUsd}
                    toToken={toTokenWithFetchedBalance}
                  />
                )}

                {(swapStep === "success" || swapStep === "failed") &&
                  currentSwapEntry && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                      <SwapReceiptPanel
                        entry={currentSwapEntry}
                        onDone={
                          swapStep === "failed"
                            ? handleFailureBack
                            : handleReset
                        }
                      />
                    </div>
                  )}
              </>
            )}

          {/* =============================================================== */}
          {/* HISTORY SCREEN                                                   */}
          {/* =============================================================== */}
          {swapStep === "history" && (
            <SwapHistoryPanel entries={swapHistory} now={historyNow} />
          )}

          {/* =============================================================== */}
          {/* SWAP IDLE SCREEN                                                 */}
          {/* =============================================================== */}
          {activeMode === "swap" &&
            [
              "idle",
              "choose-swap-asset",
              "choose-receive-asset",
              "enter-recipient",
            ].includes(swapStep) && (
              <>
                <SwapIdleForm
                  amount={amount}
                  defaultRecipientAddress={defaultRecipientAddress}
                  fromTokens={fromTokens}
                  isReceiveAmountLoading={isReceiveAmountLoading}
                  isReceiveUsdLoading={isReceiveUsdLoading}
                  isAmountReadOnly={isConfiguredAmountFixed}
                  isDestinationPickerDisabled={isReceiveAssetPickerLocked}
                  hideDestinationTokenDropdownIcon={
                    hideDestinationTokenDropdownIcon
                  }
                  onAmountChange={(val, panel) => {
                    handleSwapAmountChange(val, panel);
                  }}
                  onOpenDestPicker={() =>
                    openDrawerStep("choose-receive-asset")
                  }
                  onOpenRecipientPicker={handleOpenRecipientEditor}
                  onOpenSourcePicker={(index) => {
                    if (needsWalletConnection) {
                      void handleConnectWallet();
                      return;
                    }
                    setEditingAssetIndex(index ?? null);
                    openDrawerStep("choose-swap-asset");
                  }}
                  onUpdateTokens={handleSwapTokensUpdate}
                  receiveQuoteAmount={
                    swapType === "exactIn" ? idleReceiveQuoteAmount : undefined
                  }
                  receiveQuoteUsd={idleReceiveQuoteUsd}
                  recipientAddress={effectiveRecipientAddress}
                  sourceRouteMessage={insufficientSourceIssue?.message}
                  sourceRouteStatus={
                    insufficientSourceIssue
                      ? "insufficient"
                      : isExactOutRouteLoading
                        ? "loading"
                        : undefined
                  }
                  swapType={swapType}
                  toToken={toTokenWithFetchedBalance}
                  totalBalance={totalSwapBalanceUsd}
                  usdValue={amount && usdValue > 0 ? usdValue.toFixed(2) : ""}
                />

                {receiveAmountIssue && (
                  <StatusAlert
                    message={receiveAmountIssue.message}
                    type="error"
                  />
                )}

                {configuredAmountIssue && (
                  <StatusAlert
                    message={configuredAmountIssue.message}
                    type="error"
                  />
                )}

                {txError && !blockingQuoteIssue && (
                  <StatusAlert message={txError} type="error" />
                )}

                {/* CTA Button */}
                <div
                  style={{
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <button
                    disabled={isSwapCtaDisabled}
                    onClick={() => {
                      if (needsWalletConnection) {
                        void handleConnectWallet();
                        return;
                      }
                      void handleEnterPreview();
                    }}
                    style={{
                      alignItems: "center",
                      backgroundColor: blockingQuoteIssue
                        ? "#FCEEED"
                        : isSwapCtaDisabled
                          ? theme.colors.surfaceCool
                          : primaryButtonBackground,
                      border: blockingQuoteIssue ? "1px solid #F7C4C1" : "none",
                      borderRadius: theme.radius.primaryButton,
                      boxShadow:
                        blockingQuoteIssue || isSwapCtaDisabled
                          ? "none"
                          : theme.shadows.primaryButton,
                      boxSizing: "border-box",
                      display: "flex",
                      flexShrink: 0,
                      gap: "7px",
                      height: "42px",
                      justifyContent: "center",
                      marginTop: "8px",
                      paddingInline: "16px",
                      cursor: isSwapCtaDisabled ? "default" : "pointer",
                      width: "100%",
                    }}
                  >
                    {blockingQuoteIssue ? (
                      <AlertCircle
                        style={{
                          color: "#D32F2F",
                          height: "14px",
                          width: "14px",
                        }}
                      />
                    ) : (needsWalletConnection && walletConnectBusy) ||
                      quoteRefreshing ||
                      receiveMaxCalculating ? (
                      <Loader2
                        className="animate-spin"
                        style={{
                          color: isSwapCtaDisabled
                            ? theme.colors.muted
                            : primaryButtonForeground,
                          height: "14px",
                          width: "14px",
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        boxSizing: "border-box",
                        color: blockingQuoteIssue
                          ? "#D32F2F"
                          : isSwapCtaDisabled
                            ? theme.colors.muted
                            : primaryButtonForeground,
                        fontFamily: theme.fonts.sans,
                        fontSize: blockingQuoteIssue ? "13px" : "14px",
                        fontWeight: 500,
                        letterSpacing: "0",
                        lineHeight: blockingQuoteIssue ? "17px" : "19px",
                      }}
                    >
                      {needsWalletConnection
                        ? walletCtaLabel
                        : fromTokens.length === 0
                          ? "Add Assets to Bridge"
                          : quoteCtaLabel("Review swap")}
                    </div>
                  </button>
                </div>
              </>
            )}

          {/* =============================================================== */}
          {/* DEPOSIT MODE LAYOUT                                              */}
          {/* =============================================================== */}
          {activeMode === "deposit" &&
            [
              "idle",
              "choose-swap-asset",
              "choose-receive-asset",
              "enter-recipient",
            ].includes(swapStep) && (
              <>
                {selectedOpportunity && (
                  <>
                    <DepositIdleForm
                      amount={amount}
                      amountMode={depositAmountMode}
                      calculatingPercent={maxCalculationPercent}
                      fromTokens={displayFromTokens}
                      isAmountReadOnly={isConfiguredAmountFixed}
                      isCalculatingMax={receiveMaxCalculating}
                      isQuoteRefreshing={
                        !hasCurrentExactOutPaymentIntent &&
                        (quoteRefreshing || intentLoading)
                      }
                      onAmountChange={handleDepositAmountChange}
                      onAmountModeToggle={handleDepositAmountModeToggle}
                      onOpenSourcePicker={() => {
                        if (needsWalletConnection) {
                          void handleConnectWallet();
                          return;
                        }
                        openDrawerStep("choose-swap-asset");
                      }}
                      onOpenTokenPicker={() =>
                        openDrawerStep("choose-receive-asset")
                      }
                      onSetPercent={handleDepositPercentSelect}
                      routeMessage={insufficientSourceIssue?.message}
                      routeStatus={
                        insufficientSourceIssue
                          ? "insufficient"
                          : displayExactOutRouteLoading
                            ? "loading"
                            : undefined
                      }
                      showAutoBadge={!sourceSelectionTouched}
                      isTokenPickerDisabled={isReceiveAssetPickerLocked}
                      hideDestinationTokenDropdownIcon={
                        hideDestinationTokenDropdownIcon
                      }
                      tokenValue={depositTokenDisplay}
                      toToken={toTokenWithFetchedBalance}
                      totalBalance={totalSwapBalanceUsd}
                      usdValue={depositUsdDisplay}
                    />

                    {receiveAmountIssue && (
                      <StatusAlert
                        message={receiveAmountIssue.message}
                        type="error"
                      />
                    )}

                    {configuredAmountIssue && (
                      <StatusAlert
                        message={configuredAmountIssue.message}
                        type="error"
                      />
                    )}

                    {txError && !blockingQuoteIssue && (
                      <StatusAlert message={txError} type="error" />
                    )}

                    <div
                      style={{
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <button
                        disabled={isDepositCtaDisabled}
                        onClick={() => {
                          if (needsWalletConnection) {
                            void handleConnectWallet();
                            return;
                          }
                          void handleEnterPreview();
                        }}
                        style={{
                          alignItems: "center",
                          backgroundColor: blockingQuoteIssue
                            ? "#FCEEED"
                            : isDepositCtaDisabled
                              ? theme.colors.surfaceCool
                              : primaryButtonBackground,
                          border: blockingQuoteIssue
                            ? "1px solid #F7C4C1"
                            : "none",
                          borderRadius: blockingQuoteIssue
                            ? "4px"
                            : theme.radius.primaryButton,
                          boxShadow:
                            blockingQuoteIssue || isDepositCtaDisabled
                              ? "none"
                              : theme.shadows.primaryButton,
                          boxSizing: "border-box",
                          display: "flex",
                          flexShrink: 0,
                          gap: "7px",
                          height: "40px",
                          justifyContent: "center",
                          paddingInline: "16px",
                          cursor: isDepositCtaDisabled ? "default" : "pointer",
                          width: "100%",
                        }}
                      >
                        {blockingQuoteIssue ? (
                          <AlertCircle
                            style={{
                              color: "#D32F2F",
                              height: "14px",
                              width: "14px",
                            }}
                          />
                        ) : (needsWalletConnection && walletConnectBusy) ||
                          (!hasCurrentExactOutPaymentIntent &&
                            (quoteRefreshing || intentLoading)) ||
                          receiveMaxCalculating ? (
                          <Loader2
                            className="animate-spin"
                            style={{
                              color: isDepositCtaDisabled
                                ? theme.colors.muted
                                : primaryButtonForeground,
                              height: "14px",
                              width: "14px",
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            boxSizing: "border-box",
                            color: blockingQuoteIssue
                              ? "#D32F2F"
                              : isDepositCtaDisabled
                                ? theme.colors.muted
                                : primaryButtonForeground,
                            fontFamily: theme.fonts.sans,
                            fontSize: blockingQuoteIssue ? "13px" : "14px",
                            fontWeight: 500,
                            lineHeight: "21px",
                          }}
                        >
                          {quoteCtaLabel("Review deposit")}
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

          {/* =============================================================== */}
          {/* SEND MODE — recipient first, then amount, then asset         */}
          {/* =============================================================== */}
          {activeMode === "send" &&
            [
              "idle",
              "choose-swap-asset",
              "choose-receive-asset",
              "enter-recipient",
            ].includes(swapStep) && (
              <>
                <SendIdleForm
                  amount={amount}
                  calculatingPercent={maxCalculationPercent}
                  fromTokens={displayFromTokens}
                  isAmountReadOnly={isConfiguredAmountFixed}
                  isAssetPickerDisabled={isReceiveAssetPickerLocked}
                  hideDestinationTokenDropdownIcon={
                    hideDestinationTokenDropdownIcon
                  }
                  isCalculatingMax={receiveMaxCalculating}
                  isQuoteRefreshing={
                    !hasCurrentExactOutPaymentIntent &&
                    (quoteRefreshing || intentLoading)
                  }
                  onAmountChange={handleSendAmountChange}
                  onOpenAssetPicker={() =>
                    openDrawerStep("choose-receive-asset")
                  }
                  isRecipientLocked={isConfiguredRecipientLocked}
                  onOpenRecipientPicker={
                    isConfiguredRecipientLocked
                      ? () => undefined
                      : handleOpenRecipientEditor
                  }
                  onOpenSourcePicker={() => {
                    if (needsWalletConnection) {
                      void handleConnectWallet();
                      return;
                    }
                    setEditingAssetIndex(null);
                    openDrawerStep("choose-swap-asset");
                  }}
                  onSetPercent={handleSendPercentSelect}
                  recipientAddress={recipientAddress || ""}
                  routeMessage={insufficientSourceIssue?.message}
                  routeStatus={
                    insufficientSourceIssue
                      ? "insufficient"
                      : displayExactOutRouteLoading
                        ? "loading"
                        : undefined
                  }
                  showAutoBadge={!sourceSelectionTouched}
                  toToken={toTokenWithFetchedBalance}
                  totalBalance={totalSwapBalanceUsd}
                  usdValue={
                    amount && sendAmountUsd > 0 ? sendAmountUsd.toFixed(2) : ""
                  }
                />

                {receiveAmountIssue && (
                  <StatusAlert
                    message={receiveAmountIssue.message}
                    type="error"
                  />
                )}

                {configuredAmountIssue && (
                  <StatusAlert
                    message={configuredAmountIssue.message}
                    type="error"
                  />
                )}

                {txError && !blockingQuoteIssue && (
                  <StatusAlert message={txError} type="error" />
                )}

                <div
                  style={{
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <button
                    disabled={isSendCtaDisabled}
                    onClick={() => {
                      if (needsWalletConnection) {
                        void handleConnectWallet();
                        return;
                      }
                      if (sendNeedsRecipient) {
                        handleOpenRecipientEditor();
                        return;
                      }
                      void handleEnterPreview();
                    }}
                    style={{
                      alignItems: "center",
                      backgroundColor: blockingQuoteIssue
                        ? "#FCEEED"
                        : isSendCtaDisabled
                          ? theme.colors.surfaceCool
                          : primaryButtonBackground,
                      border: blockingQuoteIssue ? "1px solid #F7C4C1" : "none",
                      borderRadius: blockingQuoteIssue
                        ? "4px"
                        : theme.radius.primaryButton,
                      boxShadow:
                        blockingQuoteIssue || isSendCtaDisabled
                          ? "none"
                          : theme.shadows.primaryButton,
                      boxSizing: "border-box",
                      display: "flex",
                      flexShrink: 0,
                      gap: "7px",
                      height: "40px",
                      justifyContent: "center",
                      paddingInline: "16px",
                      cursor: isSendCtaDisabled ? "default" : "pointer",
                      width: "100%",
                    }}
                  >
                    {blockingQuoteIssue ? (
                      <AlertCircle
                        style={{
                          color: "#D32F2F",
                          height: "14px",
                          width: "14px",
                        }}
                      />
                    ) : (needsWalletConnection && walletConnectBusy) ||
                      (!sendNeedsRecipient &&
                        ((!hasCurrentExactOutPaymentIntent &&
                          (quoteRefreshing || intentLoading)) ||
                          receiveMaxCalculating)) ? (
                      <Loader2
                        className="animate-spin"
                        style={{
                          color: isSendCtaDisabled
                            ? theme.colors.muted
                            : primaryButtonForeground,
                          height: "14px",
                          width: "14px",
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        boxSizing: "border-box",
                        color: blockingQuoteIssue
                          ? "#D32F2F"
                          : isSendCtaDisabled
                            ? theme.colors.muted
                            : primaryButtonForeground,
                        fontFamily: theme.fonts.sans,
                        fontSize: blockingQuoteIssue ? "13px" : "14px",
                        fontWeight: 500,
                        lineHeight: "21px",
                      }}
                    >
                      {sendCtaLabel}
                    </div>
                  </button>
                </div>
              </>
            )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* DRAWER PANELS — rendered as direct children of root widget          */}
      {/* so they overlay the main page as bottom drawers                     */}
      {/* ================================================================== */}

      {/* Drawer: enter-recipient */}
      {(activeMode === "swap" ||
        activeMode === "send" ||
        activeMode === "deposit") &&
        swapStep === "enter-recipient" && (
          <div
            style={{
              height: "100%",
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div
              onClick={() => {
                setTxError(null);
                closeDrawerToIdle();
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.35)",
                pointerEvents: "auto",
                opacity: isRecipientDrawerClosing ? 0 : 1,
                transition: `opacity ${DRAWER_CLOSE_MS}ms ease`,
              }}
            />
            <div
              className={
                isRecipientDrawerClosing
                  ? undefined
                  : "animate-in slide-in-from-bottom-full duration-300"
              }
              data-nexus-widget-sheet
              style={{
                ...modalHeightTransitionStyle,
                bottom: 0,
                height: "auto",
                left: 0,
                maxHeight: "90%",
                position: "absolute",
                right: 0,
                width: "100%",
                backgroundColor: theme.colors.surface,
                borderRadius: "16px 16px 0 0",
                display: "flex",
                flexDirection: "column",
                pointerEvents: "auto",
                boxShadow: theme.shadows.sheet,
                boxSizing: "border-box",
                overflowY: "auto",
                padding: "12px 16px 16px",
                opacity: isRecipientDrawerClosing ? 0 : 1,
                transform: isRecipientDrawerClosing
                  ? "translateY(100%)"
                  : "translateY(0)",
                transition: `${modalHeightTransition}, transform ${DRAWER_CLOSE_MS}ms ease, opacity ${DRAWER_CLOSE_MS}ms ease`,
                willChange: "height, max-height, transform, opacity",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "12px",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    backgroundColor: theme.colors.divider,
                    borderRadius: "999px",
                    height: "4px",
                    width: "32px",
                  }}
                />
              </div>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: "12px",
                  paddingBottom: "14px",
                }}
              >
                <button
                  aria-label="Back"
                  onClick={() => {
                    setTxError(null);
                    closeDrawerToIdle();
                  }}
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    flexShrink: 0,
                    height: "32px",
                    justifyContent: "center",
                    padding: 0,
                    width: "32px",
                  }}
                  type="button"
                >
                  <ArrowLeft
                    style={{
                      color: theme.colors.textStrong,
                      height: "16px",
                      width: "16px",
                    }}
                  />
                </button>
                <div
                  style={{
                    color: theme.colors.textStrong,
                    fontFamily: theme.fonts.display,
                    fontSize: "20px",
                    fontWeight: 500,
                    lineHeight: "24px",
                  }}
                >
                  Recipient
                </div>
              </div>
              <div
                style={{
                  backgroundColor: theme.colors.border,
                  height: "1px",
                  marginBottom: "16px",
                  width: "100%",
                }}
              />
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    color: theme.colors.muted,
                    fontFamily: theme.fonts.sans,
                    fontSize: "15px",
                    fontWeight: 500,
                    lineHeight: "20px",
                  }}
                >
                  Wallet Address
                </div>
                {activeMode === "swap" && defaultRecipientAddress && (
                  <button
                    onClick={handleResetRecipientToDefault}
                    style={{
                      backgroundColor: "#F4F7FE",
                      border: "none",
                      borderRadius: "4px",
                      color: theme.colors.primary,
                      cursor: "pointer",
                      fontFamily: theme.fonts.sans,
                      fontSize: "14px",
                      fontWeight: 500,
                      lineHeight: "18px",
                      padding: "8px 12px",
                    }}
                    type="button"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <RecipientInput
                hasError={Boolean(txError)}
                label={null}
                onChange={(next) => {
                  setRecipientAddress(next);
                  if (txError) setTxError(null);
                }}
                onClear={() => setRecipientAddress("")}
                placeholder="Wallet address"
                value={recipientAddress}
              />
              {txError && (
                <div
                  style={{
                    color: "#E35454",
                    fontFamily: theme.fonts.sans,
                    fontSize: "15px",
                    fontWeight: 500,
                    lineHeight: "20px",
                    marginTop: "10px",
                  }}
                >
                  {txError}
                </div>
              )}
              {activeMode === "send" && (
                <div
                  style={{
                    color: theme.colors.textSubtle,
                    fontFamily: theme.fonts.sans,
                    fontSize: "15px",
                    lineHeight: "20px",
                    marginTop: "10px",
                  }}
                >
                  Recipient must be different from the connected wallet.
                </div>
              )}
              <button
                onClick={handleSaveRecipient}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.colors.text,
                  border: "none",
                  borderRadius: "8px",
                  boxShadow: "#5555550D 0px 1px 4px",
                  color: theme.colors.surface,
                  cursor: "pointer",
                  display: "flex",
                  fontFamily: theme.fonts.sans,
                  fontSize: "16px",
                  fontWeight: 500,
                  height: "43px",
                  justifyContent: "center",
                  marginTop: "22px",
                  width: "100%",
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}

      {/* Drawer: choose-swap-asset */}
      {(activeMode === "swap" ||
        activeMode === "send" ||
        activeMode === "deposit") &&
        swapStep === "choose-swap-asset" && (
          <div
            style={{
              height: "100%",
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div
              onClick={closeDrawerToIdle}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(255,255,255,0.46)",
                pointerEvents: "auto",
                opacity: isSwapAssetDrawerClosing ? 0 : 1,
                transition: `opacity ${DRAWER_CLOSE_MS}ms ease`,
              }}
            />
            <div
              className={
                isSwapAssetDrawerClosing
                  ? undefined
                  : "animate-in slide-in-from-bottom-full duration-300"
              }
              data-nexus-widget-sheet
              style={{
                ...modalHeightTransitionStyle,
                bottom: 0,
                height: ASSET_SELECTOR_DRAWER_HEIGHT,
                left: 0,
                maxHeight: ASSET_SELECTOR_DRAWER_HEIGHT,
                minHeight: ASSET_SELECTOR_DRAWER_HEIGHT,
                position: "absolute",
                right: 0,
                width: "100%",
                backgroundColor: theme.colors.surface,
                borderRadius: "12px 12px 0 0",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "auto",
                boxShadow: theme.shadows.sheet,
                boxSizing: "border-box",
                opacity: isSwapAssetDrawerClosing ? 0 : 1,
                transform: isSwapAssetDrawerClosing
                  ? "translateY(100%)"
                  : "translateY(0)",
                transition: `${modalHeightTransition}, transform ${DRAWER_CLOSE_MS}ms ease, opacity ${DRAWER_CLOSE_MS}ms ease`,
                willChange: "height, max-height, transform, opacity",
              }}
            >
              <SwapAssetSelector
                allowSelectedTokenRemoval={false}
                allowUnified={
                  activeMode === "deposit" ||
                  activeMode === "send" ||
                  activeMode === "swap"
                }
                autoSelectFilterTabs={
                  activeMode === "deposit" || activeMode === "send"
                }
                editingAssetIndex={editingAssetIndex}
                filterTabBehavior={
                  activeMode === "deposit" ? "source-pool" : "select-all"
                }
                hideCustomTab={activeMode === "swap"}
                isMulti={activeMode === "deposit" || activeMode === "send"}
                lockedTokens={lockedDestinationSourceTokens}
                onBack={closeDrawerToIdle}
                onClearSelection={
                  activeMode === "deposit" || activeMode === "send"
                    ? () => {
                        setSourceSelectionTouched(true);
                        setExactOutQuoteSourceModeValue("selected");
                        if (activeMode === "deposit") {
                          setDepositSourceFilter("custom");
                        }
                        invalidateExactOutQuoteForRefresh();
                        setSourceSelectionRevision((current) => current + 1);
                        setFromTokens((current) =>
                          current.length === 0 ? current : []
                        );
                      }
                    : undefined
                }
                onDone={closeDrawerToIdle}
                onFilterTabSelect={
                  activeMode === "deposit"
                    ? (tab) => {
                        const nextFilter: DepositSourceFilter =
                          tab === "stables" ? "stablecoins" : tab;
                        setDepositSourceFilter(nextFilter);
                        setSourceSelectionTouched(false);
                        setExactOutQuoteSourceModeValue("all");
                        invalidateExactOutQuoteForRefresh();
                        setSourceSelectionRevision((current) => current + 1);
                        const selection = getResolvedDepositSourceSelection({
                          filter: nextFilter,
                          isManualSelection: false,
                        });
                        setFromTokens(
                          getDepositSourceTokensForIds(
                            selection.selectedSourceIds
                          )
                        );
                      }
                    : undefined
                }
                onSelect={(token) => {
                  if (activeMode === "swap") {
                    const next = [...fromTokens];
                    const targetIndex =
                      editingAssetIndex !== null &&
                      editingAssetIndex < next.length
                        ? editingAssetIndex
                        : null;
                    const existingToken =
                      targetIndex !== null ? next[targetIndex] : undefined;
                    const tokenChanged = !isSameTokenSelection(
                      existingToken,
                      token
                    );
                    const preservedAmount = tokenChanged
                      ? ""
                      : existingToken?.userAmount ||
                        (targetIndex === 0 ? amount : "");
                    const newToken = {
                      ...token,
                      userAmount: preservedAmount,
                    };

                    if (targetIndex !== null) {
                      next[targetIndex] = newToken;
                    } else {
                      next.push(newToken);
                    }

                    if (tokenChanged) {
                      clearPendingSwapIntent();
                      setAmount(getSourceAmountInput(next));
                    }
                    if (swapType !== "exactIn") {
                      setSwapType("exactIn");
                    }
                    setFromTokens(next);
                    closeDrawerToIdle();
                  } else if (
                    activeMode === "deposit" ||
                    activeMode === "send"
                  ) {
                    setSourceSelectionTouched(true);
                    setExactOutQuoteSourceModeValue("selected");
                    if (activeMode === "deposit") {
                      setDepositSourceFilter("custom");
                    }
                    invalidateExactOutQuoteForRefresh();
                    setSourceSelectionRevision((current) => current + 1);
                    setFromTokens([{ ...token, userAmount: amount }]);
                    closeDrawerToIdle();
                  }
                }}
                onSelectionChange={
                  activeMode === "deposit" || activeMode === "send"
                    ? (tokens) => {
                        setSourceSelectionTouched(true);
                        setExactOutQuoteSourceModeValue("selected");
                        if (activeMode === "deposit") {
                          setDepositSourceFilter("custom");
                        }
                        invalidateExactOutQuoteForRefresh();
                        setSourceSelectionRevision((current) => current + 1);
                        setFromTokens(
                          tokens.map((token) => ({
                            ...token,
                            userAmount: "",
                          }))
                        );
                      }
                    : undefined
                }
                onToggle={(token) => {
                  if (activeMode === "deposit" || activeMode === "send") {
                    setSourceSelectionTouched(true);
                    setExactOutQuoteSourceModeValue("selected");
                    if (activeMode === "deposit") {
                      setDepositSourceFilter("custom");
                    }
                    invalidateExactOutQuoteForRefresh();
                    setSourceSelectionRevision((current) => current + 1);
                  } else {
                    clearPendingSwapIntent();
                  }
                  setFromTokens((prev) => {
                    const isSameSelection = (
                      a: SwapTokenOption,
                      b: SwapTokenOption
                    ) => {
                      if (a.isUnified || b.isUnified) {
                        return Boolean(
                          a.isUnified &&
                            b.isUnified &&
                            a.unifiedSymbol === b.unifiedSymbol
                        );
                      }
                      return (
                        a.contractAddress.toLowerCase() ===
                          b.contractAddress.toLowerCase() &&
                        a.chainId === b.chainId
                      );
                    };
                    const isDepositOrSendSourcePicker =
                      activeMode === "deposit" || activeMode === "send";
                    const sourceTokens = token.sourceTokens ?? [];
                    const isSameUnifiedGroup = (item: SwapTokenOption) =>
                      Boolean(
                        item.isUnified &&
                          token.isUnified &&
                          item.unifiedSymbol === token.unifiedSymbol
                      );
                    const withDefaultAmount = (item: SwapTokenOption) => ({
                      ...item,
                      userAmount:
                        activeMode === "swap" && prev.length === 0
                          ? amount
                          : "",
                    });

                    if (
                      isDepositOrSendSourcePicker &&
                      token.isUnified &&
                      sourceTokens.length > 0
                    ) {
                      const hasUnifiedSelection = prev.some(isSameUnifiedGroup);
                      const areAllChildrenSelected = sourceTokens.every(
                        (source) =>
                          prev.some((item) => isSameSelection(item, source))
                      );
                      const withoutGroup = prev.filter(
                        (item) =>
                          !isSameUnifiedGroup(item) &&
                          !sourceTokens.some((source) =>
                            isSameSelection(item, source)
                          )
                      );

                      if (hasUnifiedSelection || areAllChildrenSelected) {
                        return withoutGroup;
                      }

                      return [
                        ...withoutGroup,
                        ...sourceTokens.map((source) =>
                          withDefaultAmount(source)
                        ),
                      ];
                    }

                    if (isDepositOrSendSourcePicker && !token.isUnified) {
                      const unifiedSelection = prev.find(
                        (item) =>
                          item.isUnified &&
                          item.sourceTokens?.some((source) =>
                            isSameSelection(source, token)
                          )
                      );

                      if (unifiedSelection?.sourceTokens?.length) {
                        const withoutUnified = prev.filter(
                          (item) => !isSameSelection(item, unifiedSelection)
                        );
                        return [
                          ...withoutUnified,
                          ...unifiedSelection.sourceTokens
                            .filter((source) => !isSameSelection(source, token))
                            .map((source) => withDefaultAmount(source)),
                        ];
                      }
                    }

                    const exists = prev.find((item) =>
                      isSameSelection(item, token)
                    );
                    if (exists) {
                      return prev.filter(
                        (item) => !isSameSelection(item, token)
                      );
                    }
                    const tokenSourceKeys = new Set(
                      (token.sourceTokens ?? []).map(
                        (source) =>
                          `${source.chainId}-${source.contractAddress.toLowerCase()}`
                      )
                    );
                    const next = prev.filter((existing) => {
                      if (
                        token.isUnified &&
                        tokenSourceKeys.has(
                          `${existing.chainId}-${existing.contractAddress.toLowerCase()}`
                        )
                      ) {
                        return false;
                      }
                      if (
                        existing.isUnified &&
                        existing.sourceTokens?.some(
                          (source) =>
                            source.chainId === token.chainId &&
                            source.contractAddress.toLowerCase() ===
                              token.contractAddress.toLowerCase()
                        )
                      ) {
                        return false;
                      }
                      return true;
                    });
                    return [...next, withDefaultAmount(token)];
                  });
                }}
                preserveSelectedBelowMinimum={false}
                requiredUsd={exactOutRequiredUsdDisplay}
                selectedTokens={fromTokens}
                swapBalance={swapBalance}
                swapSupportedChains={swapSupportedChainsAndTokens}
                title={
                  activeMode === "deposit" || activeMode === "send"
                    ? "Choose Assets to Pay with"
                    : "Choose assets to send"
                }
              />
            </div>
          </div>
        )}

      {/* Drawer: choose-receive-asset */}
      {(activeMode === "swap" ||
        activeMode === "send" ||
        activeMode === "deposit") &&
        swapStep === "choose-receive-asset" && (
          <div
            style={{
              height: "100%",
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div
              onClick={closeDrawerToIdle}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.4)",
                pointerEvents: "auto",
                opacity: isReceiveAssetDrawerClosing ? 0 : 1,
                transition: `opacity ${DRAWER_CLOSE_MS}ms ease`,
              }}
            />
            <div
              className={
                isReceiveAssetDrawerClosing
                  ? undefined
                  : "animate-in slide-in-from-bottom-full duration-300"
              }
              data-nexus-widget-sheet
              style={{
                ...modalHeightTransitionStyle,
                bottom: 0,
                height: ASSET_SELECTOR_DRAWER_HEIGHT,
                left: 0,
                maxHeight: ASSET_SELECTOR_DRAWER_HEIGHT,
                minHeight: ASSET_SELECTOR_DRAWER_HEIGHT,
                position: "absolute",
                right: 0,
                width: "100%",
                backgroundColor: theme.colors.surface,
                borderRadius: "24px 24px 0 0",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "auto",
                boxShadow: theme.shadows.sheet,
                boxSizing: "border-box",
                opacity: isReceiveAssetDrawerClosing ? 0 : 1,
                transform: isReceiveAssetDrawerClosing
                  ? "translateY(100%)"
                  : "translateY(0)",
                transition: `${modalHeightTransition}, transform ${DRAWER_CLOSE_MS}ms ease, opacity ${DRAWER_CLOSE_MS}ms ease`,
                willChange: "height, max-height, transform, opacity",
              }}
            >
              <ReceiveAssetSelector
                additionalTokens={configuredDestinationTokenOptions}
                allowedChainIds={config.allowedDestinationChains}
                allowedPairs={config.allowedDestinationPairs}
                onBack={closeDrawerToIdle}
                onSelect={(token) => {
                  const tokenChanged = !isSameTokenSelection(toToken, token);
                  if (tokenChanged) {
                    onReceiveAssetChange?.({
                      chainId: token.chainId,
                      chainName: token.chainName,
                      contractAddress: token.contractAddress,
                      symbol: token.symbol,
                    });
                  }
                  if (activeMode === "send" || activeMode === "deposit") {
                    setExactOutQuoteSourceModeValue("all");
                    if (tokenChanged) {
                      clearPendingSwapIntent();
                      if (!isConfiguredAmountFixed) {
                        setAmount("");
                      }
                    }
                    setSwapType("exactOut");
                    if (activeMode === "deposit") {
                      const nextDeposit = getDepositForTokenSelection(
                        configuredDepositOptions,
                        token
                      );
                      if (nextDeposit) {
                        setSelectedOpportunity(nextDeposit);
                      }
                    }
                    setToToken(token);
                    closeDrawerToIdle();
                    return;
                  }
                  if (tokenChanged) {
                    clearPendingSwapIntent();
                  }
                  if (swapType !== "exactIn") {
                    setSwapType("exactIn");
                  }
                  setToToken(token);
                  closeDrawerToIdle();
                }}
              />
            </div>
          </div>
        )}
    </div>
  );

  if (embed) return widgetContent;

  return (
    <Dialog onOpenChange={handleModalOpenChange} open={isModalOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {activeMode === "deposit"
            ? "Deposit"
            : activeMode === "send"
              ? "Send"
              : "Swap"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-md! border-0 bg-transparent p-0 shadow-none"
        dismissible={swapStep !== "progress"}
        showCloseButton={false}
      >
        {widgetContent}
      </DialogContent>
    </Dialog>
  );
}

export default NexusWidget;
