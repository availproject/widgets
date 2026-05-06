"use client";
import { nexusOneTheme } from "../theme";
import React, { useState } from "react";
import {
  ArrowRight,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Layers,
  TrendingDown,
  Wallet,
  Send,
} from "lucide-react";
import { Button } from "../../ui/button";
import { type NexusOneMode, type DepositOpportunity } from "../types";
import { type SwapTokenOption } from "./swap-asset-selector";

// ---------------------------------------------------------------------------
// Types for intent data from SDK swap intent hook
// ---------------------------------------------------------------------------
export interface SwapIntentSource {
  amount: string;
  chain: { id: number; logo: string; name: string };
  token: { contractAddress: string; decimals: number; symbol: string };
}

export interface SwapIntentDestination {
  amount: string;
  chain: { id: number; logo: string; name: string };
  token: { contractAddress: string; decimals: number; symbol: string };
  gas: {
    amount: string;
    token: { contractAddress: string; decimals: number; symbol: string };
  };
}

export interface SwapIntentData {
  sources: SwapIntentSource[];
  destination: SwapIntentDestination;
}

export interface SwapIntentPreviewProps {
  /** The from tokens selected by user (for logo display) */
  fromTokens?: SwapTokenOption[];
  fromToken?: SwapTokenOption;
  toToken?: SwapTokenOption;
  /** Human-readable amount user entered */
  fromAmount: string;
  /** Total USD value of what user is swapping */
  fromAmountUsd?: string;
  /** Amount user will receive */
  toAmount?: string;
  toAmountUsd?: string;
  toAmountTokens?: string;
  totalFeeUsd?: string;
  estimatedTime?: string;
  isLoading?: boolean;
  /** Actual SDK intent data from setOnSwapIntentHook */
  intentData?: SwapIntentData | null;
  mode?: NexusOneMode;
  opportunity?: DepositOpportunity;
  /** Pass the full user swap balances to reliably map token logos for exactOut */
  swapBalances?: any[] | null;
  /** Global asset dictionary mapped across all topologies, guaranteeing data even when balances===0 */
  supportedTokenAssets?: any[] | null;
  activeMode?: NexusOneMode;
  onAccept: () => void;
  onReject: () => void;
}

