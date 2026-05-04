"use client";

import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
  startTransition,
  useDeferredValue,
} from "react";
import { ChevronDownIcon } from "./icons";
import WidgetHeader from "./widget-header";
import type { DepositWidgetContextValue, Token, ChainItem } from "../types";
import { Tabs, TabsList, TabsTrigger } from "../../ui/tabs";
import { CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import TokenRow from "./token-row";
import { formatTokenBalance, type UserAsset } from "@avail-project/nexus-core";
import { usdFormatter } from "../../common";
import { X } from "lucide-react";
import {
  SCROLL_THRESHOLD_PX,
  PROGRESS_BAR_ANIMATION_DELAY_MS,
  PROGRESS_BAR_EXIT_DURATION_MS,
  MIN_SELECTABLE_SOURCE_BALANCE_USD,
} from "../constants/widget";
import {
  buildSortedFromSources,
  checkIfMatchesPreset,
  isNative,
  isStablecoin,
} from "../utils";

interface AssetSelectionContainerProps {
  widget: DepositWidgetContextValue;
  heading?: string;
  onClose?: () => void;
}

interface TokenWithMeta extends Token {
  totalUsdValue: number;
  priorityRank: number;
  group: "selectable" | "below-minimum";
}

type ChainItemWithTokenMeta = ChainItem & {
  symbol: string;
  decimals: number;
  tokenLogo: string;
};



function parseNonNegativeNumber(value: unknown): number {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

type OptionalIconMeta = {
  icon?: string;
  logo?: string;
  tokenData?: { icon?: string };
};

function getBreakdownTokenMeta(
  breakdown: UserAsset["breakdown"][number],
  asset: UserAsset,
) {
  const breakdownMeta = breakdown as unknown as OptionalIconMeta;
  const assetMeta = asset as unknown as OptionalIconMeta;
  
  const breakdownIcon = breakdownMeta.icon || breakdownMeta.logo;
  const assetIcon = assetMeta.icon || assetMeta.logo || assetMeta.tokenData?.icon;
  
  return {
    symbol: breakdown.symbol,
    decimals: breakdown.decimals ?? asset.decimals,
    logo: breakdownIcon || assetIcon || "",
  };
}

function transformSwapBalanceToTokens(
  swapBalance: UserAsset[] | null,
  destination: Pick<
    DepositWidgetContextValue["destination"],
    "chainId" | "tokenAddress" | "tokenSymbol"
  >,
): {
  selectableTokens: TokenWithMeta[];
  belowMinimumTokens: TokenWithMeta[];
} {
  if (!swapBalance) {
    return {
      selectableTokens: [],
      belowMinimumTokens: [],
    };
  }

  const allSourceIds = new Set<string>();
  swapBalance.forEach((asset) => {
    asset.breakdown?.forEach((breakdown) => {
      if (!breakdown.chain?.id || !breakdown.contractAddress) return;
      allSourceIds.add(`${breakdown.contractAddress}-${breakdown.chain.id}`);
    });
  });

  const orderedSources = buildSortedFromSources({
    sourceIds: allSourceIds,
    swapBalance,
    destination,
  });

  const sourceOrderIndex = new Map<string, number>();
  orderedSources.forEach((source, index) => {
    sourceOrderIndex.set(
      `${source.tokenAddress.toLowerCase()}-${source.chainId}`,
      index,
    );
  });

  const getSourceOrder = (tokenAddress: string, chainId: number) =>
    sourceOrderIndex.get(`${tokenAddress.toLowerCase()}-${chainId}`) ??
    Number.MAX_SAFE_INTEGER;

  const buildTokenEntry = (
    tokenMeta: { symbol: string; decimals: number; logo: string },
    chains: ChainItemWithTokenMeta[],
    group: "selectable" | "below-minimum",
  ): TokenWithMeta | null => {
    if (chains.length === 0) return null;

    const totalUsdValue = chains.reduce((sum, c) => sum + c.usdValue, 0);
    const totalAmount = chains.reduce((sum, c) => sum + c.amount, 0);
    const category = isStablecoin(tokenMeta.symbol)
      ? "stablecoin"
      : isNative(tokenMeta.symbol)
        ? "native"
        : "memecoin";

    return {
      id: `${tokenMeta.symbol}-${chains[0].tokenAddress}-${group}`,
      symbol: tokenMeta.symbol,
      chainsLabel:
        chains.length > 1
          ? `${chains.length} Chain${chains.length !== 1 ? "s" : ""}`
          : chains[0].name,
      usdValue: usdFormatter.format(totalUsdValue),
      amount: formatTokenBalance(totalAmount, {
        decimals: tokenMeta.decimals,
        symbol: tokenMeta.symbol,
      }),
      decimals: tokenMeta.decimals,
      logo: tokenMeta.logo,
      category,
      priorityRank: chains.length
        ? getSourceOrder(chains[0].tokenAddress, chains[0].chainId)
        : Number.MAX_SAFE_INTEGER,
      totalUsdValue,
      group,
      chains,
    };
  };

  const selectableTokens: TokenWithMeta[] = [];
  const belowMinimumTokens: TokenWithMeta[] = [];

  for (const asset of swapBalance) {
    if (!asset.breakdown?.length) continue;
    const chainsBySymbol = new Map<string, ChainItemWithTokenMeta[]>();

    asset.breakdown
      .filter((b) => b.chain && b.balance)
      .forEach((b) => {
        const balanceNum = parseFloat(b.balance);
        if (!Number.isFinite(balanceNum) || balanceNum <= 0) return;

        const usdValue = parseNonNegativeNumber(b.balanceInFiat);
        const tokenMeta = getBreakdownTokenMeta(b, asset);
        const existing = chainsBySymbol.get(tokenMeta.symbol) ?? [];
        existing.push({
          id: `${b.contractAddress}-${b.chain.id}`,
          tokenAddress: b.contractAddress as `0x${string}`,
          chainId: b.chain.id,
          name: b.chain.name,
          usdValue,
          amount: balanceNum,
          symbol: tokenMeta.symbol,
          decimals: tokenMeta.decimals,
          tokenLogo: tokenMeta.logo,
        });
        chainsBySymbol.set(tokenMeta.symbol, existing);
      });

    for (const chainsForToken of chainsBySymbol.values()) {
      const sortedChains = chainsForToken.sort((a, b) => {
        const orderDiff =
          getSourceOrder(a.tokenAddress, a.chainId) -
          getSourceOrder(b.tokenAddress, b.chainId);
        if (orderDiff !== 0) return orderDiff;
        return b.usdValue - a.usdValue;
      });

      const selectableChains = sortedChains.filter(
        (chain) => chain.usdValue >= MIN_SELECTABLE_SOURCE_BALANCE_USD,
      );
      const belowMinimumChains = sortedChains.filter(
        (chain) => chain.usdValue < MIN_SELECTABLE_SOURCE_BALANCE_USD,
      );

      const tokenMeta = {
        symbol: sortedChains[0].symbol,
        decimals: sortedChains[0].decimals,
        logo: sortedChains[0].tokenLogo,
      };

      const selectableEntry = buildTokenEntry(
        tokenMeta,
        selectableChains,
        "selectable",
      );
      if (selectableEntry) selectableTokens.push(selectableEntry);

      const belowMinimumEntry = buildTokenEntry(
        tokenMeta,
        belowMinimumChains,
        "below-minimum",
      );
      if (belowMinimumEntry) belowMinimumTokens.push(belowMinimumEntry);
    }
  }

  const sortTokenEntries = (a: TokenWithMeta, b: TokenWithMeta) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    return b.totalUsdValue - a.totalUsdValue;
  };

  return {
    selectableTokens: selectableTokens.sort(sortTokenEntries),
    belowMinimumTokens: belowMinimumTokens.sort(sortTokenEntries),
  };
}

const AssetSelectionContainer = ({
  widget,
  heading,
  onClose,
}: AssetSelectionContainerProps) => {
  const { assetSelection, setAssetSelection, swapBalance } = widget;

  const [isProgressBarVisible, setIsProgressBarVisible] = useState(false);
  const [isProgressBarEntering, setIsProgressBarEntering] = useState(false);
  const [isProgressBarExiting, setIsProgressBarExiting] = useState(false);
  const [showStickyPopular, setShowStickyPopular] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const popularSectionRef = useRef<HTMLDivElement>(null);

  const selectedChainIds = assetSelection.selectedChainIds;
  const filter = assetSelection.filter;
  const expandedTokens = assetSelection.expandedTokens;
  const destinationForSorting = useMemo(
    () => ({
      chainId: widget.destination.chainId,
      tokenAddress: widget.destination.tokenAddress,
      tokenSymbol: widget.destination.tokenSymbol,
    }),
    [
      widget.destination.chainId,
      widget.destination.tokenAddress,
      widget.destination.tokenSymbol,
    ],
  );

  // Defer expensive token transformation to avoid blocking UI
  const deferredSwapBalance = useDeferredValue(swapBalance);

  const {
    selectableTokens: selectableTokenEntries,
    belowMinimumTokens: belowMinimumTokenEntries,
  } = useMemo(
    () =>
      transformSwapBalanceToTokens(deferredSwapBalance, destinationForSorting),
    [deferredSwapBalance, destinationForSorting],
  );

  const allDisplayTokens = useMemo(
    () => [...selectableTokenEntries, ...belowMinimumTokenEntries],
    [selectableTokenEntries, belowMinimumTokenEntries],
  );

  const disabledChainIds = useMemo<Set<string>>(() => {
    const disabled = new Set<string>();
    belowMinimumTokenEntries.forEach((token) => {
      token.chains.forEach((chain) => {
        disabled.add(chain.id);
      });
    });
    return disabled;
  }, [belowMinimumTokenEntries]);

  const selectableChainIds = useMemo(() => {
    const selectable = new Set<string>();
    selectableTokenEntries.forEach((token) => {
      token.chains.forEach((chain) => {
        if (!disabledChainIds.has(chain.id)) {
          selectable.add(chain.id);
        }
      });
    });
    return selectable;
  }, [selectableTokenEntries, disabledChainIds]);

  const selectableTokensForPreset = useMemo(
    () =>
      selectableTokenEntries.map((token) => ({
        ...token,
        chains: token.chains.filter((chain) => !disabledChainIds.has(chain.id)),
      })),
    [selectableTokenEntries, disabledChainIds],
  );

  const sortAndGateSelection = useCallback(
    (chainIds: Iterable<string>) => {
      const eligibleSourceIds = [...new Set(chainIds)].filter(
        (id) => !disabledChainIds.has(id),
      );

      return new Set(
        buildSortedFromSources({
          sourceIds: eligibleSourceIds,
          swapBalance,
          destination: destinationForSorting,
        }).map((source) => `${source.tokenAddress}-${source.chainId}`),
      );
    },
    [swapBalance, destinationForSorting, disabledChainIds],
  );

  // Build index Map for O(1) token lookups (js-index-maps)
  const tokensById = useMemo(
    () => new Map(allDisplayTokens.map((t) => [t.id, t])),
    [allDisplayTokens],
  );

  useEffect(() => {
    if (selectedChainIds.size === 0) return;
    const nextSelected = new Set(
      [...selectedChainIds].filter((id) => selectableChainIds.has(id)),
    );
    if (nextSelected.size === selectedChainIds.size) return;

    const nextFilter = checkIfMatchesPreset(
      selectableTokensForPreset,
      nextSelected,
    );

    setAssetSelection({
      selectedChainIds: sortAndGateSelection(nextSelected),
      filter: nextFilter,
    });
  }, [
    selectedChainIds,
    selectableChainIds,
    selectableTokensForPreset,
    setAssetSelection,
    sortAndGateSelection,
    swapBalance,
  ]);

  const selectedAmount = useMemo(() => {
    let total = 0;
    selectableTokenEntries.forEach((token) => {
      token.chains.forEach((chain) => {
        if (selectedChainIds.has(chain.id) && !disabledChainIds.has(chain.id)) {
          total += chain.usdValue;
        }
      });
    });
    return total;
  }, [selectableTokenEntries, selectedChainIds, disabledChainIds]);

  const requiredAmount = widget.inputs.amount
    ? parseFloat(widget.inputs.amount.replace(/,/g, ""))
    : 0;

  const showProgressBar = requiredAmount > 0 && requiredAmount > selectedAmount;
  const progressPercent =
    requiredAmount > 0
      ? Math.min((selectedAmount / requiredAmount) * 100, 100)
      : 0;

  useEffect(() => {
    if (showProgressBar) {
      setIsProgressBarVisible(true);
      setIsProgressBarExiting(false);
      setIsProgressBarEntering(true);
      const timer = setTimeout(() => {
        setIsProgressBarEntering(false);
      }, PROGRESS_BAR_ANIMATION_DELAY_MS);
      return () => clearTimeout(timer);
    } else if (isProgressBarVisible) {
      setIsProgressBarExiting(true);
      const timer = setTimeout(() => {
        setIsProgressBarVisible(false);
        setIsProgressBarExiting(false);
      }, PROGRESS_BAR_EXIT_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [showProgressBar, isProgressBarVisible]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Use startTransition for non-urgent scroll updates (rerender-transitions)
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      startTransition(() => {
        setShowStickyPopular(scrollTop > SCROLL_THRESHOLD_PX);
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToPopular = useCallback(() => {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  const handlePresetClick = useCallback(
    (preset: "all" | "stablecoins" | "native") => {
      if (preset === "all") {
        const nextSelected = sortAndGateSelection(selectableChainIds);
        setAssetSelection({
          selectedChainIds: nextSelected,
          filter: "all",
          expandedTokens: new Set(),
        });
        return;
      }

      const newChainIds = new Set<string>();
      selectableTokenEntries.forEach((token) => {
        const shouldInclude =
          (preset === "stablecoins" && token.category === "stablecoin") ||
          (preset === "native" && token.category === "native");

        if (shouldInclude) {
          token.chains.forEach((chain) => {
            if (!disabledChainIds.has(chain.id)) {
              newChainIds.add(chain.id);
            }
          });
        }
      });
      const nextSelected = sortAndGateSelection(newChainIds);

      setAssetSelection({
        selectedChainIds: nextSelected,
        filter: preset,
      });
    },
    [
      selectableTokenEntries,
      selectableChainIds,
      setAssetSelection,
      disabledChainIds,
      sortAndGateSelection,
      swapBalance,
    ],
  );

  const toggleTokenSelection = useCallback(
    (tokenId: string) => {
      const token = tokensById.get(tokenId); // O(1) lookup instead of O(n)
      if (!token) return;

      const selectableChains = token.chains.filter(
        (chain) => !disabledChainIds.has(chain.id),
      );
      if (selectableChains.length === 0) return;

      const allChainsSelected = selectableChains.every((c) =>
        selectedChainIds.has(c.id),
      );
      const newChainIds = new Set(selectedChainIds);

      if (allChainsSelected) {
        selectableChains.forEach((chain) => newChainIds.delete(chain.id));
      } else {
        selectableChains.forEach((chain) => newChainIds.add(chain.id));
      }

      const newFilter = checkIfMatchesPreset(
        selectableTokensForPreset,
        newChainIds,
      );
      const nextSelected = sortAndGateSelection(newChainIds);

      setAssetSelection({
        selectedChainIds: nextSelected,
        filter: newFilter,
      });
    },
    [
      selectableTokensForPreset,
      tokensById,
      selectedChainIds,
      setAssetSelection,
      disabledChainIds,
      sortAndGateSelection,
      swapBalance,
    ],
  );

  const toggleChainSelection = useCallback(
    (chainId: string) => {
      if (disabledChainIds.has(chainId)) return;

      const newChainIds = new Set(selectedChainIds);
      if (newChainIds.has(chainId)) {
        newChainIds.delete(chainId);
      } else {
        newChainIds.add(chainId);
      }

      const newFilter = checkIfMatchesPreset(
        selectableTokensForPreset,
        newChainIds,
      );
      const nextSelected = sortAndGateSelection(newChainIds);

      setAssetSelection({
        selectedChainIds: nextSelected,
        filter: newFilter,
      });
    },
    [
      disabledChainIds,
      selectableTokensForPreset,
      selectedChainIds,
      setAssetSelection,
      sortAndGateSelection,
      swapBalance,
    ],
  );

  const toggleExpanded = useCallback(
    (tokenId: string) => {
      let newExpanded = new Set(expandedTokens);
      if (tokenId === "below-minimum-section") {
        if (newExpanded.has("below-minimum-section")) {
          newExpanded.delete("below-minimum-section");
        } else {
          newExpanded = new Set(newExpanded);
          newExpanded.add("below-minimum-section");
          setTimeout(() => {
            if (scrollContainerRef.current) {
              const currentScrollTop = scrollContainerRef.current.scrollTop;
              scrollContainerRef.current.scrollTo({
                top: currentScrollTop + 70,
                behavior: "smooth",
              });
            }
          }, 100);
        }
      } else {
        const belowMinimumExpanded = newExpanded.has("below-minimum-section");
        if (newExpanded.has(tokenId)) {
          newExpanded = belowMinimumExpanded
            ? new Set(["below-minimum-section"])
            : new Set();
        } else {
          newExpanded = belowMinimumExpanded
            ? new Set(["below-minimum-section", tokenId])
            : new Set([tokenId]);
        }
      }
      setAssetSelection({ expandedTokens: newExpanded });
    },
    [expandedTokens, setAssetSelection],
  );

  const handleDeselectAll = useCallback(() => {
    setAssetSelection({
      selectedChainIds: new Set(),
      filter: "custom",
    });
  }, [selectedChainIds, setAssetSelection, swapBalance]);

  const handleDone = useCallback(() => {
    widget.goToStep("amount");
  }, [filter, selectedChainIds, swapBalance, widget]);

  return (
    <>
      <WidgetHeader
        title={heading ?? ""}
        onBack={widget.goBack}
        onClose={onClose}
        depositTargetLogo={widget?.destination?.depositTargetLogo}
      />
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Tabs
              value={filter}
              onValueChange={(value) => {
                if (value !== "custom") {
                  handlePresetClick(value as "all" | "stablecoins" | "native");
                }
              }}
            >
              <TabsList>
                <TabsTrigger value="all">Any token</TabsTrigger>
                <TabsTrigger value="stablecoins">Stablecoins</TabsTrigger>
                <TabsTrigger value="native">Native</TabsTrigger>
                {filter === "custom" && (
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                )}
              </TabsList>
            </Tabs>
            <button
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={handleDeselectAll}
            >
              {filter === "custom" ? <X className="size-4" /> : "Deselect all"}
            </button>
          </div>

          <div className="flex flex-col">
            <div className="relative">
              {showStickyPopular && selectableTokenEntries.length > 0 && (
                <button
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer border border-primary/10 px-2 py-1 bg-background"
                  onClick={scrollToPopular}
                >
                  Popular
                </button>
              )}
              <div
                ref={scrollContainerRef}
                className="w-full overflow-y-auto max-h-[300px] scrollbar-hide"
              >
                {selectableTokenEntries.length > 0 && (
                  <div
                    ref={popularSectionRef}
                    className="w-full rounded-lg border overflow-hidden"
                  >
                    <div className="px-5 py-2 bg-muted/30 border-b">
                      <span className="font-sans text-xs font-medium text-muted-foreground">
                        Popular
                      </span>
                    </div>
                    {selectableTokenEntries.map((token, index) => (
                      <TokenRow
                        key={token.id}
                        token={token}
                        disabledChainIds={disabledChainIds}
                        selectedChainIds={selectedChainIds}
                        isExpanded={expandedTokens.has(token.id)}
                        onToggleExpand={() => toggleExpanded(token.id)}
                        onToggleToken={() => toggleTokenSelection(token.id)}
                        onToggleChain={toggleChainSelection}
                        isFirst={false}
                        isLast={index === selectableTokenEntries.length - 1}
                      />
                    ))}
                  </div>
                )}

                {belowMinimumTokenEntries.length > 0 && (
                  <div className="w-full bg-base rounded-t-lg border overflow-hidden mt-4">
                    <div
                      className="p-5 flex justify-between items-center cursor-pointer"
                      onClick={() => toggleExpanded("below-minimum-section")}
                    >
                      <span className="font-sans text-sm text-muted-foreground">
                        Tokens Below Minimum Balance (
                        {belowMinimumTokenEntries.length})
                      </span>
                      <ChevronDownIcon
                        className={`text-muted-foreground transition-transform duration-200 ${
                          expandedTokens.has("below-minimum-section")
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </div>

                    {expandedTokens.has("below-minimum-section") && (
                      <div className="w-full border-t">
                        {disabledChainIds.size > 0 && (
                          <div className="px-5 py-4 border-b bg-muted/20">
                            <span className="font-sans text-[13px] leading-5 text-muted-foreground">
                              Tokens under $
                              {MIN_SELECTABLE_SOURCE_BALANCE_USD.toFixed(0)} are
                              unavailable for deposits to prevent failed
                              transactions
                            </span>
                          </div>
                        )}
                        {belowMinimumTokenEntries.map((token, index) => (
                          <TokenRow
                            key={token.id}
                            token={token}
                            disabledChainIds={disabledChainIds}
                            selectedChainIds={selectedChainIds}
                            isExpanded={expandedTokens.has(token.id)}
                            onToggleExpand={() => toggleExpanded(token.id)}
                            onToggleToken={() => toggleTokenSelection(token.id)}
                            onToggleChain={toggleChainSelection}
                            isFirst={index === 0}
                            isLast={
                              index === belowMinimumTokenEntries.length - 1
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!showProgressBar && (
                <div
                  className="absolute bottom-0 left-px right-px h-12 pointer-events-none dark:hidden"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, var(--background) 100%)",
                  }}
                />
              )}
              {!showProgressBar && (
                <div
                  className="absolute bottom-0 left-px right-px h-12 pointer-events-none hidden dark:block"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, var(--background) 100%)",
                  }}
                />
              )}
            </div>

            <Button className="w-full rounded-t-none" onClick={handleDone}>
              Done
            </Button>
          </div>
        </div>
      </CardContent>

      {isProgressBarVisible && (
        <div
          className={`absolute -bottom-6 left-0 right-0 z-20 flex flex-col gap-2 pt-5 pb-8 px-7 bg-card border-t shadow-[0_-11px_12px_0_rgba(91,91,91,0.05)] transform transition-transform duration-300 ease-out ${
            isProgressBarEntering || isProgressBarExiting
              ? "translate-y-full"
              : "translate-y-0"
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              Selected / Required
            </span>
            <span className="text-sm">
              <span className="font-semibold text-card-foreground">
                ${selectedAmount.toLocaleString()}
              </span>
              <span className="text-muted-foreground">
                {" "}
                / ${requiredAmount.toLocaleString()}
              </span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AssetSelectionContainer;
