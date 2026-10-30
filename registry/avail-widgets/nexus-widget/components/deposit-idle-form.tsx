// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import Decimal from "decimal.js";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { DepositAmountInput, useDepositQuoteMotion } from "./deposit-motion";
import { DepositAnimatedAmount } from "./deposit-animated-amount";
import { CHAIN_METADATA } from "../../common/utils/constant";
import { DepositAssetSelector } from "./deposit-asset-selector";
import { LogoPair, TokenLogo } from "./deposit-token-logo";
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
  onOpenSourcePicker: (index?: number) => void;
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

const compactAmount = (value: Decimal, decimals = 6) => {
  if (value.gte(1_000_000_000))
    return `${value.div(1_000_000_000).toDecimalPlaces(1).toFixed()}B`;
  if (value.gte(1_000_000))
    return `${value.div(1_000_000).toDecimalPlaces(1).toFixed()}M`;
  return formatTokenAmount(value, decimals);
};
const compactUsd = (value: Decimal) =>
  value.gte(1_000_000) ? `$${compactAmount(value)}` : formatUsd(value);

const tokenUsd = (token: SwapTokenOption, units: Decimal) => {
  const balance = readDecimal(token.balance);
  const fiat = readDecimal(token.balanceInFiat);
  const price = balance.gt(0) ? fiat.div(balance) : new Decimal(0);
  return units.mul(price);
};

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 16 16"
      width="14"
    >
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 7.2V11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
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
  trigger,
}: {
  trigger?: React.ReactNode;
  align?: "center" | "end" | "start";
  children: React.ReactNode;
  label: string;
}) {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const tipRef = React.useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [portalTheme, setPortalTheme] = useState<React.CSSProperties>({});
  const [place, setPlace] = useState<{ left: number; top: number } | null>(
    null,
  );

  const position = React.useCallback(() => {
    const button = buttonRef.current;
    const tip = tipRef.current;
    if (!button || !tip) return;
    const colors = window.getComputedStyle(button);
    setPortalTheme(
      Object.fromEntries(
        ["--nx-pop", "--nx-mute-2", "--nx-ink", "--nx-pop-ring"].map((name) => [
          name,
          colors.getPropertyValue(name),
        ]),
      ) as React.CSSProperties,
    );
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

  React.useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (
        !buttonRef.current?.contains(event.target as Node) &&
        !tipRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
        setPinned(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open, position]);

  React.useLayoutEffect(() => {
    if (!open) return;
    position();
  }, [open, position]);

  return (
    <span
      onMouseEnter={() => {
        if (window.matchMedia?.("(hover:hover) and (pointer:fine)").matches)
          setOpen(true);
      }}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
      style={{ display: "inline-flex" }}
    >
      <button
        aria-expanded={open}
        aria-label={label}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          setPinned(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          setPinned(!pinned);
          setOpen(!pinned);
        }}
        ref={buttonRef}
        style={{
          alignItems: "center",
          background:
            open && !trigger ? "var(--nx-shim, #EFEFEE)" : "transparent",
          border: "none",
          borderRadius: "999px",
          color: trigger ? "inherit" : "var(--nx-faint, #A3A3A2)",
          font: "inherit",
          cursor: "pointer",
          display: "grid",
          height: trigger ? "auto" : "18px",
          placeItems: "center",
          padding: 0,
          width: trigger ? "auto" : "18px",
        }}
        type="button"
      >
        {trigger ?? <InfoIcon />}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tipRef}
              className="nx-tip"
              role="tooltip"
              style={{
                ...portalTheme,
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

/** Shared compact display for progress and receipt amounts; exact value stays available. */
export function DepositCalculatedAmount({
  value,
  entranceDelay,
}: {
  value: string;
  entranceDelay?: number;
}) {
  const parsed = readDecimal(value);
  const abbreviated = parsed.gte(1_000_000);
  const content = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <DepositAnimatedAmount
        value={`~${compactAmount(parsed, 8)}`}
        entranceDelay={entranceDelay}
      />
      {abbreviated && <InfoIcon />}
    </span>
  );
  return abbreviated ? (
    <Tip label="Exact amount" trigger={content}>
      <TipRow label="Exact amount" value={value} />
    </Tip>
  ) : (
    content
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

export const sanitizeAmount = (raw: string, maxDecimals: number) => {
  let next = raw.replaceAll(/[^0-9.]/g, "");
  const parts = next.split(".");
  if (parts.length > 2) next = `${parts[0]}.${parts.slice(1).join("")}`;
  if (next.startsWith(".")) next = `0${next}`;
  const [whole, fraction] = next.split(".");
  const normalizedWhole = whole ? whole.replace(/^0+(?=\d)/, "") : "";
  if (fraction !== undefined) {
    next = `${normalizedWhole}.${fraction.slice(0, Math.max(0, maxDecimals))}`;
  } else {
    next = normalizedWhole;
  }
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

  const previousTokenKeys = React.useRef<string[]>([]);
  const openRowRef = React.useRef<HTMLDivElement | null>(null);
  const typingTimerRef = React.useRef<number | null>(null);
  const awaitingQuoteSettleRef = React.useRef(false);
  const [typing, setTyping] = useState(false);
  const [newTokenKey, setNewTokenKey] = useState<string | null>(null);
  const [capNote, setCapNote] = useState(false);
  const capTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (capTimer.current) clearTimeout(capTimer.current);
    },
    [],
  );
  const tokenKey = (token: SwapTokenOption, _index?: number) =>
    `${token.chainId ?? "na"}-${token.contractAddress.toLowerCase()}`;
  const [exitingTokens, setExitingTokens] = useState<
    Array<{ token: SwapTokenOption; index: number }>
  >([]);
  const removalTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  React.useEffect(() => () => removalTimers.current.forEach(clearTimeout), []);
  const removeToken = (token: SwapTokenOption, index: number) => {
    if (!onUpdateTokens || isAmountReadOnly) return;
    if (
      fromTokens.length > 1 &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setExitingTokens((current) => [...current, { token, index }]);
      removalTimers.current.push(
        setTimeout(() => {
          setExitingTokens((current) =>
            current.filter((item) => tokenKey(item.token) !== tokenKey(token)),
          );
        }, 360),
      );
    }
    onUpdateTokens(
      fromTokens.filter((item) => tokenKey(item) !== tokenKey(token)),
    );
    if (openKey === tokenKey(token)) setOpenKey(null);
  };
  const displayedTokens = fromTokens.map((token) => ({
    token,
    exiting: false,
  }));
  for (const entry of exitingTokens) {
    if (
      !fromTokens.some((token) => tokenKey(token) === tokenKey(entry.token))
    ) {
      displayedTokens.splice(Math.min(entry.index, displayedTokens.length), 0, {
        token: entry.token,
        exiting: true,
      });
    }
  }

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
    typingTimerRef.current = window.setTimeout(() => setTyping(false), 500);
  };

  React.useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!openKey) return;
    const input = openRowRef.current?.querySelector("input");
    input?.focus({ preventScroll: true });
  }, [openKey]);

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (event: PointerEvent) => {
      const row = openRowRef.current;
      if (
        !row ||
        !(event.target instanceof Node) ||
        row.contains(event.target)
      ) {
        return;
      }
      setOpenKey(null);
      blurAmountField();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openKey]);

  React.useEffect(() => {
    let index = -1;
    for (
      let tokenIndex = fromTokens.length - 1;
      tokenIndex >= 0;
      tokenIndex--
    ) {
      if (
        !previousTokenKeys.current.includes(tokenKey(fromTokens[tokenIndex]))
      ) {
        index = tokenIndex;
        break;
      }
    }
    if (index >= 0) {
      const token = fromTokens[index];
      if (token && !token.userAmount) {
        setOpenKey(tokenKey(token, index));
        setNewTokenKey(tokenKey(token));
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
    previousTokenKeys.current = fromTokens.map((token) => tokenKey(token));
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
  const localError = fromTokens.some((token) => rowError(token));
  const hasEnteredAmount = fromTokens.some((token) =>
    readDecimal(token.userAmount).gt(0),
  );
  const hasQuoteError =
    localError || routeStatus === "error" || routeStatus === "insufficient";
  const quotePending = Boolean(
    hasEnteredAmount &&
    !hasQuoteError &&
    (receiveAmount == null || isQuoteRefreshing || routeStatus === "loading"),
  );
  const quoteMotion = useDepositQuoteMotion({
    enabled: hasEnteredAmount && !hasQuoteError,
    pending: quotePending,
    inputKey: fromTokens
      .map(
        (token) =>
          `${tokenKey(token)}:${token.userAmountMode}:${token.userAmount}`,
      )
      .join("|"),
    destinationKey: `${destinationLabel}:${toToken?.chainId}:${toToken?.contractAddress}`,
    value: { receiveAmount, minReceiveAmount, receiveUsd, feeUsd },
  });
  const showQuoteShimmer = quoteMotion.shimmer;
  const quotedReceive = readDecimal(quoteMotion.value?.receiveAmount);
  const quotedMinReceive = readDecimal(quoteMotion.value?.minReceiveAmount);
  const quotedReceiveUsd = readDecimal(quoteMotion.value?.receiveUsd);
  const showQuote =
    hasEnteredAmount &&
    quotedReceive.gt(0) &&
    !showQuoteShimmer &&
    !hasQuoteError;
  const isEditingEmptyAmount = fromTokens.some(
    (token, index) =>
      tokenKey(token, index) === openKey && !token.userAmount?.trim(),
  );

  React.useEffect(() => {
    if (!newTokenKey) return;
    const timer = setTimeout(() => setNewTokenKey(null), 850);
    return () => clearTimeout(timer);
  }, [newTokenKey]);
  React.useEffect(() => {
    if (!openKey || typing || localError) return;
    const token = fromTokens.find((item) => tokenKey(item) === openKey);
    if (!token?.userAmount?.trim()) return;
    const timer = setTimeout(
      () => {
        awaitingQuoteSettleRef.current = false;
        setOpenKey(null);
        blurAmountField();
      },
      awaitingQuoteSettleRef.current ? 2000 : 2500,
    );
    return () => clearTimeout(timer);
  }, [openKey, typing, localError, fromTokens]);
  const impact =
    spendUsd.gt(0) && quotedReceiveUsd.gt(0)
      ? spendUsd.minus(quotedReceiveUsd).div(spendUsd)
      : new Decimal(0);
  const highImpact = showQuote && !quotePending && impact.gt("0.03");
  const readFee = (key: string) => {
    const value = feeDetails?.[key];
    if (typeof value !== "string" && typeof value !== "number")
      return undefined;
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
    if (!showQuote || quotePending) return "–";
    if (!value || value.lte(0)) return "$0.00";
    if (value.lt(0.01)) return "<$0.01";
    return formatUsd(value);
  };
  const atCap = fromTokens.length >= maxSourceTokens;

  const quoteLine = (
    <span
      className="nx-amt-line"
      aria-busy={quotePending || showQuoteShimmer}
      style={{
        opacity: quoteMotion.stale ? 0.45 : 1,
        transition: "opacity 150ms ease-out",
      }}
    >
      {showQuoteShimmer ? (
        <span
          className="nx-shim"
          style={{ borderRadius: 14, height: 48, width: 188 }}
        />
      ) : (
        <span
          key={quotePending ? "stale" : receiveAmount}
          className={`nx-big${showQuote && !quotePending ? " nx-arrive" : ""}`}
          style={{
            color:
              !showQuote && !openKey ? "var(--nx-ghost, #C4C4C2)" : undefined,
          }}
        >
          <DepositAnimatedAmount
            value={showQuote ? `~${compactAmount(quotedReceive, 3)}` : "~0.00"}
          />
        </span>
      )}
      {showQuoteShimmer ? null : (
        <span className="nx-usd">
          <DepositAnimatedAmount
            value={showQuote ? `≈ ${compactUsd(quotedReceiveUsd)}` : "≈ $0.00"}
          />
        </span>
      )}
      {showQuote && quotedReceive.gte(1_000_000) ? <InfoIcon /> : null}
    </span>
  );

  if (fromTokens.length === 0) {
    return (
      <div
        className={`nx-deposit-screen${slideFromLeft ? " nx-back" : ""}`}
        style={{ width: "100%" }}
      >
        <div className="nx-card">
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
                  <path
                    d="M8.5 3L4.5 7L8.5 11"
                    stroke="var(--nx-ink-2, #3A3A39)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
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
                <svg fill="none" height="13" viewBox="0 0 13 13" width="13">
                  <path
                    d="M3 3L10 10M10 3L3 10"
                    stroke="var(--nx-ink-2, #3A3A39)"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
            ) : null}
          </div>
          <div style={{ height: 420, maxHeight: "60vh" }}>
            <DepositAssetSelector
              tokens={availableTokens}
              isBalanceLoading={isBalanceLoading}
              minBalanceUsd={1}
              onSelect={(token) => onSelectAvailableToken?.(token)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`nx-deposit-screen${slideFromLeft ? " nx-back" : ""}${isEditingEmptyAmount ? " nx-focus" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
      }}
    >
      <div className="nx-card">
        <div
          className="nx-head"
          style={{
            borderBottom: "1px solid var(--nx-line-2, #EDEDED)",
            gap: 8,
          }}
        >
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
              <path
                d="M8.5 3L4.5 7L8.5 11"
                stroke="var(--nx-ink-2, #3A3A39)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
            </svg>
          </button>
          <div
            style={{
              color: "var(--nx-ink, #161615)",
              flex: 1,
              font: `500 18px/22px ${displayFont}`,
              letterSpacing: "-0.01em",
              minWidth: 0,
            }}
          >
            Deposit {toToken?.symbol || ""}
          </div>
          {onOpenHistory ? (
            <button
              aria-label="Transaction history"
              onClick={onOpenHistory}
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
              <svg fill="none" height="15" viewBox="0 0 15 15" width="15">
                <path
                  d="M2.6 7.5a4.9 4.9 0 1 0 1.45-3.47M2.4 2.3v2.4h2.4M7.5 4.9v2.8l1.9 1.2"
                  stroke="var(--nx-ink-2, #3A3A39)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.4"
                />
              </svg>
            </button>
          ) : null}
          <span
            style={{
              alignItems: "center",
              background: "var(--nx-fill, #F3F3F3)",
              borderRadius: 999,
              color: "var(--nx-ink, #161615)",
              display: "inline-flex",
              font: `500 13px/16px ${uiFont}`,
              gap: 5,
              height: 32,
              opacity: showQuote ? 1 : 0.45,
              padding: "0 8px",
            }}
          >
            <svg
              fill="none"
              height="14"
              style={{ transform: "rotate(-90deg)" }}
              viewBox="0 0 14 14"
              width="14"
            >
              <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="var(--nx-ring, #CFCFCD)"
                strokeWidth="1.6"
              />
              <circle
                cx="7"
                cy="7"
                fill="none"
                r="5.5"
                stroke="var(--nx-blue, #006BF4)"
                strokeDasharray="34.56"
                strokeDashoffset={
                  34.56 * (1 - Math.max(0, Math.min(1, quoteProgress)))
                }
                strokeLinecap="round"
                strokeWidth="1.6"
                style={{ transition: "stroke-dashoffset 250ms linear" }}
              />
            </svg>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {quoteLabel}
            </span>
          </span>
          {onClose ? (
            <button
              aria-label="Close"
              onClick={onClose}
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
              <svg fill="none" height="13" viewBox="0 0 13 13" width="13">
                <path
                  d="M3 3L10 10M10 3L3 10"
                  stroke="var(--nx-ink-2, #3A3A39)"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="nx-hero nx-focusable">
          <div className="nx-who">{destinationLabel} receives</div>
          {showQuote && quotedReceive.gte(1_000_000) ? (
            <Tip label="Exact amount" trigger={quoteLine}>
              <TipRow
                label="Exact amount"
                value={`${formatTokenAmount(quotedReceive, toToken?.decimals)} ${toToken?.symbol ?? ""}`}
              />
            </Tip>
          ) : (
            quoteLine
          )}
          <div className="nx-meta">
            {showQuoteShimmer ? (
              <span
                style={{ alignItems: "center", display: "inline-flex", gap: 8 }}
              >
                <span
                  style={{
                    background: "var(--nx-blue, #006BF4)",
                    borderRadius: 4,
                    height: 14,
                    width: 14,
                  }}
                />
                Finding the best route...
              </span>
            ) : toToken ? (
              <>
                <TokenLogo
                  label={toToken.symbol}
                  size={20}
                  src={toToken.logo}
                />
                <span>{toToken.symbol}</span>
                <span>on</span>
                <TokenLogo
                  label={toToken.chainName}
                  size={20}
                  src={
                    toToken.chainLogo ||
                    (toToken.chainId
                      ? CHAIN_METADATA[toToken.chainId]?.logo
                      : undefined)
                  }
                />
                <span>{toToken.chainName}</span>
              </>
            ) : null}
          </div>
          {highImpact ? (
            <div className="nx-warn">
              High price impact. You may receive less than expected.
            </div>
          ) : null}
        </div>
        <div className="nx-swap-div" />
        <div className="nx-spend nx-focusable">
          <span>Your Spend</span>
          <span className="nx-tnum">
            <DepositAnimatedAmount value={formatUsd(spendUsd)} />
          </span>
          <span className="nx-spend-label">Total</span>
        </div>
        <div className="nx-plist">
          {displayedTokens.map(({ token, exiting }) => {
            const index = fromTokens.findIndex(
              (item) => tokenKey(item) === tokenKey(token),
            );
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
                className={`nx-token-presence${exiting ? " exiting" : key === newTokenKey ? " entering" : ""}`}
                key={key}
                inert={exiting}
              >
                <div className="nx-token-clip">
                  <div
                    className={`nx-prow${open ? " open" : ""}${typing && open ? " keying" : ""}${error ? " err" : ""}`}
                    key={key}
                    ref={open ? openRowRef : undefined}
                  >
                    <div className="nx-pr-top" onClick={() => setOpenKey(key)}>
                      <button
                        className="nx-pr-tok"
                        type="button"
                        aria-label={`Change ${token.symbol} on ${token.chainName}`}
                        disabled={isSourcePickerDisabled || isAmountReadOnly}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenSourcePicker(index);
                        }}
                      >
                        <LogoPair token={token} />
                        <span>
                          <span className="nx-nm">
                            {token.symbol}
                            <svg
                              fill="none"
                              height="12"
                              viewBox="0 0 12 12"
                              width="12"
                            >
                              <path
                                d="M3 4.5L6 7.5L9 4.5"
                                stroke="var(--nx-mute-2, #8C8C8B)"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                              />
                            </svg>
                          </span>
                          <span className="nx-ch">{token.chainName}</span>
                        </span>
                      </button>
                      <div className="nx-pr-amt">
                        <div
                          key={token.userAmountMode}
                          className={`nx-pr-val nx-mode-change${open ? " open" : ""}`}
                          style={{ justifyContent: "flex-end" }}
                        >
                          <DepositAmountInput
                            aria-label={`${token.symbol} amount`}
                            inputMode="decimal"
                            prefix={
                              usdMode ? (
                                <span
                                  style={{
                                    color: error
                                      ? "var(--nx-red, #D93636)"
                                      : shown
                                        ? "var(--nx-ink, #161615)"
                                        : "var(--nx-ghost, #C4C4C2)",
                                    font: open
                                      ? `400 36px/40px ${uiFont}`
                                      : `500 20px/28px ${uiFont}`,
                                    letterSpacing: open ? "-0.03em" : "-0.02em",
                                    lineHeight: open ? "40px" : "28px",
                                    userSelect: "none",
                                  }}
                                >
                                  $
                                </span>
                              ) : null
                            }
                            onChange={(event) => {
                              markTyping();
                              updateToken(index, {
                                userAmount: sanitizeAmount(
                                  event.target.value,
                                  usdMode
                                    ? 2
                                    : Math.min(token.decimals || 8, 8),
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
                              textAlign: "right",
                            }}
                            value={shown}
                          />
                        </div>
                        <div className="nx-pr-sub">
                          <DepositAnimatedAmount value={secondary} />
                          <button
                            aria-label={
                              usdMode
                                ? `Enter in ${token.symbol}`
                                : "Enter in dollars"
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              const nextUsd = !usdMode;
                              const nextAmount = nextUsd
                                ? tokenUsd(token, units)
                                    .toDecimalPlaces(2)
                                    .toFixed()
                                : formatTokenAmount(units, token.decimals);
                              updateToken(index, {
                                userAmount: units.gt(0) ? nextAmount : "",
                                userAmountMode: nextUsd ? "usd" : "token",
                              });
                            }}
                            style={{
                              alignItems: "center",
                              background: "transparent",
                              border: "none",
                              color: "var(--nx-mute, #737372)",
                              cursor: "pointer",
                              display: "inline-flex",
                              justifyContent: "center",
                              lineHeight: 1,
                              padding: 0,
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
                          removeToken(token, index);
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
                          <span
                            className="nx-mode-change"
                            key={token.userAmountMode}
                          >
                            {balanceLabel}
                          </span>
                          {[20, 50, 100].map((pct) => (
                            <button
                              key={pct}
                              onClick={(event) => {
                                event.stopPropagation();
                                markTyping();
                                const balance = readDecimal(token.balance);
                                const buffer = gasBuffer(token);
                                const nextUnits =
                                  pct === 100
                                    ? Decimal.max(balance.minus(buffer), 0)
                                    : balance.mul(pct).div(100);
                                const nextAmount = usdMode
                                  ? tokenUsd(token, nextUnits)
                                      .toDecimalPlaces(2)
                                      .toFixed()
                                  : formatTokenAmount(
                                      nextUnits,
                                      token.decimals,
                                    );
                                updateToken(index, {
                                  userAmount: nextAmount,
                                  userAmountMode: usdMode ? "usd" : "token",
                                });
                              }}
                              style={{
                                background: "var(--nx-pop, #FFFFFF)",
                                border: "none",
                                borderRadius: "999px",
                                boxShadow:
                                  "var(--nx-pop-ring, #1616150A) 0 0 0 1px",
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
                        {error ? (
                          <div className="nx-pr-err">{error}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            className={`nx-add${atCap ? " full" : ""}`}
            aria-expanded={atCap ? capNote : undefined}
            aria-label={atCap ? "Token limit: show details" : undefined}
            disabled={isSourcePickerDisabled}
            onClick={() => {
              if (!atCap) {
                onOpenSourcePicker();
                return;
              }
              setCapNote(true);
              if (capTimer.current) clearTimeout(capTimer.current);
              capTimer.current = setTimeout(() => setCapNote(false), 3500);
            }}
            type="button"
          >
            <span className="nx-plus">
              <svg fill="none" height="14" viewBox="0 0 14 14" width="14">
                <path
                  d="M7 2.5V11.5M2.5 7H11.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.75"
                />
              </svg>
            </span>
            Add another token
          </button>
          <div
            className={`nx-collapse${atCap && capNote ? " on" : ""}`}
            inert={!atCap || !capNote}
            aria-hidden={!atCap || !capNote}
          >
            <div>
              <div className="nx-cap" role="status">
                You can add up to {maxSourceTokens} tokens. Remove one to add
                another.
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="nx-fees nx-focusable"
        style={{
          opacity: quoteMotion.stale ? 0.45 : undefined,
          transition: "opacity 150ms ease-out",
        }}
      >
        <div>
          Fees (Est){" "}
          {showQuoteShimmer ? (
            <span className="nx-shim" style={{ height: 14, width: 48 }} />
          ) : (
            <b>
              {quoteMotion.value?.feeUsd
                ? formatUsd(readDecimal(quoteMotion.value.feeUsd))
                : "$0.00"}
            </b>
          )}
          <Tip align="start" label="Fee breakdown">
            <TipRow
              label="Network fees:"
              value={formatFeeLine(networkFeeUsd)}
            />
            <TipRow label="Solver fees:" value={formatFeeLine(solverFeeUsd)} />
            <TipRow
              label="Protocol fees:"
              value={formatFeeLine(protocolFeeUsd)}
            />
          </Tip>
        </div>
        <div>
          Max Slippage <span className="nx-auto">Auto</span>
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
                        spendUsd
                          .minus(quotedReceiveUsd)
                          .minus(readDecimal(feeUsd)),
                        0,
                      ),
                    )
                  : "–"
              }
            />
          </Tip>
        </div>
      </div>
      {!localError && routeMessage ? (
        <div className="nx-pr-err">{routeMessage}</div>
      ) : null}
    </div>
  );
}
