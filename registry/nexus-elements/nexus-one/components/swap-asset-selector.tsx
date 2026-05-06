"use client";
import { nexusOneTheme } from "../theme";
import React, { useMemo, useState } from "react";
import { Search, X, ChevronLeft, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
}

interface SwapAssetSelectorProps {
  /** Title shown in the panel header */
  title: string;
  /** swapBalance from useNexus for source tokens. Pass null to show loader. */
  swapBalance: UserAsset[] | null;
  /** For dest-mode we accept a static list instead */
  staticOptions?: SwapTokenOption[];
  onSelect: (token: SwapTokenOption) => void;
  onBack: () => void;
  isMulti?: boolean;
  selectedTokens?: SwapTokenOption[];
  onToggle?: (token: SwapTokenOption) => void;
  onDone?: () => void;
}

/** Derive flat list of SwapTokenOption from UserAsset[] */
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
  // Dedupe by contractAddress + chainId
  const seen = new Map<string, SwapTokenOption>();
  for (const t of tokens) {
    seen.set(`${t.contractAddress.toLowerCase()}-${t.chainId}`, t);
  }
  return Array.from(seen.values());
}

const CheckboxBox = ({ selected }: { selected: boolean }) => {
  if (selected) {
    return (
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "4px",
          background: "var(--foreground-brand, #006BF4)",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "2px",
            background: "var(--white-0, var(--background-secondary, #FFFFFE))",
          }}
        />
      </div>
    );
  }
  return (
    <div
      className="shrink-0"
      style={{
        width: "20px",
        height: "20px",
        borderRadius: "4px",
        borderWidth: "2px",
        background: "var(--widget-card-background-primary, var(--background-secondary, #FFFFFE))",
        borderColor: "var(--widget-card-border, var(--border-default, #E8E8E7))",
        borderStyle: "solid",
      }}
    />
  );
};

