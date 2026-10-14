import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeIntentBalances } from "../registry/avail-widgets/nexus/better-intent-compat";
import {
  UnverifiedBadge,
  getSwapTokenSortTier,
  type SwapTokenOption,
} from "../registry/avail-widgets/nexus-widget/components/swap-asset-selector";
import { sortSourcesByPriority } from "../registry/avail-widgets/nexus-widget/utils/deposit-source-selection";

test("normalizeIntentBalances correctly captures verified status and handles EVM_ chain ids", () => {
  const sampleBalances = [
    {
      universe: "EVM",
      chainId: "EVM_8453",
      address: "0x7dbb044907a185cc37dfd38659d5c1e21f76624c",
      name: "Netflix Tokenized bStocks",
      symbol: "NFLXB",
      decimals: 9,
      isNative: false,
      verified: false,
      balance: "9000000000",
      usableBalance: "9000000000",
      valueUsd: 55.84,
      usable: true,
      providers: [{ id: "relay" }],
    },
    {
      universe: "EVM",
      chainId: "EVM_999",
      address: "0x0000000000000000000000000000000000000000",
      name: "Hyperliquid",
      symbol: "HYPE",
      decimals: 18,
      isNative: true,
      verified: true,
      balance: "200067691390590399",
      usableBalance: "200067691390590399",
      valueUsd: 16.36,
      usable: true,
      providers: [{ id: "nexus-v2" }],
    },
  ];

  const normalized = normalizeIntentBalances(sampleBalances as any, [] as any);
  assert.equal(normalized.length, 2);

  const nflxb = normalized.find((t) => t.symbol === "NFLXB");
  assert.ok(nflxb);
  assert.equal(nflxb.verified, false);
  assert.equal(nflxb.chainBalances[0].verified, false);
  assert.equal(nflxb.chainBalances[0].chain.id, 8453);

  const hype = normalized.find((t) => t.symbol === "HYPE");
  assert.ok(hype);
  assert.equal(hype.verified, true);
  assert.equal(hype.chainBalances[0].verified, true);
  assert.equal(hype.chainBalances[0].chain.id, 999);
});

test("sorting ranks verified tokens on top in descending USD order, then unverified in descending USD order, then zero/no balance", () => {
  const tokens: SwapTokenOption[] = [
    {
      contractAddress: "0x0001",
      symbol: "ZERO_UNVERIFIED",
      name: "Zero Unverified",
      balance: "0",
      balanceInFiat: "$0.00",
      decimals: 18,
      verified: false,
    },
    {
      contractAddress: "0x0002",
      symbol: "UNVERIFIED_HIGH",
      name: "Netflix Tokenized bStocks",
      balance: "9",
      balanceInFiat: "$55.84",
      decimals: 9,
      verified: false,
    },
    {
      contractAddress: "0x0003",
      symbol: "VERIFIED_LOW",
      name: "USDC",
      balance: "5",
      balanceInFiat: "$5.00",
      decimals: 6,
      verified: true,
    },
    {
      contractAddress: "0x0004",
      symbol: "VERIFIED_HIGH",
      name: "Hyperliquid",
      balance: "0.2",
      balanceInFiat: "$16.36",
      decimals: 18,
      verified: true,
    },
    {
      contractAddress: "0x0005",
      symbol: "ZERO_VERIFIED",
      name: "Zero Verified",
      balance: "0",
      balanceInFiat: "$0.00",
      decimals: 18,
      verified: true,
    },
    {
      contractAddress: "0x0006",
      symbol: "UNVERIFIED_LOW",
      name: "JMDT",
      balance: "9",
      balanceInFiat: "$5.68",
      decimals: 9,
      verified: false,
    },
  ];

  const sorted = [...tokens].sort((a, b) => {
    const aTier = getSwapTokenSortTier(a);
    const bTier = getSwapTokenSortTier(b);
    if (aTier !== bTier) return aTier - bTier;

    const aFiat = Number.parseFloat(a.balanceInFiat.replace("$", ""));
    const bFiat = Number.parseFloat(b.balanceInFiat.replace("$", ""));
    if (bFiat !== aFiat) return bFiat - aFiat;
    return a.symbol.localeCompare(b.symbol);
  });

  const symbols = sorted.map((t) => t.symbol);
  assert.deepEqual(symbols, [
    "VERIFIED_HIGH", // $16.36 (Verified)
    "VERIFIED_LOW", // $5.00 (Verified)
    "UNVERIFIED_HIGH", // $55.84 (Unverified, balance USD > 0)
    "UNVERIFIED_LOW", // $5.68 (Unverified, balance USD > 0)
    "ZERO_VERIFIED", // $0.00 (Verified)
    "ZERO_UNVERIFIED", // $0.00 (Unverified)
  ]);
});

test("sortSourcesByPriority in deposit source selection sorts verified tokens before unverified tokens", () => {
  const destination = {
    chainID: 10,
    tokenAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
  };

  const swapBalance = [
    {
      symbol: "NFLXB",
      name: "NFLXB",
      balance: "9",
      value: "55.84",
      decimals: 9,
      logo: "",
      verified: false,
      chainBalances: [],
      breakdown: [
        {
          symbol: "NFLXB",
          contractAddress: "0x7dbb044907a185cc37dfd38659d5c1e21f76624c",
          decimals: 9,
          universe: "EVM" as const,
          balance: "9",
          value: "55.84",
          balanceInFiat: 55.84,
          chain: { id: 8453, name: "Base", logo: "" },
          verified: false,
        },
      ],
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      balance: "10",
      value: "10",
      decimals: 6,
      logo: "",
      verified: true,
      chainBalances: [],
      breakdown: [
        {
          symbol: "USDC",
          contractAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimals: 6,
          universe: "EVM" as const,
          balance: "10",
          value: "10",
          balanceInFiat: 10,
          chain: { id: 8453, name: "Base", logo: "" },
          verified: true,
        },
      ],
    },
  ];

  const sorted = sortSourcesByPriority(swapBalance as any, destination as any);
  assert.equal(sorted[0].symbol, "USDC"); // Verified token comes first even though $10 < $55.84
  assert.equal(sorted[1].symbol, "NFLXB"); // Unverified token comes second
});

test("UnverifiedBadge renders as an outlined chip with yellow ochre color", () => {
  const markup = renderToStaticMarkup(<UnverifiedBadge />);
  assert.match(markup, /data-testid="unverified-badge"/);
  assert.match(markup, /Unverified/);
  assert.match(markup, /#D98A1C/);
  assert.match(markup, /borderRadius:999px|border-radius:999px/);
});
