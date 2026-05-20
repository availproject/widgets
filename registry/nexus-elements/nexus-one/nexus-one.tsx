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
  type DepositOpportunity,
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
import { ReceiveAssetSelector, preloadReceiveTokens } from "./components/receive-asset-selector";
import { OpportunityList } from "./components/opportunity-list";
import { AlertCircle, ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
import { useNexus } from "../nexus/NexusProvider";
import { useTransactionSteps } from "../common/tx/useTransactionSteps";
import {
  CHAIN_METADATA,
  ERROR_CODES,
  NEXUS_EVENTS,
  type BridgeStepType,
  type SwapStepType,
  TOKEN_METADATA,
} from "@avail-project/nexus-core";
import { useWalletClient, usePublicClient } from "wagmi";
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
  | "choose-swap-asset" // pick source token (exactIn) or dest token (exactOut)
  | "choose-receive-asset" // pick receive token (exactIn only)
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
  recipientAddress?: string;
  opportunity?: DepositOpportunity;
  feeUsd?: string;
  intentId?: number;
  intentExplorerUrl?: string | null;
  sourceExplorerUrl?: string | null;
  finalExplorerUrl?: string | null;
  error?: string;
}

type SwapQuoteIssue = {
  type: "insufficientSources";
  message: string;
  missingUsd?: string;
};

const QUOTE_REFRESH_INTERVAL_MS = 30000;
const EXACT_OUT_INPUT_DEBOUNCE_MS = 1000;
const REFUND_FALLBACK_DELAY_MS = 30 * 60 * 1000;
const DRAWER_CLOSE_MS = 220;
const MODAL_HEIGHT_TRANSITION_MS = 260;
const SWAP_HISTORY_STORAGE_KEY_PREFIX = "nexus-one-transaction-history-v1";
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

const isSameTokenSelection = (
  a?: SwapTokenOption | null,
  b?: SwapTokenOption | null,
) => Boolean(a && b && getTokenSelectionKey(a) === getTokenSelectionKey(b));

const sanitizeOpportunityForHistory = (
  opportunity?: DepositOpportunity,
): DepositOpportunity | undefined => {
  if (!opportunity) return undefined;
  return {
    id: opportunity.id,
    label: opportunity.label,
    protocol: opportunity.protocol,
    logo: opportunity.logo,
    title: opportunity.title,
    subtitle: opportunity.subtitle,
    chainId: opportunity.chainId,
    tokenSymbol: opportunity.tokenSymbol,
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
    const persistableEntries = sortSwapHistoryEntries(entries).map(
      sanitizeHistoryEntry,
    );
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
        <circle
          cx="9"
          cy="9"
          r={radius}
          stroke="#E8E8E7"
          strokeWidth="2"
        />
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

const hasValidIntentExplorer = (entry: Pick<SwapHistoryEntry, "intentExplorerUrl" | "intentId">) =>
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
    <div style={{ flexShrink: 0, height: size, position: "relative", width: size }}>
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
    address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;

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

const getSourceRows = (entry: SwapHistoryEntry) => {
  const sources = entry.intentData?.sources ?? [];
  if (sources.length > 0) {
    return sources.map((source, index) => {
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
        chainName: source.chain.name,
        amount: source.amount,
        value: source.value,
      };
    });
  }

  return entry.fromTokens.map((token, index) => ({
    key: `${token.chainId}-${token.contractAddress}-${index}`,
    tokenLogo: token.logo,
    chainLogo: token.chainLogo,
    symbol: token.symbol,
    chainName: token.chainName || "",
    amount: token.userAmount || "0",
    value: token.balanceInFiat,
  }));
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
              <span style={{ color: "#161615", fontFamily: uiFont, fontSize: "13px" }}>
                {formatTokenDisplay(row.amount)} {row.symbol}
              </span>
              <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "12px" }}>
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
          onClick={() => scrollRef.current?.scrollBy({ top: 72, behavior: "smooth" })}
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
  const tokenSymbol = destination?.token.symbol || entry.toToken?.symbol || "";
  const chainName = destination?.chain.name || entry.toToken?.chainName || "";
  const depositVenue =
    entry.opportunity?.title || entry.opportunity?.protocol || chainName;
  const amount = destination?.amount || "";
  const value = destination?.value;
  const depositGasValue = destination?.gas?.value;
  const depositGasAmount = destination?.gas?.amount;
  const depositGasSymbol = destination?.gas?.token?.symbol;
  const hasDestinationGas = (isDeposit || isSend) && Boolean(destination?.gas);
  const showIntentExplorer = hasValidIntentExplorer(entry);
  const intentLabel = `Intent #${entry.intentId}`;
  const sourceCount = getSourceRows(entry).length;
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
            src={isDeposit ? entry.opportunity?.logo || entry.toToken?.logo : entry.toToken?.logo}
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
          {isDeposit
            ? isFailed
              ? "You were about to deposit"
              : "You deposited"
            : isSend
              ? isFailed
                ? "You were about to send"
                : "You sent"
            : isFailed
              ? "You were about to receive"
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
          {amount ? formatTokenDisplay(amount) : "--"}
          <span style={{ fontFamily: uiFont, fontSize: "15px", fontWeight: 600 }}>
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
          <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "14px" }}>
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
            <div style={{ color: "#161615", fontFamily: uiFont, fontSize: "14px", fontWeight: 700 }}>
              {formatUsdDisplay(
                (entry.intentData?.sources ?? []).reduce(
                  (sum, source) => sum.plus(parseDecimalLoose(source.value) ?? 0),
                  new Decimal(0),
                ),
              )}
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
              {showSourceDetails ? "Hide Details" : `${sourceCount} asset${sourceCount === 1 ? "" : "s"}`}
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
        {isSend && entry.recipientAddress && (
          <div
            style={{
              alignItems: "center",
              borderTop: "1px solid #E8E8E7",
              display: "flex",
              justifyContent: "space-between",
              padding: "14px 20px",
            }}
          >
            <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
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
            <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
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
            <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
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
          <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
            Total Fees
          </span>
          <span style={{ color: "#161615", fontFamily: uiFont, fontSize: "13px" }}>
            {formatUsdDisplay(entry.feeUsd)}
          </span>
        </div>
        {hasDestinationGas && (
          <div
            style={{
              alignItems: "center",
              borderTop: "1px solid #E8E8E7",
              display: "flex",
              justifyContent: "space-between",
              padding: "14px 20px",
            }}
          >
            <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
              {isSend ? "Gas Fee" : "Deposit Gas Fees"}
            </span>
            <div
              style={{
                alignItems: "flex-end",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                textAlign: "right",
              }}
            >
              <span style={{ color: "#161615", fontFamily: uiFont, fontSize: "13px" }}>
                {formatUsdDisplay(depositGasValue)}
              </span>
              <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "12px" }}>
                {depositGasAmount
                  ? `${formatTokenDisplay(depositGasAmount)} ${depositGasSymbol || ""}`.trim()
                  : "--"}
              </span>
            </div>
          </div>
        )}
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

