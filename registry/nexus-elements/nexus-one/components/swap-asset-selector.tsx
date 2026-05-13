"use client";
import React, { useMemo, useState } from "react";
import { Search, X, Loader2, ChevronDown, ChevronUp, Info, Check } from "lucide-react";
import {
  type UserAsset,
  CHAIN_METADATA,
  formatTokenBalance,
} from "@avail-project/nexus-core";

export interface SwapTokenOption {
  contractAddress: string;
  symbol: string;
  name: string;
  logo?: string;
  decimals: number;
  balance: string;
  balanceInFiat: string;
  chainId?: number;
  chainName?: string;
  chainLogo?: string;
  userAmount?: string;
  userAmountUsd?: string;
  userAmountMode?: "token" | "usd";
  isUnified?: boolean;
  unifiedSymbol?: "USDC" | "USDT" | "ETH";
  sourceTokens?: SwapTokenOption[];
}

interface SwapAssetSelectorProps {
  title: string;
  swapBalance: UserAsset[] | null;
  staticOptions?: SwapTokenOption[];
  onSelect: (token: SwapTokenOption) => void;
  onBack: () => void;
  isMulti?: boolean;
  selectedTokens?: SwapTokenOption[];
  editingAssetIndex?: number | null;
  onToggle?: (token: SwapTokenOption) => void;
  onDone?: () => void;
  allowUnified?: boolean;
}

function deriveTokenOptions(swapBalance: UserAsset[]): SwapTokenOption[] {
  const tokens: SwapTokenOption[] = [];
  for (const asset of swapBalance) {
    for (const bd of asset.breakdown ?? []) {
      if (Number.parseFloat(bd.balance ?? "0") <= 0) continue;
      const chainMeta = bd.chain?.id ? CHAIN_METADATA[bd.chain.id] : undefined;
      tokens.push({
        contractAddress: bd.contractAddress,
        symbol: bd.symbol ?? asset.symbol,
        name: bd.symbol ?? asset.symbol,
        logo: asset.icon ?? "",
        decimals: bd.decimals ?? asset.decimals ?? 18,
        balance:
          formatTokenBalance(bd.balance, {
            symbol: bd.symbol ?? asset.symbol,
            decimals: bd.decimals ?? asset.decimals ?? 18,
          }) ?? bd.balance,
        balanceInFiat:
          bd.balanceInFiat != null
            ? `$${Number(bd.balanceInFiat).toFixed(2)}`
            : "$0.00",
        chainId: bd.chain?.id,
        chainName: chainMeta?.name ?? bd.chain?.name,
        chainLogo: chainMeta?.logo ?? bd.chain?.logo,
      });
    }
  }
  const seen = new Map<string, SwapTokenOption>();
  for (const t of tokens) {
    seen.set(`${t.contractAddress.toLowerCase()}-${t.chainId}`, t);
  }
  return Array.from(seen.values());
}

/* ── Radio dot (circular) ── */
export const RadioDot = ({ selected }: { selected: boolean }) => (
  <div
    style={{
      width: 20, height: 20, borderRadius: "999px", boxSizing: "border-box",
      border: selected ? "none" : "2px solid #E8E8E7",
      backgroundColor: selected ? "#006BF4" : "#FFFFFE", display: "flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0,
    }}
  >
    {selected && (
      <div style={{ width: 8, height: 8, borderRadius: "999px", backgroundColor: "#FFFFFE" }} />
    )}
  </div>
);

const SelectionControl = ({
  selected,
  multi,
}: {
  selected: boolean;
  multi: boolean;
}) => {
  if (!multi) return <RadioDot selected={selected} />;

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: selected ? "#006BF4" : "#FFFFFE",
        border: selected ? "none" : "1.5px solid #E0E0DE",
        borderRadius: "5px",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        height: 20,
        justifyContent: "center",
        width: 20,
      }}
    >
      {selected && <Check style={{ color: "#FFFFFE", height: 14, width: 14 }} />}
    </div>
  );
};

