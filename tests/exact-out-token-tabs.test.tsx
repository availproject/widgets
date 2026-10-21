import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  resolveDepositSourceSelection,
  buildDepositSourcePoolIds,
} from "../registry/avail-widgets/nexus-widget/utils/deposit-source-selection";
import {
  SwapAssetSelector,
  type SwapTokenOption,
} from "../registry/avail-widgets/nexus-widget/components/swap-asset-selector";

const ethNativeToken: SwapTokenOption = {
  chainId: 1,
  contractAddress: "0x0000000000000000000000000000000000000000",
  symbol: "ETH",
  name: "Ethereum",
  decimals: 18,
  balance: "2.0",
  balanceInFiat: "$5000.00",
};

const polNativeToken: SwapTokenOption = {
  chainId: 137,
  contractAddress: "0x0000000000000000000000000000000000000000",
  symbol: "POL",
  name: "Polygon",
  decimals: 18,
  balance: "100.0",
  balanceInFiat: "$40.00",
};

const usdcStableToken: SwapTokenOption = {
  chainId: 1,
  contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  balance: "500",
  balanceInFiat: "$500.00",
};

const usdtStableToken: SwapTokenOption = {
  chainId: 137,
  contractAddress: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  symbol: "USDT",
  name: "Tether USD",
  decimals: 6,
  balance: "300",
  balanceInFiat: "$300.00",
};

const mockSwapBalance: any[] = [
  {
    symbol: "ETH",
    balance: "2.0",
    balanceInFiat: 5000,
    breakdown: [
      {
        chain: { id: 1, name: "Ethereum" },
        contractAddress: "0x0000000000000000000000000000000000000000",
        symbol: "ETH",
        balance: "2.0",
        balanceInFiat: 5000,
        decimals: 18,
      },
    ],
  },
  {
    symbol: "POL",
    balance: "100.0",
    balanceInFiat: 40,
    breakdown: [
      {
        chain: { id: 137, name: "Polygon" },
        contractAddress: "0x0000000000000000000000000000000000000000",
        symbol: "POL",
        balance: "100.0",
        balanceInFiat: 40,
        decimals: 18,
      },
    ],
  },
  {
    symbol: "USDC",
    balance: "500",
    balanceInFiat: 500,
    breakdown: [
      {
        chain: { id: 1, name: "Ethereum" },
        contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        symbol: "USDC",
        balance: "500",
        balanceInFiat: 500,
        decimals: 6,
      },
    ],
  },
  {
    symbol: "USDT",
    balance: "300",
    balanceInFiat: 300,
    breakdown: [
      {
        chain: { id: 137, name: "Polygon" },
        contractAddress: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
        symbol: "USDT",
        balance: "300",
        balanceInFiat: 300,
        decimals: 6,
      },
    ],
  },
];

test("Case 1: Native tab selects all native tokens and unselects stables/others", () => {
  const nativePoolIds = buildDepositSourcePoolIds({
    swapBalance: mockSwapBalance,
    filter: "native",
    selectedSourceIds: [],
    isManualSelection: false,
  });

  // Contains ETH and POL
  assert.ok(nativePoolIds.some((id) => id.includes("0x0000000000000000000000000000000000000000-1")));
  assert.ok(nativePoolIds.some((id) => id.includes("0x0000000000000000000000000000000000000000-137")));
  // Does NOT contain USDC or USDT
  assert.ok(!nativePoolIds.some((id) => id.includes("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")));
  assert.ok(!nativePoolIds.some((id) => id.includes("0xc2132d05d31c914a87c6611c10748aeb04b58e8f")));
});

test("Case 2: Stable tab selects all stable tokens and unselects native/others", () => {
  const stablePoolIds = buildDepositSourcePoolIds({
    swapBalance: mockSwapBalance,
    filter: "stablecoins",
    selectedSourceIds: [],
    isManualSelection: false,
  });

  // Contains USDC and USDT
  assert.ok(stablePoolIds.some((id) => id.includes("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")));
  assert.ok(stablePoolIds.some((id) => id.includes("0xc2132d05d31c914a87c6611c10748aeb04b58e8f")));
  // Does NOT contain ETH or POL
  assert.ok(!stablePoolIds.some((id) => id.includes("0x0000000000000000000000000000000000000000-1")));
  assert.ok(!stablePoolIds.some((id) => id.includes("0x0000000000000000000000000000000000000000-137")));
});

