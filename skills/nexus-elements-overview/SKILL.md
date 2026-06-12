---
name: nexus-elements-overview
description: End-to-end integration guide for Nexus Elements. Use Nexus One as the single unified component for all swap, send, and deposit flows. Legacy standalone widgets (FastBridge, FastTransfer, SwapWidget, Deposit, BridgeDeposit, UnifiedBalance, ViewHistory) have been deprecated and removed.
---

# Nexus Elements Overview

## Nexus One is the only element you need

All legacy standalone widgets have been **deprecated and removed**. **Nexus One** is the single unified component that handles swap, send (transfer), and deposit flows.

| Legacy element | Status | Nexus One replacement |
|---|---|---|
| `FastBridge` | ❌ Removed | `NexusOne` with `config.mode = "swap"` |
| `FastTransfer` | ❌ Removed | `NexusOne` with `config.mode = "send"` |
| `SwapWidget` | ❌ Removed | `NexusOne` with `config.mode = "swap"` |
| `Deposit` | ❌ Removed | `NexusOne` with `config.mode = "deposit"` + `opportunities` |
| `BridgeDeposit` | ❌ Removed | `NexusOne` with `config.mode = "deposit"` + `opportunities` |
| `UnifiedBalance` | ❌ Removed | Inline balance view in Nexus One |
| `ViewHistory` | ❌ Removed | Use `sdk.getMyIntents()` directly |

## Install Nexus One

```bash
npx shadcn@latest add @nexus-elements/nexus-one
```

## Integrate end-to-end in any TS/React app

### 1. Install project deps
```bash
pnpm add @avail-project/nexus-core@1.6.0 wagmi viem lucide-react @tanstack/react-query
```

### 2. Configure registry
Add this mapping in `components.json`:
```json
"registries": {
  "@nexus-elements/": "https://elements.nexus.availproject.org/r/{name}.json"
}
```

### 3. Set up NexusProvider
Install and wire `nexus-provider` before Nexus One:
```bash
npx shadcn@latest add @nexus-elements/nexus-provider
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

### 5. Render Nexus One
```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";

// Swap mode (also handles bridges)
<NexusOne config={{ mode: "swap" }} connectedAddress={address} />

// Send mode
<NexusOne config={{ mode: "send" }} connectedAddress={address} />

// Deposit mode
<NexusOne
  config={{
    mode: "deposit",
    opportunities: [{ /* ... */ }],
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
- Confirm Nexus One renders and responds to mode/prefill config.
- Confirm every flow (swap, send, deposit) can reach success.
- Confirm disconnect clears SDK state (`deinitializeNexus`).

## Common integration failures
- Invalid provider object:
  - Ensure provider has `request()`.
- Nexus One not rendering:
  - Ensure `NexusProvider` wraps your app and SDK is initialized.
- Empty balance/sources:
  - Ensure SDK init finished and wallet is connected on a supported network.
