"use client";
import { nexusOneTheme } from "../theme";
import React, { useState, useMemo, useEffect } from "react";
import { Search, X, ChevronDown, Check, Info, Copy } from "lucide-react";
import { type SwapTokenOption } from "./swap-asset-selector";
import { useNexus } from "../../nexus/NexusProvider";
import { RadioDot } from "./swap-asset-selector";

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

const STABLE_SYMBOLS = new Set([
  "USDC", "USDT", "DAI", "FRAX", "LUSD", "TUSD", "USDD", "GHO", "crvUSD", "sUSD", "USDe"
]);

const FILTER_TABS = [
  { label: "All", key: "all" },
  { label: "Native", key: "native" },
  { label: "Stables", key: "stables" },
];

let rawTokensCache: any = null;
let rawTokensPromise: Promise<any> | null = null;

export const preloadReceiveTokens = () => {
  if (typeof window === "undefined") return null;
  if (!rawTokensPromise) {
    rawTokensPromise = (async () => {
      const CACHE_KEY = "nexus_receive_tokens_cache";
      const CACHE_TIME_KEY = "nexus_receive_tokens_time";
      
      try {
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedTime && cachedData && Date.now() - Number(cachedTime) < 24 * 60 * 60 * 1000) {
          const data = JSON.parse(cachedData);
          rawTokensCache = data;
          return data;
        }
      } catch (err) {}

      let data: any = { tokens: {} };
      try {
        const res = await fetch("https://api.jumper.xyz/pipeline/v1/tokens?chainTypes=EVM%2CSVM%2CUTXO%2CMVM%2CTVM&orderBy=volumeUSD24H&extended=true&limit=1000&minPriceUSD=0.000001");
        if (res.ok) data = await res.json();
        else throw new Error("Jumper API failed");
      } catch (err) {
        const res = await fetch("https://li.quest/v1/tokens");
        data = await res.json();
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
  const { supportedChainsAndTokens } = useNexus();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedChainFilter, setSelectedChainFilter] = useState<number | null>(null);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [selectedTokenHash, setSelectedTokenHash] = useState<string | null>(null);
  const [selectedTokenFull, setSelectedTokenFull] = useState<SwapTokenOption | null>(null);
  const [hoveredHash, setHoveredHash] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);

  const [apiTokens, setApiTokens] = useState<SwapTokenOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    let result = apiTokens;
    if (selectedChainFilter) result = result.filter(t => t.chainId === selectedChainFilter);
    if (query.trim()) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter(t => {
        const targetStr = `${t.symbol} ${t.name} ${t.chainName} ${t.contractAddress}`.toLowerCase();
        return terms.every(term => targetStr.includes(term));
      });
    }
    if (activeTab === "native") result = result.filter(isNativeToken);
    else if (activeTab === "stables") result = result.filter(t => STABLE_SYMBOLS.has(t.symbol));
    
    return result;
  }, [apiTokens, selectedChainFilter, query, activeTab]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", position: "relative" }}>
      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        
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
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 999, backgroundColor: "#FFFFFE", border: "1px solid #E8E8E7", cursor: "pointer", height: 32, flexShrink: 0, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" }}
          >
            {selectedChainFilter === null ? (
               <img src="/nexus-one/all-chains.png" alt="All Chains" style={{ width: 20, height: 20, borderRadius: "999px", objectFit: "cover" }} />
            ) : (
               <img src={chainMetaMap.get(selectedChainFilter)?.logo} style={{ width: 20, height: 20, borderRadius: "999px", objectFit: "cover" }} />
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
        style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          if (scrollHeight - scrollTop - clientHeight < 200) {
            setVisibleCount(prev => prev + 30);
          }
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif' }}>No tokens found</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtered.slice(0, visibleCount).map(t => {
              const hash = `${t.chainId}-${t.contractAddress}`;
              const isSelected = selectedTokenHash === hash;
              const isHovered = hoveredHash === hash;
              return (
                <button
                  key={hash}
                  onClick={() => { setSelectedTokenHash(hash); setSelectedTokenFull(t); }}
                  onMouseEnter={() => setHoveredHash(hash)}
                  onMouseLeave={() => setHoveredHash(null)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", backgroundColor: isSelected ? "#F4F7FE" : "transparent", border: "none",
                    cursor: "pointer", borderBottom: "1px solid #F0F0EF", boxSizing: "border-box"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <RadioDot selected={isSelected} />
                    <div style={{ position: "relative", flexShrink: 0, width: 40, height: 40 }}>
                      <div style={{ position: "absolute", inset: 0, borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: getAvatarColor(t.symbol), color: "#fff", fontWeight: 600, fontSize: 16 }}>
                        {t.symbol.charAt(0).toUpperCase()}
                      </div>
                      {t.logo && <img src={t.logo} alt={t.symbol} style={{ position: "absolute", inset: 0, width: 40, height: 40, borderRadius: "999px", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                      {t.chainLogo && <img src={t.chainLogo} alt={t.chainName} style={{ position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: "999px", border: "2px solid #FFFFFE", zIndex: 2 }} />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 15, color: "#161615" }}>{t.symbol}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>
                          {t.contractAddress.slice(0, 6)}...{t.contractAddress.slice(-4)}
                        </span>
                        {isHovered && (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Copy
                              style={{ width: 12, height: 12, color: "#848483", cursor: "pointer" }}
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(t.contractAddress); }}
                            />
                            <div className="relative group/info">
                              <Info style={{ width: 12, height: 12, color: "#848483", cursor: "pointer" }} />
                              <div className="hidden group-hover/info:flex absolute left-0 bottom-full mb-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-4 flex-col z-50 text-left cursor-default" onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                  <div style={{ position: "relative", width: 24, height: 24 }}>
                                    <div style={{ position: "absolute", inset: 0, borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: getAvatarColor(t.symbol), color: "#fff", fontWeight: 600, fontSize: 10 }}>
                                      {t.symbol.charAt(0).toUpperCase()}
                                    </div>
                                    {t.logo && <img src={t.logo} alt={t.symbol} style={{ position: "absolute", inset: 0, width: 24, height: 24, borderRadius: "999px", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                                    {t.chainLogo && <img src={t.chainLogo} alt={t.chainName} style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "999px", border: "1px solid #FFFFFE", zIndex: 2 }} />}
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 600, fontSize: 14, color: "#161615" }}>{t.name}</span>
                                    <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>on {t.chainName}</span>
                                  </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                  <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>Symbol:</span>
                                  <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#161615", fontWeight: 500 }}>{t.symbol}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                  <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>Chain:</span>
                                  <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#161615", fontWeight: 500 }}>{t.chainName}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                  <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>Decimals:</span>
                                  <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#161615", fontWeight: 500 }}>{t.decimals}</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>Contract address:</span>
                                  <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 11, color: "#161615", wordBreak: "break-all" }}>{t.contractAddress}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {t.balance !== "0" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 14, color: "#161615" }}>{Number(t.balance).toFixed(4)} {t.symbol}</span>
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
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, background: "linear-gradient(to top, #FFFFFE 80%, transparent)" }}>
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
          <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E8E8E7" }}>
            <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 600, fontSize: 16, color: "#161615" }}>Select a Chain</span>
            <button onClick={() => setShowChainSelector(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X style={{ width: 20, height: 20, color: "#161615" }} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <button
              onClick={() => { setSelectedChainFilter(null); setShowChainSelector(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", padding: "12px", backgroundColor: "transparent", border: "none", cursor: "pointer", borderBottom: "1px solid #F0F0EF" }}
            >
              <RadioDot selected={selectedChainFilter === null} />
              <img src="/nexus-one/all-chains.png" alt="All Chains" style={{ marginLeft: 12, width: 32, height: 32, borderRadius: "999px", objectFit: "cover" }} />
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 15, fontWeight: 500, marginLeft: 12, color: "#161615" }}>All Chains</span>
            </button>
            {Array.from(chainMetaMap.entries()).map(([id, meta]) => (
              <button
                key={id}
                onClick={() => { setSelectedChainFilter(id); setShowChainSelector(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", padding: "12px", backgroundColor: "transparent", border: "none", cursor: "pointer", borderBottom: "1px solid #F0F0EF" }}
              >
                <RadioDot selected={selectedChainFilter === id} />
                <img src={meta.logo} alt={meta.name} style={{ marginLeft: 12, width: 32, height: 32, borderRadius: "999px", objectFit: "cover" }} />
                <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 15, fontWeight: 500, marginLeft: 12, color: "#161615" }}>{meta.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