function HistoryStatusPill({
  status,
}: {
  status: SwapHistoryStatus | "auto-refund-failed";
}) {
  const config =
    status === "fulfilled"
      ? { label: "Fulfilled", bg: "#E8F6EF", fg: "#168A47" }
      : status === "pending"
        ? { label: "Pending", bg: "#FFF3DE", fg: "#B7791F" }
        : status === "refund-initiated"
          ? { label: "Refund initiated", bg: "#FFF3DE", fg: "#B7791F" }
          : status === "auto-refund-failed"
            ? { label: "Auto-refund failed", bg: "#FFE6EA", fg: "#E92C2C" }
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
          <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "22px" }}>
            ↻
          </span>
        </div>
        <div style={{ color: "#161615", fontFamily: uiFont, fontSize: "16px", fontWeight: 500 }}>
          No transactions yet
        </div>
        <div style={{ color: "#848483", fontFamily: uiFont, fontSize: "14px", maxWidth: "280px", textAlign: "center" }}>
          Your transaction history will appear here once you make your first swap,
          deposit, or send.
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
        const destinationChainName =
          destination?.chain.name || entry.toToken?.chainName || "";
        const destinationSymbol = destination?.token.symbol || entry.toToken?.symbol || "";
        const destinationValue = destination?.value;
        const destinationAmount = destination?.amount || "";
        const showIntentExplorer = hasValidIntentExplorer(entry);
        const viewUrl = showIntentExplorer
          ? entry.intentExplorerUrl
          : entry.finalExplorerUrl;
        const autoRefundFailed =
          entry.status === "failed" &&
          Boolean(entry.intentId) &&
          now - entry.startedAt >= REFUND_FALLBACK_DELAY_MS;
        const status = autoRefundFailed ? "auto-refund-failed" : entry.status;
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
            <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
              <div style={{ alignItems: "center", display: "flex", gap: "12px" }}>
                <TokenLogoPair
                  tokenLogo={destinationLogo}
                  chainLogo={destinationChainLogo}
                  tokenSymbol={destinationSymbol}
                  chainName={destinationChainName}
                  size={42}
                />
                <div>
                  <div style={{ alignItems: "baseline", color: "#161615", display: "flex", fontFamily: uiFont, fontSize: "19px", fontWeight: 700, gap: "6px" }}>
                    {destinationAmount ? formatTokenDisplay(destinationAmount) : "--"}
                    <span style={{ color: "#848483", fontSize: "12px", fontWeight: 600 }}>
                      {destinationSymbol}
                    </span>
                  </div>
                  <div style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
                    ≈ {formatUsdDisplay(destinationValue)}
                  </div>
                </div>
              </div>
              <div style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", gap: "8px" }}>
                <HistoryStatusPill status={status} />
                <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "12px" }}>
                  {getRelativeTime(entry.createdAt ?? entry.startedAt, now)}
                </span>
              </div>
            </div>

            {autoRefundFailed && (
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
                <span style={{ color: "#161615", fontFamily: uiFont, fontSize: "13px" }}>
                  Try again
                </span>
                <button
                  onClick={() => onRefund(entry)}
                  style={{
                    background: "#006BF4",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFE",
                    cursor: "pointer",
                    fontFamily: uiFont,
                    fontSize: "13px",
                    fontWeight: 600,
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
              <div style={{ alignItems: "center", display: "flex", gap: "8px", minWidth: 0 }}>
                {firstSource && (
                  <TokenLogoPair
                    tokenLogo={firstSource.tokenLogo}
                    chainLogo={firstSource.chainLogo}
                    tokenSymbol={firstSource.symbol}
                    chainName={firstSource.chainName}
                    size={24}
                  />
                )}
                <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
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
                  <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
                    Intent #{entry.intentId}
                  </span>
                ) : entry.finalExplorerUrl ? (
                  <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
                    Final transaction
                  </span>
                ) : null}
              </div>
              {viewUrl && (
                <a
                  href={viewUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  style={{ color: "#006BF4", fontFamily: uiFont, fontSize: "13px" }}
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
  connectedAddress,
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
  } = useNexus();

  // Mode is a single value, not an array
  const activeMode = config.mode;
  if (
    activeMode === "deposit" &&
    (!config.opportunities || config.opportunities.length === 0)
  ) {
    throw new Error(
      "NexusOne deposit mode requires config.opportunities with at least one opportunity.",
    );
  }
  const showCloseButton = !embed && Boolean(onClose);

  // Preload receive tokens once SDK is available
  useEffect(() => {
    if (nexusSDK) {
      preloadReceiveTokens();
    }
  }, [nexusSDK]);

  const { data: walletClient } = useWalletClient();
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
  const defaultRecipientAddress = ownerAddress ?? "";
  const effectiveRecipientAddress =
    activeMode === "swap"
      ? recipientAddress || defaultRecipientAddress
      : recipientAddress;
  const previousDefaultRecipientRef = useRef(defaultRecipientAddress);

  // Swap-specific
  const [swapType, setSwapType] = useState<SwapType>("exactIn");
  const [swapStep, setSwapStep] = useState<SwapStep>("idle");
  const drawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [closingDrawerStep, setClosingDrawerStep] =
    useState<SwapStep | null>(null);
  const rootContentRef = useRef<HTMLDivElement | null>(null);
  const [rootContentHeight, setRootContentHeight] = useState<number | null>(
    null,
  );
  const [hasMeasuredRootContent, setHasMeasuredRootContent] = useState(false);
  const [fromTokens, setFromTokens] = useState<SwapTokenOption[]>([]);
  const [sourceSelectionTouched, setSourceSelectionTouched] = useState(false);
  const [toToken, setToToken] = useState<SwapTokenOption | undefined>(
    undefined,
  );
  const appliedTokenPrefillRef = useRef<string | null>(null);

  useEffect(() => {
    setSourceSelectionTouched(false);
  }, [activeMode]);

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
  const [intentToAmount, setIntentToAmount] = useState<string | undefined>(
    undefined,
  );
  const [intentFeeUsd, setIntentFeeUsd] = useState<string | undefined>(
    undefined,
  );
  const [intentLoading, setIntentLoading] = useState(false);
  const [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const [receiveMaxCalculating, setReceiveMaxCalculating] = useState(false);
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
    const sourceLogo = matchedAsset?.icon ?? (isNativeSource ? chainMeta?.logo : "");

    return {
      contractAddress: source.token.contractAddress,
      symbol: sourceSymbol,
      name: sourceSymbol,
      logo: sourceLogo ?? "",
      decimals: sourceDecimals,
      balance: matchedBreakdown?.balance
        ? `${matchedBreakdown.balance} ${sourceSymbol}`
        : `${source.amount} ${sourceSymbol}`,
      balanceInFiat: matchedBreakdown?.balanceInFiat != null
        ? `$${Number(matchedBreakdown.balanceInFiat).toFixed(2)}`
        : Number.isFinite(sourceValue)
        ? `$${sourceValue.toFixed(2)}`
        : "$0.00",
      chainId: source.chain.id,
      chainName: chainMeta?.name ?? source.chain.name,
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
    swapStepsListRef.current = [];
    resetSteps();
    if (clearQuote) {
      setIntentToAmount(undefined);
      setIntentFeeUsd(undefined);
      setIntentData(null);
    }
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

  const getSwapBalanceTotalUsd = () =>
    (swapBalance ?? []).reduce((sum, asset) => {
      const breakdown = asset.breakdown ?? [];
      if (breakdown.length > 0) {
        return sum.plus(
          breakdown.reduce(
            (breakdownSum, item) =>
              breakdownSum.plus(
                parseFiatNumber(item.balanceInFiat) ?? new Decimal(0),
              ),
            new Decimal(0),
          ),
        );
      }

      return sum.plus(parseFiatNumber(asset.balanceInFiat) ?? new Decimal(0));
    }, new Decimal(0));

  const getTokenUsdRate = (token: SwapTokenOption) => {
    const tokenBalance = parseFiatNumber(token.balance) ?? new Decimal(0);
    const fiatBalance = parseFiatNumber(token.balanceInFiat) ?? new Decimal(0);
    if (tokenBalance.gt(0) && fiatBalance.gt(0)) {
      return fiatBalance.div(tokenBalance);
    }

    const fallbackRate = getFiatValue(1, token.symbol);
    return Number.isFinite(fallbackRate) && fallbackRate > 0
      ? new Decimal(fallbackRate)
      : new Decimal(0);
  };
  const getUsdRateForSymbol = (symbol?: string) => {
    if (!symbol) return new Decimal(0);
    const fiat = getFiatValue(1, symbol);
    return Number.isFinite(fiat) && fiat > 0
      ? new Decimal(fiat)
      : new Decimal(0);
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

  const getUsdForTokenAmount = (token: SwapTokenOption, tokenAmount: Decimal) => {
    const rate = getTokenUsdRate(token);
    if (rate.lte(0) || tokenAmount.lte(0)) return new Decimal(0);
    return tokenAmount.mul(rate);
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
        getTokenBalanceAmount(source).gt(0),
    );
    const allocated: SwapTokenOption[] = [];

    if (token.userAmountMode === "usd") {
      let remainingUsd = rawAmount;

      for (const source of sortedSources) {
        if (remainingUsd.lte(0)) break;

        const availableUsd = getTokenBalanceUsd(source);
        if (availableUsd.lte(0)) continue;

        const targetUsd = Decimal.min(remainingUsd, availableUsd);
        const tokenAmount = getTokenAmountForUsd(source, targetUsd)
          .toDecimalPlaces(Math.max(0, source.decimals || 18), Decimal.ROUND_DOWN);
        if (tokenAmount.lte(0)) continue;

        const actualUsd = getUsdForTokenAmount(source, tokenAmount);
        allocated.push({
          ...source,
          userAmount: tokenAmount.toFixed(),
          userAmountMode: "token",
          userAmountUsd: actualUsd.toDecimalPlaces(6, Decimal.ROUND_DOWN).toFixed(),
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

      const tokenAmount = Decimal.min(remainingTokenAmount, availableTokenAmount)
        .toDecimalPlaces(Math.max(0, source.decimals || 18), Decimal.ROUND_DOWN);
      if (tokenAmount.lte(0)) continue;

      const actualUsd = getUsdForTokenAmount(source, tokenAmount);
      allocated.push({
        ...source,
        userAmount: tokenAmount.toFixed(),
        userAmountMode: "token",
        userAmountUsd: actualUsd.toDecimalPlaces(6, Decimal.ROUND_DOWN).toFixed(),
      });
      remainingTokenAmount = remainingTokenAmount.minus(tokenAmount);
    }

    return allocated;
  };

  const getExactInSourceTokens = (
    tokens: SwapTokenOption[],
    fallbackAmount?: string,
  ) =>
    tokens.flatMap((token) =>
      token.isUnified
        ? allocateUnifiedExactInToken(token, fallbackAmount)
        : [token],
    );

  const getExpandedSourceTokens = (tokens: SwapTokenOption[]) => {
    const expanded = tokens.flatMap((token) =>
      token.isUnified && token.sourceTokens?.length ? token.sourceTokens : [token],
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
    const nativeSymbol = CHAIN_METADATA[chainId]?.nativeCurrency?.symbol?.toUpperCase();
    let balance = new Decimal(0);

    for (const asset of swapBalance ?? []) {
      for (const breakdown of asset.breakdown ?? []) {
        if (breakdown.chain?.id !== chainId) continue;
        const breakdownSymbol = (breakdown.symbol ?? asset.symbol ?? "").toUpperCase();
        const assetSymbol = (asset.symbol ?? "").toUpperCase();
        const isNativeBalance =
          isNativeTokenAddress(breakdown.contractAddress) ||
          Boolean(nativeSymbol && (breakdownSymbol === nativeSymbol || assetSymbol === nativeSymbol));

        if (!isNativeBalance) continue;
        balance = balance.plus(parseFiatNumber(breakdown.balance) ?? new Decimal(0));
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
        if (!chainId || !contractAddress || balance.lte(0)) continue;

        const chainMeta = CHAIN_METADATA[chainId];
        const symbol = breakdown.symbol ?? asset.symbol;
        const fiatBalance = parseFiatNumber(breakdown.balanceInFiat);
        tokens.push({
          chainId,
          chainLogo: chainMeta?.logo ?? breakdown.chain?.logo,
          chainName: chainMeta?.name ?? breakdown.chain?.name,
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

  const getExactOutSourceTokens = () => {
    if (
      (activeMode === "deposit" || activeMode === "send") &&
      fromTokens.length > 0
    ) {
      return getExpandedSourceTokens(fromTokens).filter(hasGasForSource);
    }

    return getGasCapableBalanceSourceTokens();
  };

  const buildFromSourcesPayload = (tokens: SwapTokenOption[]) =>
    tokens.length > 0
      ? {
          fromSources: tokens.map((token) => ({
            chainId: token.chainId!,
            tokenAddress: token.contractAddress as `0x${string}`,
          })),
        }
      : {};

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
      fromTokens.length > 0
        ? fromTokens.reduce(
            (sum, token) =>
              sum.plus(parseFiatNumber(token.balanceInFiat) ?? new Decimal(0)),
            new Decimal(0),
          )
        : undefined;

    if (selectedSourceTotal && selectedSourceTotal.gt(0)) {
      return selectedSourceTotal;
    }

    return getSwapBalanceTotalUsd();
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
        return sum.plus(missingTokenAmount.mul(fiatBalance.div(availableTokenAmount)));
      }

      return sum;
    }, new Decimal(0));
  };

  const buildInsufficientSourcesIssue = (error: unknown): SwapQuoteIssue => {
    const errorText = getErrorText(error);
    const details = (error as any)?.data?.details ?? (error as any)?.details ?? {};
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
      (!missingUsd ||
        missingUsd.lte(0) ||
        missingUsd.gt(requestedUsd.mul(5)))
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
    new Decimal(rawAmount.toString()).div(new Decimal(10).pow(decimals)).toFixed();

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
        prev.map((entry) =>
          entry.id === id ? { ...entry, ...patch } : entry,
        ),
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
    setProgressEvents([]);
    setFailedProgressStep(null);
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
      recipientAddress: activeMode === "send" ? recipientAddress : undefined,
      opportunity: selectedOpportunity,
      feeUsd: intentFeeUsd,
      sourceExplorerUrl: null,
      finalExplorerUrl: null,
      intentExplorerUrl: null,
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
      durationSeconds: Math.max(
        1,
        Math.round((now - startedAt) / 1000),
      ),
      sourceExplorerUrl: explorerUrlsRef.current.sourceExplorerUrl,
      finalExplorerUrl: explorerUrlsRef.current.destinationExplorerUrl,
      ...patch,
    });
  };

  const markSwapExecutionStarted = () => {
    if (currentSwapStartedAtRef.current > 0) return;
    const now = Date.now();
    currentSwapStartedAtRef.current = now;
    patchCurrentSwapHistoryEntry({ startedAt: now });
  };

  const handleRefundIntent = async (entry: SwapHistoryEntry) => {
    if (!nexusSDK || !entry.intentId) return;
    patchSwapHistoryEntry(entry.id, { status: "refund-initiated" });
    try {
      await nexusSDK.refundIntent(entry.intentId);
    } catch (error: any) {
      patchSwapHistoryEntry(entry.id, {
        status: "failed",
        error: error?.message || "Refund failed. Please try again.",
      });
    }
  };

  const applySwapIntent = useCallback(
    (intent: SwapIntentData) => {
      lastSwapIntentRefreshAtRef.current = Date.now();
      setIntentData(intent);
      setIntentToAmount(intent.destination?.amount || undefined);
      setSwapQuoteIssue(null);

      if (
        (activeMode === "send" ||
          ((activeMode === "swap" || activeMode === "deposit") &&
            swapType === "exactOut"))
      ) {
        const intentSources = intent.sources ?? [];
        if (intentSources.length > 0) {
          syncingIntentSourcesRef.current = true;
          setFromTokens(intentSources.map(buildIntentSourceToken));
        }
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
            : parseFiatNumber(bridgeFeeData?.total) ??
              (bridgeComponentsTotal && bridgeComponentsTotal.gt(0)
                ? bridgeComponentsTotal
                : undefined);

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
    [activeMode, swapType, swapBalance],
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
      swapIntentRef.current = { intent, allow, deny, refresh, runId };
      // Populate intent data for preview
      applySwapIntent(intent);
      console.log("on hook intent swap intent", intent, "swap intent");

      console.log("[DEBUG] Successfully parsed intent data! Removing loader.");
      setIntentLoading(false);
      setQuoteRefreshing(false);
      setReceiveMaxCalculating(false);
      setPreviewQuoteRefreshing(false);
    });
  };

  useEffect(() => {
    console.log("SWAP INTENT");
    console.log("intentData", intentData);
    console.log("intentFeeUsd", intentFeeUsd);
    console.log("intentLoading", intentLoading);
    console.log("intentToAmount", intentToAmount);
  }, [intentData, intentFeeUsd, intentLoading, intentToAmount]);

  // Deposit-specific
  const [selectedOpportunity, setSelectedOpportunity] = useState<
    DepositOpportunity | undefined
  >(() =>
    activeMode === "deposit" && config.opportunities?.length === 1
      ? config.opportunities[0]
      : undefined,
  );
  const [pendingOpportunity, setPendingOpportunity] = useState<
    DepositOpportunity | undefined
  >(undefined);
  const [depositAmountMode, setDepositAmountMode] = useState<"token" | "usd">(
    "token",
  );

  const toTokenFromOpportunity = (
    opp: DepositOpportunity,
  ): SwapTokenOption => {
    const chainTokens = supportedChainsAndTokens?.find(
      (chain) => chain.id === opp.chainId,
    )?.tokens;
    const matchedToken = chainTokens?.find(
      (token) =>
        token.contractAddress.toLowerCase() ===
          opp.tokenAddress.toLowerCase() ||
        token.symbol === opp.tokenSymbol,
    );
    const tokenMeta =
      TOKEN_METADATA[opp.tokenSymbol as keyof typeof TOKEN_METADATA];

    return {
      chainId: opp.chainId,
      contractAddress: opp.tokenAddress,
      symbol: opp.tokenSymbol,
      name: matchedToken?.name || opp.tokenSymbol,
      balance: "0",
      balanceInFiat: "$0.00",
      decimals: matchedToken?.decimals ?? tokenMeta?.decimals ?? 18,
      logo: opp.tokenLogo || matchedToken?.logo || tokenMeta?.icon,
      chainName: CHAIN_METADATA[opp.chainId]?.name,
      chainLogo: CHAIN_METADATA[opp.chainId]?.logo,
    };
  };

  const resolvePrefillToken = useCallback(
    (pair?: { token: `0x${string}`; chain: number }) => {
      if (!pair?.token || !pair.chain) return undefined;

      const normalizeAddress = (address?: string) => {
        if (!address) return "";
        return isNativeTokenAddress(address) ? zeroAddress : address.toLowerCase();
      };
      const targetAddress = normalizeAddress(pair.token);

      const balanceToken = deriveTokenOptions(swapBalance ?? []).find(
        (token) =>
          token.chainId === pair.chain &&
          normalizeAddress(token.contractAddress) === targetAddress,
      );
      if (balanceToken) return balanceToken;

      const chain = supportedChainsAndTokens?.find((item) => item.id === pair.chain);
      const matchedToken = chain?.tokens?.find(
        (token) => normalizeAddress(token.contractAddress) === targetAddress,
      );
      const tokenSymbol = matchedToken?.symbol ?? "Token";
      const tokenMeta = TOKEN_METADATA[tokenSymbol as keyof typeof TOKEN_METADATA];

      if (!chain && !matchedToken) return undefined;

      return {
        chainId: pair.chain,
        contractAddress: pair.token,
        symbol: tokenSymbol,
        name: matchedToken?.name || tokenSymbol,
        balance: `0 ${tokenSymbol}`,
        balanceInFiat: "$0.00",
        decimals: matchedToken?.decimals ?? tokenMeta?.decimals ?? 18,
        logo: matchedToken?.logo || tokenMeta?.icon,
        chainName: chain?.name ?? CHAIN_METADATA[pair.chain]?.name,
        chainLogo: chain?.logo ?? CHAIN_METADATA[pair.chain]?.logo,
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
    ].join("|");

    if (appliedTokenPrefillRef.current === prefillKey) return;

    const sourceToken = resolvePrefillToken(sourcePrefill);
    const destinationToken = resolvePrefillToken(destinationPrefill);

    if (sourcePrefill && !sourceToken) return;
    if (destinationPrefill && !destinationToken) return;

    if (sourceToken) {
      setFromTokens([{ ...sourceToken, userAmount: "" }]);
      setSourceSelectionTouched(true);
    }
    if (destinationToken) {
      setToToken(destinationToken);
    }
    setSwapType("exactIn");
    appliedTokenPrefillRef.current = prefillKey;
  }, [
    activeMode,
    config.prefill?.destination?.chain,
    config.prefill?.destination?.token,
    config.prefill?.source?.chain,
    config.prefill?.source?.token,
    resolvePrefillToken,
  ]);

  useEffect(() => {
    if (config.prefill?.amount) setAmount(config.prefill.amount);
    if (config.prefill?.recipient)
      setRecipientAddress(config.prefill.recipient);
  }, [config.prefill?.amount, config.prefill?.recipient]);

  useEffect(() => {
    setDestinationBalance(null);

    if (!toToken?.chainId || !ownerAddress) return;

    const chainMeta = CHAIN_METADATA[toToken.chainId];
    const rpcUrl = chainMeta?.rpcUrls?.[0];
    if (!rpcUrl) return;

    let cancelled = false;
    const client = createPublicClient({
      chain: {
        id: toToken.chainId,
        name: chainMeta?.name ?? toToken.chainName ?? "Destination Chain",
        nativeCurrency: chainMeta?.nativeCurrency ?? {
          decimals: 18,
          name: "Ether",
          symbol: "ETH",
        },
        rpcUrls: {
          default: { http: [rpcUrl] },
          public: { http: [rpcUrl] },
        },
        blockExplorers: chainMeta?.blockExplorerUrls?.[0]
          ? {
              default: {
                name: chainMeta.name,
                url: chainMeta.blockExplorerUrls[0],
              },
            }
          : undefined,
      } as any,
      transport: http(rpcUrl),
    });

    const fetchDestinationBalance = async () => {
      try {
        let rawBalance: bigint;
        let decimals = toToken.decimals || 18;

        if (isNativeTokenAddress(toToken.contractAddress)) {
          rawBalance = await client.getBalance({
            address: ownerAddress as `0x${string}`,
          });
          decimals = chainMeta?.nativeCurrency.decimals ?? decimals;
        } else {
          const tokenAddress = toToken.contractAddress as `0x${string}`;
          const [balanceResult, decimalsResult] = await Promise.all([
            client.readContract({
              abi: erc20Abi,
              address: tokenAddress,
              functionName: "balanceOf",
              args: [ownerAddress as `0x${string}`],
            }) as Promise<bigint>,
            client
              .readContract({
                abi: erc20Abi,
                address: tokenAddress,
                functionName: "decimals",
              })
              .catch(() => decimals),
          ]);

          rawBalance = balanceResult;
          decimals = Number(decimalsResult) || decimals;
        }

        if (!cancelled) {
          setDestinationBalance(
            `${formatReadableTokenAmount(rawBalance, decimals)} ${toToken.symbol}`,
          );
        }
      } catch (error) {
        console.warn("Unable to fetch destination token balance", error);
      }
    };

    void fetchDestinationBalance();

    return () => {
      cancelled = true;
    };
  }, [
    ownerAddress,
    toToken?.chainId,
    toToken?.chainName,
    toToken?.contractAddress,
    toToken?.decimals,
    toToken?.symbol,
  ]);

  useEffect(() => {
    if (activeMode !== "deposit") return;
    if (selectedOpportunity) return;
    if (config.opportunities?.length === 1) {
      const [opp] = config.opportunities;
      setSelectedOpportunity(opp);
      setSwapType("exactOut");
      setToToken(toTokenFromOpportunity(opp));
    }
  }, [activeMode, config.opportunities, selectedOpportunity, supportedChainsAndTokens]);

  useEffect(() => {
    if (activeMode !== "deposit" || !selectedOpportunity) return;
    setToToken((current) => ({
      ...toTokenFromOpportunity(selectedOpportunity),
      balance: current?.balance ?? "0",
      balanceInFiat: current?.balanceInFiat ?? "$0.00",
    }));
  }, [activeMode, selectedOpportunity, supportedChainsAndTokens]);

  useEffect(() => {
    if (activeMode !== "deposit") return;
    if (selectedOpportunity) return;
    if (!config.opportunities || config.opportunities.length <= 1) return;
    setPendingOpportunity((current) => current ?? config.opportunities?.[0]);
  }, [activeMode, config.opportunities, selectedOpportunity]);

  useEffect(() => {
    if (activeMode !== "send") return;
    setSwapType("exactOut");
  }, [activeMode]);

  useEffect(() => {
    if (activeMode !== "deposit" && activeMode !== "send") return;
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
    return Number.isFinite(fiat) && fiat > 0
      ? new Decimal(fiat)
      : new Decimal(0);
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
  const depositUsdDecimal =
    depositAmountMode === "usd"
      ? parseFiatNumber(amount) ?? new Decimal(0)
      : depositTokenAmountForQuote
        ? depositTokenAmountForQuote.mul(getDepositTokenUsdRate())
        : new Decimal(0);
  const depositUsdDisplay = depositUsdDecimal.toDecimalPlaces(2).toFixed();
  const depositTokenDisplay =
    depositTokenAmountForQuote?.toDecimalPlaces(toToken?.decimals ?? 18).toFixed() ??
    "0";
  const requiredDestinationTokenAmount =
    activeMode === "deposit"
      ? depositTokenAmountForQuote
      : activeMode === "send"
        ? parseFiatNumber(amount)
        : undefined;
  const defaultDepositSourceTokens = useMemo<SwapTokenOption[]>(() => {
    if (activeMode !== "deposit" || !swapBalance) return [];
    return deriveTokenOptions(swapBalance).map((token) => ({
      ...token,
      userAmount: "",
    }));
  }, [activeMode, swapBalance]);
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
          (breakdownAddress.toLowerCase() === toToken.contractAddress.toLowerCase() ||
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
        return [
          {
            chainId,
            chainLogo: chainMeta?.logo ?? breakdown.chain?.logo ?? toToken.chainLogo,
            chainName: chainMeta?.name ?? breakdown.chain?.name ?? toToken.chainName,
            contractAddress: breakdown.contractAddress ?? toToken.contractAddress,
            decimals: breakdown.decimals ?? asset.decimals ?? toToken.decimals ?? 18,
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
            (token) => getTokenSelectionKey(token) === getTokenSelectionKey(locked),
          ),
      );
      if (missing.length === 0) return current;
      return [...current, ...missing.map((token) => ({ ...token, userAmount: "" }))];
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
    if (
      defaultDepositSourceTokens.length === 0 &&
      lockedDestinationSourceTokens.length === 0
    ) {
      return;
    }

    setFromTokens((current) => {
      const lockedKeys = new Set(
        lockedDestinationSourceTokens.map(getTokenSelectionKey),
      );
      const canInitialize =
        current.length === 0 ||
        current.every((token) => lockedKeys.has(getTokenSelectionKey(token)));
      if (!canInitialize) return current;

      const next: SwapTokenOption[] = [];
      const seen = new Set<string>();
      for (const token of [
        ...defaultDepositSourceTokens,
        ...lockedDestinationSourceTokens,
      ]) {
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
    defaultDepositSourceTokens,
    depositTokenAmountForQuote?.toFixed(),
    lockedDestinationSourceTokens,
    sourceSelectionTouched,
    toToken,
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
    setFromTokens([]);
    setSourceSelectionTouched(false);
    setToToken(undefined);
    setSelectedOpportunity(undefined);
    setPendingOpportunity(undefined);
    setDepositAmountMode("token");
  };

  const handleSelectDepositOpportunity = (opp: DepositOpportunity) => {
    clearPendingSwapIntent();
    setTxError(null);
    setSwapQuoteIssue(null);
    setSelectedOpportunity(opp);
    setPendingOpportunity(opp);
    setSwapType("exactOut");
    setDepositAmountMode("token");
    setAmount("");
    setFromTokens([]);
    setSourceSelectionTouched(false);
    setToToken(toTokenFromOpportunity(opp));
  };

  const handleClose = () => {
    clearPendingSwapIntent();
    onClose?.();
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
  const handleEnterPreview = async (
    options: { background?: boolean } = {},
  ) => {
    const { background = false } = options;
    console.log("[DEBUG] handleEnterPreview called!", {
      swapType,
      amount,
      toToken,
      fromTokens,
      background,
    });
    if (!toToken || !amount) {
      console.log("[DEBUG] Aborted: missing toToken or amount");
      return;
    }
    const isExactOutFlow = activeMode === "send" || swapType === "exactOut";

    if (!isExactOutFlow && fromTokens.length === 0) {
      console.log("[DEBUG] Aborted: exactIn but no fromTokens");
      return;
    }

    setTxError(null);
    setSwapQuoteIssue(null);

    if (
      !background &&
      swapIntentRef.current?.runId === swapRunIdRef.current &&
      intentData &&
      !intentLoading &&
      ((activeMode !== "deposit" && activeMode !== "send") ||
        (intentData.sources ?? []).length > 0)
    ) {
      swapStepRef.current = "preview-intent";
      setSwapStep("preview-intent");
      return;
    }

    if (
      !background &&
      (activeMode === "deposit" || activeMode === "send") &&
      (!intentData ||
        !swapIntentRef.current ||
        swapIntentRef.current.runId !== swapRunIdRef.current ||
        (intentData.sources ?? []).length === 0)
    ) {
      setTxError("Quote unavailable. Please wait for sources to be selected.");
      return;
    }

    const hasCustomSwapRecipient =
      activeMode === "swap" &&
      Boolean(recipientAddress) &&
      (!defaultRecipientAddress ||
        recipientAddress.toLowerCase() !== defaultRecipientAddress.toLowerCase());

    let resolvedRecipientAddress =
      activeMode === "swap" ? effectiveRecipientAddress : recipientAddress;

    if (hasCustomSwapRecipient && !isExactOutFlow) {
      setQuoteRefreshing(false);
      setIntentLoading(false);
      setReceiveMaxCalculating(false);
      setTxError("Custom recipient requires entering a receive amount.");
      return;
    }

    if (activeMode === "send" || hasCustomSwapRecipient) {
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
        resolvedRecipientAddress.toLowerCase() ===
          ownerAddress.toLowerCase()
      ) {
        setTxError("Recipient cannot be the connected wallet.");
        return;
      }
    }

    console.log("[DEBUG] Proceeding to set preview-intent state...");
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

    console.log("Entering preview...", {
      activeMode,
      swapType,
      toToken,
      amount,
      fromTokens,
    });

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

    const logSwapEvent = (
      operation:
        | "swapWithExactIn"
        | "swapWithExactOut"
        | "swapAndExecute"
        | "swapAndTransfer",
      event: { name: string; args: any },
    ) => {
      console.log(`[NexusOne:${operation}:event]`, {
        name: event?.name,
        args: event?.args,
        event,
      });

      if (event?.name === NEXUS_EVENTS.SWAP_STEPS_LIST) {
        const stepList = getSwapStepListFromEvent(event);
        console.groupCollapsed(
          `[NexusOne:${operation}:swap-intent-steps] ${stepList.length} step(s)`,
        );
        console.log("raw event", event);
        console.table(
          stepList.map((step: any, index: number) => ({
            index,
            type: step?.type ?? step?.typeID ?? step?.name ?? "-",
            completed: step?.completed,
            data: step?.data,
            explorerURL: step?.explorerURL ?? step?.data?.explorerURL,
            raw: step,
          })),
        );
        console.groupEnd();
      }
    };

    const handleSwapEvent = (event: { name: string; args: any }) => {
      if (event.name === NEXUS_EVENTS.SWAP_STEPS_LIST) {
        const stepList = getSwapStepListFromEvent(event);
        if (stepList.length > 0) {
          swapStepsListRef.current = stepList as SwapStepType[];
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
        if ((step as any)?.completed !== false) {
          onStepComplete(step as any);
        }
        return;
      }
      if (event.name === NEXUS_EVENTS.SWAP_STEP_COMPLETE) {
        const step = event.args;
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
        if (step?.type === "BRIDGE_DEPOSIT" && (step as any).data?.explorerURL) {
          mergeExplorerUrls({
            sourceExplorerUrl: (step as any).data.explorerURL,
          });
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

    try {
      if (!isExactOutFlow) {
        const fromPayload: {
          chainId: number;
          tokenAddress: `0x${string}`;
          amount: bigint;
        }[] = [];

        const exactInSourceTokens = getExactInSourceTokens(fromTokens, amount);

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
            .toDecimalPlaces(Math.max(0, token.decimals || 18), Decimal.ROUND_DOWN)
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

        console.log("SWAPPING WITH EXACTIN", {
          from: fromPayload,
          toChainId: toToken.chainId!,
          toTokenAddress: toToken.contractAddress as `0x${string}`,
        });
        resetExplorerUrls();
        // Start exact-in swap — the intent hook will fire and populate preview
        const result = await nexusSDK.swapWithExactIn(
          {
            from: fromPayload,
            toChainId: toToken.chainId!,
            toTokenAddress: toToken.contractAddress as `0x${string}`,
          },
          {
            onEvent: (event: any) => {
              logSwapEvent("swapWithExactIn", event);
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
          extractIntentIdFromUrl(intentExplorerUrl) ?? currentSwapEntry?.intentId;
        if (
          swapRunIdRef.current === runId &&
          swapStepRef.current === "progress"
        ) {
          finishCurrentSwapHistoryEntry("fulfilled", {
            intentExplorerUrl,
            intentId,
            finalExplorerUrl:
              explorerUrlsRef.current.destinationExplorerUrl ||
              explorerUrlsRef.current.sourceExplorerUrl,
          });
          onComplete?.();
          setSwapStep("success");
        }
      } else {
        console.log("[DEBUG] Parsing units using decimals:", toToken.decimals);
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
        console.log("[DEBUG] amountBigInt generated:", amountBigInt);

        console.log(`SWAPPING WITH EXACTOUT (${activeMode})`, {
          toChainId: toToken.chainId!,
          toTokenAddress: toToken.contractAddress as `0x${string}`,
          toAmount: amountBigInt,
        });

        resetExplorerUrls();

        const fromSourcesPayload = buildFromSourcesPayload(
          getExactOutSourceTokens(),
        );

        const isNative =
          !toToken.contractAddress ||
          toToken.contractAddress.toLowerCase() ===
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
          toToken.contractAddress ===
            "0x0000000000000000000000000000000000000000";
        const shouldTransferSwapOutput =
          activeMode === "swap" &&
          Boolean(resolvedRecipientAddress) &&
          (!defaultRecipientAddress ||
            resolvedRecipientAddress.toLowerCase() !==
              defaultRecipientAddress.toLowerCase());

        let executeConfig: any;
        if (activeMode === "deposit" && !selectedOpportunity?.execute) {
          throw new Error(
            "Selected deposit opportunity is missing execute parameters.",
          );
        }

        if (activeMode === "deposit" && selectedOpportunity?.execute) {
          executeConfig =
            typeof selectedOpportunity.execute === "function"
              ? selectedOpportunity.execute(
                  amountBigInt,
                  (ownerAddress ?? connectedAddress) as `0x${string}`,
                )
              : selectedOpportunity.execute;
        } else if (activeMode === "send" || shouldTransferSwapOutput) {
          if (isNative) {
            executeConfig = {
              to: resolvedRecipientAddress as `0x${string}`,
              value: amountBigInt,
              gas: BigInt(100000),
            };
          } else {
            executeConfig = {
              to: toToken.contractAddress as `0x${string}`,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "transfer",
                args: [resolvedRecipientAddress as `0x${string}`, amountBigInt],
              }),
              gas: BigInt(100000),
            };
          }
        }

        if (executeConfig) {
          const onEvent = (
            operation: "swapAndExecute" | "swapAndTransfer",
            event: any,
          ) => {
            logSwapEvent(operation, event);
            if (swapRunIdRef.current !== runId) return;
            handleSwapEvent(event);
          };
          const sdkWithOptionalTransfer = nexusSDK as any;
          const result =
            activeMode === "send" &&
            typeof sdkWithOptionalTransfer.swapAndTransfer === "function"
              ? await sdkWithOptionalTransfer.swapAndTransfer(
                  {
                    toChainId: toToken.chainId!,
                    toTokenAddress: toToken.contractAddress as `0x${string}`,
                    toAmount: amountBigInt,
                    recipient: resolvedRecipientAddress as `0x${string}`,
                    ...fromSourcesPayload,
                  },
                  { onEvent: (event: any) => onEvent("swapAndTransfer", event) },
                )
              : await nexusSDK.swapAndExecute(
                  {
                    toChainId: toToken.chainId!,
                    toTokenAddress: toToken.contractAddress as `0x${string}`,
                    toAmount: amountBigInt,
                    execute: executeConfig,
                    ...fromSourcesPayload,
                  },
                  { onEvent: (event: any) => onEvent("swapAndExecute", event) },
                );

          const swapResult = result?.swapResult ?? result?.result ?? null;
          if (!swapResult && activeMode !== "send") {
            throw new Error("Swap failed");
          }
          const executeTxHash =
            result?.executeResponse?.txHash ||
            result?.transactionHash ||
            result?.txHash ||
            null;
          const intentExplorerUrl =
            swapResult?.explorerURL || result?.intentExplorerUrl || null;
          const intentId =
            extractIntentIdFromUrl(intentExplorerUrl) ?? currentSwapEntry?.intentId;
          const finalExplorerUrl =
            result?.explorerUrl ||
            result?.executeExplorerUrl ||
            getExplorerTxUrl(toToken.chainId, executeTxHash);
          if (finalExplorerUrl) {
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
                logSwapEvent("swapWithExactOut", event);
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
            extractIntentIdFromUrl(intentExplorerUrl) ?? currentSwapEntry?.intentId;
          patchCurrentSwapHistoryEntry({ intentExplorerUrl, intentId });
        }

        if (
          swapRunIdRef.current === runId &&
          swapStepRef.current === "progress"
        ) {
          finishCurrentSwapHistoryEntry("fulfilled");
          onComplete?.();
          setSwapStep("success");
        }
      }
    } catch (err: any) {
      console.error("Error in handleEnterPreview:", err);
      if (swapRunIdRef.current !== runId) {
        return;
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
        const fallbackFailedStep =
          activeMode === "deposit" || activeMode === "send"
            ? ({ type: "APPROVAL", typeID: "AP" } as BridgeStepType)
            : ({
                type: "DETERMINING_SWAP",
                typeID: "DETERMINING_SWAP",
              } as unknown as SwapStepType);
        setFailedProgressStep(
          progressEventsRef.current.at(-1)?.step ?? fallbackFailedStep,
        );
        finishCurrentSwapHistoryEntry("failed", { error, ...patch });
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
    if (activeMode !== "swap" || swapStep !== "idle") return;

    if (syncingIntentSourcesRef.current) {
      syncingIntentSourcesRef.current = false;
      return;
    }

    const hasEnoughForQuote =
      Boolean(amount && Number(amount) > 0 && toToken) &&
      (swapType === "exactOut" || fromTokens.length > 0);

    if (!hasEnoughForQuote) {
      clearPendingSwapIntent();
      return;
    }

    clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
    setQuoteRefreshing(true);
    const timer = window.setTimeout(() => {
      void handleEnterPreview({ background: true });
    }, EXACT_OUT_INPUT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (syncingIntentSourcesRef.current) return;
      if (swapStepRef.current === "idle") {
        clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
      }
    };
  }, [activeMode, amount, fromTokens, swapStep, swapType, toToken]);

  useEffect(() => {
    if (activeMode !== "deposit" || swapStep !== "idle") return;

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
      setFromTokens([]);
      setSourceSelectionTouched(false);
      return;
    }

    clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
    setQuoteRefreshing(true);
    const timer = window.setTimeout(() => {
      void handleEnterPreview({ background: true });
    }, EXACT_OUT_INPUT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (syncingIntentSourcesRef.current) return;
      if (swapStepRef.current === "idle") {
        clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
      }
    };
  }, [
    activeMode,
    amount,
    depositAmountMode,
    fromTokens,
    selectedOpportunity,
    swapStep,
    toToken,
  ]);

  useEffect(() => {
    if (activeMode !== "send" || swapStep !== "idle") return;

    if (syncingIntentSourcesRef.current) {
      syncingIntentSourcesRef.current = false;
      return;
    }

    const parsedAmount = parseFiatNumber(amount);
    const hasEnoughForQuote = Boolean(
      parsedAmount?.gt(0) && toToken && recipientAddress,
    );

    if (!hasEnoughForQuote) {
      clearPendingSwapIntent();
      setFromTokens([]);
      setSourceSelectionTouched(false);
      return;
    }

    clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
    setQuoteRefreshing(true);
    const timer = window.setTimeout(() => {
      void handleEnterPreview({ background: true });
    }, EXACT_OUT_INPUT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (syncingIntentSourcesRef.current) return;
      if (swapStepRef.current === "idle") {
        clearPendingSwapIntent(true, { keepQuoteRefreshing: true });
      }
    };
  }, [activeMode, amount, fromTokens, recipientAddress, swapStep, toToken]);

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
      (activeMode === "swap" || activeMode === "deposit" || activeMode === "send") &&
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
      (activeMode === "swap" || activeMode === "deposit" || activeMode === "send") &&
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
      // The swap promise in handleEnterPreview will resolve/reject
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
      return "Swap";
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
      clearPendingSwapIntent();
      setSwapStep("idle");
      return;
    }
    if (swapStep === "progress") {
      return;
    } // can't go back during tx
    setSwapStep("idle");
  };

  const handleSwapAmountChange = (
    val: string,
    panel: "send" | "receive",
  ) => {
    syncingIntentSourcesRef.current = false;
    setSwapQuoteIssue(null);
    const nextAmount = parseFiatNumber(val);
    const shouldLoadQuote = Boolean(
      nextAmount?.gt(0) &&
        toToken &&
        (panel === "receive" || fromTokens.length > 0),
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
    // Auto-switch swapType based on which panel the user changes.
    if (panel === "send" && swapType !== "exactIn") {
      setSwapType("exactIn");
    } else if (panel === "receive" && swapType !== "exactOut") {
      setSwapType("exactOut");
    }
  };

  const handleDepositAmountChange = (val: string) => {
    syncingIntentSourcesRef.current = false;
    setSwapQuoteIssue(null);
    const nextAmount = parseFiatNumber(val);
    const shouldLoadQuote = Boolean(
      nextAmount?.gt(0) && toToken && selectedOpportunity,
    );
    clearPendingSwapIntent(true, { keepQuoteRefreshing: shouldLoadQuote });
    if (shouldLoadQuote) {
      setQuoteRefreshing(true);
    } else {
      setFromTokens([]);
      setSourceSelectionTouched(false);
    }
    setAmount(val);
  };

  const handleSendAmountChange = (val: string) => {
    syncingIntentSourcesRef.current = false;
    setSwapQuoteIssue(null);
    setSwapType("exactOut");
    const nextAmount = parseFiatNumber(val);
    const shouldLoadQuote = Boolean(
      nextAmount?.gt(0) && toToken && recipientAddress,
    );
    clearPendingSwapIntent(true, { keepQuoteRefreshing: shouldLoadQuote });
    if (shouldLoadQuote) {
      setQuoteRefreshing(true);
    } else {
      setFromTokens([]);
      setSourceSelectionTouched(false);
    }
    setAmount(val);
  };

  const handleDepositAmountModeToggle = () => {
    syncingIntentSourcesRef.current = false;
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

    if (pct !== 100) {
      const usdAmount = getTotalBalancePercentUsdAmount(pct);
      const nextAmount =
        depositAmountMode === "usd"
          ? usdAmount.toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed()
          : formatTokenAmountFromUsd(usdAmount, toToken);

      if (!nextAmount) {
        setQuoteRefreshing(false);
        setReceiveMaxCalculating(false);
        setTxError("Unable to calculate this percentage for the deposit asset.");
        return;
      }

      setReceiveMaxCalculating(false);
      handleDepositAmountChange(nextAmount);
      return;
    }

    if (!nexusSDK || !toToken.chainId) return;

    const calculateMaxForSwap = nexusSDK.calculateMaxForSwap;
    if (typeof calculateMaxForSwap !== "function") return;

    setQuoteRefreshing(false);
    setReceiveMaxCalculating(true);

    try {
      const max = await calculateMaxForSwap({
        toChainId: toToken.chainId,
        toTokenAddress: (toToken.contractAddress || zeroAddress) as `0x${string}`,
      });
      const decimals = Number.isFinite(Number(max.decimals))
        ? Number(max.decimals)
        : toToken.decimals || 18;
      const maxAmount =
        parseFiatNumber(max.maxAmount) ??
        (max.maxAmountRaw !== undefined
          ? new Decimal(max.maxAmountRaw.toString()).div(
              new Decimal(10).pow(decimals),
            )
          : undefined);

      if (!maxAmount || maxAmount.lte(0)) {
        setReceiveMaxCalculating(false);
        setQuoteRefreshing(false);
        setTxError("No depositable amount is available for this opportunity.");
        return;
      }

      const safeMaxAmount = maxAmount.mul(receiveMaxSafetyMultiplier);
      const depositAmount =
        pct === 100 ? safeMaxAmount : safeMaxAmount.mul(pct).div(100);
      const nextAmount = depositAmount
        .toDecimalPlaces(Math.max(0, decimals), Decimal.ROUND_DOWN)
        .toFixed();

      setDepositAmountMode("token");
      handleDepositAmountChange(nextAmount);
      setReceiveMaxCalculating(false);
      setQuoteRefreshing(true);
    } catch (error: any) {
      console.error("Unable to calculate max deposit amount", error);
      setReceiveMaxCalculating(false);
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

    if (pct !== 100) {
      const usdAmount = getTotalBalancePercentUsdAmount(pct);
      const nextAmount = formatTokenAmountFromUsd(usdAmount, toToken);

      if (!nextAmount) {
        setQuoteRefreshing(false);
        setReceiveMaxCalculating(false);
        setTxError("Unable to calculate this percentage for the send asset.");
        return;
      }

      setReceiveMaxCalculating(false);
      handleSendAmountChange(nextAmount);
      return;
    }

    if (!nexusSDK || !toToken.chainId) return;

    const calculateMaxForSwap = nexusSDK.calculateMaxForSwap;
    if (typeof calculateMaxForSwap !== "function") return;

    setQuoteRefreshing(false);
    setReceiveMaxCalculating(true);

    try {
      const max = await calculateMaxForSwap({
        toChainId: toToken.chainId,
        toTokenAddress: (toToken.contractAddress || zeroAddress) as `0x${string}`,
      });
      const decimals = Number.isFinite(Number(max.decimals))
        ? Number(max.decimals)
        : toToken.decimals || 18;
      const maxAmount =
        parseFiatNumber(max.maxAmount) ??
        (max.maxAmountRaw !== undefined
          ? new Decimal(max.maxAmountRaw.toString()).div(
              new Decimal(10).pow(decimals),
            )
          : undefined);

      if (!maxAmount || maxAmount.lte(0)) {
        setReceiveMaxCalculating(false);
        setQuoteRefreshing(false);
        setTxError("No transferable amount is available for this asset.");
        return;
      }

      const safeMaxAmount = maxAmount.mul(receiveMaxSafetyMultiplier);
      const sendAmount =
        pct === 100 ? safeMaxAmount : safeMaxAmount.mul(pct).div(100);
      const nextAmount = sendAmount
        .toDecimalPlaces(Math.max(0, decimals), Decimal.ROUND_DOWN)
        .toFixed();

      handleSendAmountChange(nextAmount);
      setReceiveMaxCalculating(false);
      setQuoteRefreshing(true);
    } catch (error: any) {
      console.error("Unable to calculate max send amount", error);
      setReceiveMaxCalculating(false);
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
    (activeMode === "swap" || activeMode === "deposit" || activeMode === "send") &&
    swapQuoteIssue?.type === "insufficientSources"
      ? swapQuoteIssue
      : null;
  const isExactOutRouteLoading =
    (activeMode === "swap" || activeMode === "deposit" || activeMode === "send") &&
    swapStep === "idle" &&
    swapType === "exactOut" &&
    Boolean(toToken && (receiveMaxCalculating || (amount && Number(amount) > 0))) &&
    !exactOutInsufficientSourceIssue &&
    (quoteRefreshing || intentLoading || receiveMaxCalculating);
  const hasCurrentRunnableIntent =
    Boolean(intentData && swapIntentRef.current) &&
    swapIntentRef.current?.runId === swapRunIdRef.current &&
    !intentLoading;
  const hasIntentSources = Boolean((intentData?.sources ?? []).length > 0);
  const isQuoteUnavailableForAutoSourceFlow =
    (activeMode === "deposit" || activeMode === "send") &&
    Boolean(amount && Number(amount) > 0 && toToken) &&
    !quoteRefreshing &&
    !receiveMaxCalculating &&
    !intentLoading &&
    !exactOutInsufficientSourceIssue &&
    (!hasCurrentRunnableIntent || !hasIntentSources);
  const isSwapCtaDisabled =
    !amount ||
    Number(amount) <= 0 ||
    (swapType === "exactIn" && (fromTokens.length === 0 || !toToken)) ||
    (swapType === "exactOut" && !toToken) ||
    receiveMaxCalculating ||
    quoteRefreshing ||
    Boolean(exactOutInsufficientSourceIssue);
  const isDepositCtaDisabled =
    !amount ||
    Number(amount) <= 0 ||
    !toToken ||
    quoteRefreshing ||
    receiveMaxCalculating ||
    isQuoteUnavailableForAutoSourceFlow ||
    Boolean(exactOutInsufficientSourceIssue);
  const isSendCtaDisabled =
    !amount ||
    Number(amount) <= 0 ||
    !toToken ||
    !recipientAddress ||
    quoteRefreshing ||
    receiveMaxCalculating ||
    isQuoteUnavailableForAutoSourceFlow ||
    Boolean(exactOutInsufficientSourceIssue);
  const quoteCtaLabel = (fallback: string) =>
    exactOutInsufficientSourceIssue
      ? "Insufficient balance"
      : receiveMaxCalculating
      ? "Calculating..."
      : quoteRefreshing
        ? "Fetching quotes..."
        : isQuoteUnavailableForAutoSourceFlow
          ? "Quote unavailable"
        : !amount || Number(amount) <= 0
          ? "Enter amount"
          : fallback;
  const previewIntentSourceUsdNumber = (intentData?.sources ?? []).reduce(
    (sum, source) => sum.plus(parseFiatNumber((source as any).value) ?? new Decimal(0)),
    new Decimal(0),
  );
  const previewSourceUsdNumber =
    previewIntentSourceUsdNumber.gt(0)
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
  const previewDestinationUsdNumber =
    parseFiatNumber((intentData?.destination as any)?.value);
  const previewFromAmountUsd =
    previewSourceUsdNumber && previewSourceUsdNumber.gt(0)
      ? previewSourceUsdNumber.toDecimalPlaces(6).toFixed()
      : undefined;
  const previewToAmountUsd =
    previewDestinationUsdNumber && previewDestinationUsdNumber.gt(0)
      ? previewDestinationUsdNumber.toDecimalPlaces(6).toFixed()
      : undefined;
  const totalSwapBalanceUsd = getSwapBalanceTotalUsd()
    .toDecimalPlaces(2)
    .toFixed();
  const sendAmountUsd =
    amount && toToken?.symbol
      ? getFiatValue(Number(amount) || 0, toToken.symbol)
      : 0;
  const resolvedToToken =
    toToken ??
    (activeMode === "deposit" && selectedOpportunity
      ? toTokenFromOpportunity(selectedOpportunity)
      : undefined);
  const toTokenWithFetchedBalance =
    resolvedToToken && destinationBalance
      ? { ...resolvedToToken, balance: destinationBalance }
      : resolvedToToken;
  const isIdleSwapQuoteLoading =
    activeMode === "swap" && swapStep === "idle" && quoteRefreshing;
  const isReceiveAmountLoading =
    receiveMaxCalculating ||
    (isIdleSwapQuoteLoading && swapType === "exactIn" && !intentToAmount);
  const isReceiveUsdLoading =
    receiveMaxCalculating ||
    (isIdleSwapQuoteLoading && swapType === "exactIn" && !previewToAmountUsd);
  const hasQuoteRefreshCountdown =
    (activeMode === "swap" || activeMode === "deposit" || activeMode === "send") &&
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

  return (
    <div
      data-nexus-one-root
      style={{
        backgroundColor: "#F9F9F8",
        backgroundImage:
          "url(/nexus-one/card-bg.png)",
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
        overflow: isDrawerOverlayActive ? "hidden" : "visible",
        position: "relative",
        transition: hasMeasuredRootContent ? "height 260ms ease" : undefined,
        willChange: "height",
        maxWidth: "450px",
        width: "90%",
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
              fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
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

          {/* Protocol chip appended next to Title when Deposit Protocol selected */}
          {isTitleCentered() &&
            activeMode === "deposit" &&
            swapStep === "idle" &&
            selectedOpportunity && (
              <div className="relative pointer-events-auto flex items-center ml-2">
                <button
                  onClick={() => {
                    clearPendingSwapIntent();
                    setSelectedOpportunity(undefined);
                    setToToken(undefined);
                    setFromTokens([]);
                    setAmount("");
                    setDepositAmountMode("token");
                  }}
                  className="flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-[4px] hover:bg-black/5 transition-colors"
                  style={{
                    fontFamily: "var(--font-geist-mono), sans-serif",
                    fontSize: "10px",
                    fontWeight: 500,
                    color: "var(--foreground-muted, #848483)",
                    background: "var(--background-tertiary, #F0F0EF)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {selectedOpportunity.title || selectedOpportunity.protocol}
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
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
                    toAmount={intentToAmount}
                    toAmountUsd={previewToAmountUsd}
                    toAmountTokens={
                      intentToAmount ? `${intentToAmount}` : undefined
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
                    recipientAddress={
                      activeMode === "send" ? recipientAddress : undefined
                    }
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
                  toAmount={intentToAmount}
                  toAmountUsd={previewToAmountUsd}
                  intentData={intentData}
                  mode={activeMode}
                  opportunity={selectedOpportunity}
                  steps={steps}
                  progressEvents={progressEvents}
                  failedStep={failedProgressStep}
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
                  swapType === "exactIn" ? intentToAmount : undefined
                }
                isReceiveAmountLoading={isReceiveAmountLoading}
                isReceiveUsdLoading={isReceiveUsdLoading}
                onAmountChange={(val, panel) => {
                  handleSwapAmountChange(val, panel);
                }}
                fromTokens={fromTokens}
                toToken={toTokenWithFetchedBalance}
                receiveQuoteUsd={previewToAmountUsd}
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
                onOpenSourcePicker={(index) => {
                  setEditingAssetIndex(index ?? null);
                  openDrawerStep("choose-swap-asset");
                }}
                onOpenDestPicker={() => openDrawerStep("choose-receive-asset")}
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
                    onClick={() => void handleEnterPreview()}
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
	                      borderRadius: exactOutInsufficientSourceIssue ? "4px" : "8px",
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
                    ) : (quoteRefreshing || receiveMaxCalculating) ? (
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
	                        fontSize: exactOutInsufficientSourceIssue ? "15px" : "16px",
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
              {/* Opportunity list */}
              {config.opportunities &&
                config.opportunities.length > 0 &&
                !selectedOpportunity && (
                  <>
                    <OpportunityList
                      opportunities={config.opportunities}
                      selectedId={
                        pendingOpportunity?.id ?? config.opportunities[0]?.id
                      }
                      onSelect={setPendingOpportunity}
                    />

                    {/* Done button for opportunity selection */}
                    <div
                      style={{
                        boxSizing: "border-box",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={() => {
                          const opportunity =
                            pendingOpportunity ?? config.opportunities?.[0];
                          if (opportunity) {
                            handleSelectDepositOpportunity(opportunity);
                            setSwapStep("idle");
                          }
                        }}
                        style={{
                          alignItems: "center",
                          backgroundColor: "#006BF4",
                          borderRadius: "8px",
                          boxShadow: "#5555550D 0px 1px 4px",
                          boxSizing: "border-box",
                          display: "flex",
                          flex: 1,
                          height: "48px",
                          justifyContent: "center",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            boxSizing: "border-box",
                            color: "#FFFFFE",
                            fontFamily: '"Geist", system-ui, sans-serif',
                            fontSize: "15px",
                            fontWeight: 500,
                            lineHeight: "18px",
                          }}
                        >
                          Done
                        </div>
                      </button>
                    </div>
                  </>
                )}

              {/* After opportunity selected — show deposit form */}
              {(!config.opportunities ||
                config.opportunities.length === 0 ||
                selectedOpportunity) && (
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
                    fromTokens={fromTokens}
                    onOpenSourcePicker={() => openDrawerStep("choose-swap-asset")}
                    onSetPercent={handleDepositPercentSelect}
                    routeStatus={
                      exactOutInsufficientSourceIssue
                        ? "insufficient"
                        : isExactOutRouteLoading
                          ? "loading"
                          : undefined
                    }
                    routeMessage={exactOutInsufficientSourceIssue?.message}
                    isCalculatingMax={receiveMaxCalculating}
                    isQuoteRefreshing={quoteRefreshing || intentLoading}
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
                      onClick={() => void handleEnterPreview()}
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
	                        borderRadius: exactOutInsufficientSourceIssue ? "4px" : "8px",
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
                      ) : quoteRefreshing || receiveMaxCalculating ? (
                        <Loader2
                          className="animate-spin"
                          style={{
                            color: isDepositCtaDisabled ? "#9E9E9C" : "#FFFFFE",
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
	                          fontSize: exactOutInsufficientSourceIssue ? "15px" : "16px",
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
                fromTokens={fromTokens}
                totalBalance={totalSwapBalanceUsd}
                usdValue={
                  amount && sendAmountUsd > 0 ? sendAmountUsd.toFixed(2) : ""
                }
                onOpenAssetPicker={() => openDrawerStep("choose-receive-asset")}
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
                    : isExactOutRouteLoading
                      ? "loading"
                      : undefined
                }
                routeMessage={exactOutInsufficientSourceIssue?.message}
                isCalculatingMax={receiveMaxCalculating}
                isQuoteRefreshing={quoteRefreshing}
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
                  onClick={() => void handleEnterPreview()}
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
	                    borderRadius: exactOutInsufficientSourceIssue ? "4px" : "8px",
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
                  ) : quoteRefreshing || receiveMaxCalculating ? (
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
	                      fontSize: exactOutInsufficientSourceIssue ? "15px" : "16px",
                      fontWeight: 500,
                      lineHeight: "24px",
                    }}
                  >
                    {quoteCtaLabel("Review send")}
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
                  <ArrowLeft style={{ color: "#161615", height: "16px", width: "16px" }} />
                </button>
                <div
                  style={{
                    color: "#161615",
                    fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
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
                preserveSelectedBelowMinimum={
                  activeMode === "deposit" ||
                  activeMode === "send" ||
                  (activeMode === "swap" && swapType === "exactOut")
                }
                allowSelectedTokenRemoval={
                  activeMode === "swap" && swapType === "exactOut"
                }
                hideCustomTab={activeMode === "swap"}
                autoSelectFilterTabs={
                  activeMode === "deposit" || activeMode === "send"
                }
                lockedTokens={lockedDestinationSourceTokens}
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
                        clearPendingSwapIntent();
                        setSourceSelectionTouched(true);
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
                        clearPendingSwapIntent();
                        setSourceSelectionTouched(true);
                        setFromTokens([]);
                      }
                    : undefined
                }
                onToggle={(token) => {
                  clearPendingSwapIntent();
                  if (activeMode === "deposit" || activeMode === "send") {
                    setSourceSelectionTouched(true);
                  }
                  setFromTokens((prev) => {
                    const isSameSelection = (a: SwapTokenOption, b: SwapTokenOption) => {
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
                        activeMode === "swap" &&
                        swapType === "exactIn" &&
                        prev.length === 0
                          ? amount
                          : "",
                    });

                    if (
                      isDepositOrSendSourcePicker &&
                      token.isUnified &&
                      sourceTokens.length > 0
                    ) {
                      const hasUnifiedSelection = prev.some(isSameUnifiedGroup);
                      const areAllChildrenSelected = sourceTokens.every((source) =>
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
                        ...sourceTokens.map((source) => withDefaultAmount(source)),
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
                    return [
                      ...next,
                      withDefaultAmount(token),
                    ];
                  });
                }}
                onDone={closeDrawerToIdle}
                onSelect={(token) => {
                  if (activeMode === "swap" && swapType === "exactIn") {
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
                    setFromTokens(next);
                    closeDrawerToIdle();
                  } else if (
                    activeMode === "deposit" ||
                    activeMode === "send"
                  ) {
                    clearPendingSwapIntent();
                    setSourceSelectionTouched(true);
                    setFromTokens([{ ...token, userAmount: amount }]);
                    closeDrawerToIdle();
                  } else {
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
                    const newToken = {
                      ...token,
                      userAmount: tokenChanged
                        ? ""
                        : existingToken?.userAmount || "",
                    };
                    if (
                      targetIndex !== null
                    ) {
                      next[targetIndex] = newToken;
                    } else {
                      const exists = next.some(
                        (item) =>
                          isSameTokenSelection(item, token),
                      );
                      if (!exists) {
                        next.push(newToken);
                      }
                    }
                    const sourceAmount = getSourceAmountInput(next);
                    if (tokenChanged) {
                      clearPendingSwapIntent();
                    }
                    setFromTokens(next);
                    if (sourceAmount) {
                      setAmount(sourceAmount);
                      setSwapType("exactIn");
                    }
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
                  if (activeMode === "send") {
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
                    if (swapType === "exactOut") {
                      setAmount("");
                    }
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
}

export default NexusOne;
