// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import Decimal from "decimal.js";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatSelectedTokenBalanceLabel,
  formatUsdBalanceLabel,
  type SwapTokenOption,
} from "./swap-asset-selector";

const tabularNums: React.CSSProperties = {
  fontFeatureSettings: '"tnum"',
  fontVariantNumeric: "tabular-nums",
};

const brand = "var(--foreground-brand)";

interface SwapIdleFormProps {
  amount: string;
  defaultRecipientAddress?: string;
  fromTokens: SwapTokenOption[];
  isAmountReadOnly?: boolean;
  isBalanceLoading?: boolean;
  isDestinationPickerDisabled?: boolean;
  hideDestinationTokenDropdownIcon?: boolean;
  isReceiveAmountLoading?: boolean;
  isReceiveUsdLoading?: boolean;
  isSourcePickerDisabled?: boolean;
  onAmountChange: (val: string, panel: "send" | "receive") => void;
  onOpenDestPicker: () => void;
  onOpenRecipientPicker?: () => void;
  onOpenSourcePicker: (index?: number) => void;
  onUpdateTokens?: (tokens: SwapTokenOption[]) => void;
  receiveQuoteAmount?: string;
  receiveQuoteUsd?: string;
  recipientAddress?: string;
  sourceRouteMessage?: string;
  sourceRouteStatus?: "loading" | "insufficient";
  swapType: "exactIn" | "exactOut";
  toToken?: SwapTokenOption;
  totalBalance: string;
  usdValue: string;
}

/** Chevron down icon used in asset selector pills */
const ChevronDownIcon = () => (
  <svg
    height="16"
    style={{ width: "16px", height: "16px", flexShrink: 0 }}
    viewBox="0 0 10 10"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 3.5L5 6.5L8 3.5"
      fill="none"
      stroke="#848483"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.15"
    />
  </svg>
);

