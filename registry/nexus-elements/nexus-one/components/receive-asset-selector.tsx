"use client";
import { nexusOneTheme } from "../theme";
import React, { useState, useMemo } from "react";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { type SwapTokenOption } from "./swap-asset-selector";
import { useNexus } from "../../nexus/NexusProvider";

interface ReceiveAssetSelectorProps {
  onSelect: (token: SwapTokenOption) => void;
  onBack: () => void;
}

export function ReceiveAssetSelector({
  onSelect,
  onBack,
}: ReceiveAssetSelectorProps) {
  const { supportedChainsAndTokens, swapSupportedChainsAndTokens } = useNexus();
  const [query, setQuery] = useState("");
  const [selectedTokenHash, setSelectedTokenHash] = useState<string | null>(null);

  // Group tokens by symbol
  const tokenList = useMemo(() => {
    if (!supportedChainsAndTokens || !swapSupportedChainsAndTokens) return [];
    
    // Create a Set of swap-supported chain IDs for fast lookup
    const swapChainIds = new Set(swapSupportedChainsAndTokens.map(c => c.id));

    const tokensBySymbol = new Map<string, {
      symbol: string;
      name: string;
      logo: string;
      supportedChains: {
        chainId: number;
        chainName: string;
        chainLogo: string;
        contractAddress: string;
        decimals: number;
      }[];
    }>();

    for (const chain of supportedChainsAndTokens) {
      if (!swapChainIds.has(chain.id)) continue;
      
      for (const t of chain.tokens || []) {
        if (!tokensBySymbol.has(t.symbol)) {
          tokensBySymbol.set(t.symbol, {
            symbol: t.symbol,
            name: t.name,
            logo: t.logo,
            supportedChains: [],
          });
        }
        tokensBySymbol.get(t.symbol)!.supportedChains.push({
          chainId: chain.id,
          chainName: chain.name,
          chainLogo: chain.logo,
          contractAddress: t.contractAddress,
          decimals: t.decimals,
        });
      }
    }
    return Array.from(tokensBySymbol.values());
  }, [supportedChainsAndTokens, swapSupportedChainsAndTokens]);

  const filteredTokens = useMemo(() => {
    if (!query.trim()) return tokenList;
    const q = query.toLowerCase();
    return tokenList.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
    );
  }, [query, tokenList]);

  const selectedToken = useMemo(() => {
    return tokenList.find((t) => t.symbol === selectedTokenHash) || null;
  }, [selectedTokenHash, tokenList]);

  const handleChainSelect = (chainDetails: typeof tokenList[0]["supportedChains"][0]) => {
    if (!selectedToken) return;
    onSelect({
      contractAddress: chainDetails.contractAddress,
      symbol: selectedToken.symbol,
      name: selectedToken.name,
      logo: selectedToken.logo,
      decimals: chainDetails.decimals,
      balance: "0",
      balanceInFiat: "$0.00",
      chainId: chainDetails.chainId,
      chainName: chainDetails.chainName,
      chainLogo: chainDetails.chainLogo,
    });
  };

  return (
    <div className="flex flex-col h-full w-full antialiased bg-transparent">
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1 bg-transparent flex flex-col gap-4">
        {/* Search */}
        <div
          className="flex items-center px-4 w-full"
          style={{
            height: "44px",
            gap: "12px",
            borderRadius: "12px",
            borderWidth: "1px",
            background: "var(--background-tertiary, var(--background-tertiary, #F0F0EF))",
            borderColor: "transparent",
          }}
        >
          <Search
            className="shrink-0"
            style={{ width: "20px", height: "20px", color: "var(--foreground-muted, var(--foreground-muted, #848483))" }}
          />
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-[14px]"
            style={{
              fontFamily: "var(--font-geist-sans), sans-serif",
              color: "var(--widget-card-foreground-primary, var(--foreground-primary, #161615))",
            }}
          />
        </div>

        {/* Tokens List Container */}
        <div
          style={{
            border: "1px solid var(--widget-card-border, var(--border-default, #E8E8E7))",
            borderRadius: "8px",
            background: "var(--widget-card-background-primary, #FFFFFE)",
            overflow: "hidden",
          }}
          className="flex flex-col divide-y divide-[var(--border-default, #E8E8E7)]"
        >
          {filteredTokens.length === 0 ? (
            <p className="text-sm text-center text-gray-400 py-8">No tokens found</p>
          ) : (
            filteredTokens.map((token) => (
              <button
                key={token.symbol}
                onClick={() => setSelectedTokenHash(token.symbol)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors group"
              >
                <div className="flex items-center gap-x-3">
                  <div className="relative shrink-0">
                    <img
                      src={token.logo}
                      alt={token.symbol}
                      className="w-9 h-9 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-geist-sans), sans-serif",
                      fontWeight: 500,
                      fontSize: "14px",
                      color: "var(--foreground-primary, var(--foreground-primary, #161615))",
                    }}
                  >
                    {token.symbol}
                  </span>
                </div>
                <div className="text-gray-400 shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 z-40 ${
          selectedToken ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`} 
        onClick={() => setSelectedTokenHash(null)}
      />

      {/* Slide-up Chain Modal */}
      <div
        className={`absolute inset-x-0 bottom-0 rounded-t-2xl flex flex-col transition-transform duration-300 ease-in-out z-50 ${
          selectedToken ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ 
          height: "calc(100% - 24px)", 
          background: "var(--widget-background, #F9F9F8)",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D"
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span
            style={{
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontSize: "16px",
              fontWeight: 500,
              color: "var(--foreground-primary, var(--foreground-primary, #161615))",
            }}
          >
            Select a Chain
          </span>
          <button
            onClick={() => setSelectedTokenHash(null)}
            className="p-1 rounded-full hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div
            style={{
              border: "1px solid var(--widget-card-border, var(--border-default, #E8E8E7))",
              borderRadius: "8px",
              background: "var(--widget-card-background-primary, #FFFFFE)",
              overflow: "hidden",
            }}
            className="flex flex-col divide-y divide-[var(--border-default, #E8E8E7)]"
          >
            {selectedToken?.supportedChains.map((chain) => (
              <button
                key={chain.chainId}
                onClick={() => handleChainSelect(chain)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
              >
                <div className="flex items-center gap-x-3">
                  <div className="relative shrink-0 w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center overflow-hidden bg-white">
                    {chain.chainLogo ? (
                      <img
                        src={chain.chainLogo}
                        alt={chain.chainName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-xs font-medium text-gray-500">
                        {chain.chainName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-geist-sans), sans-serif",
                      fontWeight: 500,
                      fontSize: "15px",
                      color: "var(--foreground-primary, var(--foreground-primary, #161615))",
                    }}
                  >
                    {chain.chainName === "Ethereum" ? "Mainnet" : chain.chainName}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
