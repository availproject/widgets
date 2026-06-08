"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import {
  type NexusOneProps,
  type NexusOneMode,
  type SwapType,
  type NexusOneDepositConfig,
  type NexusOneDepositMetadata,
} from "./types";
import { SwapIdleForm } from "./components/swap-idle-form";
import { SendIdleForm } from "./components/send-idle-form";
import { DepositIdleForm } from "./components/deposit-idle-form";
import { RecipientInput } from "./components/recipient-input";
import { StatusAlert } from "./components/status-alerts";
import {
  SwapAssetSelector,
  type SwapTokenOption,
  deriveTokenOptions,
} from "./components/swap-asset-selector";
import {
  SwapIntentPreview,
  type SwapIntentData,
} from "./components/swap-intent-preview";
import {
  NexusOneProgressScreen,
  type NexusOneProgressEvent,
} from "./components/nexus-one-progress-screen";
import {
  ReceiveAssetSelector,
  preloadReceiveTokens,
} from "./components/receive-asset-selector";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { AlertCircle, ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
import { useNexus } from "../nexus/NexusProvider";
import { getShortChainName } from "../common/utils/constant";
import { useTransactionSteps } from "../common/tx/useTransactionSteps";
import { findCitreaReceiveToken } from "./utils/citrea-tokens";
import {
  getDepositSourceId,
  resolveDepositSourceSelection,
  type DepositSourceFilter,
} from "./utils/deposit-source-selection";
import {
  CHAIN_METADATA,
  ERROR_CODES,
  NEXUS_EVENTS,
  type BridgeStepType,
  type EthereumProvider,
  type SwapStepType,
  TOKEN_CONTRACT_ADDRESSES,
  TOKEN_METADATA,
} from "@avail-project/nexus-core";
import {
  useAccount,
  useConnect,
  useConnectorClient,
  useWalletClient,
  usePublicClient,
} from "wagmi";
import {
  erc20Abi,
  isAddress,
  zeroAddress,
  createPublicClient,
  http,
  encodeFunctionData,
} from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import Decimal from "decimal.js";

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

type SwapHistoryStatus =
  | "pending"
  | "fulfilled"
  | "failed"
  | "refund-initiated";

interface SwapHistoryEntry {
  id: string;
  mode: NexusOneMode;
  status: SwapHistoryStatus;
  createdAt: number;
  startedAt: number;
  endedAt?: number;
  durationSeconds?: number;
  intentData: SwapIntentData | null;
  fromTokens: SwapTokenOption[];
  toToken?: SwapTokenOption;
  requestedToAmount?: string;
  requestedToValue?: string;
  recipientAddress?: string;
  opportunity?: NexusOneDepositMetadata;
  feeUsd?: string;
  intentId?: number;
  intentExplorerUrl?: string | null;
  sourceExplorerUrl?: string | null;
  finalExplorerUrl?: string | null;
  error?: string;
  failureMessage?: string;
  failedStepType?: string;
  autoRefundAvailable?: boolean;
}

type SwapQuoteIssue = {
  type: "insufficientSources";
  message: string;
  missingUsd?: string;
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

const QUOTE_REFRESH_INTERVAL_MS = 30000;
const EXACT_OUT_INPUT_DEBOUNCE_MS = 1000;
const DRAWER_CLOSE_MS = 220;
const MODAL_HEIGHT_TRANSITION_MS = 260;
const BASIS_POINTS = 10000;
const PREDICTIVE_EXACT_IN_DISCOUNT_BPS = 50;
const PREDICTIVE_EXACT_OUT_BUFFER_BPS = 100;
const PREDICTIVE_QUOTE_DISPLAY_DECIMALS = 8;
const SWAP_HISTORY_STORAGE_KEY_PREFIX = "nexus-one-transaction-history-v1";
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
const tooltipSurface = "#FFFFFE";
const tooltipText = "var(--foreground-primary, #161615)";
const tooltipBorder = "var(--border-default, #E8E8E7)";
const uiFont = '"Geist", var(--font-geist-sans), system-ui, sans-serif';
const modalHeightTransitionStyle = {
  interpolateSize: "allow-keywords",
} as React.CSSProperties;
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
    .map((token) =>
      [
        getTokenSelectionKey(token),
        token.symbol ?? "",
        token.decimals ?? "",
        token.userAmount ?? "",
        token.userAmountUsd ?? "",
        token.userAmountMode ?? "",
      ].join(":"),
    )
    .join("|");

const isSameTokenSelection = (
  a?: SwapTokenOption | null,
  b?: SwapTokenOption | null,
) => Boolean(a && b && getTokenSelectionKey(a) === getTokenSelectionKey(b));

const getDepositConfigIdentity = (
  deposit?: NexusOneDepositMetadata | null,
) => {
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
  a?: NexusOneDepositConfig | null,
  b?: NexusOneDepositConfig | null,
) => {
  if (!a || !b) return false;
  return getDepositConfigIdentity(a) === getDepositConfigIdentity(b);
};

const getConfiguredDeposit = (
  config: NexusOneProps["config"],
): NexusOneDepositConfig | undefined => config.deposit;

const sanitizeOpportunityForHistory = (
  opportunity?: NexusOneDepositMetadata,
): NexusOneDepositMetadata | undefined => {
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
  opportunity: sanitizeOpportunityForHistory(entry.opportunity),
});

const sortSwapHistoryEntries = (entries: SwapHistoryEntry[]) =>
  [...entries].sort(
    (a, b) =>
      (b.createdAt ?? b.startedAt ?? 0) - (a.createdAt ?? a.startedAt ?? 0),
  );

const isStoredHistoryStatus = (value: unknown): value is SwapHistoryStatus =>
  value === "pending" ||
  value === "fulfilled" ||
  value === "failed" ||
  value === "refund-initiated";

const isStoredMode = (value: unknown): value is NexusOneMode =>
  value === "swap" || value === "deposit" || value === "send";

const normalizeStoredHistoryEntry = (
  value: unknown,
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
        .filter((entry): entry is SwapHistoryEntry => Boolean(entry)),
    );
  } catch {
    return [];
  }
};

const writeSwapHistoryToStorage = (
  storageKey: string,
  entries: SwapHistoryEntry[],
) => {
  if (typeof window === "undefined") return;

  try {
    const persistableEntries =
      sortSwapHistoryEntries(entries).map(sanitizeHistoryEntry);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(persistableEntries, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
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
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
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
            fontSize: "11px",
            fontWeight: 500,
            maxWidth: "190px",
            lineHeight: "15px",
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
        width="16"
        height="16"
        viewBox="0 0 18 18"
        fill="none"
        style={{
          opacity: isRefreshing ? 0.55 : 1,
          transform: "rotate(-90deg)",
          transition: "opacity 0.18s ease-out",
        }}
      >
        <circle cx="9" cy="9" r={radius} stroke="#E8E8E7" strokeWidth="2" />
        <circle
          cx="9"
          cy="9"
          r={radius}
          stroke="#006BF4"
          strokeLinecap="round"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clampedProgress)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
    </div>
  );
}

const parseDecimalLoose = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  if (Decimal.isDecimal(value)) return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
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

const formatDecimalDisplay = (
  value: unknown,
  options: { min?: number; max?: number } = {},
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
  const max = amount.abs().gte(1) ? 6 : 8;
  return formatDecimalDisplay(amount, { max });
};

const extractIntentIdFromUrl = (url?: string | null) => {
  if (!url) return undefined;
  const match = url.match(/(\d+)(?:\/)?$/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const hasValidIntentExplorer = (
  entry: Pick<SwapHistoryEntry, "intentExplorerUrl" | "intentId">,
) =>
  Boolean(
    entry.intentExplorerUrl &&
    entry.intentId !== undefined &&
    Number.isFinite(entry.intentId) &&
    entry.intentId > 0,
  );

const getExplorerTxUrl = (chainId?: number, txHash?: string | null) => {
  if (!chainId || !txHash) return null;
  const chainMeta = CHAIN_METADATA[chainId];
  const baseUrl =
    (chainMeta as any)?.blockExplorerUrls?.[0] ||
    (chainMeta as any)?.blockExplorers?.default?.url;
  return baseUrl ? `${String(baseUrl).replace(/\/$/, "")}/tx/${txHash}` : null;
};

const getSdkSwapResult = (result: any) => {
  const candidate = result?.swapResult ?? result?.result;
  return candidate &&
    typeof candidate === "object" &&
    typeof candidate.explorerURL === "string"
    ? candidate
    : null;
};

const getSdkTransactionHash = (result: any) =>
  result?.executeResponse?.txHash ||
  result?.transactionHash ||
  result?.transferTransactionHash ||
  result?.executeTransactionHash ||
  result?.txHash ||
  null;

const getSdkExplorerUrl = (result: any) =>
  result?.explorerUrl ||
  result?.explorerURL ||
  result?.executeExplorerUrl ||
  result?.transferExplorerUrl ||
  null;

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
        src={src}
        alt={label || ""}
        onError={() => setFailed(true)}
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
        color: "#006BF4",
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
  size = 34,
}: {
  tokenLogo?: string;
  chainLogo?: string;
  tokenSymbol?: string;
  chainName?: string;
  size?: number;
}) {
  return (
    <div
      style={{ flexShrink: 0, height: size, position: "relative", width: size }}
    >
      <MiniLogo src={tokenLogo} label={tokenSymbol} size={size} fontSize={14} />
      {chainLogo && (
        <MiniLogo
          src={chainLogo}
          label={chainName}
          size={Math.round(size * 0.44)}
          fontSize={6}
          outline="1px solid #FFFFFE"
          style={{ bottom: -2, position: "absolute", right: -2 }}
        />
      )}
    </div>
  );
}

