// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

"use client";

import Decimal from "decimal.js";
import { ChevronDown, Info, Loader2 } from "lucide-react";
import React, { useRef, useState } from "react";
import type { SwapStepType } from "../../common/types/transaction-flow";
import { CHAIN_METADATA, getShortChainName } from "../../common/utils/constant";
import TransactionProgress from "../../swaps/components/transaction-progress";
import { Button } from "../../ui/button";
import {
  type NexusWidgetDepositOpportunityMetadata,
  type NexusWidgetMode,
} from "../types";
import { type SwapTokenOption } from "./swap-asset-selector";

export interface SwapIntentSource {
  amount: string;
  chain: { id: number; logo: string; name: string };
  token: { contractAddress: string; decimals: number; symbol: string };
  value?: string;
}

export interface SwapIntentDestination {
  amount: string;
  chain: { id: number; logo: string; name: string };
  gas: {
    amount: string;
    value?: string;
    token: { contractAddress: string; decimals: number; symbol: string };
  };
  token: { contractAddress: string; decimals: number; symbol: string };
  value?: string;
}

export type BridgeProvider = "nexus" | "mayan" | null;

export interface SwapIntentData {
  bridgeProvider?: BridgeProvider;
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
  sources: SwapIntentSource[];
}

export interface SwapIntentPreviewProps {
  activeMode?: NexusWidgetMode;
  estimatedTime?: string;
  explorerUrls?: {
    sourceExplorerUrl: string | null;
    destinationExplorerUrl: string | null;
  };
  fromAmount: string;
  fromAmountUsd?: string;
  fromToken?: SwapTokenOption;
  fromTokens?: SwapTokenOption[];
  intentData?: SwapIntentData | null;
  isExecuting?: boolean;
  isLoading?: boolean;
  isRefreshing?: boolean;
  mode?: NexusWidgetMode;
  onAccept: () => void;
  onReject: () => void;
  onTransitionChange?: (isTransitioning: boolean) => void;
  opportunity?: NexusWidgetDepositOpportunityMetadata;
  recipientAddress?: string;
  steps?: Array<{ id: number; completed: boolean; step: SwapStepType }>;
  supportedTokenAssets?: any[] | null;
  swapBalances?: any[] | null;
  swapType?: "exactIn" | "exactOut";
  toAmount?: string;
  toAmountTokens?: string;
  toAmountUsd?: string;
  toToken?: SwapTokenOption;
  totalFeeUsd?: string;
}

const fontFamily = '"Geist", var(--font-geist-sans), system-ui, sans-serif';
const primary = "var(--foreground-primary, #161615)";
const muted = "var(--foreground-muted, #848483)";
const border = "var(--border-default, #E8E8E7)";
const brand = "var(--foreground-brand)";

const stripNumeric = (value: unknown) => String(value).replace(/[^0-9.-]/g, "");

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

const formatUsdAmount = (value: Decimal) => {
  if (value.gt(0) && value.lt(0.01)) return "<0.01 USD";
  return value.gt(0) ? `${formatAmount(value)} USD` : "0 USD";
};

const formatUsdValue = (value: Decimal) => {
  const absolute = value.abs();
  if (absolute.eq(0)) return "$0";
  if (absolute.lt(0.01)) return value.lt(0) ? "-<$0.01" : "<$0.01";

  const amount = formatAmount(absolute, { max: 2 });

  return value.lt(0) ? `-$${amount}` : `$${amount}`;
};

const formatTokenAmount = (value: unknown) => {
  const amount = toDecimal(value);
  return amount.toDecimalPlaces(8).toFixed();
};

const formatHeaderTokenAmount = (value: unknown) => {
  const amount = toDecimal(value);
  if (amount.isZero()) return "0";
  if (amount.abs().gte(1000)) {
    return amount.toDecimalPlaces(2).toFixed();
  }
  if (amount.abs().gte(1)) {
    return amount.toDecimalPlaces(4).toFixed();
  }
  return amount.toDecimalPlaces(8).toFixed();
};

const getFontSize = (amountStr: string, symbolStr: string) => {
  const totalLength =
    String(amountStr || "").length + String(symbolStr || "").length;
  if (totalLength > 16) return "13px";
  if (totalLength > 12) return "15px";
  return "17px";
};

const unique = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean)));

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
  const shouldUseNative =
    isNativeTokenAddress(token?.contractAddress) && Boolean(chainMeta);
  const symbol =
    shouldUseNative && chainMeta?.nativeCurrency.symbol
      ? chainMeta.nativeCurrency.symbol
      : token?.symbol || chainMeta?.nativeCurrency.symbol || "-";
  const decimals =
    shouldUseNative && chainMeta?.nativeCurrency.decimals !== undefined
      ? chainMeta.nativeCurrency.decimals
      : (token?.decimals ?? chainMeta?.nativeCurrency.decimals ?? 18);

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
  if (visible.length === 3)
    return `${visible[0]}, ${visible[1]} and ${visible[2]}`;

  const others = visible.length - 2;
  return `${visible[0]}, ${visible[1]} and ${others} other${others === 1 ? "" : "s"}`;
};