/* ── Chain logo cluster ── */
const ChainLogos = ({ tokens }: { tokens: SwapTokenOption[] }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const uniqueChains = useMemo(() => {
    const seen = new Set<number>();
    const out: { id: number; logo?: string; name?: string; balance?: string; balanceInFiat?: string }[] = [];
    for (const t of tokens) {
      if (t.chainId && !seen.has(t.chainId)) {
        seen.add(t.chainId);
        out.push({
          id: t.chainId,
          logo: t.chainLogo,
          name: t.chainName,
          balance: t.balance,
          balanceInFiat: t.balanceInFiat,
        });
      }
    }
    return out;
  }, [tokens]);

  const maxShow = 3;
  const shown = uniqueChains.slice(0, maxShow);
  const extra = uniqueChains.length - maxShow;

  return (
    <div
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{ display: "flex", alignItems: "center", gap: 2, position: "relative" }}
    >
      {showTooltip && uniqueChains.length > 1 && (
        <div
          style={{
            backgroundColor: "#FFFFFE",
            border: "1px solid #E8E8E7",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(22,22,21,0.12)",
            left: 0,
            minWidth: 220,
            padding: "10px 12px",
            position: "absolute",
            top: "calc(100% + 8px)",
            zIndex: 20,
          }}
        >
          <div style={{ color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8 }}>
            UNIFIED · {uniqueChains.length} CHAINS
          </div>
          {uniqueChains.slice(0, 6).map((chain) => (
            <div key={chain.id} style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0" }}>
              <div style={{ alignItems: "center", display: "flex", gap: 7, minWidth: 0 }}>
                {chain.logo ? (
                  <img src={chain.logo} alt="" style={{ borderRadius: "999px", height: 14, objectFit: "cover", width: 14 }} />
                ) : (
                  <div style={{ backgroundColor: "#E8E8E7", borderRadius: "999px", height: 14, width: 14 }} />
                )}
                <span style={{ color: "#363635", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {chain.name || "Unknown chain"}
                </span>
              </div>
              <span style={{ color: "#161615", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                {String(chain.balance || "").replace(/\s+[^\s]+$/, "") || chain.balanceInFiat || "0"}
              </span>
            </div>
          ))}
        </div>
      )}
      {shown.map((c, i) =>
        c.logo ? (
          <img
            key={c.id}
            src={c.logo}
            alt=""
            style={{ width: 16, height: 16, borderRadius: "999px", objectFit: "cover", border: "1px solid #fff" }}
          />
        ) : (
          <div key={c.id} style={{ width: 16, height: 16, borderRadius: "999px", backgroundColor: "#E8E8E7" }} />
        )
      )}
      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483", marginLeft: 2 }}>
        {uniqueChains.length} chain{uniqueChains.length !== 1 ? "s" : ""}
      </span>
    </div>
  );
};

/* ── Filter tabs ── */
type FilterTab = "all" | "native" | "stables" | "custom";
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "native", label: "Native" },
  { key: "stables", label: "Stables" },
  { key: "custom", label: "Custom" },
];
const STABLE_SYMBOLS = new Set(["GHO", "USDC", "ctUSD", "USDT", "EURC", "PYUSD", "USDe", "DAI", "xDAI", "TUSD", "RLUSD", "AUSD", "USD0", "sUSD", "BUSD", "USDM", "USDS"]);

function isNativeToken(t: SwapTokenOption) {
  const sym = t.symbol.toUpperCase();
  const chain = (t.chainName || "").toLowerCase();
  
  if (sym === "ETH") return !chain.includes("bnb") && !chain.includes("bsc") && !chain.includes("polygon") && !chain.includes("monad") && !chain.includes("hyperevm");
  if (sym === "POL" || sym === "MATIC") return chain.includes("polygon");
  if (sym === "HYPE") return chain.includes("hyperevm");
  if (sym === "MON") return chain.includes("monad");
  if (sym === "BNB") return chain.includes("bnb") || chain.includes("bsc");
  if (sym === "AVAX") return chain.includes("avalanche");
  if (sym === "FTM") return chain.includes("fantom");
  if (sym === "CELO") return chain.includes("celo");
  if (sym === "SUI") return chain.includes("sui");
  if (sym === "APT") return chain.includes("aptos");
  if (sym === "SOL") return chain.includes("solana");
  return false;
}

const MIN_FIAT_THRESHOLD = 1;
const UNIFIED_MAINNET_CHAIN_IDS = new Set([
  1, 10, 56, 137, 143, 999, 4114, 8217, 8453, 42161, 43114, 534352, 4326,
]);

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatBalanceWithSymbol = (token: Pick<SwapTokenOption, "balance" | "symbol">) => {
  const balance = String(token.balance ?? "").trim();
  const symbol = token.symbol?.trim();
  if (!symbol) return balance || "0";
  if (new RegExp(`(?:^|\\s)${escapeRegExp(symbol)}$`, "i").test(balance)) {
    return balance || `0 ${symbol}`;
  }
  return `${balance || "0"} ${symbol}`;
};

function getUnifiedSymbol(token: Pick<SwapTokenOption, "symbol" | "chainId">) {
  if (token.chainId && !UNIFIED_MAINNET_CHAIN_IDS.has(token.chainId)) {
    return null;
  }

  const symbol = token.symbol.toUpperCase();
  if (symbol.includes("USDC") || symbol === "USDM") return "USDC" as const;
  if (symbol.includes("USDT")) return "USDT" as const;
  if (symbol === "ETH") return "ETH" as const;
  return null;
}

function sameTokenOption(a?: SwapTokenOption, b?: SwapTokenOption) {
  if (!a || !b) return false;
  if (a.isUnified || b.isUnified) {
    return Boolean(a.isUnified && b.isUnified && a.unifiedSymbol === b.unifiedSymbol);
  }
  return (
    a.contractAddress.toLowerCase() === b.contractAddress.toLowerCase() &&
    a.chainId === b.chainId
  );
}

export function SwapAssetSelector({
  title,
  swapBalance,
  staticOptions,
  onSelect,
  onBack,
  isMulti,
  selectedTokens = [],
  editingAssetIndex = null,
  onToggle,
  onDone,
  allowUnified = false,
}: SwapAssetSelectorProps) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showBelowMin, setShowBelowMin] = useState(false);
  const [showAllBelowMin, setShowAllBelowMin] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [chainQuery, setChainQuery] = useState("");
  const [selectedChainFilter, setSelectedChainFilter] = useState<number | null>(null);

  const allTokens = useMemo<SwapTokenOption[]>(() => {
    if (staticOptions) return staticOptions;
    if (!swapBalance) return [];
    return deriveTokenOptions(swapBalance);
  }, [swapBalance, staticOptions]);

  /* Search + tab + chain filter */
  const filtered = useMemo(() => {
    let result = allTokens;
    if (selectedChainFilter !== null) {
      result = result.filter(t => t.chainId === selectedChainFilter);
    }
    if (query.trim()) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter((t) => {
        return terms.every((term) =>
          t.symbol.toLowerCase().includes(term) ||
          t.name.toLowerCase().includes(term) ||
          (t.chainName ?? "").toLowerCase().includes(term) ||
          t.contractAddress.toLowerCase().includes(term)
        );
      });
    }
    if (activeTab === "native") result = result.filter(isNativeToken);
    else if (activeTab === "stables") result = result.filter((t) => STABLE_SYMBOLS.has(t.symbol));
    else if (activeTab === "custom") result = result.filter((t) => !isNativeToken(t) && !STABLE_SYMBOLS.has(t.symbol));
    return result;
  }, [allTokens, query, activeTab, selectedChainFilter]);

  /* Split into above/below minimum */
  const { aboveMin, belowMin } = useMemo(() => {
    const above: SwapTokenOption[] = [];
    const below: SwapTokenOption[] = [];
    for (const t of filtered) {
      const fiat = Number(t.balanceInFiat.replace(/[^0-9.]/g, "") || 0);
      if (fiat >= MIN_FIAT_THRESHOLD) above.push(t);
      else below.push(t);
    }
    return { aboveMin: above, belowMin: below };
  }, [filtered]);

  /* Group by symbol */
  const groupedFiltered = useMemo(() => {
    const groups: Record<string, SwapTokenOption[]> = {};
    for (const token of aboveMin) {
      const unifiedSym = allowUnified ? getUnifiedSymbol(token) : null;
      const key = unifiedSym ?? `${token.contractAddress}-${token.chainId}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(token);
    }
    return Object.values(groups)
      .map((group) => {
        let totalFiatVal = 0;
        let totalBalVal = 0;
        for (const t of group) {
          totalFiatVal += Number(t.balanceInFiat.replace(/[^0-9.]/g, "") || 0);
          totalBalVal += Number(t.balance.replace(/[^0-9.]/g, "") || 0);
        }
        const unifiedSym = allowUnified ? getUnifiedSymbol(group[0]) : null;
        return {
          symbol: unifiedSym ?? group[0].symbol,
          logo: group[0].logo,
          totalFiat: totalFiatVal,
          totalFiatStr: `$${totalFiatVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
          totalBalStr: `${totalBalVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${unifiedSym ?? group[0].symbol}`,
          tokens: group,
          isUnifiedCandidate: Boolean(unifiedSym && group.length > 1),
        };
      })
      .sort((a, b) => b.totalFiat - a.totalFiat);
  }, [aboveMin, allowUnified]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const isTokenSelectedInOtherSlot = (token: SwapTokenOption) =>
    selectedTokens.some((st, idx) => idx !== editingAssetIndex && sameTokenOption(st, token));

  const isTokenSelectedInCurrentSlot = (token: SwapTokenOption) => {
    if (isMulti) return selectedTokens.some((st) => sameTokenOption(st, token));
    if (editingAssetIndex === null) return false;
    const st = selectedTokens[editingAssetIndex];
    return sameTokenOption(st, token);
  };

  const isGroupUnifiedSelectedInOtherSlot = (group: typeof groupedFiltered[0]) => {
    const relevantTokens = isMulti
      ? selectedTokens
      : selectedTokens.filter((_, idx) => idx !== editingAssetIndex);
    return relevantTokens.some((st) => st.isUnified && st.unifiedSymbol === group.symbol);
  };

  const isGroupUnifiedSelectedInCurrentSlot = (group: typeof groupedFiltered[0]) => {
    if (isMulti) {
      return selectedTokens.some((st) => st.isUnified && st.unifiedSymbol === group.symbol);
    }
    if (editingAssetIndex === null) return false;
    const st = selectedTokens[editingAssetIndex];
    return Boolean(st?.isUnified && st.unifiedSymbol === group.symbol);
  };
  
  const isAnyTokenInGroupSelectedInOtherSlot = (group: typeof groupedFiltered[0]) => {
    const relevantTokens = isMulti
      ? selectedTokens
      : selectedTokens.filter((_, idx) => idx !== editingAssetIndex);
    return relevantTokens.some((st) =>
      group.tokens.some((gt) => sameTokenOption(gt, st)) ||
      (st.isUnified && st.unifiedSymbol === group.symbol)
    );
  };

  /* ── Render a single-chain token row ── */
  const renderTokenRow = (token: SwapTokenOption, indent = false, isDisabledByUnified = false) => {
    const selectedInOther = !isMulti && isTokenSelectedInOtherSlot(token);
    if (selectedInOther) return null;

    const selectedInCurrent = isTokenSelectedInCurrentSlot(token);
    const disabled = isDisabledByUnified;
    return (
      <button
        key={`${token.contractAddress}-${token.chainId}`}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (isMulti && onToggle) onToggle(token);
          else onSelect(token);
        }}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", paddingLeft: indent ? "40px" : "16px",
          backgroundColor: "transparent", border: "none", cursor: disabled ? "not-allowed" : "pointer",
          borderBottom: "1px solid #F0F0EF", boxSizing: "border-box",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SelectionControl selected={selectedInCurrent} multi={Boolean(isMulti)} />
          {/* Token logo with chain badge */}
          <div style={{ position: "relative", flexShrink: 0, width: 40, height: 40 }}>
            {token.logo ? (
              <img
                src={token.logo} alt={token.symbol}
                style={{ width: 40, height: 40, borderRadius: "999px", objectFit: "cover" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div style={{
                width: 40, height: 40, borderRadius: "999px", backgroundColor: "#006BF4",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 14, fontWeight: 700,
              }}>
                {token.symbol.slice(0, 2)}
              </div>
            )}
            {token.chainLogo && (
              <img
                src={token.chainLogo} alt={token.chainName}
                style={{
                  position: "absolute", bottom: -2, right: -2,
                  width: 22, height: 22, borderRadius: "999px",
                  border: "2px solid #FFFFFE", objectFit: "cover",
                }}
              />
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 15, color: "#161615" }}>
              {token.symbol}
            </span>
            {token.chainName && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>
                  {token.chainName}
                </span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 14, color: "#161615" }}>
            {formatBalanceWithSymbol(token)}
          </span>
          <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>
            ≈ {token.balanceInFiat}
          </span>
        </div>
      </button>
    );
  };

  /* ── Render a unified (multi-chain) group row ── */
  const renderGroupRow = (group: typeof groupedFiltered[0]) => {
    if (!group.isUnifiedCandidate) {
      return group.tokens.map((token) => renderTokenRow(token));
    }

    const unifiedSelectedInOther = !isMulti && isGroupUnifiedSelectedInOtherSlot(group);
    if (unifiedSelectedInOther) return null;

    const visibleTokensCount = group.tokens.filter(t => !isTokenSelectedInOtherSlot(t)).length;
    if (visibleTokensCount === 0) return null;

    const isExpanded = expandedGroups.has(group.symbol);
    const unifiedSelectedInCurrent = isGroupUnifiedSelectedInCurrentSlot(group);
    const anyIndividualSelectedInOther = isAnyTokenInGroupSelectedInOtherSlot(group);
    const anyIndividualSelectedInCurrent = group.tokens.some(isTokenSelectedInCurrentSlot);
    const isUnifiedHidden =
      anyIndividualSelectedInOther || anyIndividualSelectedInCurrent || group.totalFiat < 1;
    const unifiedToken: SwapTokenOption = {
      ...group.tokens[0],
      balance: group.totalBalStr.split(" ")[0] ?? group.tokens[0].balance,
      balanceInFiat: group.totalFiatStr,
      chainId: undefined,
      chainName: "All Chains",
      chainLogo: "/nexus-one/all-chains.png",
      contractAddress: `${group.symbol}-UNIFIED`,
      isUnified: true,
      name: group.symbol,
      sourceTokens: group.tokens,
      symbol: group.symbol,
      unifiedSymbol: group.symbol as "USDC" | "USDT" | "ETH",
    };
    
    return (
      <div key={group.symbol} style={{ display: "flex", flexDirection: "column" }}>
        <button
          onClick={(e) => {
             // If clicking the row itself, expand/collapse
             toggleGroup(group.symbol, e);
          }}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", backgroundColor: "transparent", border: "none",
            cursor: "pointer", borderBottom: "1px solid #F0F0EF", boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isUnifiedHidden ? <div style={{ width: 20, height: 20 }} /> : (
              <div onClick={(e) => {
                 e.stopPropagation();
                 if (isMulti && onToggle) onToggle(unifiedToken);
                 else onSelect(unifiedToken);
              }} style={{ cursor: "pointer" }}>
                <SelectionControl selected={unifiedSelectedInCurrent} multi={Boolean(isMulti)} />
              </div>
            )}
            <div style={{ position: "relative", flexShrink: 0, width: 40, height: 40 }}>
              {group.logo ? (
                <img
                  src={group.logo} alt={group.symbol}
                  style={{ width: 40, height: 40, borderRadius: "999px", objectFit: "cover" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: "999px", backgroundColor: "#006BF4",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 14, fontWeight: 700,
                }}>
                  {group.symbol.slice(0, 2)}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 15, color: "#161615" }}>
                  {group.symbol}
                </span>
                <span style={{
                  fontFamily: '"Geist", system-ui, sans-serif', fontSize: 11, fontWeight: 600,
                  color: "#006BF4", backgroundColor: "#E8F0FF", borderRadius: 4,
                  padding: "2px 8px", letterSpacing: "0.04em", lineHeight: "16px",
                }}>
                  UNIFIED
                </span>
              </div>
              <ChainLogos tokens={group.tokens} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 14, color: "#161615" }}>
                {group.totalBalStr}
              </span>
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>
                ≈ {group.totalFiatStr}
              </span>
            </div>
          </div>
        </button>
        {/* Expanded individual chain rows */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: isExpanded ? "1fr" : "0fr",
            opacity: isExpanded ? 1 : 0,
            transition: "grid-template-rows 0.3s ease, opacity 0.3s ease",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            {unifiedSelectedInCurrent
              ? null
              : group.tokens.map((token) => renderTokenRow(token, true, false))}
          </div>
        </div>
      </div>
    );
  };

  const isLoading = !staticOptions && swapBalance === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, width: "100%", padding: "16px", boxSizing: "border-box" }}>
      {/* Drawer Handle */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: "#E8E8E7" }} />
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, borderRadius: 8, border: "1px solid #E8E8E7",
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "#FFFFFE", cursor: "pointer", flexShrink: 0
        }}>
          <ChevronDown style={{ width: 16, height: 16, transform: "rotate(90deg)" }} />
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 18, fontWeight: 600, color: "#161615" }}>
            {title}
          </span>
          <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>
            Select token and chain
          </span>
        </div>
      </div>

      {/* Search */}
      <div style={{ paddingBottom: 8 }}>
        <div
          style={{
            display: "flex", alignItems: "center", height: 44, gap: 8, borderRadius: 12,
            border: "1px solid #E8E8E7", padding: "0 8px 0 16px", backgroundColor: "#F0F0EF",
          }}
        >
          <Search style={{ width: 20, height: 20, color: "#848483", flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search token, chain or address"
            style={{
              flex: 1, backgroundColor: "transparent", border: "none", outline: "none",
              fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14, color: "#161615",
              minWidth: 0
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <X style={{ width: 16, height: 16, color: "#848483" }} />
            </button>
          )}
          {/* Chain Selector Badge */}
          <button
            onClick={() => setShowChainSelector(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "4px 8px 4px 5px", borderRadius: 999,
              backgroundColor: "#FFFFFE", border: "1px solid #E8E8E7", cursor: "pointer",
              height: 38, flexShrink: 0, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)"
            }}
          >
            {selectedChainFilter === null ? (
               <img
                 src="/nexus-one/all-chains.png"
                 alt="All Chains"
                 style={{ width: 30, height: 30, borderRadius: "999px", objectFit: "cover" }}
               />
            ) : (
               <img
                 src={allTokens.find(t => t.chainId === selectedChainFilter)?.chainLogo}
                 style={{ width: 30, height: 30, borderRadius: "999px", objectFit: "cover" }}
               />
            )}
            <ChevronDown style={{ width: 14, height: 14, color: "#848483" }} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 0, backgroundColor: "#F0F0EF", borderRadius: 8, padding: 4, marginBottom: 8 }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: "6px 0", backgroundColor: activeTab === tab.key ? "#FFFFFE" : "transparent", border: "none",
              borderRadius: 6, cursor: "pointer", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, fontWeight: 500,
              color: activeTab === tab.key ? "#161615" : "#848483", boxShadow: activeTab === tab.key ? "0px 1px 2px rgba(0,0,0,0.05)" : "none",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Token list */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 12 }}>
            <Loader2 style={{ width: 20, height: 20, color: "#848483", animation: "spin 1s linear infinite" }} />
            <p style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14, color: "#848483" }}>Loading assets…</p>
          </div>
        ) : aboveMin.length === 0 && belowMin.length === 0 ? (
          <p style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14, color: "#848483", textAlign: "center", padding: "32px 0" }}>
            No tokens found
          </p>
        ) : (
          <div
            style={{
              border: "1px solid #E8E8E7", borderRadius: 14, overflow: "hidden",
              backgroundColor: "#FFFFFE",
            }}
          >
            {groupedFiltered.map((group) =>
              group.tokens.length === 1
                ? renderTokenRow(group.tokens[0])
                : renderGroupRow(group)
            )}

            {/* Tokens below minimum */}
            {belowMin.length > 0 && (
              <div style={{ borderTop: "1px solid #E8E8E7" }}>
                <button
                  onClick={() => setShowBelowMin((v) => !v)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px", backgroundColor: "transparent", border: "none", cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Info style={{ width: 18, height: 18, color: "#848483", flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 600, fontSize: 14, color: "#161615" }}>
                        Tokens below minimum
                      </span>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>
                        Hidden to prevent failed swaps
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* Small token logo cluster */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {belowMin.slice(0, 3).map((t, i) =>
                        t.logo ? (
                          <img
                            key={`bm-${t.contractAddress}-${t.chainId}`}
                            src={t.logo} alt=""
                            style={{ width: 18, height: 18, borderRadius: "999px", objectFit: "cover", marginLeft: i > 0 ? -6 : 0, border: "1.5px solid #fff" }}
                          />
                        ) : (
                          <div
                            key={`bm-${t.contractAddress}-${t.chainId}`}
                            style={{ width: 18, height: 18, borderRadius: "999px", backgroundColor: "#E8E8E7", marginLeft: i > 0 ? -6 : 0, border: "1.5px solid #fff" }}
                          />
                        )
                      )}
                      {belowMin.length > 3 && (
                        <div style={{
                          width: 18, height: 18, borderRadius: "999px", backgroundColor: "#161615",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "#fff", marginLeft: -6, border: "1.5px solid #fff",
                        }}>
                          +{belowMin.length - 3}
                        </div>
                      )}
                    </div>
                    {showBelowMin ? (
                      <ChevronUp style={{ width: 18, height: 18, color: "#848483" }} />
                    ) : (
                      <ChevronDown style={{ width: 18, height: 18, color: "#848483" }} />
                    )}
                  </div>
                </button>
                <div
                  aria-hidden={!showBelowMin}
                  style={{
                    borderTop: showBelowMin ? "1px solid #F0F0EF" : "0px solid transparent",
                    display: "grid",
                    gridTemplateRows: showBelowMin ? "1fr" : "0fr",
                    opacity: showBelowMin ? 1 : 0,
                    overflow: "hidden",
                    transition:
                      "grid-template-rows 240ms ease, opacity 180ms ease, border-top-width 240ms ease",
                  }}
                >
                  <div style={{ minHeight: 0, overflow: "hidden" }}>
                    <div style={{
                      display: "flex", alignItems: "flex-start", gap: 8, padding: showBelowMin ? "12px 16px" : "0 16px",
                      backgroundColor: "#FFF8F0", transition: "padding 240ms ease",
                    }}>
                      <span style={{ color: "#E5953E", fontSize: 14, lineHeight: "18px", flexShrink: 0 }}>⚠</span>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#6B6B6A", lineHeight: "18px" }}>
                        Tokens under $1 are unavailable for swaps — gas + protocol fees would exceed the value.
                      </span>
                    </div>
                    <div style={{ paddingBottom: showBelowMin ? "12px" : 0, transition: "padding-bottom 240ms ease" }}>
                      {belowMin.slice(0, showAllBelowMin ? belowMin.length : 3).map((token) => (
                        <div key={`${token.contractAddress}-${token.chainId}`} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 16px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ position: "relative", width: 28, height: 28 }}>
                              {token.logo ? (
                                <img src={token.logo} alt={token.symbol} style={{ width: 28, height: 28, borderRadius: "999px", objectFit: "cover" }} />
                              ) : (
                                <div style={{ width: 28, height: 28, borderRadius: "999px", backgroundColor: "#006BF4", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                                  {token.symbol.slice(0, 2)}
                                </div>
                              )}
                              {token.chainLogo && (
                                <img src={token.chainLogo} alt={token.chainName} style={{ position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: "999px", border: "1.5px solid #fff", objectFit: "cover" }} />
                              )}
                            </div>
                            <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 14, color: "#161615" }}>
                              {token.symbol} on {token.chainName}
                            </span>
                          </div>
                          <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14, color: "#161615", fontWeight: 500 }}>
                            {token.balanceInFiat}
                          </span>
                        </div>
                      ))}
                      {belowMin.length > 3 && !showAllBelowMin && (
                        <button
                          onClick={() => setShowAllBelowMin(true)}
                          style={{
                            backgroundColor: "transparent", border: "none", cursor: "pointer",
                            padding: "8px 16px", display: "flex", alignItems: "center", gap: 6,
                            color: "#006BF4", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, fontWeight: 500,
                          }}
                        >
                          Show {belowMin.length - 3} more
                          <ChevronDown style={{ width: 14, height: 14, color: "#006BF4" }} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Done button */}
      {isMulti && (
        <div style={{ paddingBottom: 8, marginTop: "auto" }}>
          <button
            onClick={onDone}
            style={{
              width: "100%", height: 52, display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: "#006BF4",
              color: "#FFFFFE",
              border: "none", borderRadius: 14, cursor: "pointer",
              fontFamily: '"Geist", system-ui, sans-serif', fontSize: 16, fontWeight: 600,
              boxShadow: "0px 1px 4px 0px #5555550D",
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* Chain Selector Modal */}
      {showChainSelector && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "#FFFFFE", zIndex: 50, display: "flex", flexDirection: "column",
          padding: "16px"
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <button 
              onClick={() => setShowChainSelector(false)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: "1px solid #E8E8E7",
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: "#FFFFFE", cursor: "pointer"
              }}
            >
              <ChevronDown style={{ width: 16, height: 16, transform: "rotate(90deg)" }} />
            </button>
            <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 16, fontWeight: 600, marginLeft: 12 }}>
              Select chain
            </span>
          </div>
          
          {/* Search */}
          <div style={{ paddingBottom: 16 }}>
            <div style={{
              display: "flex", alignItems: "center", height: 44, gap: 8, borderRadius: 12,
              border: "1px solid #006BF4", padding: "0 16px", backgroundColor: "#FFFFFE",
              boxShadow: "0 0 0 1px #006BF4"
            }}>
              <Search style={{ width: 20, height: 20, color: "#848483", flexShrink: 0 }} />
              <input
                value={chainQuery}
                onChange={(e) => setChainQuery(e.target.value)}
                placeholder="Search chains"
                style={{
                  flex: 1, backgroundColor: "transparent", border: "none", outline: "none",
                  fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14, color: "#161615",
                }}
              />
            </div>
          </div>
          
          {/* Chain list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{
              border: "1px solid #E8E8E7", borderRadius: 14, overflow: "hidden",
              backgroundColor: "#FFFFFE",
            }}>
              <button
                onClick={() => { setSelectedChainFilter(null); setShowChainSelector(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", padding: "12px 16px",
                  backgroundColor: "transparent", border: "none", borderBottom: "1px solid #F0F0EF",
                  cursor: "pointer", boxSizing: "border-box"
                }}
              >
                <RadioDot selected={selectedChainFilter === null} />
                <img src="/nexus-one/all-chains.png" alt="All Chains" style={{ marginLeft: 12, width: 32, height: 32, borderRadius: "999px", objectFit: "cover" }} />
                <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 15, fontWeight: 500, marginLeft: 12, color: "#161615" }}>
                  All Chains
                </span>
              </button>
              
              {/* Unique chains */}
              {Array.from(new Map(allTokens.filter(t => t.chainId).map(t => [t.chainId, t])).values())
                .filter(t => (t.chainName || "").toLowerCase().includes(chainQuery.toLowerCase()))
                .map(t => (
                  <button
                    key={`chain-${t.chainId}`}
                    onClick={() => { setSelectedChainFilter(t.chainId!); setShowChainSelector(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", padding: "12px 16px",
                      backgroundColor: "transparent", border: "none", borderBottom: "1px solid #F0F0EF",
                      cursor: "pointer", boxSizing: "border-box"
                    }}
                  >
                    <RadioDot selected={selectedChainFilter === t.chainId} />
                    <img src={t.chainLogo} alt={t.chainName} style={{ marginLeft: 12, width: 32, height: 32, borderRadius: "999px", objectFit: "cover" }} />
                    <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 15, fontWeight: 500, marginLeft: 12, color: "#161615" }}>
                      {t.chainName}
                    </span>
                  </button>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
