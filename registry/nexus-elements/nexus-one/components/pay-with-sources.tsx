import React, { useRef, useState } from "react";
import Decimal from "decimal.js";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { type SwapTokenOption } from "./swap-asset-selector";

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
}: {
  fromTokens: SwapTokenOption[];
  onOpenSourcePicker: () => void;
  routeStatus?: "loading" | "insufficient";
  routeMessage?: string;
  showAutoBadge?: boolean;
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
            lineHeight: "18px",
            textTransform: "uppercase",
          }}
        >
          <span>
            Pay With{shouldShowSourceSummary ? ` · ${fromTokens.length} assets` : ""}
          </span>
          {showAutoBadge ? autoBadge : null}
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
              fontSize: "12px",
              fontWeight: 500,
              lineHeight: "16px",
              padding: "7px 10px",
            }}
            type="button"
          >
            Edit
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
              fontSize: "13px",
              gap: "6px",
            }}
          >
            <Loader2 className="animate-spin" style={{ height: 13, width: 13 }} />
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
                      fontSize: "13px",
                    }}
                  >
                    {formatToken(token.userAmount || token.balance)} {token.symbol}
                  </span>
                  <span
                    style={{
                      color: muted,
                      fontFamily: uiFont,
                      fontSize: "12px",
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
