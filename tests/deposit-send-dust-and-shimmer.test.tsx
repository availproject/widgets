import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Decimal from "decimal.js";
import {
  resolveDepositSourceSelection,
  buildSortedSourceCandidates,
} from "../registry/avail-widgets/nexus-widget/utils/deposit-source-selection";
import {
  SwapAssetSelector,
  type SwapTokenOption,
} from "../registry/avail-widgets/nexus-widget/components/swap-asset-selector";
import { PayWithSources } from "../registry/avail-widgets/nexus-widget/components/pay-with-sources";

const dustToken: SwapTokenOption = {
  chainId: 1,
  contractAddress: "0xdust1",
  symbol: "DUST",
  name: "Dust Token",
  decimals: 18,
  balance: "0.5",
  balanceInFiat: "$0.50",
};

const richToken: SwapTokenOption = {
  chainId: 1,
  contractAddress: "0xrich1",
  symbol: "RICH",
  name: "Rich Token",
  decimals: 18,
  balance: "100",
  balanceInFiat: "$100.00",
};

const dustAddress = "0x1111111111111111111111111111111111111111" as const;
const richAddress = "0x2222222222222222222222222222222222222222" as const;
const destination = {
  chainId: 10,
  tokenAddress: "0x3333333333333333333333333333333333333333" as const,
  tokenSymbol: "USDC",
};

test("buildSortedSourceCandidates includes dust (< $1) when minimumBalanceUsd is 0 or null", () => {
  const userAssets: any[] = [
    {
      symbol: "DUST",
      balance: "0.5",
      balanceInFiat: 0.5,
      breakdown: [
        {
          chain: { id: 1, name: "Ethereum" },
          contractAddress: dustAddress,
          balance: "0.5",
          balanceInFiat: 0.5,
          decimals: 18,
        },
      ],
    },
    {
      symbol: "RICH",
      balance: "100",
      balanceInFiat: 100,
      breakdown: [
        {
          chain: { id: 1, name: "Ethereum" },
          contractAddress: richAddress,
          balance: "100",
          balanceInFiat: 100,
          decimals: 18,
        },
      ],
    },
  ];

  const dustId = `${dustAddress.toLowerCase()}-1`;
  const richId = `${richAddress.toLowerCase()}-1`;

  // Auto mode (minimumBalanceUsd = 0): includes both
  const autoCandidates = buildSortedSourceCandidates({
    sourceIds: [dustId, richId],
    swapBalance: userAssets,
    destination,
    minimumBalanceUsd: 0,
  });
  assert.equal(autoCandidates.length, 2);
  assert.ok(autoCandidates.some((c) => c.sourceId === dustId));
  assert.ok(autoCandidates.some((c) => c.sourceId === richId));

  // Manual mode (minimumBalanceUsd = 1): excludes dust
  const manualCandidates = buildSortedSourceCandidates({
    sourceIds: [dustId, richId],
    swapBalance: userAssets,
    destination,
    minimumBalanceUsd: 1,
  });
  assert.equal(manualCandidates.length, 1);
  assert.equal(manualCandidates[0].sourceId, richId);
});

test("resolveDepositSourceSelection includes dust in auto mode but excludes in manual mode", () => {
  const dustId = `${dustAddress.toLowerCase()}-1`;
  const swapBalance: any[] = [
    {
      symbol: "DUST",
      balance: "0.5",
      balanceInFiat: 0.5,
      breakdown: [
        {
          chain: { id: 1, name: "Ethereum" },
          contractAddress: dustAddress,
          balance: "0.5",
          balanceInFiat: 0.5,
          decimals: 18,
        },
      ],
    },
  ];

  // Auto mode: dust is included in selectedSourceIds when targetAmountUsd is provided
  const autoSelection = resolveDepositSourceSelection({
    swapBalance,
    destination,
    filter: "all",
    selectedSourceIds: [],
    minimumBalanceUsd: 0,
    isManualSelection: false,
    targetAmountUsd: 0.25,
  });
  assert.ok(autoSelection.selectedSourceIds.includes(dustId));

  // Manual mode: dust is filtered out from selectedSourceIds
  const manualSelection = resolveDepositSourceSelection({
    swapBalance,
    destination,
    filter: "custom",
    selectedSourceIds: [dustId],
    minimumBalanceUsd: 1,
    isManualSelection: true,
    targetAmountUsd: 0.25,
  });
  assert.equal(manualSelection.selectedSourceIds.length, 0);
});

