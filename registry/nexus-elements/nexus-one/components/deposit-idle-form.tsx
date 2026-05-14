import React, { useRef, useState } from "react";
import Decimal from "decimal.js";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { PayWithSources as SharedPayWithSources } from "./pay-with-sources";
import { type SwapTokenOption } from "./swap-asset-selector";

interface DepositIdleFormProps {
  amount: string;
  amountMode: "token" | "usd";
  onAmountChange: (val: string) => void;
  onAmountModeToggle: () => void;
  toToken?: SwapTokenOption;
  totalBalance: string;
  usdValue: string;
  tokenValue: string;
  fromTokens: SwapTokenOption[];
  onOpenSourcePicker: () => void;
  onSetPercent: (pct: number) => void;
  routeStatus?: "loading" | "insufficient";
  routeMessage?: string;
  isCalculatingMax?: boolean;
  isQuoteRefreshing?: boolean;
}

const uiFont = '"Geist", system-ui, sans-serif';
const primary = "#161615";
const muted = "#848483";
const border = "#E8E8E7";
const brand = "#006BF4";

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
  const max = amount.abs().gte(1) ? 6 : 8;
  return amount.toDecimalPlaces(max).toFixed();
};

const formatUsd = (value: unknown) => {
  const amount = parseDecimal(value) ?? new Decimal(0);
  if (amount.gt(0) && amount.lt(0.01)) return "<$0.01";
  return `$${amount.toDecimalPlaces(2).toFixed()}`;
};

const MAX_AMOUNT_DISPLAY_DECIMALS = 6;
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

