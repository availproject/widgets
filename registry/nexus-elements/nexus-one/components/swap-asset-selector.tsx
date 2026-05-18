"use client";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Decimal from "decimal.js";
import { Search, X, Loader2, ChevronDown, ChevronUp, Info, Check, Minus } from "lucide-react";
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
  onClearSelection?: () => void;
  onDone?: () => void;
  allowUnified?: boolean;
  preserveSelectedBelowMinimum?: boolean;
  allowSelectedTokenRemoval?: boolean;
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
  indeterminate = false,
  multi,
}: {
  selected: boolean;
  indeterminate?: boolean;
  multi: boolean;
}) => {
  if (!multi) return <RadioDot selected={selected} />;

  const isActive = selected || indeterminate;

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: isActive ? "#006BF4" : "#FFFFFE",
        border: isActive ? "none" : "1.5px solid #E0E0DE",
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
      {!selected && indeterminate && (
        <Minus style={{ color: "#FFFFFE", height: 14, width: 14 }} />
      )}
    </div>
  );
};

/* ── Chain logo cluster ── */
const ChainLogos = ({ tokens }: { tokens: SwapTokenOption[] }) => {
  const clusterRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
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
  const openTooltip = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setTooltipRect(clusterRef.current?.getBoundingClientRect() ?? null);
    setShowTooltip(true);
  };
  const closeTooltip = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setShowTooltip(false);
      closeTimerRef.current = null;
    }, 120);
  };
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);
  const showTooltipAbove = tooltipRect ? tooltipRect.top > 240 : true;
  const tooltip =
    showTooltip && uniqueChains.length > 1 && tooltipRect
      ? createPortal(
          <div
            style={{
              backgroundColor: "#FFFFFE",
              border: "1px solid #E8E8E7",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(22,22,21,0.12)",
              left: Math.min(
                Math.max(tooltipRect.left - 24, 8),
                Math.max(8, window.innerWidth - 248),
              ),
              maxHeight: 220,
              minWidth: 240,
              overflowY: "auto",
              padding: "10px 12px",
              pointerEvents: "auto",
              position: "fixed",
              top: showTooltipAbove
                ? tooltipRect.top - 12
                : tooltipRect.bottom + 8,
              transform: showTooltipAbove ? "translateY(-100%)" : "none",
              zIndex: 2147483647,
            }}
            onMouseEnter={openTooltip}
            onMouseLeave={closeTooltip}
          >
            <div style={{ alignItems: "center", color: "#848483", display: "flex", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 11, fontWeight: 700, justifyContent: "space-between", letterSpacing: "0.06em", marginBottom: 8, gap: 12 }}>
              <span>UNIFIED · {uniqueChains.length} CHAINS</span>
              <span style={{ color: "#161615", fontSize: 12, letterSpacing: 0 }}>
                {tokens.reduce((sum, token) => sum + getTokenFiatValue(token), 0).toLocaleString(undefined, {
                  currency: "USD",
                  maximumFractionDigits: 2,
                  style: "currency",
                })}
              </span>
            </div>
            {uniqueChains.map((chain) => (
              <div key={chain.id} style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
                <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 0 }}>
                  {chain.logo ? (
                    <img src={chain.logo} alt="" style={{ borderRadius: "999px", height: 16, objectFit: "cover", width: 16 }} />
                  ) : (
                    <div style={{ backgroundColor: "#E8E8E7", borderRadius: "999px", height: 16, width: 16 }} />
                  )}
                  <span style={{ color: "#363635", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {chain.name || "Unknown chain"}
                  </span>
                </div>
                <span style={{ color: "#161615", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {String(chain.balance || "").replace(/\s+[^\s]+$/, "") || chain.balanceInFiat || "0"}
                </span>
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={clusterRef}
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
      style={{ display: "flex", alignItems: "center", gap: 2, position: "relative" }}
    >
      {tooltip}
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
const CHAIN_SELECTOR_CLOSE_MS = 220;
const MODAL_HEIGHT_TRANSITION_MS = 260;
const modalHeightTransitionStyle = {
  interpolateSize: "allow-keywords",
} as React.CSSProperties;
const modalHeightTransition = `height ${MODAL_HEIGHT_TRANSITION_MS}ms ease, max-height ${MODAL_HEIGHT_TRANSITION_MS}ms ease`;
const UNIFIED_MAINNET_CHAIN_IDS = new Set([
  1, 10, 56, 137, 143, 999, 4114, 8217, 8453, 42161, 43114, 534352, 4326,
]);

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getTokenFiatValue = (token: Pick<SwapTokenOption, "balanceInFiat">) =>
  Number(String(token.balanceInFiat ?? "").replace(/[^0-9.]/g, "") || 0);

const formatBalanceWithSymbol = (token: Pick<SwapTokenOption, "balance" | "symbol">) => {
  const balance = String(token.balance ?? "").trim();
  const symbol = token.symbol?.trim();
  if (!symbol) return balance || "0";
  if (new RegExp(`(?:^|\\s)${escapeRegExp(symbol)}$`, "i").test(balance)) {
    return balance || `0 ${symbol}`;
  }
  return `${balance || "0"} ${symbol}`;
};

const parseTokenAmount = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  if (Decimal.isDecimal(value)) return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") {
    return undefined;
  }
  try {
    const parsed = new Decimal(cleaned);
    return parsed.isFinite() ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const formatTokenAmountDisplay = (value: unknown) => {
  const amount = parseTokenAmount(value) ?? new Decimal(0);
  const abs = amount.abs();

  if (amount.isZero()) return "0";

  const compactUnits = [
    { suffix: "T", value: new Decimal(1_000_000_000_000) },
    { suffix: "B", value: new Decimal(1_000_000_000) },
    { suffix: "M", value: new Decimal(1_000_000) },
  ];

  for (const unit of compactUnits) {
    if (abs.gte(unit.value)) {
      return `${amount
        .div(unit.value)
        .toDecimalPlaces(4, Decimal.ROUND_DOWN)
        .toFixed()}${unit.suffix}`;
    }
  }

  const minDisplay = new Decimal("0.00001");
  if (amount.gt(0) && amount.lt(minDisplay)) {
    return `>${minDisplay.toFixed()}`;
  }

  return amount.toDecimalPlaces(5, Decimal.ROUND_DOWN).toFixed();
};

const addThousandsSeparators = (value: string) => {
  const [integerPart, decimalPart] = value.split(".");
  const withSeparators = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart === undefined
    ? withSeparators
    : `${withSeparators}.${decimalPart}`;
};

export const formatUsdBalanceLabel = (value: unknown) => {
  const amount = parseTokenAmount(value) ?? new Decimal(0);
  const abs = amount.abs();

  if (amount.isZero()) return "$0.00";
  if (amount.gt(0) && amount.lt(0.01)) return "<$0.01";

  const compactUnits = [
    { suffix: "T", value: new Decimal(1_000_000_000_000) },
    { suffix: "B", value: new Decimal(1_000_000_000) },
    { suffix: "M", value: new Decimal(1_000_000) },
  ];

  for (const unit of compactUnits) {
    if (abs.gte(unit.value)) {
      return `$${amount
        .div(unit.value)
        .toDecimalPlaces(4, Decimal.ROUND_DOWN)
        .toFixed()}${unit.suffix}`;
    }
  }

  return `$${addThousandsSeparators(amount.toDecimalPlaces(2).toFixed(2))}`;
};

export const formatSelectedTokenBalanceLabel = (
  token?: Pick<SwapTokenOption, "balance" | "symbol">,
) => {
  if (!token) return "";
  const symbol = token.symbol || "";
  const formatted = formatTokenAmountDisplay(token.balance);
  return symbol ? `${formatted} ${symbol}` : formatted;
};

const getSearchTerms = (query: string) =>
  query.toLowerCase().trim().split(/\s+/).filter(Boolean);

const includesTerm = (value: string | undefined, term: string) =>
  (value ?? "").toLowerCase().includes(term);

const startsWithTerm = (value: string | undefined, term: string) =>
  (value ?? "").toLowerCase().startsWith(term);

const equalsTerm = (value: string | undefined, term: string) =>
  (value ?? "").toLowerCase() === term;

export const getTokenSearchRank = (
  token: Pick<
    SwapTokenOption,
    "symbol" | "name" | "chainName" | "contractAddress"
  >,
  query: string,
) => {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return null;

  let matchedTerms = 0;
  let symbolExactTerms = 0;
  let symbolPrefixTerms = 0;
  let symbolIncludeTerms = 0;
  let namePrefixTerms = 0;
  let tokenExactTerms = 0;
  let tokenPrefixTerms = 0;
  let tokenIncludeTerms = 0;
  let chainExactTerms = 0;
  let chainPrefixTerms = 0;
  let chainIncludeTerms = 0;
  let addressTerms = 0;

  for (const term of terms) {
    const symbolExact = equalsTerm(token.symbol, term);
    const symbolPrefix = symbolExact || startsWithTerm(token.symbol, term);
    const symbolInclude = symbolPrefix || includesTerm(token.symbol, term);
    const nameExact = equalsTerm(token.name, term);
    const namePrefix = nameExact || startsWithTerm(token.name, term);
    const nameInclude = namePrefix || includesTerm(token.name, term);
    const tokenExact =
      symbolExact || nameExact;
    const tokenPrefix =
      tokenExact || symbolPrefix || namePrefix;
    const tokenInclude =
      tokenPrefix || symbolInclude || nameInclude;
    const chainExact = equalsTerm(token.chainName, term);
    const chainPrefix = chainExact || startsWithTerm(token.chainName, term);
    const chainInclude = chainPrefix || includesTerm(token.chainName, term);
    const addressMatch = includesTerm(token.contractAddress, term);

    if (tokenInclude || chainInclude || addressMatch) matchedTerms += 1;
    if (symbolExact) symbolExactTerms += 1;
    if (symbolPrefix) symbolPrefixTerms += 1;
    if (symbolInclude) symbolIncludeTerms += 1;
    if (namePrefix) namePrefixTerms += 1;
    if (tokenExact) tokenExactTerms += 1;
    if (tokenPrefix) tokenPrefixTerms += 1;
    if (tokenInclude) tokenIncludeTerms += 1;
    if (chainExact) chainExactTerms += 1;
    if (chainPrefix) chainPrefixTerms += 1;
    if (chainInclude) chainIncludeTerms += 1;
    if (addressMatch) addressTerms += 1;
  }

  const allTermsMatched = matchedTerms === terms.length;
  if (!allTermsMatched) return null;

  if (
    terms.length > 1 &&
    chainIncludeTerms > 0 &&
    symbolIncludeTerms === 0 &&
    addressTerms === 0 &&
    namePrefixTerms === 0
  ) {
    return null;
  }

  const hasTokenMatch = tokenIncludeTerms > 0;
  const hasChainMatch = chainIncludeTerms > 0;
  const isTokenChainMatch = allTermsMatched && hasTokenMatch && hasChainMatch;

  let score = 20;
  if (isTokenChainMatch) {
    if (symbolExactTerms > 0 && chainExactTerms > 0) score = 0;
    else if (symbolExactTerms > 0 && chainPrefixTerms > 0) score = 1;
    else if (symbolExactTerms > 0 && chainIncludeTerms > 0) score = 2;
    else if (symbolPrefixTerms > 0 && chainIncludeTerms > 0) score = 3;
    else if (symbolIncludeTerms > 0 && chainIncludeTerms > 0) score = 4;
    else if (namePrefixTerms > 0 && chainIncludeTerms > 0) score = 5;
    else score = 6;
  } else if (symbolExactTerms > 0) score = 7;
  else if (symbolPrefixTerms > 0) score = 8;
  else if (symbolIncludeTerms > 0) score = 9;
  else if (tokenExactTerms > 0) score = 10;
  else if (tokenPrefixTerms > 0) score = 11;
  else if (tokenIncludeTerms > 0) score = 12;
  else if (chainExactTerms > 0) score = 13;
  else if (chainPrefixTerms > 0) score = 14;
  else if (chainIncludeTerms > 0) score = 15;
  else if (addressTerms > 0) score = 16;

  return {
    allTermsMatched,
    isTokenChainMatch,
    matchedTerms,
    score,
    tokenExactTerms,
    tokenIncludeTerms,
  };
};

const isPrioritySearchMatch = (token: SwapTokenOption, query: string) => {
  const rank = getTokenSearchRank(token, query);
  return Boolean(
    rank &&
      (rank.isTokenChainMatch ||
        rank.tokenExactTerms > 0 ||
        rank.allTermsMatched),
  );
};

const compareTokensBySearch = (
  a: SwapTokenOption,
  b: SwapTokenOption,
  query: string,
) => {
  const aRank = getTokenSearchRank(a, query);
  const bRank = getTokenSearchRank(b, query);
  const aScore = aRank?.score ?? Number.MAX_SAFE_INTEGER;
  const bScore = bRank?.score ?? Number.MAX_SAFE_INTEGER;
  if (aScore !== bScore) return aScore - bScore;

  const aMatched = aRank?.matchedTerms ?? 0;
  const bMatched = bRank?.matchedTerms ?? 0;
  if (aMatched !== bMatched) return bMatched - aMatched;

  const aFiat = getTokenFiatValue(a);
  const bFiat = getTokenFiatValue(b);
  if (aFiat !== bFiat) return bFiat - aFiat;

  return `${a.symbol} ${a.chainName}`.localeCompare(`${b.symbol} ${b.chainName}`);
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
    sameContractAddress(a.contractAddress, b.contractAddress) &&
    a.chainId === b.chainId
  );
}

function isNativeLikeAddress(address?: string) {
  const normalized = (address ?? "").toLowerCase();
  return (
    normalized === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
    normalized === "0x0000000000000000000000000000000000000000"
  );
}

function addressTail(address?: string) {
  const normalized = (address ?? "").toLowerCase();
  if (!normalized.startsWith("0x")) return normalized;
  return normalized.slice(-40);
}

function sameContractAddress(a?: string, b?: string) {
  const normalizedA = (a ?? "").toLowerCase();
  const normalizedB = (b ?? "").toLowerCase();
  if (!normalizedA || !normalizedB) return normalizedA === normalizedB;
  if (normalizedA === normalizedB) return true;
  if (isNativeLikeAddress(normalizedA) && isNativeLikeAddress(normalizedB)) {
    return true;
  }
  return addressTail(normalizedA) === addressTail(normalizedB);
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
  onClearSelection,
  onDone,
  allowUnified = false,
  preserveSelectedBelowMinimum = false,
  allowSelectedTokenRemoval = false,
}: SwapAssetSelectorProps) {
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stableListHeightRef = useRef(0);
  const chainCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [stableListHeight, setStableListHeight] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showBelowMin, setShowBelowMin] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [isChainSelectorClosing, setIsChainSelectorClosing] = useState(false);
  const [chainQuery, setChainQuery] = useState("");
  const [selectedChainFilter, setSelectedChainFilter] = useState<number | null>(null);
  const [draftChainFilter, setDraftChainFilter] = useState<number | null>(null);
  const [isChainSearchFocused, setIsChainSearchFocused] = useState(false);

  useEffect(() => {
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

  const allTokens = useMemo<SwapTokenOption[]>(() => {
    const baseTokens = staticOptions
      ? [...staticOptions]
      : swapBalance
        ? deriveTokenOptions(swapBalance)
        : [];

    if (!preserveSelectedBelowMinimum || selectedTokens.length === 0) {
      return baseTokens;
    }

    const merged = [...baseTokens];
    const selectedSourceTokens = selectedTokens.flatMap((token) =>
      token.isUnified && token.sourceTokens?.length
        ? token.sourceTokens
        : [token],
    );

    for (const selectedToken of selectedSourceTokens) {
      const alreadyPresent = merged.some((token) =>
        sameTokenOption(token, selectedToken),
      );
      if (!alreadyPresent) {
        merged.push(selectedToken);
      }
    }

    return merged;
  }, [
    preserveSelectedBelowMinimum,
    selectedTokens,
    swapBalance,
    staticOptions,
  ]);

  /* Search + tab + chain filter */
  const filtered = useMemo(() => {
    let result = allTokens;
    if (selectedChainFilter !== null) {
      result = result.filter(t => t.chainId === selectedChainFilter);
    }
    if (query.trim()) {
      result = result
        .filter((t) => getTokenSearchRank(t, query) !== null)
        .sort((a, b) => compareTokensBySearch(a, b, query));
    }
    if (activeTab === "native") result = result.filter(isNativeToken);
    else if (activeTab === "stables") result = result.filter((t) => STABLE_SYMBOLS.has(t.symbol));
    else if (activeTab === "custom") result = result.filter((t) => !isNativeToken(t) && !STABLE_SYMBOLS.has(t.symbol));
    return result;
  }, [allTokens, query, activeTab, selectedChainFilter]);

  const isTokenSelectedForVisibility = useCallback(
    (token: SwapTokenOption) => {
      if (!preserveSelectedBelowMinimum) return false;

      return selectedTokens.some(
        (selected) =>
          sameTokenOption(selected, token) ||
          Boolean(
            selected.isUnified &&
              selected.sourceTokens?.some((source) =>
                sameTokenOption(source, token),
              ),
          ),
      );
    },
    [preserveSelectedBelowMinimum, selectedTokens],
  );

  const isUnifiedSelectedForVisibility = useCallback(
    (symbol: string) =>
      preserveSelectedBelowMinimum &&
      selectedTokens.some(
        (selected) => selected.isUnified && selected.unifiedSymbol === symbol,
      ),
    [preserveSelectedBelowMinimum, selectedTokens],
  );

  /* Split into above/below minimum */
  const { aboveMin, belowMin } = useMemo(() => {
    const above: SwapTokenOption[] = [];
    const below: SwapTokenOption[] = [];
    for (const t of filtered) {
      const fiat = getTokenFiatValue(t);
      if (
        fiat >= MIN_FIAT_THRESHOLD ||
        isTokenSelectedForVisibility(t) ||
        isPrioritySearchMatch(t, query)
      ) above.push(t);
      else below.push(t);
    }
    return { aboveMin: above, belowMin: below };
  }, [filtered, isTokenSelectedForVisibility, query]);

  /* Group by symbol */
  const groupedFiltered = useMemo(() => {
    const groups: Record<string, SwapTokenOption[]> = {};
    for (const token of filtered) {
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
          totalFiatVal += getTokenFiatValue(t);
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
      .filter((group) => {
        const hasSelectedToken = group.tokens.some(isTokenSelectedForVisibility);
        const hasSelectedUnified = isUnifiedSelectedForVisibility(group.symbol);
        const hasPrioritySearchMatch = group.tokens.some((token) =>
          isPrioritySearchMatch(token, query),
        );
        if (group.isUnifiedCandidate) {
          return (
            group.totalFiat >= MIN_FIAT_THRESHOLD ||
            hasSelectedToken ||
            hasSelectedUnified ||
            hasPrioritySearchMatch
          );
        }
        return group.tokens.some(
          (token) =>
            getTokenFiatValue(token) >= MIN_FIAT_THRESHOLD ||
            isTokenSelectedForVisibility(token) ||
            isPrioritySearchMatch(token, query),
        );
      })
      .sort((a, b) => {
        if (query.trim()) {
          const aScore = Math.min(
            ...a.tokens.map(
              (token) =>
                getTokenSearchRank(token, query)?.score ??
                Number.MAX_SAFE_INTEGER,
            ),
          );
          const bScore = Math.min(
            ...b.tokens.map(
              (token) =>
                getTokenSearchRank(token, query)?.score ??
                Number.MAX_SAFE_INTEGER,
            ),
          );
          if (aScore !== bScore) return aScore - bScore;
        }
        return b.totalFiat - a.totalFiat;
      });
  }, [filtered, allowUnified, isTokenSelectedForVisibility, isUnifiedSelectedForVisibility, query]);

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
    !allowSelectedTokenRemoval &&
    selectedTokens.some((st, idx) => idx !== editingAssetIndex && sameTokenOption(st, token));

  const isTokenSelectedInCurrentSlot = (token: SwapTokenOption) => {
    if (isMulti) {
      return selectedTokens.some(
        (st) =>
          sameTokenOption(st, token) ||
          Boolean(
            st.isUnified &&
              st.sourceTokens?.some((source) => sameTokenOption(source, token)),
          ),
      );
    }
    if (allowSelectedTokenRemoval) {
      return selectedTokens.some(
        (st) =>
          sameTokenOption(st, token) ||
          Boolean(
            st.isUnified &&
              st.sourceTokens?.some((source) => sameTokenOption(source, token)),
          ),
      );
    }
    if (editingAssetIndex === null) return false;
    const st = selectedTokens[editingAssetIndex];
    return sameTokenOption(st, token);
  };

  const isGroupUnifiedSelectedInOtherSlot = (group: typeof groupedFiltered[0]) => {
    if (allowSelectedTokenRemoval) return false;
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
    if (allowSelectedTokenRemoval) return false;
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
          if ((isMulti || (allowSelectedTokenRemoval && selectedInCurrent)) && onToggle) {
            onToggle(token);
          }
          else onSelect(token);
        }}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", paddingLeft: indent ? "36px" : "14px",
          backgroundColor: "transparent", border: "none", cursor: disabled ? "not-allowed" : "pointer",
          borderBottom: "1px solid #F0F0EF", boxSizing: "border-box",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SelectionControl selected={selectedInCurrent} multi={Boolean(isMulti)} />
          <div style={{ flexShrink: 0, width: 40, height: 40 }}>
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
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 15, color: "#161615" }}>
              {token.symbol}
            </span>
            {token.chainName && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {token.chainLogo && (
                  <img
                    src={token.chainLogo}
                    alt=""
                    style={{ borderRadius: "999px", height: 14, objectFit: "cover", width: 14 }}
                  />
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
      return group.tokens
        .filter(
          (token) =>
            getTokenFiatValue(token) >= MIN_FIAT_THRESHOLD ||
            isTokenSelectedForVisibility(token) ||
            isPrioritySearchMatch(token, query),
        )
        .map((token) => renderTokenRow(token));
    }

    const unifiedSelectedInOther = !isMulti && isGroupUnifiedSelectedInOtherSlot(group);
    if (unifiedSelectedInOther) return null;

    const individualTokens = group.tokens.filter(
      (token) =>
        getTokenFiatValue(token) >= MIN_FIAT_THRESHOLD ||
        isTokenSelectedForVisibility(token) ||
        isPrioritySearchMatch(token, query),
    );
    const hasVisibleUnifiedRow =
      (group.totalFiat >= MIN_FIAT_THRESHOLD ||
        isUnifiedSelectedForVisibility(group.symbol)) &&
      !unifiedSelectedInOther;
    const visibleTokensCount = individualTokens.filter(
      (t) => !isTokenSelectedInOtherSlot(t),
    ).length;
    if (!hasVisibleUnifiedRow && visibleTokensCount === 0) return null;

    const isExpanded = expandedGroups.has(group.symbol);
    const unifiedSelectedInCurrent = isGroupUnifiedSelectedInCurrentSlot(group);
    const anyIndividualSelectedInOther = isAnyTokenInGroupSelectedInOtherSlot(group);
    const anyIndividualSelectedInCurrent = group.tokens.some(isTokenSelectedInCurrentSlot);
    const selectedChildCount = group.tokens.filter(isTokenSelectedInCurrentSlot).length;
    const areAllChildrenSelected =
      group.tokens.length > 0 && selectedChildCount === group.tokens.length;
    const isPartiallySelected =
      selectedChildCount > 0 && selectedChildCount < group.tokens.length;
    const shouldHideUnifiedRow =
      !isMulti &&
      (anyIndividualSelectedInOther ||
        anyIndividualSelectedInCurrent ||
        (group.totalFiat < MIN_FIAT_THRESHOLD &&
          !isUnifiedSelectedForVisibility(group.symbol)));
    const shouldHideIndividualRows =
      !isMulti && (unifiedSelectedInOther || unifiedSelectedInCurrent);
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
        {!shouldHideUnifiedRow && (
          <button
            onClick={(e) => {
              if (isMulti) {
                toggleGroup(group.symbol, e);
                return;
              }
              onSelect(unifiedToken);
            }}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", backgroundColor: "transparent", border: "none",
              cursor: "pointer", borderBottom: "1px solid #F0F0EF", boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div onClick={(e) => {
                   e.stopPropagation();
                   if (isMulti && onToggle) onToggle(unifiedToken);
                   else onSelect(unifiedToken);
                }} style={{ cursor: "pointer" }}>
                  <SelectionControl
                    selected={isMulti ? areAllChildrenSelected : unifiedSelectedInCurrent}
                    indeterminate={isMulti ? isPartiallySelected : false}
                    multi={Boolean(isMulti)}
                  />
                </div>
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
        )}
        {isMulti ? (
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
        ) : (
          !shouldHideIndividualRows &&
          individualTokens.map((token) => renderTokenRow(token))
        )}
      </div>
    );
  };

  const isLoading = !staticOptions && swapBalance === null;
  const selectedAssetCount = selectedTokens.length;
  const subtitle = isMulti
    ? `${selectedAssetCount} asset${selectedAssetCount === 1 ? "" : "s"} selected`
    : "";

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
        transition: modalHeightTransition,
        width: "100%",
        willChange: "height, max-height",
      }}
    >
      {/* Drawer Handle */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <div style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: "#E8E8E7" }} />
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, borderRadius: 8, border: "1px solid #E8E8E7",
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "#FFFFFE", cursor: "pointer", flexShrink: 0
        }}>
          <ChevronDown style={{ width: 16, height: 16, transform: "rotate(90deg)" }} />
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, flex: "1 1 auto" }}>
          <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 18, fontWeight: 600, color: "#161615" }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>
              {subtitle}
            </span>
          )}
        </div>
        {isMulti && selectedAssetCount > 0 && onClearSelection && (
          <button
            onClick={onClearSelection}
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: "#006BF4",
              cursor: "pointer",
              flexShrink: 0,
              fontFamily: '"Geist", system-ui, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              lineHeight: "18px",
              padding: "2px 0",
            }}
          >
            Deselect all
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ paddingBottom: 6 }}>
        <div
          style={{
            display: "flex", alignItems: "center", height: 42, gap: 8, borderRadius: 12,
            border: `1px solid ${isSearchFocused ? "#A8C9FF" : "#E8E8E7"}`,
            boxShadow: isSearchFocused ? "0 0 0 1px rgba(0,107,244,0.16)" : "none",
            padding: "0 8px 0 16px",
            backgroundColor: "#F0F0EF",
          }}
        >
          <Search style={{ width: 20, height: 20, color: "#848483", flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
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
            onClick={openChainSelector}
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
      <div style={{ display: "flex", gap: 0, backgroundColor: "#F0F0EF", borderRadius: 8, padding: 4, marginBottom: 6 }}>
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
      <div
        ref={listRef}
        style={{
          flex: "1 1 auto",
          minHeight: stableListHeight ? `${stableListHeight}px` : 0,
          overflowY: "auto",
          paddingBottom: 6,
        }}
      >
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {groupedFiltered.length > 0 && (
              <div
                style={{
                  border: "1px solid #E8E8E7",
                  borderRadius: 14,
                  overflowX: "hidden",
                  overflowY: "visible",
                  backgroundColor: "#FFFFFE",
                }}
              >
                {groupedFiltered.map((group) =>
                  group.tokens.length === 1
                    ? renderTokenRow(group.tokens[0])
                    : renderGroupRow(group)
                )}
              </div>
            )}

            {belowMin.length > 0 && (
              <div
                style={{
                  backgroundColor: "#FFFFFE",
                  border: "1px solid #E8E8E7",
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setShowBelowMin((v) => !v)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px", backgroundColor: "transparent", border: "none", cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        alignItems: "center",
                        backgroundColor: "#F0F0EF",
                        borderRadius: "999px",
                        display: "flex",
                        flexShrink: 0,
                        height: 28,
                        justifyContent: "center",
                        width: 28,
                      }}
                    >
                      <Info style={{ width: 16, height: 16, color: "#848483" }} />
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 600, fontSize: 14, color: "#161615" }}>
                        Tokens below minimum
                      </span>
                      <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#848483" }}>
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
                    <div
                      style={{
                        backgroundColor: "#F6F6F5",
                        borderRadius: 14,
                        margin: showBelowMin ? "0 14px 14px" : "0 14px",
                        overflow: "hidden",
                        transition: "margin 240ms ease",
                      }}
                    >
                      <div
                        style={{
                          alignItems: "center",
                          display: "flex",
                          gap: 10,
                          padding: "12px 14px",
                        }}
                      >
                        <span
                          style={{
                            alignItems: "center",
                            backgroundColor: "#FFF0D6",
                            borderRadius: "999px",
                            color: "#D98A1C",
                            display: "flex",
                            flexShrink: 0,
                            fontFamily: '"Geist", system-ui, sans-serif',
                            fontSize: 13,
                            fontWeight: 700,
                            height: 24,
                            justifyContent: "center",
                            width: 24,
                          }}
                        >
                          !
                        </span>
                        <span style={{ color: "#363635", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, fontWeight: 500 }}>
                          Tokens under $1 are unavailable for swaps
                        </span>
                      </div>
                      <div
                        style={{
                          maxHeight: 228,
                          overflowY: "auto",
                          overscrollBehavior: "contain",
                        }}
                      >
                        {belowMin.map((token) => (
                          <div key={`${token.contractAddress}-${token.chainId}`} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            borderBottom: "1px solid #E8E8E7",
                            opacity: 0.62,
                            padding: "9px 14px",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                              <div style={{ position: "relative", width: 30, height: 30, flexShrink: 0 }}>
                                {token.logo ? (
                                  <img src={token.logo} alt={token.symbol} style={{ filter: "grayscale(0.2)", width: 30, height: 30, borderRadius: "999px", objectFit: "cover" }} />
                                ) : (
                                  <div style={{ width: 30, height: 30, borderRadius: "999px", backgroundColor: "#C8C8C7", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                                    {token.symbol.slice(0, 2)}
                                  </div>
                                )}
                                {token.chainLogo && (
                                  <img
                                    src={token.chainLogo}
                                    alt=""
                                    style={{
                                      border: "1.5px solid #F6F6F5",
                                      borderRadius: "999px",
                                      bottom: -2,
                                      filter: "grayscale(0.2)",
                                      height: 13,
                                      objectFit: "cover",
                                      position: "absolute",
                                      right: -2,
                                      width: 13,
                                    }}
                                  />
                                )}
                              </div>
                              <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontWeight: 500, fontSize: 14, color: "#848483", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {token.symbol} on {token.chainName || "Unknown chain"}
                              </span>
                            </div>
                            <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14, color: "#848483", fontWeight: 500, flexShrink: 0, marginLeft: 12 }}>
                              {token.balanceInFiat}
                            </span>
                          </div>
                        ))}
                      </div>
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
        <div style={{ paddingBottom: 6, marginTop: "auto" }}>
          <button
            onClick={onDone}
            style={{
              width: "100%", height: 48, display: "flex", alignItems: "center", justifyContent: "center",
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
                width: 30, height: 30, borderRadius: 8, border: "1px solid #E8E8E7",
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: "#FFFFFE", cursor: "pointer", flexShrink: 0
              }}
            >
              <ChevronDown style={{ width: 15, height: 15, transform: "rotate(90deg)" }} />
            </button>
            <span style={{ color: "#161615", fontFamily: '"Geist", system-ui, sans-serif', fontSize: 17, fontWeight: 600 }}>
              Select chain
            </span>
          </div>
          
          {/* Search */}
          <div style={{ paddingBottom: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", height: 38, gap: 8, borderRadius: 11,
              border: `1px solid ${isChainSearchFocused ? "#A8C9FF" : "#E8E8E7"}`,
              padding: "0 12px",
              backgroundColor: "#FFFFFE",
              boxShadow: isChainSearchFocused ? "0 0 0 1px rgba(0,107,244,0.16)" : "none",
            }}>
              <Search style={{ width: 18, height: 18, color: "#848483", flexShrink: 0 }} />
              <input
                value={chainQuery}
                onChange={(e) => setChainQuery(e.target.value)}
                onFocus={() => setIsChainSearchFocused(true)}
                onBlur={() => setIsChainSearchFocused(false)}
                placeholder="Search chains"
                style={{
                  flex: 1, backgroundColor: "transparent", border: "none", outline: "none",
                  fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, color: "#161615",
                }}
              />
            </div>
          </div>
          
          {/* Chain list */}
          <div
            style={{
              flex: "1 1 auto",
              marginBottom: 10,
              minHeight: 0,
              overflowY: "auto",
            }}
          >
            <div style={{
              border: "1px solid #E8E8E7", borderRadius: 12, overflow: "hidden",
              backgroundColor: "#FFFFFE",
            }}>
              <button
                onClick={() => setDraftChainFilter(null)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", padding: "8px 14px",
                  backgroundColor: "transparent", border: "none", borderBottom: "1px solid #F0F0EF",
                  cursor: "pointer", boxSizing: "border-box"
                }}
              >
                <RadioDot selected={draftChainFilter === null} />
                <img src="/nexus-one/all-chains.png" alt="All Chains" style={{ marginLeft: 10, width: 28, height: 28, borderRadius: "999px", objectFit: "cover" }} />
                <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14, fontWeight: 500, marginLeft: 10, color: "#161615" }}>
                  All Chains
                </span>
              </button>
              
              {/* Unique chains */}
              {Array.from(new Map(allTokens.filter(t => t.chainId).map(t => [t.chainId, t])).values())
                .filter(t => (t.chainName || "").toLowerCase().includes(chainQuery.toLowerCase()))
                .map(t => (
                  <button
                    key={`chain-${t.chainId}`}
                    onClick={() => setDraftChainFilter(t.chainId!)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", padding: "8px 14px",
                      backgroundColor: "transparent", border: "none", borderBottom: "1px solid #F0F0EF",
                      cursor: "pointer", boxSizing: "border-box"
                    }}
                  >
                    <RadioDot selected={draftChainFilter === t.chainId} />
                    <img src={t.chainLogo} alt={t.chainName} style={{ marginLeft: 10, width: 28, height: 28, borderRadius: "999px", objectFit: "cover" }} />
                    <span style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: 14, fontWeight: 500, marginLeft: 10, color: "#161615" }}>
                      {t.chainName}
                    </span>
                  </button>
                ))
              }
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
    </div>
  );
}
