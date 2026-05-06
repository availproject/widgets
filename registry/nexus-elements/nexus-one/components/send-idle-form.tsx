import React from "react";
import { type SwapTokenOption } from "./swap-asset-selector";

interface SendIdleFormProps {
  amount: string;
  onAmountChange: (val: string) => void;
  toToken?: SwapTokenOption;
  totalBalance: string;
  usdValue: string;
  onOpenAssetPicker: () => void;
  onOpenRecipientPicker: () => void;
  recipientAddress: string;
  onMax: () => void;
}

export function SendIdleForm({
  amount,
  onAmountChange,
  toToken,
  totalBalance,
  usdValue,
  onOpenAssetPicker,
  onOpenRecipientPicker,
  recipientAddress,
  onMax,
}: SendIdleFormProps) {
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let next = e.target.value.replaceAll(/[^0-9.]/g, "");
    const parts = next.split(".");
    if (parts.length > 2) next = parts[0] + "." + parts.slice(1).join("");
    if (next === ".") next = "0.";
    onAmountChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>

      {/* ─── RECIPIENT PANEL ─── */}
      <div
        style={{
          alignItems: "start",
          backgroundColor: "#FFFFFE",
          borderColor: "#E8E8E7",
          borderRadius: "14px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#5B5B5B0D 0px 1px 12px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          justifyContent: "center",
          paddingBlock: "14px",
          paddingInline: "16px",
        }}
      >
        <div style={{ alignSelf: "stretch", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "6px", paddingTop: "2px" }}>
          <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, letterSpacing: "0.08em", lineHeight: "13px", textTransform: "uppercase" }}>
            Recipient
          </div>
          <div style={{ alignItems: "center", alignSelf: "stretch", boxSizing: "border-box", display: "flex", gap: "10px", justifyContent: "space-between", width: "100%" }}>
            <div style={{ boxSizing: "border-box", color: "#006BF4", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "16px", fontVariantNumeric: "tabular-nums", fontWeight: 500, lineHeight: "18px" }}>
              {recipientAddress ? `${recipientAddress.slice(0, 6)}…${recipientAddress.slice(-4)}` : "Select recipient"}
            </div>
            <button
              onClick={onOpenRecipientPicker}
              style={{
                alignItems: "center",
                backgroundColor: "#E8F0FF",
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
              <div style={{ boxSizing: "border-box", color: "#006BF4", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, lineHeight: "13px" }}>
                Edit
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ─── AMOUNT PANEL ─── */}
      <div
        style={{
          backgroundColor: "#FFFFFE",
          borderColor: "#E8E8E7",
          borderRadius: "14px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#5B5B5B0D 0px 1px 12px",
          boxSizing: "border-box",
          overflow: "clip",
        }}
      >
        <div
          style={{
            alignItems: "center",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            justifyContent: "center",
            paddingBlock: "16px",
            paddingInline: "20px",
          }}
        >
          {/* Amount header */}
          <div style={{ alignItems: "center", alignSelf: "stretch", boxSizing: "border-box", display: "flex", gap: "8px", justifyContent: "space-between" }}>
            <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, letterSpacing: "0.08em", lineHeight: "14px", textTransform: "uppercase" }}>
              Amount
            </div>
            <div style={{ alignItems: "center", boxSizing: "border-box", display: "flex", gap: "4px" }}>
              <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", lineHeight: "14px" }}>
                Balance:
              </div>
              <div style={{ boxSizing: "border-box", color: "#161615", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", fontVariantNumeric: "tabular-nums", fontWeight: 500, lineHeight: "14px" }}>
                ${totalBalance}
              </div>
            </div>
          </div>

          {/* Amount input + MAX + Asset pill */}
          <div style={{ alignItems: "center", alignSelf: "stretch", boxSizing: "border-box", display: "flex", gap: "12px", justifyContent: "space-between" }}>
            <div style={{ alignItems: "center", boxSizing: "border-box", display: "flex", flex: "1 1 0%", gap: "3px", minWidth: 0 }}>
              <input
                type="text"
                placeholder="0"
                value={amount}
                onChange={handleInput}
                style={{
                  boxSizing: "border-box",
                  color: amount ? "#161615" : "#C8C8C6",
                  fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
                  fontSize: "40px",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
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

            {/* MAX pill */}
            <button
              onClick={onMax}
              style={{
                alignItems: "center",
                backgroundColor: "#F0F0EF",
                borderRadius: "999px",
                boxSizing: "border-box",
                display: "flex",
                flexShrink: 0,
                justifyContent: "center",
                paddingBlock: "7px",
                paddingInline: "11px",
                border: "none",
                cursor: "pointer",
              }}
            >
              <div style={{ boxSizing: "border-box", color: "#C8C8C6", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", lineHeight: "14px" }}>
                MAX
              </div>
            </button>

            {/* Asset pill */}
            <button
              onClick={onOpenAssetPicker}
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFE",
                borderColor: toToken ? "#E8E8E7" : "#C8C8C6",
                borderRadius: "999px",
                borderStyle: toToken ? "solid" : "dashed",
                borderWidth: "1px",
                boxSizing: "border-box",
                display: "flex",
                flexShrink: 0,
                gap: "8px",
                height: "36px",
                paddingBottom: "6px",
                paddingLeft: "5px",
                paddingRight: "12px",
                paddingTop: "6px",
                cursor: "pointer",
              }}
            >
              {toToken ? (
                <div style={{ boxSizing: "border-box", flexShrink: 0, height: "20px", position: "relative", width: "20px" }}>
                  <img src={toToken.logo} alt={toToken.symbol} style={{ borderRadius: "999px", height: "20px", width: "20px", objectFit: "cover" }} />
                </div>
              ) : (
                <div style={{ borderColor: "#C8C8C6", borderRadius: "999px", borderStyle: "dashed", borderWidth: "1.5px", boxSizing: "border-box", flexShrink: 0, height: "20px", width: "20px" }} />
              )}
              <div style={{ boxSizing: "border-box", color: "#161615", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", fontWeight: 600, lineHeight: "18px" }}>
                {toToken ? toToken.symbol : "Assets"}
              </div>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="#5B5B5A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* USD value */}
          <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", lineHeight: "16px", width: "100%" }}>
            ≈ ${usdValue || "0.00"}
          </div>
        </div>
      </div>
    </div>
  );
}
