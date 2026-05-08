import React, { useState, useRef, useEffect } from "react";
import { type SwapTokenOption } from "./swap-asset-selector";

interface SwapIdleFormProps {
  amount: string;
  onAmountChange: (val: string, panel: "send" | "receive") => void;
  fromTokens: SwapTokenOption[];
  toToken?: SwapTokenOption;
  totalBalance: string;
  receiveBalance?: string;
  usdValue: string;
  onOpenSourcePicker: (index?: number) => void;
  onOpenDestPicker: () => void;
  onOpenRecipientPicker?: () => void;
  recipientAddress?: string;
  swapType: "exactIn" | "exactOut";
  onUpdateTokens?: (tokens: SwapTokenOption[]) => void;
}

/** Chevron down icon used in asset selector pills */
const ChevronDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" style={{ width: "12px", height: "12px", flexShrink: 0 }}>
    <path d="M2 3.5L5 6.5L8 3.5" stroke="#848483" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/** Plus icon for add asset button */
const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M6 2V10M2 6H10" stroke="#006BF4" strokeWidth="1.5" strokeLinecap="round" />
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
        transition: "max-height 0.2s ease-out, opacity 0.2s ease-out, margin-top 0.15s ease-out",
      }}
    >
      {[25, 50, 75, 100].map((pct) => {
        const label = pct === 100 ? maxLabel : `${pct}%`;
        return <PercentHoverButton key={pct} label={label} onClick={() => onSelect(pct)} />;
      })}
    </div>
  );
}

function PercentHoverButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  const isHighlighted = hover || active;

  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
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
          ...(label === "MAX" ? { letterSpacing: "0.02em" } : {})
        }}
      >
        {label}
      </div>
    </button>
  );
}

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
  onAmountChange,
  fromTokens,
  toToken,
  totalBalance,
  receiveBalance,
  usdValue,
  onOpenSourcePicker,
  onOpenDestPicker,
  onOpenRecipientPicker,
  recipientAddress,
  swapType,
  onUpdateTokens,
}: SwapIdleFormProps) {
  const [hoveredPanel, setHoveredPanel] = useState<"send" | "receive" | null>(null);
  const [focusedPanel, setFocusedPanel] = useState<"send" | "receive" | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);

  const sanitizeInput = (raw: string): string => {
    let next = raw.replaceAll(/[^0-9.]/g, "");
    const parts = next.split(".");
    if (parts.length > 2) next = parts[0] + "." + parts.slice(1).join("");
    if (next === ".") next = "0.";
    return next;
  };

  const handleSendInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onAmountChange(sanitizeInput(e.target.value), "send");
  };

  const handleReceiveInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onAmountChange(sanitizeInput(e.target.value), "receive");
  };

  const handleTokenAmountChange = (index: number, val: string) => {
    if (!onUpdateTokens) return;
    const next = [...fromTokens];
    next[index] = { ...next[index], userAmount: sanitizeInput(val) };
    onUpdateTokens(next);
    
    // Also update total amount for backwards compatibility if needed
    const total = next.reduce((sum, t) => sum + Number(t.userAmount || 0), 0);
    onAmountChange(total > 0 ? String(total) : "", "send");
  };

  const isExactIn = swapType === "exactIn";

  const handleSendPercentForToken = (index: number, pct: number, balanceStr: string | undefined) => {
    if (!balanceStr || !onUpdateTokens) return;
    const bal = parseFloat(balanceStr.replace(/[^0-9.]/g, ""));
    if (isNaN(bal)) return;
    const val = bal * (pct / 100);
    const next = [...fromTokens];
    next[index] = { ...next[index], userAmount: val.toFixed(6).replace(/\.?0+$/, "") };
    onUpdateTokens(next);
  };

  const handleSendPercent = (pct: number) => {
    if (!totalBalance) return;
    const bal = parseFloat(totalBalance.replace(/[^0-9.]/g, ""));
    if (isNaN(bal)) return;
    const val = bal * (pct / 100);
    // If there's only one token, or no tokens, update the main amount
    if (fromTokens.length <= 1) {
      if (fromTokens.length === 1 && onUpdateTokens) {
        handleSendPercentForToken(0, pct, fromTokens[0].balance);
      }
      onAmountChange(val.toFixed(6).replace(/\.?0+$/, ""), "send");
    }
  };

  const handleReceivePercent = (pct: number) => {
    if (!receiveBalance) return;
    const bal = parseFloat(receiveBalance.replace(/[^0-9.]/g, ""));
    if (isNaN(bal)) return;
    const val = bal * (pct / 100);
    onAmountChange(val.toFixed(6).replace(/\.?0+$/, ""), "receive");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>

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
        <div style={{ alignItems: "center", alignSelf: "stretch", boxSizing: "border-box", display: "flex", justifyContent: "space-between", width: "100%" }}>
          <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, letterSpacing: "0.08em", lineHeight: "20px", textTransform: "uppercase" as const }}>
            Send
          </div>
          <div style={{ alignItems: "center", boxSizing: "border-box", display: "flex", gap: "4px" }}>
            <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", lineHeight: "20px" }}>
              Total Balance:
            </div>
            <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", lineHeight: "20px" }}>
              ${totalBalance}
            </div>
          </div>
        </div>

        {/* Render each selected source asset, or an empty one if none */}
        <div style={{ alignSelf: "stretch", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
          {(fromTokens.length > 0 ? fromTokens : [null]).map((token, index) => {
            return (
              <div 
                key={token ? `${token.contractAddress}-${token.chainId}` : "empty"} 
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                onMouseEnter={() => setHoveredRow(index)}
                onMouseLeave={() => setHoveredRow(null)}
                onFocusCapture={() => setFocusedRow(index)}
                onBlurCapture={() => setFocusedRow(null)}
              >
                <div style={{ alignItems: "center", alignSelf: "stretch", boxSizing: "border-box", display: "flex", gap: "10px", justifyContent: "space-between", width: "100%" }}>
                  <input
                    type="text"
                    placeholder="0"
                    value={isExactIn ? (token ? (token.userAmount || "") : amount) : ""}
                    onChange={(e) => {
                      if (token) handleTokenAmountChange(index, e.target.value);
                      else handleSendInput(e);
                    }}
                    style={{
                      boxSizing: "border-box",
                      color: (isExactIn && (token ? token.userAmount : amount)) ? "#161615" : "#9E9E9C",
                      fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
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

                  {/* Asset selector pill */}
                  <button
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
                      paddingLeft: token ? "4px" : "8px",
                      paddingRight: "10px",
                      paddingTop: "5px",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {token ? (
                      <div style={{ boxSizing: "border-box", flexShrink: 0, height: "26px", position: "relative" as const, width: "26px" }}>
                        <img src={token.logo} alt={token.symbol} style={{ borderRadius: "999px", height: "26px", width: "26px", objectFit: "cover" as const }} />
                        {token.chainLogo && (
                          <img src={token.chainLogo} alt={token.chainName} style={{ borderRadius: "999px", bottom: -2, height: "12px", outline: "1px solid #FFFFFE", position: "absolute" as const, right: -2, width: "12px", objectFit: "cover" as const }} />
                        )}
                      </div>
                    ) : (
                      <div style={{ borderColor: "#C8C8C7", borderRadius: "999px", borderStyle: "dashed", borderWidth: "1.5px", boxSizing: "border-box", flexShrink: 0, height: "22px", width: "22px" }} />
                    )}
                    <div style={{ boxSizing: "border-box", color: "#161615", fontFamily: '"Geist", system-ui, sans-serif', fontSize: token ? "14px" : "16px", fontWeight: 500, lineHeight: token ? "18px" : "24px" }}>
                      {token ? token.symbol : "Assets"}
                    </div>
                    <ChevronDownIcon />
                  </button>
                </div>

                {/* USD value + balance row */}
                <div style={{ alignItems: "center", alignSelf: "stretch", boxSizing: "border-box", display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", lineHeight: "20px" }}>
                    ≈ ${token ? (Number(token.userAmount || 0) * (Number(token.balanceInFiat?.replace(/[^0-9.]/g, "")) / Number(token.balance?.replace(/[^0-9.]/g, ""))) || 0).toFixed(2) : (usdValue || "0.00")}
                  </div>
                  {token && (
                    <div style={{ alignItems: "center", boxSizing: "border-box", display: "flex", gap: "5px" }}>
                      <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", fontVariantNumeric: "tabular-nums", lineHeight: "20px" }}>
                        Balance:
                      </div>
                      <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", fontVariantNumeric: "tabular-nums", lineHeight: "20px" }}>
                        {token.balance}
                      </div>
                    </div>
                  )}
                </div>

                {/* 25% 50% 75% MAX — hover transition */}
                <PercentButtons
                  visible={hoveredRow === index || focusedRow === index}
                  onSelect={(pct) => token ? handleSendPercentForToken(index, pct, token.balance) : handleSendPercent(pct)}
                />
              </div>
            );
          })}
        </div>

        {/* Add asset button — only after first source selected */}
        <AddAssetButton
          visible={fromTokens.length > 0}
          label="Add asset"
          onClick={() => onOpenSourcePicker()}
        />
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
        <div style={{ alignSelf: "stretch", boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, letterSpacing: "0.08em", lineHeight: "20px", textTransform: "uppercase" as const, width: "100%" }}>
          Receive
        </div>

        <div style={{ alignSelf: "stretch", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
          <div style={{ alignItems: "center", alignSelf: "stretch", boxSizing: "border-box", display: "flex", gap: "10px", justifyContent: "space-between", width: "100%" }}>
            <input
              type="text"
              placeholder="0"
              value={!isExactIn ? amount : ""}
              onChange={handleReceiveInput}
              style={{
                boxSizing: "border-box",
                color: (!isExactIn && amount) ? "#161615" : "#9E9E9C",
                fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
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
                <div style={{ boxSizing: "border-box", flexShrink: 0, height: "26px", position: "relative" as const, width: "26px" }}>
                  <img src={toToken.logo} alt={toToken.symbol} style={{ borderRadius: "999px", height: "26px", width: "26px", objectFit: "cover" as const }} />
                  {toToken.chainLogo && (
                    <img src={toToken.chainLogo} alt={toToken.chainName} style={{ borderRadius: "999px", bottom: -2, height: "12px", outline: "1px solid #FFFFFE", position: "absolute" as const, right: -2, width: "12px", objectFit: "cover" as const }} />
                  )}
                </div>
              ) : (
                <div style={{ borderColor: "#C8C8C7", borderRadius: "999px", borderStyle: "dashed", borderWidth: "1.5px", boxSizing: "border-box", flexShrink: 0, height: "22px", width: "22px" }} />
              )}
              <div style={{ boxSizing: "border-box", color: "#161615", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "16px", fontWeight: 500, lineHeight: "24px" }}>
                {toToken ? toToken.symbol : "Assets"}
              </div>
              <ChevronDownIcon />
            </button>
          </div>

          {/* USD value + balance row */}
          <div style={{ alignItems: "center", alignSelf: "stretch", boxSizing: "border-box", display: "flex", justifyContent: "space-between", width: "100%" }}>
            <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", lineHeight: "20px" }}>
              ≈ $0.00
            </div>
            {toToken && toToken.balance && (
              <div style={{ alignItems: "center", boxSizing: "border-box", display: "flex", gap: "5px" }}>
                <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", fontVariantNumeric: "tabular-nums", lineHeight: "20px" }}>
                  Balance:
                </div>
                <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", fontVariantNumeric: "tabular-nums", lineHeight: "20px" }}>
                  {toToken.balance}
                </div>
              </div>
            )}
          </div>

          {/* 25% 50% 75% MAX — hover transition (receive side) */}
          <PercentButtons
            visible={hoveredPanel === "receive" || focusedPanel === "receive"}
            onSelect={handleReceivePercent}
          />
        </div>

        {/* Recipient section — only shown when handler exists */}
        {onOpenRecipientPicker && (
          <>
            <div style={{ alignSelf: "stretch", backgroundColor: "#E8E8E7", boxSizing: "border-box", flexShrink: 0, height: "1px", marginTop: "4px", width: "100%" }} />
            <div style={{ alignSelf: "stretch", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "6px", paddingTop: "2px", width: "100%" }}>
              <div style={{ boxSizing: "border-box", color: "#7C7C7A", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, letterSpacing: "0.08em", lineHeight: "20px", textTransform: "uppercase" as const }}>
                Recipient
              </div>
              <div style={{ alignItems: "center", alignSelf: "stretch", boxSizing: "border-box", display: "flex", gap: "10px", justifyContent: "space-between", width: "100%" }}>
                <div style={{ boxSizing: "border-box", color: "#006BF4", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "16px", fontVariantNumeric: "tabular-nums", fontWeight: 500, lineHeight: "18px" }}>
                  {recipientAddress ? `${recipientAddress.slice(0, 6)}…${recipientAddress.slice(-4)}` : "Select recipient"}
                </div>
                <button
                  onClick={onOpenRecipientPicker}
                  style={{ alignItems: "center", backgroundColor: "#F4F6FF", borderRadius: "4px", boxSizing: "border-box", display: "flex", gap: "4px", paddingBlock: "8px", paddingInline: "12px", border: "none", cursor: "pointer" }}
                >
                  <div style={{ boxSizing: "border-box", color: "#006BF4", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, lineHeight: "13px" }}>
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
