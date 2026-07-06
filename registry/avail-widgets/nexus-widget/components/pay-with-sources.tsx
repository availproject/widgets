// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import Decimal from "decimal.js";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { type SwapTokenOption } from "./swap-asset-selector";

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
    <div style={{ flexShrink: 0, height: 40, position: "relative", width: 40 }}>
      <TokenLogo label={token.symbol} size={40} src={token.logo} />
      {token.chainLogo && (
        <TokenLogo
          label={token.chainName}
          size={16}
          src={token.chainLogo}
          style={{
            bottom: -1,
            outline: "1.5px solid #FFFFFE",
            position: "absolute",
            right: -1,
          }}
        />
      )}
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

export function PayWithSources({
  fromTokens,
  onOpenSourcePicker,
  routeStatus,
  routeMessage,
  showAutoBadge = true,
  isSourcePickerDisabled = false,
  reserveSourceRows = false,
}: {
  fromTokens: SwapTokenOption[];
  onOpenSourcePicker: () => void;
  routeStatus?: "loading" | "insufficient";
  routeMessage?: string;
  showAutoBadge?: boolean;
  isSourcePickerDisabled?: boolean;
  reserveSourceRows?: boolean;
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
        borderRadius: "14px",
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
            alignItems: "center",
            color: muted,
            display: "flex",
            fontFamily: uiFont,
            fontSize: "12px",
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
          {showAutoBadge ? autoBadge : null}
        </div>
        {shouldShowSourceSummary && (
          <button
            disabled={isSourcePickerDisabled}
            onClick={onOpenSourcePicker}
            style={{
              backgroundColor: isSourcePickerDisabled ? "#F4F4F3" : "#E8F0FF",
              border: "none",
              borderRadius: "4px",
              color: isSourcePickerDisabled ? "#A8A8A6" : brand,
              cursor: isSourcePickerDisabled ? "not-allowed" : "pointer",
              fontFamily: uiFont,
              fontSize: "12px",
              fontWeight: 500,
              lineHeight: "20px",
              opacity: isSourcePickerDisabled ? 0.75 : 1,
              padding: "8px 12px",
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
              fontSize: "14px",
              gap: "6px",
              lineHeight: "20px",
            }}
          >
            <Loader2
              className="animate-spin"
              style={{ height: 14, width: 14 }}
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
              gap: shouldShowSourceSummary ? "14px" : undefined,
              maxHeight: shouldScroll ? "220px" : undefined,
              minHeight:
                reserveSourceRows && !shouldScroll ? "162px" : undefined,
              overflowY: shouldScroll ? "auto" : undefined,
              paddingRight: shouldScroll ? "8px" : 0,
            }}
          >
            {fromTokens.map((token, index) => (
              <div
                key={`${token.contractAddress}-${token.chainId ?? "unified"}-${index}`}
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: "14px",
                  justifyContent: "space-between",
                  minHeight: "44px",
                }}
              >
                <div
                  key={`${token.contractAddress}-${token.chainId ?? "unified"}-${index}`}
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: "14px",
                    minWidth: 0,
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
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
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
                        {token.isUnified
                          ? "Unified balance"
                          : `on ${token.chainName || "Unknown chain"}`}
                      </span>
                    </div>
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
                      fontSize: "14px",
                      fontWeight: 500,
                      lineHeight: "18px",
                    }}
                  >
                    {formatToken(token.userAmount || token.balance)}{" "}
                    {token.symbol}
                  </span>
                  <span
                    style={{
                      color: muted,
                      fontFamily: uiFont,
                      fontSize: "12px",
                      lineHeight: "18px",
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
            fontSize: "14px",
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
            fontSize: "14px",
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
