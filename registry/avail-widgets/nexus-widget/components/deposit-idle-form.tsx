// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import Decimal from "decimal.js";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { parseAmount as parseDecimal } from "../utils/amount";
import type { SwapTokenOption } from "./swap-asset-selector";

interface DepositIdleFormProps {
  amount: string;
  amountMode: "token" | "usd";
  calculatingPercent?: number | null;
  fromTokens: SwapTokenOption[];
  isAmountReadOnly?: boolean;
  isBalanceLoading?: boolean;
  isCalculatingMax?: boolean;
  isPredictive?: boolean;
  isQuoteRefreshing?: boolean;
  isSourcePickerDisabled?: boolean;
  isTokenPickerDisabled?: boolean;
  hideDestinationTokenDropdownIcon?: boolean;
  onAmountChange: (val: string) => void;
  onAmountModeToggle: () => void;
  onOpenSourcePicker: () => void;
  onOpenTokenPicker?: () => void;
  onSetPercent: (pct: number) => void;
  onUpdateTokens?: (tokens: SwapTokenOption[]) => void;
  availableTokens?: SwapTokenOption[];
  onSelectAvailableToken?: (token: SwapTokenOption) => void;
  onBack?: () => void;
  slideFromLeft?: boolean;
  onOpenHistory?: () => void;
  onClose?: () => void;
  quoteLabel?: string;
  quoteProgress?: number;
  reserveSourceRows?: boolean;
  routeMessage?: string;
  routeStatus?: "loading" | "insufficient" | "error";
  showAutoBadge?: boolean;
  tokenValue: string;
  toToken?: SwapTokenOption;
  totalBalance: string;
  usdValue: string;
  receiveAmount?: string;
  minReceiveAmount?: string;
  receiveUsd?: string;
  feeUsd?: string;
  feeDetails?: Record<string, unknown> | null;
  destinationLabel?: string;
  walletLabel?: string;
  maxSourceTokens?: number;
}

const uiFont = '"Geist", system-ui, sans-serif';
const displayFont = '"Delight", "Geist", system-ui, sans-serif';
const easeOut = "cubic-bezier(.23,1,.32,1)";
const easeMove = "cubic-bezier(.2,0,0,1)";

const isNativeAddress = (address?: string) => {
  const value = address?.toLowerCase();
  return (
    value === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
    value === "0x0000000000000000000000000000000000000000"
  );
};

const readDecimal = (value: unknown) => parseDecimal(value) ?? new Decimal(0);

const tokenUnitAmount = (token: SwapTokenOption) => {
  const entered = readDecimal(token.userAmount);
  if (token.userAmountMode !== "usd") return entered;
  const balance = readDecimal(token.balance);
  const fiat = readDecimal(token.balanceInFiat);
  const price = balance.gt(0) ? fiat.div(balance) : new Decimal(0);
  return price.gt(0) ? entered.div(price) : new Decimal(0);
};

const gasBuffer = (token: SwapTokenOption) => {
  if (!isNativeAddress(token.contractAddress)) return new Decimal(0);
  const balance = readDecimal(token.balance);
  return Decimal.max(balance.mul("0.02"), new Decimal("0.00002"));
};

const rowError = (token: SwapTokenOption) => {
  const amount = tokenUnitAmount(token);
  if (amount.lte(0)) return null;
  const balance = readDecimal(token.balance);
  if (amount.gt(balance)) {
    return `Not enough ${token.symbol} on ${token.chainName || "this chain"}. Lower the amount or tap MAX.`;
  }
  const buffer = gasBuffer(token);
  if (buffer.gt(0) && amount.gt(balance.minus(buffer))) {
    return `Leave ~${buffer.toSignificantDigits(2).toFixed()} ${token.symbol} for gas. Lower the amount slightly.`;
  }
  return null;
};

const formatUsd = (value: Decimal) => {
  if (value.gt(0) && value.lt(0.01)) return "<$0.01";
  return `$${value.toDecimalPlaces(2).toFixed()}`;
};

const formatTokenAmount = (value: Decimal, decimals = 6) =>
  value.toDecimalPlaces(Math.min(8, decimals), Decimal.ROUND_DOWN).toFixed();

const tokenUsd = (token: SwapTokenOption, units: Decimal) => {
  const balance = readDecimal(token.balance);
  const fiat = readDecimal(token.balanceInFiat);
  const price = balance.gt(0) ? fiat.div(balance) : new Decimal(0);
  return units.mul(price);
};

