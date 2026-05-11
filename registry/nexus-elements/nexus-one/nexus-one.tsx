"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  type NexusOneProps,
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
} from "./components/swap-asset-selector";
import {
  SwapIntentPreview,
  type SwapIntentData,
} from "./components/swap-intent-preview";
import { ReceiveAssetSelector, preloadReceiveTokens } from "./components/receive-asset-selector";
import { OpportunityList } from "./components/opportunity-list";
import { ChevronDown, ArrowLeft } from "lucide-react";
import { useNexus } from "../nexus/NexusProvider";
import { useTransactionSteps } from "../common/tx/useTransactionSteps";
import { SWAP_EXPECTED_STEPS } from "../common/tx/steps";
import {
  CHAIN_METADATA,
  NEXUS_EVENTS,
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
  status: SwapHistoryStatus;
  startedAt: number;
  endedAt?: number;
  durationSeconds?: number;
  intentData: SwapIntentData | null;
  fromTokens: SwapTokenOption[];
  toToken?: SwapTokenOption;
  feeUsd?: string;
  intentId?: number;
  intentExplorerUrl?: string | null;
  sourceExplorerUrl?: string | null;
  finalExplorerUrl?: string | null;
  error?: string;
}

const QUOTE_REFRESH_INTERVAL_MS = 30000;
const REFUND_FALLBACK_DELAY_MS = 30 * 60 * 1000;
const tooltipSurface = "#FFFFFE";
const tooltipText = "var(--foreground-primary, #161615)";
const tooltipBorder = "var(--border-default, #E8E8E7)";
const uiFont = '"Geist", var(--font-geist-sans), system-ui, sans-serif';

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
            borderRadius: "8px",
            boxShadow: "0 6px 18px rgba(22,22,21,0.10)",
            color: tooltipText,
            fontFamily: uiFont,
            fontSize: "11px",
            fontWeight: 500,
            left: "50%",
            lineHeight: "15px",
            padding: "7px 9px",
            pointerEvents: "none",
            position: "absolute",
            top: "calc(100% + 8px)",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
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
  return match ? Number(match[1]) : undefined;
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
}: {
  entry: SwapHistoryEntry;
  maxHeight?: number;
  borderTopFirst?: boolean;
}) {
  const rows = getSourceRows(entry);
  const shouldScroll = rows.length > 4;
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
  const tokenSymbol = destination?.token.symbol || entry.toToken?.symbol || "";
  const chainName = destination?.chain.name || entry.toToken?.chainName || "";
  const amount = destination?.amount || "";
  const value = destination?.value;
  const duration = entry.durationSeconds ?? 0;
  const intentLabel = entry.intentId ? `Intent #${entry.intentId}` : "View Intent";
  const sourceCount = getSourceRows(entry).length;

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
            src={entry.toToken?.logo}
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
          {isFailed ? "You were about to receive" : "You received"}
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
        <div
          style={{
            color: "#848483",
            fontFamily: uiFont,
            fontSize: "13px",
            marginTop: "14px",
          }}
        >
          {chainName ? `on ${chainName} · ` : ""}
          {isFailed ? "failed" : "completed"} in {duration || 0}s
        </div>
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
            You Swapped
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
            <SourceRowsList entry={entry} borderTopFirst={false} />
          </div>
        </div>
        {entry.intentExplorerUrl && (
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
              href={entry.intentExplorerUrl}
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
      </div>

      <button
        onClick={onDone}
        style={{
          alignItems: "center",
          background: "#006BF4",
          border: "none",
          borderRadius: "8px",
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {entries.map((entry) => {
        const destination = entry.intentData?.destination;
        const destinationLogo = entry.toToken?.logo;
        const destinationChainLogo =
          destination?.chain.logo || entry.toToken?.chainLogo || "";
        const destinationChainName =
          destination?.chain.name || entry.toToken?.chainName || "";
        const destinationSymbol = destination?.token.symbol || entry.toToken?.symbol || "";
        const destinationValue = destination?.value;
        const destinationAmount = destination?.amount || "";
        const viewUrl = entry.intentExplorerUrl || entry.finalExplorerUrl;
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
                  {getRelativeTime(entry.startedAt, now)}
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
                <span style={{ color: "#848483", fontFamily: uiFont, fontSize: "13px" }}>
                  {entry.intentId ? `Intent #${entry.intentId}` : "Intent"}
                </span>
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
  connectedAddress,
  onComplete,
  onStart,
  onError,
}: NexusOneProps) {
  const {
    nexusSDK,
    bridgableBalance,
    swapBalance,
    getFiatValue,
    swapSupportedChainsAndTokens,
    supportedChainsAndTokens,
  } = useNexus();

  // Mode is a single value, not an array
  const activeMode = config.mode;

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
  const [fromTokens, setFromTokens] = useState<SwapTokenOption[]>([]);
  const [toToken, setToToken] = useState<SwapTokenOption | undefined>(
    undefined,
  );

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
    onStepComplete,
    reset: resetSteps,
  } = useTransactionSteps<SwapStepType>();
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
  const [transferExplorerUrl, setTransferExplorerUrl] = useState<string | null>(
    null,
  );
  const swapStepRef = useRef<SwapStep>(swapStep);
  const syncingIntentSourcesRef = useRef(false);
  const lastSwapIntentRefreshAtRef = useRef(0);
  const [destinationBalance, setDestinationBalance] = useState<string | null>(
    null,
  );
  const [swapHistory, setSwapHistory] = useState<SwapHistoryEntry[]>([]);
  const [currentSwapId, setCurrentSwapId] = useState<string | null>(null);
  const [historyNow, setHistoryNow] = useState(() => Date.now());
  const currentSwapIdRef = useRef<string | null>(null);
  const currentSwapStartedAtRef = useRef(0);
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
    currentSwapIdRef.current = currentSwapId;
  }, [currentSwapId]);

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
      balanceInFiat: Number.isFinite(sourceValue)
        ? `$${sourceValue.toFixed(2)}`
        : "$0.00",
      chainId: source.chain.id,
      chainName: chainMeta?.name ?? source.chain.name,
      chainLogo: chainMeta?.logo ?? source.chain.logo,
      userAmount: source.amount,
      userAmountMode: "token",
    };
  };

  const clearPendingSwapIntent = (clearQuote = true) => {
    swapRunIdRef.current += 1;
    swapIntentRef.current?.deny();
    swapIntentRef.current = null;
    setIntentLoading(false);
    setQuoteRefreshing(false);
    setReceiveMaxCalculating(false);
    setPreviewQuoteRefreshing(false);
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

  const getTokenUsdValue = (
    token: SwapTokenOption,
    fallbackAmount?: string,
  ) => {
    const amountNumber =
      parseFiatNumber(token.userAmount || fallbackAmount) ?? new Decimal(0);
    if (amountNumber.lte(0)) return new Decimal(0);
    if (token.userAmountMode === "usd") return amountNumber;

    const rate = getTokenUsdRate(token);
    return rate.gt(0) ? amountNumber.mul(rate) : new Decimal(0);
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
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
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

  const startSwapHistoryEntry = () => {
    const id = `${Date.now()}-${swapRunIdRef.current}`;
    const now = Date.now();
    const resolvedToToken =
      toToken && destinationBalance
        ? { ...toToken, balance: destinationBalance }
        : toToken;
    const entry: SwapHistoryEntry = {
      id,
      status: "pending",
      startedAt: now,
      intentData,
      fromTokens,
      toToken: resolvedToToken,
      feeUsd: intentFeeUsd,
      sourceExplorerUrl: null,
      finalExplorerUrl: null,
      intentExplorerUrl: null,
    };

    currentSwapStartedAtRef.current = 0;
    currentSwapIdRef.current = id;
    setCurrentSwapId(id);
    setSwapHistory((prev) => [entry, ...prev]);
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

      if (activeMode === "swap" && swapType === "exactOut") {
        const intentSources = intent.sources ?? [];
        if (intentSources.length > 0) {
          syncingIntentSourcesRef.current = true;
          setFromTokens(intentSources.map(buildIntentSourceToken));
        }
      }

      try {
        const bridgeFees = intent.feesAndBuffer?.bridge;
        const bridgeTotal =
          typeof bridgeFees === "string"
            ? parseFiatNumber(bridgeFees)
            : parseFiatNumber(bridgeFees?.total);

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
  >(undefined);

  const toTokenFromOpportunity = (
    opp: DepositOpportunity,
  ): SwapTokenOption => ({
    chainId: opp.chainId,
    contractAddress: opp.tokenAddress,
    symbol: opp.tokenSymbol,
    name: opp.tokenSymbol,
    balance: "0",
    balanceInFiat: "$0.00",
    decimals: 18,
    logo:
      opp.tokenLogo ||
      TOKEN_METADATA[opp.tokenSymbol as keyof typeof TOKEN_METADATA]?.icon,
  });

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
  }, [activeMode, config.opportunities, selectedOpportunity]);

  useEffect(() => {
    if (activeMode === "swap") return;
    if (swapStep !== "idle") return;

    const hasEnoughForQuote =
      activeMode === "deposit"
        ? Boolean(amount && Number(amount) > 0 && toToken)
        : Boolean(amount && Number(amount) > 0 && toToken && recipientAddress);

    if (!hasEnoughForQuote) {
      setQuoteRefreshing(false);
      return;
    }

    setQuoteRefreshing(true);
    const timer = window.setTimeout(() => {
      setQuoteRefreshing(false);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    activeMode,
    amount,
    fromTokens,
    recipientAddress,
    swapStep,
    swapType,
    toToken,
  ]);

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
  const depositUsdValue = getFiatValue(
    Number(amount) || 0,
    selectedOpportunity?.tokenSymbol || "USDC",
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleReset = () => {
    clearPendingSwapIntent();
    setAmount("");
    setRecipientAddress("");
    setTxError(null);
    setSwapStep("idle");
    setFromTokens([]);
    setToToken(undefined);
    setSelectedOpportunity(undefined);
  };

  const handleOpenRecipientEditor = () => {
    if (activeMode === "swap" && !recipientAddress && defaultRecipientAddress) {
      setRecipientAddress(defaultRecipientAddress);
    }
    setTxError(null);
    setSwapStep("enter-recipient");
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
    setSwapStep("idle");
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

    if (
      !background &&
      swapIntentRef.current?.runId === swapRunIdRef.current &&
      intentData &&
      !intentLoading
    ) {
      swapStepRef.current = "preview-intent";
      setSwapStep("preview-intent");
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

    if (!nexusSDK) {
      setTxError("SDK not initialized");
      if (!background) {
        setSwapStep("idle");
      }
      setIntentLoading(false);
      setQuoteRefreshing(false);
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

    const handleSwapEvent = (event: { name: string; args: SwapStepType }) => {
      if (event.name === NEXUS_EVENTS.SWAP_STEP_COMPLETE) {
        const step = event.args;
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
        onStepComplete(step);
      }
    };

    try {
      if (!isExactOutFlow) {
        const fromPayload: {
          chainId: number;
          tokenAddress: `0x${string}`;
          amount: bigint;
        }[] = [];

        for (const token of fromTokens) {
          // Determine the amount to use for this specific token
          let rawAmountStr = token.userAmount;
          if (!rawAmountStr && fromTokens.length === 1) {
            rawAmountStr = amount; // fallback for single-token case
          }

          let cleanAmount = Number(rawAmountStr || "0");
          if (cleanAmount <= 0) continue;

          if (token.userAmountMode === "usd") {
            const tokenBalance =
              Number(String(token.balance).replace(/[^0-9.]/g, "")) || 0;
            const fiatBalance =
              Number(String(token.balanceInFiat).replace(/[^0-9.]/g, "")) || 0;
            const price = tokenBalance > 0 ? fiatBalance / tokenBalance : 0;
            if (price > 0) {
              cleanAmount = cleanAmount / price;
            } else {
              cleanAmount = 0;
            }
          }

          if (cleanAmount <= 0) continue;

          const safeTokenAmountStr = cleanAmount.toFixed(
            Math.min(token.decimals || 18, 18),
          );

          fromPayload.push({
            chainId: token.chainId!,
            tokenAddress: token.contractAddress as `0x${string}`,
            amount: nexusSDK.utils.parseUnits(
              safeTokenAmountStr,
              token.decimals || 18,
            ),
          });
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
        const amountBigInt = nexusSDK.utils.parseUnits(
          amount,
          toToken.decimals || 18,
        );
        console.log("[DEBUG] amountBigInt generated:", amountBigInt);

        console.log(`SWAPPING WITH EXACTOUT (${activeMode})`, {
          toChainId: toToken.chainId!,
          toTokenAddress: toToken.contractAddress as `0x${string}`,
          toAmount: amountBigInt,
        });

        resetExplorerUrls();

        const fromSourcesPayload =
          fromTokens.length > 0
            ? {
                fromSources: fromTokens.map((token) => ({
                  chainId: token.chainId!,
                  tokenAddress: token.contractAddress as `0x${string}`,
                })),
              }
            : {};

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
          const result = await nexusSDK.swapAndExecute(
            {
              toChainId: toToken.chainId!,
              toTokenAddress: toToken.contractAddress as `0x${string}`,
              toAmount: amountBigInt,
              execute: executeConfig,
              ...fromSourcesPayload,
            },
            {
              onEvent: (event: any) => {
                if (swapRunIdRef.current !== runId) return;
                handleSwapEvent(event);
              },
            },
          );
          if (!result?.swapResult) {
            throw new Error("Swap failed");
          }
          const intentExplorerUrl = result.swapResult.explorerURL || null;
          const intentId =
            extractIntentIdFromUrl(intentExplorerUrl) ?? currentSwapEntry?.intentId;
          patchCurrentSwapHistoryEntry({ intentExplorerUrl, intentId });
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
      if (err?.code === "USER_DENIED_INTENT") {
        if (currentSwapIdRef.current) {
          finishCurrentSwapHistoryEntry("failed", {
            error: "Transaction cancelled by user",
          });
          setSwapStep("failed");
        } else if (!background && swapStepRef.current === "preview-intent") {
          setSwapStep("idle");
        }
        return;
      }
      const errorMessage =
        err?.message ||
        (typeof err === "string"
          ? err
          : "Transaction failed. Please try again or check console.");
      if (currentSwapIdRef.current || swapStepRef.current === "progress") {
        finishCurrentSwapHistoryEntry("failed", { error: errorMessage });
        setSwapStep("failed");
      } else if (!background || swapStepRef.current === "preview-intent") {
        setSwapStep("idle");
      }
      setTxError(errorMessage);
      onError?.(errorMessage);
    }
  };

  useEffect(() => {
    if (syncingIntentSourcesRef.current) {
      syncingIntentSourcesRef.current = false;
      return;
    }

    if (activeMode !== "swap" || swapStep !== "idle") return;

    const hasEnoughForQuote =
      Boolean(amount && Number(amount) > 0 && toToken) &&
      (swapType === "exactOut" || fromTokens.length > 0);

    if (!hasEnoughForQuote) {
      clearPendingSwapIntent();
      return;
    }

    setQuoteRefreshing(true);
    const timer = window.setTimeout(() => {
      void handleEnterPreview({ background: true });
    }, 750);

    return () => {
      window.clearTimeout(timer);
      if (syncingIntentSourcesRef.current) return;
      if (swapStepRef.current === "idle") {
        clearPendingSwapIntent();
      }
    };
  }, [activeMode, amount, fromTokens, swapStep, swapType, toToken]);

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
      activeMode === "swap" &&
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
      activeMode === "swap" &&
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
      seed(SWAP_EXPECTED_STEPS);
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
      return "Deposit";
    }
    if (activeMode === "send") return "Send";
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
    if (swapStep === "choose-receive-asset") {
      setSwapStep("idle");
      return;
    }
    if (swapStep === "enter-recipient") {
      setSwapStep("idle");
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
    clearPendingSwapIntent();
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

  const handleReceivePercentSelect = async (pct: number) => {
    if (!nexusSDK || !toToken?.chainId) return;

    const calculateMaxForSwap = nexusSDK.calculateMaxForSwap;
    if (typeof calculateMaxForSwap !== "function") return;

    const toTokenAddress = (
      toToken.contractAddress || zeroAddress
    ) as `0x${string}`;
    const selectedSources = fromTokens
      .filter((token) => token.chainId && token.contractAddress)
      .map((token) => ({
        chainId: token.chainId!,
        tokenAddress: token.contractAddress as `0x${string}`,
      }));

    if (fromTokens.length > 0 && selectedSources.length === 0) {
      setTxError("Select a valid source token before using receive MAX.");
      return;
    }

    setTxError(null);
    setQuoteRefreshing(false);
    setReceiveMaxCalculating(true);

    try {
      const max = await calculateMaxForSwap({
        toChainId: toToken.chainId,
        toTokenAddress,
        ...(selectedSources.length > 0
          ? { fromSources: selectedSources }
          : {}),
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
        setTxError("No swappable amount is available for this destination.");
        return;
      }

      const safeMaxAmount = maxAmount.mul(receiveMaxSafetyMultiplier);
      const receiveAmount =
        pct === 100 ? safeMaxAmount : safeMaxAmount.mul(pct).div(100);
      const roundedAmount = receiveAmount.toDecimalPlaces(
        Math.max(0, decimals),
        Decimal.ROUND_DOWN,
      );
      const nextAmount = trimDecimalString(roundedAmount.toFixed());

      if (!nextAmount || new Decimal(nextAmount).lte(0)) {
        setReceiveMaxCalculating(false);
        setQuoteRefreshing(false);
        setTxError("The calculated receive amount is too small to quote.");
        return;
      }

      handleSwapAmountChange(nextAmount, "receive");
      setQuoteRefreshing(true);
    } catch (error: any) {
      console.error("Unable to calculate max swap amount", error);
      setReceiveMaxCalculating(false);
      setQuoteRefreshing(false);
      setTxError(
        error?.message || "Unable to calculate the max swappable amount.",
      );
    }
  };

  const canCalculateReceiveMax =
    activeMode === "swap" &&
    Boolean(
      nexusSDK &&
        toToken?.chainId &&
        typeof nexusSDK.calculateMaxForSwap === "function",
    );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isSwapCtaDisabled =
    !amount ||
    Number(amount) <= 0 ||
    (swapType === "exactIn" && (fromTokens.length === 0 || !toToken)) ||
    (swapType === "exactOut" && !toToken) ||
    receiveMaxCalculating ||
    quoteRefreshing;
  const isDepositCtaDisabled =
    !amount || Number(amount) <= 0 || !toToken || quoteRefreshing;
  const isSendCtaDisabled =
    !amount ||
    Number(amount) <= 0 ||
    !toToken ||
    !recipientAddress ||
    quoteRefreshing;
  const quoteCtaLabel = (fallback: string) =>
    receiveMaxCalculating
      ? "Calculating..."
      : quoteRefreshing
        ? "Fetching quotes..."
        : !amount || Number(amount) <= 0
          ? "Enter amount"
          : fallback;
  const previewSourceUsdNumber =
    fromTokens.length > 0
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
  const toTokenWithFetchedBalance =
    toToken && destinationBalance
      ? { ...toToken, balance: destinationBalance }
      : toToken;
  const isIdleSwapQuoteLoading =
    activeMode === "swap" && swapStep === "idle" && quoteRefreshing;
  const isReceiveAmountLoading =
    receiveMaxCalculating ||
    (isIdleSwapQuoteLoading && swapType === "exactIn" && !intentToAmount);
  const isReceiveUsdLoading =
    receiveMaxCalculating ||
    (isIdleSwapQuoteLoading && !previewToAmountUsd);
  const hasQuoteRefreshCountdown =
    activeMode === "swap" &&
    Boolean(intentData && swapIntentRef.current) &&
    (swapStep === "idle" || swapStep === "preview-intent");

  return (
    <div
      style={{
        backgroundColor: "#F9F9F8",
        backgroundImage:
          "url(https://app.paper.design/file-assets/01KPQEMGNQSQFDFT18A49JZ3RW/4CP45FEA7X8S1T82E2SXG5AQKV.png)",
        backgroundPosition: "center",
        backgroundPositionX: "center",
        backgroundPositionY: "center",
        backgroundSize: "cover",
        borderRadius: "16px",
        boxShadow: "#5B5B5B0D 0px 1px 12px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontSize: "12px",
        fontSynthesis: "none",
        gap: "16px",
        minHeight: "480px",
        lineHeight: "16px",
        overflow: "clip",
        position: "relative",
        width: "450px",
      }}
    >
      <div
        style={{
          alignItems: "center",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "space-between",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingTop: "16px",
          width: "450px",
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
                  onClick={() => setSelectedOpportunity(undefined)}
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
            gap: "12px",
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
          <div
            style={{
              alignItems: "center",
              backgroundColor: "#FFFFFE",
              borderRadius: "8px",
              boxSizing: "border-box",
              display: "flex",
              flexShrink: "0",
              height: "32px",
              justifyContent: "center",
              outline: "1px solid #E8E8E7",
              width: "32px",
              cursor: "pointer",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: "16px", height: "16px", flexShrink: "0" }}
            >
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="#161615"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main content area */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          paddingInline: "16px",
          paddingBottom: "16px",
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
              {/* Panel: preview-intent */}
              {swapStep === "preview-intent" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full h-full">
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
                    onAccept={handleSwapAccept}
                    onReject={() => {
                      clearPendingSwapIntent();
                      setSwapStep("idle");
                    }}
                  />
                </div>
              )}

              {swapStep === "progress" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
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
                    isExecuting
                    swapType={swapType}
                    intentData={intentData}
                    swapBalances={swapBalance}
                    supportedTokenAssets={supportedChainsAndTokens}
                    activeMode={activeMode}
                    mode={activeMode}
                    onAccept={() => undefined}
                    onReject={() => undefined}
                  />
                </div>
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
                onReceivePercentSelect={
                  canCalculateReceiveMax
                    ? handleReceivePercentSelect
                    : undefined
                }
                fromTokens={fromTokens}
                toToken={toTokenWithFetchedBalance}
                receiveQuoteUsd={previewToAmountUsd}
                totalBalance={new Decimal(
                  swapBalance?.reduce(
                    (a, b) => a.add(b.balanceInFiat || 0),
                    new Decimal(0),
                  ) || 0,
                )
                  .toDecimalPlaces(2)
                  .toFixed()}
                usdValue={amount && usdValue > 0 ? usdValue.toFixed(2) : ""}
                swapType={swapType}
                onOpenSourcePicker={(index) => {
                  setEditingAssetIndex(index ?? null);
                  setSwapStep("choose-swap-asset");
                }}
                onOpenDestPicker={() => setSwapStep("choose-receive-asset")}
                onOpenRecipientPicker={handleOpenRecipientEditor}
                recipientAddress={effectiveRecipientAddress}
                defaultRecipientAddress={defaultRecipientAddress}
                onUpdateTokens={setFromTokens}
              />

              {txError && <StatusAlert type="error" message={txError} />}

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
                    backgroundColor: isSwapCtaDisabled ? "#F0F0EF" : "#006BF4",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                    display: "flex",
                    flexShrink: 0,
                    height: "48px",
                    justifyContent: "center",
                    paddingInline: "16px",
                    border: "none",
                    cursor: isSwapCtaDisabled ? "default" : "pointer",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      boxSizing: "border-box",
                      color: isSwapCtaDisabled ? "#9E9E9C" : "#FFFFFE",
                      fontFamily: '"Geist", system-ui, sans-serif',
                      fontSize: "16px",
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
                      selectedId={undefined}
                      onSelect={(opp) => {
                        setSelectedOpportunity(opp);
                        setSwapType("exactOut");
                        setToToken(toTokenFromOpportunity(opp));
                      }}
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
                          if (selectedOpportunity) setSwapStep("idle");
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
                    onAmountChange={setAmount}
                    toToken={toTokenWithFetchedBalance}
                    totalBalance={
                      fromTokens.length > 0
                        ? String(fromTokens[0].balance).replace(/[^0-9.]/g, "")
                        : maxBalance || "0"
                    }
                    usdValue={amount && usdValue > 0 ? usdValue.toFixed(2) : ""}
                    fromTokens={fromTokens}
                    onOpenSourcePicker={() => setSwapStep("choose-swap-asset")}
                    onSetPercent={(pct) => {
                      if (!maxBalance) return;
                      const num = parseFloat(maxBalance) * (pct / 100);
                      setAmount(num.toFixed(6).replace(/\.?0+$/, ""));
                    }}
                  />

                  {txError && <StatusAlert type="error" message={txError} />}

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
                        backgroundColor: isDepositCtaDisabled
                          ? "#F0F0EF"
                          : "#006BF4",
                        borderRadius: "8px",
                        boxSizing: "border-box",
                        display: "flex",
                        flexShrink: 0,
                        height: "48px",
                        justifyContent: "center",
                        paddingInline: "16px",
                        border: "none",
                        cursor: isDepositCtaDisabled ? "default" : "pointer",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          boxSizing: "border-box",
                          color: isDepositCtaDisabled ? "#9E9E9C" : "#FFFFFE",
                          fontFamily: '"Geist", system-ui, sans-serif',
                          fontSize: "16px",
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
                onAmountChange={setAmount}
                toToken={toTokenWithFetchedBalance}
                totalBalance={
                  fromTokens.length > 0
                    ? String(fromTokens[0].balance).replace(/[^0-9.]/g, "")
                    : maxBalance || "0"
                }
                usdValue={amount && usdValue > 0 ? usdValue.toFixed(2) : ""}
                onOpenAssetPicker={() => setSwapStep("choose-receive-asset")}
                onOpenRecipientPicker={handleOpenRecipientEditor}
                recipientAddress={recipientAddress || ""}
                onMax={() => {
                  if (!maxBalance) return;
                  setAmount(maxBalance);
                }}
              />

              {txError && <StatusAlert type="error" message={txError} />}

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
                    backgroundColor: isSendCtaDisabled ? "#F0F0EF" : "#006BF4",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                    display: "flex",
                    flexShrink: 0,
                    height: "48px",
                    justifyContent: "center",
                    paddingInline: "16px",
                    border: "none",
                    cursor: isSendCtaDisabled ? "default" : "pointer",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      boxSizing: "border-box",
                      color: isSendCtaDisabled ? "#9E9E9C" : "#FFFFFE",
                      fontFamily: '"Geist", system-ui, sans-serif',
                      fontSize: "16px",
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
                transition: "opacity 0.3s",
              }}
              onClick={() => {
                setTxError(null);
                setSwapStep("idle");
              }}
            />
            <div
              style={{
                position: "relative",
                width: "100%",
                maxHeight: "calc(100% - 48px)",
                backgroundColor: "#FFFFFE",
                borderRadius: "16px 16px 0 0",
                display: "flex",
                flexDirection: "column",
                pointerEvents: "auto",
                boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
                boxSizing: "border-box",
                overflowY: "auto",
                padding: "12px 20px 20px",
              }}
              className="animate-in slide-in-from-bottom-full duration-300"
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "16px",
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
                  gap: "14px",
                  paddingBottom: "18px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setTxError(null);
                    setSwapStep("idle");
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
                  marginBottom: "20px",
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
                  marginTop: "30px",
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
                transition: "opacity 0.3s",
              }}
              onClick={() => setSwapStep("idle")}
            />
            <div
              style={{
                position: "relative",
                width: "100%",
                maxHeight: "90%",
                backgroundColor: "#FFFFFE",
                borderRadius: "24px 24px 0 0",
                display: "flex",
                flexDirection: "column",
                pointerEvents: "auto",
                boxShadow: "0 -4px 12px rgba(0,0,0,0.05)",
              }}
              className="animate-in slide-in-from-bottom-full duration-300"
            >
              <SwapAssetSelector
                title={
                  activeMode === "deposit"
                    ? "Choose payment sources"
                    : "Choose assets to Swap"
                }
                swapBalance={swapBalance}
                isMulti={
                  activeMode === "deposit" || swapType === "exactIn"
                }
                selectedTokens={fromTokens}
                editingAssetIndex={editingAssetIndex}
                onToggle={(token) => {
                  clearPendingSwapIntent();
                  setFromTokens((prev) => {
                    const exists = prev.find(
                      (t) =>
                        t.contractAddress === token.contractAddress &&
                        t.chainId === token.chainId,
                    );
                    if (exists)
                      return prev.filter(
                        (t) =>
                          !(
                            t.contractAddress === token.contractAddress &&
                            t.chainId === token.chainId
                          ),
                      );
                    return [
                      ...prev,
                      {
                        ...token,
                        userAmount: prev.length === 0 ? amount : "",
                      },
                    ];
                  });
                }}
                onDone={() => setSwapStep("idle")}
                onSelect={(token) => {
                  clearPendingSwapIntent();
                  if (activeMode === "swap" && swapType === "exactIn") {
                    setFromTokens((prev) => {
                      const next = [...prev];
                      const defaultAmount =
                        next.length === 0 ? amount : "";
                      const newToken = {
                        ...token,
                        userAmount: defaultAmount,
                      };
                      if (
                        editingAssetIndex !== null &&
                        editingAssetIndex < next.length
                      ) {
                        newToken.userAmount =
                          next[editingAssetIndex].userAmount ||
                          defaultAmount;
                        next[editingAssetIndex] = newToken;
                      } else {
                        next.push(newToken);
                      }
                      return next;
                    });
                    setSwapStep("idle");
                  } else if (
                    activeMode === "deposit" ||
                    activeMode === "send"
                  ) {
                    setFromTokens([{ ...token, userAmount: amount }]);
                    setSwapStep("idle");
                  } else {
                    const next = [...fromTokens];
                    const newToken = { ...token, userAmount: "" };
                    if (
                      editingAssetIndex !== null &&
                      editingAssetIndex < next.length
                    ) {
                      newToken.userAmount =
                        next[editingAssetIndex].userAmount || "";
                      next[editingAssetIndex] = newToken;
                    } else {
                      const exists = next.some(
                        (item) =>
                          item.contractAddress === token.contractAddress &&
                          item.chainId === token.chainId,
                      );
                      if (!exists) {
                        next.push(newToken);
                      }
                    }
                    const sourceAmount = getSourceAmountInput(next);
                    setFromTokens(next);
                    if (sourceAmount) {
                      setAmount(sourceAmount);
                      setSwapType("exactIn");
                    }
                    setSwapStep("idle");
                  }
                }}
                onBack={() => setSwapStep("idle")}
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
                transition: "opacity 0.3s",
              }}
              onClick={() => setSwapStep("idle")}
            />
            <div
              style={{
                position: "relative",
                width: "100%",
                maxHeight: "90%",
                backgroundColor: "#FFFFFE",
                borderRadius: "24px 24px 0 0",
                display: "flex",
                flexDirection: "column",
                pointerEvents: "auto",
                boxShadow: "0 -4px 12px rgba(0,0,0,0.05)",
                boxSizing: "border-box",
              }}
              className="animate-in slide-in-from-bottom-full duration-300"
            >
              <div style={{ padding: "16px 16px 0 16px" }}>
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: "#E8E8E7",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <button
                    onClick={() => setSwapStep("idle")}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid #E8E8E7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#FFFFFE",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <ChevronDown
                      style={{
                        width: 16,
                        height: 16,
                        transform: "rotate(90deg)",
                      }}
                    />
                  </button>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                  >
                    <span
                      style={{
                        fontFamily: '"Geist", system-ui, sans-serif',
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#161615",
                      }}
                    >
                      Choose asset to Receive
                    </span>
                    <span
                      style={{
                        fontFamily: '"Geist", system-ui, sans-serif',
                        fontSize: 13,
                        color: "#848483",
                      }}
                    >
                      Select token and chain
                    </span>
                  </div>
                </div>
              </div>
              <ReceiveAssetSelector
                onSelect={(token) => {
                  const receiveAmount =
                    swapType === "exactIn" ? intentToAmount : amount;
                  clearPendingSwapIntent();
                  if (receiveAmount && Number(receiveAmount) > 0) {
                    setAmount(receiveAmount);
                    setSwapType("exactOut");
                  }
                  setToToken(token);
                  setSwapStep("idle");
                }}
                onBack={() => setSwapStep("idle")}
              />
            </div>
          </div>
        )}

    </div>
  );
}

export default NexusOne;