const sortSourceDetailRowsByUsdDesc = <
  T extends { symbol?: string; usdAmount?: string },
>(
  rows: T[],
) =>
  [...rows].sort((a, b) => {
    const usdDelta = toDecimal(b.usdAmount).cmp(toDecimal(a.usdAmount));
    if (usdDelta !== 0) return usdDelta;
    return (a.symbol ?? "").localeCompare(b.symbol ?? "");
  });

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
        alt={alt || label || ""}
        onError={() => setFailed(true)}
        src={src}
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
      onClick={onClick}
      style={{
        alignItems: "center",
        background: "transparent",
        border: "none",
        color: brand,
        cursor: "pointer",
        display: "flex",
        fontFamily,
        fontSize: "12px",
        gap: "3px",
        lineHeight: "14px",
        padding: 0,
      }}
      type="button"
    >
      {expanded ? "Hide Details" : "View Details"}
      <ChevronDown
        style={{
          height: 12,
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 180ms ease",
          width: 12,
        }}
      />
    </button>
  );
}

function TruncatedAddress({ address }: { address: string }) {
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
        color: brand,
        display: "inline-flex",
        fontFamily,
        fontSize: "13px",
        fontWeight: 500,
        lineHeight: "15px",
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
            border: `1px solid ${border}`,
            borderRadius: "8px",
            boxShadow: "0 6px 18px rgba(22,22,21,0.10)",
            color: primary,
            fontFamily,
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

function RecipientRow({ address }: { address: string }) {
  return (
    <div
      style={{
        borderTop: `1px solid ${border}`,
        display: "flex",
        justifyContent: "space-between",
        padding: "13px 14px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
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
            fontSize: "12px",
            lineHeight: "14px",
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

function InlineInfoTooltip({ message }: { message: string }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      onBlur={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        alignItems: "center",
        color: muted,
        display: "inline-flex",
        lineHeight: 0,
        outline: "none",
        position: "relative",
      }}
      tabIndex={0}
    >
      <Info style={{ height: 13, width: 13 }} />
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
            fontSize: "13px",
            fontWeight: 500,
            lineHeight: "17px",
            padding: "7px 9px",
            pointerEvents: "none",
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "normal",
            width: "210px",
            zIndex: 10000,
          }}
        >
          {message}
        </span>
      )}
    </span>
  );
}