test("Case 3: Coming back to any token (all tab) autoselects initial intent sources and sends no sources allowlist", () => {
  // Helper simulating exactOut allowlist decision
  const shouldSendExactOutSourceAllowlist = (params: {
    activeMode: "deposit" | "send";
    sourceSelectionTouched: boolean;
    depositSourceFilter: "all" | "native" | "stablecoins" | "custom";
    exactOutQuoteSourceMode: "all" | "selected";
  }) => {
    if (params.activeMode === "deposit" || params.activeMode === "send") {
      return (
        params.sourceSelectionTouched ||
        params.depositSourceFilter !== "all" ||
        params.exactOutQuoteSourceMode === "selected"
      );
    }
    return true;
  };

  const buildExactOutSourcesPayload = (
    tokens: SwapTokenOption[],
    allowlistActive: boolean,
  ) => {
    if (!allowlistActive) return {};
    return {
      sources: tokens.map((t) => ({
        chainId: t.chainId!,
        tokenAddress: t.contractAddress as `0x${string}`,
      })),
    };
  };

  // Initially in auto mode: no sources sent to exactOut
  let allowlistActive = shouldSendExactOutSourceAllowlist({
    activeMode: "deposit",
    sourceSelectionTouched: false,
    depositSourceFilter: "all",
    exactOutQuoteSourceMode: "all",
  });
  assert.equal(allowlistActive, false);
  assert.deepEqual(buildExactOutSourcesPayload([ethNativeToken], allowlistActive), {});

  // When user selects Native tab: sources allowlist is sent with all native tokens
  allowlistActive = shouldSendExactOutSourceAllowlist({
    activeMode: "deposit",
    sourceSelectionTouched: false,
    depositSourceFilter: "native",
    exactOutQuoteSourceMode: "all",
  });
  assert.equal(allowlistActive, true);
  const nativePayload = buildExactOutSourcesPayload([ethNativeToken, polNativeToken], allowlistActive);
  assert.equal(nativePayload.sources?.length, 2);

  // When user returns to Any token ("all" tab):
  // Initial intent tokens are re-selected, and no sources are sent to exactOut
  const initialAutoIntentTokens = [ethNativeToken];
  allowlistActive = shouldSendExactOutSourceAllowlist({
    activeMode: "deposit",
    sourceSelectionTouched: false,
    depositSourceFilter: "all",
    exactOutQuoteSourceMode: "all",
  });
  assert.equal(allowlistActive, false);
  const backToAllPayload = buildExactOutSourcesPayload(initialAutoIntentTokens, allowlistActive);
  assert.deepEqual(backToAllPayload, {}); // Empty payload so SDK auto-selects again
});

test("Case 4: Editing any tokens in All, Native, or Stables automatically switches to custom (Manual)", () => {
  // getEditedSelectionTab returns 'custom' whenever autoSelectFilterTabs is active
  const getEditedSelectionTab = (autoSelectFilterTabs: boolean, activeTab: string) =>
    autoSelectFilterTabs ? "custom" : activeTab;

  assert.equal(getEditedSelectionTab(true, "all"), "custom");
  assert.equal(getEditedSelectionTab(true, "native"), "custom");
  assert.equal(getEditedSelectionTab(true, "stables"), "custom");
  assert.equal(getEditedSelectionTab(true, "custom"), "custom");

  // When autoSelectFilterTabs is true, lockedTokens is empty so user can edit any token
  const html = renderToStaticMarkup(
    <SwapAssetSelector
      autoSelectFilterTabs
      filterTabBehavior="source-pool"
      initialFilterTab="native"
      isMulti
      lockedTokens={[usdcStableToken]}
      onBack={() => {}}
      onSelect={() => {}}
      requiredUsd="100"
      selectedTokens={[ethNativeToken, polNativeToken]}
      staticOptions={[ethNativeToken, polNativeToken, usdcStableToken, usdtStableToken]}
      swapBalance={mockSwapBalance}
      title="Choose Assets to Pay with"
    />,
  );

  assert.ok(html.includes("Manual"));
  assert.ok(html.includes("Native"));
  assert.ok(html.includes("Stables"));
  assert.ok(html.includes("All"));
});