function TruncatedAddress({
  address,
  color = "#006BF4",
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
      tabIndex={0}
      style={{
        color,
        display: "inline-flex",
        fontFamily: uiFont,
        fontSize: "13px",
        fontWeight: 500,
        lineHeight: "18px",
        outline: "none",
        position: "relative",
      }}
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
            fontSize: "11px",
            fontWeight: 500,
            lineHeight: "15px",
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

const getDisplayDestinationSourceRow = (entry: SwapHistoryEntry) => {
  if (entry.mode !== "deposit" && entry.mode !== "send") return null;
  if (!entry.toToken || !entry.requestedToAmount) return null;

  const requestedAmount = parseDecimalLoose(entry.requestedToAmount);
  const intentDestinationAmount = parseDecimalLoose(
    entry.intentData?.destination.amount,
  );
  const destinationBalanceAmount = parseDecimalLoose(
    entry.toToken.balance?.replace(entry.toToken.symbol, ""),
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
    Decimal.max(0, requestedAmount.minus(intentCoversAmount)),
  );
  if (displayAmount.lte(0)) return null;

  const requestedValue = parseDecimalLoose(entry.requestedToValue);
  const destinationValue = parseDecimalLoose(
    entry.intentData?.destination.value,
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
      entry.toToken.chainName,
    ),
    amount: displayAmount
      .toDecimalPlaces(
        Math.max(0, entry.toToken.decimals ?? 18),
        Decimal.ROUND_DOWN,
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
  type.includes("RFF_ID") || type.includes("BRIDGE_DEPOSIT");

const isSwapSkippedStepType = (type: string) => type.includes("SWAP_SKIPPED");

const isAutoRefundAvailableProgressEvent = (event?: NexusOneProgressEvent) =>
  event?.name === NEXUS_EVENTS.SWAP_STEP_COMPLETE &&
  isBridgeRefundStepType(getProgressStepType(event.step));

const getFailureMessageForProgressStep = (
  step: SwapStepType | BridgeStepType | null | undefined,
  mode: NexusOneMode,
  autoRefundAvailable = false,
) => {
  if (autoRefundAvailable) {
    return "Swap Failed. Refund Initiated";
  }

  const type = getProgressStepType(step);
  if (
    type.includes("CREATE_PERMIT_FOR_SOURCE_SWAP") ||
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
    type.includes("RFF") ||
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

const getSourceRows = (entry: SwapHistoryEntry) => {
  const sources = entry.intentData?.sources ?? [];
  const displayDestinationSourceRow = getDisplayDestinationSourceRow(entry);
  if (sources.length > 0) {
    const sourceRows = sources.map((source, index) => {
      const fallback = entry.fromTokens.find(
        (token) =>
          token.chainId === source.chain.id &&
          (token.contractAddress?.toLowerCase() ===
            source.token.contractAddress?.toLowerCase() ||
            token.symbol === source.token.symbol),
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
                tokenLogo={row.tokenLogo}
                chainLogo={row.chainLogo}
                tokenSymbol={row.symbol}
                chainName={row.chainName}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span
                  style={{
                    color: "#161615",
                    fontFamily: uiFont,
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {row.symbol}
                </span>
                <span
                  style={{
                    color: "#848483",
                    fontFamily: uiFont,
                    fontSize: "12px",
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
                  fontSize: "13px",
                }}
              >
                {formatTokenDisplay(row.amount)} {row.symbol}
              </span>
              <span
                style={{
                  color: "#848483",
                  fontFamily: uiFont,
                  fontSize: "12px",
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
          type="button"
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
        >
          <ChevronDown size={14} color="#848483" />
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
  const isDeposit = entry.mode === "deposit";
  const isSend = entry.mode === "send";
  const isRecipientTransfer = isSend || Boolean(entry.recipientAddress);
  const tokenSymbol = destination?.token.symbol || entry.toToken?.symbol || "";
  const chainName = getShortChainName(
    destination?.chain.id ?? entry.toToken?.chainId,
    destination?.chain.name || entry.toToken?.chainName || "",
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
  const intentLabel = `Intent #${entry.intentId}`;
  const sourceRows = getSourceRows(entry);
  const sourceCount = sourceRows.length;
  const sourceTotalUsd = sourceRows.reduce(
    (sum, source) => sum.plus(parseDecimalLoose(source.value) ?? 0),
    new Decimal(0),
  );
  const defaultSwapFailureHeadline = entry.autoRefundAvailable
    ? "Swap Failed. Refund Initiated"
    : "Swap Failed";
  const storedFailureMessage =
    !entry.autoRefundAvailable && entry.failureMessage?.includes("Refund")
      ? undefined
      : entry.failureMessage;
  const failureHeadline =
    storedFailureMessage ||
    (isDeposit
      ? "Deposit failed. Funds are in your wallet"
      : isRecipientTransfer
        ? "Send failed. Funds are in your wallet"
        : defaultSwapFailureHeadline);
  const receiptLocation = isDeposit ? depositVenue : chainName;
  const receiptSummary = receiptLocation ? `on ${receiptLocation}` : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div
        style={{
          background: "#FFFFFE",
          border: "1px solid #E8E8E7",
          borderRadius: "12px",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D",
          padding: "28px 20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            marginBottom: "14px",
            position: "relative",
          }}
        >
          <MiniLogo
            src={
              isDeposit
                ? entry.opportunity?.logo || entry.toToken?.logo
                : entry.toToken?.logo
            }
            label={tokenSymbol}
            size={58}
            fontSize={22}
          />
          <div
            style={{
              alignItems: "center",
              background: isFailed ? "#E92C2C" : "#006BF4",
              border: "2px solid #FFFFFE",
              borderRadius: "999px",
              bottom: -2,
              color: "#FFFFFE",
              display: "flex",
              fontFamily: uiFont,
              fontSize: "15px",
              fontWeight: 700,
              height: "22px",
              justifyContent: "center",
              position: "absolute",
              right: -4,
              width: "22px",
            }}
          >
            {isFailed ? "x" : "✓"}
          </div>
        </div>
        <div style={{ color: "#848483", fontFamily: uiFont, fontSize: "14px" }}>
          {isFailed
            ? failureHeadline
            : isDeposit
              ? "You deposited"
              : isRecipientTransfer
                ? "You sent"
                : "You received"}
        </div>
        <div
          style={{
            alignItems: "baseline",
            color: "#161615",
            display: "flex",
            fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
            fontSize: "42px",
            fontWeight: 500,
            gap: "8px",
            justifyContent: "center",
            lineHeight: "50px",
            marginTop: "8px",
          }}
        >
          {displayAmount ? formatTokenDisplay(displayAmount) : "--"}
          <span
            style={{ fontFamily: uiFont, fontSize: "15px", fontWeight: 600 }}
          >
            {tokenSymbol}
          </span>
        </div>
        <div style={{ color: "#848483", fontFamily: uiFont, fontSize: "14px" }}>
          ≈ {formatUsdDisplay(value)}
        </div>
        {receiptSummary && (
          <div
            style={{
              color: "#848483",
              fontFamily: uiFont,
              fontSize: "13px",
              marginTop: "14px",
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
          borderRadius: "12px",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            padding: "16px 20px",
          }}
        >
          <span
            style={{ color: "#848483", fontFamily: uiFont, fontSize: "14px" }}
          >
            {isDeposit || isSend ? "You Paid" : "You Swapped"}
          </span>
          <div
            style={{
              alignItems: "flex-end",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
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
              type="button"
              onClick={() => setShowSourceDetails((current) => !current)}
              style={{
                alignItems: "center",
                background: "transparent",
                border: "none",
                color: "#006BF4",
                cursor: "pointer",
                display: "inline-flex",
                fontFamily: uiFont,
                fontSize: "12px",
                gap: "4px",
                padding: 0,
              }}
            >
              {showSourceDetails
                ? "Hide Details"
                : `${sourceCount} asset${sourceCount === 1 ? "" : "s"}`}
              <ChevronDown
                size={13}
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
              entry={entry}
              borderTopFirst={false}
              maxHeight={isDeposit ? 204 : 236}
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
              padding: "14px 20px",
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
              padding: "14px 20px",
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
              target="_blank"
              style={{ color: "#006BF4", fontFamily: uiFont, fontSize: "13px" }}
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
              padding: "14px 20px",
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
              target="_blank"
              style={{ color: "#006BF4", fontFamily: uiFont, fontSize: "13px" }}
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
            padding: "14px 20px",
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
          background: "#006BF4",
          border: "none",
          color: "#FFFFFE",
          cursor: "pointer",
          display: "flex",
          fontFamily: uiFont,
          fontSize: "14px",
          fontWeight: 600,
          height: "48px",
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
        padding: "4px 9px",
      }}
    >
      {config.label}
    </span>
  );
}

function SwapHistoryPanel({
  entries,
  now,
  onRefund,
}: {
  entries: SwapHistoryEntry[];
  now: number;
  onRefund: (entry: SwapHistoryEntry) => void;
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
            style={{ color: "#848483", fontFamily: uiFont, fontSize: "22px" }}
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
            fontSize: "14px",
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
        gap: "10px",
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
          destination?.chain.name || entry.toToken?.chainName || "",
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
        const showIntentExplorer = hasValidIntentExplorer(entry);
        const viewUrl = showIntentExplorer
          ? entry.intentExplorerUrl
          : entry.finalExplorerUrl;
        const canShowRefund =
          entry.status === "failed" && Boolean(entry.autoRefundAvailable);
        const status = canShowRefund ? "refund-initiated" : entry.status;
        const sourceRows = getSourceRows(entry);
        const firstSource = sourceRows[0];

        return (
          <div
            key={entry.id}
            style={{
              background: "#FFFFFE",
              border: "1px solid #E8E8E7",
              borderRadius: "12px",
              boxShadow: "0px 1px 12px 0px #5B5B5B0D",
              padding: "14px 18px",
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
                  tokenLogo={destinationLogo}
                  chainLogo={destinationChainLogo}
                  tokenSymbol={destinationSymbol}
                  chainName={destinationChainName}
                  size={42}
                />
                <div>
                  <div
                    style={{
                      alignItems: "baseline",
                      color: "#161615",
                      display: "flex",
                      fontFamily: uiFont,
                      fontSize: "19px",
                      fontWeight: 700,
                      gap: "6px",
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
                  gap: "8px",
                }}
              >
                <HistoryStatusPill status={status} />
                <span
                  style={{
                    color: "#848483",
                    fontFamily: uiFont,
                    fontSize: "12px",
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
                  marginTop: "14px",
                  padding: "10px 12px",
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
                <button
                  disabled={!entry.intentId}
                  onClick={() => onRefund(entry)}
                  style={{
                    background: "#006BF4",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFE",
                    cursor: entry.intentId ? "pointer" : "not-allowed",
                    fontFamily: uiFont,
                    fontSize: "13px",
                    fontWeight: 600,
                    opacity: entry.intentId ? 1 : 0.5,
                    padding: "8px 14px",
                  }}
                >
                  Refund
                </button>
              </div>
            )}

            <div
              style={{
                alignItems: "center",
                borderTop: "1px solid #E8E8E7",
                display: "flex",
                justifyContent: "space-between",
                marginTop: "14px",
                paddingTop: "12px",
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
                {firstSource && (
                  <TokenLogoPair
                    tokenLogo={firstSource.tokenLogo}
                    chainLogo={firstSource.chainLogo}
                    tokenSymbol={firstSource.symbol}
                    chainName={firstSource.chainName}
                    size={24}
                  />
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
                  tokenLogo={destinationLogo}
                  chainLogo={destinationChainLogo}
                  tokenSymbol={destinationSymbol}
                  chainName={destinationChainName}
                  size={24}
                />
                {showIntentExplorer ? (
                  <span
                    style={{
                      color: "#848483",
                      fontFamily: uiFont,
                      fontSize: "13px",
                    }}
                  >
                    Intent #{entry.intentId}
                  </span>
                ) : entry.finalExplorerUrl ? (
                  <span
                    style={{
                      color: "#848483",
                      fontFamily: uiFont,
                      fontSize: "13px",
                    }}
                  >
                    Final transaction
                  </span>
                ) : null}
              </div>
              {viewUrl && (
                <a
                  href={viewUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  style={{
                    color: "#006BF4",
                    fontFamily: uiFont,
                    fontSize: "13px",
                  }}
                >
                  View ↗
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
// NexusOne
// ---------------------------------------------------------------------------

export function NexusOne({
  config,
  embed = true,
  className,
  connectedAddress,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  onComplete,
  onStart,
  onError,
  onClose,
}: NexusOneProps) {
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
    loading: nexusLoading,
  } = useNexus();

  // Mode is a single value, not an array
  const activeMode = config.mode;
  const configuredDeposit = getConfiguredDeposit(config);
  const configuredDepositIdentity = getDepositConfigIdentity(configuredDeposit);
  if (activeMode === "deposit" && !configuredDeposit) {
    throw new Error("NexusOne deposit mode requires config.deposit.");
  }
  const showCloseButton = !embed && Boolean(onClose);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlledOpen = controlledOpen !== undefined;
  const isModalOpen = isControlledOpen ? controlledOpen : internalOpen;

  // Preload receive tokens once SDK is available
  useEffect(() => {
    if (nexusSDK) {
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
    null,
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
      recipientAddress.toLowerCase() === ownerAddress.toLowerCase(),
    );
  const hasCustomSwapRecipient =
    activeMode === "swap" &&
    Boolean(
      recipientAddress &&
      (!defaultRecipientAddress ||
        recipientAddress.toLowerCase() !==
          defaultRecipientAddress.toLowerCase()),
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
    null,
  );
  const [closingDrawerStep, setClosingDrawerStep] = useState<SwapStep | null>(
    null,
  );
  const rootContentRef = useRef<HTMLDivElement | null>(null);
  const [rootContentHeight, setRootContentHeight] = useState<number | null>(
    null,
  );
  const [hasMeasuredRootContent, setHasMeasuredRootContent] = useState(false);
  const [fromTokens, setFromTokens] = useState<SwapTokenOption[]>([]);
  const [sourceSelectionTouched, setSourceSelectionTouched] = useState(false);
  const [sourceSelectionRevision, setSourceSelectionRevision] = useState(0);
  const [, setExactOutQuoteSourceMode] = useState<"all" | "selected">("all");
  const exactOutQuoteSourceModeRef = useRef<"all" | "selected">("all");
  const [toToken, setToToken] = useState<SwapTokenOption | undefined>(
    undefined,
  );
  const fromTokensQuoteKey = getSourceTokensQuoteKey(fromTokens);
  const toTokenQuoteKey = getTokenQuoteKey(toToken);
  const appliedTokenPrefillRef = useRef<string | null>(null);

  const setExactOutQuoteSourceModeValue = useCallback(
    (mode: "all" | "selected") => {
      exactOutQuoteSourceModeRef.current = mode;
      setExactOutQuoteSourceMode(mode);
    },
    [],
  );

  useEffect(() => {
    if (!nexusSDK) return;
    void fetchSwapBalance();

    const refreshTimer = window.setInterval(() => {
      void fetchSwapBalance({ force: true });
    }, 60_000);

    return () => {
      window.clearInterval(refreshTimer);
    };
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
  const [progressEvents, setProgressEvents] = useState<NexusOneProgressEvent[]>(
    [],
  );
  const progressEventsRef = useRef<NexusOneProgressEvent[]>([]);
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
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
  const amountEnteredLastValueRef = useRef<string>("");
  const lastInputMethodRef = useRef<
    "typed" | "percent_25" | "percent_50" | "percent_75" | "percent_max"
  >("typed");
  const prevSourceTouchedRef = useRef(false);
  const previousAutoSourceCountRef = useRef(0);
  const analyticsRef = useRef<{
    track: (event: string, properties?: Record<string, unknown>) => void;
  } | null>(null);
  const selectedOpportunityRef = useRef<NexusOneDepositConfig | undefined>(
    undefined,
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
    undefined,
  );
  const [intentFeeUsd, setIntentFeeUsd] = useState<string | undefined>(
    undefined,
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
    null,
  );
  const [transferExplorerUrl, setTransferExplorerUrl] = useState<string | null>(
    null,
  );
  const swapStepRef = useRef<SwapStep>(swapStep);
  const syncingIntentSourcesRef = useRef(false);
  const lastSwapIntentRefreshAtRef = useRef(0);
  const [destinationBalance, setDestinationBalance] = useState<string | null>(
    null,
  );
  const [swapHistory, setSwapHistory] = useState<SwapHistoryEntry[]>(() =>
    readSwapHistoryFromStorage(historyStorageKey),
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

  // Ref to store swap intent hook allow/deny callbacks
  const swapIntentRef = useRef<{
    intent?: SwapIntentData;
    allow: () => void;
    deny: () => void;
    refresh: () => Promise<any>;
    runId?: number;
  } | null>(null);

  useEffect(() => {
    swapStepRef.current = swapStep;
  }, [swapStep]);

  useEffect(() => {
    return () => {
      if (drawerCloseTimerRef.current) {
        clearTimeout(drawerCloseTimerRef.current);
      }
    };
  }, []);

  const closeDrawerToIdle = useCallback(() => {
    const isDrawerStep =
      swapStep === "choose-swap-asset" ||
      swapStep === "choose-receive-asset" ||
      swapStep === "enter-recipient";

    if (!isDrawerStep) {
      setSwapStep("idle");
      return;
    }

    if (drawerCloseTimerRef.current) {
      clearTimeout(drawerCloseTimerRef.current);
    }

    setClosingDrawerStep(swapStep);
    drawerCloseTimerRef.current = setTimeout(() => {
      setSwapStep("idle");
      setClosingDrawerStep(null);
      drawerCloseTimerRef.current = null;
    }, DRAWER_CLOSE_MS);
  }, [swapStep]);

  const openDrawerStep = useCallback((nextStep: SwapStep) => {
    if (drawerCloseTimerRef.current) {
      clearTimeout(drawerCloseTimerRef.current);
      drawerCloseTimerRef.current = null;
    }
    setClosingDrawerStep(null);
    setSwapStep(nextStep);
  }, []);

  const syncRootContentHeight = useCallback(() => {
    const element = rootContentRef.current;
    if (!element) return;

    const nextHeight = Math.ceil(
      Math.max(element.getBoundingClientRect().height, element.scrollHeight),
    );
    if (nextHeight <= 0) return;

    setRootContentHeight((previousHeight) =>
      previousHeight === nextHeight ? previousHeight : nextHeight,
    );
    setHasMeasuredRootContent(true);
  }, []);

  useLayoutEffect(() => {
    syncRootContentHeight();

    const element = rootContentRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(syncRootContentHeight);
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
    source: SwapIntentData["sources"][number],
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
      isNativeSource && (!source.token.symbol || !matchedAsset?.icon)
        ? nativeCurrency?.symbol || source.token.symbol
        : source.token.symbol || nativeCurrency?.symbol || "";
    const sourceDecimals =
      isNativeSource && nativeCurrency?.decimals !== undefined
        ? nativeCurrency.decimals
        : source.token.decimals;
    const sourceLogo =
      matchedAsset?.icon ?? (isNativeSource ? chainMeta?.logo : "");

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
        chainMeta?.name ?? source.chain.name,
      ),
      chainLogo: chainMeta?.logo ?? source.chain.logo,
      userAmount: source.amount,
      userAmountUsd: Number.isFinite(sourceValue) ? source.value : undefined,
      userAmountMode: "token",
    };
  };

  const clearPendingSwapIntent = (
    clearQuote = true,
    options: { keepQuoteRefreshing?: boolean } = {},
  ) => {
    swapRunIdRef.current += 1;
    swapIntentRef.current?.deny();
    swapIntentRef.current = null;
    setIntentLoading(false);
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
      0,
    );
    return total > 0 ? String(total) : "";
  };

  const parseFiatNumber = (value: unknown) => {
    if (value === null || value === undefined || value === "") return undefined;
    if (Decimal.isDecimal(value)) return value;
    const cleaned = String(value).replace(/[^0-9.-]/g, "");
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

  const minimumSourceUsd = new Decimal(1);
  const hasMinimumSourceUsdBalance = (
    token: Pick<SwapTokenOption, "balanceInFiat">,
  ) =>
    (parseFiatNumber(token.balanceInFiat) ?? new Decimal(0)).gte(
      minimumSourceUsd,
    );
  const filterMinimumSourceUsdTokens = (tokens: SwapTokenOption[]) =>
    tokens.filter(hasMinimumSourceUsdBalance);

  const getTokenUsdRateCacheKeyFromParts = (
    chainId?: number,
    contractAddress?: string,
    symbol?: string,
  ) => {
    if (!chainId || !symbol) return "";
    return [
      chainId,
      (contractAddress || zeroAddress).toLowerCase(),
      symbol.toUpperCase(),
    ].join(":");
  };

  const getTokenUsdRateCacheKey = (
    token?: Pick<SwapTokenOption, "chainId" | "contractAddress" | "symbol">,
  ) =>
    getTokenUsdRateCacheKeyFromParts(
      token?.chainId,
      token?.contractAddress,
      token?.symbol,
    );

  const getSymbolUsdRateCacheKey = (symbol?: string) =>
    symbol ? symbol.trim().toUpperCase() : "";

  const getCachedIntentUsdRate = (
    token?: Pick<SwapTokenOption, "chainId" | "contractAddress" | "symbol">,
  ) => {
    const tokenKey = getTokenUsdRateCacheKey(token);
    const cached = tokenKey
      ? intentDestinationUsdRateCacheRef.current[tokenKey]
      : undefined;
    const rate = parseFiatNumber(cached?.rate);
    return rate && rate.gt(0) ? rate : undefined;
  };

  const cacheDestinationUsdRateFromIntent = (
    intent?: SwapIntentData | null,
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
      symbol,
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
          }, new Decimal(0)),
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
    token: Pick<SwapTokenOption, "symbol" | "decimals">,
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
            new Decimal(10).pow(decimals),
          )
        : undefined);

    if (!maxAmount || maxAmount.lte(0)) return undefined;

    const safeMaxAmount = maxAmount.mul(receiveMaxSafetyMultiplier);
    const destinationRate = await resolveUsdRateForSymbol(
      max.symbol || token.symbol,
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
        Promise.resolve(new Decimal(0)),
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
    preferUsd: boolean,
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
    fallbackAmount?: string,
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
    tokenAmount: Decimal,
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
      new Decimal(0),
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
    token?: SwapTokenOption,
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
    sources = fromTokens,
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
    token?: Pick<SwapTokenOption, "decimals">,
  ) => {
    const decimals = Math.min(
      PREDICTIVE_QUOTE_DISPLAY_DECIMALS,
      Math.max(0, token?.decimals ?? 18),
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
    fallbackAmount?: string,
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
        hasMinimumSourceUsdBalance(source),
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
          targetUsd,
        ).toDecimalPlaces(
          Math.max(0, source.decimals || 18),
          Decimal.ROUND_DOWN,
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
        availableTokenAmount,
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
    fallbackAmount?: string,
  ) =>
    tokens
      .flatMap((token) =>
        token.isUnified
          ? allocateUnifiedExactInToken(token, fallbackAmount)
          : [token],
      )
      .filter(hasMinimumSourceUsdBalance);

  const hasPositiveDecimalInput = (value: unknown) =>
    Boolean(parseFiatNumber(value)?.gt(0));

  const getReadyExactInSourceTokens = (tokens: SwapTokenOption[]) =>
    getExactInSourceTokens(tokens).filter(
      (token) =>
        Boolean(token.chainId && token.contractAddress) &&
        hasPositiveDecimalInput(token.userAmount),
    );

  const hasReadyExactInSwapInput = (
    tokens: SwapTokenOption[],
    destination?: SwapTokenOption,
  ) =>
    Boolean(
      destination?.chainId &&
      destination.contractAddress &&
      getReadyExactInSourceTokens(tokens).length > 0,
    );

  const getExpandedSourceTokens = (tokens: SwapTokenOption[]) => {
    const expanded = tokens.flatMap((token) =>
      token.isUnified && token.sourceTokens?.length
        ? token.sourceTokens
        : [token],
    );
    const seen = new Set<string>();
    return expanded.filter((token) => {
      if (!token.chainId || !token.contractAddress) return false;
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
            (breakdownSymbol === nativeSymbol || assetSymbol === nativeSymbol),
          );

        if (!isNativeBalance) continue;
        balance = balance.plus(
          parseFiatNumber(breakdown.balance) ?? new Decimal(0),
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
            chainMeta?.name ?? breakdown.chain?.name,
          ),
          contractAddress,
          decimals: breakdown.decimals ?? asset.decimals ?? 18,
          logo: asset.icon ?? "",
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

  const getDepositSourceIdsFromTokens = (tokens: SwapTokenOption[]) =>
    getExpandedSourceTokens(tokens)
      .filter((token) => token.chainId && token.contractAddress)
      .map((token) =>
        getDepositSourceId(token.contractAddress, token.chainId!),
      );

  const getDepositTokenOptionsBySourceId = () => {
    const map = new Map<string, SwapTokenOption>();
    const sourceTokens = [
      ...(swapBalance ? deriveTokenOptions(swapBalance) : []),
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
      selectedTokensForResolution,
    );
    const targetAmountUsd =
      options?.targetAmountUsd ??
      (activeMode === "deposit"
        ? depositUsdDecimal
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
    });
  };

  const getExactOutSourceTokens = (
    mode: "all" | "selected" = exactOutQuoteSourceModeRef.current,
    targetAmountUsd?: Decimal,
  ) => {
    if (activeMode === "deposit") {
      const selection = getResolvedDepositSourceSelection({ targetAmountUsd });
      return getDepositSourceTokensForIds(selection.selectedSourceIds);
    }

    if (activeMode === "send" && mode === "selected" && fromTokens.length > 0) {
      return filterMinimumSourceUsdTokens(
        getExpandedSourceTokens(fromTokens),
      ).filter(hasGasForSource);
    }

    return getGasCapableBalanceSourceTokens();
  };

  const buildFromSourcesPayload = (tokens: SwapTokenOption[]) => {
    if (activeMode === "deposit") {
      return {
        fromSources: getResolvedDepositSourceSelection().fromSources,
      };
    }

    const eligibleTokens = filterMinimumSourceUsdTokens(tokens).filter(
      (token) => token.chainId && token.contractAddress,
    );
    return {
      fromSources: eligibleTokens.map((token) => ({
        chainId: token.chainId!,
        tokenAddress: token.contractAddress as `0x${string}`,
      })),
    };
  };

  const buildPredictiveExactOutSources = async (requiredSourceUsd: Decimal) => {
    if (requiredSourceUsd.lte(0)) return [];

    const destinationKey = getTokenSelectionKey(toToken);
    const candidates = getExactOutSourceTokens(
      exactOutQuoteSourceModeRef.current,
      requiredSourceUsd,
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

  const parseLabeledErrorDecimal = (text: string, label: string) => {
    const match = text.match(
      new RegExp(`${label}\\s*:\\s*\\$?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)`, "i"),
    );
    return match ? parseFiatNumber(match[1]) : undefined;
  };

  const getExactOutRequestedUsd = () => {
    const amountNumber = parseFiatNumber(amount);
    if (!amountNumber || amountNumber.lte(0) || !toToken?.symbol) {
      return undefined;
    }

    const fiatValue = getFiatValue(amountNumber.toNumber(), toToken.symbol);
    return Number.isFinite(fiatValue) && fiatValue > 0
      ? new Decimal(fiatValue)
      : undefined;
  };

  const getExactOutAvailableSourceUsd = () => {
    const selectedSourceTotal =
      exactOutQuoteSourceModeRef.current === "selected" && fromTokens.length > 0
        ? fromTokens.reduce((sum, token) => {
            const value =
              parseFiatNumber(token.balanceInFiat) ?? new Decimal(0);
            return value.gte(minimumSourceUsd) ? sum.plus(value) : sum;
          }, new Decimal(0))
        : undefined;

    if (selectedSourceTotal && selectedSourceTotal.gt(0)) {
      return selectedSourceTotal;
    }

    const allSourceTotal = getGasCapableBalanceSourceTokens().reduce(
      (sum, token) => {
        const value = parseFiatNumber(token.balanceInFiat) ?? new Decimal(0);
        return value.gte(minimumSourceUsd) ? sum.plus(value) : sum;
      },
      new Decimal(0),
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
          missingTokenAmount.mul(fiatBalance.div(availableTokenAmount)),
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
          details.required,
      ) ?? parseLabeledErrorDecimal(errorText, "required");
    const availableFromError =
      parseFiatNumber(
        details.availableUsd ??
          details.availableUSD ??
          details.availableAmountUsd ??
          details.availableAmount ??
          details.available,
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
    decimals: number,
  ) =>
    new Decimal(rawAmount.toString())
      .div(new Decimal(10).pow(decimals))
      .toDecimalPlaces(6)
      .toFixed();

  const trimDecimalString = (value: string) =>
    value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

  const receiveMaxSafetyMultiplier = new Decimal("0.9");
  const currentSwapEntry =
    currentSwapId !== null
      ? swapHistory.find((entry) => entry.id === currentSwapId)
      : undefined;

  const patchSwapHistoryEntry = (
    id: string | null | undefined,
    patch: Partial<SwapHistoryEntry>,
  ) => {
    if (!id) return;
    setSwapHistory((prev) =>
      sortSwapHistoryEntries(
        prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      ),
    );
  };

  const patchCurrentSwapHistoryEntry = (patch: Partial<SwapHistoryEntry>) => {
    patchSwapHistoryEntry(currentSwapIdRef.current, patch);
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
    }>,
  ) => {
    const next = { ...explorerUrlsRef.current, ...patch };
    explorerUrlsRef.current = next;
    setExplorerUrls(next);
    patchCurrentSwapHistoryEntry({
      sourceExplorerUrl: next.sourceExplorerUrl,
      finalExplorerUrl: next.destinationExplorerUrl,
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
          step,
        },
      ];
      progressEventsRef.current = next;
      return next;
    });
  };

  const appendProgressListEvent = (
    name: string,
    stepList: Array<SwapStepType | BridgeStepType>,
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
      intentExplorerUrl: null,
      autoRefundAvailable: false,
    };

    currentSwapStartedAtRef.current = 0;
    currentSwapIdRef.current = id;
    setCurrentSwapId(id);
    setSwapHistory((prev) => sortSwapHistoryEntries([entry, ...prev]));
    return id;
  };

  const finishCurrentSwapHistoryEntry = (
    status: "fulfilled" | "failed",
    patch: Partial<SwapHistoryEntry> = {},
  ) => {
    const now = Date.now();
    const startedAt = currentSwapStartedAtRef.current || now;
    patchSwapHistoryEntry(currentSwapIdRef.current, {
      status,
      endedAt: now,
      durationSeconds: Math.max(1, Math.round((now - startedAt) / 1000)),
      sourceExplorerUrl: explorerUrlsRef.current.sourceExplorerUrl,
      finalExplorerUrl: explorerUrlsRef.current.destinationExplorerUrl,
      ...patch,
    });
    void fetchSwapBalance({ force: true });
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

  const handleRefundIntent = async (entry: SwapHistoryEntry) => {
    if (!nexusSDK || !entry.intentId) return;
    patchSwapHistoryEntry(entry.id, { status: "refund-initiated" });
    try {
      await nexusSDK.refundIntent(entry.intentId);
      void fetchSwapBalance({ force: true });
    } catch (error: any) {
      patchSwapHistoryEntry(entry.id, {
        status: "failed",
        error: error?.message || "Refund failed. Please try again.",
      });
      void fetchSwapBalance({ force: true });
    }
  };

  const cachePredictiveBaselineFromIntent = (intent: SwapIntentData) => {
    const destinationAmount = parseFiatNumber(intent.destination?.amount);
    const destinationValue = parseFiatNumber(intent.destination?.value);
    const sourceUsd = (intent.sources ?? []).reduce(
      (sum, source) =>
        sum.plus(parseFiatNumber((source as any).value) ?? new Decimal(0)),
      new Decimal(0),
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
      lastSwapIntentRefreshAtRef.current = Date.now();
      cacheDestinationUsdRateFromIntent(intent);
      cachePredictiveBaselineFromIntent(intent);
      setIntentData(intent);
      setIntentToAmount(intent.destination?.amount || undefined);
      setSwapQuoteIssue(null);

      if (
        activeMode === "send" ||
        (activeMode === "deposit" && swapType === "exactOut")
      ) {
        syncingIntentSourcesRef.current = true;
        setFromTokens((intent.sources ?? []).map(buildIntentSourceToken));
      }

      try {
        const bridgeFees = intent.feesAndBuffer?.bridge;
        const bridgeFeeData =
          bridgeFees && typeof bridgeFees === "object" ? bridgeFees : undefined;
        const collectionFee = parseFiatNumber(bridgeFeeData?.collection);
        const fulfilmentFee = parseFiatNumber(bridgeFeeData?.fulfilment);
        const executionGasFee =
          parseFiatNumber(bridgeFeeData?.caGas) ??
          (collectionFee !== undefined || fulfilmentFee !== undefined
            ? (collectionFee ?? new Decimal(0)).plus(
                fulfilmentFee ?? new Decimal(0),
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
              new Decimal(0),
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
            bridgeTotal.gt(0) ? bridgeTotal.toDecimalPlaces(6).toFixed() : "0",
          );
        } else {
          setIntentFeeUsd(undefined);
        }
      } catch (err) {
        console.warn("Could not resolve bridge fee total", err);
        setIntentFeeUsd(undefined);
      }
    },
    [activeMode, fromTokens, swapType, swapBalance, toToken],
  );

  // Register swap intent hook immediately before executing a swap to prevent race conditions across multiple components
  const registerIntentHook = (runId: number) => {
    if (!nexusSDK) return;
    nexusSDK.setOnSwapIntentHook(async ({ intent, allow, deny, refresh }) => {
      if (swapRunIdRef.current !== runId) {
        deny();
        return;
      }
      // Store callbacks so accept/reject buttons can call them
      providerSwapIntent.current = { intent, allow, deny, refresh };
      swapIntentRef.current = { intent, allow, deny, refresh, runId };
      // Populate intent data for preview
      applySwapIntent(intent);
      setIntentLoading(false);
      setQuoteRefreshing(false);
      setReceiveMaxCalculating(false);
      setPreviewQuoteRefreshing(false);
    });
  };

  // Deposit-specific
  const [selectedOpportunity, setSelectedOpportunity] = useState<
    NexusOneDepositConfig | undefined
  >(() => (activeMode === "deposit" ? configuredDeposit : undefined));
  const selectedOpportunityIdentity =
    getDepositConfigIdentity(selectedOpportunity);
  const [depositAmountMode, setDepositAmountMode] = useState<"token" | "usd">(
    "token",
  );
  const [depositSourceFilter, setDepositSourceFilter] =
    useState<DepositSourceFilter>("all");

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
    [nexusSDK, selectedOpportunity],
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
    opp: NexusOneDepositMetadata,
  ): SwapTokenOption => {
    const citreaToken = findCitreaReceiveToken({
      address: opp.tokenAddress,
      chainId: opp.chainId,
      symbol: opp.tokenSymbol,
    });
    const chainTokens = supportedChainsAndTokens?.find(
      (chain) => chain.id === opp.chainId,
    )?.tokens;
    const matchedToken = chainTokens?.find(
      (token) =>
        token.contractAddress.toLowerCase() ===
          opp.tokenAddress.toLowerCase() || token.symbol === opp.tokenSymbol,
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
        tokenMeta?.icon,
      chainName: getShortChainName(
        opp.chainId,
        CHAIN_METADATA[opp.chainId]?.name ?? citreaToken?.chainName,
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
    (pair?: { token: `0x${string}`; chain: number }) => {
      if (!pair?.token || !pair.chain) return undefined;

      const normalizeAddress = (address?: string) => {
        if (!address) return "";
        return isNativeTokenAddress(address)
          ? zeroAddress
          : address.toLowerCase();
      };
      const targetAddress = normalizeAddress(pair.token);

      const balanceToken = deriveTokenOptions(swapBalance ?? []).find(
        (token) =>
          token.chainId === pair.chain &&
          normalizeAddress(token.contractAddress) === targetAddress,
      );
      if (balanceToken) return balanceToken;

      const chain = supportedChainsAndTokens?.find(
        (item) => item.id === pair.chain,
      );
      const matchedToken = chain?.tokens?.find(
        (token) => normalizeAddress(token.contractAddress) === targetAddress,
      );
      const citreaToken = findCitreaReceiveToken({
        address: pair.token,
        chainId: pair.chain,
      });
      const tokenAddressSymbol = Object.entries(
        TOKEN_CONTRACT_ADDRESSES as Record<string, Record<number, string>>,
      ).find(
        ([, addresses]) =>
          normalizeAddress(addresses[pair.chain]) === targetAddress,
      )?.[0];
      const chainMeta = CHAIN_METADATA[pair.chain];
      const isNativePrefill = isNativeTokenAddress(pair.token);
      const tokenSymbol =
        matchedToken?.symbol ??
        citreaToken?.symbol ??
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
          tokenMeta?.decimals ??
          (isNativePrefill ? chainMeta?.nativeCurrency?.decimals : undefined) ??
          18,
        logo: matchedToken?.logo || citreaToken?.logo || tokenMeta?.icon,
        chainName: getShortChainName(
          pair.chain,
          chain?.name ?? chainMeta?.name ?? citreaToken?.chainName,
        ),
        chainLogo: chain?.logo ?? chainMeta?.logo ?? citreaToken?.chainLogo,
      } satisfies SwapTokenOption;
    },
    [supportedChainsAndTokens, swapBalance],
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
      setFromTokens([
        { ...sourceToken, userAmount: config.prefill?.amount ?? "" },
      ]);
      setSourceSelectionTouched(true);
    }
    if (destinationToken) {
      setToToken(destinationToken);
    }
    setSwapType("exactIn");
    appliedTokenPrefillRef.current = prefillKey;
  }, [
    activeMode,
    config.prefill?.amount,
    config.prefill?.destination?.chain,
    config.prefill?.destination?.token,
    config.prefill?.source?.chain,
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
        : configuredDeposit,
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
        console.warn("Unable to resolve Nexus One token USD rate", {
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
    currentAsset?.symbol || "USDC",
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
      ?.toDecimalPlaces(toToken?.decimals ?? 18)
      .toFixed() ?? "0";

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
          depositTokenAmountForQuote.gt(0),
        )
      : activeMode === "send"
        ? Boolean(hasPositiveDecimalInput(amount) && toToken)
        : false;
  const invalidateExactOutQuoteForRefresh = () => {
    const shouldLoadQuote = Boolean(nexusSDK && canRefreshExactOutQuote());
    clearPendingSwapIntent(true, { keepQuoteRefreshing: shouldLoadQuote });
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
        current?.mode === "exactIn" ? null : current,
      );
      return;
    }

    const sources = getPredictiveExactInSourceTokens();
    const key = getPredictiveQuoteCacheKey();
    if (!toToken || sources.length === 0 || !key) {
      setPredictiveQuote((current) =>
        current?.mode === "exactIn" ? null : current,
      );
      return;
    }

    const runId = ++predictiveQuoteRunRef.current;
    let cancelled = false;

    void (async () => {
      const baseline = predictiveQuoteCacheRef.current[key];
      const cachedDestinationRate = parseFiatNumber(
        baseline?.destinationUsdRate,
      );
      const destinationRate =
        cachedDestinationRate && cachedDestinationRate.gt(0)
          ? cachedDestinationRate
          : await resolveUsdRateForToken(toToken);

      if (cancelled || runId !== predictiveQuoteRunRef.current) return;
      if (destinationRate.lte(0)) {
        setPredictiveQuote((current) =>
          current?.mode === "exactIn" ? null : current,
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
            current?.mode === "exactIn" ? null : current,
          );
          return;
        }
        sourceUsd = sourceUsd.plus(sourceAmount.mul(sourceRate));
      }

      if (sourceUsd.lte(0)) {
        setPredictiveQuote((current) =>
          current?.mode === "exactIn" ? null : current,
        );
        return;
      }

      const cachedAmountPerSourceUsd = parseFiatNumber(
        baseline?.exactInDestinationAmountPerSourceUsd,
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
          toToken,
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
        current?.mode === "exactOut" ? null : current,
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
        current?.mode === "exactOut" ? null : current,
      );
      return;
    }

    const runId = ++predictiveQuoteRunRef.current;
    let cancelled = false;

    void (async () => {
      const baseline = predictiveQuoteCacheRef.current[key];
      const cachedDestinationRate = parseFiatNumber(
        baseline?.destinationUsdRate,
      );
      const destinationRate =
        cachedDestinationRate && cachedDestinationRate.gt(0)
          ? cachedDestinationRate
          : await resolveUsdRateForToken(toToken);

      if (cancelled || runId !== predictiveQuoteRunRef.current) return;
      if (destinationRate.lte(0)) {
        setPredictiveQuote((current) =>
          current?.mode === "exactOut" ? null : current,
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
        new Decimal(0),
      );
      const cachedSourceUsdRatio = parseFiatNumber(
        baseline?.exactOutSourceUsdPerDestinationUsd,
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
          current?.mode === "exactOut" ? null : current,
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
              chainMeta?.name ?? breakdown.chain?.name ?? toToken.chainName,
            ),
            contractAddress:
              breakdown.contractAddress ?? toToken.contractAddress,
            decimals:
              breakdown.decimals ?? asset.decimals ?? toToken.decimals ?? 18,
            logo: asset.icon ?? toToken.logo,
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
              getTokenSelectionKey(token) === getTokenSelectionKey(locked),
          ),
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

  const handleReset = () => {
    clearPendingSwapIntent();
    setAmount("");
    setRecipientAddress("");
    setTxError(null);
    setSwapStep("idle");
    setCurrentSwapId(null);
    currentSwapIdRef.current = null;
    currentSwapStartedAtRef.current = 0;
    clearSelectedSources();
    setToToken(undefined);
    setSelectedOpportunity(undefined);
    setDepositAmountMode("token");
    if (activeMode === "deposit") {
      amountEnteredLastValueRef.current = "";
      rotateAttempt();
    }
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
    setToToken(undefined);
    setDepositAmountMode("token");
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
    [clearPendingSwapIntent, isControlledOpen, onClose, onOpenChange],
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
    if (walletActionPending || nexusLoading || isWalletConnectPending) return;

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

  /** Start swap flow — SDK will trigger setOnSwapIntentHook for preview */
  const handleEnterPreview = async (options: { background?: boolean } = {}) => {
    const { background = false } = options;
    const isExactOutFlow = activeMode === "deposit" || activeMode === "send";

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
      intentData &&
      (activeMode !== "send" || Boolean(recipientAddress)) &&
      ((activeMode !== "deposit" && activeMode !== "send") ||
        (intentData.sources ?? []).length > 0)
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

    // Claim ownership of global singleton hook before executing SDK swap
    registerIntentHook(runId);

    const getSwapStepListFromEvent = (event: { args: any }) => {
      const args = (event as any).args;
      return Array.isArray(args)
        ? args
        : Array.isArray(args?.steps)
          ? args.steps
          : [];
    };

    const handleSwapEvent = (event: { name: string; args: any }) => {
      console.log("[NexusOne][SDK swap event]", event.name, event);
      if (event.name === NEXUS_EVENTS.SWAP_STEPS_LIST) {
        const stepList = getSwapStepListFromEvent(event);
        if (stepList.length > 0) {
          swapStepsListRef.current = stepList as SwapStepType[];
          appendProgressListEvent(event.name, stepList);
          onStepsList(stepList);
        }
        return;
      }
      if (event.name === NEXUS_EVENTS.STEPS_LIST) {
        const args = (event as any).args;
        const stepList = Array.isArray(args)
          ? args
          : Array.isArray(args?.steps)
            ? args.steps
            : [];
        if (stepList.length > 0) {
          appendProgressListEvent(event.name, stepList);
          onStepsList(stepList);
        }
        return;
      }
      if (event.name === NEXUS_EVENTS.STEP_COMPLETE) {
        const step = event.args as BridgeStepType;
        appendProgressEvent(event.name, step, true);
        if (
          (step as any)?.type === "TRANSACTION_SENT" ||
          (step as any)?.type === "TRANSACTION_CONFIRMED"
        ) {
          markSwapExecutionStarted();
        }
        if ((step as any)?.data?.explorerURL) {
          mergeExplorerUrls({
            destinationExplorerUrl: (step as any).data.explorerURL,
          });
        }
        if (
          (step as any)?.type === "BRIDGE_DEPOSIT" ||
          (step as any)?.type === "SOURCE_SWAP_HASH" ||
          (step as any)?.type === "SOURCE_SWAP_BATCH_TX"
        ) {
          fundsMovedRef.current = true;
          const explorerUrl =
            (step as any)?.data?.explorerURL ?? (step as any)?.explorerURL;
          if (explorerUrl && !intentUrlRef.current) {
            intentUrlRef.current = explorerUrl;
          }
        }
        if ((step as any)?.completed !== false) {
          onStepComplete(step as any);
        }
        return;
      }
      if (event.name === "SWAP_SKIPPED") {
        const step =
          event.args && typeof event.args === "object"
            ? event.args
            : ({
                completed: true,
                data: event.args,
                type: "SWAP_SKIPPED",
                typeID: "SWAP_SKIPPED",
              } as unknown as SwapStepType);
        enterSkippedSwapProgress();
        appendProgressEvent(NEXUS_EVENTS.SWAP_STEP_COMPLETE, step, true);
        onStepComplete(step as SwapStepType);
        return;
      }
      if (event.name === NEXUS_EVENTS.SWAP_STEP_COMPLETE) {
        const step = event.args;
        const swapSkipped = isSwapSkippedStepType(getProgressStepType(step));
        if (swapSkipped) {
          enterSkippedSwapProgress();
        }
        appendProgressEvent(event.name, step, true);
        if (
          [
            "SOURCE_SWAP_BATCH_TX",
            "SOURCE_SWAP_HASH",
            "BRIDGE_DEPOSIT",
            "RFF_ID",
            "DESTINATION_SWAP_BATCH_TX",
            "DESTINATION_SWAP_HASH",
            "SWAP_COMPLETE",
            "SWAP_SKIPPED",
          ].includes(step?.type ?? "")
        ) {
          markSwapExecutionStarted();
        }
        if (step?.type === "SOURCE_SWAP_HASH" && step.explorerURL) {
          mergeExplorerUrls({ sourceExplorerUrl: step.explorerURL });
        }
        if (step?.type === "DESTINATION_SWAP_HASH" && step.explorerURL) {
          mergeExplorerUrls({ destinationExplorerUrl: step.explorerURL });
        }
        if (
          step?.type === "BRIDGE_DEPOSIT" &&
          (step as any).data?.explorerURL
        ) {
          mergeExplorerUrls({
            sourceExplorerUrl: (step as any).data.explorerURL,
          });
        }
        if (
          step?.type === "BRIDGE_DEPOSIT" ||
          step?.type === "SOURCE_SWAP_HASH" ||
          step?.type === "SOURCE_SWAP_BATCH_TX"
        ) {
          fundsMovedRef.current = true;
          const explorerUrl =
            (step as any)?.explorerURL ?? (step as any)?.data?.explorerURL;
          if (explorerUrl && !intentUrlRef.current) {
            intentUrlRef.current = explorerUrl;
          }
        }
        if (step?.type === "RFF_ID") {
          const nextIntentId = Number((step as any).data);
          if (Number.isFinite(nextIntentId) && nextIntentId > 0) {
            patchCurrentSwapHistoryEntry({ intentId: nextIntentId });
          }
        }
        if (step?.completed !== false) {
          onStepComplete(step);
        }
      }
    };

    const onEvent = (event: any) => {
      if (swapRunIdRef.current !== runId) return;
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
        { onEvent },
      );
      const finalExplorerUrl =
        getSdkExplorerUrl(result) ||
        getExplorerTxUrl(toToken.chainId, getSdkTransactionHash(result));
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
          amount: bigint;
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

          const safeTokenAmountStr = cleanAmount
            .toDecimalPlaces(
              Math.max(0, token.decimals || 18),
              Decimal.ROUND_DOWN,
            )
            .toFixed();

          fromPayload.push({
            chainId: token.chainId!,
            tokenAddress: token.contractAddress as `0x${string}`,
            amount: nexusSDK.utils.parseUnits(
              safeTokenAmountStr,
              token.decimals || 18,
            ),
          });
        }

        if (fromPayload.length === 0) {
          throw new Error("No source amount available for swap.");
        }

        resetExplorerUrls();
        const exactInSwapPayload = {
          from: fromPayload,
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
            const result = await sdkWithOptionalTransfer.swapAndTransfer(
              {
                mode: "exactIn",
                recipient: resolvedRecipientAddress as `0x${string}`,
                ...exactInSwapPayload,
              },
              { onEvent },
            );
            if (result?.success === false) {
              throw new Error(result?.error || "Swap and transfer failed");
            }

            const swapResult = getSdkSwapResult(result);
            intentExplorerUrl =
              swapResult?.explorerURL || result?.intentExplorerUrl || null;
            intentId =
              extractIntentIdFromUrl(intentExplorerUrl) ??
              currentSwapEntry?.intentId;
            finalExplorerUrl =
              getSdkExplorerUrl(result) ||
              getExplorerTxUrl(
                toToken.chainId,
                getSdkTransactionHash(result),
              ) ||
              finalExplorerUrl;
            if (finalExplorerUrl) {
              setTransferExplorerUrl(finalExplorerUrl);
              mergeExplorerUrls({ destinationExplorerUrl: finalExplorerUrl });
            }
          } else {
            const result = await nexusSDK.swapWithExactIn(exactInSwapPayload, {
              onEvent,
            });
            if (!result?.success) {
              throw new Error(result?.error || "Swap failed");
            }

            intentExplorerUrl = result.result.explorerURL || null;
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
                "Unable to determine received amount to transfer.",
              );
            }

            const transferAmountBigInt = nexusSDK.utils.parseUnits(
              transferAmount,
              toToken.decimals || 18,
            );
            finalExplorerUrl =
              (await executeRecipientTransfer(transferAmountBigInt)) ||
              finalExplorerUrl;
          }
        } else {
          // Start exact-in swap — the intent hook will fire and populate preview
          const result = await nexusSDK.swapWithExactIn(exactInSwapPayload, {
            onEvent,
          });
          if (!result?.success) {
            throw new Error(result?.error || "Swap failed");
          }
          intentExplorerUrl = result.result.explorerURL || null;
          intentId =
            extractIntentIdFromUrl(intentExplorerUrl) ??
            currentSwapEntry?.intentId;
        }

        if (
          swapRunIdRef.current === runId &&
          swapStepRef.current === "progress"
        ) {
          finishCurrentSwapHistoryEntry("fulfilled", {
            intentExplorerUrl,
            intentId,
            finalExplorerUrl,
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
              : "Enter a valid amount.",
          );
          setIntentLoading(false);
          setQuoteRefreshing(false);
          setReceiveMaxCalculating(false);
          return;
        }
        const amountBigInt = nexusSDK.utils.parseUnits(
          exactOutAmountString,
          toToken.decimals || 18,
        );

        resetExplorerUrls();

        const fromSourcesPayload = buildFromSourcesPayload(
          getExactOutSourceTokens(),
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
            user,
          );
          executeConfig = {
            to: executeParams.to,
            value: executeParams.value,
            data: executeParams.data,
            gasPrice: executeParams.gasPrice,
            tokenApproval: executeParams.tokenApproval,
            gas: BigInt(400_000),
          };
        } else if (
          (activeMode === "send" || hasCustomSwapRecipient) &&
          resolvedRecipientAddress
        ) {
          executeConfig = buildRecipientTransferExecuteConfig(amountBigInt);
        }

        if (executeConfig) {
          const sdkWithOptionalTransfer = nexusSDK as any;
          const result =
            (activeMode === "send" || hasCustomSwapRecipient) &&
            typeof sdkWithOptionalTransfer.swapAndTransfer === "function"
              ? await sdkWithOptionalTransfer.swapAndTransfer(
                  {
                    mode: "exactOut",
                    toChainId: toToken.chainId!,
                    toTokenAddress: toToken.contractAddress as `0x${string}`,
                    toAmount: amountBigInt,
                    recipient: resolvedRecipientAddress as `0x${string}`,
                    ...fromSourcesPayload,
                  },
                  { onEvent },
                )
              : await nexusSDK.swapAndExecute(
                  {
                    toChainId: toToken.chainId!,
                    toTokenAddress: toToken.contractAddress as `0x${string}`,
                    toAmount: amountBigInt,
                    execute: executeConfig,
                    ...fromSourcesPayload,
                  },
                  { onEvent },
                );

          const swapResult = result?.swapResult ?? result?.result ?? null;
          const swapSkipped = Boolean((result as any)?.swapSkipped);
          if (
            !swapResult &&
            !swapSkipped &&
            activeMode !== "send" &&
            !hasCustomSwapRecipient
          ) {
            throw new Error("Swap failed");
          }
          const executeTxHash = getSdkTransactionHash(result);
          const intentExplorerUrl =
            swapResult?.explorerURL || result?.intentExplorerUrl || null;
          const intentId =
            extractIntentIdFromUrl(intentExplorerUrl) ??
            currentSwapEntry?.intentId;
          const finalExplorerUrl =
            getSdkExplorerUrl(result) ||
            getExplorerTxUrl(toToken.chainId, executeTxHash);
          if (finalExplorerUrl) {
            if (activeMode === "send" || hasCustomSwapRecipient) {
              setTransferExplorerUrl(finalExplorerUrl);
            }
            mergeExplorerUrls({ destinationExplorerUrl: finalExplorerUrl });
          }
          patchCurrentSwapHistoryEntry({
            intentExplorerUrl,
            intentId,
            finalExplorerUrl,
          });
        } else {
          const result = await nexusSDK.swapWithExactOut(
            {
              toChainId: toToken.chainId!,
              toTokenAddress: toToken.contractAddress as `0x${string}`,
              toAmount: amountBigInt,
              ...fromSourcesPayload,
            },
            {
              onEvent: (event: any) => {
                if (swapRunIdRef.current !== runId) return;
                handleSwapEvent(event);
              },
            },
          );
          if (!result?.success) {
            throw new Error(result?.error || "Swap failed");
          }
          const intentExplorerUrl = result.result.explorerURL || null;
          const intentId =
            extractIntentIdFromUrl(intentExplorerUrl) ??
            currentSwapEntry?.intentId;
          patchCurrentSwapHistoryEntry({ intentExplorerUrl, intentId });
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
      console.error("Error in handleEnterPreview:", err);
      if (swapRunIdRef.current !== runId) {
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
      const showFailedProgressThenReceipt = (
        error: string,
        patch: Partial<SwapHistoryEntry> = {},
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
          failureMessage: getFailureMessageForProgressStep(
            failedStep,
            hasCustomSwapRecipient ? "send" : activeMode,
            autoRefundAvailable,
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
      const errorMessage =
        err?.message ||
        (typeof err === "string"
          ? err
          : "Transaction failed. Please try again or check console.");
      if (hasActiveExecution) {
        showFailedProgressThenReceipt(errorMessage);
      } else if (!background || swapStepRef.current === "preview-intent") {
        setSwapStep("idle");
      }
      setTxError(errorMessage);
      onError?.(errorMessage);
    }
  };

  useEffect(() => {
    if (activeMode !== "swap" || swapStep !== "idle" || !nexusSDK) return;

    if (syncingIntentSourcesRef.current) {
      syncingIntentSourcesRef.current = false;
      return;
    }

    const hasEnoughForQuote = hasReadyExactInSwapInput(fromTokens, toToken);

    if (!hasEnoughForQuote) {
      clearPendingSwapIntent();
      setSwapQuoteIssue(null);
      setTxError(null);
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
    defaultRecipientAddress,
    fromTokensQuoteKey,
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

    const parsedAmount = parseFiatNumber(amount);
    const hasEnoughForQuote = Boolean(
      parsedAmount?.gt(0) &&
      toToken &&
      selectedOpportunity &&
      depositTokenAmountForQuote,
    );

    if (!hasEnoughForQuote) {
      clearPendingSwapIntent();
      clearSelectedSources();
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
    depositAmountMode,
    depositQuoteAmountKey,
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

    const parsedAmount = parseFiatNumber(amount);
    const hasEnoughForQuote = Boolean(parsedAmount?.gt(0) && toToken);

    if (!hasEnoughForQuote) {
      clearPendingSwapIntent();
      clearSelectedSources();
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
    nexusSDK,
    sourceSelectionRevision,
    swapStep,
    toTokenQuoteKey,
  ]);

  const refreshActiveSwapIntent = useCallback(async () => {
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
    const isPreviewRefresh = swapStepRef.current === "preview-intent";
    if (isPreviewRefresh) {
      setPreviewQuoteRefreshing(true);
    } else {
      setQuoteRefreshing(true);
    }
    try {
      const updated = await activeIntent.refresh();
      if (!updated || swapRunIdRef.current !== runId) return;

      if (swapIntentRef.current) {
        swapIntentRef.current.intent = updated;
      }
      applySwapIntent(updated);
    } catch (err) {
      console.error("Unable to refresh swap intent", err);
    } finally {
      if (swapRunIdRef.current === runId) {
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
      Boolean(intentData && swapIntentRef.current) &&
      (swapStep === "idle" || swapStep === "preview-intent");

    if (!hasRefreshableIntent) return;

    let cancelled = false;
    let timeout: number | undefined;

    const scheduleRefresh = () => {
      const quoteAge = Date.now() - lastSwapIntentRefreshAtRef.current;
      const delay = Math.max(0, QUOTE_REFRESH_INTERVAL_MS - quoteAge);
      timeout = window.setTimeout(() => {
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
    intentData,
    intentLoading,
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
      Boolean(intentData && swapIntentRef.current) &&
      (swapStep === "idle" || swapStep === "preview-intent");

    if (!hasRefreshableIntent) {
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
  }, [activeMode, intentData, swapStep]);

  /** User accepted swap from the preview — call allow() from the intent hook */
  const handleSwapAccept = () => {
    if (swapIntentRef.current) {
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
      swapIntentRef.current.allow();
    }
  };

  // ---------------------------------------------------------------------------
  // Header title
  // ---------------------------------------------------------------------------
  const getTitle = () => {
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
      if (swapStep === "failed") return "Swap Failed";
      return "Swap and Bridge";
    }
    if (activeMode === "deposit") {
      if (swapStep === "progress") return "Depositing…";
      if (swapStep === "success") return "Deposit Complete";
      if (swapStep === "failed") return "Deposit Failed";
      return "Deposit";
    }
    if (activeMode === "send") {
      if (swapStep === "progress") return "Sending…";
      if (swapStep === "success") return "Send Complete";
      if (swapStep === "failed") return "Send Failed";
      return "Send";
    }
    return "Nexus One";
  };

  // Titles that should be center-aligned (main screens / confirm screens)
  // Left-aligned: choose-swap-asset, choose-receive-asset (sub-screens with subtitles)
  const isTitleCentered = () => {
    if (swapStep === "history") return false;
    return true; // idle, drawer panels, preview-intent, progress, etc.
  };

  const canGoBack =
    swapStep !== "idle" &&
    swapStep !== "choose-swap-asset" &&
    swapStep !== "choose-receive-asset" &&
    swapStep !== "enter-recipient";
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
    syncingIntentSourcesRef.current = false;
    setSwapQuoteIssue(null);
    setTxError(null);
    const nextAmount = parseFiatNumber(val);
    const hasSelectedSourceToken = fromTokens.some(
      (token) => token.chainId && token.contractAddress,
    );
    const shouldLoadQuote = Boolean(
      nexusSDK && nextAmount?.gt(0) && toToken && hasSelectedSourceToken,
    );
    clearPendingSwapIntent(true, { keepQuoteRefreshing: shouldLoadQuote });
    if (shouldLoadQuote) {
      setQuoteRefreshing(true);
    }
    setAmount(val);
    if (panel === "receive") {
      setFromTokens((prev) =>
        prev.map((token) => ({ ...token, userAmount: "" })),
      );
    }
    // Nexus One swaps are exact-in only. Exact-out is reserved for Deposit and Send.
    if (swapType !== "exactIn") {
      setSwapType("exactIn");
    }
  };

  const handleDepositAmountChange = (val: string) => {
    syncingIntentSourcesRef.current = false;
    resetExactOutSourcesToAuto();
    maxPercentRunRef.current += 1;
    setReceiveMaxCalculating(false);
    setMaxCalculationPercent(null);
    setSwapQuoteIssue(null);
    const nextAmount = parseFiatNumber(val);
    const shouldLoadQuote = Boolean(
      nexusSDK && nextAmount?.gt(0) && toToken && selectedOpportunity,
    );
    clearPendingSwapIntent(true, { keepQuoteRefreshing: shouldLoadQuote });
    if (shouldLoadQuote) {
      setQuoteRefreshing(true);
    } else {
      clearSelectedSources();
    }
    setAmount(val);
  };

  const handleSendAmountChange = (val: string) => {
    syncingIntentSourcesRef.current = false;
    resetExactOutSourcesToAuto();
    maxPercentRunRef.current += 1;
    setReceiveMaxCalculating(false);
    setMaxCalculationPercent(null);
    setSwapQuoteIssue(null);
    setSwapType("exactOut");
    const nextAmount = parseFiatNumber(val);
    const shouldLoadQuote = Boolean(nexusSDK && nextAmount?.gt(0) && toToken);
    clearPendingSwapIntent(true, { keepQuoteRefreshing: shouldLoadQuote });
    if (shouldLoadQuote) {
      setQuoteRefreshing(true);
    } else {
      clearSelectedSources();
    }
    setAmount(val);
  };

  const handleDepositAmountModeToggle = () => {
    syncingIntentSourcesRef.current = false;
    resetExactOutSourcesToAuto();
    const rate = getDepositTokenUsdRate();
    const parsedAmount = parseFiatNumber(amount) ?? new Decimal(0);
    if (parsedAmount.gt(0) && rate.gt(0)) {
      const converted =
        depositAmountMode === "token"
          ? parsedAmount.mul(rate).toDecimalPlaces(2)
          : parsedAmount.div(rate).toDecimalPlaces(toToken?.decimals ?? 18);
      setAmount(converted.toFixed());
    }
    clearPendingSwapIntent();
    setDepositAmountMode((current) => (current === "token" ? "usd" : "token"));
  };

  const handleDepositPercentSelect = async (pct: number) => {
    if (!toToken) return;

    syncingIntentSourcesRef.current = false;
    setTxError(null);
    setSwapQuoteIssue(null);
    const runId = ++maxPercentRunRef.current;
    lastInputMethodRef.current =
      pct === 25
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
          depositAmountMode === "usd",
        );
        if (runId !== maxPercentRunRef.current) return;
        if (!fallback) {
          setQuoteRefreshing(false);
          setReceiveMaxCalculating(false);
          setMaxCalculationPercent(null);
          setTxError(
            "Unable to calculate this percentage for the deposit asset.",
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
            "Unable to calculate this percentage for the deposit asset.",
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
        depositAmountMode === "usd",
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
        error?.message || "Unable to calculate the max deposit amount.",
      );
    }
  };

  const handleSendPercentSelect = async (pct: number) => {
    if (!toToken) return;

    syncingIntentSourcesRef.current = false;
    setTxError(null);
    setSwapQuoteIssue(null);
    const runId = ++maxPercentRunRef.current;

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
          false,
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
            "Unable to calculate this percentage for the send asset.",
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
  const exactOutInsufficientSourceIssue =
    (activeMode === "deposit" || activeMode === "send") &&
    swapQuoteIssue?.type === "insufficientSources"
      ? swapQuoteIssue
      : null;
  const hasCurrentRunnableIntent =
    Boolean(intentData && swapIntentRef.current) &&
    swapIntentRef.current?.runId === swapRunIdRef.current;
  const hasIntentSources = Boolean((intentData?.sources ?? []).length > 0);
  const hasCurrentIntentSources = hasCurrentRunnableIntent && hasIntentSources;
  const isExactOutRouteLoading =
    (activeMode === "deposit" || activeMode === "send") &&
    swapStep === "idle" &&
    swapType === "exactOut" &&
    Boolean(
      toToken && (receiveMaxCalculating || (amount && Number(amount) > 0)),
    ) &&
    !exactOutInsufficientSourceIssue &&
    !hasCurrentIntentSources &&
    (quoteRefreshing || intentLoading || receiveMaxCalculating);
  const isQuoteUnavailableForAutoSourceFlow =
    (activeMode === "deposit" || activeMode === "send") &&
    Boolean(hasPositiveDecimalInput(amount) && toToken) &&
    !quoteRefreshing &&
    !receiveMaxCalculating &&
    !intentLoading &&
    !exactOutInsufficientSourceIssue &&
    !hasCurrentIntentSources;
  const hasPositiveRootAmount = hasPositiveDecimalInput(amount);
  const hasReadySwapQuoteInput = hasReadyExactInSwapInput(fromTokens, toToken);
  const needsWalletConnection = !ownerAddress || !nexusSDK;
  const walletConnectBusy =
    walletActionPending ||
    nexusLoading ||
    isWalletConnectPending ||
    walletStatus === "connecting";
  const walletCtaLabel = walletConnectBusy ? "Connecting..." : "Connect Wallet";
  const isSwapCtaDisabled = needsWalletConnection
    ? walletConnectBusy
    : !hasReadySwapQuoteInput ||
      receiveMaxCalculating ||
      quoteRefreshing ||
      Boolean(exactOutInsufficientSourceIssue);
  const isDepositCtaDisabled = needsWalletConnection
    ? walletConnectBusy
    : !hasPositiveRootAmount ||
      !toToken ||
      receiveMaxCalculating ||
      (!hasCurrentIntentSources &&
        (quoteRefreshing ||
          intentLoading ||
          isQuoteUnavailableForAutoSourceFlow)) ||
      Boolean(exactOutInsufficientSourceIssue);
  const sendNeedsRecipient = activeMode === "send" && !recipientAddress;
  const isSendCtaDisabled = needsWalletConnection
    ? walletConnectBusy
    : !hasPositiveRootAmount ||
      !toToken ||
      hasSameOwnerSendRecipient ||
      receiveMaxCalculating ||
      (!sendNeedsRecipient &&
        !hasCurrentIntentSources &&
        (quoteRefreshing ||
          intentLoading ||
          isQuoteUnavailableForAutoSourceFlow)) ||
      Boolean(exactOutInsufficientSourceIssue);
  const quoteCtaLabel = (fallback: string) => {
    if (needsWalletConnection) return walletCtaLabel;
    if (exactOutInsufficientSourceIssue) return "Insufficient balance";
    if (receiveMaxCalculating) return "Calculating...";
    if (!hasCurrentIntentSources && (quoteRefreshing || intentLoading)) {
      return "Fetching quotes...";
    }
    if (isQuoteUnavailableForAutoSourceFlow) return "Quote unavailable";
    if (!hasPositiveRootAmount) return "Enter amount";
    return fallback;
  };
  const sendCtaLabel = (() => {
    if (needsWalletConnection) return walletCtaLabel;
    if (exactOutInsufficientSourceIssue) return "Insufficient balance";
    if (!hasPositiveRootAmount) return "Enter amount";
    if (!toToken) return "Select token";
    if (hasSameOwnerSendRecipient) return "Change recipient";
    if (sendNeedsRecipient) return "Add recipient";
    return quoteCtaLabel("Review send");
  })();
  const previewIntentSourceUsdNumber = (intentData?.sources ?? []).reduce(
    (sum, source) =>
      sum.plus(parseFiatNumber((source as any).value) ?? new Decimal(0)),
    new Decimal(0),
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
                  : undefined,
              ),
            ),
          new Decimal(0),
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
            amount,
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
    producedAmount: parseFiatNumber(intentData?.destination?.amount),
    producedUsd: parseFiatNumber(intentData?.destination?.value),
    token: toTokenWithFetchedBalance,
  });
  const destinationBalanceDisplayToken = buildDestinationBalanceDisplayToken(
    exactOutDestinationCoverage,
    toTokenWithFetchedBalance,
  );
  const shouldShowPredictiveExactOutDisplay =
    (activeMode === "deposit" || activeMode === "send") &&
    (quoteRefreshing || intentLoading) &&
    !hasIntentSources &&
    Boolean(
      predictiveExactOutQuote &&
      ((predictiveExactOutQuote.sources?.length ?? 0) > 0 ||
        destinationBalanceDisplayToken),
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
          amount,
        ).toNumber()
      : 0;
  const isIdleSwapQuoteLoading =
    activeMode === "swap" && swapStep === "idle" && quoteRefreshing;
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
    Boolean(intentData && swapIntentRef.current) &&
    (swapStep === "idle" || swapStep === "preview-intent");
  const isRecipientDrawerClosing = closingDrawerStep === "enter-recipient";
  const isSwapAssetDrawerClosing = closingDrawerStep === "choose-swap-asset";
  const isReceiveAssetDrawerClosing =
    closingDrawerStep === "choose-receive-asset";
  const isDrawerOverlayActive =
    swapStep === "choose-swap-asset" ||
    swapStep === "choose-receive-asset" ||
    swapStep === "enter-recipient" ||
    closingDrawerStep !== null;

  const widgetContent = (
    <div
      data-nexus-one-root
      className={className}
      style={{
        backgroundColor: "#F9F9F8",
        backgroundImage:
          "url(https://files.availproject.org/nexus-elements/nexus-one/card-bg.png)",
        backgroundPosition: "center",
        backgroundPositionX: "center",
        backgroundPositionY: "center",
        backgroundSize: "cover",
        borderRadius: "16px",
        boxShadow: "#5B5B5B0D 0px 1px 12px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFeatureSettings: '"tnum"',
        fontSize: "12px",
        fontSynthesis: "none",
        fontVariantNumeric: "tabular-nums",
        gap: "12px",
        height:
          hasMeasuredRootContent && rootContentHeight
            ? `${rootContentHeight}px`
            : "fit-content",
        maxHeight: "90dvh",
        lineHeight: "16px",
        margin: "auto",
        overflowX: "hidden",
        overflowY: isDrawerOverlayActive ? "hidden" : "auto",
        overscrollBehavior: isDrawerOverlayActive ? "contain" : "auto",
        scrollbarColor: "#C8C8C7 transparent",
        scrollbarGutter: "stable",
        scrollbarWidth: "thin",
        position: "relative",
        transition: hasMeasuredRootContent ? "height 260ms ease" : undefined,
        willChange: "height",
        maxWidth: "450px",
        minWidth: 0,
        width: "100%",
      }}
    >
      <div
        ref={rootContentRef}
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          gap: "12px",
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
            paddingLeft: "12px",
            paddingRight: "12px",
            paddingTop: "12px",
            width: "100%",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div className="flex items-center gap-x-2">
            {canGoBack && (
              <button
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
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" style={{ color: "#161615" }} />
              </button>
            )}
            <div
              style={{
                boxSizing: "border-box",
                color: "#161615",
                fontFamily:
                  '"Delight-Medium", "Delight", system-ui, sans-serif',
                fontSize: "15px",
                fontWeight: 500,
                letterSpacing: "0.02em",
                lineHeight: "18px",
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
                    fontFamily: "var(--font-geist-sans), sans-serif",
                    fontSize: "13px",
                    color: "var(--foreground-muted, #848483)",
                    marginLeft: "8px",
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
              gap: "10px",
            }}
          >
            {hasQuoteRefreshCountdown && (
              <QuoteRefreshCountdown
                progress={quoteRefreshProgress}
                isRefreshing={quoteRefreshing || previewQuoteRefreshing}
                secondsRemaining={quoteRefreshSecondsRemaining}
              />
            )}
            <button
              onClick={() => setSwapStep("history")}
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFE",
                borderRadius: "8px",
                boxSizing: "border-box",
                display: "flex",
                flexShrink: 0,
                height: "32px",
                justifyContent: "center",
                outline: "1px solid #E8E8E7",
                width: "32px",
                cursor: "pointer",
                border: "none",
                padding: 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: "16px", height: "16px", flexShrink: 0 }}
              >
                <path
                  d="M8 4V8L10.5 9.5"
                  stroke="#161615"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C10.196 2 12.117 3.179 13.163 4.936"
                  stroke="#161615"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M13.5 2V5H10.5"
                  stroke="#161615"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {showCloseButton && (
              <button
                aria-label="Close"
                onClick={handleClose}
                style={{
                  alignItems: "center",
                  backgroundColor: "#FFFFFE",
                  border: "none",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                  cursor: "pointer",
                  display: "flex",
                  flexShrink: 0,
                  height: "32px",
                  justifyContent: "center",
                  outline: "1px solid #E8E8E7",
                  padding: 0,
                  width: "32px",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: "16px", height: "16px", flexShrink: 0 }}
                >
                  <path
                    d="M4 4L12 12M12 4L4 12"
                    stroke="#161615"
                    strokeWidth="1.4"
                    strokeLinecap="round"
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
            gap: "10px",
            minHeight: 0,
            paddingInline: "12px",
            paddingBottom: "12px",
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
                      maxHeight: "calc(90dvh - 72px)",
                      minHeight: 0,
                      overflowX: "hidden",
                      overflowY: "auto",
                      overscrollBehavior: "contain",
                      paddingRight: "2px",
                      scrollbarColor: "#C8C8C7 transparent",
                      scrollbarWidth: "thin",
                    }}
                  >
                    <SwapIntentPreview
                      fromTokens={fromTokens}
                      fromToken={fromTokens[0]}
                      toToken={toTokenWithFetchedBalance}
                      fromAmount={amount}
                      fromAmountUsd={previewFromAmountUsd}
                      toAmount={previewDestinationAmount}
                      toAmountUsd={previewToAmountUsd}
                      toAmountTokens={
                        previewDestinationAmount
                          ? `${previewDestinationAmount}`
                          : undefined
                      }
                      totalFeeUsd={intentFeeUsd}
                      estimatedTime="10s"
                      isLoading={intentLoading}
                      isRefreshing={previewQuoteRefreshing}
                      swapType={swapType}
                      intentData={intentData}
                      swapBalances={swapBalance}
                      supportedTokenAssets={supportedChainsAndTokens}
                      activeMode={activeMode}
                      mode={activeMode}
                      opportunity={selectedOpportunity}
                      steps={steps}
                      explorerUrls={explorerUrls}
                      recipientAddress={transferRecipientAddress}
                      onAccept={handleSwapAccept}
                      onReject={() => {
                        clearPendingSwapIntent();
                        setSwapStep("idle");
                      }}
                    />
                  </div>
                )}

                {swapStep === "progress" && (
                  <NexusOneProgressScreen
                    fromTokens={fromTokens}
                    toToken={toTokenWithFetchedBalance}
                    fromAmountUsd={previewFromAmountUsd}
                    toAmount={previewDestinationAmount}
                    toAmountUsd={previewToAmountUsd}
                    intentData={intentData}
                    mode={activeMode}
                    opportunity={selectedOpportunity}
                    steps={steps}
                    progressEvents={progressEvents}
                    failedStep={failedProgressStep}
                    recipientAddress={transferRecipientAddress}
                  />
                )}

                {(swapStep === "success" || swapStep === "failed") &&
                  currentSwapEntry && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                      <SwapReceiptPanel
                        entry={currentSwapEntry}
                        onDone={handleReset}
                      />
                    </div>
                  )}
              </>
            )}

          {/* =============================================================== */}
          {/* HISTORY SCREEN                                                   */}
          {/* =============================================================== */}
          {swapStep === "history" && (
            <SwapHistoryPanel
              entries={swapHistory}
              now={historyNow}
              onRefund={handleRefundIntent}
            />
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
                  receiveQuoteAmount={
                    swapType === "exactIn" ? idleReceiveQuoteAmount : undefined
                  }
                  isReceiveAmountLoading={isReceiveAmountLoading}
                  isReceiveUsdLoading={isReceiveUsdLoading}
                  onAmountChange={(val, panel) => {
                    handleSwapAmountChange(val, panel);
                  }}
                  fromTokens={fromTokens}
                  toToken={toTokenWithFetchedBalance}
                  receiveQuoteUsd={idleReceiveQuoteUsd}
                  sourceRouteStatus={
                    exactOutInsufficientSourceIssue
                      ? "insufficient"
                      : isExactOutRouteLoading
                        ? "loading"
                        : undefined
                  }
                  sourceRouteMessage={exactOutInsufficientSourceIssue?.message}
                  totalBalance={totalSwapBalanceUsd}
                  usdValue={amount && usdValue > 0 ? usdValue.toFixed(2) : ""}
                  swapType={swapType}
                  allowOverBalanceAmounts={needsWalletConnection}
                  onOpenSourcePicker={(index) => {
                    setEditingAssetIndex(index ?? null);
                    openDrawerStep("choose-swap-asset");
                  }}
                  onOpenDestPicker={() =>
                    openDrawerStep("choose-receive-asset")
                  }
                  onOpenRecipientPicker={handleOpenRecipientEditor}
                  recipientAddress={effectiveRecipientAddress}
                  defaultRecipientAddress={defaultRecipientAddress}
                  onUpdateTokens={setFromTokens}
                />

                {txError && !exactOutInsufficientSourceIssue && (
                  <StatusAlert type="error" message={txError} />
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
                    onClick={() => {
                      if (needsWalletConnection) {
                        void handleConnectWallet();
                        return;
                      }
                      void handleEnterPreview();
                    }}
                    disabled={isSwapCtaDisabled}
                    style={{
                      alignItems: "center",
                      backgroundColor: exactOutInsufficientSourceIssue
                        ? "#FCEEED"
                        : isSwapCtaDisabled
                          ? "#F0F0EF"
                          : "#006BF4",
                      border: exactOutInsufficientSourceIssue
                        ? "1px solid #F7C4C1"
                        : "none",
                      borderRadius: exactOutInsufficientSourceIssue
                        ? "4px"
                        : "8px",
                      boxSizing: "border-box",
                      display: "flex",
                      flexShrink: 0,
                      gap: "8px",
                      height: "48px",
                      justifyContent: "center",
                      paddingInline: "16px",
                      cursor: isSwapCtaDisabled ? "default" : "pointer",
                      width: "100%",
                    }}
                  >
                    {exactOutInsufficientSourceIssue ? (
                      <AlertCircle
                        style={{
                          color: "#D32F2F",
                          height: "17px",
                          width: "17px",
                        }}
                      />
                    ) : (needsWalletConnection && walletConnectBusy) ||
                      quoteRefreshing ||
                      receiveMaxCalculating ? (
                      <Loader2
                        className="animate-spin"
                        style={{
                          color: isSwapCtaDisabled ? "#9E9E9C" : "#FFFFFE",
                          height: "16px",
                          width: "16px",
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        boxSizing: "border-box",
                        color: exactOutInsufficientSourceIssue
                          ? "#D32F2F"
                          : isSwapCtaDisabled
                            ? "#9E9E9C"
                            : "#FFFFFE",
                        fontFamily: '"Geist", system-ui, sans-serif',
                        fontSize: exactOutInsufficientSourceIssue
                          ? "15px"
                          : "16px",
                        fontWeight: 500,
                        lineHeight: "24px",
                      }}
                    >
                      {quoteCtaLabel("Review swap")}
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
                      onAmountChange={handleDepositAmountChange}
                      onAmountModeToggle={handleDepositAmountModeToggle}
                      toToken={toTokenWithFetchedBalance}
                      totalBalance={totalSwapBalanceUsd}
                      usdValue={depositUsdDisplay}
                      tokenValue={depositTokenDisplay}
                      fromTokens={displayFromTokens}
                      onOpenSourcePicker={() =>
                        openDrawerStep("choose-swap-asset")
                      }
                      onSetPercent={handleDepositPercentSelect}
                      routeStatus={
                        exactOutInsufficientSourceIssue
                          ? "insufficient"
                          : displayExactOutRouteLoading
                            ? "loading"
                            : undefined
                      }
                      routeMessage={exactOutInsufficientSourceIssue?.message}
                      isCalculatingMax={receiveMaxCalculating}
                      calculatingPercent={maxCalculationPercent}
                      isQuoteRefreshing={
                        !hasCurrentIntentSources &&
                        (quoteRefreshing || intentLoading)
                      }
                      showAutoBadge={!sourceSelectionTouched}
                    />

                    {txError && !exactOutInsufficientSourceIssue && (
                      <StatusAlert type="error" message={txError} />
                    )}

                    <div
                      style={{
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <button
                        onClick={() => {
                          if (needsWalletConnection) {
                            void handleConnectWallet();
                            return;
                          }
                          void handleEnterPreview();
                        }}
                        disabled={isDepositCtaDisabled}
                        style={{
                          alignItems: "center",
                          backgroundColor: exactOutInsufficientSourceIssue
                            ? "#FCEEED"
                            : isDepositCtaDisabled
                              ? "#F0F0EF"
                              : "#006BF4",
                          border: exactOutInsufficientSourceIssue
                            ? "1px solid #F7C4C1"
                            : "none",
                          borderRadius: exactOutInsufficientSourceIssue
                            ? "4px"
                            : "8px",
                          boxSizing: "border-box",
                          display: "flex",
                          flexShrink: 0,
                          gap: "8px",
                          height: "48px",
                          justifyContent: "center",
                          paddingInline: "16px",
                          cursor: isDepositCtaDisabled ? "default" : "pointer",
                          width: "100%",
                        }}
                      >
                        {exactOutInsufficientSourceIssue ? (
                          <AlertCircle
                            style={{
                              color: "#D32F2F",
                              height: "17px",
                              width: "17px",
                            }}
                          />
                        ) : (needsWalletConnection && walletConnectBusy) ||
                          (!hasCurrentIntentSources &&
                            (quoteRefreshing || intentLoading)) ||
                          receiveMaxCalculating ? (
                          <Loader2
                            className="animate-spin"
                            style={{
                              color: isDepositCtaDisabled
                                ? "#9E9E9C"
                                : "#FFFFFE",
                              height: "16px",
                              width: "16px",
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            boxSizing: "border-box",
                            color: exactOutInsufficientSourceIssue
                              ? "#D32F2F"
                              : isDepositCtaDisabled
                                ? "#9E9E9C"
                                : "#FFFFFE",
                            fontFamily: '"Geist", system-ui, sans-serif',
                            fontSize: exactOutInsufficientSourceIssue
                              ? "15px"
                              : "16px",
                            fontWeight: 500,
                            lineHeight: "24px",
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
                  onAmountChange={handleSendAmountChange}
                  toToken={toTokenWithFetchedBalance}
                  fromTokens={displayFromTokens}
                  totalBalance={totalSwapBalanceUsd}
                  usdValue={
                    amount && sendAmountUsd > 0 ? sendAmountUsd.toFixed(2) : ""
                  }
                  onOpenAssetPicker={() =>
                    openDrawerStep("choose-receive-asset")
                  }
                  onOpenSourcePicker={() => {
                    setEditingAssetIndex(null);
                    openDrawerStep("choose-swap-asset");
                  }}
                  onOpenRecipientPicker={handleOpenRecipientEditor}
                  recipientAddress={recipientAddress || ""}
                  onSetPercent={handleSendPercentSelect}
                  routeStatus={
                    exactOutInsufficientSourceIssue
                      ? "insufficient"
                      : displayExactOutRouteLoading
                        ? "loading"
                        : undefined
                  }
                  routeMessage={exactOutInsufficientSourceIssue?.message}
                  isCalculatingMax={receiveMaxCalculating}
                  calculatingPercent={maxCalculationPercent}
                  isQuoteRefreshing={
                    !hasCurrentIntentSources &&
                    (quoteRefreshing || intentLoading)
                  }
                  showAutoBadge={!sourceSelectionTouched}
                />

                {txError && !exactOutInsufficientSourceIssue && (
                  <StatusAlert type="error" message={txError} />
                )}

                <div
                  style={{
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <button
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
                    disabled={isSendCtaDisabled}
                    style={{
                      alignItems: "center",
                      backgroundColor: exactOutInsufficientSourceIssue
                        ? "#FCEEED"
                        : isSendCtaDisabled
                          ? "#F0F0EF"
                          : "#006BF4",
                      border: exactOutInsufficientSourceIssue
                        ? "1px solid #F7C4C1"
                        : "none",
                      borderRadius: exactOutInsufficientSourceIssue
                        ? "4px"
                        : "8px",
                      boxSizing: "border-box",
                      display: "flex",
                      flexShrink: 0,
                      gap: "8px",
                      height: "48px",
                      justifyContent: "center",
                      paddingInline: "16px",
                      cursor: isSendCtaDisabled ? "default" : "pointer",
                      width: "100%",
                    }}
                  >
                    {exactOutInsufficientSourceIssue ? (
                      <AlertCircle
                        style={{
                          color: "#D32F2F",
                          height: "17px",
                          width: "17px",
                        }}
                      />
                    ) : (needsWalletConnection && walletConnectBusy) ||
                      (!sendNeedsRecipient &&
                        ((!hasCurrentIntentSources &&
                          (quoteRefreshing || intentLoading)) ||
                          receiveMaxCalculating)) ? (
                      <Loader2
                        className="animate-spin"
                        style={{
                          color: isSendCtaDisabled ? "#9E9E9C" : "#FFFFFE",
                          height: "16px",
                          width: "16px",
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        boxSizing: "border-box",
                        color: exactOutInsufficientSourceIssue
                          ? "#D32F2F"
                          : isSendCtaDisabled
                            ? "#9E9E9C"
                            : "#FFFFFE",
                        fontFamily: '"Geist", system-ui, sans-serif',
                        fontSize: exactOutInsufficientSourceIssue
                          ? "15px"
                          : "16px",
                        fontWeight: 500,
                        lineHeight: "24px",
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
              onClick={() => {
                setTxError(null);
                closeDrawerToIdle();
              }}
            />
            <div
              data-nexus-one-sheet
              style={{
                ...modalHeightTransitionStyle,
                bottom: 0,
                height: "auto",
                left: 0,
                maxHeight: "90%",
                position: "absolute",
                right: 0,
                width: "100%",
                backgroundColor: "#FFFFFE",
                borderRadius: "16px 16px 0 0",
                display: "flex",
                flexDirection: "column",
                pointerEvents: "auto",
                boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
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
              className={
                isRecipientDrawerClosing
                  ? undefined
                  : "animate-in slide-in-from-bottom-full duration-300"
              }
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
                    backgroundColor: "#D8D8D6",
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
                  type="button"
                  onClick={() => {
                    setTxError(null);
                    closeDrawerToIdle();
                  }}
                  aria-label="Back"
                  style={{
                    alignItems: "center",
                    backgroundColor: "#FFFFFE",
                    border: "1px solid #E8E8E7",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    flexShrink: 0,
                    height: "32px",
                    justifyContent: "center",
                    padding: 0,
                    width: "32px",
                  }}
                >
                  <ArrowLeft
                    style={{ color: "#161615", height: "16px", width: "16px" }}
                  />
                </button>
                <div
                  style={{
                    color: "#161615",
                    fontFamily:
                      '"Delight-Medium", "Delight", system-ui, sans-serif',
                    fontSize: "18px",
                    fontWeight: 500,
                    lineHeight: "24px",
                  }}
                >
                  Recipient
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "#E8E8E7",
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
                    color: "#9E9E9C",
                    fontFamily: '"Geist", system-ui, sans-serif',
                    fontSize: "13px",
                    fontWeight: 500,
                    lineHeight: "18px",
                  }}
                >
                  Wallet Address
                </div>
                {activeMode === "swap" && defaultRecipientAddress && (
                  <button
                    type="button"
                    onClick={handleResetRecipientToDefault}
                    style={{
                      backgroundColor: "#F4F7FE",
                      border: "none",
                      borderRadius: "4px",
                      color: "#006BF4",
                      cursor: "pointer",
                      fontFamily: '"Geist", system-ui, sans-serif',
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: "16px",
                      padding: "8px 12px",
                    }}
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <RecipientInput
                value={recipientAddress}
                onChange={(next) => {
                  setRecipientAddress(next);
                  if (txError) setTxError(null);
                }}
                onClear={() => setRecipientAddress("")}
                label={null}
                placeholder="Wallet address"
                hasError={Boolean(txError)}
              />
              {txError && (
                <div
                  style={{
                    color: "#E35454",
                    fontFamily: '"Geist", system-ui, sans-serif',
                    fontSize: "13px",
                    fontWeight: 500,
                    lineHeight: "18px",
                    marginTop: "10px",
                  }}
                >
                  {txError}
                </div>
              )}
              {activeMode === "send" && (
                <div
                  style={{
                    color: "#848483",
                    fontFamily: '"Geist", system-ui, sans-serif',
                    fontSize: "13px",
                    lineHeight: "18px",
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
                  backgroundColor: "#006BF4",
                  border: "none",
                  borderRadius: "8px",
                  boxShadow: "#5555550D 0px 1px 4px",
                  color: "#FFFFFE",
                  cursor: "pointer",
                  display: "flex",
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontSize: "16px",
                  fontWeight: 500,
                  height: "48px",
                  justifyContent: "center",
                  marginTop: "24px",
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
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.4)",
                pointerEvents: "auto",
                opacity: isSwapAssetDrawerClosing ? 0 : 1,
                transition: `opacity ${DRAWER_CLOSE_MS}ms ease`,
              }}
              onClick={closeDrawerToIdle}
            />
            <div
              data-nexus-one-sheet
              style={{
                ...modalHeightTransitionStyle,
                bottom: 0,
                height: "auto",
                left: 0,
                maxHeight: "90%",
                position: "absolute",
                right: 0,
                width: "100%",
                backgroundColor: "#FFFFFE",
                borderRadius: "24px 24px 0 0",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "auto",
                boxShadow: "0 -4px 12px rgba(0,0,0,0.05)",
                boxSizing: "border-box",
                opacity: isSwapAssetDrawerClosing ? 0 : 1,
                transform: isSwapAssetDrawerClosing
                  ? "translateY(100%)"
                  : "translateY(0)",
                transition: `${modalHeightTransition}, transform ${DRAWER_CLOSE_MS}ms ease, opacity ${DRAWER_CLOSE_MS}ms ease`,
                willChange: "height, max-height, transform, opacity",
              }}
              className={
                isSwapAssetDrawerClosing
                  ? undefined
                  : "animate-in slide-in-from-bottom-full duration-300"
              }
            >
              <SwapAssetSelector
                title={
                  activeMode === "deposit" || activeMode === "send"
                    ? "Choose Assets to Pay with"
                    : "Select token"
                }
                swapBalance={swapBalance}
                swapSupportedChains={swapSupportedChainsAndTokens}
                isMulti={activeMode === "deposit" || activeMode === "send"}
                allowUnified={
                  activeMode === "deposit" ||
                  activeMode === "send" ||
                  activeMode === "swap"
                }
                preserveSelectedBelowMinimum={false}
                allowSelectedTokenRemoval={false}
                hideCustomTab={activeMode === "swap"}
                autoSelectFilterTabs={
                  activeMode === "deposit" || activeMode === "send"
                }
                filterTabBehavior={
                  activeMode === "deposit" ? "source-pool" : "select-all"
                }
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
                            selection.selectedSourceIds,
                          ),
                        );
                      }
                    : undefined
                }
                lockedTokens={
                  activeMode === "deposit" ? [] : lockedDestinationSourceTokens
                }
                requiredUsd={
                  activeMode === "deposit"
                    ? depositUsdDisplay
                    : activeMode === "send" && sendAmountUsd > 0
                      ? sendAmountUsd.toFixed(2)
                      : undefined
                }
                selectedTokens={fromTokens}
                editingAssetIndex={editingAssetIndex}
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
                          })),
                        );
                      }
                    : undefined
                }
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
                          current.length === 0 ? current : [],
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
                      b: SwapTokenOption,
                    ) => {
                      if (a.isUnified || b.isUnified) {
                        return Boolean(
                          a.isUnified &&
                          b.isUnified &&
                          a.unifiedSymbol === b.unifiedSymbol,
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
                        item.unifiedSymbol === token.unifiedSymbol,
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
                          prev.some((item) => isSameSelection(item, source)),
                      );
                      const withoutGroup = prev.filter(
                        (item) =>
                          !isSameUnifiedGroup(item) &&
                          !sourceTokens.some((source) =>
                            isSameSelection(item, source),
                          ),
                      );

                      if (hasUnifiedSelection || areAllChildrenSelected) {
                        return withoutGroup;
                      }

                      return [
                        ...withoutGroup,
                        ...sourceTokens.map((source) =>
                          withDefaultAmount(source),
                        ),
                      ];
                    }

                    if (isDepositOrSendSourcePicker && !token.isUnified) {
                      const unifiedSelection = prev.find(
                        (item) =>
                          item.isUnified &&
                          item.sourceTokens?.some((source) =>
                            isSameSelection(source, token),
                          ),
                      );

                      if (unifiedSelection?.sourceTokens?.length) {
                        const withoutUnified = prev.filter(
                          (item) => !isSameSelection(item, unifiedSelection),
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
                      isSameSelection(item, token),
                    );
                    if (exists) {
                      return prev.filter(
                        (item) => !isSameSelection(item, token),
                      );
                    }
                    const tokenSourceKeys = new Set(
                      (token.sourceTokens ?? []).map(
                        (source) =>
                          `${source.chainId}-${source.contractAddress.toLowerCase()}`,
                      ),
                    );
                    const next = prev.filter((existing) => {
                      if (
                        token.isUnified &&
                        tokenSourceKeys.has(
                          `${existing.chainId}-${existing.contractAddress.toLowerCase()}`,
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
                              token.contractAddress.toLowerCase(),
                        )
                      ) {
                        return false;
                      }
                      return true;
                    });
                    return [...next, withDefaultAmount(token)];
                  });
                }}
                onDone={closeDrawerToIdle}
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
                      token,
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
                onBack={closeDrawerToIdle}
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
              onClick={closeDrawerToIdle}
            />
            <div
              data-nexus-one-sheet
              style={{
                ...modalHeightTransitionStyle,
                bottom: 0,
                height: "auto",
                left: 0,
                maxHeight: "90%",
                position: "absolute",
                right: 0,
                width: "100%",
                backgroundColor: "#FFFFFE",
                borderRadius: "24px 24px 0 0",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "auto",
                boxShadow: "0 -4px 12px rgba(0,0,0,0.05)",
                boxSizing: "border-box",
                opacity: isReceiveAssetDrawerClosing ? 0 : 1,
                transform: isReceiveAssetDrawerClosing
                  ? "translateY(100%)"
                  : "translateY(0)",
                transition: `${modalHeightTransition}, transform ${DRAWER_CLOSE_MS}ms ease, opacity ${DRAWER_CLOSE_MS}ms ease`,
                willChange: "height, max-height, transform, opacity",
              }}
              className={
                isReceiveAssetDrawerClosing
                  ? undefined
                  : "animate-in slide-in-from-bottom-full duration-300"
              }
            >
              <ReceiveAssetSelector
                onSelect={(token) => {
                  const tokenChanged = !isSameTokenSelection(toToken, token);
                  if (activeMode === "send" || activeMode === "deposit") {
                    setExactOutQuoteSourceModeValue("all");
                    if (tokenChanged) {
                      clearPendingSwapIntent();
                      setAmount("");
                    }
                    setSwapType("exactOut");
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
                onBack={closeDrawerToIdle}
              />
            </div>
          </div>
        )}
    </div>
  );

  if (embed) return widgetContent;

  return (
    <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
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

export default NexusOne;
