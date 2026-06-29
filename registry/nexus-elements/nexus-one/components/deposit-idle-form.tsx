// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import Decimal from "decimal.js";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { PayWithSources as SharedPayWithSources } from "./pay-with-sources";
import {
  formatSelectedTokenBalanceLabel,
  formatUsdBalanceLabel,
  type SwapTokenOption,
} from "./swap-asset-selector";

interface DepositIdleFormProps {
  amount: string;
  amountMode: "token" | "usd";
  calculatingPercent?: number | null;
  fromTokens: SwapTokenOption[];
  isAmountReadOnly?: boolean;
  isCalculatingMax?: boolean;
  isQuoteRefreshing?: boolean;
  isSourcePickerDisabled?: boolean;
  isTokenPickerDisabled?: boolean;
  hideDestinationTokenDropdownIcon?: boolean;
  onAmountChange: (val: string) => void;
  onAmountModeToggle: () => void;
  onOpenSourcePicker: () => void;
  onOpenTokenPicker?: () => void;
  onSetPercent: (pct: number) => void;
  reserveSourceRows?: boolean;
  routeMessage?: string;
  routeStatus?: "loading" | "insufficient";
  showAutoBadge?: boolean;
  tokenValue: string;
  toToken?: SwapTokenOption;
  totalBalance: string;
  usdValue: string;
}

const uiFont = '"Geist", system-ui, sans-serif';
const primary = "#161615";
const muted = "#848483";
const border = "#E8E8E7";
const brand = "var(--foreground-brand, #006BF4)";

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

const formatToken = (value: unknown) => {
  const amount = parseDecimal(value) ?? new Decimal(0);
  return amount.toDecimalPlaces(8).toFixed();
};

const formatUsd = (value: unknown) => {
  const amount = parseDecimal(value) ?? new Decimal(0);
  if (amount.gt(0) && amount.lt(0.01)) return "<$0.01";
  return `$${amount.toDecimalPlaces(2).toFixed()}`;
};

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

const sanitizeAmountInput = (raw: string, maxDecimals: number) => {
  let next = raw.replaceAll(/[^0-9.]/g, "");
  const parts = next.split(".");
  if (parts.length > 2) next = parts[0] + "." + parts.slice(1).join("");
  const [integerPart, decimalPart] = next.split(".");
  if (decimalPart !== undefined) {
    next = `${integerPart}.${decimalPart.slice(0, Math.max(0, maxDecimals))}`;
  }
  if (next === ".") next = "0.";
  return next;
};

