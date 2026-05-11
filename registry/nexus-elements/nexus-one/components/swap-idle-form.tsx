import React, { useState, useEffect } from "react";
import Decimal from "decimal.js";
import { type SwapTokenOption } from "./swap-asset-selector";

interface SwapIdleFormProps {
  amount: string;
  receiveQuoteAmount?: string;
  receiveQuoteUsd?: string;
  isReceiveAmountLoading?: boolean;
  isReceiveUsdLoading?: boolean;
  onAmountChange: (val: string, panel: "send" | "receive") => void;
  onReceivePercentSelect?: (pct: number) => void;
  fromTokens: SwapTokenOption[];
  toToken?: SwapTokenOption;
  totalBalance: string;
  usdValue: string;
  onOpenSourcePicker: (index?: number) => void;
  onOpenDestPicker: () => void;
  onOpenRecipientPicker?: () => void;
  recipientAddress?: string;
  defaultRecipientAddress?: string;
  swapType: "exactIn" | "exactOut";
  onUpdateTokens?: (tokens: SwapTokenOption[]) => void;
}

/** Chevron down icon used in asset selector pills */
const ChevronDownIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: "12px", height: "12px", flexShrink: 0 }}
  >
    <path
      d="M2 3.5L5 6.5L8 3.5"
      stroke="#848483"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const PlusIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <path
      d="M6 2V10M2 6H10"
      stroke="#006BF4"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const ArrowUpDownIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <path
      d="M7 15L7 3M7 3L11 7M7 3L3 7M17 9L17 21M17 21L13 17M17 21L21 17"
      stroke="#848483"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

/** Reusable percentage quick-select buttons row with transition wrapper */
function PercentButtons({
  visible,
  onSelect,
  maxLabel = "MAX",
}: {
  visible: boolean;
  onSelect: (pct: number) => void;
  maxLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Trigger the animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShow(true));
      });
    } else {
      setShow(false);
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      style={{
        alignItems: "center",
        boxSizing: "border-box",
        display: "flex",
        gap: "6px",
        width: "100%",
        overflow: "hidden",
        maxHeight: show ? "40px" : "0px",
        opacity: show ? 1 : 0,
        marginTop: show ? "0px" : "-4px",
        transition:
          "max-height 0.2s ease-out, opacity 0.2s ease-out, margin-top 0.15s ease-out",
      }}
    >
      {[25, 50, 75, 100].map((pct) => {
        const label = pct === 100 ? maxLabel : `${pct}%`;
        return (
          <PercentHoverButton
            key={pct}
            label={label}
            onClick={() => onSelect(pct)}
          />
        );
      })}
    </div>
  );
}

function PercentHoverButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  const isHighlighted = hover || active;

  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onClick={onClick}
      style={{
        alignItems: "center",
        backgroundColor: isHighlighted ? "#E8F0FF" : "#F4F4F3",
        borderRadius: "8px",
        boxSizing: "border-box",
        display: "flex",
        flex: "1 1 0%",
        justifyContent: "center",
        paddingBlock: "5px",
        paddingInline: "10px",
        border: "none",
        cursor: "pointer",
        transition: "background-color 0.2s ease-out",
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          color: isHighlighted ? "#006BF4" : "#363635",
          fontFamily: '"Geist", system-ui, sans-serif',
          fontSize: "12px",
          fontWeight: 500,
          lineHeight: "20px",
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
        color: "#006BF4",
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

function SourceLogoHint({
  rows,
  extraCount,
}: {
  rows: Array<{ token: SwapTokenOption; index: number }>;
  extraCount: number;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      {rows.slice(0, 3).map(({ token, index }, hintIndex) => (
        <div
          key={`${token.contractAddress}-${token.chainId}-${index}`}
          style={{
            height: "20px",
            marginLeft: hintIndex === 0 ? 0 : "-6px",
            position: "relative",
            width: "20px",
          }}
        >
          <LogoCircle
            src={token.logo}
            alt={token.symbol}
            label={token.symbol}
            size={20}
            fontSize={10}
            outline="1px solid #FFFFFE"
          />
        </div>
      ))}
      {extraCount > 0 && (
        <div
          style={{
            alignItems: "center",
            backgroundColor: "#E8E8E7",
            border: "1px solid #FFFFFE",
            borderRadius: "999px",
            color: "#5F5F5E",
            display: "flex",
            fontFamily: '"Geist", system-ui, sans-serif',
            fontSize: "10px",
            fontWeight: 600,
            height: "20px",
            justifyContent: "center",
            lineHeight: "14px",
            marginLeft: rows.length > 0 ? "-6px" : 0,
            minWidth: "20px",
            paddingInline: "4px",
          }}
        >
          +{extraCount}
        </div>
      )}
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

const formatTokenBalanceLabel = (token?: SwapTokenOption) => {
  if (!token) return "";
  const rawBalance = String(token.balance || "0").trim() || "0";
  const symbol = token.symbol || "";
  const numeric = rawBalance.replace(/[^0-9.-]/g, "");

  if (!numeric || numeric === "-" || numeric === "." || numeric === "-.") {
    return symbol && !rawBalance.toLowerCase().includes(symbol.toLowerCase())
      ? `${rawBalance} ${symbol}`
      : rawBalance;
  }

  try {
    const balance = new Decimal(numeric);
    const displayDecimals = 8;
    const minDisplay = new Decimal(1).div(new Decimal(10).pow(displayDecimals));
    const formatted =
      balance.gt(0) && balance.lt(minDisplay)
        ? `>${minDisplay.toFixed(displayDecimals)}`
        : balance
            .toDecimalPlaces(displayDecimals, Decimal.ROUND_DOWN)
            .toFixed()
            .replace(/(\.\d*?)0+$/, "$1")
            .replace(/\.$/, "");

    return symbol ? `${formatted} ${symbol}` : formatted;
  } catch {
    return symbol && !rawBalance.toLowerCase().includes(symbol.toLowerCase())
      ? `${rawBalance} ${symbol}`
      : rawBalance;
  }
};

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

/** Add asset button with smooth transition */
function AddAssetButton({
  visible,
  label,
  onClick,
}: {
  visible: boolean;
  label: string;
  onClick: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShow(true));
      });
    } else {
      setShow(false);
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      style={{
        overflow: "hidden",
        maxHeight: show ? "50px" : "0px",
        opacity: show ? 1 : 0,
        transition: "max-height 0.2s ease-out, opacity 0.2s ease-out",
        width: "100%",
      }}
    >
      <button
        onClick={onClick}
        style={{
          alignItems: "center",
          alignSelf: "stretch",
          backgroundColor: "#F4F7FE",
          borderRadius: "8px",
          boxSizing: "border-box",
          display: "flex",
          gap: "6px",
          justifyContent: "center",
          paddingBlock: "9px",
          paddingInline: "9px",
          border: "none",
          cursor: "pointer",
          width: "100%",
        }}
      >
        <PlusIcon />
        <div
          style={{
            boxSizing: "border-box",
            color: "#006BF4",
            fontFamily: '"Geist", system-ui, sans-serif',
            fontSize: "12px",
            fontWeight: 500,
            lineHeight: "20px",
          }}
        >
          {label}
        </div>
      </button>
    </div>
  );
}

export function SwapIdleForm({
  amount,
  receiveQuoteAmount,
  receiveQuoteUsd,
  isReceiveAmountLoading = false,
  isReceiveUsdLoading = false,
  onAmountChange,
  onReceivePercentSelect,
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
}: SwapIdleFormProps) {
  const [hoveredPanel, setHoveredPanel] = useState<"send" | "receive" | null>(
    null,
  );
  const [focusedPanel, setFocusedPanel] = useState<"send" | "receive" | null>(
    null,
  );
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [showAllSourceAssets, setShowAllSourceAssets] = useState(false);

  useEffect(() => {
    if (fromTokens.length <= 2) {
      setShowAllSourceAssets(false);
    }
  }, [fromTokens.length]);

  const sanitizeInput = (raw: string): string => {
    let next = raw.replaceAll(/[^0-9.]/g, "");
    const parts = next.split(".");
    if (parts.length > 2) next = parts[0] + "." + parts.slice(1).join("");
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
    onAmountChange(sanitizeInput(e.target.value), "send");
  };

  const handleReceiveInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onAmountChange(sanitizeInput(e.target.value), "receive");
  };

  const handleTokenAmountChange = (index: number, val: string) => {
    if (!onUpdateTokens) return;
    const token = fromTokens[index];
    if (!token) return;

    let sanitized = sanitizeInput(val);

    // Enforce max amount validation
    const tokenBalance =
      Number(String(token.balance).replace(/[^0-9.]/g, "")) || 0;
    const fiatBalance =
      Number(String(token.balanceInFiat).replace(/[^0-9.]/g, "")) || 0;
    const isUsdMode = token.userAmountMode === "usd";

    const maxAmt = isUsdMode ? fiatBalance : tokenBalance;
    if (Number(sanitized) > maxAmt) {
      if (isUsdMode) {
        sanitized = maxAmt.toFixed(2);
      } else {
        sanitized = String(token.balance).replace(/[^0-9.]/g, "");
      }
    }

    const next = [...fromTokens];
    next[index] = { ...token, userAmount: sanitized };
    onUpdateTokens(next);

    // Also update total amount for backwards compatibility if needed
    const total = next.reduce((sum, t) => sum + Number(t.userAmount || 0), 0);
    onAmountChange(total > 0 ? String(total) : "", "send");
  };

  const handleToggleMode = (index: number) => {
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

  const sortedSourceRows = React.useMemo(
    () =>
      fromTokens
        .map((token, index) => ({
          token,
          index,
          usdValue: getSourceUsdValue(token),
        }))
        .sort((a, b) => b.usdValue - a.usdValue || a.index - b.index),
    [fromTokens, getSourceUsdValue],
  );
  const hasSourceOverflow = sortedSourceRows.length > 2;
  const visibleSourceRows =
    hasSourceOverflow && !showAllSourceAssets
      ? sortedSourceRows.slice(0, 2)
      : sortedSourceRows;
  const overflowHintRows = sortedSourceRows.slice(2, 5);
  const overflowHintExtraCount = Math.max(sortedSourceRows.length - 5, 0);
  const sourceRowsToRender: Array<{
    token: SwapTokenOption | null;
    index: number;
    position: number;
  }> =
    fromTokens.length > 0
      ? (hasSourceOverflow ? sortedSourceRows : visibleSourceRows).map(
          ({ token, index }, position) => ({ token, index, position }),
        )
      : [{ token: null, index: 0, position: 0 }];

  const isExactIn = swapType === "exactIn";
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
  const receiveInputValue = isExactIn ? receiveQuoteAmount ?? "" : amount;
  const receiveUsdRate = getReceiveUsdRate();
  const receiveTokenAmount = parseDecimal(receiveInputValue);
  const receiveUsdAmount =
    receiveQuoteUsd
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
      ? "#006BF4"
      : "#B7791F"
    : "#848483";
  const getTokenAmountTotal = (tokens: SwapTokenOption[]) =>
    tokens.reduce((sum, item) => sum + Number(item.userAmount || 0), 0);

  const handleSendPercentForToken = (
    index: number,
    pct: number,
    token: SwapTokenOption,
  ) => {
    if (!token.balance || !onUpdateTokens) return;
    let finalVal = "";
    const isUsdMode = token.userAmountMode === "usd";

    if (isUsdMode) {
      const fiatBalStr = String(token.balanceInFiat || "0");
      if (pct === 100) {
        finalVal = fiatBalStr.replace(/[^0-9.]/g, "");
      } else {
        const bal = parseFloat(fiatBalStr.replace(/[^0-9.]/g, ""));
        if (isNaN(bal)) return;
        const val = bal * (pct / 100);
        finalVal = val.toFixed(2);
      }
    } else {
      const balanceStr = String(token.balance || "0");
      if (pct === 100) {
        finalVal = balanceStr.replace(/[^0-9.]/g, "");
      } else {
        const bal = parseFloat(balanceStr.replace(/[^0-9.]/g, ""));
        if (isNaN(bal)) return;
        const val = bal * (pct / 100);
        finalVal = val.toFixed(18).replace(/\.?0+$/, "");
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
        gap: "16px",
        width: "100%",
      }}
    >
      {(isReceiveAmountLoading || isReceiveUsdLoading) && (
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
        onMouseEnter={() => setHoveredPanel("send")}
        onMouseLeave={() => setHoveredPanel(null)}
        onFocusCapture={() => setFocusedPanel("send")}
        onBlurCapture={() => setFocusedPanel(null)}
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
          fontVariantNumeric: "tabular-nums",
          gap: "12px",
          justifyContent: "center",
          paddingBlock: "16px",
          paddingInline: "16px",
          width: "100%",
        }}
      >
        {/* Header row: SEND + Total Balance */}
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
              lineHeight: "20px",
              textTransform: "uppercase" as const,
            }}
          >
            Send
          </div>
          <div
            onMouseEnter={() => setTooltip("total")}
            onMouseLeave={() => setTooltip(null)}
            style={{
              alignItems: "center",
              boxSizing: "border-box",
              display: "flex",
              gap: "4px",
              position: "relative",
              cursor: "default",
            }}
          >
            <div
              style={{
                boxSizing: "border-box",
                color: "#848483",
                fontFamily: '"Geist", system-ui, sans-serif',
                fontSize: "14px",
                lineHeight: "20px",
              }}
            >
              Total Balance:
            </div>
            <div
              style={{
                boxSizing: "border-box",
                color: "#848483",
                fontFamily: '"Geist", system-ui, sans-serif',
                fontSize: "14px",
                lineHeight: "20px",
              }}
            >
              ${totalBalance}
            </div>
            
            {/* Tooltip */}
            {tooltip === "total" && (
              <div style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 12px)",
                width: "220px",
                backgroundColor: "#fff",
                border: "1px solid #E8E8E7",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                zIndex: 10000,
                pointerEvents: "none",
                textAlign: "left"
              }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#848483", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px", fontFamily: '"Geist", system-ui, sans-serif' }}>
                  Total Spendable Balance
                </div>
                <div style={{ fontSize: "13px", color: "#161615", lineHeight: "18px", fontFamily: '"Geist", system-ui, sans-serif' }}>
                  This is the total spendable balance from all chains.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Render each selected source asset, or an empty one if none */}
        <div
          style={{
            alignSelf: "stretch",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxHeight: hasSourceOverflow
              ? showAllSourceAssets
                ? "204px"
                : "160px"
              : undefined,
            overflowX: hasSourceOverflow ? "hidden" : undefined,
            overflowY: hasSourceOverflow
              ? showAllSourceAssets
                ? "auto"
                : "hidden"
              : undefined,
            paddingRight:
              hasSourceOverflow && showAllSourceAssets ? "4px" : undefined,
            overscrollBehavior:
              hasSourceOverflow && showAllSourceAssets ? "contain" : undefined,
            transition:
              "max-height 0.28s ease, padding-right 0.2s ease, opacity 0.2s ease",
            width: "100%",
          }}
        >
          {sourceRowsToRender.map(({ token, index, position }) => {
            const isSourceRowClipped =
              hasSourceOverflow && !showAllSourceAssets && position >= 2;
            const showTooltipBelow = position === 0;
            return (
              <div
                key={
                  token
                    ? `${token.contractAddress}-${token.chainId}-${index}`
                    : "empty"
                }
                aria-hidden={isSourceRowClipped ? true : undefined}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  opacity: isSourceRowClipped ? 0 : 1,
                  pointerEvents: isSourceRowClipped ? "none" : undefined,
                  position: "relative",
                  transform: isSourceRowClipped
                    ? "translateY(-4px)"
                    : "translateY(0)",
                  transition:
                    "opacity 0.18s ease, transform 0.18s ease",
                  zIndex:
                    tooltip === `asset-send-${index}`
                      ? 1000
                      : isSourceRowClipped
                        ? 0
                        : 1,
                }}
                onMouseEnter={() => setHoveredRow(index)}
                onMouseLeave={() => setHoveredRow(null)}
                onFocusCapture={() => setFocusedRow(index)}
                onBlurCapture={() => setFocusedRow(null)}
              >
                <div
                  style={{
                    alignItems: "center",
                    alignSelf: "stretch",
                    boxSizing: "border-box",
                    display: "flex",
                    gap: "10px",
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
                    {token?.userAmountMode === "usd" && (
                      <span
                        style={{
                          color:
                            (token
                              ? Boolean(token.userAmount)
                              : Boolean(isExactIn && amount))
                              ? "#161615"
                              : "#9E9E9C",
                          fontFamily:
                            '"Delight-Medium", "Delight", system-ui, sans-serif',
                          fontSize: "36px",
                          fontWeight: 500,
                          lineHeight: "44px",
                          marginRight: "4px",
                        }}
                      >
                        $
                      </span>
                    )}
                    <input
                      type="text"
                      placeholder="0"
                      tabIndex={isSourceRowClipped ? -1 : undefined}
                      value={
                        token
                          ? token.userAmount || ""
                          : isExactIn
                            ? amount
                            : ""
                      }
                      onChange={(e) => {
                        if (token)
                          handleTokenAmountChange(index, e.target.value);
                        else handleSendInput(e);
                      }}
                      onBlur={(e) => {
                        if (token) handleBlurAmount(index);
                      }}
                      style={{
                        boxSizing: "border-box",
                        color:
                          (token
                            ? Boolean(token.userAmount)
                            : Boolean(isExactIn && amount))
                            ? "#161615"
                            : "#9E9E9C",
                        fontFamily:
                          '"Delight-Medium", "Delight", system-ui, sans-serif',
                        fontSize: "36px",
                        fontWeight: 500,
                        lineHeight: "44px",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        padding: 0,
                        width: "100%",
                        minWidth: 0,
                      }}
                    />
                  </div>

                  {/* Asset selector pill + cross button */}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <button
                      onClick={() => onOpenSourcePicker(index)}
                      tabIndex={isSourceRowClipped ? -1 : undefined}
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
                        paddingLeft: token ? "4px" : "8px",
                        paddingRight: "10px",
                        paddingTop: "5px",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {token ? (
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
                            src={token.logo}
                            alt={token.symbol}
                            label={token.symbol}
                            size={26}
                            fontSize={13}
                          />
                          {token.chainLogo && (
                            <LogoCircle
                              src={token.chainLogo}
                              alt={token.chainName}
                              label={token.chainName}
                              size={12}
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
                      ) : (
                        <div
                          style={{
                            borderColor: "#C8C8C7",
                            borderRadius: "999px",
                            borderStyle: "dashed",
                            borderWidth: "1.5px",
                            boxSizing: "border-box",
                            flexShrink: 0,
                            height: "22px",
                            width: "22px",
                          }}
                        />
                      )}
                      <div
                        style={{
                          boxSizing: "border-box",
                          color: "#161615",
                          fontFamily: '"Geist", system-ui, sans-serif',
                          fontSize: token ? "14px" : "16px",
                          fontWeight: 500,
                          lineHeight: token ? "18px" : "24px",
                        }}
                      >
                        {token ? token.symbol : "Assets"}
                      </div>
                      <ChevronDownIcon />
                    </button>
                    {token && (
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
                        tabIndex={isSourceRowClipped ? -1 : undefined}
                        style={{
                          width: "24px",
                          height: "24px",
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
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#848483"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
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
                  }}
                >
                  {(() => {
                    if (!token)
                      return (
                        <div
                          style={{
                            boxSizing: "border-box",
                            color: "#848483",
                            fontFamily: '"Geist", system-ui, sans-serif',
                            fontSize: "14px",
                            lineHeight: "20px",
                          }}
                        >
                          ≈ ${usdValue || "0.00"}
                        </div>
                      );
                    const tokenBalance =
                      Number(String(token.balance).replace(/[^0-9.]/g, "")) ||
                      0;
                    const fiatBalance =
                      Number(
                        String(token.balanceInFiat).replace(/[^0-9.]/g, ""),
                      ) || 0;
                    const price =
                      tokenBalance > 0 ? fiatBalance / tokenBalance : 0;
                    const isUsdMode = token.userAmountMode === "usd";
                    const userAmtNum = Number(token.userAmount || 0);
                    const approxValue = isUsdMode
                      ? price > 0
                        ? (userAmtNum / price).toFixed(6)
                        : "0.000000"
                      : (userAmtNum * price).toFixed(2);
                    const approxPrefix = isUsdMode ? "≈" : "≈ $";
                    const approxSuffix = isUsdMode ? ` ${token.symbol}` : "";

                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: price > 0 ? "pointer" : "default",
                        }}
                        onClick={() => handleToggleMode(index)}
                      >
                        <div
                          style={{
                            boxSizing: "border-box",
                            color: "#848483",
                            fontFamily: '"Geist", system-ui, sans-serif',
                            fontSize: "14px",
                            lineHeight: "20px",
                          }}
                        >
                          {approxPrefix}
                          {approxValue}
                          {approxSuffix}
                        </div>
                        {price > 0 && <ArrowUpDownIcon />}
                      </div>
                    );
                  })()}
                  {token && (
                    <div
                      onMouseEnter={() => setTooltip(`asset-send-${index}`)}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        alignItems: "center",
                        boxSizing: "border-box",
                        display: "flex",
                        gap: "5px",
                        position: "relative",
                        cursor: "default"
                      }}
                    >
                      <div
                        style={{
                          boxSizing: "border-box",
                          color: "#848483",
                          fontFamily: '"Geist", system-ui, sans-serif',
                          fontSize: "14px",
                          fontVariantNumeric: "tabular-nums",
                          lineHeight: "20px",
                        }}
                      >
                        Balance:
                      </div>
                      <div
                        style={{
                          boxSizing: "border-box",
                          color: "#848483",
                          fontFamily: '"Geist", system-ui, sans-serif',
                          fontSize: "14px",
                          fontVariantNumeric: "tabular-nums",
                          lineHeight: "20px",
                        }}
                      >
                        {formatTokenBalanceLabel(token)}
                      </div>
                      
                      {/* Tooltip */}
                      {tooltip === `asset-send-${index}` && (
                        <div style={{
                          position: "absolute",
                          right: 0,
                          ...(showTooltipBelow
                            ? { top: "calc(100% + 8px)" }
                            : { bottom: "calc(100% + 8px)" }),
                          width: "220px",
                          backgroundColor: "#fff",
                          border: "1px solid #E8E8E7",
                          borderRadius: "12px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          zIndex: 10000,
                          pointerEvents: "none",
                          textAlign: "left"
                        }}>
                          <div style={{ fontSize: "11px", fontWeight: 600, color: "#848483", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px", fontFamily: '"Geist", system-ui, sans-serif' }}>
                            Asset Balance
                          </div>
                          <div style={{ fontSize: "13px", color: "#161615", lineHeight: "18px", fontFamily: '"Geist", system-ui, sans-serif' }}>
                            This is your current asset balance on this chain.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 25% 50% 75% MAX — hover transition */}
                <PercentButtons
                  visible={
                    Boolean(token) &&
                    (hoveredRow === index || focusedRow === index)
                  }
                  onSelect={(pct) =>
                    token
                      ? handleSendPercentForToken(index, pct, token)
                      : handleSendPercent(pct)
                  }
                />
              </div>
            );
          })}
        </div>

        {hasSourceOverflow && (
          <button
            type="button"
            onClick={() => setShowAllSourceAssets((current) => !current)}
            style={{
              alignItems: "center",
              alignSelf: "stretch",
              backgroundColor: "#F4F4F3",
              border: "none",
              borderRadius: "8px",
              boxSizing: "border-box",
              cursor: "pointer",
              display: "flex",
              gap: "8px",
              justifyContent: "space-between",
              minHeight: "30px",
              paddingBlock: "5px",
              paddingInline: "10px",
              width: "100%",
            }}
          >
            <span
              style={{
                alignItems: "center",
                color: "#363635",
                display: "flex",
                fontFamily: '"Geist", system-ui, sans-serif',
                fontSize: "10px",
                fontWeight: 600,
                gap: "20px",
                letterSpacing: "0.06em",
                lineHeight: "16px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              <span>
                {showAllSourceAssets ? "View less assets" : "View more assets"}
              </span>
              {!showAllSourceAssets && (
                <SourceLogoHint
                  rows={overflowHintRows.map(({ token, index }) => ({
                    token,
                    index,
                  }))}
                  extraCount={overflowHintExtraCount}
                />
              )}
            </span>
            <span
              style={{
                display: "flex",
                transform: showAllSourceAssets
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
                transition: "transform 0.18s ease-out",
              }}
            >
              <ChevronDownIcon />
            </span>
          </button>
        )}

        {/* Add asset button — only after first source selected */}
        <AddAssetButton
          visible={fromTokens.length > 0}
          label="Add asset"
          onClick={() => onOpenSourcePicker()}
        />

        {/* Total USD */}
        {totalUsd > 0 && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              paddingTop: "8px",
              alignSelf: "flex-start",
              justifyContent: "flex-start",
            }}
          >
            <span
              style={{
                fontSize: "18px",
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
        onMouseEnter={() => setHoveredPanel("receive")}
        onMouseLeave={() => setHoveredPanel(null)}
        onFocusCapture={() => setFocusedPanel("receive")}
        onBlurCapture={() => setFocusedPanel(null)}
        style={{
          backgroundColor: "#FFFFFE",
          borderColor: "#E8E8E7",
          borderRadius: "12px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#1616150A 0px 1px 2px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          fontVariantNumeric: "tabular-nums",
          gap: "12px",
          paddingBlock: "20px",
          paddingInline: "16px",
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
            lineHeight: "20px",
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
              gap: "10px",
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
                  minHeight: "44px",
                  minWidth: 0,
                  width: "100%",
                }}
              >
                <SkeletonBar width="68%" height="36px" />
              </div>
            ) : (
              <input
                type="text"
                placeholder="0"
                value={receiveInputValue}
                onChange={handleReceiveInput}
                style={{
                  boxSizing: "border-box",
                  color:
                    (!isExactIn && amount) || (isExactIn && receiveQuoteAmount)
                      ? "#161615"
                      : "#9E9E9C",
                  fontFamily:
                    '"Delight-Medium", "Delight", system-ui, sans-serif',
                  fontSize: "36px",
                  fontWeight: 500,
                  lineHeight: "44px",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: 0,
                  width: "100%",
                  minWidth: 0,
                }}
              />
            )}

            {/* Destination asset pill */}
            <button
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
                paddingLeft: toToken ? "5px" : "8px",
                paddingRight: "10px",
                paddingTop: "5px",
                cursor: "pointer",
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
                    src={toToken.logo}
                    alt={toToken.symbol}
                    label={toToken.symbol}
                    size={26}
                    fontSize={13}
                  />
                  {toToken.chainLogo && (
                    <LogoCircle
                      src={toToken.chainLogo}
                      alt={toToken.chainName}
                      label={toToken.chainName}
                      size={12}
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
              ) : (
                <div
                  style={{
                    borderColor: "#C8C8C7",
                    borderRadius: "999px",
                    borderStyle: "dashed",
                    borderWidth: "1.5px",
                    boxSizing: "border-box",
                    flexShrink: 0,
                    height: "22px",
                    width: "22px",
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
              <ChevronDownIcon />
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
            }}
          >
            {isReceiveUsdLoading ? (
              <SkeletonBar width="74px" height="18px" borderRadius="6px" />
            ) : (
              <div
                style={{
                  boxSizing: "border-box",
                  color: "#848483",
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontSize: "14px",
                  lineHeight: "20px",
                }}
              >
                {receiveAltValue}
              </div>
            )}
            {toToken && (
              <div
                onMouseEnter={() => setTooltip("asset-receive")}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  alignItems: "center",
                  boxSizing: "border-box",
                  display: "flex",
                  gap: "5px",
                  position: "relative",
                  cursor: "default"
                }}
              >
                <div
                  style={{
                    boxSizing: "border-box",
                    color: "#848483",
                    fontFamily: '"Geist", system-ui, sans-serif',
                    fontSize: "14px",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: "20px",
                  }}
                >
                  Balance:
                </div>
                <div
                  style={{
                    boxSizing: "border-box",
                    color: "#848483",
                    fontFamily: '"Geist", system-ui, sans-serif',
                    fontSize: "14px",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: "20px",
                  }}
                >
                  {receiveBalanceLabel}
                </div>
                
                {/* Tooltip */}
                {tooltip === "asset-receive" && (
                  <div style={{
                    position: "absolute",
                    right: 0,
                    bottom: "calc(100% + 8px)",
                    width: "220px",
                    backgroundColor: "#fff",
                    border: "1px solid #E8E8E7",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    zIndex: 10000,
                    pointerEvents: "none",
                    textAlign: "left"
                  }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#848483", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px", fontFamily: '"Geist", system-ui, sans-serif' }}>
                      Asset Balance
                    </div>
                    <div style={{ fontSize: "13px", color: "#161615", lineHeight: "18px", fontFamily: '"Geist", system-ui, sans-serif' }}>
                      This is your current asset balance on this chain.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 25% 50% 75% MAX — backed by calculateMaxForSwap when available */}
          {onReceivePercentSelect && (
            <PercentButtons
              visible={hoveredPanel === "receive" || focusedPanel === "receive"}
              onSelect={onReceivePercentSelect}
            />
          )}
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
                gap: "6px",
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
                  lineHeight: "20px",
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
                  gap: "10px",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    boxSizing: "border-box",
                    color: recipientColor,
                    fontFamily: '"Geist", system-ui, sans-serif',
                    fontSize: "16px",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 500,
                    lineHeight: "18px",
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
                    paddingBlock: "8px",
                    paddingInline: "12px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      boxSizing: "border-box",
                      color: "#006BF4",
                      fontFamily: '"Geist", system-ui, sans-serif',
                      fontSize: "12px",
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