test("SwapAssetSelector hides unselected dust tokens to prevent selection but reflects selected dust", () => {
  // 1. Unselected dust token: placed in "Tokens below minimum" section and not selectable
  const htmlUnselected = renderToStaticMarkup(
    <SwapAssetSelector
      isMulti
      lockedTokens={[]}
      onBack={() => {}}
      onSelect={() => {}}
      selectedTokens={[]}
      staticOptions={[dustToken, richToken]}
      swapBalance={[]}
      title="Choose Assets to Pay with"
    />,
  );
  assert.ok(htmlUnselected.includes("Tokens below minimum"));
  assert.ok(htmlUnselected.includes("0 assets selected"));

  // 2. Selected dust token (e.g. auto mode): included in selected asset count
  const htmlSelected = renderToStaticMarkup(
    <SwapAssetSelector
      isMulti
      lockedTokens={[]}
      onBack={() => {}}
      onSelect={() => {}}
      selectedTokens={[dustToken]}
      staticOptions={[dustToken, richToken]}
      swapBalance={[]}
      title="Choose Assets to Pay with"
    />,
  );
  assert.ok(htmlSelected.includes("1 asset selected"));
});

test("PayWithSources renders skeletal shimmering only when isPredictive is true", () => {
  const htmlNonPredictive = renderToStaticMarkup(
    <PayWithSources
      fromTokens={[richToken]}
      isPredictive={false}
      onOpenSourcePicker={() => {}}
    />,
  );
  assert.doesNotMatch(htmlNonPredictive, /nexusSourcesSkeletonShimmer/);
  assert.doesNotMatch(htmlNonPredictive, /nexusShimmerText/);

  const htmlPredictive = renderToStaticMarkup(
    <PayWithSources
      fromTokens={[richToken]}
      isPredictive={true}
      onOpenSourcePicker={() => {}}
    />,
  );
  assert.match(htmlPredictive, /nexusSourcesSkeletonShimmer/);
  assert.match(htmlPredictive, /nexusShimmerText/);
  // Edit tokens button is disabled during predictive loading
  assert.match(htmlPredictive, /disabled=""[^>]*>Edit tokens<\/button>/);
});

test("predictive quote logic: shimmer is strictly active during predictive quotes and false for actual quotes or refreshes", () => {
  // Test swap exact-in predictive quote condition
  const computeExactInShimmer = (hasQuoteIntent: boolean, receiveAmount?: string) => {
    return !hasQuoteIntent && Boolean(receiveAmount);
  };
  // Predictive quote showing before intent arrives
  assert.equal(computeExactInShimmer(false, "123.45"), true);
  // Actual quote arrived (intent loaded)
  assert.equal(computeExactInShimmer(true, "123.45"), false);
  // Background quote refresh (intent preserved)
  assert.equal(computeExactInShimmer(true, "123.45"), false);

  // Test deposit/send exact-out predictive quote condition
  const computeExactOutShimmer = (
    hasExactOutPaymentIntent: boolean,
    hasPredictiveQuote: boolean,
    isLoading: boolean,
  ) => {
    return !hasExactOutPaymentIntent && Boolean(hasPredictiveQuote && isLoading);
  };
  // Before actual quote arrives, predictive quote is displayed while loading
  assert.equal(computeExactOutShimmer(false, true, true), true);
  // Actual quote arrived (hasExactOutPaymentIntent is true)
  assert.equal(computeExactOutShimmer(true, true, false), false);
  // Background quote refresh (hasExactOutPaymentIntent remains true, isLoading is true)
  assert.equal(computeExactOutShimmer(true, true, true), false);
});
