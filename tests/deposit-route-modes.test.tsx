import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { normalizeNexusWidgetConfig } from "../registry/avail-widgets/nexus-widget/nexus-widget";
import { DepositExactOutIdleForm } from "../registry/avail-widgets/nexus-widget/components/deposit-exact-out-idle-form";
import { DepositIdleForm } from "../registry/avail-widgets/nexus-widget/components/deposit-idle-form";
import type { NexusWidgetConfig } from "../registry/avail-widgets/nexus-widget/types";
import type { SwapTokenOption } from "../registry/avail-widgets/nexus-widget/components/swap-asset-selector";

const toToken: SwapTokenOption = {
  chainId: 10,
  chainName: "Optimism",
  contractAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  balance: "100",
  balanceInFiat: "$100.00",
};

const fromToken: SwapTokenOption = {
  chainId: 8453,
  chainName: "Base",
  contractAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  balance: "50",
  balanceInFiat: "$50.00",
  userAmount: "10",
  userAmountMode: "usd",
};

test("normalizeNexusWidgetConfig defaults deposit route to exactOutput when route is omitted", () => {
  const config: NexusWidgetConfig = {
    mode: "deposit",
    destination: {
      chain: 10,
      tokens: [
        {
          address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
          symbol: "USDC",
          decimals: 6,
        },
      ],
    },
    depositAddress: "0x794a61358d6845594f94dc1db02a252b5b4814ad",
    executeDeposit: () => ({
      to: "0x794a61358d6845594f94dc1db02a252b5b4814ad",
      gas: BigInt(400_000),
    }),
  };

  const normalized = normalizeNexusWidgetConfig(config);
  assert.equal(normalized.depositRoute, "exactOutput");
  assert.equal(normalized.config.depositRoute, "exactOutput");
  assert.equal(normalized.activeMode, "deposit");
});

test("normalizeNexusWidgetConfig respects explicit route exactOutput and exactInput", () => {
  const baseConfig: NexusWidgetConfig = {
    mode: "deposit",
    destination: {
      chain: 10,
      tokens: [
        {
          address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
          symbol: "USDC",
          decimals: 6,
        },
      ],
    },
    depositAddress: "0x794a61358d6845594f94dc1db02a252b5b4814ad",
    executeDeposit: () => ({
      to: "0x794a61358d6845594f94dc1db02a252b5b4814ad",
      gas: BigInt(400_000),
    }),
  };

  const exactOutNormalized = normalizeNexusWidgetConfig({
    ...baseConfig,
    route: "exactOutput",
  });
  assert.equal(exactOutNormalized.depositRoute, "exactOutput");
  assert.equal(exactOutNormalized.config.depositRoute, "exactOutput");

  const exactInNormalized = normalizeNexusWidgetConfig({
    ...baseConfig,
    route: "exactInput",
  });
  assert.equal(exactInNormalized.depositRoute, "exactInput");
  assert.equal(exactInNormalized.config.depositRoute, "exactInput");
});

test("DepositExactOutIdleForm renders exact-out UI structure with pay-with sources and destination inputs", async () => {
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <DepositExactOutIdleForm
          amount="10"
          amountMode="usd"
          fromTokens={[fromToken]}
          onAmountChange={() => {}}
          onAmountModeToggle={() => {}}
          onOpenSourcePicker={() => {}}
          onSetPercent={() => {}}
          tokenValue="10"
          toToken={toToken}
          totalBalance="100"
          usdValue="10"
        />
      );
    });

    const json = JSON.stringify(renderer!.toJSON());
    // Destination token symbol should be present
    assert.ok(json.includes("USDC"), "Exact out form should display USDC destination token");
    // Should have amount input
    const inputs = renderer!.root.findAllByType("input");
    assert.ok(inputs.length > 0, "Exact out form should render amount input");
  } finally {
    if (renderer) {
      await act(async () => {
        renderer?.unmount();
      });
    }
  }
});

test("DepositIdleForm renders exact-in multi-token UI structure with destination receives hero and add token button", async () => {
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <DepositIdleForm
          amount="10"
          amountMode="usd"
          fromTokens={[fromToken]}
          onAmountChange={() => {}}
          onAmountModeToggle={() => {}}
          onOpenSourcePicker={() => {}}
          onSetPercent={() => {}}
          tokenValue="10"
          toToken={toToken}
          totalBalance="50"
          usdValue="10"
          destinationLabel="Aave"
        />
      );
    });

    const json = JSON.stringify(renderer!.toJSON());
    // Receives hero section
    assert.ok(json.includes("Aave") && json.includes("receives"), "Exact in form should display destination receives");
    // Multi-token 'Add another token' button
    assert.ok(json.includes("Add another token"), "Exact in form should have Add another token button");
    // Title includes Deposit
    assert.ok(json.includes("Deposit"), "Exact in form should include Deposit in title");
  } finally {
    if (renderer) {
      await act(async () => {
        renderer?.unmount();
      });
    }
  }
});