export function SwapIntentPreview({
  fromTokens,
  fromToken,
  toToken,
  fromAmount,
  fromAmountUsd,
  toAmount,
  toAmountUsd,
  toAmountTokens,
  totalFeeUsd,
  estimatedTime = "~10s",
  isLoading,
  intentData,
  swapBalances,
  supportedTokenAssets,
  activeMode,
  mode,
  opportunity,
  onAccept,
  onReject,
}: SwapIntentPreviewProps) {
  const [showDetails, setShowDetails] = useState(false);

  const intentSources = intentData?.sources ?? [];
  const intentDest = intentData?.destination;

  const getTokenLogo = (chainId: number, contractAddress?: string, symbol?: string) => {
    // 1. Immediately prioritize dynamic balances (since they guarantee verified holding context)
    if (swapBalances && Array.isArray(swapBalances)) {
      for (const asset of swapBalances) {
        if (!asset.breakdown || !Array.isArray(asset.breakdown)) continue;
        for (const bd of asset.breakdown) {
          const matchChain = bd.chain?.id === chainId;
          const matchAddress = contractAddress && bd.contractAddress
            ? bd.contractAddress.toLowerCase() === contractAddress.toLowerCase()
            : false;
          const matchSymbol = bd.symbol === symbol || asset.symbol === symbol;
          
          if (matchChain && (matchAddress || matchSymbol)) {
            if (asset.icon) return asset.icon;
          }
        }
      }
    }
    
    // 2. Fall back to the absolute registry for tokens the user lacks balances for (e.g. MATIC destination limits)
    if (supportedTokenAssets && Array.isArray(supportedTokenAssets)) {
      const chain = supportedTokenAssets.find((c: any) => c.id === chainId);
      if (chain && Array.isArray(chain.tokens)) {
        const token = chain.tokens.find((t: any) => {
          if (contractAddress && t.contractAddress) {
             return t.contractAddress.toLowerCase() === contractAddress.toLowerCase();
          }
          return t.symbol === symbol;
        });
        if (token?.logo) return token.logo;
      }
    }

    return undefined;
  };

  // Resolve display sources — prefer intent data if available
  const sources =
    intentSources.length > 0
      ? intentSources.map((s) => ({
          symbol: s.token.symbol,
          contractAddress: s.token.contractAddress,
          chainId: s.chain.id,
          logo: getTokenLogo(s.chain.id, s.token.contractAddress, s.token.symbol),
          name: s.token.symbol,
          chainName: s.chain.name,
          chainLogo: s.chain.logo,
          decimals: s.token.decimals,
        }))
      : fromTokens && fromTokens.length > 0
        ? fromTokens
        : fromToken
          ? [fromToken]
          : [];

  // Compute actual USD values from intent if available
  const displayFromAmountUsd = intentSources.length > 0
    ? intentSources.reduce((sum, s) => sum + Number((s as any).value || s.amount || 0), 0).toFixed(2)
    : (fromAmountUsd || fromAmount);

  const displayToAmountUsd = intentDest
    ? Number((intentDest as any).value || intentDest.amount || 0).toFixed(2)
    : (toAmountUsd || toAmount || "—");

  const displayToAmountTokens = intentDest
    ? `${Number(intentDest.amount || 0).toFixed(4)}`
    : toAmountTokens;

  const displayFeeUsd = (() => {
    if (intentSources.length > 0 && intentDest) {
      const totalIn = intentSources.reduce((sum, s) => sum + Number((s as any).value || s.amount || 0), 0);
      const totalOut = Number((intentDest as any).value || intentDest.amount || 0);
      const fee = totalIn - totalOut;
      return fee > 0 ? fee.toFixed(2) : "0.00";
    }
    return totalFeeUsd || "0.00";
  })();

  // Build summary label like "USDC, ETH +2 more"
  const sourceLabel = (() => {
    if (intentSources.length > 0) {
      const syms = [...new Set(intentSources.map((s) => s.token.symbol))];
      if (syms.length <= 2) return syms.join(", ");
      return `${syms[0]}, ${syms[1]} +${syms.length - 2} more`;
    }
    if (sources.length === 0) return "—";
    const syms = [...new Set(sources.map((s) => s.symbol))];
    if (syms.length <= 2) return syms.join(", ");
    return `${syms[0]}, ${syms[1]} +${syms.length - 2} more`;
  })();

  // Enable details breakdown even if there is exactly 1 source as requested by user
  const hasBreakdown = intentSources.length > 0 || sources.length > 0;
  const destTokenSymbol = intentDest?.token.symbol || toToken?.symbol || "—";

  return (
    <div className="flex flex-col gap-y-4 w-full">
      {/* ------------------------------------------------------------------ */}
      {/* White card: wraps logos + detail rows                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          background: "var(--background-secondary, #FFFFFF)",
          borderRadius: "12px",
          border: "1px solid var(--border-default, var(--border-default, #E8E8E7))",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D",
          padding: "16px",
        }}
      >
        {/* Token logo visualization + estimated time */}
        <div className="flex flex-col items-center gap-y-2 pb-3">
        <div className="flex items-center gap-x-3">
          {/* Source token logos (tightly stacked, no white border) */}
          <div className="flex items-center">
            {sources.slice(0, 3).map((token, i) => {
              const matchingIntentSrc = intentSources.find(
                 is => (is.token.contractAddress || "").toLowerCase() === (token.contractAddress || "").toLowerCase()
                    && is.chain.id === token.chainId
              );
              let amountStr = "—";
              if (matchingIntentSrc) {
                amountStr = `${Number(matchingIntentSrc.amount || 0).toFixed(4)} ${token.symbol}`;
              } else if (sources.length > 0) {
                const evenlySplitAmt = Number(fromAmount) / sources.length;
                amountStr = `${evenlySplitAmt.toFixed(4)} ${token.symbol}`;
              }

              return (
              <div
                key={`src-${token.contractAddress}-${token.chainId}-${i}`}
                className="relative shrink-0 group/logo cursor-default"
                style={{ marginLeft: i > 0 ? "-12px" : "0", zIndex: 3 - i }}
              >
                {/* When hovered, we force this relative block to bump above its siblings */}
                <div className="group-hover/logo:z-20 relative">
                  {token.logo ? (
                    <img
                      src={token.logo}
                      alt={token.symbol}
                      className="rounded-full object-cover transition-transform group-hover/logo:scale-105"
                      style={{ width: 36, height: 36 }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className="rounded-full flex items-center justify-center text-xs font-bold text-white transition-transform group-hover/logo:scale-105"
                      style={{
                        width: 36,
                        height: 36,
                        background:
                          "var(--interactive-button-primary-background, var(--foreground-brand, #006BF4))",
                      }}
                    >
                      {token.symbol.slice(0, 2)}
                    </div>
                  )}

                  {/* Tooltip */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 group-hover/logo:opacity-100 transition-opacity whitespace-nowrap pointer-events-none flex items-center justify-center z-50 text-center"
                    style={{
                      background: "var(--background-inverse, var(--foreground-primary, #161615))",
                      boxShadow: "0px 1px 4px 0px #5555550D",
                      minWidth: 94,
                      height: 30,
                      borderRadius: 4,
                      gap: 8,
                      padding: "6px 10px",
                      fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                      fontWeight: 400,
                      fontSize: 14,
                      lineHeight: "18px",
                      color: "var(--foreground-inverse, #F0F0EF)",
                    }}
                  >
                    {amountStr}
                  </div>
                </div>
              </div>
            )})}
          </div>

          {/* Arrow */}
          <ArrowRight
            style={{
              width: 24,
              height: 24,
              color: "var(--foreground-muted, var(--foreground-muted, #848483))",
            }}
          />

          {/* Destination token logo */}
          {toToken && (
            <div className="relative shrink-0 group/logo cursor-default z-0 hover:z-20">
              {toToken.logo ? (
                <img
                  src={toToken.logo}
                  alt={toToken.symbol}
                  className="rounded-full object-cover transition-transform group-hover/logo:scale-105"
                  style={{ width: 36, height: 36 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div
                  className="rounded-full flex items-center justify-center text-xs font-bold text-white transition-transform group-hover/logo:scale-105"
                  style={{
                    width: 36,
                    height: 36,
                    background:
                      "var(--interactive-button-primary-background, var(--foreground-brand, #006BF4))",
                  }}
                >
                  {toToken.symbol.slice(0, 2)}
                </div>
              )}
              {mode === "deposit" && opportunity?.logo && (
                <img
                   src={opportunity.logo}
                   alt="Protocol Overlay"
                   className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white object-cover bg-white pointer-events-none"
                />
              )}

              {/* Tooltip */}
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 group-hover/logo:opacity-100 transition-opacity whitespace-nowrap pointer-events-none flex items-center justify-center z-50 text-center"
                style={{
                  background: "var(--background-inverse, var(--foreground-primary, #161615))",
                  boxShadow: "0px 1px 4px 0px #5555550D",
                  minWidth: 94,
                  height: 30,
                  borderRadius: 4,
                  gap: 8,
                  padding: "6px 10px",
                  fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                  fontWeight: 400,
                  fontSize: 14,
                  lineHeight: "18px",
                  color: "var(--foreground-inverse, #F0F0EF)",
                }}
              >
                {mode === "deposit" ? (
                  displayToAmountTokens && displayToAmountTokens !== "—"
                    ? `${displayToAmountTokens} ${destTokenSymbol} on ${opportunity?.title || opportunity?.protocol || "Opportunity"}`
                    : `— ${destTokenSymbol} on ${opportunity?.title || opportunity?.protocol || "Opportunity"}`
                ) : (
                  displayToAmountTokens && displayToAmountTokens !== "—"
                    ? `${displayToAmountTokens} ${destTokenSymbol}`
                    : `— ${destTokenSymbol}`
                )}
              </div>
            </div>
          )}
        </div>

        {/* Estimated time */}
        <div className="flex items-center gap-x-1">
          <span
            style={{
              fontFamily: "Geist, var(--font-geist-sans), sans-serif",
              fontWeight: 400,
              fontSize: "13px",
              lineHeight: "18px",
              color: "var(--widget-card-foreground-muted, var(--foreground-muted, #848483))",
            }}
          >
            in about {estimatedTime}
          </span>
          <Clock
            style={{
              width: 16,
              height: 16,
              color: "var(--widget-card-foreground-muted, var(--foreground-muted, #848483))",
            }}
          />
        </div>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Detail rows                                                    */}
        {/* -------------------------------------------------------------- */}
        <div className="flex flex-col gap-y-0">
        {/* You Swap / Send */}
        <div className="flex items-start justify-between px-1 py-3">
          <div className="flex items-start gap-x-2.5">
            {mode === "deposit" ? (
              <svg
                className="shrink-0 mt-0.5"
                style={{ width: 20, height: 20, color: "var(--foreground-muted, var(--foreground-muted, #848483))" }}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M16.25 3.75H3.75C3.25272 3.75 2.77581 3.94754 2.42417 4.29917C2.07254 4.65081 1.875 5.12772 1.875 5.625V14.375C1.875 14.8723 2.07254 15.3492 2.42417 15.7008C2.77581 16.0525 3.25272 16.25 3.75 16.25H16.25C16.7473 16.25 17.2242 16.0525 17.5758 15.7008C17.9275 15.3492 18.125 14.8723 18.125 14.375V5.625C18.125 5.12772 17.9275 4.65081 17.5758 4.29917C17.2242 3.94754 16.7473 3.75 16.25 3.75ZM3.125 7.5H16.875V8.75H12.5C12.3342 8.75 12.1753 8.81585 12.0581 8.93306C11.9408 9.05027 11.875 9.20924 11.875 9.375C11.875 9.87228 11.6775 10.3492 11.3258 10.7008C10.9742 11.0525 10.4973 11.25 10 11.25C9.50272 11.25 9.02581 11.0525 8.67417 10.7008C8.32254 10.3492 8.125 9.87228 8.125 9.375C8.125 9.20924 8.05915 9.05027 7.94194 8.93306C7.82473 8.81585 7.66576 8.75 7.5 8.75H3.125V7.5ZM3.75 5H16.25C16.4158 5 16.5747 5.06585 16.6919 5.18306C16.8092 5.30027 16.875 5.45924 16.875 5.625V6.25H3.125V5.625C3.125 5.45924 3.19085 5.30027 3.30806 5.18306C3.42527 5.06585 3.58424 5 3.75 5ZM16.25 15H3.75C3.58424 15 3.42527 14.9342 3.30806 14.8169C3.19085 14.6997 3.125 14.5408 3.125 14.375V10H6.9375C7.08095 10.7064 7.46421 11.3415 8.02234 11.7977C8.58047 12.2539 9.27915 12.5031 10 12.5031C10.7208 12.5031 11.4195 12.2539 11.9777 11.7977C12.5358 11.3415 12.9191 10.7064 13.0625 10H16.875V14.375C16.875 14.5408 16.8092 14.6997 16.6919 14.8169C16.5747 14.9342 16.4158 15 16.25 15Z" fill="currentColor"/>
              </svg>
            ) : mode === "send" ? (
              <Send className="shrink-0 mt-0.5" style={{ width: 20, height: 20, color: "var(--foreground-muted, var(--foreground-muted, #848483))" }} />
            ) : (
              <svg
                className="shrink-0 mt-0.5"
                style={{
                  width: 20,
                  height: 20,
                  color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                }}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M17.5 3.75V11.875C17.5 12.2065 17.3683 12.5245 17.1339 12.7589C16.8995 12.9933 16.5815 13.125 16.25 13.125H7.75859L8.56719 13.9328C8.62526 13.9909 8.67132 14.0598 8.70275 14.1357C8.73417 14.2116 8.75035 14.2929 8.75035 14.375C8.75035 14.4571 8.73417 14.5384 8.70275 14.6143C8.67132 14.6902 8.62526 14.7591 8.56719 14.8172C8.50912 14.8753 8.44018 14.9213 8.36431 14.9527C8.28844 14.9842 8.20712 15.0003 8.125 15.0003C8.04288 15.0003 7.96156 14.9842 7.88569 14.9527C7.80982 14.9213 7.74088 14.8753 7.68281 14.8172L5.80781 12.9422C5.7497 12.8841 5.7036 12.8152 5.67215 12.7393C5.6407 12.6635 5.62451 12.5821 5.62451 12.5C5.62451 12.4179 5.6407 12.3365 5.67215 12.2607C5.7036 12.1848 5.7497 12.1159 5.80781 12.0578L7.68281 10.1828C7.80009 10.0655 7.95915 9.99965 8.125 9.99965C8.29085 9.99965 8.44991 10.0655 8.56719 10.1828C8.68446 10.3001 8.75035 10.4591 8.75035 10.625C8.75035 10.7909 8.68446 10.9499 8.56719 11.0672L7.75859 11.875H16.25V3.75H7.5V4.375C7.5 4.54076 7.43415 4.69973 7.31694 4.81694C7.19973 4.93415 7.04076 5 6.875 5C6.70924 5 6.55027 4.93415 6.43306 4.81694C6.31585 4.69973 6.25 4.54076 6.25 4.375V3.75C6.25 3.41848 6.3817 3.10054 6.61612 2.86612C6.85054 2.6317 7.16848 2.5 7.5 2.5H16.25C16.5815 2.5 16.8995 2.6317 17.1339 2.86612C17.3683 3.10054 17.5 3.41848 17.5 3.75ZM13.125 15C12.9592 15 12.8003 15.0658 12.6831 15.1831C12.5658 15.3003 12.5 15.4592 12.5 15.625V16.25H3.75V8.125H12.2414L11.4328 8.93281C11.3155 9.05009 11.2497 9.20915 11.2497 9.375C11.2497 9.54085 11.3155 9.69991 11.4328 9.81719C11.5501 9.93446 11.7091 10.0003 11.875 10.0003C12.0409 10.0003 12.1999 9.93446 12.3172 9.81719L14.1922 7.94219C14.2503 7.88414 14.2964 7.81521 14.3279 7.73934C14.3593 7.66346 14.3755 7.58213 14.3755 7.5C14.3755 7.41787 14.3593 7.33654 14.3279 7.26066C14.2964 7.18479 14.2503 7.11586 14.1922 7.05781L12.3172 5.18281C12.1999 5.06554 12.0409 4.99965 11.875 4.99965C11.7091 4.99965 11.5501 5.06554 11.4328 5.18281C11.3155 5.30009 11.2497 5.45915 11.2497 5.625C11.2497 5.79085 11.3155 5.94991 11.4328 6.06719L12.2414 6.875H3.75C3.41848 6.875 3.10054 7.0067 2.86612 7.24112C2.6317 7.47554 2.5 7.79348 2.5 8.125V16.25C2.5 16.5815 2.6317 16.8995 2.86612 17.1339C3.10054 17.3683 3.41848 17.5 3.75 17.5H12.5C12.8315 17.5 13.1495 17.3683 13.3839 17.1339C13.6183 16.8995 13.75 16.5815 13.75 16.25V15.625C13.75 15.4592 13.6842 15.3003 13.5669 15.1831C13.4497 15.0658 13.2908 15 13.125 15Z"
                  fill="currentColor"
                />
              </svg>
            )}
            <div className="flex flex-col">
              <span
                style={{
                  fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                  fontWeight: 500,
                  fontSize: "14px",
                  color: "var(--foreground-primary, var(--foreground-primary, #161615))",
                }}
              >
                {mode === "deposit"
                  ? "Paying with"
                  : mode === "send"
                    ? "You Send"
                    : "You Swap"}
              </span>
              <span
                style={{
                  fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                  fontSize: "13px",
                  color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                }}
              >
                {sourceLabel}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span
              style={{
                fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                fontWeight: 500,
                fontSize: "14px",
                color: "var(--foreground-primary, var(--foreground-primary, #161615))",
              }}
            >
              {displayFromAmountUsd}{" "}
              <span style={{ fontWeight: 400 }}>USD</span>
            </span>
            {hasBreakdown && (
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="flex items-center gap-x-0.5 hover:opacity-80 transition-opacity"
                style={{
                  fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                  fontSize: "13px",
                  color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                }}
              >
                {showDetails ? "hide details" : "view details"}
                {showDetails ? (
                  <ChevronUp style={{ width: 14, height: 14 }} />
                ) : (
                  <ChevronDown style={{ width: 14, height: 14 }} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Expanded source breakdown — white card, max 200px scrollable */}
        {showDetails && intentSources.length > 0 && (
          <div
            className="ml-7 mb-2 overflow-y-auto"
            style={{
              maxHeight: "200px",
              background: "var(--widget-background, #F9F9F8)",
              borderRadius: "10px",
              padding: "4px 0",
            }}
          >
            {intentSources.map((src, idx) => {
              const tokenLogo = getTokenLogo(src.chain.id, src.token.contractAddress, src.token.symbol);
              return (
              <div
                key={`intent-src-${idx}`}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="flex items-center gap-x-2">
                  {tokenLogo ? (
                    <img
                      src={tokenLogo}
                      alt={src.token.symbol}
                      className="rounded-full object-cover"
                      style={{ width: 24, height: 24 }}
                    />
                  ) : (
                    <div
                      className="rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{
                        width: 24,
                        height: 24,
                        background:
                          "var(--interactive-button-primary-background, var(--foreground-brand, #006BF4))",
                      }}
                    >
                      {src.token.symbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span
                      style={{
                        fontFamily:
                          "Geist, var(--font-geist-sans), sans-serif",
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "var(--foreground-primary, var(--foreground-primary, #161615))",
                      }}
                    >
                      {src.token.symbol}
                    </span>
                    <span
                      style={{
                        fontFamily:
                          "Geist, var(--font-geist-sans), sans-serif",
                        fontSize: "12px",
                        color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                      }}
                    >
                      {src.chain.name}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    style={{
                      fontFamily:
                        "Geist, var(--font-geist-sans), sans-serif",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--foreground-primary, var(--foreground-primary, #161615))",
                    }}
                  >
                    ${Number((src as any).value || src.amount || 0).toFixed(2)}
                  </span>
                  <span
                    style={{
                      fontFamily:
                        "Geist, var(--font-geist-sans), sans-serif",
                      fontSize: "12px",
                      color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                    }}
                  >
                    {Number(src.amount || 0).toFixed(4)} {src.token.symbol}
                  </span>
                </div>
              </div>
            )})}
          </div>
        )}

        {/* Separator */}
        <div
          style={{
            height: "1px",
            background: "var(--border-default, var(--border-default, #E8E8E7))",
          }}
        />

        {/* Total Fees */}
        <div className="flex items-start justify-between px-1 py-3">
          <div className="flex items-start gap-x-2.5">
            <svg
              className="shrink-0 mt-0.5"
              style={{
                width: 20,
                height: 20,
                color: "var(--red-400, var(--foreground-error, #DC5253))",
              }}
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18.4375 5.13833L16.8834 3.52833C16.7628 3.40324 16.5992 3.33296 16.4286 3.33296C16.258 3.33296 16.0944 3.40324 15.9737 3.52833C15.8531 3.65343 15.7853 3.82309 15.7853 4C15.7853 4.17691 15.8531 4.34657 15.9737 4.47167L17.5262 6.08333C17.6462 6.20785 17.7138 6.3765 17.7143 6.5525V13.3333C17.7143 13.5101 17.6465 13.6797 17.526 13.8047C17.4054 13.9298 17.2419 14 17.0714 14C16.9009 14 16.7374 13.9298 16.6168 13.8047C16.4963 13.6797 16.4286 13.5101 16.4286 13.3333V10C16.4286 9.46957 16.2254 8.96086 15.8637 8.58579C15.502 8.21071 15.0115 8 14.5 8H13.2143V4C13.2143 3.46957 13.0111 2.96086 12.6494 2.58579C12.2877 2.21071 11.7972 2 11.2857 2H4.85714C4.34565 2 3.85511 2.21071 3.49344 2.58579C3.13176 2.96086 2.92857 3.46957 2.92857 4V16.6667H1.64286C1.47236 16.6667 1.30885 16.7369 1.18829 16.8619C1.06773 16.987 1 17.1565 1 17.3333C1 17.5101 1.06773 17.6797 1.18829 17.8047C1.30885 17.9298 1.47236 18 1.64286 18H14.5C14.6705 18 14.834 17.9298 14.9546 17.8047C15.0751 17.6797 15.1428 17.5101 15.1428 17.3333C15.1428 17.1565 15.0751 16.987 14.9546 16.8619C14.834 16.7369 14.6705 16.6667 14.5 16.6667H13.2143V9.33333H14.5C14.6705 9.33333 14.834 9.40357 14.9546 9.5286C15.0751 9.65362 15.1428 9.82319 15.1428 10V13.3333C15.1428 13.8638 15.346 14.3725 15.7077 14.7475C16.0694 15.1226 16.5599 15.3333 17.0714 15.3333C17.5829 15.3333 18.0734 15.1226 18.4351 14.7475C18.7968 14.3725 19 13.8638 19 13.3333V6.5525C19.001 6.28993 18.9517 6.02977 18.8552 5.78705C18.7586 5.54432 18.6167 5.32384 18.4375 5.13833ZM4.21428 16.6667V4C4.21428 3.82319 4.28201 3.65362 4.40257 3.5286C4.52313 3.40357 4.68664 3.33333 4.85714 3.33333H11.2857C11.4562 3.33333 11.6197 3.40357 11.7403 3.5286C11.8608 3.65362 11.9286 3.82319 11.9286 4V16.6667H4.21428ZM10.6428 8.66667C10.6428 8.84348 10.5751 9.01305 10.4546 9.13807C10.334 9.2631 10.1705 9.33333 9.99999 9.33333H6.14285C5.97236 9.33333 5.80884 9.2631 5.68828 9.13807C5.56773 9.01305 5.5 8.84348 5.5 8.66667C5.5 8.48986 5.56773 8.32029 5.68828 8.19526C5.80884 8.07024 5.97236 8 6.14285 8H9.99999C10.1705 8 10.334 8.07024 10.4546 8.19526C10.5751 8.32029 10.6428 8.48986 10.6428 8.66667Z"
                fill="currentColor"
              />
            </svg>
            <div className="flex flex-col">
              <span
                style={{
                  fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                  fontWeight: 500,
                  fontSize: "14px",
                  color: "var(--foreground-primary, var(--foreground-primary, #161615))",
                }}
              >
                Total Fees
              </span>
              <span
                style={{
                  fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                  fontSize: "13px",
                  color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                }}
              >
                Network &amp; protocol
              </span>
            </div>
          </div>
          <span
            style={{
              fontFamily: "Geist, var(--font-geist-sans), sans-serif",
              fontWeight: 500,
              fontSize: "14px",
              color: "var(--red-400, var(--foreground-error, #DC5253))",
            }}
          >
            {isLoading ? "…" : `- ${displayFeeUsd}`}{" "}
            <span style={{ fontWeight: 400 }}>USD</span>
          </span>
        </div>

        {/* Separator */}
        <div
          style={{
            height: "1px",
            background: "var(--border-default, var(--border-default, #E8E8E7))",
          }}
        />

        {/* You Receive */}
        <div className="flex items-start justify-between px-1 py-3">
          <div className="flex items-start gap-x-2.5">
            {mode === "deposit" ? (
              <svg
                className="shrink-0 mt-0.5"
                style={{ width: 20, height: 20, color: "var(--foreground-muted, var(--foreground-muted, #848483))" }}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M14.375 3.81328V2.5C14.375 2.16848 14.2433 1.85054 14.0089 1.61612C13.7745 1.3817 13.4565 1.25 13.125 1.25H6.875C6.54348 1.25 6.22554 1.3817 5.99112 1.61612C5.7567 1.85054 5.625 2.16848 5.625 2.5V3.81328C4.91962 3.95802 4.28574 4.34162 3.83031 4.89938C3.37488 5.45714 3.12577 6.15492 3.125 6.875V15.625C3.125 16.4538 3.45424 17.2487 4.04029 17.8347C4.62634 18.4208 5.4212 18.75 6.25 18.75H13.75C14.5788 18.75 15.3737 18.4208 15.9597 17.8347C16.5458 17.2487 16.875 16.4538 16.875 15.625V6.875C16.8742 6.15492 16.6251 5.45714 16.1697 4.89938C15.7143 4.34162 15.0804 3.95802 14.375 3.81328ZM13.125 3.75H11.875V2.5H13.125V3.75ZM9.375 3.75V2.5H10.625V3.75H9.375ZM8.125 2.5V3.75H6.875V2.5H8.125ZM15.625 15.625C15.625 16.1223 15.4275 16.5992 15.0758 16.9508C14.7242 17.3025 14.2473 17.5 13.75 17.5H6.25C5.75272 17.5 5.27581 17.3025 4.92417 16.9508C4.57254 16.5992 4.375 16.1223 4.375 15.625V6.875C4.375 6.37772 4.57254 5.90081 4.92417 5.54917C5.27581 5.19754 5.75272 5 6.25 5H13.75C14.2473 5 14.7242 5.19754 15.0758 5.54917C15.4275 5.90081 15.625 6.37772 15.625 6.875V15.625ZM12.5 12.5C12.5 12.9973 12.3025 13.4742 11.9508 13.8258C11.5992 14.1775 11.1223 14.375 10.625 14.375V15C10.625 15.1658 10.5592 15.3247 10.4419 15.4419C10.3247 15.5592 10.1658 15.625 10 15.625C9.83424 15.625 9.67527 15.5592 9.55806 15.4419C9.44085 15.3247 9.375 15.1658 9.375 15V14.375H8.75C8.58424 14.375 8.42527 14.3092 8.30806 14.1919C8.19085 14.0747 8.125 13.9158 8.125 13.75C8.125 13.5842 8.19085 13.4253 8.30806 13.3081C8.42527 13.1908 8.58424 13.125 8.75 13.125H10.625C10.7908 13.125 10.9497 13.0592 11.0669 12.9419C11.1842 12.8247 11.25 12.6658 11.25 12.5C11.25 12.3342 11.1842 12.1753 11.0669 12.0581C10.9497 11.9408 10.7908 11.875 10.625 11.875H9.375C8.87772 11.875 8.40081 11.6775 8.04917 11.3258C7.69754 10.9742 7.5 10.4973 7.5 10C7.5 9.50272 7.69754 9.02581 8.04917 8.67417C8.40081 8.32254 8.87772 8.125 9.375 8.125V7.5C9.375 7.33424 9.44085 7.17527 9.55806 7.05806C9.67527 6.94085 9.83424 6.875 10 6.875C10.1658 6.875 10.3247 6.94085 10.4419 7.05806C10.5592 7.17527 10.625 7.33424 10.625 7.5V8.125H11.25C11.4158 8.125 11.5747 8.19085 11.6919 8.30806C11.8092 8.42527 11.875 8.58424 11.875 8.75C11.875 8.91576 11.8092 9.07473 11.6919 9.19194C11.5747 9.30915 11.4158 9.375 11.25 9.375H9.375C9.20924 9.375 9.05027 9.44085 8.93306 9.55806C8.81585 9.67527 8.75 9.83424 8.75 10C8.75 10.1658 8.81585 10.3247 8.93306 10.4419C9.05027 10.5592 9.20924 10.625 9.375 10.625H10.625C11.1223 10.625 11.5992 10.8225 11.9508 11.1742C12.3025 11.5258 12.5 12.0027 12.5 12.5Z" fill="currentColor"/>
              </svg>
            ) : (
              <svg
                className="shrink-0 mt-0.5"
                style={{
                  width: 20,
                  height: 20,
                  color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                }}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M17.9945 11.0203C17.762 10.8412 17.4913 10.7182 17.2035 10.6609C16.9157 10.6036 16.6185 10.6135 16.3352 10.6898L13.0664 11.4414C13.1425 11.1201 13.1448 10.7858 13.0733 10.4636C13.0017 10.1413 12.8582 9.83934 12.6534 9.58041C12.4486 9.32149 12.1878 9.11228 11.8907 8.96847C11.5935 8.82465 11.2676 8.74996 10.9375 8.75H7.02656C6.69812 8.74918 6.37278 8.81345 6.06932 8.93909C5.76587 9.06474 5.49032 9.24927 5.25859 9.48203L3.49141 11.25H1.25C0.918479 11.25 0.600537 11.3817 0.366117 11.6161C0.131696 11.8505 0 12.1685 0 12.5L0 15.625C0 15.9565 0.131696 16.2745 0.366117 16.5089C0.600537 16.7433 0.918479 16.875 1.25 16.875H9.375C9.4261 16.875 9.47701 16.8687 9.52656 16.8562L14.5266 15.6062C14.5584 15.5987 14.5896 15.5882 14.6195 15.575L17.6562 14.2828L17.6906 14.2672C17.9825 14.1214 18.2324 13.9036 18.4168 13.6345C18.6013 13.3654 18.7142 13.0537 18.7449 12.7289C18.7756 12.4041 18.7231 12.0768 18.5924 11.7779C18.4617 11.479 18.257 11.2183 17.9977 11.0203H17.9945ZM1.25 12.5H3.125V15.625H1.25V12.5ZM17.143 13.1414L14.1742 14.4055L9.29688 15.625H4.375V12.1336L6.14297 10.3664C6.25862 10.2498 6.39629 10.1574 6.54798 10.0945C6.69967 10.0316 6.86235 9.99948 7.02656 10H10.9375C11.1861 10 11.4246 10.0988 11.6004 10.2746C11.7762 10.4504 11.875 10.6889 11.875 10.9375C11.875 11.1861 11.7762 11.4246 11.6004 11.6004C11.4246 11.7762 11.1861 11.875 10.9375 11.875H8.75C8.58424 11.875 8.42527 11.9408 8.30806 12.0581C8.19085 12.1753 8.125 12.3342 8.125 12.5C8.125 12.6658 8.19085 12.8247 8.30806 12.9419C8.42527 13.0592 8.58424 13.125 8.75 13.125H11.25C11.297 13.1249 11.3439 13.1196 11.3898 13.1094L16.6242 11.9055L16.6484 11.8992C16.8082 11.8549 16.9788 11.8712 17.1273 11.945C17.2758 12.0188 17.3917 12.1449 17.4528 12.2991C17.5139 12.4533 17.5158 12.6246 17.4582 12.7801C17.4005 12.9356 17.2874 13.0643 17.1406 13.1414H17.143ZM12.0578 6.06719C11.9405 5.94991 11.8747 5.79085 11.8747 5.625C11.8747 5.45915 11.9405 5.30009 12.0578 5.18281C12.1751 5.06554 12.3341 4.99965 12.5 4.99965C12.6659 4.99965 12.8249 5.06554 12.9422 5.18281L14.375 6.61641V1.875C14.375 1.70924 14.4408 1.55027 14.5581 1.43306C14.6753 1.31585 14.8342 1.25 15 1.25C15.1658 1.25 15.3247 1.31585 15.4419 1.43306C15.5592 1.55027 15.625 1.70924 15.625 1.875V6.61641L17.0578 5.18281C17.1751 5.06554 17.3341 4.99965 17.5 4.99965C17.6659 4.99965 17.8249 5.06554 17.9422 5.18281C18.0595 5.30009 18.1253 5.45915 18.1253 5.625C18.1253 5.79085 18.0595 5.94991 17.9422 6.06719L15.4422 8.56719C15.3841 8.6253 15.3152 8.6714 15.2393 8.70285C15.1635 8.7343 15.0821 8.75049 15 8.75049C14.9179 8.75049 14.8365 8.7343 14.7607 8.70285C14.6848 8.6714 14.6159 8.6253 14.5578 8.56719L12.0578 6.06719Z"
                  fill="currentColor"
                />
              </svg>
            )}
            <div className="flex flex-col">
              <span
                style={{
                  fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                  fontWeight: 500,
                  fontSize: "14px",
                  color: "var(--foreground-primary, var(--foreground-primary, #161615))",
                }}
              >
                {mode === "deposit"
                  ? "You Deposit"
                  : mode === "send"
                    ? "Recipient Receives"
                    : "You Receive"}
              </span>
              <span
                style={{
                  fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                  fontSize: "13px",
                  color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                }}
              >
                {mode === "deposit"
                  ? `${destTokenSymbol} on ${opportunity?.title || opportunity?.protocol || "Opportunity"}`
                  : destTokenSymbol}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span
              style={{
                fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                fontWeight: 500,
                fontSize: "14px",
                color: "var(--foreground-primary, var(--foreground-primary, #161615))",
              }}
            >
              {isLoading ? "…" : displayToAmountUsd}{" "}
              <span style={{ fontWeight: 400 }}>USD</span>
            </span>
            {displayToAmountTokens && (
              <span
                style={{
                  fontFamily: "Geist, var(--font-geist-sans), sans-serif",
                  fontSize: "13px",
                  color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                }}
              >
                {displayToAmountTokens}
              </span>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Swap now button                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Button
        onClick={onAccept}
        disabled={isLoading || (!toAmount && !intentDest)}
        className="w-full font-medium text-white transition-opacity hover:opacity-90 active:opacity-100 text-[14px]"
        style={{
          background: "var(--interactive-button-primary-background, var(--foreground-brand, #006BF4))",
          boxShadow: "0px 1px 4px 0px #5555550D",
          height: "48px",
          borderRadius: "12px",
        }}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "deposit" ? "Deposit now" : mode === "send" ? "Send now" : "Swap now"}
      </Button>
    </div>
  );
}
