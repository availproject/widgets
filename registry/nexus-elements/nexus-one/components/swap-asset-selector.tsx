"use client";
import React, { useMemo, useState } from "react";
import { Search, X, Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
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
  userAmountMode?: "token" | "usd";
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

/* ── Chain logo cluster ── */
const ChainLogos = ({ tokens }: { tokens: SwapTokenOption[] }) => {
  const uniqueChains = useMemo(() => {
    const seen = new Set<number>();
    const out: { id: number; logo?: string }[] = [];
    for (const t of tokens) {
      if (t.chainId && !seen.has(t.chainId)) {
        seen.add(t.chainId);
        out.push({ id: t.chainId, logo: t.chainLogo });
      }
    }
    return out;
  }, [tokens]);

  const maxShow = 3;
  const shown = uniqueChains.slice(0, maxShow);
  const extra = uniqueChains.length - maxShow;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
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
  }, [allTokens, query, activeTab]);

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
    const getUnifiedSymbol = (symbol: string) => {
      const s = symbol.toUpperCase();
      if (s.includes("USDC") || s === "USDM") return "USDC";
      if (s.includes("USDT")) return "USDT";
      if (s.includes("ETH")) return "ETH";
      if (s.includes("BTC")) return "BTC";
      return symbol;
    };

    const groups: Record<string, SwapTokenOption[]> = {};
    for (const token of aboveMin) {
      const unifiedSym = getUnifiedSymbol(token.symbol);
      if (!groups[unifiedSym]) groups[unifiedSym] = [];
      groups[unifiedSym].push(token);
    }
    return Object.values(groups)
      .map((group) => {
        let totalFiatVal = 0;
        let totalBalVal = 0;
        for (const t of group) {
          totalFiatVal += Number(t.balanceInFiat.replace(/[^0-9.]/g, "") || 0);
          totalBalVal += Number(t.balance.replace(/[^0-9.]/g, "") || 0);
        }
        const unifiedSym = getUnifiedSymbol(group[0].symbol);
        return {
          symbol: unifiedSym,
          logo: group[0].logo,
          totalFiat: totalFiatVal,
          totalFiatStr: `$${totalFiatVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
          totalBalStr: `${totalBalVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${unifiedSym}`,
          tokens: group,
        };
      })
      .sort((a, b) => b.totalFiat - a.totalFiat);
  }, [aboveMin]);

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

  const toggleGroupSelection = (groupTokens: SwapTokenOption[], isFullySelected: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    // Unified selection: in single-select mode, we select the whole group as a single logical asset (unified).
    // But since onSelect only takes one token, how do we pass a unified token?
    // For now, if we click Unified, we can just pass the first token and maybe mark it?
    // Wait, the user said "only 1 asset can be selected at a time, there is no multi select".
    // If they select "Unified", it means they want to use all balances of that token across chains.
    // We can emit a special "unified" token option, or trigger onSelect multiple times?
    // Actually, let's just pass groupTokens array if onSelect supports it, or use onSelect with a special unified flag.
    // For now, let's adapt `SwapAssetSelector` to be strictly single select as requested.
  };

  const isTokenSelectedInOtherSlot = (token: SwapTokenOption) =>
    selectedTokens.some((st, idx) => idx !== editingAssetIndex && st.contractAddress === token.contractAddress && st.chainId === token.chainId);

  const isTokenSelectedInCurrentSlot = (token: SwapTokenOption) => {
    if (editingAssetIndex === null) return false;
    const st = selectedTokens[editingAssetIndex];
    if (!st) return false;
    return st.contractAddress === token.contractAddress && st.chainId === token.chainId;
  };

  const isGroupUnifiedSelectedInOtherSlot = (group: typeof groupedFiltered[0]) => {
    const relevantTokens = selectedTokens.filter((_, idx) => idx !== editingAssetIndex);
    return relevantTokens.some((st) => st.contractAddress === group.symbol + "-UNIFIED");
  };

  const isGroupUnifiedSelectedInCurrentSlot = (group: typeof groupedFiltered[0]) => {
    if (editingAssetIndex === null) return false;
    const st = selectedTokens[editingAssetIndex];
    if (!st) return false;
    return st.contractAddress === group.symbol + "-UNIFIED";
  };
  
  const isAnyTokenInGroupSelectedInOtherSlot = (group: typeof groupedFiltered[0]) => {
    const relevantTokens = selectedTokens.filter((_, idx) => idx !== editingAssetIndex);
    return relevantTokens.some((st) =>
      group.tokens.some((gt) => gt.contractAddress === st.contractAddress && gt.chainId === st.chainId) ||
      st.contractAddress === group.symbol + "-UNIFIED"
    );
  };

  /* ── Render a single-chain token row ── */
  const renderTokenRow = (token: SwapTokenOption, indent = false, isDisabledByUnified = false) => {
    const selectedInOther = isTokenSelectedInOtherSlot(token);
    if (selectedInOther) return null;

    const selectedInCurrent = isTokenSelectedInCurrentSlot(token);
    const disabled = isDisabledByUnified;
    // Also disable if it's already selected and we are adding a NEW asset, but we can rely on `selectedTokens` state from parent.
    // "once a token is selected, on next Add Asset that token should be disabled from selection"
    return (
      <button
        key={`${token.contractAddress}-${token.chainId}`}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onSelect(token);
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
          <RadioDot selected={selectedInCurrent} />
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
                  width: 16, height: 16, borderRadius: "999px",
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
                {token.chainLogo && (
                  <img src={token.chainLogo} alt="" style={{ width: 14, height: 14, borderRadius: "999px", objectFit: "cover" }} />
                )}
                <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>
                  {token.chainName}
                </span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 14, color: "#161615" }}>
            {token.balance} {token.symbol}
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
    const unifiedSelectedInOther = isGroupUnifiedSelectedInOtherSlot(group);
    if (unifiedSelectedInOther) return null;

    const visibleTokensCount = group.tokens.filter(t => !isTokenSelectedInOtherSlot(t)).length;
    if (visibleTokensCount === 0) return null;

    const isExpanded = expandedGroups.has(group.symbol);
    const unifiedSelectedInCurrent = isGroupUnifiedSelectedInCurrentSlot(group);
    const anyIndividualSelectedInOther = isAnyTokenInGroupSelectedInOtherSlot(group);
    const anyIndividualSelectedInCurrent = group.tokens.some(isTokenSelectedInCurrentSlot);
    
    // If an individual token is selected in another slot, the unified option is completely unavailable.
    // We will just hide the radio dot to prevent selection.
    // Also, if the total fiat value of all unified tokens is less than $1, hide it.
    const isUnifiedHidden = anyIndividualSelectedInOther || group.totalFiat < 1;
    // If an individual token is selected in the current slot, unified isn't hidden but we don't show it as selected.
    
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
                 onSelect({
                   ...group.tokens[0],
                   chainId: undefined,
                   chainName: "All Chains",
                   chainLogo: "/nexus-one/all-chains.png",
                   balance: group.totalBalStr.split(" ")[0],
                   balanceInFiat: group.totalFiatStr,
                   contractAddress: group.tokens[0].symbol + "-UNIFIED"
                 });
              }} style={{ cursor: "pointer" }}>
                <RadioDot selected={unifiedSelectedInCurrent} />
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
            {group.tokens.map((token) => renderTokenRow(token, true, false))}
          </div>
        </div>
      </div>
    );
  };

  const isLoading = !staticOptions && swapBalance === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", padding: "16px", boxSizing: "border-box" }}>
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
              display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 999,
              backgroundColor: "#FFFFFE", border: "1px solid #E8E8E7", cursor: "pointer",
              height: 32, flexShrink: 0, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)"
            }}
          >
            {selectedChainFilter === null ? (
               <img 
                 src="/nexus-one/all-chains.png" 
                 alt="All Chains"
                 style={{ width: 20, height: 20, borderRadius: "999px", objectFit: "cover" }} 
               />
            ) : (
               <img 
                 src={allTokens.find(t => t.chainId === selectedChainFilter)?.chainLogo} 
                 style={{ width: 20, height: 20, borderRadius: "999px", objectFit: "cover" }} 
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
                {showBelowMin && (
                  <div style={{ borderTop: "1px solid #F0F0EF" }}>
                    <div style={{
                      display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 16px",
                      backgroundColor: "#FFF8F0",
                    }}>
                      <span style={{ color: "#E5953E", fontSize: 14, lineHeight: "18px", flexShrink: 0 }}>⚠</span>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#6B6B6A", lineHeight: "18px" }}>
                        Tokens under $1 are unavailable for swaps — gas + protocol fees would exceed the value.
                      </span>
                    </div>
                    <div style={{ paddingBottom: "12px" }}>
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
                                <img src={token.chainLogo} alt={token.chainName} style={{ position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: "999px", border: "1px solid #fff", objectFit: "cover" }} />
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
                )}
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
            disabled={selectedTokens.length === 0}
            style={{
              width: "100%", height: 52, display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: selectedTokens.length === 0 ? "#F0F0EF" : "#006BF4",
              color: selectedTokens.length === 0 ? "#9E9E9C" : "#FFFFFE",
              border: "none", borderRadius: 14, cursor: selectedTokens.length === 0 ? "default" : "pointer",
              fontFamily: '"Geist", system-ui, sans-serif', fontSize: 16, fontWeight: 600,
              boxShadow: selectedTokens.length > 0 ? "0px 1px 4px 0px #5555550D" : "none",
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
