---
name: nexus-one-swaps
description: Scaffolding, configuration, and integration of the Nexus Widget component in swap mode (config.mode = "swap"). Handles cross-chain swaps and bridges.
---

# Nexus Widget - Swaps & Bridges

Use the **Nexus Widget** component with `config.mode = "swap"` to enable users to swap or bridge assets across supported blockchains. Nexus Widget automatically calculates routes and swaps between exact-in and exact-out flows.

## 1. Installation

Install dependencies and the component via the shadcn CLI:

```bash
npx shadcn@latest add @avail-widgets/nexus
```

Make sure peer dependencies are installed:
```bash
npm install @avail-project/nexus-sdk-v2@git+https://github.com/availproject/nexus-sdk-v2.git#v0.0.2 decimal.js lucide-react viem wagmi class-variance-authority clsx tailwind-merge
```

## 2. Basic Setup

Wrap the component with `NexusProvider` (usually in your root layout or app provider stack). For provider setup and SDK initialization details, refer to `nexus-elements-nexus-provider` or the Migration Guide.

```tsx
import { NexusWidget } from "@/components/nexus/nexus";

export function SwapWidget({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
      config={{
        mode: "swap",
      }}
      connectedAddress={address}
    />
  );
}
```

## 3. Prefilling Assets & Chains

To guide the user's initial selection, you can prefill the source and destination tokens/chains.
- **USDC on Arbitrum (42161):** `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- **USDC on Base (8453):** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

```tsx
<NexusWidget
  config={{
    mode: "swap",
    prefill: {
      amount: "100.0", // optional initial amount
      source: {
        token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on Arbitrum
        chain: 42161,
      },
      destination: {
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
        chain: 8453,
      },
    },
  }}
  connectedAddress={address}
/>
```

## 4. Restricting Token Selection

Use `allowedSourcePairs` and `allowedDestinationPairs` to restrict which networks and tokens users are allowed to interact with.

```tsx
<NexusWidget
  config={{
    mode: "swap",
    allowedSourcePairs: [
      { token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", chain: 42161 }, // USDC on Arbitrum
      { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: 8453 },   // USDC on Base
    ],
    allowedDestinationPairs: [
      { token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", chain: 42161 }, // USDT on Arbitrum
    ]
  }}
/>
```

## 5. Integrating Event Callbacks

Use event callbacks to trigger toasts, navigate, or track metrics:

```tsx
<NexusWidget
  config={{ mode: "swap" }}
  connectedAddress={address}
  onStart={() => {
    console.log("Transaction flow initiated");
  }}
  onComplete={(explorerUrl) => {
    console.log("Swap completed successfully! Explorer URL:", explorerUrl);
  }}
  onError={(errorMessage) => {
    console.error("Swap flow failed:", errorMessage);
  }}
/>
```

## 6. Rendering as a Modal

Set `embed={false}` to render as a modal. You can control the open state or let it be uncontrolled.

```tsx
// Controlled modal rendering
import { useState } from "react";

export function ControlledSwapModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open Swap Modal</button>
      <NexusWidget
        config={{ mode: "swap" }}
        embed={false}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
```
