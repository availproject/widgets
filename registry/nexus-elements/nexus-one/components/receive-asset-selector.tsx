"use client";
import { nexusOneTheme } from "../theme";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Search, X, ChevronDown, Check, Info, Copy, Globe } from "lucide-react";
import {
  getTokenSearchRank,
  RadioDot,
  SWAP_CHAIN_DISPLAY_ORDER,
  sortChainIdsBySwapDisplayOrder,
  type SwapTokenOption,
} from "./swap-asset-selector";
import { useNexus } from "../../nexus/NexusProvider";
import { CHAIN_METADATA, formatTokenBalance } from "@avail-project/nexus-core";
import { getShortChainName } from "../../common/utils/constant";
import {
  CITREA_CHAIN_ID,
  CITREA_STABLE_SYMBOLS,
  getCitreaChainMeta,
  getCitreaReceiveTokenOptions,
} from "../utils/citrea-tokens";

interface ReceiveAssetSelectorProps {
  onSelect: (token: SwapTokenOption) => void;
  onBack: () => void;
}

const SUPPORTED_RECEIVE_CHAIN_IDS = new Set<number>(SWAP_CHAIN_DISPLAY_ORDER);
const CHAIN_SELECTOR_CLOSE_MS = 220;
const MODAL_HEIGHT_TRANSITION_MS = 260;
const modalHeightTransitionStyle = {
  interpolateSize: "allow-keywords",
} as React.CSSProperties;
const modalHeightTransition = `height ${MODAL_HEIGHT_TRANSITION_MS}ms ease, max-height ${MODAL_HEIGHT_TRANSITION_MS}ms ease`;

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
  "USDC",
  "USDT",
  "DAI",
  "FRAX",
  "LUSD",
  "TUSD",
  "USDD",
  "GHO",
  "crvUSD",
  "sUSD",
  "USDe",
  ...CITREA_STABLE_SYMBOLS,
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
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stableListHeightRef = useRef(0);
  const chainCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [stableListHeight, setStableListHeight] = useState<number | null>(null);
  const { supportedChainsAndTokens, swapBalance, swapSupportedChainsAndTokens } = useNexus();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedChainFilter, setSelectedChainFilter] = useState<number | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [isChainSelectorClosing, setIsChainSelectorClosing] = useState(false);
  const [chainQuery, setChainQuery] = useState("");
  const [draftChainFilter, setDraftChainFilter] = useState<number | null>(null);
  const [isChainSearchFocused, setIsChainSearchFocused] = useState(false);
  const [selectedTokenHash, setSelectedTokenHash] = useState<string | null>(null);
  const [selectedTokenFull, setSelectedTokenFull] = useState<SwapTokenOption | null>(null);
  const [hoveredHash, setHoveredHash] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const [tooltipState, setTooltipState] = useState<{
    hash: string;
    x: number;
    y: number;
    t: SwapTokenOption;
  } | null>(null);

  const [apiTokens, setApiTokens] = useState<SwapTokenOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dynamicStableSymbols, setDynamicStableSymbols] = useState<Set<string>>(STABLE_SYMBOLS);

  useEffect(() => {
    setPortalRoot(
      selectorRef.current?.closest("[data-nexus-one-root]") as HTMLElement | null,
    );
  }, []);

  useEffect(() => {
    return () => {
      if (chainCloseTimerRef.current) {
        clearTimeout(chainCloseTimerRef.current);
      }
    };
  }, []);

  const openChainSelector = () => {
    if (chainCloseTimerRef.current) {
      clearTimeout(chainCloseTimerRef.current);
      chainCloseTimerRef.current = null;
    }
    setDraftChainFilter(selectedChainFilter);
    setChainQuery("");
    setIsChainSelectorClosing(false);
    setShowChainSelector(true);
  };

  const closeChainSelector = () => {
    if (chainCloseTimerRef.current) {
      clearTimeout(chainCloseTimerRef.current);
    }
    setIsChainSelectorClosing(true);
    chainCloseTimerRef.current = setTimeout(() => {
      setShowChainSelector(false);
      setIsChainSelectorClosing(false);
      chainCloseTimerRef.current = null;
    }, CHAIN_SELECTOR_CLOSE_MS);
  };

  const balanceMap = useMemo(() => {
    const map = new Map<string, Pick<SwapTokenOption, "balance" | "balanceInFiat">>();
    for (const asset of swapBalance ?? []) {
      for (const bd of asset.breakdown ?? []) {
        const key = getTokenBalanceKey(bd.chain?.id, bd.contractAddress);
        if (!key) continue;
        const fiatBalance = parseFiatValue(bd.balanceInFiat);
        if (fiatBalance < 1) continue;

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
              ? `$${fiatBalance.toFixed(2)}`
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
    }
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, [tooltipState]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(30);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [query, activeTab, selectedChainFilter]);

  const preserveListHeight = useCallback(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    const nextHeight = Math.ceil(listEl.getBoundingClientRect().height);
    if (nextHeight <= stableListHeightRef.current) return;

    stableListHeightRef.current = nextHeight;
    setStableListHeight(nextHeight);
  }, []);

  useLayoutEffect(() => {
    preserveListHeight();

    const listEl = listRef.current;
    if (!listEl || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      preserveListHeight();
    });
    observer.observe(listEl);

    return () => observer.disconnect();
  }, [preserveListHeight]);

  // Cross-reference map for chain names & logos, and balances
  const chainMetaMap = useMemo(() => {
    const map = new Map<number, { name: string; logo: string }>();
    if (supportedChainsAndTokens) {
      for (const c of supportedChainsAndTokens) {
        map.set(c.id, { name: getShortChainName(c.id, c.name), logo: c.logo });
      }
    }
    if (swapSupportedChainsAndTokens) {
      for (const c of swapSupportedChainsAndTokens) {
        map.set(c.id, { name: getShortChainName(c.id, c.name), logo: c.logo });
      }
    }
    if (!map.has(CITREA_CHAIN_ID)) {
      map.set(CITREA_CHAIN_ID, getCitreaChainMeta());
    }
    return map;
  }, [supportedChainsAndTokens, swapSupportedChainsAndTokens]);

  const chainFilterIds = useMemo(() => {
    const supportedIds = swapSupportedChainsAndTokens
      ?.map((chain) => chain.id)
      .filter((id) => SUPPORTED_RECEIVE_CHAIN_IDS.has(id));

    const nextIds = new Set(
      supportedIds?.length ? supportedIds : Array.from(SUPPORTED_RECEIVE_CHAIN_IDS),
    );
    nextIds.add(CITREA_CHAIN_ID);

    return sortChainIdsBySwapDisplayOrder(
      Array.from(nextIds).filter((id) => SUPPORTED_RECEIVE_CHAIN_IDS.has(id)),
    );
  }, [swapSupportedChainsAndTokens]);

  useEffect(() => {
    let active = true;
    const fetchTokens = async () => {
      try {
        setIsLoading(true);
        preloadReceiveTokens();

        const data = await rawTokensPromise;
        if (!active) return;

        if (data.stableSymbols && Array.isArray(data.stableSymbols)) {
          setDynamicStableSymbols(
            new Set([
              ...Array.from(STABLE_SYMBOLS),
              ...data.stableSymbols,
              ...CITREA_STABLE_SYMBOLS,
            ]),
          );
        }

        const allParsed: SwapTokenOption[] = [];
        const chains = data.tokens || {};
        for (const chainIdStr of Object.keys(chains)) {
          const chainId = parseInt(chainIdStr, 10);
          if (!SUPPORTED_RECEIVE_CHAIN_IDS.has(chainId)) continue;
          const meta = chainMetaMap.get(chainId) || {
            name: getShortChainName(chainId, `Chain ${chainId}`),
            logo: "",
          };
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
        const tokensByKey = new Map<string, SwapTokenOption>();
        for (const token of [...allParsed, ...getCitreaReceiveTokenOptions()]) {
          const address =
            token.contractAddress.toLowerCase() ===
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
              ? "0x0000000000000000000000000000000000000000"
              : token.contractAddress.toLowerCase();
          tokensByKey.set(`${token.chainId ?? 0}-${address}`, token);
        }
        setApiTokens(Array.from(tokensByKey.values()));
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
    t.contractAddress.toLowerCase() === "0x0000000000000000000000000000000000000000";

  const filtered = useMemo(() => {
    let result = tokensWithBalances;
    if (selectedChainFilter) result = result.filter(t => t.chainId === selectedChainFilter);
    if (query.trim()) {
      result = result.filter((t) => getTokenSearchRank(t, query) !== null);
    }
    if (activeTab === "native") result = result.filter(isNativeToken);
    else if (activeTab === "stables") result = result.filter(t => dynamicStableSymbols.has(t.symbol));
    
    return result;
  }, [tokensWithBalances, selectedChainFilter, query, activeTab, dynamicStableSymbols]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (query.trim()) {
        const aRank = getTokenSearchRank(a, query);
        const bRank = getTokenSearchRank(b, query);
        const aScore = aRank?.score ?? Number.MAX_SAFE_INTEGER;
        const bScore = bRank?.score ?? Number.MAX_SAFE_INTEGER;
        if (aScore !== bScore) return aScore - bScore;

        const aMatched = aRank?.matchedTerms ?? 0;
        const bMatched = bRank?.matchedTerms ?? 0;
        if (aMatched !== bMatched) return bMatched - aMatched;
      }
      const aFiat = parseFiatValue(a.balanceInFiat);
      const bFiat = parseFiatValue(b.balanceInFiat);
      if (aFiat !== bFiat) return bFiat - aFiat;
      return `${a.symbol} ${a.chainName}`.localeCompare(`${b.symbol} ${b.chainName}`);
    });
  }, [filtered, query]);

  const selectedChainMeta =
    selectedChainFilter === null ? undefined : chainMetaMap.get(selectedChainFilter);
  const selectedChainLabel =
    selectedChainFilter === null ? "All chains" : selectedChainMeta?.name || "Chain";

  return (
    <div
      ref={selectorRef}
      style={{
        ...modalHeightTransitionStyle,
        boxSizing: "border-box",
        display: "flex",
        flex: "0 1 auto",
        flexDirection: "column",
        height: "auto",
        maxHeight: "100%",
        minHeight: 0,
        overflow: "hidden",
        padding: "12px",
        position: "relative",
        transition: modalHeightTransition,
        width: "100%",
        willChange: "height, max-height",
      }}
    >
      <div style={{ width: "100%", display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <div style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: "#E8E8E7" }} />
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <button
          onClick={onBack}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid #E8E8E7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFFFFE",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ChevronDown style={{ width: 16, height: 16, transform: "rotate(90deg)" }} />
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 18, fontWeight: 600, color: "#161615" }}>
            Select token to receive
          </span>
        </div>
      </div>

      <div style={{ padding: "0 0 12px", display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 10 }}>
        
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 42,
            gap: 8,
            borderRadius: 12,
            border: `1px solid ${isSearchFocused ? "#A8C9FF" : "#E8E8E7"}`,
            boxShadow: isSearchFocused ? "0 0 0 1px rgba(0,107,244,0.16)" : "none",
            padding: "0 8px 0 14px",
            backgroundColor: "#F0F0EF",
          }}
        >
          <Search style={{ width: 20, height: 20, color: "#848483", flexShrink: 0 }} />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search token, chain or address"
            style={{ flex: 1, backgroundColor: "transparent", border: "none", outline: "none", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14, color: "#161615", minWidth: 0 }}
          />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X style={{ width: 16, height: 16, color: "#848483" }} /></button>}
          <button 
            onClick={openChainSelector}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px 4px 5px", borderRadius: 999, backgroundColor: "#FFFFFE", border: "1px solid #E8E8E7", cursor: "pointer", height: 38, flexShrink: 0, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" }}
          >
            {selectedChainFilter === null ? (
               <Globe style={{ width: 16, height: 16, color: "#161615", flexShrink: 0 }} />
            ) : (
               <img src={selectedChainMeta?.logo} alt={selectedChainLabel} style={{ width: 18, height: 18, borderRadius: "999px", objectFit: "cover", flexShrink: 0 }} />
            )}
            <span
              style={{
                color: "#161615",
                fontFamily: '"Geist", system-ui, sans-serif',
                fontSize: "12px",
                fontWeight: 500,
                lineHeight: "16px",
                maxWidth: "86px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedChainLabel}
            </span>
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
        ref={listRef}
        style={{
          flex: "1 1 auto",
          minHeight: stableListHeight ? `${stableListHeight}px` : 0,
          overflowY: "auto",
          position: "relative",
          zIndex: hoveredHash || tooltipState ? 20 : 1,
        }}
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
              const isInfoOpen = tooltipState?.hash === hash;
              const isDetailActive = isHovered || isInfoOpen;
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
                    padding: "10px 14px", backgroundColor: isSelected ? "#F4F7FE" : "transparent", border: "none",
                    cursor: "pointer", borderBottom: "1px solid #F0F0EF", boxSizing: "border-box",
                    position: isDetailActive ? "relative" : "static",
                    zIndex: isDetailActive ? 50 : 1
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <RadioDot selected={isSelected} />
                    <div style={{ position: "relative", flexShrink: 0, width: 40, height: 40 }}>
                      <TokenLogo token={t} size={40} fontSize={16} />
                      {t.chainLogo && <img src={t.chainLogo} alt={t.chainName} style={{ position: "absolute", bottom: -8, right: -8, width: 22, height: 22, borderRadius: "999px", border: "2px solid #FFFFFE", zIndex: 2 }} />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 15, color: "#161615" }}>{t.symbol}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>
                          {isDetailActive
                            ? `${t.contractAddress.slice(0, 6)}...${t.contractAddress.slice(-4)}`
                            : `on ${t.chainName || "Unknown chain"}`}
                        </span>
                        {isDetailActive && (
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
                              if (tooltipState?.hash === hash) {
                                setTooltipState(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltipState({
                                  hash,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                  t,
                                });
                              }
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
      <div style={{ padding: "0 0 6px", backgroundColor: "#FFFFFE", flexShrink: 0, zIndex: 10 }}>
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
      {showChainSelector && (() => {
        const chainModal = (
        <div
          style={{
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            left: 0,
            pointerEvents: "none",
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 50,
          }}
        >
          <div
            onClick={closeChainSelector}
            style={{
              backgroundColor: "rgba(0,0,0,0.22)",
              bottom: 0,
              left: 0,
              pointerEvents: "auto",
              position: "absolute",
              right: 0,
              top: 0,
              opacity: isChainSelectorClosing ? 0 : 1,
              transition: `opacity ${CHAIN_SELECTOR_CLOSE_MS}ms ease`,
            }}
          />
          <div
            className={isChainSelectorClosing ? undefined : "animate-in slide-in-from-bottom-full duration-300"}
            data-nexus-one-sheet
            style={{
              ...modalHeightTransitionStyle,
              backgroundColor: "#FFFFFE",
              borderRadius: "24px 24px 0 0",
              boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              height: "90%",
              maxHeight: "90%",
              overflow: "hidden",
              padding: "12px",
              pointerEvents: "auto",
              position: "relative",
              transform: isChainSelectorClosing ? "translateY(100%)" : "translateY(0)",
              transition: `${modalHeightTransition}, transform ${CHAIN_SELECTOR_CLOSE_MS}ms ease, opacity ${CHAIN_SELECTOR_CLOSE_MS}ms ease`,
              opacity: isChainSelectorClosing ? 0 : 1,
              willChange: "height, max-height, transform, opacity",
              width: "100%",
            }}
          >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, width: "100%" }}>
            <div style={{ backgroundColor: "#D8D8D6", borderRadius: "999px", height: 4, width: 32 }} />
          </div>
          <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 10 }}>
            <button
              onClick={closeChainSelector}
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFE",
                border: "1px solid #E8E8E7",
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                flexShrink: 0,
                height: 30,
                justifyContent: "center",
                width: 30,
              }}
            >
              <ChevronDown style={{ width: 15, height: 15, transform: "rotate(90deg)" }} />
            </button>
            <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 600, fontSize: 17, color: "#161615" }}>Select chain</span>
          </div>
          <div style={{ paddingBottom: 10 }}>
            <div
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFE",
                border: `1px solid ${isChainSearchFocused ? "#A8C9FF" : "#E8E8E7"}`,
                borderRadius: 11,
                boxShadow: isChainSearchFocused ? "0 0 0 1px rgba(0,107,244,0.16)" : "none",
                display: "flex",
                gap: 8,
                height: 38,
                padding: "0 12px",
              }}
            >
              <Search style={{ width: 18, height: 18, color: "#848483", flexShrink: 0 }} />
              <input
                value={chainQuery}
                onChange={(e) => setChainQuery(e.target.value)}
                onFocus={() => setIsChainSearchFocused(true)}
                onBlur={() => setIsChainSearchFocused(false)}
                placeholder="Search chains"
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#161615",
                  flex: 1,
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontSize: 13,
                  minWidth: 0,
                  outline: "none",
                }}
              />
            </div>
          </div>
          <div
            style={{
              flex: "1 1 auto",
              marginBottom: 10,
              minHeight: 0,
              overflowY: "auto",
            }}
          >
            <div style={{ border: "1px solid #E8E8E7", borderRadius: 12, overflow: "hidden", backgroundColor: "#FFFFFE" }}>
            <button
              onClick={() => setDraftChainFilter(null)}
              style={{ width: "100%", display: "flex", alignItems: "center", padding: "8px 14px", backgroundColor: "transparent", border: "none", borderBottom: "1px solid #F0F0EF", cursor: "pointer", boxSizing: "border-box" }}
            >
              <RadioDot selected={draftChainFilter === null} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 10 }}>
                <Globe style={{ width: 28, height: 28, color: "#161615", flexShrink: 0 }} />
                <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 14, color: "#161615" }}>All Chains</span>
              </div>
            </button>
            {chainFilterIds.filter(id => {
              const meta = chainMetaMap.get(id);
              return (meta?.name || "").toLowerCase().includes(chainQuery.toLowerCase());
            }).map(id => {
              const meta = chainMetaMap.get(id);
              if (!meta) return null;
              return (
                <button
                  key={id}
                  onClick={() => setDraftChainFilter(id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", padding: "8px 14px", backgroundColor: "transparent", border: "none", borderBottom: "1px solid #F0F0EF", cursor: "pointer", boxSizing: "border-box" }}
                >
                  <RadioDot selected={draftChainFilter === id} />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 10 }}>
                    <img src={meta.logo} style={{ width: 28, height: 28, borderRadius: "999px", objectFit: "cover" }} />
                    <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 14, color: "#161615" }}>{meta.name}</span>
                  </div>
                </button>
              );
            })}
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedChainFilter(draftChainFilter);
              closeChainSelector();
            }}
            style={{
              alignItems: "center",
              backgroundColor: "#006BF4",
              border: "none",
              borderRadius: 10,
              color: "#FFFFFE",
              cursor: "pointer",
              display: "flex",
              flexShrink: 0,
              fontFamily: '"Geist", system-ui, sans-serif',
              fontSize: 15,
              fontWeight: 600,
              height: 44,
              justifyContent: "center",
              width: "100%",
            }}
          >
            Done
          </button>
          </div>
        </div>
        );
        return portalRoot ? createPortal(chainModal, portalRoot) : chainModal;
      })()}

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
          >
            {/* Triangle pointer */}
            <div style={{
              position: "absolute", bottom: "-6px", left: "50%", transform: "translateX(-50%) rotate(45deg)",
              width: "12px", height: "12px", backgroundColor: "#fff", borderRight: "1px solid #E8E8E7", borderBottom: "1px solid #E8E8E7", zIndex: 1
            }}></div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, position: "relative", zIndex: 2 }}>
              <div style={{ position: "relative", width: 24, height: 24 }}>
                <TokenLogo token={tooltipState.t} size={24} fontSize={10} />
                {tooltipState.t.chainLogo && <img src={tooltipState.t.chainLogo} alt={tooltipState.t.chainName} style={{ position: "absolute", bottom: -4, right: -4, width: 10, height: 10, borderRadius: "999px", border: "1px solid #FFFFFE", zIndex: 2 }} />}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative", zIndex: 2 }}>
              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, color: "#848483" }}>Contract address:</span>
              {explorerUrl ? (
                <a href={`${explorerUrl}/address/${tooltipState.t.contractAddress}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 11, color: "#006BF4", wordBreak: "break-all", textDecoration: "underline", outline: "none", cursor: "pointer" }}>{tooltipState.t.contractAddress}</a>
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
