"use client";

import {
  CHAIN_METADATA,
  SUPPORTED_CHAINS,
  TOKEN_METADATA,
} from "@/registry/avail-widgets/common/utils/constant";

const uiFont = '"Geist", var(--font-geist-sans), system-ui, sans-serif';
const cardBg =
  "url(https://files.availproject.org/nexus-elements/nexus-one/card-bg.png)";

const ChevronDownIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: "12px", height: "12px", flexShrink: 0 }}
  >
    <path
      d="M2 3.5L5 6.5L8 3.5"
      stroke="#848483"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const RefreshIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: "16px", height: "16px", flexShrink: 0 }}
  >
    <path
      d="M8 4V8L10.5 9.5"
      stroke="#161615"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C10.196 2 12.117 3.179 13.163 4.936"
      stroke="#161615"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <path
      d="M13.5 2V5H10.5"
      stroke="#161615"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TokenPill = ({
  chainId,
  symbol,
}: {
  chainId: number;
  symbol: keyof typeof TOKEN_METADATA;
}) => {
  const chain = CHAIN_METADATA[chainId];
  const token = TOKEN_METADATA[symbol];

  return (
    <button
      type="button"
      style={{
        alignItems: "center",
        backgroundColor: "#FFFFFE",
        border: "1px solid #E8E8E7",
        borderRadius: "999px",
        boxShadow: "#1616150A 0px 1px 2px",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "flex",
        flexShrink: 0,
        gap: "7px",
        padding: "4px 9px 4px 4px",
      }}
    >
      <span
        style={{
          boxSizing: "border-box",
          flexShrink: 0,
          height: "24px",
          position: "relative",
          width: "24px",
        }}
      >
        <img
          src={token.logo}
          alt={token.symbol}
          style={{
            backgroundColor: "#FFFFFE",
            borderRadius: "999px",
            height: "24px",
            objectFit: "cover",
            width: "24px",
          }}
        />
        <img
          src={chain.logo}
          alt={chain.name}
          style={{
            backgroundColor: "#FFFFFE",
            borderRadius: "999px",
            bottom: -2,
            height: "12px",
            objectFit: "cover",
            outline: "1px solid #FFFFFE",
            position: "absolute",
            right: -2,
            width: "12px",
          }}
        />
      </span>
      <span
        style={{
          boxSizing: "border-box",
          color: "#161615",
          fontSize: "13px",
          fontWeight: 500,
          lineHeight: "17px",
        }}
      >
        {token.symbol}
      </span>
      <ChevronDownIcon />
    </button>
  );
};

const AmountPanel = ({
  balance,
  chainId,
  label,
  tokenSymbol,
  usdValue,
  value,
}: {
  balance: string;
  chainId: number;
  label: string;
  tokenSymbol: keyof typeof TOKEN_METADATA;
  usdValue: string;
  value: string;
}) => (
  <div
    style={{
      backgroundColor: "#FFFFFE",
      border: "1px solid #E8E8E7",
      borderRadius: "12px",
      boxShadow: "#1616150A 0px 1px 2px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      fontVariantNumeric: "tabular-nums",
      gap: "10px",
      padding: "16px 14px",
      width: "100%",
    }}
  >
    <div
      style={{
        boxSizing: "border-box",
        color: "#848483",
        fontSize: "12px",
        fontWeight: 500,
        letterSpacing: "0.08em",
        lineHeight: "20px",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    <div
      style={{
        alignItems: "center",
        boxSizing: "border-box",
        display: "flex",
        gap: "10px",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <input
        type="text"
        value={value}
        readOnly
        style={{
          background: "transparent",
          border: "none",
          boxSizing: "border-box",
          color: "#161615",
          fontSize: "32px",
          fontWeight: 500,
          lineHeight: "38px",
          minWidth: 0,
          outline: "none",
          padding: 0,
          width: "100%",
        }}
      />
      <TokenPill chainId={chainId} symbol={tokenSymbol} />
    </div>
    <div
      style={{
        alignItems: "center",
        boxSizing: "border-box",
        color: "#848483",
        display: "flex",
        fontSize: "13px",
        justifyContent: "space-between",
        lineHeight: "18px",
        width: "100%",
      }}
    >
      <span>{usdValue}</span>
      <span>{balance}</span>
    </div>
  </div>
);

export default function MockBridgeUI() {
  return (
    <div
      style={{
        backgroundColor: "#F9F9F8",
        backgroundImage: cardBg,
        backgroundPosition: "center",
        backgroundSize: "cover",
        borderRadius: "16px",
        boxShadow: "#5B5B5B0D 0px 1px 12px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: uiFont,
        gap: "12px",
        height: "fit-content",
        maxWidth: "450px",
        padding: "12px",
        textAlign: "left",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          boxSizing: "border-box",
          display: "flex",
          flexShrink: 0,
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            boxSizing: "border-box",
            color: "#161615",
            fontSize: "15px",
            fontWeight: 500,
            letterSpacing: "0.02em",
            lineHeight: "18px",
          }}
        >
          Swap
        </div>
        <button
          type="button"
          style={{
            alignItems: "center",
            backgroundColor: "#FFFFFE",
            border: "none",
            borderRadius: "8px",
            boxSizing: "border-box",
            cursor: "pointer",
            display: "flex",
            flexShrink: 0,
            height: "32px",
            justifyContent: "center",
            outline: "1px solid #E8E8E7",
            padding: 0,
            width: "32px",
          }}
        >
          <RefreshIcon />
        </button>
      </div>

      <AmountPanel
        balance="Asset Balance · 200 USDC"
        chainId={SUPPORTED_CHAINS.ARBITRUM}
        label="Send"
        tokenSymbol="USDC"
        usdValue="≈ $100.00"
        value="100"
      />
      <AmountPanel
        balance="Asset Balance · 0 USDC"
        chainId={SUPPORTED_CHAINS.BASE}
        label="Receive"
        tokenSymbol="USDC"
        usdValue="≈ $99.90"
        value="99.9"
      />

      <button
        type="button"
        style={{
          alignItems: "center",
          backgroundColor: "#006BF4",
          border: "none",
          borderRadius: "8px",
          color: "#FFFFFE",
          cursor: "pointer",
          fontSize: "15px",
          fontWeight: 600,
          lineHeight: "22px",
          padding: "12px 14px",
          textAlign: "center",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
          width: "100%",
        }}
      >
        Swap
      </button>
    </div>
  );
}
