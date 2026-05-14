"use client";

import React, { useRef, useState } from "react";
import Decimal from "decimal.js";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { type NexusOneMode, type DepositOpportunity } from "../types";
import { type SwapTokenOption } from "./swap-asset-selector";
import { CHAIN_METADATA, type SwapStepType } from "@avail-project/nexus-core";
import TransactionProgress from "../../swaps/components/transaction-progress";

export interface SwapIntentSource {
  amount: string;
  value?: string;
  chain: { id: number; logo: string; name: string };
  token: { contractAddress: string; decimals: number; symbol: string };
}

export interface SwapIntentDestination {
  amount: string;
  value?: string;
  chain: { id: number; logo: string; name: string };
  token: { contractAddress: string; decimals: number; symbol: string };
  gas: {
    amount: string;
    value?: string;
    token: { contractAddress: string; decimals: number; symbol: string };
  };
}

export interface SwapIntentData {
  sources: SwapIntentSource[];
  destination: SwapIntentDestination;
  feesAndBuffer?: {
    buffer?: string;
    bridge?:
      | {
          caGas?: string;
          collection?: string;
          fulfilment?: string;
          gasSupplied?: string;
          protocol?: string;
          solver?: string;
          total?: string;
        }
      | string
      | null;
  };
}

export interface SwapIntentPreviewProps {
  fromTokens?: SwapTokenOption[];
  fromToken?: SwapTokenOption;
  toToken?: SwapTokenOption;
  fromAmount: string;
  fromAmountUsd?: string;
  toAmount?: string;
  toAmountUsd?: string;
  toAmountTokens?: string;
  totalFeeUsd?: string;
  estimatedTime?: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  isExecuting?: boolean;
  swapType?: "exactIn" | "exactOut";
  intentData?: SwapIntentData | null;
  mode?: NexusOneMode;
  opportunity?: DepositOpportunity;
  recipientAddress?: string;
  swapBalances?: any[] | null;
  supportedTokenAssets?: any[] | null;
  activeMode?: NexusOneMode;
  steps?: Array<{ id: number; completed: boolean; step: SwapStepType }>;
  explorerUrls?: {
    sourceExplorerUrl: string | null;
    destinationExplorerUrl: string | null;
  };
  onAccept: () => void;
  onReject: () => void;
}

const fontFamily = '"Geist", var(--font-geist-sans), system-ui, sans-serif';
const primary = "var(--foreground-primary, #161615)";
const muted = "var(--foreground-muted, #848483)";
const border = "var(--border-default, #E8E8E7)";
const brand = "var(--foreground-brand, #006BF4)";

const stripNumeric = (value: unknown) =>
  String(value).replace(/[^0-9.-]/g, "");

const parseDecimal = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  if (Decimal.isDecimal(value)) return value;
  const cleaned = stripNumeric(value);
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

const toDecimal = (value: unknown) => parseDecimal(value) ?? new Decimal(0);

const formatAmount = (
  value: unknown,
  options: { min?: number; max?: number } = {},
) => {
  const amount = toDecimal(value);
  const max = options.max ?? 2;
  return amount.toDecimalPlaces(max).toFixed();
};

const formatUsdDelta = (value: Decimal) => {
  if (value.gt(0) && value.lt(0.01)) return "-<0.01 USD";
  return value.gt(0) ? `-${formatAmount(value)} USD` : "0 USD";
};

const formatUsdValue = (value: Decimal) => {
  const absolute = value.abs();
  if (absolute.eq(0)) return "$0";
  if (absolute.lt(0.000001)) return value.lt(0) ? "-<$0.000001" : "<$0.000001";

  const amount = absolute.lt(0.01)
    ? formatAmount(absolute, { max: 6 })
    : formatAmount(absolute, { max: 2 });

  return value.lt(0) ? `-$${amount}` : `$${amount}`;
};