function TokenLogo({
  src,
  label,
  size = 30,
  fontSize = 12,
  style,
}: {
  src?: string;
  label?: string;
  size?: number;
  fontSize?: number;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(!src);

  React.useEffect(() => {
    setFailed(!src);
  }, [src]);

  if (!failed && src) {
    return (
      <img
        alt={label || ""}
        onError={() => setFailed(true)}
        src={src}
        style={{
          backgroundColor: "#FFFFFE",
          borderRadius: "999px",
          height: size,
          objectFit: "cover",
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
        backgroundColor: "#E8F0FF",
        borderRadius: "999px",
        color: brand,
        display: "flex",
        fontFamily: uiFont,
        fontSize,
        fontWeight: 700,
        height: size,
        justifyContent: "center",
        width: size,
        ...style,
      }}
    >
      {(label || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function SourceLogoPair({ token }: { token: SwapTokenOption }) {
  return (
    <div style={{ flexShrink: 0, height: 32, position: "relative", width: 32 }}>
      <TokenLogo label={token.symbol} size={32} src={token.logo} />
      {token.chainLogo && (
        <TokenLogo
          label={token.chainName}
          size={14}
          src={token.chainLogo}
          style={{
            bottom: -2,
            outline: "1px solid #FFFFFE",
            position: "absolute",
            right: -2,
          }}
        />
      )}
    </div>
  );
}

function PercentButtons({
  visible,
  onSelect,
  maxLabel = "Max",
}: {
  visible: boolean;
  onSelect: (pct: number) => void;
  maxLabel?: string;
}) {
  const [hoveredPct, setHoveredPct] = React.useState<number | null>(null);

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
        width: "108px",
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
              fontSize: "10.5px",
              fontWeight: 500,
              height: "20px",
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

function SkeletonRow() {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <div
        className="animate-pulse"
        style={{
          background:
            "linear-gradient(90deg, #F0F0EF 0%, #F7F7F6 48%, #F0F0EF 100%)",
          backgroundSize: "200% 100%",
          borderRadius: "6px",
          height: "32px",
          width: "128px",
        }}
      />
      <div
        className="animate-pulse"
        style={{
          background:
            "linear-gradient(90deg, #F0F0EF 0%, #F7F7F6 48%, #F0F0EF 100%)",
          backgroundSize: "200% 100%",
          borderRadius: "999px",
          height: "32px",
          width: "108px",
        }}
      />
    </div>
  );
}

function PayWithSources({
  fromTokens,
  onOpenSourcePicker,
  routeStatus,
  routeMessage,
}: {
  fromTokens: SwapTokenOption[];
  onOpenSourcePicker: () => void;
  routeStatus?: "loading" | "insufficient";
  routeMessage?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isRouteLoading = routeStatus === "loading";
  const shouldShowSourceSummary = !isRouteLoading && fromTokens.length > 0;
  const shouldScroll = shouldShowSourceSummary && fromTokens.length > 3;
  const autoBadge = (
    <span
      style={{
        border: `1px solid ${brand}`,
        borderRadius: "999px",
        color: brand,
        fontFamily: uiFont,
        fontSize: "9px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        lineHeight: "14px",
        padding: "1px 5px",
      }}
    >
      AUTO
    </span>
  );

  return (
    <div
      style={{
        backgroundColor: "#FFFFFE",
        border: `1px solid ${border}`,
        borderRadius: "12px",
        boxShadow: "#1616150A 0px 1px 2px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "14px",
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
          style={{
            alignItems: "center",
            color: muted,
            display: "flex",
            fontFamily: uiFont,
            fontSize: "14px",
            fontWeight: 500,
            gap: "6px",
            letterSpacing: "0.08em",
            lineHeight: "20px",
            textTransform: "uppercase",
          }}
        >
          <span>
            Pay With
            {shouldShowSourceSummary ? ` · ${fromTokens.length} assets` : ""}
          </span>
          {autoBadge}
        </div>
        {shouldShowSourceSummary && (
          <button
            onClick={onOpenSourcePicker}
            style={{
              backgroundColor: "#F4F7FE",
              border: "none",
              borderRadius: "6px",
              color: brand,
              cursor: "pointer",
              fontFamily: uiFont,
              fontSize: "14px",
              fontWeight: 500,
              lineHeight: "16px",
              padding: "7px 10px",
            }}
          >
            Edit tokens
          </button>
        )}
      </div>

      {isRouteLoading ? (
        <>
          <SkeletonRow />
          <div
            style={{
              alignItems: "center",
              color: brand,
              display: "flex",
              fontFamily: uiFont,
              fontSize: "15px",
              gap: "6px",
            }}
          >
            <Loader2
              className="animate-spin"
              style={{ height: 13, width: 13 }}
            />
            Calculating best route...
          </div>
        </>
      ) : shouldShowSourceSummary ? (
        <div style={{ position: "relative" }}>
          <div
            ref={scrollRef}
            style={{
              display: "flex",
              flexDirection: "column",
              maxHeight: shouldScroll ? "184px" : undefined,
              overflowY: shouldScroll ? "auto" : undefined,
              paddingRight: shouldScroll ? "6px" : 0,
            }}
          >
            {fromTokens.map((token, index) => (
              <div
                key={`${token.contractAddress}-${token.chainId ?? "unified"}-${index}`}
                style={{
                  alignItems: "center",
                  borderTop: index === 0 ? "none" : "1px solid #F0F0EF",
                  display: "flex",
                  justifyContent: "space-between",
                  minHeight: "52px",
                  padding: "6px 0",
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
                  <SourceLogoPair token={token} />
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
                        fontFamily: uiFont,
                        fontSize: "16px",
                        fontWeight: 600,
                      }}
                    >
                      {token.symbol}
                    </span>
                    <span
                      style={{
                        color: muted,
                        fontFamily: uiFont,
                        fontSize: "14px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {token.isUnified
                        ? "Unified balance"
                        : `on ${token.chainName || "Unknown chain"}`}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                    textAlign: "right",
                  }}
                >
                  <span
                    style={{
                      color: primary,
                      fontFamily: uiFont,
                      fontSize: "15px",
                    }}
                  >
                    {formatToken(token.userAmount || token.balance)}{" "}
                    {token.symbol}
                  </span>
                  <span
                    style={{
                      color: muted,
                      fontFamily: uiFont,
                      fontSize: "14px",
                    }}
                  >
                    {formatUsd(token.userAmountUsd || token.balanceInFiat)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {shouldScroll && (
            <button
              aria-label="Scroll payment sources"
              onClick={() =>
                scrollRef.current?.scrollBy({ behavior: "smooth", top: 64 })
              }
              style={{
                alignItems: "center",
                background: "#FFFFFE",
                border: `1px solid ${border}`,
                borderRadius: "999px",
                bottom: "4px",
                boxShadow: "0 2px 8px rgba(22,22,21,0.08)",
                cursor: "pointer",
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
              <ChevronDown style={{ color: muted, height: 14, width: 14 }} />
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            color: primary,
            fontFamily: uiFont,
            fontSize: "15px",
            lineHeight: "20px",
          }}
        >
          Sources will be auto selected
        </div>
      )}

      {routeStatus === "insufficient" && routeMessage && (
        <div
          style={{
            alignItems: "center",
            color: "#D32F2F",
            display: "flex",
            fontFamily: uiFont,
            fontSize: "15px",
            gap: "8px",
            lineHeight: "20px",
          }}
        >
          <AlertCircle style={{ flexShrink: 0, height: 15, width: 15 }} />
          {routeMessage}
        </div>
      )}
    </div>
  );
}

export function DepositIdleForm({
  amount,
  amountMode,
  onAmountChange,
  onAmountModeToggle,
  toToken,
  totalBalance,
  usdValue,
  tokenValue,
  fromTokens,
  onOpenSourcePicker,
  onSetPercent,
  routeStatus,
  routeMessage,
  isAmountReadOnly = false,
  isCalculatingMax,
  calculatingPercent,
  isQuoteRefreshing,
  hideDestinationTokenDropdownIcon = false,
  showAutoBadge = true,
  isSourcePickerDisabled = false,
  isTokenPickerDisabled = false,
  onOpenTokenPicker,
  reserveSourceRows = false,
}: DepositIdleFormProps) {
  const [pendingPercent, setPendingPercent] = useState<number | null>(null);
  const [isAmountFocused, setIsAmountFocused] = useState(false);

  React.useEffect(() => {
    if (!isCalculatingMax) setPendingPercent(null);
  }, [isCalculatingMax]);

  const handlePercentSelect = (pct: number) => {
    setPendingPercent(pct);
    onSetPercent(pct);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAmountReadOnly) return;
    onAmountChange(
      sanitizeAmountInput(
        e.target.value,
        isUsdMode ? MAX_AMOUNT_DISPLAY_DECIMALS : getTokenInputDecimals(toToken)
      )
    );
  };
  const isUsdMode = amountMode === "usd";
  const amountDisplayValue = isAmountFocused
    ? amount
    : formatAmountInputDisplay(amount);
  const showTokenPickerDropdownIcon =
    Boolean(onOpenTokenPicker) &&
    !isTokenPickerDisabled &&
    !hideDestinationTokenDropdownIcon;
  const activePendingPercent =
    calculatingPercent ?? (isCalculatingMax ? pendingPercent : null);
  const isMaxCalculating = Boolean(
    isCalculatingMax && activePendingPercent === 100
  );
  const destinationBalanceLabel = isUsdMode
    ? formatUsdBalanceLabel(toToken?.balanceInFiat)
    : formatSelectedTokenBalanceLabel(toToken) ||
      `0 ${toToken?.symbol || ""}`.trim();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "100%",
      }}
    >
      <div
        className="nexus-focus-container"
        style={{
          backgroundColor: "#FFFFFE",
          borderColor: border,
          borderRadius: "10px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#1616150A 0px 1px 2px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "12px 11px",
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
            style={{
              color: muted,
              fontFamily: uiFont,
              fontSize: "10.5px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              lineHeight: "16px",
              textTransform: "uppercase",
            }}
          >
            Deposit
          </div>
          <div style={{ alignItems: "center", display: "flex", gap: "4px" }}>
            <span
              style={{
                color: muted,
                fontFamily: uiFont,
                fontSize: "11px",
                lineHeight: "15px",
              }}
            >
              Total Balance:
            </span>
            <span
              style={{
                color: primary,
                fontFamily: uiFont,
                fontSize: "11px",
                fontWeight: 600,
                lineHeight: "15px",
              }}
            >
              ${totalBalance}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: "10px",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div
              style={{
                alignItems: "baseline",
                display: "flex",
                flex: "1 1 0%",
                minWidth: 0,
              }}
            >
              {isMaxCalculating ? (
                <div
                  aria-label="Calculating max amount"
                  className="animate-pulse"
                  style={{
                    alignSelf: "center",
                    backgroundColor: "#F0F0EF",
                    borderRadius: "8px",
                    height: "34px",
                    maxWidth: "220px",
                    minWidth: "132px",
                    width: "62%",
                  }}
                />
              ) : (
                <>
                  {isUsdMode && amount && (
                    <span
                      style={{
                        color: primary,
                        fontFamily:
                          '"Delight-Medium", "Delight", system-ui, sans-serif',
                        fontSize: "28px",
                        fontWeight: 500,
                        lineHeight: "34px",
                      }}
                    >
                      $
                    </span>
                  )}
                  <input
                    aria-readonly={isAmountReadOnly}
                    onBlur={() => setIsAmountFocused(false)}
                    onChange={handleInput}
                    onFocus={() => setIsAmountFocused(true)}
                    placeholder="0"
                    style={{
                      background: "transparent",
                      border: "none",
                      boxSizing: "border-box",
                      color: amount ? primary : "#9E9E9C",
                      cursor: isAmountReadOnly ? "default" : "text",
                      fontFamily:
                        '"Delight-Medium", "Delight", system-ui, sans-serif',
                      fontSize: "30px",
                      fontWeight: 500,
                      lineHeight: "35px",
                      minWidth: 0,
                      outline: "none",
                      padding: 0,
                      width: "100%",
                    }}
                    readOnly={isAmountReadOnly}
                    type="text"
                    value={amountDisplayValue}
                  />
                </>
              )}
              {isCalculatingMax && !isMaxCalculating && (
                <Loader2
                  className="animate-spin"
                  style={{
                    alignSelf: "center",
                    color: brand,
                    flexShrink: 0,
                    height: 18,
                    marginLeft: 6,
                    width: 18,
                  }}
                />
              )}
            </div>

            <div
              onClick={
                onOpenTokenPicker && !isTokenPickerDisabled
                  ? onOpenTokenPicker
                  : undefined
              }
              role={
                onOpenTokenPicker && !isTokenPickerDisabled
                  ? "button"
                  : undefined
              }
              tabIndex={
                onOpenTokenPicker && !isTokenPickerDisabled ? 0 : undefined
              }
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFE",
                borderColor: border,
                borderRadius: "999px",
                borderStyle: "solid",
                borderWidth: "1px",
                boxShadow: "#1616150A 0px 1px 2px",
                boxSizing: "border-box",
                cursor:
                  onOpenTokenPicker && !isTokenPickerDisabled
                    ? "pointer"
                    : "default",
                display: "inline-flex",
                flexShrink: 0,
                gap: "6px",
                paddingBottom: "3px",
                paddingLeft: toToken ? "3px" : "7px",
                paddingRight: "8px",
                paddingTop: "3px",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  height: "20px",
                  position: "relative",
                  width: "20px",
                }}
              >
                <TokenLogo
                  label={toToken?.symbol}
                  size={20}
                  src={toToken?.logo}
                />
                {toToken?.chainLogo && (
                  <TokenLogo
                    label={toToken.chainName}
                    size={10}
                    src={toToken.chainLogo}
                    style={{
                      bottom: -2,
                      outline: "1px solid #FFFFFE",
                      position: "absolute",
                      right: -2,
                      width: 10,
                      height: 10,
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  color: primary,
                  fontFamily: uiFont,
                  fontSize: toToken ? "12px" : "14px",
                  fontWeight: 500,
                  lineHeight: toToken ? "16px" : "20px",
                }}
              >
                {toToken?.symbol || "Token"}
              </div>
              {showTokenPickerDropdownIcon && (
                <ChevronDown
                  style={{ color: "#5B5B5A", height: 12, width: 12 }}
                />
              )}
            </div>
          </div>

          <div
            style={{
              alignItems: "center",
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
              <button
                disabled={isAmountReadOnly}
                onClick={onAmountModeToggle}
                style={{
                  background: "transparent",
                  border: "none",
                  color: isAmountReadOnly ? "#A8A8A6" : muted,
                  cursor: isAmountReadOnly ? "default" : "pointer",
                  fontFamily: uiFont,
                  fontSize: "11px",
                  lineHeight: "15px",
                  padding: 0,
                }}
                type="button"
              >
                {isUsdMode
                  ? `≈ ${tokenValue || "0"} ${toToken?.symbol || ""} ↕`
                  : `≈ $${usdValue || "0"} ↕`}
              </button>
            </div>

            <div
              style={{
                alignItems: "center",
                display:
                  toToken && isAmountFocused && !isAmountReadOnly
                    ? "flex"
                    : "none",
                justifyContent: "center",
                pointerEvents:
                  toToken && isAmountFocused && !isAmountReadOnly
                    ? "auto"
                    : "none",
              }}
            >
              {toToken && !isAmountReadOnly && (
                <PercentButtons
                  onSelect={handlePercentSelect}
                  visible={Boolean(toToken) && isAmountFocused}
                />
              )}
            </div>

            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "flex-end",
                gap: "5px",
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: "#7C7C7A",
                  fontFamily: uiFont,
                  fontSize: "11px",
                  lineHeight: "15px",
                  whiteSpace: "nowrap",
                }}
              >
                Bal:
              </span>
              <span
                style={{
                  color: primary,
                  fontFamily: uiFont,
                  fontSize: "11px",
                  fontWeight: 500,
                  lineHeight: "15px",
                  whiteSpace: "nowrap",
                }}
              >
                {destinationBalanceLabel}
              </span>
            </div>
          </div>

          {/* Percent buttons moved next to balance */}
        </div>
      </div>

      <SharedPayWithSources
        fromTokens={fromTokens}
        isSourcePickerDisabled={isSourcePickerDisabled}
        onOpenSourcePicker={onOpenSourcePicker}
        reserveSourceRows={reserveSourceRows}
        routeMessage={routeMessage}
        routeStatus={routeStatus}
        showAutoBadge={showAutoBadge}
      />
    </div>
  );
}
