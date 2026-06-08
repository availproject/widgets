---
name: nexus-elements-nexus-provider
description: Install and configure NexusProvider for Nexus Elements with full SDK lifecycle wiring. NexusProvider is required by Nexus One — the single unified element for all swap, send, and deposit flows. All other standalone widget skills are deprecated.
---

# Nexus Elements - NexusProvider

> **Note:** NexusProvider is the foundation required by **Nexus One** — the single unified element for all flows.
> All legacy standalone widget skills (fast-bridge, transfer, swaps, deposit, bridge-deposit, unified-balance, view-history, common) are **deprecated and removed**.
> Use `npx shadcn@latest add @nexus-elements/nexus-one` to install the unified element.
> For detailed SDK integration, refer to the Nexus SDK agent skills (`.agents/skills/nexus-sdk-*`).

## Install and wire provider

- Install:
  - `npx shadcn@latest add @nexus-elements/nexus-provider`
- Ensure dependencies exist:
  - `@avail-project/nexus-core`
  - `wagmi`

## Wrap your app

```tsx
"use client";

import NexusProvider from "@/components/nexus/NexusProvider";

export function AppNexusProvider({ children }: { children: React.ReactNode }) {
  return (
    <NexusProvider config={{ network: "mainnet", debug: false }}>
      {children}
    </NexusProvider>
  );
}
```

## Initialize SDK on wallet connect

- Resolve an EIP-1193 provider from your wallet stack.
- Call `handleInit(provider)` after wallet status becomes connected.
- Pass only providers with `request()`.

```tsx
"use client";

import { useEffect } from "react";
import { useAccount, useConnectorClient } from "wagmi";
import type { EthereumProvider } from "@avail-project/nexus-core";
import { useNexus } from "@/components/nexus/NexusProvider";

export function InitNexusOnConnect() {
  const { status, connector } = useAccount();
  const { data: walletClient } = useConnectorClient();
  const { handleInit } = useNexus();

  useEffect(() => {
    if (status !== "connected") return;

    void (async () => {
      const mobileProvider = walletClient
        ? ({
            request: (args: unknown) => walletClient.request(args as never),
          } as EthereumProvider)
        : undefined;
      const desktopProvider = await connector?.getProvider();
      const provider =
        mobileProvider ?? (desktopProvider as EthereumProvider | undefined);
      if (!provider || typeof provider.request !== "function") return;
      await handleInit(provider);
    })();
  }, [status, connector, walletClient, handleInit]);

  return null;
}
```

## Understand provider lifecycle (current implementation)

- `handleInit(provider)`:
  - guard: skips if already initialized or loading.
  - validate provider shape.
  - call `initializeNexus(provider)`.
  - call setup preload (`supported chains/tokens`, bridge balances, Coinbase rates).
  - attach hooks (`intent`, `allowance`, `swapIntent`).
- `initializeNexus(provider)`:
  - calls `sdk.initialize(provider)` once.
  - sets `nexusSDK` state.
- `deinitializeNexus()`:
  - calls `sdk.deinit()`.
  - clears balances, rates, supported chains/tokens, and hook refs.
- Auto-disconnect behavior:
  - provider uses `useAccountEffect` from wagmi to deinit on disconnect.

## SDK functions NexusProvider relies on

- Init/lifecycle:
  - `sdk.initialize(provider)`
  - `sdk.deinit()`
  - `sdk.isInitialized()`
- Metadata and balances:
  - `sdk.utils.getSupportedChains(...)`
  - `sdk.utils.getSwapSupportedChainsAndTokens()`
  - `sdk.getBalancesForBridge()`
  - `sdk.getBalancesForSwap()`
  - `sdk.utils.getCoinbaseRates()`
- Hook wiring:
  - `sdk.setOnIntentHook(...)`
  - `sdk.setOnAllowanceHook(...)`
  - `sdk.setOnSwapIntentHook(...)`

## Understand hook contract

- Any active hook payload includes `allow()` and `deny()`.
- If a widget sets hook-driven confirmation UI, always call one of them.
- Not calling `allow()`/`deny()` leaves a flow pending.

## `useNexus()` API surface

- Core:
  - `nexusSDK`, `loading`, `network`
- Lifecycle:
  - `handleInit`, `initializeNexus`, `deinitializeNexus`, `attachEventHooks`
- Hook refs:
  - `intent`, `allowance`, `swapIntent`
- Data:
  - `bridgableBalance`, `swapBalance`, `exchangeRate`
  - `supportedChainsAndTokens`, `swapSupportedChainsAndTokens`
- Helpers:
  - `fetchBridgableBalance`, `fetchSwapBalance`, `getFiatValue(amount, token)`

## E2E validation

- Connect wallet and assert `nexusSDK` becomes non-null.
- Assert supported chains/tokens are populated.
- Assert bridge and swap balances are fetched.
- Trigger a widget flow and confirm corresponding hook ref is populated.
- Disconnect wallet and confirm state clears.

## Troubleshoot

- `Invalid EIP-1193 provider`:
  - use `connector.getProvider()` or a wallet client wrapper exposing `request()`.
- Init succeeds but widgets fail:
  - ensure `handleInit` runs before mounting interactive flows.
- Missing fiat values:
  - check `exchangeRate`; fallback is token amount \* `1` if rate missing.