const formatTokenAmount = (value: unknown) => {
  const amount = toDecimal(value);
  return amount.toDecimalPlaces(9).toFixed();
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const isNativeTokenAddress = (address?: string) => {
  const lower = (address ?? "").toLowerCase();
  return (
    !lower ||
    lower === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
    lower === "0x0000000000000000000000000000000000000000"
  );
};

const normalizeIntentToken = <
  T extends { contractAddress?: string; decimals?: number; symbol?: string },
>(
  token: T | undefined,
  chainId?: number,
) => {
  const chainMeta = chainId ? CHAIN_METADATA[chainId] : undefined;
  const shouldUseNative = isNativeTokenAddress(token?.contractAddress) && Boolean(chainMeta);
  const symbol =
    shouldUseNative && chainMeta?.nativeCurrency.symbol
      ? chainMeta.nativeCurrency.symbol
      : token?.symbol || chainMeta?.nativeCurrency.symbol || "-";
  const decimals =
    shouldUseNative && chainMeta?.nativeCurrency.decimals !== undefined
      ? chainMeta.nativeCurrency.decimals
      : token?.decimals ?? chainMeta?.nativeCurrency.decimals ?? 18;

  return {
    contractAddress: token?.contractAddress ?? "",
    decimals,
    logo: shouldUseNative ? chainMeta?.logo : undefined,
    symbol,
  };
};

const formatSymbolSummary = (symbols: string[]) => {
  const visible = unique(symbols);
  if (visible.length === 0) return "-";
  if (visible.length <= 2) return visible.join(", ");
  if (visible.length === 3) return `${visible[0]}, ${visible[1]} and ${visible[2]}`;

  const others = visible.length - 2;
  return `${visible[0]}, ${visible[1]} and ${others} other${others === 1 ? "" : "s"}`;
};

function IntentLogo({
  src,
  alt,
  label,
  size,
  fontSize,
  outline,
  style,
}: {
  src?: string;
  alt?: string;
  label?: string;
  size: number;
  fontSize: number;
  outline?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(!src);

  React.useEffect(() => {
    setFailed(!src);
  }, [src]);

  const fallbackLabel = (label || alt || "?").trim().slice(0, 1).toUpperCase();

  if (!failed && src) {
    return (
      <img
        src={src}
        alt={alt || label || ""}
        onError={() => setFailed(true)}
        style={{
          backgroundColor: "#FFFFFE",
          borderRadius: "999px",
          height: `${size}px`,
          objectFit: "cover",
          outline,
          width: `${size}px`,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      aria-label={alt || label || "Token"}
      role="img"
      style={{
        alignItems: "center",
        backgroundColor: "#E8F0FF",
        borderRadius: "999px",
        color: brand,
        display: "flex",
        fontFamily,
        fontSize: `${fontSize}px`,
        fontWeight: 700,
        height: `${size}px`,
        justifyContent: "center",
        lineHeight: `${size}px`,
        outline,
        width: `${size}px`,
        ...style,
      }}
    >
      {fallbackLabel || "?"}
    </div>
  );
}

function DetailToggle({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        alignItems: "center",
        background: "transparent",
        border: "none",
        color: brand,
        cursor: "pointer",
        display: "flex",
        fontFamily,
        fontSize: "13px",
        gap: "4px",
        lineHeight: "17px",
        padding: 0,
      }}
    >
      {expanded ? "Hide Details" : "View Details"}
      <ChevronDown
        style={{
          height: 14,
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 180ms ease",
          width: 14,
        }}
      />
    </button>
  );
}

function TruncatedAddress({ address }: { address: string }) {
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
        color: brand,
        display: "inline-flex",
        fontFamily,
        fontSize: "13px",
        fontWeight: 500,
        lineHeight: "17px",
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
            border: `1px solid ${border}`,
            borderRadius: "8px",
            boxShadow: "0 6px 18px rgba(22,22,21,0.10)",
            color: primary,
            fontFamily,
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

function RecipientRow({ address }: { address: string }) {
  return (
    <div
      style={{
        borderTop: `1px solid ${border}`,
        display: "flex",
        justifyContent: "space-between",
        padding: "18px 18px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div
          style={{
            color: primary,
            fontFamily,
            fontSize: "14px",
            fontWeight: 600,
            lineHeight: "18px",
          }}
        >
          Recipient
        </div>
        <div
          style={{
            color: muted,
            fontFamily,
            fontSize: "13px",
            lineHeight: "17px",
          }}
        >
          Wallet address
        </div>
      </div>
      <div style={{ alignItems: "flex-end", display: "flex" }}>
        <TruncatedAddress address={address} />
      </div>
    </div>
  );
}

function Row({
  title,
  subtitle,
  value,
  secondaryValue,
  children,
}: {
  title: string;
  subtitle: string;
  value: string;
  secondaryValue?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderTop: `1px solid ${border}`,
        display: "flex",
        justifyContent: "space-between",
        padding: "18px 18px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div
          style={{
            color: primary,
            fontFamily,
            fontSize: "14px",
            fontWeight: 600,
            lineHeight: "18px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: muted,
            fontFamily,
            fontSize: "13px",
            lineHeight: "17px",
          }}
        >
          {subtitle}
        </div>
      </div>
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
            color: primary,
            fontFamily,
            fontSize: "14px",
            fontWeight: 600,
            lineHeight: "18px",
          }}
        >
          {value}
        </div>
        {secondaryValue ? (
          <div
            style={{
              color: muted,
              fontFamily,
              fontSize: "13px",
              lineHeight: "17px",
            }}
          >
            {secondaryValue}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function AnimatedDetails({
  open,
  children,
  background = "#F9F9F8",
  gap = "10px",
  padding = "15px 18px",
}: {
  open: boolean;
  children: React.ReactNode;
  background?: string;
  gap?: string;
  padding?: string;
}) {
  return (
    <div
      aria-hidden={!open}
      style={{
        background,
        borderTop: `1px solid ${border}`,
        borderTopWidth: open ? "1px" : 0,
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        opacity: open ? 1 : 0,
        overflow: "hidden",
        transition:
          "grid-template-rows 220ms ease, opacity 180ms ease, border-top-width 220ms ease",
      }}
    >
      <div style={{ minHeight: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap,
            padding: open ? padding : "0 18px",
            transition: "padding 220ms ease",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function SwapIntentPreview({
  fromTokens,
  fromToken,
  toToken,
  fromAmount,
  fromAmountUsd,
  toAmount,
  toAmountUsd,
  toAmountTokens,
  totalFeeUsd,
  isLoading,
  isRefreshing,
  isExecuting,
  swapType,
  intentData,
  mode,
  opportunity,
  recipientAddress,
  activeMode,
  steps,
  explorerUrls,
  onAccept,
}: SwapIntentPreviewProps) {
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [showGasDetails, setShowGasDetails] = useState(false);
  const [showImpactDetails, setShowImpactDetails] = useState(false);
  const sourceDetailsScrollRef = useRef<HTMLDivElement | null>(null);

  const flowMode = mode ?? activeMode ?? "swap";
  const isDepositMode = flowMode === "deposit";
  const isSendMode = flowMode === "send";
  const intentSources = intentData?.sources ?? [];
  const intentDest = intentData?.destination;
  const normalizedIntentSources = intentSources.map((source) => ({
    ...source,
    token: normalizeIntentToken(source.token, source.chain.id),
  }));
  const normalizedIntentDest = intentDest
    ? {
        ...intentDest,
        token: normalizeIntentToken(intentDest.token, intentDest.chain.id),
        gas: {
          ...intentDest.gas,
          token: normalizeIntentToken(intentDest.gas?.token, intentDest.chain.id),
        },
      }
    : undefined;
  const fallbackSources =
    fromTokens && fromTokens.length > 0
      ? fromTokens
      : fromToken
        ? [fromToken]
        : [];

  const sourceSymbols =
    normalizedIntentSources.length > 0
      ? unique(normalizedIntentSources.map((source) => source.token.symbol))
      : unique(fallbackSources.map((source) => source.symbol));
  const sourceLabel = formatSymbolSummary(sourceSymbols);
  const sourceAssetCount =
    normalizedIntentSources.length || fallbackSources.length || sourceSymbols.length;
  const hasResolvedQuote = Boolean(normalizedIntentDest && normalizedIntentSources.length > 0);
  const quoteUnavailable = !isLoading && !hasResolvedQuote;

  const destTokenSymbol =
    normalizedIntentDest?.token.symbol ||
    toToken?.symbol ||
    opportunity?.tokenSymbol ||
    "-";
  const destChainName =
    flowMode === "deposit"
      ? opportunity?.title || opportunity?.protocol || "Opportunity"
      : normalizedIntentDest?.chain.name || toToken?.chainName || "";

  const intentSourceUsdValues = normalizedIntentSources.map((source) =>
    parseDecimal(source.value),
  );
  const sourceUsdNumber =
    normalizedIntentSources.length > 0
      ? intentSourceUsdValues.every((value) => value !== undefined)
        ? intentSourceUsdValues.reduce(
            (sum, value) => sum.plus(value ?? 0),
            new Decimal(0),
          )
        : parseDecimal(fromAmountUsd)
      : parseDecimal(fromAmountUsd);

  const destinationUsdNumber = hasResolvedQuote
    ? (parseDecimal(normalizedIntentDest?.value) ?? parseDecimal(toAmountUsd))
    : undefined;
  const hasFiatQuote =
    sourceUsdNumber !== undefined &&
    destinationUsdNumber !== undefined &&
    sourceUsdNumber.gt(0) &&
    destinationUsdNumber.gt(0);

  const bridgeFees = intentData?.feesAndBuffer?.bridge;
  const bridgeFeeData =
    bridgeFees && typeof bridgeFees === "object" ? bridgeFees : undefined;
  const bridgeTotalNumber =
    typeof bridgeFees === "string"
      ? parseDecimal(bridgeFees)
      : parseDecimal(bridgeFeeData?.total);
  const collectionFeeNumber = parseDecimal(bridgeFeeData?.collection);
  const fulfilmentFeeNumber = parseDecimal(bridgeFeeData?.fulfilment);
  const executionGasFeeNumber =
    parseDecimal(bridgeFeeData?.caGas) ??
    (collectionFeeNumber !== undefined || fulfilmentFeeNumber !== undefined
      ? (collectionFeeNumber ?? new Decimal(0)).plus(
          fulfilmentFeeNumber ?? new Decimal(0),
        )
      : undefined);
  const protocolFeeNumber = parseDecimal(bridgeFeeData?.protocol);
  const solverFeeNumber = parseDecimal(bridgeFeeData?.solver);
  const gasSuppliedNumber = parseDecimal(bridgeFeeData?.gasSupplied);
  const swapBufferNumber = parseDecimal(intentData?.feesAndBuffer?.buffer);
  const depositGasValueNumber = parseDecimal(normalizedIntentDest?.gas?.value);
  const depositGasAmount = normalizedIntentDest?.gas?.amount;
  const depositGasTokenSymbol = normalizedIntentDest?.gas?.token?.symbol || "";
  const hasGasDetails =
    (isDepositMode || isSendMode) && Boolean(normalizedIntentDest?.gas);
  const explicitFeeNumber =
    bridgeTotalNumber ??
    parseDecimal(totalFeeUsd) ??
    parseDecimal((intentData as any)?.fees?.total);
  const feeNumber =
    explicitFeeNumber ?? (hasFiatQuote ? new Decimal(0) : undefined);
  const priceImpactBaseUsd =
    hasFiatQuote && feeNumber !== undefined
      ? sourceUsdNumber.minus(feeNumber).minus(swapBufferNumber ?? new Decimal(0))
      : undefined;
  const quoteImpactUsd =
    hasFiatQuote && feeNumber !== undefined
      ? Decimal.max(
          sourceUsdNumber
            .minus(destinationUsdNumber)
            .minus(feeNumber)
            .minus(swapBufferNumber ?? new Decimal(0)),
          0,
        )
      : undefined;
  const priceImpactUsd =
    parseDecimal((intentData as any)?.priceImpactUsd) ??
    quoteImpactUsd;
  const swapImpactPercent =
    parseDecimal((intentData as any)?.swapImpactPercent) ??
    parseDecimal((intentData as any)?.priceImpactPercent) ??
    (hasFiatQuote && priceImpactUsd !== undefined
      ? priceImpactUsd.eq(0)
        ? new Decimal(0)
        : priceImpactBaseUsd !== undefined && priceImpactBaseUsd.gt(0)
          ? priceImpactUsd.neg().div(priceImpactBaseUsd).mul(100)
          : undefined
      : undefined);

  const destinationTokenAmount =
    normalizedIntentDest?.amount || toAmountTokens || toAmount || "0";
  const minReceived =
    (intentData as any)?.minimumReceived ||
    (normalizedIntentDest as any)?.minimumReceived ||
    destinationTokenAmount;
  const shouldShowMinReceived = swapType === "exactIn";
  const feeDetailRows = bridgeFeeData
    ? [
        {
          label: "Execution Gas Fee",
          value: executionGasFeeNumber ?? new Decimal(0),
        },
        {
          label: "Protocol Fee",
          value: protocolFeeNumber ?? new Decimal(0),
        },
        {
          label: "Solver Fee",
          value: solverFeeNumber ?? new Decimal(0),
        },
        ...(gasSuppliedNumber && gasSuppliedNumber.gt(0)
          ? [{ label: "Gas Supplied", value: gasSuppliedNumber }]
          : []),
      ]
    : feeNumber !== undefined
      ? [{ label: "Network & protocol", value: feeNumber }]
      : [];

  const pendingLabel = isLoading ? "Fetching quote" : "Quote unavailable";
  const pendingValue = isLoading ? "..." : "--";
  const sourceHeaderAmount =
    sourceUsdNumber !== undefined ? formatAmount(sourceUsdNumber) : pendingValue;
  const sourceUsd =
    sourceUsdNumber !== undefined
      ? `${formatAmount(sourceUsdNumber)} USD`
      : pendingValue;
  const receiveUsd = hasFiatQuote
    ? `${formatAmount(destinationUsdNumber)} USD`
    : pendingValue;
  const feeUsd =
    feeNumber !== undefined
      ? formatUsdDelta(feeNumber)
      : pendingValue;
  const impactUsd =
    priceImpactUsd !== undefined
      ? formatUsdDelta(priceImpactUsd)
      : pendingValue;
  const impactPercent =
    swapImpactPercent !== undefined
      ? `${formatAmount(swapImpactPercent, {
          min: 2,
          max: 2,
        })}%`
      : pendingValue;
  const destinationHeaderAmount = hasResolvedQuote
    ? formatTokenAmount(destinationTokenAmount)
    : pendingValue;
  const destinationTokenDisplay = hasResolvedQuote
    ? `${formatTokenAmount(destinationTokenAmount)} ${destTokenSymbol}`
    : pendingLabel;
  const swapBufferDisplay =
    swapBufferNumber !== undefined
      ? formatUsdValue(swapBufferNumber)
      : pendingValue;
  const minReceivedDisplay = hasResolvedQuote
    ? `${formatTokenAmount(minReceived)} ${destTokenSymbol}`
    : pendingValue;
  const depositGasUsdDisplay =
    depositGasValueNumber !== undefined
      ? formatUsdValue(depositGasValueNumber)
      : pendingValue;
  const depositGasNativeDisplay =
    hasResolvedQuote && depositGasAmount !== undefined
      ? `${formatTokenAmount(depositGasAmount)} ${depositGasTokenSymbol}`.trim()
      : pendingValue;
  const sourceDetailRows =
    normalizedIntentSources.length > 0
      ? normalizedIntentSources.map((source, index) => {
          const fallbackSource = fallbackSources.find(
            (token) =>
              token.chainId === source.chain.id &&
              (token.contractAddress?.toLowerCase() ===
                source.token.contractAddress?.toLowerCase() ||
                token.symbol === source.token.symbol),
          );

          return {
            key: `${source.chain.id}-${source.token.contractAddress}-${index}`,
            tokenLogo: source.token.logo || fallbackSource?.logo || "",
            chainLogo: source.chain.logo || fallbackSource?.chainLogo || "",
            symbol: source.token.symbol,
            chainName: source.chain.name,
            tokenAmount: `${formatTokenAmount(source.amount)} ${source.token.symbol}`,
            usdAmount:
              parseDecimal(source.value) !== undefined
                ? formatUsdValue(parseDecimal(source.value) ?? new Decimal(0))
                : pendingValue,
            index,
          };
        })
      : fallbackSources.map((source, index) => {
          const sourceAmount =
            source.userAmount || (fallbackSources.length === 1 ? fromAmount : "");
          return {
            key: `${source.chainId ?? "chain"}-${source.contractAddress}-${index}`,
            tokenLogo: source.logo || "",
            chainLogo: source.chainLogo || "",
            symbol: source.symbol,
            chainName: source.chainName || "",
            tokenAmount: sourceAmount
              ? `${formatTokenAmount(sourceAmount)} ${source.symbol}`
              : pendingLabel,
            usdAmount:
              source.balanceInFiat && source.balance
                ? formatUsdValue(
                    toDecimal(source.userAmount || 0).mul(
                      toDecimal(source.balanceInFiat).div(
                        Decimal.max(toDecimal(source.balance), 1),
                      ),
                    ),
                  )
                : pendingValue,
            index,
          };
        });
  const sourceHeaderSubtitle = (() => {
    if (normalizedIntentSources.length === 1) {
      const source = normalizedIntentSources[0];
      return `${source.token.symbol} on ${source.chain.name}`;
    }

    if (normalizedIntentSources.length === 0 && fallbackSources.length === 1) {
      const source = fallbackSources[0];
      return source.chainName
        ? `${source.symbol} on ${source.chainName}`
        : source.symbol;
    }

    const count = sourceAssetCount || 1;
    return `${count} asset${count === 1 ? "" : "s"}`;
  })();
  const shouldScrollSourceDetails = sourceDetailRows.length > 5;
  const progressExplorerUrls = explorerUrls ?? {
    destinationExplorerUrl: null,
    sourceExplorerUrl: null,
  };
  const progressSources = sourceDetailRows.map((source) => ({
    chainLogo: source.chainLogo,
    symbol: source.symbol,
    tokenLogo: source.tokenLogo,
  }));
  const primarySourceForProgress = progressSources[0] ?? {
    chainLogo: fromToken?.chainLogo ?? "",
    symbol: sourceSymbols[0] ?? "",
    tokenLogo: fromToken?.logo ?? "",
  };
  const destinationProgressLogos = {
    chain: normalizedIntentDest?.chain.logo || toToken?.chainLogo || "",
    token: normalizedIntentDest?.token.logo || toToken?.logo || "",
  };

  const ctaLabel =
    flowMode === "deposit"
      ? "Deposit now"
      : flowMode === "send"
        ? "Send now"
        : "Swap now";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <style>
        {`
          @keyframes nexusSwapRouteDot {
            0%, 12% { background: #006BF4; opacity: 1; transform: scale(1.18); }
            30%, 100% { background: #9FC4FF; opacity: 0.45; transform: scale(1); }
          }
        `}
      </style>
      <div
        style={{
          background: "#FFFFFE",
          border: `1px solid ${border}`,
          borderRadius: "12px",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(180deg, #FFFFFE 0%, #EEF5FF 100%)",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            minHeight: "126px",
            padding: "34px 24px 28px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                alignItems: "baseline",
                color: primary,
                display: "flex",
                gap: "6px",
                fontFamily,
                fontSize: "21px",
                fontWeight: 600,
                lineHeight: "26px",
              }}
            >
              {sourceHeaderAmount}
              <span style={{ color: muted, fontSize: "12px", fontWeight: 500 }}>
                USD
              </span>
            </div>
            <div
              style={{
                color: muted,
                fontFamily,
                fontSize: "12px",
                lineHeight: "17px",
              }}
            >
              {sourceHeaderSubtitle}
            </div>
          </div>

          <div
            aria-hidden="true"
            style={{
              alignItems: "center",
              display: "flex",
              gap: "6px",
              justifyContent: "center",
              padding: "0 22px",
            }}
          >
            {[0, 1, 2, 3, 4].map((index) => (
              <span
                key={index}
                style={{
                  animation: `nexusSwapRouteDot 2400ms ${index * 220}ms infinite`,
                  background: "#9FC4FF",
                  borderRadius: "2px",
                  display: "block",
                  height: "6px",
                  opacity: 0.45,
                  width: "6px",
                }}
              />
            ))}
          </div>

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
                alignItems: "baseline",
                color: primary,
                display: "flex",
                gap: "6px",
                fontFamily,
                fontSize: "21px",
                fontWeight: 600,
                lineHeight: "26px",
              }}
            >
              {destinationHeaderAmount}
              <span style={{ color: muted, fontSize: "12px", fontWeight: 500 }}>
                {destTokenSymbol}
              </span>
            </div>
            <div
              style={{
                color: muted,
                fontFamily,
                fontSize: "12px",
                lineHeight: "17px",
              }}
            >
              {destChainName ? `on ${destChainName}` : destTokenSymbol}
            </div>
          </div>
        </div>

        <Row
          title={isDepositMode || isSendMode ? "Paying With" : "You Swap"}
          subtitle={sourceLabel}
          value={sourceUsd}
        >
          <DetailToggle
            expanded={showSourceDetails}
            onClick={() => setShowSourceDetails((value) => !value)}
          />
        </Row>

        <AnimatedDetails open={showSourceDetails}>
          {sourceDetailRows.length > 0 ? (
            <div
              style={{
                position: "relative",
              }}
            >
              <div
                ref={sourceDetailsScrollRef}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0",
                  maxHeight: shouldScrollSourceDetails ? "174px" : undefined,
                  overflowY: shouldScrollSourceDetails ? "auto" : undefined,
                  paddingRight: shouldScrollSourceDetails ? "8px" : undefined,
                  scrollbarColor: shouldScrollSourceDetails
                    ? "#C8C8C7 transparent"
                    : undefined,
                  scrollbarWidth: shouldScrollSourceDetails ? "thin" : undefined,
                }}
              >
                {sourceDetailRows.map((source) => (
                  <div
                    key={source.key}
                    style={{
                      alignItems: "center",
                      display: "flex",
                      gap: "10px",
                      justifyContent: "space-between",
                      minHeight: "58px",
                      padding: "8px 0",
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
                      <div
                        style={{
                          flexShrink: 0,
                          height: "28px",
                          position: "relative",
                          width: "28px",
                        }}
                      >
                        <IntentLogo
                          src={source.tokenLogo}
                          alt={source.symbol}
                          label={source.symbol}
                          size={28}
                          fontSize={13}
                        />
                        {source.chainLogo && (
                          <IntentLogo
                            src={source.chainLogo}
                            alt={source.chainName}
                            label={source.chainName}
                            size={13}
                            fontSize={6}
                            outline="1px solid #FFFFFE"
                            style={{
                              bottom: -2,
                              position: "absolute",
                              right: -2,
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            color: primary,
                            fontFamily,
                            fontSize: "13px",
                            fontWeight: 600,
                            lineHeight: "17px",
                          }}
                        >
                          {source.symbol}
                        </span>
                        <span
                          style={{
                            color: muted,
                            fontFamily,
                            fontSize: "12px",
                            lineHeight: "16px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          on {source.chainName || "Unknown chain"}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        alignItems: "flex-end",
                        display: "flex",
                        flexDirection: "column",
                        flexShrink: 0,
                        gap: "3px",
                        textAlign: "right",
                      }}
                    >
                      <span style={{ color: primary, fontFamily, fontSize: "12px" }}>
                        {source.tokenAmount}
                      </span>
                      <span style={{ color: muted, fontFamily, fontSize: "12px" }}>
                        {source.usdAmount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {shouldScrollSourceDetails && (
                <button
                  aria-label="Scroll source assets"
                  type="button"
                  onClick={() => {
                    sourceDetailsScrollRef.current?.scrollBy({
                      behavior: "smooth",
                      top: 54,
                    });
                  }}
                  style={{
                    alignItems: "center",
                    background: "#FFFFFE",
                    border: `1px solid ${border}`,
                    borderRadius: "999px",
                    boxShadow: "0 2px 8px rgba(22,22,21,0.08)",
                    bottom: "4px",
                    cursor: "pointer",
                    display: "flex",
                    height: "20px",
                    justifyContent: "center",
                    left: "50%",
                    padding: 0,
                    position: "absolute",
                    transform: "translateX(-50%)",
                    width: "20px",
                  }}
                >
                  <ChevronDown style={{ color: muted, height: 12, width: 12 }} />
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: muted, fontFamily, fontSize: "12px" }}>
                {pendingLabel}
              </span>
            </div>
          )}
        </AnimatedDetails>

        <Row
          title={
            isDepositMode ? "You Deposit" : isSendMode ? "You Send" : "You Receive"
          }
          subtitle={
            destChainName ? `${destTokenSymbol} on ${destChainName}` : destTokenSymbol
          }
          value={receiveUsd}
          secondaryValue={destinationTokenDisplay}
        />

        {isSendMode && recipientAddress && (
          <RecipientRow address={recipientAddress} />
        )}

        <Row title="Total Fees" subtitle="Network & protocol" value={feeUsd}>
          <DetailToggle
            expanded={showFeeDetails}
            onClick={() => setShowFeeDetails((value) => !value)}
          />
        </Row>

        <AnimatedDetails open={showFeeDetails}>
          {feeDetailRows.length > 0 ? (
            feeDetailRows.map((row) => (
              <div
                key={row.label}
                style={{
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: muted, fontFamily, fontSize: "12px" }}>
                  {row.label}
                </span>
                <span style={{ color: primary, fontFamily, fontSize: "12px" }}>
                  {formatUsdValue(row.value)}
                </span>
              </div>
            ))
          ) : (
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: muted, fontFamily, fontSize: "12px" }}>
                Network & protocol
              </span>
              <span style={{ color: primary, fontFamily, fontSize: "12px" }}>
                {pendingValue}
              </span>
            </div>
          )}
        </AnimatedDetails>

        {hasGasDetails && (
          <>
            <Row
              title={isSendMode ? "Gas Fee" : "Deposit Gas Fees"}
              subtitle={isSendMode ? "Destination transfer" : "Destination execution"}
              value={depositGasUsdDisplay}
            >
              <DetailToggle
                expanded={showGasDetails}
                onClick={() => setShowGasDetails((value) => !value)}
              />
            </Row>

            <AnimatedDetails open={showGasDetails}>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: muted, fontFamily, fontSize: "12px" }}>
                  Native gas
                </span>
                <span style={{ color: primary, fontFamily, fontSize: "12px" }}>
                  {depositGasNativeDisplay}
                </span>
              </div>
            </AnimatedDetails>
          </>
        )}

        <Row
          title="Price Impact"
          subtitle={`${destTokenSymbol} · estimated`}
          value={impactUsd}
        >
          <DetailToggle
            expanded={showImpactDetails}
            onClick={() => setShowImpactDetails((value) => !value)}
          />
        </Row>

        <AnimatedDetails
          open={showImpactDetails}
          background="#FAFAF9"
          gap="15px"
          padding="18px 18px"
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: muted, fontFamily, fontSize: "12px" }}>
              Swap Impact
            </span>
            <span
              style={{
                color:
                  hasFiatQuote &&
                  swapImpactPercent !== undefined &&
                  swapImpactPercent.lte(0)
                    ? "#168A47"
                    : primary,
                fontFamily,
                fontSize: "12px",
              }}
            >
              {impactPercent}
            </span>
          </div>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: muted, fontFamily, fontSize: "12px" }}>
              Max. Slippage
            </span>
            <span style={{ color: primary, fontFamily, fontSize: "12px" }}>
              Auto
            </span>
          </div>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: muted, fontFamily, fontSize: "12px" }}>
              Swap Buffer
            </span>
            <span style={{ color: primary, fontFamily, fontSize: "12px" }}>
              {swapBufferDisplay}
            </span>
          </div>
          {shouldShowMinReceived && (
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: muted, fontFamily, fontSize: "12px" }}>
                Min. Received
              </span>
              <span style={{ color: primary, fontFamily, fontSize: "12px" }}>
                {minReceivedDisplay}
              </span>
            </div>
          )}
        </AnimatedDetails>
      </div>

      {isExecuting && steps && steps.length > 0 && (
        <div
          style={{
            background: "#FFFFFE",
            border: `1px solid ${border}`,
            borderRadius: "12px",
            boxShadow: "0px 1px 12px 0px #5B5B5B0D",
            padding: "14px 16px",
            width: "100%",
          }}
        >
          <TransactionProgress
            steps={steps}
            explorerUrls={progressExplorerUrls}
            sourceSymbol={primarySourceForProgress.symbol}
            destinationSymbol={destTokenSymbol}
            sourceLogos={{
              chain: primarySourceForProgress.chainLogo,
              token: primarySourceForProgress.tokenLogo,
            }}
            destinationLogos={destinationProgressLogos}
            hasMultipleSources={progressSources.length > 1}
            sources={progressSources.length > 1 ? progressSources : undefined}
            isTransferMode={isSendMode}
            depositOpportunityName={
              isDepositMode
                ? opportunity?.title || opportunity?.protocol
                : undefined
            }
          />
        </div>
      )}

      <Button
        onClick={onAccept}
        disabled={isLoading || isRefreshing || isExecuting || quoteUnavailable}
        style={{
          background: brand,
          borderRadius: "8px",
          boxShadow: "0px 1px 4px 0px #5555550D",
          color: "#FFFFFE",
          fontFamily,
          fontSize: "13px",
          fontWeight: 500,
          height: "52px",
          width: "100%",
        }}
      >
        {isExecuting ? (
          isDepositMode ? "Depositing..." : isSendMode ? "Sending..." : "Swapping..."
        ) : isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRefreshing ? (
          "Refreshing quotes..."
        ) : quoteUnavailable ? (
          pendingLabel
        ) : (
          ctaLabel
        )}
      </Button>
    </div>
  );
}
