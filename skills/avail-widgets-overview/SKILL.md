---
name: avail-widgets-overview
description: End-to-end integration guide for Avail Widgets. Use Nexus Widget as the single unified component for all swap, send, and deposit flows. Legacy standalone widgets (FastBridge, FastTransfer, SwapWidget, Deposit, BridgeDeposit, UnifiedBalance, ViewHistory) have been deprecated and removed.
---

# Avail Widgets Overview

## Nexus Widget is the only element you need

All legacy standalone widgets have been **deprecated and removed**. **Nexus Widget** is the single unified component that handles swap, send (transfer), and deposit flows.

| Legacy element | Status | Nexus Widget replacement |
|---|---|---|
| `FastBridge` | ❌ Removed | `NexusWidget` with `config.mode = "swap"` |
| `FastTransfer` | ❌ Removed | `NexusWidget` with `config.mode = "send"` |
| `SwapWidget` | ❌ Removed | `NexusWidget` with `config.mode = "swap"` |
| `Deposit` | ❌ Removed | `NexusWidget` with `config.mode = "deposit"` + `config.deposit` |
| `BridgeDeposit` | ❌ Removed | `NexusWidget` with `config.mode = "deposit"` + `config.deposit` |
| `UnifiedBalance` | ❌ Removed | Inline balance view in Nexus Widget |
| `ViewHistory` | ❌ Removed | Use `sdk.getMyIntents()` directly |

## Install Nexus Widget

```bash
npx shadcn@latest add availproject/widgets/nexus
```

## Integrate end-to-end in any TS/React app

### 1. Install project deps
```bash
pnpm add @avail-project/nexus-core@2.0.0 wagmi viem lucide-react @tanstack/react-query
```

### 2. Use the GitHub shadcn registry
For now, install from the public GitHub registry at
`https://github.com/availproject/widgets`. Do not require an
`@avail-widgets` namespace mapping unless the user's project has configured one.

### 3. Set up NexusProvider
Install and wire `nexus-provider` before Nexus Widget:
```bash
npx shadcn@latest add availproject/widgets/nexus-provider
```

Wrap your app with `NexusProvider`:
```tsx
"use client";

import NexusProvider from "@/components/nexus/NexusProvider";

export function AppNexusProvider({ children }: { children: React.ReactNode }) {
  return <NexusProvider config={{ network: "mainnet" }}>{children}</NexusProvider>;
}
```

### 4. Initialize SDK on wallet connect
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
        ? ({ request: (args: unknown) => walletClient.request(args as never) } as EthereumProvider)
        : undefined;
      const desktopProvider = await connector?.getProvider();
      const provider = mobileProvider ?? (desktopProvider as EthereumProvider | undefined);
      if (!provider || typeof provider.request !== "function") return;
      await handleInit(provider);
    })();
  }, [status, connector, walletClient, handleInit]);

  return null;
}
```

### 5. Render Nexus Widget
```tsx
import { NexusWidget } from "@/components/nexus/nexus";

// Swap mode (also handles bridges)
<NexusWidget config={{ mode: "swap" }} connectedAddress={address} />

// Send mode
<NexusWidget config={{ mode: "send" }} connectedAddress={address} />

// Deposit mode
<NexusWidget
  config={{
    mode: "deposit",
    destination: {
      chain: 8453,
      tokens: [{ address: "0xToken...", symbol: "USDC", decimals: 6 }],
    },
    depositAddress: "0xContract...",
    executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) => ({
      to: "0xContract...",
      data: "0xCalldata...",
      tokenApproval: { toTokenAddress: tokenAddress, amount, spender: "0xContract..." },
    }),
  }}
  connectedAddress={address}
/>
```

## Nexus SDK agent skills

For detailed SDK integration guidance, use the **Nexus SDK agent skills** (`.agents/skills/`):

- `nexus-sdk-setup` — SDK initialization and wallet wiring
- `nexus-sdk-bridge-flows` — bridge, bridgeAndTransfer, bridgeAndExecute
- `nexus-sdk-swap-flows` — swapWithExactIn, swapWithExactOut, swapAndExecute
- `nexus-sdk-hooks-events` — intent hooks and event streaming
- `nexus-sdk-balances-metadata-utils` — balances, supported chains/tokens, formatters
- `nexus-sdk-integration` — end-to-end integration guide

## E2E readiness checklist
- Confirm wallet connects and `handleInit` runs once per session.
- Confirm `useNexus().nexusSDK` is non-null after connect.
- Confirm Nexus Widget renders and responds to mode, destination, prefill amount, and validation config.
- Confirm every flow (swap, send, deposit) can reach success.
- Confirm disconnect clears SDK state (`deinitializeNexus`).

## Common integration failures
- Invalid provider object:
  - Ensure provider has `request()`.
- Nexus Widget not rendering:
  - Ensure `NexusProvider` wraps your app and SDK is initialized.
- Empty balance/sources:
  - Ensure SDK init finished and wallet is connected on a supported network.
