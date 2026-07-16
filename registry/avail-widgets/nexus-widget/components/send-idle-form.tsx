// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import Decimal from "decimal.js";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { PayWithSources as SharedPayWithSources } from "./pay-with-sources";
import { NEXUS_WIDGET_FAST_SPINNER_STYLE } from "../theme";
import {
  formatSelectedTokenBalanceLabel,
  type SwapTokenOption,
} from "./swap-asset-selector";

interface SendIdleFormProps {
  amount: string;
  calculatingPercent?: number | null;
  fromTokens: SwapTokenOption[];
  isAmountReadOnly?: boolean;
  isAssetPickerDisabled?: boolean;
  isBalanceLoading?: boolean;
  isCalculatingMax?: boolean;
  isQuoteRefreshing?: boolean;
  isRecipientLocked?: boolean;
  hideDestinationTokenDropdownIcon?: boolean;
  isSourcePickerDisabled?: boolean;
  onAmountChange: (val: string) => void;
  onOpenAssetPicker: () => void;
  onOpenRecipientPicker: () => void;
  onOpenSourcePicker: () => void;
  onSetPercent: (pct: number) => void;
  recipientAddress: string;
  reserveSourceRows?: boolean;
  routeMessage?: string;
  routeStatus?: "loading" | "insufficient";
  showAutoBadge?: boolean;
  toToken?: SwapTokenOption;
  totalBalance: string;
  usdValue: string;
}

const uiFont = '"Geist", system-ui, sans-serif';
const primary = "#161615";
const muted = "#848483";
const border = "#E8E8E7";
const brand = "var(--foreground-brand)";

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

