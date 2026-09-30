import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adaptIntentHook,
} from "../registry/avail-widgets/nexus/better-intent-compat";
import type {
  SwapAndExecuteHookData,
  SwapAndExecuteIntent,
} from "@avail-project/nexus-core";

const mockChains = [
  {
    id: 8453,
    name: "Base",
    logo: "https://example.com/base.png",
    swapSupported: true,
    tokens: [
      {
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        decimals: 6,
      },
    ],
  },
  {
    id: 10,
    name: "Optimism",
    logo: "https://example.com/op.png",
    swapSupported: true,
    tokens: [
      {
        contractAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        symbol: "USDC",
        decimals: 6,
      },
    ],
  },
];

const mockExecuteRequirement = {
  chain: {
    id: 8453,
    name: "Base",
    logo: "https://example.com/base.png",
  },
  to: "0x1111111111111111111111111111111111111111" as `0x${string}`,
  token: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
    symbol: "USDC",
    decimals: 6,
    amountRaw: BigInt(10000000),
    amount: "10.0",
    valueUsd: "10.00",
  },
  gas: {
    address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    symbol: "ETH",
    decimals: 18,
    amountRaw: BigInt(21000000000000),
    amount: "0.000021",
    valueUsd: "0.06",
    estimatedGasUnits: BigInt(100000),
    approvalGasUnits: BigInt(0),
    feeParams: { type: "eip1559" as const, maxFeePerGas: BigInt(200000000), maxPriorityFeePerGas: BigInt(10000000) },
    l1FeeRaw: BigInt(0),
    priceTier: "medium" as const,
  },
  nativeValue: null,
  tokenApproval: null,
};

const mockQuote = {
  provider: "nexus-v2" as const,
  input: [
    {
      chainId: 10,
      tokenAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" as `0x${string}`,
      tokenSymbol: "USDC",
      amountRaw: BigInt(10500000),
      amountUsd: "10.50",
      totalRequiredRaw: BigInt(10500000),
    },
  ],
  output: {
    chainId: 8453,
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
    amountRaw: BigInt(10000000),
    amountUsd: "10.00",
    minAmountRaw: BigInt(9950000),
    minAmountUsd: "9.95",
  },
  fees: {
    depositRaw: BigInt(50000),
    depositUsd: "0.05",
    fulfillmentUsd: "0.10",
    protocolRaw: BigInt(20000),
    protocolUsd: "0.02",
    solverRaw: BigInt(30000),
    solverUsd: "0.03",
    caGasRaw: BigInt(100000),
  },
  plan: {
    steps: [],
  },
};

test("adaptIntentHook normalizes SwapAndExecuteHookData when swap is required", async () => {
  let refreshedSources: any = null;
  const mockHookData: SwapAndExecuteHookData = {
    attemptId: "test-attempt-1",
    intent: {
      executeRequirement: mockExecuteRequirement,
      available: {
        token: { amountRaw: BigInt(0), amount: "0", valueUsd: "0" },
        gas: { amountRaw: BigInt(100000000000000), amount: "0.0001", valueUsd: "0.30" },
      },
      shortfall: {
        token: { amountRaw: BigInt(10000000), amount: "10.0", valueUsd: "10.00" },
        gas: { amountRaw: BigInt(0), amount: "0", valueUsd: "0" },
      },
      swapRequired: true,
      quote: mockQuote as any,
    },
    allow: () => {},
    deny: () => {},
    refresh: async (sources) => {
      refreshedSources = sources;
      return mockHookData.intent;
    },
  };

  const adapted = adaptIntentHook(mockHookData, mockChains as any);

  assert.equal(adapted.intent.swapRequired, true);
  assert.equal(adapted.intent.destination.chain.id, 8453);
  assert.equal(adapted.intent.destination.token.symbol, "USDC");
  assert.equal(adapted.intent.destination.amount, "10");
  assert.equal(adapted.intent.destination.gas.amount, "0.000021");
  assert.equal(adapted.intent.destination.gas.value, "0.06");
  assert.equal(adapted.intent.sources.length, 1);
  assert.equal(adapted.intent.sources[0]?.chain.id, 10);
  assert.equal(adapted.intent.sources[0]?.token.symbol, "USDC");
  assert.equal(adapted.intent.feesAndBuffer.bridge.totalUsd, "0.1");

  await adapted.refresh([10]);
  assert.deepEqual(refreshedSources, [
    { chainId: 10, tokenAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
  ]);

  await adapted.refresh([]);
  assert.deepEqual(refreshedSources, []);
});

test("adaptIntentHook normalizes SwapAndExecuteHookData when swap is skipped (fully funded)", async () => {
  let allowed = false;
  let denied = false;

  const mockFullyFundedIntent: SwapAndExecuteIntent = {
    executeRequirement: mockExecuteRequirement,
    available: {
      token: { amountRaw: BigInt(15000000), amount: "15.0", valueUsd: "15.00" },
      gas: { amountRaw: BigInt(500000000000000), amount: "0.0005", valueUsd: "1.50" },
    },
    shortfall: {
      token: { amountRaw: BigInt(0), amount: "0", valueUsd: "0" },
      gas: { amountRaw: BigInt(0), amount: "0", valueUsd: "0" },
    },
    swapRequired: false,
  };

  const mockHookData: SwapAndExecuteHookData = {
    attemptId: "test-attempt-2",
    intent: mockFullyFundedIntent,
    allow: () => {
      allowed = true;
    },
    deny: () => {
      denied = true;
    },
    refresh: async () => mockFullyFundedIntent,
  };

  const adapted = adaptIntentHook(mockHookData, mockChains as any);

  assert.equal(adapted.intent.swapRequired, false);
  assert.equal(adapted.intent.destination.chain.id, 8453);
  assert.equal(adapted.intent.destination.amount, "10.0");
  assert.equal(adapted.intent.destination.gas.amount, "0.000021");
  assert.equal(adapted.intent.sources.length, 0);
  assert.equal(adapted.intent.feesAndBuffer.bridge.total, "0");

  adapted.allow();
  assert.equal(allowed, true);

  adapted.deny();
  assert.equal(denied, true);
});
