"use client";
import { nexusOneTheme } from "../theme";
import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, ChevronDown, Check, Info, Copy } from "lucide-react";
import { type SwapTokenOption } from "./swap-asset-selector";
import { useNexus } from "../../nexus/NexusProvider";
import { RadioDot } from "./swap-asset-selector";
import { CHAIN_METADATA, formatTokenBalance } from "@avail-project/nexus-core";

interface ReceiveAssetSelectorProps {
  onSelect: (token: SwapTokenOption) => void;
  onBack: () => void;
}

const SUPPORTED_RECEIVE_CHAIN_IDS = new Set([1, 10, 56, 137, 143, 999, 8217, 8453, 42161, 43114, 534352, 4114]);

const AVATAR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#D4A5A5", 
  "#9B59B6", "#3498DB", "#E67E22", "#1ABC9C", "#F39C12", "#34495E"
];

const getAvatarColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const TokenLogo = ({ token, size = 40, fontSize = 16 }: { token: SwapTokenOption, size?: number, fontSize?: number }) => {
  const [error, setError] = useState(false);

  if (!token.logo || error) {
    return (
      <div style={{ position: "absolute", inset: 0, borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: getAvatarColor(token.symbol), color: "#fff", fontWeight: 600, fontSize }}>
        {token.symbol.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img 
      src={token.logo} 
      alt={token.symbol} 
      style={{ position: "absolute", inset: 0, width: size, height: size, borderRadius: "999px", objectFit: "cover" }} 
      onError={() => setError(true)} 
    />
  );
};

const parseFiatValue = (value: unknown) => {
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const STABLE_SYMBOLS = new Set([
  "USDC", "USDT", "DAI", "FRAX", "LUSD", "TUSD", "USDD", "GHO", "crvUSD", "sUSD", "USDe"
]);

const FILTER_TABS = [
  { label: "All", key: "all" },
  { label: "Native", key: "native" },
  { label: "Stables", key: "stables" },
];

const getTokenBalanceKey = (chainId?: number, address?: string) => {
  if (!chainId || !address) return null;
  return `${chainId}-${address.toLowerCase()}`;
};

const getNativeAddressAlias = (address?: string) => {
  if (!address) return null;
  const lower = address.toLowerCase();
  if (lower === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
    return "0x0000000000000000000000000000000000000000";
  }
  if (lower === "0x0000000000000000000000000000000000000000") {
    return "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  }
  return null;
};

let rawTokensCache: any = null;
let rawTokensPromise: Promise<any> | null = null;

export const preloadReceiveTokens = () => {
  if (typeof window === "undefined") return null;
  if (!rawTokensPromise) {
    rawTokensPromise = (async () => {
      const CACHE_KEY = "nexus_receive_tokens_cache_v2";
      const CACHE_TIME_KEY = "nexus_receive_tokens_time_v2";
      
      try {
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedTime && cachedData && Date.now() - Number(cachedTime) < 24 * 60 * 60 * 1000) {
          const data = JSON.parse(cachedData);
          rawTokensCache = data;
          return data;
        }
      } catch (err) {}

      let data: any = { tokens: {}, stableSymbols: [] };
      try {
        const [resAll, resStables] = await Promise.all([
          fetch("https://li.quest/v1/tokens"),
          fetch("https://li.quest/v1/tokens?tags=stablecoin")
        ]);
        
        let allTokens = {};
        if (resAll.ok) {
          const allData = await resAll.json();
          allTokens = allData.tokens || {};
        }

        const stableSymbols = new Set<string>();
        if (resStables.ok) {
          const stablesData = await resStables.json();
          const stableChains = stablesData.tokens || {};
          for (const chainId of Object.keys(stableChains)) {
            for (const t of stableChains[chainId]) {
              stableSymbols.add(t.symbol);
            }
          }
        }
        
        data = {
          tokens: allTokens,
          stableSymbols: Array.from(stableSymbols)
        };
      } catch (err) {
        console.error("Failed to fetch tokens from li.quest", err);
      }
      
      rawTokensCache = data;

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {}
      
      return data;
    })();
  }
  return rawTokensPromise;
};

// Start preloading immediately in the background
if (typeof window !== "undefined") {
  setTimeout(() => {
    preloadReceiveTokens();
  }, 1000);
}

export function ReceiveAssetSelector({
  onSelect,
  onBack,
}: ReceiveAssetSelectorProps) {
  const { supportedChainsAndTokens, swapBalance } = useNexus();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedChainFilter, setSelectedChainFilter] = useState<number | null>(null);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [selectedTokenHash, setSelectedTokenHash] = useState<string | null>(null);
  const [selectedTokenFull, setSelectedTokenFull] = useState<SwapTokenOption | null>(null);
  const [hoveredHash, setHoveredHash] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const [tooltipState, setTooltipState] = useState<{ x: number, y: number, t: SwapTokenOption } | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const [apiTokens, setApiTokens] = useState<SwapTokenOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dynamicStableSymbols, setDynamicStableSymbols] = useState<Set<string>>(STABLE_SYMBOLS);

  const balanceMap = useMemo(() => {
    const map = new Map<string, Pick<SwapTokenOption, "balance" | "balanceInFiat">>();
    for (const asset of swapBalance ?? []) {
      for (const bd of asset.breakdown ?? []) {
        const key = getTokenBalanceKey(bd.chain?.id, bd.contractAddress);
        if (!key) continue;

        const symbol = bd.symbol ?? asset.symbol;
        const decimals = bd.decimals ?? asset.decimals ?? 18;
        map.set(key, {
          balance:
            formatTokenBalance(bd.balance ?? "0", {
              symbol,
              decimals,
            }) ?? `0 ${symbol}`,
          balanceInFiat:
            bd.balanceInFiat != null
              ? `$${Number(bd.balanceInFiat).toFixed(2)}`
              : "$0.00",
        });
        const nativeAlias = getNativeAddressAlias(bd.contractAddress);
        const aliasKey = getTokenBalanceKey(bd.chain?.id, nativeAlias ?? undefined);
        if (aliasKey) {
          map.set(aliasKey, map.get(key)!);
        }
      }
    }
    return map;
  }, [swapBalance]);

  const tokensWithBalances = useMemo(() => {
    return apiTokens.map((token) => {
      const balance = balanceMap.get(
        getTokenBalanceKey(token.chainId, token.contractAddress) ?? "",
      );
      return balance ? { ...token, ...balance } : token;
    });
  }, [apiTokens, balanceMap]);

  useEffect(() => {
    const handleGlobalClick = () => setTooltipState(null);
    if (tooltipState) {
      window.addEventListener("click", handleGlobalClick);
      window.addEventListener("touchstart", handleGlobalClick);
    }
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("touchstart", handleGlobalClick);
    };
  }, [tooltipState]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(30);
  }, [query, activeTab, selectedChainFilter]);

  // Cross-reference map for chain names & logos, and balances
  const chainMetaMap = useMemo(() => {
    const map = new Map<number, { name: string; logo: string }>();
    if (supportedChainsAndTokens) {
      for (const c of supportedChainsAndTokens) {
        map.set(c.id, { name: c.name, logo: c.logo });
      }
    }
    return map;
  }, [supportedChainsAndTokens]);

  useEffect(() => {
    let active = true;
    const fetchTokens = async () => {
      try {
        setIsLoading(true);
        preloadReceiveTokens();

        const data = await rawTokensPromise;
        if (!active) return;

        if (data.stableSymbols && Array.isArray(data.stableSymbols)) {
          setDynamicStableSymbols(new Set([...Array.from(STABLE_SYMBOLS), ...data.stableSymbols]));
        }

        const allParsed: SwapTokenOption[] = [];
        const chains = data.tokens || {};
        for (const chainIdStr of Object.keys(chains)) {
          const chainId = parseInt(chainIdStr, 10);
          if (!SUPPORTED_RECEIVE_CHAIN_IDS.has(chainId)) continue;
          const meta = chainMetaMap.get(chainId) || { name: `Chain ${chainId}`, logo: "" };
          for (const t of chains[chainIdStr]) {
            allParsed.push({
              contractAddress: t.address,
              symbol: t.symbol,
              name: t.name,
              logo: t.logoURI || "",
              decimals: t.decimals,
              chainId,
              chainName: meta.name,
              chainLogo: meta.logo,
              balance: "0",
              balanceInFiat: "$0.00",
            });
          }
        }
        setApiTokens(allParsed);
      } catch (err) {
        console.error("Failed to fetch receive tokens", err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchTokens();
    return () => { active = false; };
  }, [chainMetaMap]);

  const isNativeToken = (t: SwapTokenOption) =>
    t.contractAddress.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
    t.contractAddress === "0x0000000000000000000000000000000000000000";

  const filtered = useMemo(() => {
    let result = tokensWithBalances;
    if (selectedChainFilter) result = result.filter(t => t.chainId === selectedChainFilter);
    if (query.trim()) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter(t => {
        const targetStr = `${t.symbol} ${t.name} ${t.chainName} ${t.contractAddress}`.toLowerCase();
        return terms.every(term => targetStr.includes(term));
      });
    }
    if (activeTab === "native") result = result.filter(isNativeToken);
    else if (activeTab === "stables") result = result.filter(t => dynamicStableSymbols.has(t.symbol));
    
    return result;
  }, [tokensWithBalances, selectedChainFilter, query, activeTab, dynamicStableSymbols]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aFiat = parseFiatValue(a.balanceInFiat);
      const bFiat = parseFiatValue(b.balanceInFiat);
      if (aFiat !== bFiat) return bFiat - aFiat;
      return `${a.symbol} ${a.chainName}`.localeCompare(`${b.symbol} ${b.chainName}`);
    });
  }, [filtered]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, width: "100%", position: "relative" }}>
      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12, position: "relative", zIndex: 10 }}>
        
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", height: 44, gap: 8, borderRadius: 12, border: "1px solid #E8E8E7", padding: "0 8px 0 16px", backgroundColor: "#F0F0EF" }}>
          <Search style={{ width: 20, height: 20, color: "#848483", flexShrink: 0 }} />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search token, chain or address"
            style={{ flex: 1, backgroundColor: "transparent", border: "none", outline: "none", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14, color: "#161615", minWidth: 0 }}
          />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X style={{ width: 16, height: 16, color: "#848483" }} /></button>}
          <button 
            onClick={() => setShowChainSelector(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px 4px 5px", borderRadius: 999, backgroundColor: "#FFFFFE", border: "1px solid #E8E8E7", cursor: "pointer", height: 38, flexShrink: 0, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" }}
          >
            {selectedChainFilter === null ? (
               <img src="/nexus-one/all-chains.png" alt="All Chains" style={{ width: 30, height: 30, borderRadius: "999px", objectFit: "cover" }} />
            ) : (
               <img src={chainMetaMap.get(selectedChainFilter)?.logo} style={{ width: 30, height: 30, borderRadius: "999px", objectFit: "cover" }} />
            )}
            <ChevronDown style={{ width: 14, height: 14, color: "#848483" }} />
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 0, backgroundColor: "#F0F0EF", borderRadius: 8, padding: 4 }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key} onClick={() => setActiveTab(tab.key)}
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
      </div>

      {/* Token list */}
      <div 
        style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: hoveredHash ? 20 : 1 }}
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          if (scrollHeight - scrollTop - clientHeight < 200) {
            setVisibleCount(prev => prev + 30);
          }
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif' }}>Loading...</div>
        ) : sortedFiltered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif' }}>No tokens found</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {sortedFiltered.slice(0, visibleCount).map(t => {
              const hash = `${t.chainId}-${t.contractAddress}`;
              const isSelected = selectedTokenHash === hash;
              const isHovered = hoveredHash === hash;
              const numericBalance = Number.parseFloat(
                String(t.balance ?? "0").replace(/[^0-9.]/g, ""),
              );
              const hasBalance =
                Number.isFinite(numericBalance) && numericBalance > 0;
              return (
                <button
                  key={hash}
                  onClick={() => { setSelectedTokenHash(hash); setSelectedTokenFull(t); }}
                  onMouseEnter={() => setHoveredHash(hash)}
                  onMouseLeave={() => setHoveredHash(null)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", backgroundColor: isSelected ? "#F4F7FE" : "transparent", border: "none",
                    cursor: "pointer", borderBottom: "1px solid #F0F0EF", boxSizing: "border-box",
                    position: isHovered ? "relative" : "static",
                    zIndex: isHovered ? 50 : 1
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <RadioDot selected={isSelected} />
                    <div style={{ position: "relative", flexShrink: 0, width: 40, height: 40 }}>
                      <TokenLogo token={t} size={40} fontSize={16} />
                      {t.chainLogo && <img src={t.chainLogo} alt={t.chainName} style={{ position: "absolute", bottom: -3, right: -3, width: 22, height: 22, borderRadius: "999px", border: "2px solid #FFFFFE", zIndex: 2 }} />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 15, color: "#161615" }}>{t.symbol}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>
                          {t.contractAddress.slice(0, 6)}...{t.contractAddress.slice(-4)}
                        </span>
                        {isHovered && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          {copiedHash === hash ? (
                            <Check style={{ width: 12, height: 12, color: "#006BF4" }} />
                          ) : (
                            <Copy
                              style={{ width: 12, height: 12, color: "#848483", cursor: "pointer" }}
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                navigator.clipboard.writeText(t.contractAddress); 
                                setCopiedHash(hash);
                                setTimeout(() => setCopiedHash(null), 2000);
                              }}
                            />
                          )}
                          <div 
                            className="relative"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (tooltipState?.t.contractAddress === t.contractAddress) {
                                setTooltipState(null);
                              } else {
                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltipState({ x: rect.left + rect.width / 2, y: rect.top, t });
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltipState({ x: rect.left + rect.width / 2, y: rect.top, t });
                            }}
                            onMouseLeave={() => {
                              hoverTimeoutRef.current = setTimeout(() => setTooltipState(null), 150);
                            }}
                          >
                            <Info style={{ width: 12, height: 12, color: "#848483", cursor: "pointer" }} />
                          </div>
                        </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasBalance && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 14, color: "#161615" }}>{t.balance}</span>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>{t.balanceInFiat}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Done Button Footer */}
      <div style={{ padding: 16, backgroundColor: "#FFFFFE", borderTop: "1px solid #E8E8E7", flexShrink: 0, zIndex: 10 }}>
        <button
          onClick={() => {
            if (selectedTokenFull) onSelect(selectedTokenFull);
          }}
          disabled={!selectedTokenFull}
          style={{
            width: "100%", padding: "12px", borderRadius: 12, backgroundColor: selectedTokenFull ? "#006BF4" : "#C8C8C7",
            color: "#FFFFFE", border: "none", cursor: selectedTokenFull ? "pointer" : "not-allowed",
            fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 600, fontSize: 16
          }}
        >
          Done
        </button>
      </div>

      {/* Chain Selector Modal */}
      {showChainSelector && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#FFFFFE", zIndex: 10, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottom: "1px solid #E8E8E7" }}>
            <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 600, fontSize: 18, color: "#161615" }}>Select Chain</span>
            <button onClick={() => setShowChainSelector(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <X style={{ width: 20, height: 20, color: "#848483" }} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <button
              onClick={() => { setSelectedChainFilter(null); setShowChainSelector(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", backgroundColor: "transparent", border: "none", borderBottom: "1px solid #F0F0EF", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img src="/nexus-one/all-chains.png" style={{ width: 32, height: 32, borderRadius: "999px", objectFit: "cover" }} />
                <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 16, color: "#161615" }}>All Chains</span>
              </div>
              {selectedChainFilter === null && <Check style={{ width: 20, height: 20, color: "#006BF4" }} />}
            </button>
            {Array.from(SUPPORTED_RECEIVE_CHAIN_IDS).map(id => {
              const meta = chainMetaMap.get(id);
              if (!meta) return null;
              return (
                <button
                  key={id}
                  onClick={() => { setSelectedChainFilter(id); setShowChainSelector(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", backgroundColor: "transparent", border: "none", borderBottom: "1px solid #F0F0EF", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <img src={meta.logo} style={{ width: 32, height: 32, borderRadius: "999px", objectFit: "cover" }} />
                    <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 16, color: "#161615" }}>{meta.name}</span>
                  </div>
                  {selectedChainFilter === id && <Check style={{ width: 20, height: 20, color: "#006BF4" }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Portal Tooltip */}
      {tooltipState && typeof window !== "undefined" && (() => {
        const explorerUrl = tooltipState.t.chainId ? CHAIN_METADATA[tooltipState.t.chainId]?.blockExplorerUrls?.[0] : null;
        
        return createPortal(
          <div 
            style={{ 
              position: "fixed", top: tooltipState.y - 12, left: tooltipState.x, transform: "translate(-50%, -100%)", 
              zIndex: 2147483647, display: "flex", flexDirection: "column",
              pointerEvents: "auto"
            }}
            className="w-[280px] bg-white border border-[#E8E8E7] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-4 text-left"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            }}
            onMouseLeave={() => {
              hoverTimeoutRef.current = setTimeout(() => setTooltipState(null), 150);
            }}
          >
            {/* Triangle pointer */}
            <div style={{
              position: "absolute", bottom: "-6px", left: "50%", transform: "translateX(-50%) rotate(45deg)",
              width: "12px", height: "12px", backgroundColor: "#fff", borderRight: "1px solid #E8E8E7", borderBottom: "1px solid #E8E8E7", zIndex: 1
            }}></div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, position: "relative", zIndex: 2 }}>
              <div style={{ position: "relative", width: 24, height: 24 }}>
                <TokenLogo token={tooltipState.t} size={24} fontSize={10} />
                {tooltipState.t.chainLogo && <img src={tooltipState.t.chainLogo} alt={tooltipState.t.chainName} style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "999px", border: "1px solid #FFFFFE", zIndex: 2 }} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 600, fontSize: 14, color: "#161615" }}>{tooltipState.t.name}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, position: "relative", zIndex: 2 }}>
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>Symbol:</span>
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#161615", fontWeight: 500 }}>{tooltipState.t.symbol}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, position: "relative", zIndex: 2 }}>
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>Decimals:</span>
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#161615", fontWeight: 500 }}>{tooltipState.t.decimals}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, position: "relative", zIndex: 2 }}>
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>Market cap:</span>
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#161615", fontWeight: 500 }}>N/A</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative", zIndex: 2 }}>
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>Contract address:</span>
              {explorerUrl ? (
                <a href={`${explorerUrl}/address/${tooltipState.t.contractAddress}`} target="_blank" rel="noreferrer" style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 11, color: "#006BF4", wordBreak: "break-all", textDecoration: "underline", outline: "none", cursor: "pointer" }}>{tooltipState.t.contractAddress}</a>
              ) : (
                <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 11, color: "#161615", wordBreak: "break-all" }}>{tooltipState.t.contractAddress}</span>
              )}
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