function MayanPoweredBadge() {
  return (
    <div
      style={{
        alignItems: "center",
        background: "#F3F6FF",
        border: "1px solid #E8EEFF",
        borderRadius: "8px",
        color: brand,
        display: "flex",
        fontFamily,
        fontSize: "12px",
        fontWeight: 500,
        gap: "4px",
        lineHeight: "16px",
        minHeight: "36px",
        padding: "9px 12px",
        width: "100%",
      }}
    >
      <Info style={{ flexShrink: 0, height: 13, width: 13 }} />
      <span style={{ flexShrink: 0 }}>This transaction is powered by</span>
      <img
        alt="Mayan"
        src="/mayan_logo.svg"
        style={{
          display: "block",
          height: "20px",
          objectFit: "contain",
          width: "auto",
        }}
      />
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
  title: React.ReactNode;
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
        padding: "16px 16px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div
          style={{
            color: primary,
            fontFamily,
            fontSize: "14px",
            fontWeight: 600,
            lineHeight: "20px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: muted,
            fontFamily,
            fontSize: "12px",
            lineHeight: "15px",
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
          gap: "5px",
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
              fontSize: "12px",
              lineHeight: "14px",
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
  gap = "9px",
  padding = "12px 14px",
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
            padding: open ? padding : "0 16px",
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
  onTransitionChange,
}: SwapIntentPreviewProps) {
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [showImpactDetails, setShowImpactDetails] = useState(false);
  const sourceDetailsScrollRef = useRef<HTMLDivElement | null>(null);
  const [transitionTimeoutId, setTransitionTimeoutId] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const startTransition = () => {
    if (onTransitionChange) {
      onTransitionChange(true);
    }
    if (transitionTimeoutId) {
      clearTimeout(transitionTimeoutId);
    }
    const id = setTimeout(() => {
      if (onTransitionChange) {
        onTransitionChange(false);
      }
      setTransitionTimeoutId(null);
    }, 280);
    setTransitionTimeoutId(id);
  };

  React.useEffect(() => {
    return () => {
      if (transitionTimeoutId) {
        clearTimeout(transitionTimeoutId);
      }
    };
  }, [transitionTimeoutId]);

  const flowMode = mode ?? activeMode ?? "swap";
  const isDepositMode = flowMode === "deposit";
  const isSendMode = flowMode === "send";
  const hasRecipientTransfer = Boolean(recipientAddress) && !isDepositMode;
  const isExactOutDisplayFlow =
    (isDepositMode || isSendMode) && swapType === "exactOut";
  const shouldShowSwapBuffer = swapType !== "exactIn";
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
          token: normalizeIntentToken(
            intentDest.gas?.token,
            intentDest.chain.id,
          ),
        },
      }
    : undefined;
  const fallbackSources =
    fromTokens && fromTokens.length > 0
      ? fromTokens
      : fromToken
        ? [fromToken]
        : [];

  const baseSourceSymbols =
    normalizedIntentSources.length > 0
      ? unique(normalizedIntentSources.map((source) => source.token.symbol))
      : unique(fallbackSources.map((source) => source.symbol));
  const baseSourceAssetCount =
    normalizedIntentSources.length ||
    fallbackSources.length ||
    baseSourceSymbols.length;
  const hasResolvedQuote = Boolean(
    normalizedIntentDest &&
    (normalizedIntentSources.length > 0 || isExactOutDisplayFlow),
  );
  const quoteUnavailable = !isLoading && !hasResolvedQuote;

  const destTokenSymbol =
    normalizedIntentDest?.token.symbol ||
    toToken?.symbol ||
    opportunity?.tokenSymbol ||
    "-";
  const destChainName =
    flowMode === "deposit"
      ? opportunity?.title || opportunity?.protocol || "App"
      : getShortChainName(
          normalizedIntentDest?.chain.id ?? toToken?.chainId,
          normalizedIntentDest?.chain.name || toToken?.chainName || "",
        );

  const requestedDestinationAmount = isExactOutDisplayFlow
    ? parseDecimal(toAmountTokens ?? toAmount)
    : undefined;
  const quotedDestinationAmount = parseDecimal(normalizedIntentDest?.amount);
  const destinationBalanceAmount = parseDecimal(toToken?.balance);
  const displayOnlyDestinationCoverage = (() => {
    if (
      !isExactOutDisplayFlow ||
      !requestedDestinationAmount ||
      requestedDestinationAmount.lte(0) ||
      !destinationBalanceAmount ||
      destinationBalanceAmount.lte(0)
    ) {
      return undefined;
    }

    const externallyProducedAmount =
      normalizedIntentSources.length > 0 &&
      quotedDestinationAmount &&
      quotedDestinationAmount.gt(0)
        ? quotedDestinationAmount
        : new Decimal(0);
    const destinationBalanceAmountNeeded = Decimal.max(
      requestedDestinationAmount.minus(externallyProducedAmount),
      0,
    );
    const coveredAmount = Decimal.min(
      destinationBalanceAmountNeeded,
      destinationBalanceAmount,
    );
    return coveredAmount.gt(0) ? coveredAmount : undefined;
  })();
  const displayOnlyDestinationSourceAmount = displayOnlyDestinationCoverage;
  const requestedDestinationUsd = parseDecimal(toAmountUsd);
  const destinationDisplayUsdRate =
    requestedDestinationAmount &&
    requestedDestinationAmount.gt(0) &&
    requestedDestinationUsd &&
    requestedDestinationUsd.gt(0)
      ? requestedDestinationUsd.div(requestedDestinationAmount)
      : quotedDestinationAmount &&
          quotedDestinationAmount.gt(0) &&
          normalizedIntentDest?.value
        ? (parseDecimal(normalizedIntentDest.value) ?? new Decimal(0)).div(
            quotedDestinationAmount,
          )
        : undefined;
  const displayOnlyDestinationCoverageUsd =
    displayOnlyDestinationCoverage &&
    displayOnlyDestinationCoverage.gt(0) &&
    destinationDisplayUsdRate &&
    destinationDisplayUsdRate.gt(0)
      ? displayOnlyDestinationCoverage.mul(destinationDisplayUsdRate)
      : undefined;
  const displayOnlyDestinationSourceUsd =
    displayOnlyDestinationSourceAmount &&
    displayOnlyDestinationSourceAmount.gt(0) &&
    destinationDisplayUsdRate &&
    destinationDisplayUsdRate.gt(0)
      ? displayOnlyDestinationSourceAmount.mul(destinationDisplayUsdRate)
      : undefined;

  const intentSourceUsdValues = normalizedIntentSources.map((source) =>
    parseDecimal(source.value),
  );
  const intentSourceUsdNumber =
    normalizedIntentSources.length > 0
      ? intentSourceUsdValues.every((value) => value !== undefined)
        ? intentSourceUsdValues.reduce(
            (sum, value) => sum.plus(value ?? 0),
            new Decimal(0),
          )
        : parseDecimal(fromAmountUsd)
      : parseDecimal(fromAmountUsd);
  const effectiveSourceUsdNumber =
    displayOnlyDestinationCoverageUsd !== undefined
      ? (intentSourceUsdNumber ?? new Decimal(0)).plus(
          displayOnlyDestinationCoverageUsd,
        )
      : intentSourceUsdNumber;

  const destinationUsdNumber = hasResolvedQuote
    ? isExactOutDisplayFlow
      ? (parseDecimal(toAmountUsd) ?? parseDecimal(normalizedIntentDest?.value))
      : (parseDecimal(normalizedIntentDest?.value) ?? parseDecimal(toAmountUsd))
    : undefined;
  const hasFiatQuote =
    effectiveSourceUsdNumber !== undefined &&
    destinationUsdNumber !== undefined &&
    effectiveSourceUsdNumber.gt(0) &&
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
  const bridgeComponentsTotalNumber = bridgeFeeData
    ? [
        executionGasFeeNumber,
        protocolFeeNumber,
        solverFeeNumber,
        gasSuppliedNumber,
      ].reduce<Decimal>(
        (sum, value) => sum.plus(value ?? new Decimal(0)),
        new Decimal(0),
      )
    : undefined;
  const explicitFeeNumber =
    bridgeTotalNumber ??
    (bridgeComponentsTotalNumber && bridgeComponentsTotalNumber.gt(0)
      ? bridgeComponentsTotalNumber
      : undefined) ??
    parseDecimal(totalFeeUsd) ??
    parseDecimal((intentData as any)?.fees?.total);
  const feeNumber =
    explicitFeeNumber ?? (hasFiatQuote ? new Decimal(0) : undefined);
  const quotedDestinationUsdNumber = parseDecimal(normalizedIntentDest?.value);
  const exactOutPaidUsdNumber = (() => {
    if (!isExactOutDisplayFlow) return effectiveSourceUsdNumber;

    const candidates = [
      effectiveSourceUsdNumber,
      requestedDestinationUsd,
    ].filter((value): value is Decimal => Boolean(value && value.gt(0)));

    if (requestedDestinationUsd && requestedDestinationUsd.gt(0)) {
      if (
        intentSourceUsdNumber &&
        intentSourceUsdNumber.gt(0) &&
        quotedDestinationUsdNumber &&
        quotedDestinationUsdNumber.gt(0)
      ) {
        candidates.push(
          requestedDestinationUsd.plus(
            Decimal.max(
              intentSourceUsdNumber.minus(quotedDestinationUsdNumber),
              0,
            ),
          ),
        );
      }

      const knownOverhead = (feeNumber ?? new Decimal(0)).plus(
        swapBufferNumber ?? new Decimal(0),
      );
      if (knownOverhead.gt(0)) {
        candidates.push(requestedDestinationUsd.plus(knownOverhead));
      }
    }

    return candidates.reduce<Decimal | undefined>(
      (max, value) => (!max || value.gt(max) ? value : max),
      undefined,
    );
  })();
  const quoteImpactUsd =
    hasFiatQuote && feeNumber !== undefined
      ? Decimal.max(
          effectiveSourceUsdNumber
            .minus(destinationUsdNumber)
            .minus(feeNumber)
            .minus(swapBufferNumber ?? new Decimal(0)),
          0,
        )
      : undefined;
  const priceImpactUsd =
    quoteImpactUsd ?? parseDecimal((intentData as any)?.priceImpactUsd);
  const computedSwapImpactPercent =
    hasFiatQuote && priceImpactUsd !== undefined
      ? priceImpactUsd.eq(0)
        ? new Decimal(0)
        : effectiveSourceUsdNumber !== undefined &&
            effectiveSourceUsdNumber.gt(0)
          ? priceImpactUsd.neg().div(effectiveSourceUsdNumber).mul(100)
          : undefined
      : undefined;
  const swapImpactPercent =
    computedSwapImpactPercent ??
    parseDecimal((intentData as any)?.swapImpactPercent) ??
    parseDecimal((intentData as any)?.priceImpactPercent);

  const destinationTokenAmount =
    isExactOutDisplayFlow && (toAmountTokens || toAmount)
      ? toAmountTokens || toAmount || "0"
      : normalizedIntentDest?.amount || toAmountTokens || toAmount || "0";
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
          ? [{ label: "Gas Sponsorship", value: gasSuppliedNumber }]
          : []),
      ]
    : feeNumber !== undefined
      ? [{ label: "Network & protocol", value: feeNumber }]
      : [];

  const pendingLabel = isLoading ? "Fetching quote" : "Quote unavailable";
  const pendingValue = isLoading ? "..." : "--";
  const sourceUsd =
    exactOutPaidUsdNumber !== undefined
      ? `${formatAmount(exactOutPaidUsdNumber)} USD`
      : pendingValue;
  const receiveUsd = hasFiatQuote
    ? `${formatAmount(destinationUsdNumber)} USD`
    : pendingValue;
  const feeUsd =
    feeNumber !== undefined ? formatUsdAmount(feeNumber) : pendingValue;
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
    ? formatHeaderTokenAmount(destinationTokenAmount)
    : pendingValue;
  const destinationTokenDisplay = hasResolvedQuote
    ? `${formatTokenAmount(destinationTokenAmount)} ${destTokenSymbol}`
    : pendingLabel;
  const destinationSourceKey = [
    normalizedIntentDest?.chain.id ?? toToken?.chainId ?? "",
    (
      normalizedIntentDest?.token.contractAddress ??
      toToken?.contractAddress ??
      ""
    ).toLowerCase(),
  ].join("-");
  const hasDestinationSourceRow = Boolean(
    destinationSourceKey !== "-" &&
    (normalizedIntentSources.length > 0
      ? normalizedIntentSources.some((source) => {
          const sourceKey = [
            source.chain.id,
            source.token.contractAddress.toLowerCase(),
          ].join("-");
          return sourceKey === destinationSourceKey;
        })
      : fallbackSources.some((source) => {
          const sourceKey = [
            source.chainId ?? "",
            source.contractAddress.toLowerCase(),
          ].join("-");
          return sourceKey === destinationSourceKey;
        })),
  );
  const swapBufferDisplay =
    swapBufferNumber !== undefined
      ? formatUsdValue(swapBufferNumber)
      : pendingValue;
  const baseSourceDetailRows =
    normalizedIntentSources.length > 0
      ? normalizedIntentSources.map((source, index) => {
          const fallbackSource = fallbackSources.find(
            (token) =>
              token.chainId === source.chain.id &&
              (token.contractAddress?.toLowerCase() ===
                source.token.contractAddress?.toLowerCase() ||
                token.symbol === source.token.symbol),
          );

          const sourceKey = [
            source.chain.id,
            source.token.contractAddress.toLowerCase(),
          ].join("-");
          const isDestinationSource =
            sourceKey === destinationSourceKey &&
            displayOnlyDestinationSourceAmount !== undefined;
          const sourceAmountNumber = parseDecimal(source.amount);
          const displaySourceAmount =
            isDestinationSource && displayOnlyDestinationSourceAmount
              ? (sourceAmountNumber ?? new Decimal(0)).plus(
                  displayOnlyDestinationSourceAmount,
                )
              : sourceAmountNumber;
          const sourceValueNumber = parseDecimal(source.value);
          const displaySourceUsd =
            isDestinationSource && displayOnlyDestinationSourceUsd
              ? (sourceValueNumber ?? new Decimal(0)).plus(
                  displayOnlyDestinationSourceUsd,
                )
              : sourceValueNumber;
          const tokenAmountValue =
            displaySourceAmount !== undefined
              ? formatTokenAmount(displaySourceAmount)
              : formatTokenAmount(source.amount);

          return {
            key: `${source.chain.id}-${source.token.contractAddress}-${index}`,
            tokenLogo: source.token.logo || fallbackSource?.logo || "",
            chainLogo: source.chain.logo || fallbackSource?.chainLogo || "",
            symbol: source.token.symbol,
            chainName: getShortChainName(source.chain.id, source.chain.name),
            tokenAmount: `${tokenAmountValue} ${source.token.symbol}`,
            tokenAmountValue,
            usdAmount:
              displaySourceUsd !== undefined
                ? formatUsdValue(displaySourceUsd)
                : pendingValue,
            index,
          };
        })
      : fallbackSources.map((source, index) => {
          const sourceAmount =
            source.userAmount ||
            (fallbackSources.length === 1 ? fromAmount : "");
          const sourceKey = [
            source.chainId ?? "",
            source.contractAddress.toLowerCase(),
          ].join("-");
          const isDestinationSource =
            sourceKey === destinationSourceKey &&
            displayOnlyDestinationSourceAmount !== undefined;
          const sourceAmountNumber = parseDecimal(sourceAmount);
          const displaySourceAmount =
            isDestinationSource && displayOnlyDestinationSourceAmount
              ? (sourceAmountNumber ?? new Decimal(0)).plus(
                  displayOnlyDestinationSourceAmount,
                )
              : sourceAmountNumber;
          const sourceUsdNumber =
            source.balanceInFiat && source.balance
              ? toDecimal(source.userAmount || 0).mul(
                  toDecimal(source.balanceInFiat).div(
                    Decimal.max(toDecimal(source.balance), 1),
                  ),
                )
              : undefined;
          const displaySourceUsd =
            isDestinationSource && displayOnlyDestinationSourceUsd
              ? (sourceUsdNumber ?? new Decimal(0)).plus(
                  displayOnlyDestinationSourceUsd,
                )
              : sourceUsdNumber;
          const tokenAmountValue =
            displaySourceAmount !== undefined
              ? formatTokenAmount(displaySourceAmount)
              : "";

          return {
            key: `${source.chainId ?? "chain"}-${source.contractAddress}-${index}`,
            tokenLogo: source.logo || "",
            chainLogo: source.chainLogo || "",
            symbol: source.symbol,
            chainName: getShortChainName(source.chainId, source.chainName),
            tokenAmount: tokenAmountValue
              ? `${tokenAmountValue} ${source.symbol}`
              : pendingLabel,
            tokenAmountValue,
            usdAmount:
              displaySourceUsd !== undefined
                ? formatUsdValue(displaySourceUsd)
                : pendingValue,
            index,
          };
        });
  const displayOnlyDestinationSourceRow =
    displayOnlyDestinationSourceAmount &&
    displayOnlyDestinationSourceAmount.gt(0) &&
    !hasDestinationSourceRow
      ? {
          key: `destination-existing-${normalizedIntentDest?.chain.id ?? toToken?.chainId ?? "chain"}-${normalizedIntentDest?.token.contractAddress ?? toToken?.contractAddress ?? "token"}`,
          tokenLogo: normalizedIntentDest?.token.logo || toToken?.logo || "",
          chainLogo:
            normalizedIntentDest?.chain.logo || toToken?.chainLogo || "",
          symbol: destTokenSymbol,
          chainName: getShortChainName(
            normalizedIntentDest?.chain.id ?? toToken?.chainId,
            normalizedIntentDest?.chain.name || toToken?.chainName || "",
          ),
          tokenAmount: `${formatTokenAmount(displayOnlyDestinationSourceAmount)} ${destTokenSymbol}`,
          tokenAmountValue: formatTokenAmount(
            displayOnlyDestinationSourceAmount,
          ),
          usdAmount:
            displayOnlyDestinationSourceUsd !== undefined
              ? formatUsdValue(displayOnlyDestinationSourceUsd)
              : pendingValue,
          index: baseSourceDetailRows.length,
        }
      : undefined;
  const sourceDetailRows = sortSourceDetailRowsByUsdDesc(
    displayOnlyDestinationSourceRow
      ? [...baseSourceDetailRows, displayOnlyDestinationSourceRow]
      : baseSourceDetailRows,
  );
  const sourceSymbols = (() => {
    const symbols =
      sourceDetailRows.length > 0
        ? sourceDetailRows.map((source) => source.symbol)
        : baseSourceSymbols;
    return destTokenSymbol && symbols.includes(destTokenSymbol)
      ? unique([
          destTokenSymbol,
          ...symbols.filter((symbol) => symbol !== destTokenSymbol),
        ])
      : unique(symbols);
  })();
  const sourceLabel = formatSymbolSummary(sourceSymbols);
  const sourceAssetCount =
    sourceDetailRows.length || baseSourceAssetCount || sourceSymbols.length;
  const singleSourceHeader = (() => {
    if (displayOnlyDestinationSourceRow) return null;
    if (
      !displayOnlyDestinationSourceRow &&
      normalizedIntentSources.length === 1
    ) {
      const source = normalizedIntentSources[0];
      const sourceRow = baseSourceDetailRows[0];
      return {
        amount:
          sourceRow?.tokenAmountValue ?? formatHeaderTokenAmount(source.amount),
        chainName: getShortChainName(source.chain.id, source.chain.name),
        symbol: source.token.symbol,
      };
    }

    if (normalizedIntentSources.length === 0 && fallbackSources.length === 1) {
      const source = fallbackSources[0];
      const sourceAmount = source.userAmount || fromAmount;
      if (!sourceAmount) return null;
      return {
        amount:
          baseSourceDetailRows[0]?.tokenAmountValue ??
          formatHeaderTokenAmount(sourceAmount),
        chainName: getShortChainName(source.chainId, source.chainName),
        symbol: source.symbol,
      };
    }

    return null;
  })();
  const sourceHeaderAmount =
    isExactOutDisplayFlow && exactOutPaidUsdNumber !== undefined
      ? formatAmount(exactOutPaidUsdNumber)
      : singleSourceHeader?.amount ||
        (exactOutPaidUsdNumber !== undefined
          ? formatAmount(exactOutPaidUsdNumber)
          : pendingValue);
  const sourceHeaderUnit =
    isExactOutDisplayFlow && exactOutPaidUsdNumber !== undefined
      ? "USD"
      : singleSourceHeader?.symbol || "USD";
  const sourceHeaderSubtitle = (() => {
    if (isExactOutDisplayFlow && exactOutPaidUsdNumber !== undefined) {
      const count = sourceAssetCount || 1;
      return `${count} asset${count === 1 ? "" : "s"}`;
    }

    if (singleSourceHeader) {
      return singleSourceHeader.chainName
        ? `on ${singleSourceHeader.chainName}`
        : "";
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
      : flowMode === "send" || hasRecipientTransfer
        ? "Send now"
        : "Swap now";
  const shouldPulseCta =
    !isLoading && !isRefreshing && !isExecuting && !quoteUnavailable;
  const shouldShowMayanBadge = intentData?.bridgeProvider === "mayan";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <style>
        {`
          @keyframes nexusPreviewCtaPulse {
            0% {
              background-color: var(--nexus-widget-primary, #1F1F1F);
              box-shadow: 0px 1px 4px 0px #5555550D, 0 0 0 0 rgba(31, 31, 31, 0.18);
              transform: scale(1);
            }
            58% {
              background-color: var(--nexus-widget-primary, #161615);
              box-shadow: 0px 5px 12px rgba(22, 22, 21, 0.1), 0 0 0 5px rgba(22, 22, 21, 0.05);
              transform: scale(1.009);
            }
            100% {
              background-color: var(--nexus-widget-primary, #1F1F1F);
              box-shadow: 0px 1px 4px 0px #5555550D, 0 0 0 8px rgba(31, 31, 31, 0);
              transform: scale(1);
            }
          }
        `}
      </style>
      <div
        style={{
          background: "#FFFFFE",
          border: `1px solid ${border}`,
          borderRadius: "9px",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, #FFFFFE 0%, #EEF5FF 100%)",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            minHeight: "79px",
            padding: "19px 14px 16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <div
              style={{
                alignItems: "baseline",
                color: primary,
                display: "flex",
                gap: "5px",
                fontFamily,
                fontSize: getFontSize(sourceHeaderAmount, sourceHeaderUnit),
                fontWeight: 600,
                lineHeight: "22px",
              }}
            >
              {sourceHeaderAmount}
              <span style={{ color: muted, fontSize: "9px", fontWeight: 500 }}>
                {sourceHeaderUnit}
              </span>
            </div>
            <div
              style={{
                color: muted,
                fontFamily,
                fontSize: "9px",
                lineHeight: "14px",
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
              gap: "5px",
              justifyContent: "center",
              padding: "0 12px",
            }}
          >
            {[0, 1, 2, 3, 4].map((index) => (
              <span
                key={index}
                style={{
                  background: index === 2 ? brand : "#9FC4FF",
                  borderRadius: "2px",
                  display: "block",
                  height: "4px",
                  opacity: index === 2 ? 1 : 0.55,
                  width: "4px",
                }}
              />
            ))}
          </div>

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
                alignItems: "baseline",
                color: primary,
                display: "flex",
                gap: "5px",
                fontFamily,
                fontSize: getFontSize(destinationHeaderAmount, destTokenSymbol),
                fontWeight: 600,
                lineHeight: "22px",
              }}
            >
              {destinationHeaderAmount}
              <span style={{ color: muted, fontSize: "9px", fontWeight: 500 }}>
                {destTokenSymbol}
              </span>
            </div>
            <div
              style={{
                color: muted,
                fontFamily,
                fontSize: "9px",
                lineHeight: "14px",
              }}
            >
              {destChainName ? `on ${destChainName}` : destTokenSymbol}
            </div>
          </div>
        </div>

        {singleSourceHeader ? (
          <Row
            secondaryValue={`${singleSourceHeader.amount} ${singleSourceHeader.symbol}`}
            subtitle={
              singleSourceHeader.chainName
                ? `${singleSourceHeader.symbol} on ${singleSourceHeader.chainName}`
                : singleSourceHeader.symbol
            }
            title={isDepositMode || isSendMode ? "Paying With" : "You Swap"}
            value={sourceUsd}
          />
        ) : (
          <Row
            subtitle={sourceLabel}
            title={isDepositMode || isSendMode ? "Paying With" : "You Swap"}
            value={sourceUsd}
          >
            <DetailToggle
              expanded={showSourceDetails}
              onClick={() => {
                startTransition();
                setShowSourceDetails((value) => !value);
              }}
            />
          </Row>
        )}

        {!singleSourceHeader && (
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
                    maxHeight: shouldScrollSourceDetails ? "156px" : undefined,
                    overflowY: shouldScrollSourceDetails ? "auto" : undefined,
                    paddingRight: shouldScrollSourceDetails ? "8px" : undefined,
                    scrollbarColor: shouldScrollSourceDetails
                      ? "#C8C8C7 transparent"
                      : undefined,
                    scrollbarWidth: shouldScrollSourceDetails
                      ? "thin"
                      : undefined,
                  }}
                >
                  {sourceDetailRows.map((source) => (
                    <div
                      key={source.key}
                      style={{
                        alignItems: "center",
                        display: "flex",
                        gap: "9px",
                        justifyContent: "space-between",
                        minHeight: "47px",
                        padding: "6px 0",
                      }}
                    >
                      <div
                        style={{
                          alignItems: "center",
                          display: "flex",
                          gap: "9px",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            flexShrink: 0,
                            height: "23px",
                            position: "relative",
                            width: "23px",
                          }}
                        >
                          <IntentLogo
                            alt={source.symbol}
                            fontSize={11}
                            label={source.symbol}
                            size={23}
                            src={source.tokenLogo}
                          />
                          {source.chainLogo && (
                            <IntentLogo
                              alt={source.chainName}
                              fontSize={5}
                              label={source.chainName}
                              outline="1px solid #FFFFFE"
                              size={11}
                              src={source.chainLogo}
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
                              lineHeight: "16px",
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
                        <span
                          style={{
                            color: primary,
                            fontFamily,
                            fontSize: "12px",
                          }}
                        >
                          {source.tokenAmount}
                        </span>
                        {!isExactOutDisplayFlow && (
                          <span
                            style={{
                              color: muted,
                              fontFamily,
                              fontSize: "12px",
                            }}
                          >
                            {source.usdAmount}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {shouldScrollSourceDetails && (
                  <button
                    aria-label="Scroll source assets"
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
                    type="button"
                  >
                    <ChevronDown
                      style={{ color: muted, height: 12, width: 12 }}
                    />
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
        )}

        <Row
          secondaryValue={destinationTokenDisplay}
          subtitle={
            destChainName
              ? `${destTokenSymbol} on ${destChainName}`
              : destTokenSymbol
          }
          title={
            isDepositMode
              ? "You Deposit"
              : isSendMode
                ? "You Send"
                : "You Receive"
          }
          value={receiveUsd}
        />

        {hasRecipientTransfer && recipientAddress && (
          <RecipientRow address={recipientAddress} />
        )}

        <Row subtitle="Network & protocol" title="Total Fees" value={feeUsd}>
          <DetailToggle
            expanded={showFeeDetails}
            onClick={() => {
              startTransition();
              setShowFeeDetails((value) => !value);
            }}
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

        <Row
          subtitle={`${destTokenSymbol} · estimated`}
          title="Price Impact"
          value={impactUsd}
        >
          <DetailToggle
            expanded={showImpactDetails}
            onClick={() => {
              startTransition();
              setShowImpactDetails((value) => !value);
            }}
          />
        </Row>

        <AnimatedDetails
          background="#FAFAF9"
          gap="12px"
          open={showImpactDetails}
          padding="13px 14px"
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
                  swapImpactPercent.gte(0)
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
        </AnimatedDetails>

        {shouldShowSwapBuffer && (
          <Row
            subtitle="Excess funds are refunded"
            title={
              <span
                style={{
                  alignItems: "center",
                  display: "inline-flex",
                  gap: "6px",
                }}
              >
                Swap Buffer
                <InlineInfoTooltip message="Temporary buffer collected to ensure swaps succeed. Excess funds are refunded." />
              </span>
            }
            value={swapBufferDisplay}
          />
        )}
      </div>

      {isExecuting && steps && steps.length > 0 && (
        <div
          style={{
            background: "#FFFFFE",
            border: `1px solid ${border}`,
            borderRadius: "9px",
            boxShadow: "0px 1px 12px 0px #5B5B5B0D",
            padding: "11px 13px",
            width: "100%",
          }}
        >
          <TransactionProgress
            depositOpportunityName={
              isDepositMode
                ? opportunity?.title || opportunity?.protocol
                : undefined
            }
            destinationLogos={destinationProgressLogos}
            destinationSymbol={destTokenSymbol}
            explorerUrls={progressExplorerUrls}
            hasMultipleSources={progressSources.length > 1}
            isTransferMode={hasRecipientTransfer}
            sourceLogos={{
              chain: primarySourceForProgress.chainLogo,
              token: primarySourceForProgress.tokenLogo,
            }}
            sourceSymbol={primarySourceForProgress.symbol}
            sources={progressSources.length > 1 ? progressSources : undefined}
            steps={steps}
          />
        </div>
      )}

      {shouldShowMayanBadge && <MayanPoweredBadge />}

      <Button
        disabled={isLoading || isRefreshing || isExecuting || quoteUnavailable}
        onClick={onAccept}
        style={{
          animation: shouldPulseCta
            ? "nexusPreviewCtaPulse 1800ms ease-in-out infinite"
            : undefined,
          background: quoteUnavailable
            ? "#F6F6F6"
            : "var(--nexus-widget-primary, #1F1F1F)",
          borderRadius: "10px",
          boxShadow: "0px 1px 4px 0px #5555550D",
          color: quoteUnavailable
            ? "#848483"
            : "var(--nexus-widget-primary-foreground, #FFFFFE)",
          fontFamily,
          fontSize: "14px",
          fontWeight: 500,
          height: "42px",
          transformOrigin: "center",
          willChange: shouldPulseCta
            ? "box-shadow, transform, background-color"
            : undefined,
          width: "100%",
        }}
      >
        {isExecuting ? (
          isDepositMode ? (
            "Depositing..."
          ) : isSendMode || hasRecipientTransfer ? (
            "Sending..."
          ) : (
            "Swapping..."
          )
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