const ArrowUpDownIcon = () => (
  <svg
    height="12"
    style={{ flexShrink: 0 }}
    viewBox="0 0 24 24"
    width="12"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7 15L7 3M7 3L11 7M7 3L3 7M17 9L17 21M17 21L13 17M17 21L21 17"
      fill="none"
      stroke="#848483"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

/** Reusable percentage quick-select buttons row with transition wrapper */
function PercentButtons({
  visible,
  onSelect,
  maxLabel = "Max",
}: {
  visible: boolean;
  onSelect: (pct: number) => void;
  maxLabel?: string;
}) {
  const [hoveredPct, setHoveredPct] = useState<number | null>(null);

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#F0F3F9",
        borderRadius: "6px",
        boxShadow: "#2A388B0F 0px 1px 2px inset",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        gap: "2px",
        padding: "2px",
        opacity: visible ? 1 : 0,
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 0.18s ease-out, visibility 0.18s ease-out",
        width: "97px",
      }}
    >
      {[20, 50, 100].map((pct) => {
        const label = pct === 100 ? maxLabel : `${pct}%`;
        const isHovered = hoveredPct === pct;

        return (
          <button
            key={pct}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(pct);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onMouseEnter={() => setHoveredPct(pct)}
            onMouseLeave={() => setHoveredPct(null)}
            style={{
              alignItems: "center",
              backgroundColor: isHovered ? "#FFFFFF" : "transparent",
              borderRadius: "4px",
              boxShadow: isHovered ? "#3C286414 0px 1px 2px" : "none",
              boxSizing: "border-box",
              color: isHovered ? "#1F1F1F" : "#8E8E89",
              cursor: "pointer",
              display: "flex",
              fontFamily: '"Geist", system-ui, sans-serif',
              fontSize: "10px",
              fontWeight: 500,
              height: "18px",
              justifyContent: "center",
              flex: "1 1 0%",
              minWidth: 0,
              paddingInline: "3px",
              border: "none",
              transition: "all 0.15s ease-out",
            }}
            tabIndex={-1}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function UnifiedTokenLogoBadge({
  token,
  size = 24,
}: {
  token: SwapTokenOption;
  size?: number;
}) {
  const [popover, setPopover] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const sources = token.sourceTokens ?? [];
  const chainCount =
    new Set(
      sources
        .map((source) => source.chainId ?? source.chainName)
        .filter(Boolean),
    ).size || sources.length;

  const showPopover = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || typeof window === "undefined") return;
    const width = 250;
    const maxHeight = 260;
    const viewportPadding = 8;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      window.innerWidth - width - viewportPadding,
    );
    const belowTop = rect.bottom + 8;
    const top =
      belowTop + maxHeight > window.innerHeight
        ? Math.max(viewportPadding, rect.top - maxHeight - 8)
        : belowTop;
    setPopover({ left, top, width, maxHeight });
  };

  return (
    <div
      onMouseEnter={showPopover}
      onMouseLeave={() => setPopover(null)}
      ref={triggerRef}
      style={{
        boxSizing: "border-box",
        flexShrink: 0,
        height: `${size}px`,
        position: "relative",
        width: `${size}px`,
      }}
    >
      <LogoCircle
        alt={token.symbol}
        fontSize={Math.max(9, Math.floor(size / 2))}
        label={token.symbol}
        size={size}
        src={token.logo}
      />
      {chainCount > 0 && (
        <div
          style={{
            alignItems: "center",
            backgroundColor: brand,
            border: "1px solid #FFFFFE",
            borderRadius: "999px",
            bottom: -3,
            boxSizing: "border-box",
            color: "#FFFFFE",
            display: "flex",
            fontFamily: '"Geist", system-ui, sans-serif',
            fontSize: "8px",
            fontWeight: 700,
            height: "12px",
            justifyContent: "center",
            lineHeight: "14px",
            minWidth: "12px",
            paddingInline: chainCount > 9 ? "3px" : 0,
            position: "absolute",
            right: -3,
          }}
        >
          {chainCount}
        </div>
      )}
      {popover &&
        sources.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              backgroundColor: "#FFFFFE",
              border: "1px solid #E8E8E7",
              borderRadius: "10px",
              boxShadow: "0 10px 28px rgba(22, 22, 21, 0.14)",
              boxSizing: "border-box",
              ...tabularNums,
              left: popover.left,
              maxHeight: popover.maxHeight,
              overflowY: "auto",
              padding: "12px",
              pointerEvents: "none",
              position: "fixed",
              top: popover.top,
              width: popover.width,
              zIndex: 2147483647,
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  color: "#848483",
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  lineHeight: "16px",
                  textTransform: "uppercase",
                }}
              >
                Unified · {chainCount} {chainCount === 1 ? "Chain" : "Chains"}
              </span>
              <span
                style={{
                  color: "#161615",
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontSize: "15px",
                  fontWeight: 700,
                  lineHeight: "16px",
                }}
              >
                ≈ {formatUsdBalanceLabel(token.balanceInFiat)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {sources.map((source) => (
                <div
                  key={`${source.chainId}-${source.contractAddress}`}
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: "8px",
                    justifyContent: "space-between",
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
                    <LogoCircle
                      alt={source.chainName}
                      fontSize={7}
                      label={source.chainName}
                      size={15}
                      src={source.chainLogo}
                    />
                    <span
                      style={{
                        color: "#161615",
                        fontFamily: '"Geist", system-ui, sans-serif',
                        fontSize: "15px",
                        fontWeight: 500,
                        lineHeight: "20px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {source.chainName || "Unknown chain"}
                    </span>
                  </div>
                  <span
                    style={{
                      color: "#161615",
                      fontFamily: '"Geist", system-ui, sans-serif',
                      fontSize: "15px",
                      fontWeight: 600,
                      lineHeight: "20px",
                    }}
                  >
                    {formatAmountInputDisplay(source.balance || "0")}
                  </span>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function PercentHoverButton({
  label,
  onClick,
  tabIndex,
}: {
  label: string;
  onClick: () => void;
  tabIndex?: number;
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const handledPointerDownRef = useRef(false);
  const pointerResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (pointerResetTimerRef.current) {
        clearTimeout(pointerResetTimerRef.current);
      }
    };
  }, []);

  const isHighlighted = hover || active;

  return (
    <button
      onClick={() => {
        if (handledPointerDownRef.current) {
          if (pointerResetTimerRef.current) {
            clearTimeout(pointerResetTimerRef.current);
            pointerResetTimerRef.current = null;
          }
          handledPointerDownRef.current = false;
          return;
        }
        onClick();
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseUp={() => setActive(false)}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") return;
        event.preventDefault();
        if (pointerResetTimerRef.current) {
          clearTimeout(pointerResetTimerRef.current);
        }
        handledPointerDownRef.current = true;
        setActive(true);
        onClick();
      }}
      onPointerUp={() => {
        setActive(false);
        if (handledPointerDownRef.current) {
          pointerResetTimerRef.current = setTimeout(() => {
            handledPointerDownRef.current = false;
            pointerResetTimerRef.current = null;
          }, 350);
        }
      }}
      style={{
        alignItems: "center",
        backgroundColor: isHighlighted ? "#E8F0FF" : "#F4F4F3",
        borderRadius: "6px",
        boxSizing: "border-box",
        display: "flex",
        flex: "1 1 0%",
        justifyContent: "center",
        paddingBlock: "3px",
        paddingInline: "6px",
        border: "none",
        cursor: "pointer",
        transition: "background-color 0.2s ease-out",
      }}
      tabIndex={tabIndex}
    >
      <div
        style={{
          boxSizing: "border-box",
          color: isHighlighted ? brand : "#363635",
          fontFamily: '"Geist", system-ui, sans-serif',
          fontSize: "11px",
          fontWeight: 500,
          lineHeight: "16px",
          transition: "color 0.2s ease-out",
          ...(label === "MAX" ? { letterSpacing: "0.02em" } : {}),
        }}
      >
        {label}
      </div>
    </button>
  );
}

function SkeletonBar({
  width,
  height,
  borderRadius = "8px",
}: {
  width: string;
  height: string;
  borderRadius?: string;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        background:
          "linear-gradient(90deg, #F0F0EF 0%, #E6EEFF 48%, #F0F0EF 100%)",
        backgroundSize: "200% 100%",
        borderRadius,
        height,
        maxWidth: "100%",
        width,
        animation: "nexusSwapSkeletonShimmer 1.2s ease-in-out infinite",
      }}
    />
  );
}

function LogoCircle({
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

  useEffect(() => {
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
        fontFamily: '"Geist", system-ui, sans-serif',
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

const sameAddress = (a?: string, b?: string) =>
  Boolean(a && b && a.toLowerCase() === b.toLowerCase());

const formatShortAddress = (address?: string) => {
  if (!address) return "";
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
};

const formatTokenBalanceLabel = formatSelectedTokenBalanceLabel;

const parseDecimal = (value: unknown) => {
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

const formatUsdValue = (value: Decimal) =>
  value.gt(0) && value.lt(0.01) ? "<0.01" : value.toDecimalPlaces(2).toFixed(2);

const MAX_AMOUNT_DISPLAY_DECIMALS = 8;
const getTokenInputDecimals = (token?: Pick<SwapTokenOption, "decimals">) => {
  const decimals = Number(token?.decimals);
  return Number.isFinite(decimals) && decimals >= 0 ? Math.floor(decimals) : 18;
};

const formatAmountInputDisplay = (value: string) => {
  if (!value) return "";
  try {
    return new Decimal(value)
      .toDecimalPlaces(MAX_AMOUNT_DISPLAY_DECIMALS, Decimal.ROUND_DOWN)
      .toFixed();
  } catch {
    return value;
  }
};

export function SwapIdleForm({
  amount,
  receiveQuoteAmount,
  receiveQuoteUsd,
  isReceiveAmountLoading = false,
  isReceiveUsdLoading = false,
  sourceRouteStatus,
  sourceRouteMessage,
  onAmountChange,
  fromTokens,
  toToken,
  totalBalance,
  usdValue,
  onOpenSourcePicker,
  onOpenDestPicker,
  onOpenRecipientPicker,
  recipientAddress,
  defaultRecipientAddress,
  swapType,
  onUpdateTokens,
  isAmountReadOnly = false,
  isBalanceLoading = false,
  isDestinationPickerDisabled = false,
  hideDestinationTokenDropdownIcon = false,
  isSourcePickerDisabled = false,
}: SwapIdleFormProps) {
  const [focusedPanel, setFocusedPanel] = useState<"send" | "receive" | null>(
    null,
  );
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [tooltipTriggerRect, setTooltipTriggerRect] = useState<DOMRect | null>(
    null,
  );
  const sourceListRef = useRef<HTMLDivElement | null>(null);
  const sourceRowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const sourceInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const previousSourceCountRef = useRef(fromTokens.length);
  const prevTokensRef = useRef<SwapTokenOption[]>(fromTokens);
  const [autofocusIndex, setAutofocusIndex] = useState<number | null>(null);

  useEffect(() => {
    const prev = prevTokensRef.current;
    if (fromTokens.length > prev.length) {
      setAutofocusIndex(fromTokens.length - 1);
    } else if (fromTokens.length === prev.length) {
      for (let i = 0; i < fromTokens.length; i++) {
        const p = prev[i];
        const c = fromTokens[i];
        if (
          p &&
          c &&
          (p.contractAddress !== c.contractAddress ||
            p.chainId !== c.chainId) &&
          !c.userAmount
        ) {
          setAutofocusIndex(i);
          break;
        }
      }
    }
    prevTokensRef.current = fromTokens;
  }, [fromTokens]);

  useEffect(() => {
    const previousSourceCount = previousSourceCountRef.current;
    if (fromTokens.length > previousSourceCount && previousSourceCount > 0) {
      const newIndex = fromTokens.length - 1;
      requestAnimationFrame(() => {
        const input = sourceInputRefs.current[newIndex];
        if (input) {
          input.focus();
          input.select();
        }

        const container = sourceListRef.current;
        const row = sourceRowRefs.current[newIndex];
        if (
          !container ||
          !row ||
          container.scrollHeight <= container.clientHeight
        ) {
          return;
        }

        const containerRect = container.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const nextTop =
          rowRect.top - containerRect.top + container.scrollTop - 8;

        container.scrollTo({
          behavior: "smooth",
          top: Math.max(0, nextTop),
        });
      });
    }
    previousSourceCountRef.current = fromTokens.length;
  }, [fromTokens.length]);

  const sanitizeInput = (raw: string, maxDecimals = 18): string => {
    let next = raw.replaceAll(/[^0-9.]/g, "");
    const parts = next.split(".");
    if (parts.length > 2) next = parts[0] + "." + parts.slice(1).join("");
    const [integerPart, decimalPart] = next.split(".");
    if (decimalPart !== undefined) {
      next = `${integerPart}.${decimalPart.slice(0, Math.max(0, maxDecimals))}`;
    }
    if (next === ".") next = "0.";
    // Strip leading zeros
    if (next.length > 1 && next.startsWith("0") && next[1] !== ".") {
      next = next.replace(/^0+/, "");
      if (next === "") next = "0";
      if (next.startsWith(".")) next = "0" + next;
    }
    return next;
  };

  const handleBlurAmount = (index: number) => {
    if (!onUpdateTokens) return;
    const token = fromTokens[index];
    if (!token || !token.userAmount) return;
    if (token.userAmount.includes(".")) {
      const stripped = token.userAmount.replace(/0+$/, "").replace(/\.$/, "");
      if (stripped !== token.userAmount) {
        const next = [...fromTokens];
        next[index] = { ...token, userAmount: stripped };
        onUpdateTokens(next);
      }
    }
  };

  const handleSendInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAmountReadOnly) return;
    const token = fromTokens.length === 1 ? fromTokens[0] : undefined;
    onAmountChange(
      sanitizeInput(e.target.value, getTokenInputDecimals(token)),
      "send",
    );
  };

  const handleTokenAmountChange = (index: number, val: string) => {
    if (isAmountReadOnly) return;
    if (!onUpdateTokens) return;
    const token = fromTokens[index];
    if (!token) return;

    let sanitized = sanitizeInput(
      val,
      token.userAmountMode === "usd"
        ? MAX_AMOUNT_DISPLAY_DECIMALS
        : getTokenInputDecimals(token),
    );

    const next = [...fromTokens];
    next[index] = { ...token, userAmount: sanitized };
    onUpdateTokens(next);

    // Also update total amount for backwards compatibility if needed
    const total = next.reduce((sum, t) => sum + Number(t.userAmount || 0), 0);
    onAmountChange(total > 0 ? String(total) : "", "send");
  };

  const handleToggleMode = (index: number) => {
    if (isAmountReadOnly) return;
    if (!onUpdateTokens) return;
    const token = fromTokens[index];
    if (!token) return;

    const tokenBalance =
      Number(String(token.balance).replace(/[^0-9.]/g, "")) || 0;
    const fiatBalance =
      Number(String(token.balanceInFiat).replace(/[^0-9.]/g, "")) || 0;
    const price = tokenBalance > 0 ? fiatBalance / tokenBalance : 0;
    if (price === 0) return;

    const currentVal = Number(token.userAmount || 0);
    const next = [...fromTokens];
    if (token.userAmountMode === "usd") {
      const newTokenVal = currentVal > 0 ? (currentVal / price).toString() : "";
      next[index] = {
        ...token,
        userAmountMode: "token",
        userAmount: newTokenVal ? newTokenVal.substring(0, 10) : "",
      };
    } else {
      const newUsdVal = currentVal > 0 ? (currentVal * price).toFixed(2) : "";
      next[index] = { ...token, userAmountMode: "usd", userAmount: newUsdVal };
    }
    onUpdateTokens(next);
    const total = getTokenAmountTotal(next);
    onAmountChange(total > 0 ? String(total) : "", "send");
  };

  const getSourceUsdValue = React.useCallback((token: SwapTokenOption) => {
    if (!token || !token.userAmount) return 0;
    const quotedUsd = parseDecimal(token.userAmountUsd);
    if (quotedUsd && quotedUsd.gte(0)) return quotedUsd.toNumber();
    const tokenBalance =
      Number(String(token.balance).replace(/[^0-9.]/g, "")) || 0;
    const fiatBalance =
      Number(String(token.balanceInFiat).replace(/[^0-9.]/g, "")) || 0;
    const price = tokenBalance > 0 ? fiatBalance / tokenBalance : 0;
    const amountNumber = Number(token.userAmount || 0);
    if (!Number.isFinite(amountNumber)) return 0;
    if (token.userAmountMode === "usd") return amountNumber;
    return amountNumber * price;
  }, []);

  const totalUsd = React.useMemo(() => {
    return fromTokens.reduce((sum, token) => sum + getSourceUsdValue(token), 0);
  }, [fromTokens, getSourceUsdValue]);

  const hasSourceOverflow = fromTokens.length > 3;
  const [isSourceListAtBottom, setIsSourceListAtBottom] = useState(false);
  const updateSourceListScrollState = React.useCallback(() => {
    const element = sourceListRef.current;
    if (!element || !hasSourceOverflow) {
      setIsSourceListAtBottom(false);
      return;
    }

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    setIsSourceListAtBottom(distanceFromBottom <= 2);
  }, [hasSourceOverflow]);

  useEffect(() => {
    requestAnimationFrame(updateSourceListScrollState);
  }, [fromTokens.length, updateSourceListScrollState]);

  const sourceRowsToRender: Array<{
    token: SwapTokenOption | null;
    index: number;
    position: number;
  }> =
    fromTokens.length > 0
      ? fromTokens.map((token, index) => ({ token, index, position: index }))
      : [{ token: null, index: 0, position: 0 }];

  const isExactIn = swapType === "exactIn";
  const showSourceRouteSkeleton = !isExactIn && sourceRouteStatus === "loading";
  const sourceRouteHelper =
    sourceRouteStatus === "insufficient" ? sourceRouteMessage : undefined;
  const receiveBalanceLabel = formatTokenBalanceLabel(toToken);
  const getReceiveUsdRate = () => {
    const quoteTokenAmount = parseDecimal(receiveQuoteAmount);
    const quoteUsdAmount = parseDecimal(receiveQuoteUsd);
    if (quoteTokenAmount?.gt(0) && quoteUsdAmount?.gt(0)) {
      return quoteUsdAmount.div(quoteTokenAmount);
    }

    const tokenBalance = parseDecimal(toToken?.balance);
    const fiatBalance = parseDecimal(toToken?.balanceInFiat);
    if (tokenBalance?.gt(0) && fiatBalance?.gt(0)) {
      return fiatBalance.div(tokenBalance);
    }

    return undefined;
  };
  const receiveInputValue = isExactIn ? (receiveQuoteAmount ?? "") : amount;
  const receiveDisplayValue =
    focusedPanel === "receive"
      ? receiveInputValue
      : formatAmountInputDisplay(receiveInputValue);
  const receiveAmountTextColor =
    (!isExactIn && amount) || (isExactIn && receiveQuoteAmount)
      ? "#161615"
      : "#9E9E9C";
  const receiveUsdRate = getReceiveUsdRate();
  const receiveTokenAmount = parseDecimal(receiveInputValue);
  const receiveUsdAmount = receiveQuoteUsd
    ? parseDecimal(receiveQuoteUsd)
    : receiveTokenAmount && receiveUsdRate
      ? receiveTokenAmount.mul(receiveUsdRate)
      : undefined;
  const receiveAltValue = `≈ $${
    receiveUsdAmount ? formatUsdValue(receiveUsdAmount) : "0.00"
  }`;
  const isDefaultRecipient = sameAddress(
    recipientAddress,
    defaultRecipientAddress,
  );
  const recipientColor = recipientAddress
    ? isDefaultRecipient
      ? brand
      : "#B7791F"
    : "#848483";
  const getTokenAmountTotal = (tokens: SwapTokenOption[]) =>
    tokens.reduce((sum, item) => sum + Number(item.userAmount || 0), 0);

  const handleSendPercentForToken = (
    index: number,
    pct: number,
    token: SwapTokenOption,
  ) => {
    if (isAmountReadOnly) return;
    if (!token.balance || !onUpdateTokens) return;
    let finalVal = "";
    const isUsdMode = token.userAmountMode === "usd";

    if (isUsdMode) {
      const fiatBalStr = String(token.balanceInFiat || "0");
      const fiatBalance = parseDecimal(fiatBalStr);
      if (!fiatBalance) return;
      if (pct === 100) {
        finalVal = fiatBalance
          .toDecimalPlaces(MAX_AMOUNT_DISPLAY_DECIMALS, Decimal.ROUND_DOWN)
          .toFixed();
      } else {
        finalVal = fiatBalance
          .mul(pct)
          .div(100)
          .toDecimalPlaces(MAX_AMOUNT_DISPLAY_DECIMALS, Decimal.ROUND_DOWN)
          .toFixed();
      }
    } else {
      const balanceStr = String(token.balance || "0");
      const tokenBalance = parseDecimal(balanceStr);
      if (!tokenBalance) return;
      const tokenDecimals = getTokenInputDecimals(token);
      if (pct === 100) {
        finalVal = tokenBalance
          .toDecimalPlaces(tokenDecimals, Decimal.ROUND_DOWN)
          .toFixed();
      } else {
        finalVal = tokenBalance
          .mul(pct)
          .div(100)
          .toDecimalPlaces(tokenDecimals, Decimal.ROUND_DOWN)
          .toFixed();
      }
    }

    const next = [...fromTokens];
    next[index] = {
      ...next[index],
      userAmount: finalVal,
      userAmountMode: isUsdMode ? "usd" : "token",
    };
    onUpdateTokens(next);
    const total = getTokenAmountTotal(next);
    onAmountChange(total > 0 ? String(total) : "", "send");
  };

  const handleSendPercent = (pct: number) => {
    if (isAmountReadOnly) return;
    if (!totalBalance) return;
    const bal = parseFloat(totalBalance.replace(/[^0-9.]/g, ""));
    if (isNaN(bal)) return;
    const val = bal * (pct / 100);
    // If there's only one token, or no tokens, update the main amount
    if (fromTokens.length <= 1) {
      if (fromTokens.length === 1 && onUpdateTokens) {
        handleSendPercentForToken(0, pct, fromTokens[0]);
        return;
      }
      onAmountChange(val.toFixed(6).replace(/\.?0+$/, ""), "send");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "9px",
        width: "100%",
      }}
    >
      {(isReceiveAmountLoading || isReceiveUsdLoading || sourceRouteStatus) && (
        <style>
          {`@keyframes nexusSwapSkeletonShimmer {
            0% { background-position: 100% 0; opacity: 0.72; }
            50% { opacity: 1; }
            100% { background-position: -100% 0; opacity: 0.72; }
          }`}
        </style>
      )}
      {/* ─── SEND PANEL ─── */}
      <div
        className="nexus-focus-container"
        style={{
          alignItems: "center",
          backgroundColor: "#FFFFFE",
          borderColor: "#E8E8E7",
          borderRadius: "9px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#1616150A 0px 1px 2px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          fontVariantNumeric: "tabular-nums",
          gap: "6px",
          justifyContent: "center",
          paddingBlock: "9px",
          paddingInline: "9px",
          width: "100%",
        }}
      >
        {/* Header row: SEND + add asset */}
        <div
          style={{
            alignItems: "center",
            alignSelf: "stretch",
            boxSizing: "border-box",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              boxSizing: "border-box",
              color: "#848483",
              fontFamily: '"Geist", system-ui, sans-serif',
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              lineHeight: "18px",
              textTransform: "uppercase" as const,
            }}
          >
            Send
          </div>
          <button
            disabled={fromTokens.length === 0 || isSourcePickerDisabled}
            onClick={() => onOpenSourcePicker()}
            style={{
              alignItems: "center",
              background: "transparent",
              border: "none",
              borderRadius: "6px",
              display: "flex",
              gap: "4px",
              padding: "2px 0",
              color:
                fromTokens.length > 0 && !isSourcePickerDisabled
                  ? brand
                  : "#A8A8A6",
              cursor:
                fromTokens.length > 0 && !isSourcePickerDisabled
                  ? "pointer"
                  : "not-allowed",
              fontFamily: '"Geist", system-ui, sans-serif',
              fontSize: "12px",
              fontWeight: 500,
              lineHeight: "18px",
              opacity:
                fromTokens.length > 0 && !isSourcePickerDisabled ? 1 : 0.75,
            }}
            type="button"
          >
            <span
              aria-hidden="true"
              style={{
                color: "currentColor",
                fontSize: "14px",
                lineHeight: "14px",
              }}
            >
              +
            </span>
            Add more assets
          </button>
        </div>

        {/* Render each selected source asset, or an empty one if none */}
        <div
          onScroll={updateSourceListScrollState}
          ref={sourceListRef}
          style={{
            alignSelf: "stretch",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "9px",
            maxHeight: hasSourceOverflow ? "178px" : undefined,
            overflowX: hasSourceOverflow ? "hidden" : undefined,
            overflowY: hasSourceOverflow ? "auto" : undefined,
            paddingRight: hasSourceOverflow ? "4px" : undefined,
            overscrollBehavior: hasSourceOverflow ? "contain" : undefined,
            transition:
              "max-height 0.28s ease, padding-right 0.2s ease, opacity 0.2s ease",
            width: "100%",
          }}
        >
          {sourceRowsToRender.map(({ token, index, position }) => {
            const showTooltipBelow = position === 0;
            return (
              <div
                key={
                  token
                    ? `${token.contractAddress}-${token.chainId}-${index}`
                    : "empty"
                }
                ref={(element) => {
                  sourceRowRefs.current[index] = element;
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                  opacity: 1,
                  position: "relative",
                  transform: "translateY(0)",
                  transition: "opacity 0.18s ease, transform 0.18s ease",
                  zIndex: tooltip === `asset-send-${index}` ? 1000 : 1,
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    alignSelf: "stretch",
                    boxSizing: "border-box",
                    display: "flex",
                    gap: "7px",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {showSourceRouteSkeleton ? (
                      <SkeletonBar height="24px" width="46%" />
                    ) : (
                      <>
                        {token?.userAmountMode === "usd" && (
                          <span
                            style={{
                              color: (
                                token
                                  ? Boolean(token.userAmount)
                                  : Boolean(isExactIn && amount)
                              )
                                ? "#161615"
                                : "#9E9E9C",
                              fontFamily:
                                '"Delight-Medium", "Delight", system-ui, sans-serif',
                              fontSize: "29px",
                              fontWeight: 500,
                              lineHeight: "34px",
                              marginRight: "4px",
                            }}
                          >
                            $
                          </span>
                        )}
                        <input
                          aria-readonly={isAmountReadOnly}
                          onBlur={() => {
                            if (token) handleBlurAmount(index);
                            setFocusedRow(null);
                          }}
                          onChange={(e) => {
                            if (token)
                              handleTokenAmountChange(index, e.target.value);
                            else handleSendInput(e);
                          }}
                          onFocus={() => setFocusedRow(index)}
                          placeholder="0"
                          ref={(element) => {
                            sourceInputRefs.current[index] = element;
                          }}
                          style={{
                            boxSizing: "border-box",
                            color: (
                              token
                                ? Boolean(token.userAmount)
                                : Boolean(isExactIn && amount)
                            )
                              ? "#161615"
                              : "#9E9E9C",
                            cursor: isAmountReadOnly ? "default" : "text",
                            fontFamily:
                              '"Delight-Medium", "Delight", system-ui, sans-serif',
                            fontSize: "29px",
                            fontWeight: 500,
                            lineHeight: "34px",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            padding: 0,
                            width: "100%",
                            minWidth: 0,
                          }}
                          readOnly={isAmountReadOnly}
                          type="text"
                          value={
                            token
                              ? focusedRow === index
                                ? token.userAmount || ""
                                : formatAmountInputDisplay(
                                    token.userAmount || "",
                                  )
                              : isExactIn
                                ? focusedRow === index
                                  ? amount
                                  : formatAmountInputDisplay(amount)
                                : ""
                          }
                        />
                      </>
                    )}
                  </div>

                  {/* Asset selector pill + cross button */}
                  <div
                    style={{
                      display: "flex",
                      gap: "7px",
                      alignItems: "center",
                    }}
                  >
                    {showSourceRouteSkeleton ? (
                      <div
                        style={{
                          alignItems: "center",
                          display: "flex",
                          flexShrink: 0,
                          height: "25px",
                          width: "90px",
                        }}
                      >
                        <SkeletonBar
                          borderRadius="999px"
                          height="23px"
                          width="100%"
                        />
                      </div>
                    ) : (
                      <button
                        disabled={isSourcePickerDisabled}
                        onClick={() => onOpenSourcePicker(index)}
                        style={{
                          alignItems: "center",
                          backgroundColor: "#FFFFFE",
                          borderColor: token ? "#E8E8E7" : "#C8C8C7",
                          borderRadius: "999px",
                          borderStyle: token ? "solid" : "dashed",
                          borderWidth: "1px",
                          boxShadow: token ? "#1616150A 0px 1px 2px" : "none",
                          boxSizing: "border-box",
                          display: "flex",
                          gap: "8px",
                          paddingBottom: "5px",
                          paddingLeft: token ? "5px" : "10px",
                          paddingRight: "10px",
                          paddingTop: "5px",
                          cursor: isSourcePickerDisabled
                            ? "not-allowed"
                            : "pointer",
                          flexShrink: 0,
                          opacity: isSourcePickerDisabled ? 0.72 : 1,
                        }}
                      >
                        {token ? (
                          token.isUnified ? (
                            <UnifiedTokenLogoBadge size={26} token={token} />
                          ) : (
                            <div
                              style={{
                                boxSizing: "border-box",
                                flexShrink: 0,
                                height: "26px",
                                position: "relative" as const,
                                width: "26px",
                              }}
                            >
                              <LogoCircle
                                alt={token.symbol}
                                fontSize={13}
                                label={token.symbol}
                                size={26}
                                src={token.logo}
                              />
                              {token.chainLogo && (
                                <LogoCircle
                                  alt={token.chainName}
                                  fontSize={6}
                                  label={token.chainName}
                                  outline="1px solid #FFFFFE"
                                  size={12}
                                  src={token.chainLogo}
                                  style={{
                                    bottom: -2,
                                    position: "absolute",
                                    right: -2,
                                  }}
                                />
                              )}
                            </div>
                          )
                        ) : (
                          <div
                            style={{
                              borderColor: "#C8C8C7",
                              borderRadius: "999px",
                              borderStyle: "dashed",
                              borderWidth: "1.5px",
                              boxSizing: "border-box",
                              flexShrink: 0,
                              height: "26px",
                              width: "26px",
                            }}
                          />
                        )}
                        <div
                          style={{
                            boxSizing: "border-box",
                            color: "#161615",
                            fontFamily: '"Geist", system-ui, sans-serif',
                            fontSize: "16px",
                            fontWeight: 500,
                            lineHeight: "24px",
                          }}
                        >
                          {token ? token.symbol : "Assets"}
                        </div>
                        <ChevronDownIcon />
                      </button>
                    )}
                    {token && fromTokens.length > 1 && (
                      <button
                        onClick={() => {
                          if (!onUpdateTokens) return;
                          const next = [...fromTokens];
                          next.splice(index, 1);
                          onUpdateTokens(next);
                          const total = getTokenAmountTotal(next);
                          onAmountChange(
                            total > 0 ? String(total) : "",
                            "send",
                          );
                        }}
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "999px",
                          backgroundColor: "#F0F0EF",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          fill="none"
                          height="10"
                          stroke="#848483"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          width="10"
                        >
                          <line x1="18" x2="6" y1="6" y2="18"></line>
                          <line x1="6" x2="18" y1="6" y2="18"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* USD value + balance row */}
                <div
                  style={{
                    alignItems: "center",
                    alignSelf: "stretch",
                    boxSizing: "border-box",
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                    minHeight: "24px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-start",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    {showSourceRouteSkeleton ? (
                      <SkeletonBar height="16px" width="84px" />
                    ) : (
                      (() => {
                        if (!token)
                          return (
                            <div
                              style={{
                                boxSizing: "border-box",
                                color: "#848483",
                                fontFamily: '"Geist", system-ui, sans-serif',
                                fontSize: "11px",
                                lineHeight: "16px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              ≈ ${usdValue || "0.00"}
                            </div>
                          );
                        const tokenBalance =
                          Number(
                            String(token.balance).replace(/[^0-9.]/g, ""),
                          ) || 0;
                        const fiatBalance =
                          Number(
                            String(token.balanceInFiat).replace(/[^0-9.]/g, ""),
                          ) || 0;
                        const price =
                          tokenBalance > 0 ? fiatBalance / tokenBalance : 0;
                        const isUsdMode = token.userAmountMode === "usd";
                        const userAmtNum = Number(token.userAmount || 0);
                        const quotedUsd = parseDecimal(token.userAmountUsd);
                        const approxValue = isUsdMode
                          ? price > 0
                            ? (userAmtNum / price).toFixed(6)
                            : "0.000000"
                          : quotedUsd
                            ? quotedUsd.toDecimalPlaces(2).toFixed()
                            : (userAmtNum * price).toFixed(2);
                        const approxPrefix = isUsdMode ? "≈" : "≈ $";
                        const approxSuffix = isUsdMode
                          ? ` ${token.symbol}`
                          : "";

                        return (
                          <div
                            onClick={() => handleToggleMode(index)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              cursor:
                                price > 0 && !isAmountReadOnly
                                  ? "pointer"
                                  : "default",
                            }}
                          >
                            <div
                              style={{
                                boxSizing: "border-box",
                                color: "#848483",
                                fontFamily: '"Geist", system-ui, sans-serif',
                                fontSize: "11px",
                                lineHeight: "16px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {approxPrefix}
                              {approxValue}
                              {approxSuffix}
                            </div>
                            {price > 0 && <ArrowUpDownIcon />}
                          </div>
                        );
                      })()
                    )}
                  </div>

                  <div
                    style={{
                      alignItems: "center",
                      display:
                        token && focusedRow === index && !isAmountReadOnly
                          ? "flex"
                          : "none",
                      justifyContent: "center",
                      pointerEvents:
                        token && focusedRow === index && !isAmountReadOnly
                          ? "auto"
                          : "none",
                    }}
                  >
                    {token && !isAmountReadOnly && (
                      <PercentButtons
                        onSelect={(pct) =>
                          token
                            ? handleSendPercentForToken(index, pct, token)
                            : handleSendPercent(pct)
                        }
                        visible={Boolean(token) && focusedRow === index}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    {showSourceRouteSkeleton || isBalanceLoading ? (
                      <SkeletonBar height="16px" width="124px" />
                    ) : token ? (
                      <div
                        onMouseEnter={(e) => {
                          setTooltip(`asset-send-${index}`);
                          setTooltipTriggerRect(
                            e.currentTarget.getBoundingClientRect(),
                          );
                        }}
                        onMouseLeave={() => {
                          setTooltip(null);
                          setTooltipTriggerRect(null);
                        }}
                        style={{
                          alignItems: "center",
                          boxSizing: "border-box",
                          display: "flex",
                          gap: "4px",
                          position: "relative",
                          cursor: "default",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div
                          style={{
                            boxSizing: "border-box",
                            color: "#848483",
                            fontFamily: '"Geist", system-ui, sans-serif',
                            fontSize: "11px",
                            fontVariantNumeric: "tabular-nums",
                            lineHeight: "16px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Balance ·
                        </div>
                        <div
                          style={{
                            boxSizing: "border-box",
                            color: "#848483",
                            fontFamily: '"Geist", system-ui, sans-serif',
                            fontSize: "11px",
                            fontVariantNumeric: "tabular-nums",
                            lineHeight: "16px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatTokenBalanceLabel(token)}
                        </div>

                        {/* Tooltip */}
                        {tooltip === `asset-send-${index}` &&
                          tooltipTriggerRect &&
                          createPortal(
                            <div
                              style={{
                                position: "fixed",
                                right:
                                  window.innerWidth - tooltipTriggerRect.right,
                                ...(showTooltipBelow
                                  ? { top: tooltipTriggerRect.bottom + 8 }
                                  : {
                                      bottom:
                                        window.innerHeight -
                                        tooltipTriggerRect.top +
                                        8,
                                    }),
                                width: "198px",
                                backgroundColor: "#fff",
                                border: "1px solid #E8E8E7",
                                borderRadius: "12px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                padding: "12px",
                                display: "flex",
                                flexDirection: "column",
                                zIndex: 2147483647,
                                pointerEvents: "none",
                                textAlign: "left",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  color: "#848483",
                                  letterSpacing: "0.06em",
                                  textTransform: "uppercase",
                                  marginBottom: "4px",
                                  fontFamily: '"Geist", system-ui, sans-serif',
                                }}
                              >
                                Asset Balance
                              </div>
                              <div
                                style={{
                                  fontSize: "14px",
                                  color: "#161615",
                                  lineHeight: "18px",
                                  fontFamily: '"Geist", system-ui, sans-serif',
                                }}
                              >
                                This is your current asset balance on this
                                chain.
                              </div>
                            </div>,
                            document.body,
                          )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* PercentButtons moved inline next to balance */}
              </div>
            );
          })}
        </div>

        {hasSourceOverflow && (
          <button
            aria-label={
              isSourceListAtBottom
                ? "Scroll source assets to top"
                : "Scroll source assets"
            }
            onClick={() => {
              const element = sourceListRef.current;
              if (!element) return;
              element.scrollTo({
                behavior: "smooth",
                top: isSourceListAtBottom ? 0 : element.scrollTop + 80,
              });
            }}
            style={{
              alignItems: "center",
              alignSelf: "center",
              background: "transparent",
              border: "none",
              color: "#686866",
              cursor: "pointer",
              display: "flex",
              fontFamily: '"Geist", system-ui, sans-serif',
              fontSize: "13px",
              fontWeight: 500,
              gap: "4px",
              lineHeight: "18px",
              marginTop: "-2px",
              padding: 0,
            }}
            type="button"
          >
            Scroll to view more assets
            <span aria-hidden="true">{isSourceListAtBottom ? "↑" : "↓"}</span>
          </button>
        )}

        {sourceRouteHelper && (
          <div
            style={{
              alignSelf: "stretch",
              color: sourceRouteStatus === "insufficient" ? "#D32F2F" : brand,
              fontFamily: '"Geist", system-ui, sans-serif',
              fontSize: "13px",
              fontWeight: 500,
              lineHeight: "18px",
              marginTop: "-6px",
            }}
          >
            {sourceRouteHelper}
          </div>
        )}

        {/* Total USD */}
        {totalUsd > 0 && (
          <div
            style={{
              display: "flex",
              gap: "7px",
              alignItems: "center",
              paddingTop: "6px",
              alignSelf: "flex-start",
              justifyContent: "flex-start",
            }}
          >
            <span
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "#161615",
                fontFamily: '"Geist", system-ui, sans-serif',
              }}
            >
              ≈ ${totalUsd.toFixed(2)}
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "#848483",
                fontWeight: 600,
                fontFamily: '"Geist", system-ui, sans-serif',
                letterSpacing: "0.05em",
              }}
            >
              TOTAL
            </span>
          </div>
        )}
      </div>

      {/* ─── RECEIVE PANEL ─── */}
      <div
        style={{
          backgroundColor: "#FFFFFE",
          borderColor: "#E8E8E7",
          borderRadius: "9px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#1616150A 0px 1px 2px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          fontVariantNumeric: "tabular-nums",
          gap: "6px",
          paddingBlock: "9px",
          paddingInline: "9px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignSelf: "stretch",
            boxSizing: "border-box",
            color: "#848483",
            fontFamily: '"Geist", system-ui, sans-serif',
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            lineHeight: "18px",
            textTransform: "uppercase" as const,
            width: "100%",
          }}
        >
          Receive
        </div>

        <div
          style={{
            alignSelf: "stretch",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            width: "100%",
          }}
        >
          <div
            style={{
              alignItems: "center",
              alignSelf: "stretch",
              boxSizing: "border-box",
              display: "flex",
              gap: "9px",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            {isReceiveAmountLoading ? (
              <div
                style={{
                  alignItems: "center",
                  boxSizing: "border-box",
                  display: "flex",
                  minHeight: "31px",
                  minWidth: 0,
                  width: "100%",
                }}
              >
                <SkeletonBar height="27px" width="68%" />
              </div>
            ) : (
              <input
                aria-disabled="true"
                disabled
                placeholder="0"
                style={{
                  boxSizing: "border-box",
                  color: receiveAmountTextColor,
                  fontFamily:
                    '"Delight-Medium", "Delight", system-ui, sans-serif',
                  fontSize: "29px",
                  fontWeight: 500,
                  lineHeight: "34px",
                  background: "transparent",
                  border: "none",
                  cursor: "default",
                  outline: "none",
                  opacity: 1,
                  padding: 0,
                  WebkitTextFillColor: receiveAmountTextColor,
                  width: "100%",
                  minWidth: 0,
                }}
                type="text"
                value={receiveDisplayValue}
              />
            )}

            {/* Destination asset pill */}
            <button
              disabled={isDestinationPickerDisabled}
              onClick={onOpenDestPicker}
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFE",
                borderColor: toToken ? "#E8E8E7" : "#C8C8C7",
                borderRadius: "999px",
                borderStyle: toToken ? "solid" : "dashed",
                borderWidth: "1px",
                boxShadow: toToken ? "#1616150A 0px 1px 2px" : "none",
                boxSizing: "border-box",
                display: "flex",
                gap: "8px",
                paddingBottom: "5px",
                paddingLeft: toToken ? "5px" : "10px",
                paddingRight: "10px",
                paddingTop: "5px",
                cursor: isDestinationPickerDisabled ? "default" : "pointer",
                flexShrink: 0,
              }}
            >
              {toToken ? (
                <div
                  style={{
                    boxSizing: "border-box",
                    flexShrink: 0,
                    height: "26px",
                    position: "relative" as const,
                    width: "26px",
                  }}
                >
                  <LogoCircle
                    alt={toToken.symbol}
                    fontSize={13}
                    label={toToken.symbol}
                    size={26}
                    src={toToken.logo}
                  />
                  {toToken.chainLogo && (
                    <LogoCircle
                      alt={toToken.chainName}
                      fontSize={6}
                      label={toToken.chainName}
                      outline="1px solid #FFFFFE"
                      size={12}
                      src={toToken.chainLogo}
                      style={{
                        bottom: -2,
                        position: "absolute",
                        right: -2,
                      }}
                    />
                  )}
                </div>
              ) : (
                <div
                  style={{
                    borderColor: "#C8C8C7",
                    borderRadius: "999px",
                    borderStyle: "dashed",
                    borderWidth: "1.5px",
                    boxSizing: "border-box",
                    flexShrink: 0,
                    height: "26px",
                    width: "26px",
                  }}
                />
              )}
              <div
                style={{
                  boxSizing: "border-box",
                  color: "#161615",
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontSize: "16px",
                  fontWeight: 500,
                  lineHeight: "24px",
                }}
              >
                {toToken ? toToken.symbol : "Assets"}
              </div>
              {!hideDestinationTokenDropdownIcon && <ChevronDownIcon />}
            </button>
          </div>

          {/* USD value + balance row */}
          <div
            style={{
              alignItems: "center",
              alignSelf: "stretch",
              boxSizing: "border-box",
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              minHeight: "22px",
            }}
          >
            {isReceiveUsdLoading ? (
              <SkeletonBar borderRadius="6px" height="16px" width="74px" />
            ) : (
              <div
                style={{
                  boxSizing: "border-box",
                  color: "#848483",
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontSize: "11px",
                  lineHeight: "16px",
                  whiteSpace: "nowrap",
                }}
              >
                {receiveAltValue}
              </div>
            )}
            {toToken && focusedPanel === "receive" && (
              <div
                onMouseEnter={() => setTooltip("asset-receive")}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  alignItems: "center",
                  boxSizing: "border-box",
                  display: "flex",
                  gap: "5px",
                  position: "relative",
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    boxSizing: "border-box",
                    color: "#848483",
                    fontFamily: '"Geist", system-ui, sans-serif',
                    fontSize: "11px",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: "16px",
                    whiteSpace: "nowrap",
                  }}
                >
                  Asset Balance ·
                </div>
                <div
                  style={{
                    boxSizing: "border-box",
                    color: "#848483",
                    fontFamily: '"Geist", system-ui, sans-serif',
                    fontSize: "11px",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: "16px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isBalanceLoading ? (
                    <SkeletonBar height="16px" width="96px" />
                  ) : (
                    receiveBalanceLabel
                  )}
                </div>

                {/* Tooltip */}
                {tooltip === "asset-receive" && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      bottom: "calc(100% + 8px)",
                      width: "198px",
                      backgroundColor: "#fff",
                      border: "1px solid #E8E8E7",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      zIndex: 10000,
                      pointerEvents: "none",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#848483",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        marginBottom: "4px",
                        fontFamily: '"Geist", system-ui, sans-serif',
                      }}
                    >
                      Asset Balance
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#161615",
                        lineHeight: "18px",
                        fontFamily: '"Geist", system-ui, sans-serif',
                      }}
                    >
                      This is your current asset balance on this chain.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recipient section — only shown when handler exists */}
        {onOpenRecipientPicker && (
          <>
            <div
              style={{
                alignSelf: "stretch",
                backgroundColor: "#E8E8E7",
                boxSizing: "border-box",
                flexShrink: 0,
                height: "1px",
                marginTop: "4px",
                width: "100%",
              }}
            />
            <div
              style={{
                alignSelf: "stretch",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                paddingTop: "2px",
                width: "100%",
              }}
            >
              <div
                style={{
                  boxSizing: "border-box",
                  color: "#7C7C7A",
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontSize: "12px",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  lineHeight: "18px",
                  textTransform: "uppercase" as const,
                }}
              >
                Recipient
              </div>
              <div
                style={{
                  alignItems: "center",
                  alignSelf: "stretch",
                  boxSizing: "border-box",
                  display: "flex",
                  gap: "9px",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    boxSizing: "border-box",
                    color: recipientColor,
                    fontFamily: '"Geist", system-ui, sans-serif',
                    fontSize: "14px",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 500,
                    lineHeight: "16px",
                  }}
                >
                  {recipientAddress
                    ? formatShortAddress(recipientAddress)
                    : "Select recipient"}
                </div>
                <button
                  onClick={onOpenRecipientPicker}
                  style={{
                    alignItems: "center",
                    backgroundColor: "#F4F6FF",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                    display: "flex",
                    gap: "4px",
                    paddingBlock: "6px",
                    paddingInline: "9px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      boxSizing: "border-box",
                      color: brand,
                      fontFamily: '"Geist", system-ui, sans-serif',
                      fontSize: "13px",
                      fontWeight: 500,
                      lineHeight: "13px",
                    }}
                  >
                    Edit
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
