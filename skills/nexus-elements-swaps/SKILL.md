---
name: nexus-elements-swaps
description: "DEPRECATED — SwapWidget has been removed. Use Nexus One (config.mode = \"swap\") for all cross-chain swap and bridge flows. Refer to the nexus-sdk-* agent skills for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus One

**SwapWidget has been removed from Nexus Elements.**

All cross-chain swaps (exact-in and exact-out) and bridges are now handled by **Nexus One** with `config.mode = "swap"`.

## Migration

Replace any `SwapWidget` usage with `NexusOne`:

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";

<NexusOne
  config={{
    mode: "swap",
    prefill: {
      source: { token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", chain: 42161 },
      destination: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: 8453 },
    },
  }}
  connectedAddress={address}
/>
```

## Install Nexus One

```bash
npx shadcn@latest add @nexus-elements/nexus-one
```

## Current skills to use instead

For integration guidance, refer to the **Nexus SDK agent skills** (`.agents/skills/`):

- `nexus-sdk-setup` — SDK initialization and wallet wiring
- `nexus-sdk-swap-flows` — swapWithExactIn, swapWithExactOut, swapAndExecute
- `nexus-sdk-hooks-events` — intent hooks and event streaming
- `nexus-sdk-balances-metadata-utils` — balances, supported chains/tokens, formatters
- `nexus-sdk-integration` — end-to-end integration guide

## Documentation

- [Nexus One component docs](https://elements.nexus.availproject.org/docs/components/nexus-one)
- [Swap and Bridge docs](https://elements.nexus.availproject.org/docs/components/swaps)