export function SwapAssetSelector({
  title,
  swapBalance,
  staticOptions,
  onSelect,
  onBack,
  isMulti,
  selectedTokens = [],
  onToggle,
  onDone,
}: SwapAssetSelectorProps) {
  const [query, setQuery] = useState("");

  const allTokens = useMemo<SwapTokenOption[]>(() => {
    if (staticOptions) return staticOptions;
    if (!swapBalance) return [];
    return deriveTokenOptions(swapBalance);
  }, [swapBalance, staticOptions]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allTokens;
    const q = query.toLowerCase();
    return allTokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.chainName ?? "").toLowerCase().includes(q),
    );
  }, [allTokens, query]);

  const groupedFiltered = useMemo(() => {
    const groups: Record<string, SwapTokenOption[]> = {};
    for (const token of filtered) {
      if (!groups[token.symbol]) groups[token.symbol] = [];
      groups[token.symbol].push(token);
    }
    
    return Object.values(groups).map((group) => {
      let totalFiatVal = 0;
      let totalBalVal = 0;
      
      for (const t of group) {
        totalFiatVal += Number(t.balanceInFiat.replace(/[^0-9.]/g, "") || 0);
        totalBalVal += Number(t.balance.replace(/[^0-9.]/g, "") || 0);
      }
      
      return {
        symbol: group[0].symbol,
        logo: group[0].logo,
        totalFiat: `$${totalFiatVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        totalBal: `${totalBalVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} ${group[0].symbol}`,
        tokens: group,
      };
    }).sort((a, b) => {
      const aFiat = Number(a.totalFiat.replace(/[^0-9.]/g, "") || 0);
      const bFiat = Number(b.totalFiat.replace(/[^0-9.]/g, "") || 0);
      return bFiat - aFiat;
    });
  }, [filtered]);

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
    if (!isMulti || !onToggle) return;
    
    if (isFullySelected) {
      // Deselect all
      groupTokens.forEach(t => {
        if (selectedTokens.some(st => st.contractAddress === t.contractAddress && st.chainId === t.chainId)) {
          onToggle(t);
        }
      });
    } else {
      // Select all
      groupTokens.forEach(t => {
        if (!selectedTokens.some(st => st.contractAddress === t.contractAddress && st.chainId === t.chainId)) {
          onToggle(t);
        }
      });
    }
  };

  const renderTokenRow = (token: SwapTokenOption) => {
    const isSelected = selectedTokens.some(
      (st) =>
        st.contractAddress === token.contractAddress &&
        st.chainId === token.chainId
    );
    return (
      <button
        key={`${token.contractAddress}-${token.chainId}`}
        onClick={() => {
          if (isMulti && onToggle) {
            onToggle(token);
          } else if (!isMulti) {
            onSelect(token);
          }
        }}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-black/5 transition-colors group"
      >
        <div className="flex items-center gap-x-3">
          {isMulti && <CheckboxBox selected={isSelected} />}
           <div className="relative shrink-0">
            {token.logo ? (
              <img
                src={token.logo}
                alt={token.symbol}
                className="w-9 h-9 rounded-full border border-white shadow-sm object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{
                  background:
                    "var(--interactive-button-primary-background, var(--foreground-brand, #006BF4))",
                }}
              >
                {token.symbol.slice(0, 2)}
              </div>
            )}
          </div>
          <div className="flex flex-col items-start">
            <span
              style={{
                fontFamily: "var(--font-geist-sans), sans-serif",
                fontWeight: 500,
                fontSize: "14px",
                color: "var(--foreground-primary, #161615)",
              }}
            >
              {token.symbol}
            </span>
            {token.chainName && (
              <span
                style={{
                  fontFamily: "var(--font-geist-sans), sans-serif",
                  fontSize: "12px",
                  color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                }}
              >
                {token.chainName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-x-3">
          <div className="flex flex-col items-end">
            <span
              style={{
                fontFamily: "var(--font-geist-sans), sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                color: "var(--foreground-primary, #161615)",
              }}
            >
              {token.balanceInFiat}
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-sans), sans-serif",
                fontSize: "12px",
                color: "var(--foreground-muted, var(--foreground-muted, #848483))",
              }}
            >
              {token.balance}
            </span>
          </div>
          <div className="w-5 h-5 shrink-0" />
        </div>
      </button>
    );
  };

  const isLoading = !staticOptions && swapBalance === null;

  return (
    <div className="flex flex-col h-full w-full antialiased">
      {/* Search */}
      <div className="pb-3">
        <div
          className="flex items-center"
          style={{
            height: "44px",
            gap: "8px",
            borderRadius: "12px",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border-default, var(--border-default, #E8E8E7))",
            paddingTop: "12px",
            paddingRight: "16px",
            paddingBottom: "12px",
            paddingLeft: "16px",
            background: "var(--background-tertiary, var(--background-tertiary, #F0F0EF))",
          }}
        >
          <Search
            style={{
              width: "20px",
              height: "20px",
              color: "var(--foreground-muted, var(--foreground-muted, #848483))",
            }}
            className="shrink-0"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent border-none outline-none placeholder:text-[var(--foreground-muted, #848483)]"
            style={{
              fontFamily: "Geist, var(--font-geist-sans), sans-serif",
              fontWeight: 400,
              fontSize: "14px",
              lineHeight: "18px",
              color: "var(--widget-card-foreground-primary, var(--foreground-primary, #161615))",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="shrink-0">
              <X className="w-4 h-4 text-[var(--foreground-muted, #848483)]" />
            </button>
          )}
        </div>
      </div>

      {/* Token list */}
      <div className="flex-1 overflow-y-auto pb-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-y-3">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <p className="text-sm text-gray-400">Loading assets…</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-center text-gray-400 py-8">
            No tokens found
          </p>
        ) : (
          <div
            style={{
              border: "1px solid var(--widget-card-border, var(--border-default, #E8E8E7))",
              maxHeight: "288px",
              borderRadius: "8px",
              borderWidth: "1px",
              overflowY: "auto",
              background: "var(--widget-card-background-primary, var(--background-secondary, #FFFFFE))",
            }}
            className="flex flex-col p-1 space-y-1"
          >
            {groupedFiltered.map((group) => {
              if (group.tokens.length === 1) {
                return renderTokenRow(group.tokens[0]);
              }

              const isExpanded = expandedGroups.has(group.symbol);
              const selectedCount = group.tokens.filter(t => 
                selectedTokens.some(st => st.contractAddress === t.contractAddress && st.chainId === t.chainId)
              ).length;
              const isFullySelected = selectedCount === group.tokens.length;
              const hasSelection = selectedCount > 0;

              return (
                <div key={group.symbol} className="flex flex-col w-full">
                  <button
                    onClick={(e) => toggleGroup(group.symbol, e)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-black/5 transition-colors group"
                  >
                    <div className="flex items-center gap-x-3">
                      {isMulti && (
                        <div onClick={(e) => toggleGroupSelection(group.tokens, isFullySelected, e)}>
                          <CheckboxBox selected={hasSelection} />
                        </div>
                      )}
                      <div className="relative shrink-0">
                        {group.logo ? (
                          <img
                            src={group.logo}
                            alt={group.symbol}
                            className="w-9 h-9 rounded-full border border-white shadow-sm object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{
                              background:
                                "var(--interactive-button-primary-background, var(--foreground-brand, #006BF4))",
                            }}
                          >
                            {group.symbol.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-start">
                        <span
                          style={{
                            fontFamily: "var(--font-geist-sans), sans-serif",
                            fontWeight: 500,
                            fontSize: "14px",
                            color: "var(--foreground-primary, #161615)",
                          }}
                        >
                          {group.symbol}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-geist-sans), sans-serif",
                            fontSize: "12px",
                            color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                          }}
                        >
                          {group.tokens.length} Chains
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-x-3">
                      <div className="flex flex-col items-end">
                        <span
                          style={{
                            fontFamily: "var(--font-geist-sans), sans-serif",
                            fontWeight: 500,
                            fontSize: "13px",
                            color: "var(--foreground-primary, #161615)",
                          }}
                        >
                          {group.totalFiat}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-geist-sans), sans-serif",
                            fontSize: "12px",
                            color: "var(--foreground-muted, var(--foreground-muted, #848483))",
                          }}
                        >
                          {group.totalBal}
                        </span>
                      </div>
                      <div className="text-gray-400 shrink-0">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </button>
                  
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-col pl-6 mt-1 space-y-1 py-1">
                        {group.tokens.map((token) => renderTokenRow(token))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isMulti && (
        <div className="pb-4 mt-auto">
          <button
            onClick={onDone}
            disabled={selectedTokens.length === 0}
            className="w-full font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 active:opacity-100 flex items-center justify-center cursor-pointer"
            style={{
              background: "var(--foreground-brand, #006BF4)",
              boxShadow: "0px 1px 4px 0px #5555550D",
              height: "48px",
              borderRadius: "12px",
              fontSize: "14px",
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