function SkeletonRow() {
  return (
    <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
      <div
        style={{
          background:
            "linear-gradient(90deg, #F0F0EF 0%, #F7F7F6 48%, #F0F0EF 100%)",
          backgroundSize: "200% 100%",
          borderRadius: "6px",
          height: "32px",
          width: "128px",
        }}
        className="animate-pulse"
      />
      <div
        style={{
          background:
            "linear-gradient(90deg, #F0F0EF 0%, #F7F7F6 48%, #F0F0EF 100%)",
          backgroundSize: "200% 100%",
          borderRadius: "999px",
          height: "32px",
          width: "108px",
        }}
        className="animate-pulse"
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
  const shouldScroll = fromTokens.length > 3;
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
        lineHeight: "12px",
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
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
        <div
          style={{
            alignItems: "center",
            color: muted,
            display: "flex",
            fontFamily: uiFont,
            fontSize: "12px",
            fontWeight: 500,
            gap: "6px",
            letterSpacing: "0.08em",
            lineHeight: "18px",
            textTransform: "uppercase",
          }}
        >
          <span>
            Pay With{fromTokens.length > 0 ? ` · ${fromTokens.length} assets` : ""}
          </span>
          {autoBadge}
        </div>
        {fromTokens.length > 0 && (
          <button
            onClick={onOpenSourcePicker}
            style={{
              backgroundColor: "#F4F7FE",
              border: "none",
              borderRadius: "6px",
              color: brand,
              cursor: "pointer",
              fontFamily: uiFont,
              fontSize: "12px",
              fontWeight: 500,
              lineHeight: "16px",
              padding: "7px 10px",
            }}
          >
            Edit
          </button>
        )}
      </div>

      {routeStatus === "loading" ? (
        <>
          <SkeletonRow />
          <div style={{ alignItems: "center", color: brand, display: "flex", fontFamily: uiFont, fontSize: "13px", gap: "6px" }}>
            <Loader2 className="animate-spin" style={{ height: 13, width: 13 }} />
            Calculating best route...
          </div>
        </>
      ) : fromTokens.length > 0 ? (
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
                <div style={{ alignItems: "center", display: "flex", gap: "10px", minWidth: 0 }}>
                  <SourceLogoPair token={token} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                    <span style={{ color: primary, fontFamily: uiFont, fontSize: "14px", fontWeight: 600 }}>
                      {token.symbol}
                    </span>
                    <span
                      style={{
                        color: muted,
                        fontFamily: uiFont,
                        fontSize: "12px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {token.isUnified ? "Unified balance" : `on ${token.chainName || "Unknown chain"}`}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", textAlign: "right" }}>
                  <span style={{ color: primary, fontFamily: uiFont, fontSize: "13px" }}>
                    {formatToken(token.userAmount || token.balance)} {token.symbol}
                  </span>
                  <span style={{ color: muted, fontFamily: uiFont, fontSize: "12px" }}>
                    {formatUsd(token.userAmountUsd || token.balanceInFiat)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {shouldScroll && (
            <button
              aria-label="Scroll payment sources"
              onClick={() => scrollRef.current?.scrollBy({ behavior: "smooth", top: 64 })}
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
            fontSize: "13px",
            lineHeight: "18px",
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
            fontSize: "13px",
            gap: "8px",
            lineHeight: "18px",
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
  isCalculatingMax,
  isQuoteRefreshing,
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
    onAmountChange(
      sanitizeAmountInput(
        e.target.value,
        isUsdMode ? MAX_AMOUNT_DISPLAY_DECIMALS : getTokenInputDecimals(toToken),
      ),
    );
  };
  const isUsdMode = amountMode === "usd";
  const amountDisplayValue = isAmountFocused
    ? amount
    : formatAmountInputDisplay(amount);
  const destinationBalanceLabel =
    toToken?.balance && toToken?.symbol && toToken.balance.includes(toToken.symbol)
      ? toToken.balance
      : `${toToken?.balance || "0"} ${toToken?.symbol || ""}`.trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div
        style={{
          backgroundColor: "#FFFFFE",
          borderColor: border,
          borderRadius: "12px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#1616150A 0px 1px 2px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "15px 14px",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
          <div style={{ color: muted, fontFamily: uiFont, fontSize: "12px", fontWeight: 500, letterSpacing: "0.08em", lineHeight: "20px", textTransform: "uppercase" }}>
            Deposit
          </div>
          <div style={{ alignItems: "center", display: "flex", gap: "4px" }}>
            <span style={{ color: muted, fontFamily: uiFont, fontSize: "13px", lineHeight: "18px" }}>
              Total Balance:
            </span>
            <span style={{ color: primary, fontFamily: uiFont, fontSize: "13px", fontWeight: 600, lineHeight: "18px" }}>
              ${totalBalance}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ alignItems: "center", display: "flex", gap: "10px", justifyContent: "space-between", width: "100%" }}>
            <div style={{ alignItems: "baseline", display: "flex", flex: "1 1 0%", minWidth: 0 }}>
              {isUsdMode && amount && (
                <span style={{ color: primary, fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif', fontSize: "30px", fontWeight: 500, lineHeight: "36px" }}>
                  $
                </span>
              )}
              <input
                type="text"
                placeholder="0"
                value={amountDisplayValue}
                onChange={handleInput}
                onFocus={() => setIsAmountFocused(true)}
                onBlur={() => setIsAmountFocused(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  boxSizing: "border-box",
                  color: amount ? primary : "#9E9E9C",
                  fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
                  fontSize: "32px",
                  fontWeight: 500,
                  lineHeight: "38px",
                  minWidth: 0,
                  outline: "none",
                  padding: 0,
                  width: "100%",
                }}
              />
            </div>

            <div
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFE",
                borderColor: border,
                borderRadius: "999px",
                borderStyle: "solid",
                borderWidth: "1px",
                boxShadow: "#1616150A 0px 1px 2px",
                boxSizing: "border-box",
                display: "inline-flex",
                flexShrink: 0,
                gap: "8px",
                height: "32px",
                paddingLeft: "4px",
                paddingRight: "10px",
              }}
            >
              <div style={{ flexShrink: 0, height: "24px", position: "relative", width: "24px" }}>
                <TokenLogo label={toToken?.symbol} size={24} src={toToken?.logo} />
                {toToken?.chainLogo && (
                  <TokenLogo
                    label={toToken.chainName}
                    size={12}
                    src={toToken.chainLogo}
                    style={{
                      bottom: -2,
                      outline: "1px solid #FFFFFE",
                      position: "absolute",
                      right: -2,
                    }}
                  />
                )}
              </div>
              <div style={{ color: primary, fontFamily: uiFont, fontSize: "15px", fontWeight: 600, lineHeight: "22px" }}>
                {toToken?.symbol || "Token"}
              </div>
            </div>
          </div>

          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <button
              onClick={onAmountModeToggle}
              style={{
                background: "transparent",
                border: "none",
                color: muted,
                cursor: "pointer",
                fontFamily: uiFont,
                fontSize: "13px",
                lineHeight: "18px",
                padding: 0,
              }}
              type="button"
            >
              {isUsdMode
                ? `≈ ${tokenValue || "0"} ${toToken?.symbol || ""} ↕`
                : `≈ $${usdValue || "0"} ↕`}
            </button>
            <div style={{ alignItems: "center", display: "flex", gap: "5px" }}>
              <span style={{ color: "#7C7C7A", fontFamily: uiFont, fontSize: "13px", lineHeight: "18px" }}>
                Balance:
              </span>
              <span style={{ color: primary, fontFamily: uiFont, fontSize: "13px", fontWeight: 500, lineHeight: "18px" }}>
                {destinationBalanceLabel}
              </span>
            </div>
          </div>

          <div
            aria-hidden={!isAmountFocused}
            style={{
              alignItems: "center",
              display: "flex",
              gap: "5px",
              minHeight: "24px",
              opacity: isAmountFocused ? 1 : 0,
              pointerEvents: isAmountFocused ? "auto" : "none",
              transition: "opacity 0.18s ease-out",
              width: "100%",
            }}
          >
            {[25, 50, 75].map((pct) => {
              const isPending = Boolean(isCalculatingMax && pendingPercent === pct);
              return (
              <button
                key={pct}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handlePercentSelect(pct)}
                style={{
                  alignItems: "center",
                  backgroundColor: isPending ? "#E8F0FF" : "#F4F4F3",
                  border: "none",
                  borderRadius: "7px",
                  cursor: "pointer",
                  display: "flex",
                  flex: "1 1 0%",
                  gap: "5px",
                  justifyContent: "center",
                  padding: "4px 7px",
                }}
                tabIndex={isAmountFocused ? 0 : -1}
                type="button"
              >
                {isPending && <Loader2 className="animate-spin" style={{ color: brand, height: 12, width: 12 }} />}
                <span style={{ color: isPending ? brand : "#363635", fontFamily: uiFont, fontSize: "11px", fontWeight: isPending ? 600 : 500, lineHeight: "16px" }}>
                  {pct}%
                </span>
              </button>
              );
            })}
            {(() => {
              const isPending = Boolean(isCalculatingMax && pendingPercent === 100);
              return (
            <button
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handlePercentSelect(100)}
              style={{
                alignItems: "center",
                backgroundColor: isPending ? "#E8F0FF" : "#F4F4F3",
                border: "none",
                borderRadius: "7px",
                cursor: "pointer",
                display: "flex",
                flex: "1 1 0%",
                gap: "5px",
                justifyContent: "center",
                padding: "4px 7px",
              }}
              tabIndex={isAmountFocused ? 0 : -1}
              type="button"
            >
              {isPending && <Loader2 className="animate-spin" style={{ color: brand, height: 12, width: 12 }} />}
              <span style={{ color: isPending ? brand : "#363635", fontFamily: uiFont, fontSize: "11px", fontWeight: isPending ? 600 : 500, letterSpacing: "0.02em", lineHeight: "16px" }}>
                MAX
              </span>
            </button>
              );
            })()}
          </div>
        </div>
      </div>

      <SharedPayWithSources
        fromTokens={fromTokens}
        onOpenSourcePicker={onOpenSourcePicker}
        routeMessage={routeMessage}
        routeStatus={routeStatus}
      />

    </div>
  );
}