function TokenLogo({
  src,
  label,
  size = 40,
}: {
  src?: string;
  label?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(!src);
  React.useEffect(() => setFailed(!src), [src]);
  if (!failed && src) {
    return (
      <img
        alt={label || ""}
        onError={() => setFailed(true)}
        src={src}
        style={{
          borderRadius: "999px",
          display: "block",
          height: size,
          objectFit: "cover",
          width: size,
        }}
      />
    );
  }
  return (
    <span
      style={{
        alignItems: "center",
        background: "var(--nx-blue-soft, #E5F0FE)",
        borderRadius: "999px",
        color: "var(--nx-blue, #006BF4)",
        display: "flex",
        fontFamily: uiFont,
        fontSize: size > 24 ? 14 : 10,
        fontWeight: 700,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      {(label || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function LogoPair({ token, size = 40 }: { token: SwapTokenOption; size?: number }) {
  const badge = Math.round(size * 0.42);
  return (
    <span style={{ height: size, position: "relative", width: size, flexShrink: 0 }}>
      <TokenLogo label={token.symbol} size={size} src={token.logo} />
      {token.chainLogo ? (
        <img
          alt=""
          src={token.chainLogo}
          style={{
            borderRadius: "999px",
            height: badge,
            left: size - badge + 2,
            outline: "2px solid var(--nx-card, #FFFFFF)",
            position: "absolute",
            top: size - badge + 2,
            width: badge,
          }}
        />
      ) : null}
    </span>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7.2V11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
      <circle cx="8" cy="5.2" fill="currentColor" r=".8" />
    </svg>
  );
}

const SLIPPAGE_LABEL = "0.5%";

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "flex",
        gap: 24,
        justifyContent: "space-between",
        whiteSpace: "nowrap",
      }}
    >
      <span>{label}</span>
      <b
        style={{
          color: "var(--nx-ink, #161615)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
          textAlign: "right",
        }}
      >
        {value}
      </b>
    </span>
  );
}

function Tip({
  align = "center",
  children,
  label,
}: {
  align?: "center" | "end" | "start";
  children: React.ReactNode;
  label: string;
}) {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const tipRef = React.useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(
    null,
  );

  const position = React.useCallback(() => {
    const button = buttonRef.current;
    const tip = tipRef.current;
    if (!button || !tip) return;
    const rect = button.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const preferred =
      align === "end"
        ? rect.right - width + 6
        : align === "start"
          ? rect.left - 40
          : rect.left + rect.width / 2 - width / 2;
    setPlace({
      left: Math.max(8, Math.min(window.innerWidth - width - 8, preferred)),
      top: Math.max(8, rect.top - height - 10),
    });
  }, [align]);

  React.useLayoutEffect(() => {
    if (!open) return;
    position();
  }, [open, position]);

  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ display: "inline-flex" }}
    >
      <button
        aria-expanded={open}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        ref={buttonRef}
        style={{
          alignItems: "center",
          background: open ? "var(--nx-shim, #EFEFEE)" : "transparent",
          border: "none",
          borderRadius: "999px",
          color: "var(--nx-faint, #A3A3A2)",
          cursor: "pointer",
          display: "grid",
          height: "18px",
          placeItems: "center",
          width: "18px",
        }}
        type="button"
      >
        <InfoIcon />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tipRef}
              role="tooltip"
              style={{
                background: "var(--nx-pop, #FFFFFF)",
                borderRadius: "16px",
                boxShadow:
                  "#16161514 0 8px 28px, var(--nx-pop-ring, #1616150A) 0 0 0 1px",
                color: "var(--nx-mute-2, #8C8C8B)",
                display: "flex",
                flexDirection: "column",
                font: `400 14px/18px ${uiFont}`,
                gap: "8px",
                left: place?.left ?? -9999,
                padding: "12px 16px",
                position: "fixed",
                top: place?.top ?? -9999,
                zIndex: 80,
              }}
            >
              {children}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

function Shimmer({ width, height }: { width: number; height: number }) {
  return (
    <span
      className="nx-shim"
      style={{ display: "inline-block", height, width }}
    />
  );
}

const sanitizeAmount = (raw: string, maxDecimals: number) => {
  let next = raw.replaceAll(/[^0-9.]/g, "");
  const parts = next.split(".");
  if (parts.length > 2) next = `${parts[0]}.${parts.slice(1).join("")}`;
  const [whole, fraction] = next.split(".");
  if (fraction !== undefined) {
    next = `${whole}.${fraction.slice(0, Math.max(0, maxDecimals))}`;
  }
  if (next === ".") next = "0.";
  return next;
};

export function DepositIdleForm({
  amount: _amount,
  amountMode: _amountMode,
  fromTokens,
  isAmountReadOnly = false,
  isBalanceLoading = false,
  isQuoteRefreshing = false,
  isSourcePickerDisabled = false,
  onAmountChange: _onAmountChange,
  onAmountModeToggle: _onAmountModeToggle,
  onOpenSourcePicker,
  onSetPercent: _onSetPercent,
  onUpdateTokens,
  availableTokens = [],
  onSelectAvailableToken,
  onBack,
  slideFromLeft = false,
  onOpenHistory,
  onClose,
  quoteLabel = "–",
  quoteProgress = 1,
  routeMessage,
  routeStatus,
  toToken,
  receiveAmount,
  minReceiveAmount,
  receiveUsd,
  feeUsd,
  feeDetails,
  destinationLabel = "Deposit",
  walletLabel,
  maxSourceTokens = 3,
}: DepositIdleFormProps) {
  void _amount;
  void _amountMode;
  void _onAmountChange;
  void _onAmountModeToggle;
  void _onSetPercent;

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [tokenQuery, setTokenQuery] = useState("");
  const [chainFilter, setChainFilter] = useState("all");
  const [chainMenuOpen, setChainMenuOpen] = useState(false);
  const previousTokenCount = React.useRef(0);
  const openRowRef = React.useRef<HTMLDivElement | null>(null);
  const typingTimerRef = React.useRef<number | null>(null);
  const awaitingQuoteSettleRef = React.useRef(false);
  const [typing, setTyping] = useState(false);
  const tokenKey = (token: SwapTokenOption, index: number) =>
    `${token.chainId ?? "na"}-${token.contractAddress}-${index}`;

  const blurAmountField = () => {
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement &&
      openRowRef.current?.contains(active)
    ) {
      active.blur();
    }
  };

  const markTyping = () => {
    awaitingQuoteSettleRef.current = true;
    setTyping(true);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => setTyping(false), 1200);
  };

  React.useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (event: PointerEvent) => {
      const row = openRowRef.current;
      if (!row || !(event.target instanceof Node) || row.contains(event.target)) {
        return;
      }
      setOpenKey(null);
      blurAmountField();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openKey]);

  React.useEffect(() => {
    if (fromTokens.length > previousTokenCount.current) {
      const index = fromTokens.length - 1;
      const token = fromTokens[index];
      if (token && !token.userAmount) {
        setOpenKey(tokenKey(token, index));
        if (token.userAmountMode !== "usd") {
          onUpdateTokens?.(
            fromTokens.map((item, itemIndex) =>
              itemIndex === index
                ? { ...item, userAmount: "", userAmountMode: "usd" }
                : item,
            ),
          );
        }
      }
    }
    previousTokenCount.current = fromTokens.length;
  }, [fromTokens, onUpdateTokens]);

  const updateToken = (index: number, patch: Partial<SwapTokenOption>) => {
    if (!onUpdateTokens || isAmountReadOnly) return;
    onUpdateTokens(
      fromTokens.map((token, tokenIndex) =>
        tokenIndex === index ? { ...token, ...patch } : token,
      ),
    );
  };

  const spendUsd = fromTokens.reduce(
    (sum, token) => sum.plus(tokenUsd(token, tokenUnitAmount(token))),
    new Decimal(0),
  );
  const quotedReceive = readDecimal(receiveAmount);
  const quotedMinReceive = readDecimal(minReceiveAmount);
  const quotedReceiveUsd = readDecimal(receiveUsd);
  const showQuote = quotedReceive.gt(0) && !isQuoteRefreshing;
  const quoteLoading = Boolean(
    (isQuoteRefreshing || routeStatus === "loading") && spendUsd.gt(0),
  );
  const showQuoteShimmer = quoteLoading && !typing;

  React.useEffect(() => {
    if (typing || !awaitingQuoteSettleRef.current || !showQuote) return;
    awaitingQuoteSettleRef.current = false;
    setOpenKey(null);
    blurAmountField();
  }, [typing, showQuote]);
  const impact =
    spendUsd.gt(0) && quotedReceiveUsd.gt(0)
      ? spendUsd.minus(quotedReceiveUsd).div(spendUsd)
      : new Decimal(0);
  const highImpact = showQuote && impact.gt("0.03");
  const readFee = (key: string) => {
    const value = feeDetails?.[key];
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const parsed = readDecimal(value);
    return parsed.gt(0) ? parsed : undefined;
  };
  const networkFeeUsd = (() => {
    const direct = readFee("caGasUsd") ?? readFee("caGas");
    if (direct) return direct;
    const deposit = readFee("depositUsd");
    const fulfillment = readFee("fulfillmentUsd") ?? readFee("fulfilment");
    const collection = readFee("collection");
    if (deposit || fulfillment || collection) {
      return (deposit ?? collection ?? new Decimal(0)).plus(fulfillment ?? 0);
    }
    return undefined;
  })();
  const solverFeeUsd = readFee("solverUsd") ?? readFee("solver");
  const protocolFeeUsd = readFee("protocolUsd") ?? readFee("protocol");
  const formatFeeLine = (value?: Decimal) => {
    if (!showQuote) return "–";
    if (!value || value.lte(0)) return "$0.00";
    if (value.lt(0.01)) return "<$0.01";
    return formatUsd(value);
  };
  const atCap = fromTokens.length >= maxSourceTokens;
  const localError = fromTokens.some((token) => rowError(token));
  const chains = Array.from(
    new Map(
      availableTokens
        .filter((token) => token.chainName)
        .map((token) => [token.chainName as string, token.chainLogo]),
    ).entries(),
  );
  const visibleTokens = availableTokens
    .filter((token) => {
      const query = tokenQuery.trim().toLowerCase();
      const chainMatches = chainFilter === "all" || token.chainName === chainFilter;
      const queryMatches =
        !query ||
        `${token.symbol} ${token.chainName ?? ""}`.toLowerCase().includes(query);
      return chainMatches && queryMatches;
    })
    .sort((a, b) => {
      const usdDelta = readDecimal(b.balanceInFiat).cmp(readDecimal(a.balanceInFiat));
      if (usdDelta !== 0) return usdDelta;
      return `${a.symbol ?? ""} ${a.chainName ?? ""}`.localeCompare(
        `${b.symbol ?? ""} ${b.chainName ?? ""}`,
      );
    });

  if (fromTokens.length === 0) {
    return (
      <div className={`nx-deposit-screen${slideFromLeft ? " nx-back" : ""}`} style={{ width: "100%" }}>
        <div className="nx-card" style={{ borderRadius: "30px", boxShadow: "none" }}>
          <div className="nx-head">
            {onBack ? (
              <button
                aria-label="Back"
                onClick={onBack}
                style={{
                  alignItems: "center",
                  background: "var(--nx-fill, #F3F3F3)",
                  border: "none",
                  borderRadius: "999px",
                  cursor: "pointer",
                  display: "grid",
                  height: 32,
                  placeItems: "center",
                  width: 32,
                }}
                type="button"
              >
                <svg fill="none" height="14" viewBox="0 0 14 14" width="14">
                  <path d="M8.5 3L4.5 7L8.5 11" stroke="var(--nx-ink-2, #3A3A39)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                </svg>
              </button>
            ) : null}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nx-title">Select Token</div>
              {walletLabel ? (
                <div className="nx-sub">
                  From <b>{walletLabel}</b>
                </div>
              ) : null}
            </div>
            {onClose ? (
              <button
                aria-label="Close"
                onClick={onClose}
                style={{ alignItems: "center", background: "var(--nx-fill, #F3F3F3)", border: "none", borderRadius: "999px", cursor: "pointer", display: "grid", height: 32, placeItems: "center", width: 32 }}
                type="button"
              >
                <svg fill="none" height="13" viewBox="0 0 13 13" width="13">
                  <path d="M3 3L10 10M10 3L3 10" stroke="var(--nx-ink-2, #3A3A39)" strokeLinecap="round" strokeWidth="1.5" />
                </svg>
              </button>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              opacity: isBalanceLoading ? 0.5 : 1,
              padding: 12,
              pointerEvents: isBalanceLoading ? "none" : "auto",
              transition: "opacity 200ms cubic-bezier(.23,1,.32,1)",
            }}
          >
            <label
              style={{
                alignItems: "center",
                background: "var(--nx-fill, #F3F3F3)",
                borderRadius: 14,
                display: "flex",
                flex: 1,
                gap: 10,
                minWidth: 0,
                padding: "11px 14px",
              }}
            >
              <svg fill="none" height="15" viewBox="0 0 14 14" width="15">
                <circle cx="6" cy="6" r="4.5" stroke="var(--nx-mute, #737372)" strokeWidth="1.4" />
                <path d="M9.5 9.5L12.5 12.5" stroke="var(--nx-mute, #737372)" strokeLinecap="round" strokeWidth="1.4" />
              </svg>
              <input
                onChange={(event) => setTokenQuery(event.target.value)}
                placeholder="Search token or chain"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--nx-ink, #161615)",
                  flex: 1,
                  font: `400 14px/18px ${uiFont}`,
                  minWidth: 0,
                  outline: "none",
                }}
                value={tokenQuery}
              />
            </label>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setChainMenuOpen((open) => !open)}
                style={{
                  alignItems: "center",
                  background: "var(--nx-pop, #FFFFFF)",
                  border: "none",
                  borderRadius: 14,
                  boxShadow: "var(--nx-pill-ring, #1616151F) 0 0 3px",
                  cursor: "pointer",
                  display: "flex",
                  font: `500 14px/18px ${uiFont}`,
                  gap: 8,
                  height: 40,
                  padding: "0 12px 0 10px",
                }}
                type="button"
              >
                <span style={{ display: "flex" }}>
                  {(chainFilter === "all" ? chains.slice(0, 3) : chains.filter(([name]) => name === chainFilter)).map(([name, logo], index) => (
                    <img
                      alt=""
                      key={name}
                      src={logo}
                      style={{
                        borderRadius: "999px",
                        height: 18,
                        marginLeft: index === 0 ? 0 : -6,
                        outline: "1.5px solid var(--nx-fill, #F3F3F3)",
                        width: 18,
                      }}
                    />
                  ))}
                </span>
                <span>{chainFilter === "all" ? "All Chains" : chainFilter}</span>
              </button>
              {chainMenuOpen ? (
                <div
                  style={{
                    background: "var(--nx-pop, #FFFFFF)",
                    borderRadius: 16,
                    boxShadow: "#16161514 0 8px 28px, var(--nx-pop-ring, #1616150A) 0 0 0 1px",
                    minWidth: 180,
                    padding: 6,
                    position: "absolute",
                    right: 0,
                    top: 46,
                    zIndex: 5,
                  }}
                >
                  <button
                    onClick={() => {
                      setChainFilter("all");
                      setChainMenuOpen(false);
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", display: "block", font: `400 14px/18px ${uiFont}`, padding: "9px 10px", textAlign: "left", width: "100%" }}
                    type="button"
                  >
                    All Chains
                  </button>
                  {chains.map(([name]) => (
                    <button
                      key={name}
                      onClick={() => {
                        setChainFilter(name);
                        setChainMenuOpen(false);
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", display: "block", font: `400 14px/18px ${uiFont}`, padding: "9px 10px", textAlign: "left", width: "100%" }}
                      type="button"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {isBalanceLoading ? (
            <div aria-busy="true">
              {Array.from({ length: 5 }, (_, index) => (
                <div className="nx-skel-row" key={index}>
                  <span className="nx-shim" style={{ borderRadius: 999, height: 40, width: 40 }} />
                  <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 6 }}>
                    <Shimmer height={14} width={[64, 56, 72, 60, 52][index]} />
                    <Shimmer height={12} width={[88, 72, 96, 80, 64][index]} />
                  </span>
                  <span style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", gap: 6 }}>
                    <Shimmer height={14} width={[96, 104, 88, 92, 84][index]} />
                    <Shimmer height={12} width={[52, 44, 48, 40, 48][index]} />
                  </span>
                </div>
              ))}
            </div>
          ) : visibleTokens.length === 0 ? (
            <div style={{ color: "var(--nx-mute-2, #8C8C8B)", font: `400 14px/18px ${uiFont}`, padding: "28px 12px 32px", textAlign: "center" }}>
              {tokenQuery ? `No tokens match “${tokenQuery}”` : "No tokens in this wallet"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflow: "auto" }}>
              {visibleTokens.map((token, index) => (
                <button
                  key={`${token.chainId}-${token.contractAddress}-${index}`}
                  onClick={() => onSelectAvailableToken?.(token)}
                  style={{
                    alignItems: "center",
                    animation: `nx-row-in 200ms cubic-bezier(.23,1,.32,1) ${Math.min(index, 6) * 24}ms both`,
                    background: "transparent",
                    border: "none",
                    borderRadius: 18,
                    cursor: "pointer",
                    display: "flex",
                    gap: 12,
                    padding: 12,
                    textAlign: "left",
                    width: "100%",
                  }}
                  type="button"
                >
                  <LogoPair token={token} />
                  <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ color: "var(--nx-ink, #161615)", font: `500 16px/20px ${uiFont}` }}>{token.symbol}</span>
                    <span style={{ color: "var(--nx-mute, #737372)", font: `400 14px/18px ${uiFont}` }}>{token.chainName}</span>
                  </span>
                  <span style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: "var(--nx-ink, #161615)", font: `500 16px/20px ${uiFont}`, fontVariantNumeric: "tabular-nums" }}>
                      {formatTokenAmount(readDecimal(token.balance), token.decimals)} {token.symbol}
                    </span>
                    <span style={{ color: "var(--nx-mute, #737372)", font: `400 14px/18px ${uiFont}` }}>
                      {formatUsd(readDecimal(token.balanceInFiat))}
                    </span>
                  </span>
                  <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                    <path d="M6 3.5L10.5 8L6 12.5" stroke="var(--nx-faint, #A3A3A2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`nx-deposit-screen${slideFromLeft ? " nx-back" : ""}${openKey ? " nx-focus" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <div className="nx-card">
        <div className="nx-head" style={{ borderBottom: "1px solid var(--nx-line-2, #EDEDED)", gap: 8 }}>
          <button
            aria-label="Back"
            onClick={onBack}
            style={{
              alignItems: "center",
              background: "var(--nx-fill, #F3F3F3)",
              border: "none",
              borderRadius: "999px",
              cursor: onBack ? "pointer" : "default",
              display: "grid",
              flexShrink: 0,
              height: 32,
              placeItems: "center",
              width: 32,
            }}
            type="button"
          >
            <svg fill="none" height="14" viewBox="0 0 14 14" width="14">
              <path d="M8.5 3L4.5 7L8.5 11" stroke="var(--nx-ink-2, #3A3A39)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
            </svg>
          </button>
          <div style={{ color: "var(--nx-ink, #161615)", flex: 1, font: `500 18px/22px ${displayFont}`, letterSpacing: "-0.01em", minWidth: 0 }}>
            Deposit {toToken?.symbol || ""}
          </div>
          {onOpenHistory ? (
            <button
              aria-label="Transaction history"
              onClick={onOpenHistory}
              style={{ alignItems: "center", background: "var(--nx-fill, #F3F3F3)", border: "none", borderRadius: "999px", cursor: "pointer", display: "grid", height: 32, placeItems: "center", width: 32 }}
              type="button"
            >
              <svg fill="none" height="15" viewBox="0 0 15 15" width="15">
                <path d="M2.6 7.5a4.9 4.9 0 1 0 1.45-3.47M2.4 2.3v2.4h2.4M7.5 4.9v2.8l1.9 1.2" stroke="var(--nx-ink-2, #3A3A39)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
              </svg>
            </button>
          ) : null}
          <span style={{ alignItems: "center", background: "var(--nx-fill, #F3F3F3)", borderRadius: 999, color: "var(--nx-ink, #161615)", display: "inline-flex", font: `500 13px/16px ${uiFont}`, gap: 5, height: 32, opacity: showQuote ? 1 : 0.45, padding: "0 10px 0 8px" }}>
            <svg fill="none" height="14" style={{ transform: "rotate(-90deg)" }} viewBox="0 0 14 14" width="14">
              <circle cx="7" cy="7" r="5.5" stroke="var(--nx-ring, #CFCFCD)" strokeWidth="1.6" />
              <circle
                cx="7"
                cy="7"
                fill="none"
                r="5.5"
                stroke="var(--nx-blue, #006BF4)"
                strokeDasharray="34.56"
                strokeDashoffset={34.56 * (1 - Math.max(0, Math.min(1, quoteProgress)))}
                strokeLinecap="round"
                strokeWidth="1.6"
                style={{ transition: "stroke-dashoffset 250ms linear" }}
              />
            </svg>
            <span style={{ fontVariantNumeric: "tabular-nums", minWidth: "2.4em" }}>{quoteLabel}</span>
          </span>
          {onClose ? (
            <button
              aria-label="Close"
              onClick={onClose}
              style={{ alignItems: "center", background: "var(--nx-fill, #F3F3F3)", border: "none", borderRadius: "999px", cursor: "pointer", display: "grid", height: 32, placeItems: "center", width: 32 }}
              type="button"
            >
              <svg fill="none" height="13" viewBox="0 0 13 13" width="13">
                <path d="M3 3L10 10M10 3L3 10" stroke="var(--nx-ink-2, #3A3A39)" strokeLinecap="round" strokeWidth="1.5" />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="nx-hero nx-focusable">
          <div className="nx-who">{destinationLabel} receives</div>
          <div className="nx-amt-line">
            {showQuoteShimmer ? (
              <span className="nx-shim" style={{ borderRadius: 14, height: 48, width: 188 }} />
            ) : (
              <span className={`nx-big${showQuote ? " nx-arrive" : ""}`} style={{ color: !showQuote && !openKey ? "var(--nx-ghost, #C4C4C2)" : undefined }}>
                {showQuote ? `~${formatTokenAmount(quotedReceive, toToken?.decimals)}` : "~0.00"}
              </span>
            )}
            {showQuoteShimmer ? null : (
            <span className="nx-usd">
              {showQuote ? `≈ ${formatUsd(quotedReceiveUsd)}` : "≈ $0.00"}
            </span>
            )}
            {showQuote ? (
              <Tip label="Exact amount">
                <span style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
                  <span>Exact amount</span>
                  <b style={{ color: "var(--nx-ink, #161615)", fontWeight: 500 }}>
                    {formatTokenAmount(quotedReceive, toToken?.decimals)} {toToken?.symbol}
                  </b>
                </span>
              </Tip>
            ) : null}
          </div>
          <div className="nx-meta">
            {showQuoteShimmer ? (
              <span style={{ alignItems: "center", display: "inline-flex", gap: 8 }}>
                <span style={{ background: "var(--nx-blue, #006BF4)", borderRadius: 4, height: 14, width: 14 }} />
                Finding the best route...
              </span>
            ) : toToken ? (
              <>
                <TokenLogo label={toToken.symbol} size={20} src={toToken.logo} />
                <span>{toToken.symbol}</span>
                <span>on {toToken.chainName}</span>
              </>
            ) : null}
          </div>
          {highImpact ? (
            <div className="nx-warn">High price impact. You may receive less than expected.</div>
          ) : null}
        </div>
        <div className="nx-swap-div" />
        <div className="nx-spend nx-focusable">
          <span>Your Spend</span>
          <span className="nx-tnum">{formatUsd(spendUsd)}</span>
          <span className="nx-spend-label">Total</span>
        </div>
        <div className="nx-plist">
          {fromTokens.map((token, index) => {
            const key = tokenKey(token, index);
            const open = openKey === key;
            const units = tokenUnitAmount(token);
            const error = rowError(token);
            const usdMode = token.userAmountMode === "usd";
            const shown = token.userAmount || "";
            const secondary = usdMode
              ? `≈ ${units.gt(0) ? formatTokenAmount(units, token.decimals) : "0.00"} ${token.symbol}`
              : `≈ ${formatUsd(tokenUsd(token, units))}`;
            const balanceLabel = usdMode
              ? `Balance: ${formatUsd(readDecimal(token.balanceInFiat))}`
              : `Balance: ${formatTokenAmount(readDecimal(token.balance), token.decimals)} ${token.symbol}`;
            return (
              <div
                className={`nx-prow${open ? " open" : ""}${error ? " err" : ""}`}
                key={key}
                ref={open ? openRowRef : undefined}
              >
                <div
                  className="nx-pr-top"
                  onClick={() => setOpenKey(key)}
                >
                  <div className="nx-pr-tok">
                    <LogoPair token={token} />
                    <span>
                      <span className="nx-nm">
                        {token.symbol}
                        <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
                          <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--nx-mute-2, #8C8C8B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                        </svg>
                      </span>
                      <span className="nx-ch">{token.chainName}</span>
                    </span>
                  </div>
                  <div className="nx-pr-amt">
                    <div className={`nx-pr-val${open ? " open" : ""}`} style={{ justifyContent: "flex-end" }}>
                      {usdMode ? (
                        <span
                          style={{
                            color: error
                              ? "var(--nx-red, #D93636)"
                              : shown
                                ? "var(--nx-ink, #161615)"
                                : "var(--nx-ghost, #C4C4C2)",
                            font: open ? `400 36px/40px ${uiFont}` : `500 20px/28px ${uiFont}`,
                            letterSpacing: open ? "-0.03em" : "-0.02em",
                          }}
                        >
                          $
                        </span>
                      ) : null}
                      <input
                        aria-label={`${token.symbol} amount`}
                        inputMode="decimal"
                        onChange={(event) => {
                          markTyping();
                          updateToken(index, {
                            userAmount: sanitizeAmount(
                              event.target.value,
                              usdMode ? 2 : Math.min(token.decimals || 8, 8),
                            ),
                            userAmountMode: usdMode ? "usd" : "token",
                          });
                        }}
                        onFocus={() => setOpenKey(key)}
                        placeholder="0"
                        readOnly={isAmountReadOnly || !onUpdateTokens}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: error
                            ? "var(--nx-red, #D93636)"
                            : shown
                              ? "var(--nx-ink, #161615)"
                              : "var(--nx-ghost, #C4C4C2)",
                          font: open
                            ? `400 36px/40px ${uiFont}`
                            : `500 20px/28px ${uiFont}`,
                          letterSpacing: open ? "-0.03em" : "-0.02em",
                          outline: "none",
                          textAlign: "left",
                          width: `${Math.max((shown || "0").length, 1)}ch`,
                        }}
                        value={shown}
                      />
                    </div>
                    <div className="nx-pr-sub">
                      <span>{secondary}</span>
                      <button
                        aria-label={usdMode ? `Enter in ${token.symbol}` : "Enter in dollars"}
                        onClick={(event) => {
                          event.stopPropagation();
                          const nextUsd = !usdMode;
                          const nextAmount = nextUsd
                            ? tokenUsd(token, units).toDecimalPlaces(2).toFixed()
                            : formatTokenAmount(units, token.decimals);
                          updateToken(index, {
                            userAmount: units.gt(0) ? nextAmount : "",
                            userAmountMode: nextUsd ? "usd" : "token",
                          });
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--nx-mute, #737372)",
                          cursor: "pointer",
                          transform: usdMode ? "rotate(180deg)" : "none",
                          transition: `transform 250ms ${easeMove}`,
                        }}
                        type="button"
                      >
                        ↕
                      </button>
                    </div>
                  </div>
                  <button
                    aria-label="Remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      onUpdateTokens?.(fromTokens.filter((_, tokenIndex) => tokenIndex !== index));
                      setOpenKey(null);
                    }}
                    style={{
                      background: "var(--nx-fill-2, #EDEDEC)",
                      border: "none",
                      borderRadius: "999px",
                      color: "var(--nx-faint, #A3A3A2)",
                      cursor: "pointer",
                      height: 24,
                      width: 24,
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </div>
                <div className={`nx-collapse${open || error ? " on" : ""}`}>
                  <div>
                    <div className="nx-pr-bal">
                      <span>{balanceLabel}</span>
                      {[20, 50, 100].map((pct) => (
                        <button
                          key={pct}
                          onClick={(event) => {
                            event.stopPropagation();
                            markTyping();
                            const balance = readDecimal(token.balance);
                            const buffer = gasBuffer(token);
                            const nextUnits =
                              pct === 100 ? Decimal.max(balance.minus(buffer), 0) : balance.mul(pct).div(100);
                            const nextAmount = usdMode
                              ? tokenUsd(token, nextUnits).toDecimalPlaces(2).toFixed()
                              : formatTokenAmount(nextUnits, token.decimals);
                            updateToken(index, {
                              userAmount: nextAmount,
                              userAmountMode: usdMode ? "usd" : "token",
                            });
                          }}
                          style={{
                            background: "var(--nx-pop, #FFFFFF)",
                            border: "none",
                            borderRadius: "999px",
                            boxShadow: "var(--nx-pop-ring, #1616150A) 0 0 0 1px",
                            color: "var(--nx-ink, #161615)",
                            cursor: "pointer",
                            font: `500 12px/16px ${uiFont}`,
                            padding: "5px 8px",
                          }}
                          type="button"
                        >
                          {pct === 100 ? "MAX" : `${pct}%`}
                        </button>
                      ))}
                    </div>
                    {error ? <div className="nx-pr-err">{error}</div> : null}
                  </div>
                </div>
              </div>
            );
          })}
          <button
            className="nx-add"
            disabled={atCap || isSourcePickerDisabled}
            onClick={onOpenSourcePicker}
            type="button"
          >
            <span className="nx-plus">+</span>
            {atCap ? "Token limit reached" : "Add another token"}
          </button>
          {atCap ? (
            <div className="nx-cap">You can add up to {maxSourceTokens} tokens. Remove one to add another.</div>
          ) : null}
        </div>
      </div>
      <div className="nx-fees nx-focusable">
        <div>
          Fees (Est){" "}
          {showQuoteShimmer ? (
            <span className="nx-shim" style={{ height: 14, width: 48 }} />
          ) : (
            <b>{feeUsd ? formatUsd(readDecimal(feeUsd)) : "$0.00"}</b>
          )}
          <Tip align="start" label="Fee breakdown">
            <TipRow label="Network fees:" value={formatFeeLine(networkFeeUsd)} />
            <TipRow label="Solver fees:" value={formatFeeLine(solverFeeUsd)} />
            <TipRow label="Protocol fees:" value={formatFeeLine(protocolFeeUsd)} />
          </Tip>
        </div>
        <div>
          Max Slippage           <span className="nx-auto">Auto</span>
          {showQuoteShimmer ? (
            <span className="nx-shim" style={{ height: 14, width: 36 }} />
          ) : (
            <b>{SLIPPAGE_LABEL}</b>
          )}
          <Tip align="end" label="Slippage details">
            <TipRow
              label="Min. received:"
              value={
                showQuote
                  ? `${formatTokenAmount(
                      quotedMinReceive.gt(0) ? quotedMinReceive : quotedReceive,
                      toToken?.decimals,
                    )} ${toToken?.symbol || ""}`
                  : "–"
              }
            />
            <TipRow
              label="Price Impact:"
              value={
                showQuote
                  ? formatFeeLine(
                      Decimal.max(
                        spendUsd.minus(quotedReceiveUsd).minus(readDecimal(feeUsd)),
                        0,
                      ),
                    )
                  : "–"
              }
            />
          </Tip>
        </div>
      </div>
      {!localError && routeMessage ? <div className="nx-pr-err">{routeMessage}</div> : null}
    </div>
  );
}
