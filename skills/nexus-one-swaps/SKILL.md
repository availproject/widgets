---
name: nexus-one-swaps
description: Scaffolding, configuration, and integration of NexusWidget in swap mode (config.mode = "swap"). Handles cross-chain swaps and bridges.
---

# Nexus Widget - Swaps & Bridges

Use `NexusWidget` with `config.mode = "swap"` for the unified swap and bridge flow.

For bridge mode configuration, use the [Avail Configurator](https://configurator.availproject.org/) to generate the exact config object.

## Installation

**npm (recommended):**
```bash
npm install @avail-project/widgets viem wagmi @tanstack/react-query
```

**shadcn (source files):**
```bash
npx shadcn@latest add availproject/widgets/nexus
```

## Basic Setup

```tsx
// npm:
import { NexusWidget } from "@avail-project/widgets";
// shadcn: import { NexusWidget } from "@/components/nexus/nexus";

export function SwapWidget({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
      config={{ mode: "swap" }}
      connectedAddress={address}
    />
  );
}
```

## Restricting Destination Token/Chain

Use `destination.chain` and `destination.tokens` to restrict the receive selector:

```tsx
<NexusWidget
  connectedAddress={address}
  config={{
    mode: "swap",
    destination: {
      chain: 8453,
      tokens: [
        {
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          symbol: "USDC",
          decimals: 6,
        },
      ],
    },
    appearance: {
      heading: "Swap and Bridge",
      mode: "system",
      primaryColor: "#0A6BEB",
    },
  }}
/>
```

## Initial Token Prefill (Without Restricting)

Use `prefill.token` to set an initial receive token while keeping the full selector available:

```tsx
<NexusWidget
  connectedAddress={address}
  config={{
    mode: "swap",
    prefill: {
      token: {
        chain: 8453,
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        decimals: 6,
      },
    },
  }}
/>
```

## Event Callbacks

```tsx
<NexusWidget
  config={{ mode: "swap" }}
  connectedAddress={address}
  onStart={() => console.log("Swap started")}
  onComplete={(explorerUrl) => console.log("Swap succeeded!", explorerUrl)}
  onError={(message) => console.error("Swap failed:", message)}
  onConnectClick={() => openWalletModal()}
/>
```

## Notes

- Swap does **not** support `prefill.amount`, source-token prefill, or validation.
- `prefill.token` is ignored when `destination.tokens` is supplied.
- Do not use the old `allowedSourcePairs`, `allowedDestinationPairs`, or `prefill.source/destination` fields.