function ExactOutPercentButtons({
  visible,
  onSelect,
}: {
  visible: boolean;
  onSelect: (pct: number) => void;
}) {
  const [focusedPercent, setFocusedPercent] = useState<number | null>(null);

  React.useEffect(() => {
    if (!visible) setFocusedPercent(null);
  }, [visible]);

  return (
    <div
      style={{
        alignItems: "center",
        boxSizing: "border-box",
        display: "flex",
        gap: "6px",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 0.18s ease-out",
        width: "100%",
      }}
    >
      {[25, 50, 75, 100].map((pct) => {
        const isMax = pct === 100;
        const isFocused = focusedPercent === pct;
        return (
          <button
            key={pct}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(pct);
            }}
            onBlur={() => setFocusedPercent(null)}
            onFocus={() => setFocusedPercent(pct)}
            style={{
              alignItems: "center",
              backgroundColor: isFocused ? "#E8F0FF" : "#F4F4F3",
              border: "none",
              borderRadius: "8px",
              boxSizing: "border-box",
              color: isFocused ? brand : "#363635",
              cursor: "pointer",
              display: "flex",
              flex: "1 1 0%",
              fontFamily: '"Geist", system-ui, sans-serif',
              fontSize: "12px",
              fontWeight: 500,
              justifyContent: "center",
              lineHeight: "20px",
              minWidth: 0,
              paddingBlock: "5px",
              paddingInline: "10px",
            }}
            type="button"
          >
            {isMax ? "MAX" : `${pct}%`}
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
            type="button"
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
              style={{
                ...NEXUS_WIDGET_FAST_SPINNER_STYLE,
                height: 13,
                width: 13,
              }}
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

function BalanceSkeleton({
  height = "16px",
  width = "72px",
}: {
  height?: string;
  width?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className="animate-pulse"
      style={{
        background:
          "linear-gradient(90deg, #F0F0EF 0%, #E6EEFF 48%, #F0F0EF 100%)",
        backgroundSize: "200% 100%",
        borderRadius: "6px",
        display: "inline-block",
        flexShrink: 0,
        height,
        maxWidth: "100%",
        width,
      }}
    />
  );
}

export function SendIdleForm({
  amount,
  onAmountChange,
  toToken,
  fromTokens,
  totalBalance,
  usdValue,
  onOpenAssetPicker,
  onOpenSourcePicker,
  onOpenRecipientPicker,
  recipientAddress,
  onSetPercent,
  routeStatus,
  routeMessage,
  isAmountReadOnly = false,
  isAssetPickerDisabled = false,
  isBalanceLoading = false,
  isCalculatingMax,
  calculatingPercent,
  isQuoteRefreshing,
  isRecipientLocked = false,
  hideDestinationTokenDropdownIcon = false,
  showAutoBadge = true,
  isSourcePickerDisabled = false,
  reserveSourceRows = false,
}: SendIdleFormProps) {
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
      sanitizeAmountInput(e.target.value, getTokenInputDecimals(toToken)),
    );
  };
  const amountDisplayValue = isAmountFocused
    ? amount
    : formatAmountInputDisplay(amount);
  const activePendingPercent =
    calculatingPercent ?? (isCalculatingMax ? pendingPercent : null);
  const isMaxCalculating = Boolean(
    isCalculatingMax && activePendingPercent === 100,
  );

  const destinationBalanceLabel =
    formatSelectedTokenBalanceLabel(toToken) ||
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
        style={{
          alignItems: "start",
          backgroundColor: "#FFFFFE",
          borderColor: border,
          borderRadius: "14px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#1616150A 0px 1px 2px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        <div
          style={{
            alignSelf: "stretch",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            style={{
              boxSizing: "border-box",
              color: muted,
              fontFamily: uiFont,
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              lineHeight: "20px",
              textTransform: "uppercase",
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
                color: brand,
                fontFamily: uiFont,
                fontSize: "16px",
                fontVariantNumeric: "tabular-nums",
                fontWeight: 500,
                lineHeight: "20px",
              }}
            >
              {recipientAddress
                ? `${recipientAddress.slice(0, 6)}…${recipientAddress.slice(-4)}`
                : "Select recipient"}
            </div>
            <button
              disabled={isRecipientLocked}
              onClick={onOpenRecipientPicker}
              style={{
                alignItems: "center",
                backgroundColor: "#E8F0FF",
                border: "none",
                borderRadius: "4px",
                boxSizing: "border-box",
                cursor: isRecipientLocked ? "default" : "pointer",
                display: "flex",
                gap: "4px",
                paddingBlock: "8px",
                paddingInline: "12px",
              }}
              type="button"
            >
              <div
                style={{
                  boxSizing: "border-box",
                  color: isRecipientLocked ? "#6C756F" : brand,
                  fontFamily: uiFont,
                  fontSize: "12px",
                  fontWeight: 500,
                  lineHeight: "20px",
                }}
              >
                {isRecipientLocked ? "Locked" : "Edit"}
              </div>
            </button>
          </div>
        </div>
      </div>

      <div
        className="nexus-focus-container"
        style={{
          backgroundColor: "#FFFFFE",
          borderColor: border,
          borderRadius: "14px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#1616150A 0px 1px 2px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          padding: "16px",
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
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              lineHeight: "20px",
              textTransform: "uppercase",
            }}
          >
            Amount
          </div>
          <div style={{ alignItems: "center", display: "flex", gap: "4px" }}>
            <span
              style={{
                color: muted,
                fontFamily: uiFont,
                fontSize: "14px",
                lineHeight: "20px",
              }}
            >
              Total Balance:
            </span>
            <span
              style={{
                color: primary,
                fontFamily: uiFont,
                fontSize: "14px",
                fontWeight: 600,
                lineHeight: "20px",
              }}
            >
              {isBalanceLoading ? (
                <BalanceSkeleton width="64px" />
              ) : (
                `$${totalBalance}`
              )}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: "12px",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            {isMaxCalculating ? (
              <div
                aria-label="Calculating max amount"
                className="animate-pulse"
                style={{
                  backgroundColor: "#F0F0EF",
                  borderRadius: "8px",
                  flex: "1 1 0%",
                  height: "44px",
                  maxWidth: "220px",
                  minWidth: "132px",
                }}
              />
            ) : (
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
                  color: amount ? primary : "#C8C8C6",
                  cursor: isAmountReadOnly ? "default" : "text",
                  flex: "1 1 0%",
                  fontFamily:
                    '"Delight-Medium", "Delight", system-ui, sans-serif',
                  fontSize: "36px",
                  fontWeight: 500,
                  lineHeight: "44px",
                  minWidth: 0,
                  outline: "none",
                  padding: 0,
                }}
                readOnly={isAmountReadOnly}
                type="text"
                value={amountDisplayValue}
              />
            )}
            {isCalculatingMax && !isMaxCalculating && (
              <Loader2
                className="animate-spin"
                style={{
                  ...NEXUS_WIDGET_FAST_SPINNER_STYLE,
                  color: brand,
                  flexShrink: 0,
                  height: 18,
                  width: 18,
                }}
              />
            )}

            <button
              disabled={isAssetPickerDisabled}
              onClick={onOpenAssetPicker}
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFE",
                borderColor: toToken ? border : "#C8C8C6",
                borderRadius: "999px",
                borderStyle: toToken ? "solid" : "dashed",
                borderWidth: "1px",
                boxShadow: "#1616150A 0px 1px 2px",
                boxSizing: "border-box",
                cursor: isAssetPickerDisabled ? "default" : "pointer",
                display: "inline-flex",
                flexShrink: 0,
                gap: "8px",
                paddingBottom: "5px",
                paddingLeft: toToken ? "5px" : "10px",
                paddingRight: "10px",
                paddingTop: "5px",
              }}
              type="button"
            >
              {toToken ? (
                <div
                  style={{
                    flexShrink: 0,
                    height: "26px",
                    position: "relative",
                    width: "26px",
                  }}
                >
                  <TokenLogo
                    label={toToken.symbol}
                    size={26}
                    src={toToken.logo}
                  />
                  {toToken.chainLogo && (
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
              ) : (
                <div
                  style={{
                    borderColor: "#C8C8C6",
                    borderRadius: "999px",
                    borderStyle: "dashed",
                    borderWidth: "1.5px",
                    boxSizing: "border-box",
                    flexShrink: 0,
                    height: "18px",
                    width: "18px",
                  }}
                />
              )}
              <div
                style={{
                  color: primary,
                  fontFamily: uiFont,
                  fontSize: "16px",
                  fontWeight: 500,
                  lineHeight: "24px",
                }}
              >
                {toToken ? toToken.symbol : "Assets"}
              </div>
              {!hideDestinationTokenDropdownIcon && (
                <ChevronDown
                  style={{
                    color: isAssetPickerDisabled ? "#A8A8A6" : "#5B5B5A",
                    height: 16,
                    width: 16,
                  }}
                />
              )}
            </button>
          </div>

          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              minHeight: "20px",
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
              <div
                style={{
                  color: muted,
                  fontFamily: uiFont,
                  fontSize: "14px",
                  lineHeight: "20px",
                }}
              >
                ≈ ${usdValue || "0"}
              </div>
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
              {toToken && (
                <>
                  <span
                    style={{
                      color: "#7C7C7A",
                      fontFamily: uiFont,
                      fontSize: "14px",
                      lineHeight: "20px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Balance:
                  </span>
                  <span
                    style={{
                      color: primary,
                      fontFamily: uiFont,
                      fontSize: "14px",
                      fontWeight: 500,
                      lineHeight: "20px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isBalanceLoading ? (
                      <BalanceSkeleton width="110px" />
                    ) : (
                      destinationBalanceLabel
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          <ExactOutPercentButtons
            onSelect={handlePercentSelect}
            visible={Boolean(toToken) && !isAmountReadOnly}
          />
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
