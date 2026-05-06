import React, { useState } from "react";
import { type SwapTokenOption } from "./swap-asset-selector";

interface DepositIdleFormProps {
  amount: string;
  onAmountChange: (val: string) => void;
  toToken?: SwapTokenOption;
  totalBalance: string;
  usdValue: string;
  fromTokens: SwapTokenOption[];
  onOpenSourcePicker: () => void;
  onSetPercent: (pct: number) => void;
}

export function DepositIdleForm({
  amount,
  onAmountChange,
  toToken,
  totalBalance,
  usdValue,
  fromTokens,
  onOpenSourcePicker,
  onSetPercent,
}: DepositIdleFormProps) {
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let next = e.target.value.replaceAll(/[^0-9.]/g, "");
    const parts = next.split(".");
    if (parts.length > 2) next = parts[0] + "." + parts.slice(1).join("");
    if (next === ".") next = "0.";
    onAmountChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>

      {/* ─── DEPOSIT AMOUNT PANEL ─── */}
      <div
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
          gap: "12px",
          justifyContent: "center",
          paddingBlock: "20px",
          paddingInline: "16px",
        }}
      >
        {/* Header row: Deposit + Total Balance */}
        <div style={{ alignItems: "center", alignSelf: "stretch", boxSizing: "border-box", display: "flex", justifyContent: "space-between" }}>
          <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, letterSpacing: "0.08em", lineHeight: "20px", textTransform: "uppercase" }}>
            Deposit
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

        {/* Amount + Token pill */}
        <div style={{ alignSelf: "stretch", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ alignItems: "center", boxSizing: "border-box", display: "flex", gap: "10px", justifyContent: "space-between", width: "100%" }}>
            <input
              type="text"
              placeholder="0"
              value={amount}
              onChange={handleInput}
              style={{
                boxSizing: "border-box",
                color: amount ? "#161615" : "#9E9E9C",
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

            {/* Token pill (non-clickable, shows fixed deposit token) */}
            <div
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFE",
                borderColor: "#E8E8E7",
                borderRadius: "999px",
                borderStyle: "solid",
                borderWidth: "1px",
                boxShadow: "#1616150A 0px 1px 2px",
                boxSizing: "border-box",
                display: "inline-flex",
                flexShrink: 0,
                gap: "8px",
                height: "36px",
                paddingLeft: "4px",
                paddingRight: "10px",
              }}
            >
              {toToken?.logo ? (
                <div style={{ boxSizing: "border-box", flexShrink: 0, height: "26px", position: "relative", width: "26px" }}>
                  <img src={toToken.logo} alt={toToken.symbol} style={{ borderRadius: "999px", height: "26px", width: "26px", objectFit: "cover" }} />
                  {toToken.chainLogo && (
                    <img src={toToken.chainLogo} alt={toToken.chainName} style={{ borderRadius: "999px", bottom: -2, height: "12px", outline: "1px solid #FFFFFE", position: "absolute", right: -2, width: "12px", objectFit: "cover" }} />
                  )}
                </div>
              ) : (
                <div style={{ width: "26px", height: "26px", borderRadius: "999px", backgroundColor: "#F0F0EF", flexShrink: 0 }} />
              )}
              <div style={{ boxSizing: "border-box", color: "#161615", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "16px", fontWeight: 500, lineHeight: "24px" }}>
                {toToken?.symbol || "Token"}
              </div>
            </div>
          </div>

          {/* USD and balance row */}
          <div style={{ alignItems: "center", boxSizing: "border-box", display: "flex", justifyContent: "space-between" }}>
            <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", lineHeight: "20px" }}>
              ≈ ${usdValue || "0.00"}
            </div>
            <div style={{ alignItems: "center", boxSizing: "border-box", display: "flex", gap: "5px" }}>
              <div style={{ boxSizing: "border-box", color: "#7C7C7A", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", lineHeight: "20px" }}>
                Balance:
              </div>
              <div style={{ boxSizing: "border-box", color: "#161615", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                {toToken?.balance || "0"} {toToken?.symbol || ""}
              </div>
            </div>
          </div>

          {/* 25% 50% 75% MAX quick buttons */}
          <div style={{ alignItems: "center", boxSizing: "border-box", display: "flex", gap: "6px", width: "100%" }}>
            {[25, 50, 75].map(pct => (
              <button
                key={pct}
                onClick={() => onSetPercent(pct)}
                style={{
                  alignItems: "center", backgroundColor: "#F4F4F3", borderRadius: "8px", boxSizing: "border-box", display: "flex", flex: "1 1 0%", justifyContent: "center", paddingBlock: "5px", paddingInline: "10px", border: "none", cursor: "pointer",
                }}
              >
                <div style={{ boxSizing: "border-box", color: "#363635", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, lineHeight: "20px" }}>
                  {pct}%
                </div>
              </button>
            ))}
            <button
              onClick={() => onSetPercent(100)}
              style={{
                alignItems: "center", backgroundColor: "#E8F0FF", borderRadius: "8px", boxSizing: "border-box", display: "flex", flex: "1 1 0%", justifyContent: "center", paddingBlock: "5px", paddingInline: "10px", border: "none", cursor: "pointer",
              }}
            >
              <div style={{ boxSizing: "border-box", color: "#006BF4", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, letterSpacing: "0.02em", lineHeight: "20px" }}>
                MAX
              </div>
            </button>
          </div>
        </div>

        {/* Add asset button */}
        <button
          onClick={onOpenSourcePicker}
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
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M6 2V10M2 6H10" stroke="#006BF4" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div style={{ boxSizing: "border-box", color: "#006BF4", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "12px", fontWeight: 500, lineHeight: "20px" }}>
            {fromTokens.length > 0 ? `${fromTokens.length} source${fromTokens.length > 1 ? "s" : ""} selected` : "Add asset"}
          </div>
        </button>
      </div>
    </div>
  );
}
