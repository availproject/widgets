import React, { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import { Check, ChevronDown, ChevronRight, Search } from "lucide-react";
import { parseAmount } from "../utils/amount";
import { LogoPair, TokenLogo } from "./deposit-token-logo";
import type { SwapTokenOption } from "./swap-asset-selector";

interface DepositAssetSelectorProps {
  tokens: SwapTokenOption[];
  selectedTokens?: SwapTokenOption[];
  editingToken?: SwapTokenOption;
  isBalanceLoading?: boolean;
  minBalanceUsd?: number;
  onSelect: (token: SwapTokenOption) => void;
  onDismiss?: () => void;
}

const sourceKey = (token: SwapTokenOption) =>
  `${token.chainId}:${token.contractAddress.toLowerCase()}`;

export function DepositAssetSelector({
  tokens,
  selectedTokens = [],
  editingToken,
  isBalanceLoading = false,
  minBalanceUsd,
  onSelect,
  onDismiss,
}: DepositAssetSelectorProps) {
  const [query, setQuery] = useState("");
  const [chainId, setChainId] = useState<number | "all">("all");
  const [chainMenuOpen, setChainMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const chainControlRef = useRef<HTMLDivElement>(null);
  const chainButtonRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const isSheet = Boolean(onDismiss);

  useEffect(() => {
    if (!isSheet) return;
    const previous = document.activeElement as HTMLElement | null;
    const sheet = rootRef.current;
    sheet?.focus({ preventScroll: true });
    return () => {
      // Picking a token may already have moved focus into the new amount field.
      if (document.activeElement === document.body || sheet?.contains(document.activeElement)) {
        previous?.focus?.({ preventScroll: true });
      }
    };
  }, [isSheet]);

  useEffect(() => {
    if (!chainMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!chainControlRef.current?.contains(event.target as Node)) {
        setChainMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [chainMenuOpen]);

  const selectedKeys = new Set(selectedTokens.flatMap((token) =>
    (token.sourceTokens?.length ? token.sourceTokens : [token]).map(sourceKey),
  ));
  const availableTokens = tokens.filter((token) => {
    if (
      selectedKeys.has(sourceKey(token)) &&
      !(editingToken && sourceKey(token) === sourceKey(editingToken))
    ) {
      return false;
    }
    if (minBalanceUsd !== undefined) {
      const fiat = parseAmount(token.balanceInFiat) ?? new Decimal(0);
      if (fiat.lt(minBalanceUsd)) return false;
    }
    return true;
  });
  const chains = Array.from(new Map(availableTokens
    .filter((token) => token.chainId !== undefined)
    .map((token) => [token.chainId!, {
      id: token.chainId!, name: token.chainName || `Chain ${token.chainId}`, logo: token.chainLogo,
    }])).values());
  const selectedChain = chains.find((chain) => chain.id === chainId);
  const visibleTokens = availableTokens.filter((token) =>
    (chainId === "all" || token.chainId === chainId) &&
    `${token.symbol} ${token.name} ${token.chainName ?? ""} ${token.contractAddress}`
      .toLowerCase().includes(query.trim().toLowerCase()),
  ).sort((a, b) =>
    (parseAmount(b.balanceInFiat) ?? new Decimal(0)).cmp(parseAmount(a.balanceInFiat) ?? 0),
  );

  return (
    <div
      className="nx-asset-picker"
      ref={rootRef}
      role={isSheet ? "dialog" : undefined}
      aria-modal={isSheet || undefined}
      aria-label={isSheet ? editingToken ? "Change token" : "Add another token" : "Select token"}
      tabIndex={isSheet ? -1 : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          if (chainMenuOpen) {
            setChainMenuOpen(false);
            chainButtonRef.current?.focus();
          } else dismissRef.current?.();
        }
        if (event.key === "Tab" && isSheet) {
          const elements = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled)',
          ) ?? []);
          const first = elements[0];
          const last = elements.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <style>{`
        .nx-asset-picker { container-type:inline-size; display:flex; flex-direction:column; height:100%; min-height:0; color:var(--nx-ink,#161615); font-family:"Geist",system-ui,sans-serif; outline:none; }
        .nx-asset-picker button { color:inherit; font:inherit; cursor:pointer; border:none; }
        .nx-asset-picker button:focus-visible, .nx-asset-search:focus-within { outline:2px solid var(--nx-blue,#006BF4); outline-offset:2px; }
        .nx-asset-controls { display:flex; flex-shrink:0; gap:8px; padding:12px 20px 10px; }
        .nx-asset-search { display:flex; align-items:center; gap:10px; min-width:0; flex:1; padding:10px 14px; border-radius:14px; background:var(--nx-fill,#F3F3F3); }
        .nx-asset-search input { min-width:0; width:100%; flex:1; background:none; border:none; outline:none; color:inherit; font:400 14px/20px "Geist",system-ui,sans-serif; }
        .nx-asset-search input::placeholder { color:var(--nx-mute,#737372); }
        .nx-asset-chain { display:flex; align-items:center; gap:8px; max-width:160px; height:40px; padding:0 12px 0 10px; border-radius:14px; background:var(--nx-pop,#FFF); box-shadow:var(--nx-pill-ring,#1616151F) 0 0 3px; white-space:nowrap; }
        .nx-asset-chain-name { overflow:hidden; text-overflow:ellipsis; font-size:14px; font-weight:500; }
        .nx-asset-chain-icons { display:flex; flex-shrink:0; }
        .nx-asset-menu { position:absolute; z-index:5; top:46px; right:0; padding:6px; min-width:190px; max-height:280px; overflow-y:auto; border-radius:16px; background:var(--nx-pop,#FFF); box-shadow:#16161514 0 8px 28px, var(--nx-pop-ring,#1616150A) 0 0 0 1px; }
        .nx-asset-menu button { display:flex; align-items:center; gap:10px; width:100%; padding:8px 10px; border-radius:10px; background:transparent; text-align:left; font-size:14px; color:var(--nx-ink,#161615); transition:background-color 120ms; }
        .nx-asset-menu button:hover, .nx-asset-menu button:focus-visible { background:var(--nx-fill,#F3F3F3); }
        .nx-asset-menu-radio { display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-left:auto; }
        .nx-asset-list { flex:1; min-height:0; overflow:auto; padding:0 8px 12px; overscroll-behavior:contain; }
        .nx-asset-row { display:flex; align-items:center; gap:12px; width:100%; min-height:68px; padding:14px 12px; border-radius:18px; background:transparent; text-align:left; }
        .nx-asset-primary { font-size:16px; line-height:20px; font-weight:500; overflow-wrap:anywhere; }
        .nx-asset-secondary { color:var(--nx-mute,#737372); font-size:14px; line-height:18px; }
        @container (max-width:380px) {
          .nx-asset-controls { padding-left:12px; padding-right:12px; }
          .nx-asset-search { gap:6px; padding:10px; }
          .nx-asset-search input { font-size:12px; }
          .nx-asset-chain { padding:0 8px; gap:5px; max-width:130px; }
          .nx-asset-chain-icons > span:not(:first-child) { display:none; }
          .nx-asset-chain-name { font-size:12px; }
          .nx-asset-row { gap:8px; padding-left:4px; padding-right:4px; }
          .nx-asset-primary { font-size:14px; }
          .nx-asset-secondary { font-size:12px; }
        }
      `}</style>
      <div className="nx-asset-controls" aria-busy={isBalanceLoading} inert={isBalanceLoading}>
        <label className="nx-asset-search">
          <Search aria-hidden size={16} style={{ flexShrink: 0, color: "var(--nx-mute,#737372)" }} />
          <input disabled={isBalanceLoading} aria-label="Search token or chain" placeholder="Search token or chain" value={query}
            onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div ref={chainControlRef} style={{ position: "relative", flexShrink: 0 }}>
          <button disabled={isBalanceLoading} className="nx-asset-chain" ref={chainButtonRef} type="button" aria-expanded={chainMenuOpen}
            aria-label={selectedChain?.name ?? "All Chains"}
            onClick={() => setChainMenuOpen((open) => !open)}>
            <span className="nx-asset-chain-icons">
              {(selectedChain ? [selectedChain] : chains.slice(0, 3)).map((chain, index) => (
                <span key={chain.id} style={{ borderRadius: 999, marginLeft: index ? -6 : 0, outline: "1.5px solid var(--nx-fill,#F3F3F3)" }}>
                  <TokenLogo label={chain.name} src={chain.logo} size={18} />
                </span>
              ))}
            </span>
            <span className="nx-asset-chain-name">{selectedChain?.name ?? "All Chains"}</span>
            <ChevronDown aria-hidden size={14} style={{ flexShrink: 0, color: "var(--nx-mute,#737372)" }} />
          </button>
          {chainMenuOpen && <div className="nx-asset-menu" role="radiogroup" aria-label="Filter by chain">
            {[{ id: "all" as const, name: "All Chains", logo: undefined }, ...chains].map((chain) => {
              const isSelected = chainId === chain.id;
              return (
                <button
                  key={chain.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-pressed={isSelected}
                  style={{ fontWeight: isSelected ? 500 : 400 }}
                  onClick={() => {
                    setChainId(chain.id);
                    setChainMenuOpen(false);
                    chainButtonRef.current?.focus();
                  }}
                >
                  {chain.id === "all" ? (
                    <span className="nx-asset-chain-icons" style={{ flexShrink: 0 }}>
                      {chains.slice(0, 3).map((c, i) => (
                        <span
                          key={c.id}
                          style={{
                            borderRadius: 999,
                            marginLeft: i ? -6 : 0,
                            outline: "1.5px solid var(--nx-pop, #FFF)",
                          }}
                        >
                          <TokenLogo label={c.name} src={c.logo} size={18} />
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span style={{ display: "flex", flexShrink: 0 }}>
                      <TokenLogo label={chain.name} src={chain.logo} size={18} />
                    </span>
                  )}
                  {chain.name}
                  <span className="nx-asset-menu-radio">
                    {isSelected ? (
                      <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
                        <circle cx="8" cy="8" fill="var(--nx-pop, #FFF)" r="7" stroke="var(--nx-blue, #006BF4)" strokeWidth="2" />
                        <circle cx="8" cy="8" fill="var(--nx-blue, #006BF4)" r="3.5" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
                        <circle cx="8" cy="8" fill="none" r="7" stroke="var(--nx-ring, #CFCFCD)" strokeWidth="1.5" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>}
        </div>
      </div>
      <div className="nx-asset-list" aria-busy={isBalanceLoading}>
        {isBalanceLoading ? Array.from({ length: 5 }, (_, index) => (
          <div className="nx-skel-row" key={index}>
            <span className="nx-shim" style={{ borderRadius: 999, height: 40, width: 40 }} />
            <span className="nx-shim" style={{ height: 30, width: 70 }} />
            <span className="nx-shim" style={{ height: 30, width: 90, marginLeft: "auto" }} />
          </div>
        )) : visibleTokens.length === 0 ? (
          <div role="status" className="nx-asset-secondary" style={{ padding: "28px 12px", textAlign: "center" }}>
            {query.trim() || chainId !== "all" ? "No tokens match your search" : selectedTokens.length ? "No more tokens available" : "No tokens in this wallet"}
          </div>
        ) : visibleTokens.map((token, index) => (
          <button className="nx-asset-row" key={sourceKey(token)} type="button" onClick={() => onSelect(token)}
            aria-pressed={editingToken ? sourceKey(token) === sourceKey(editingToken) : undefined}
            style={{ animationDelay: `${Math.min(index, 6) * 24}ms`, ...(editingToken && sourceKey(token) === sourceKey(editingToken) ? { background: "var(--nx-fill, #F3F3F3)" } : {}) }}>
            <LogoPair token={token} />
            <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span className="nx-asset-primary">{token.symbol}</span>
              <span className="nx-asset-secondary">{token.chainName}</span>
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, minWidth: 0, maxWidth: "50%" }}>
              <span className="nx-asset-primary">{parseAmount(token.balance)?.toDecimalPlaces(Math.min(8, token.decimals), Decimal.ROUND_DOWN).toFixed() ?? "0"} {token.symbol}</span>
              <span className="nx-asset-secondary">{formatUsd(token.balanceInFiat)}</span>
            </span>
            {editingToken && sourceKey(token) === sourceKey(editingToken) ? (
              <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 20, height: 20, flexShrink: 0, borderRadius: 999, background: "var(--nx-blue,#006BF4)", color: "#fff" }}><Check size={12} /></span>
            ) : <ChevronRight aria-hidden size={16} style={{ flexShrink: 0, color: "var(--nx-faint,#A3A3A2)" }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatUsd(value: string) {
  const amount = parseAmount(value) ?? new Decimal(0);
  return amount.gt(0) && amount.lt(0.01) ? "<$0.01" : `$${amount.toFixed(2)}`;
}
