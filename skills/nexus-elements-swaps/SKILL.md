---
name: nexus-elements-swaps
description: "DEPRECATED — SwapWidget has been removed. Use Nexus Widget (config.mode = \"swap\") for all cross-chain swap and bridge flows. Refer to the nexus-one-swaps agent skill for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus Widget Swaps

**SwapWidget has been removed from Nexus Elements.**

All cross-chain swaps (exact-in and exact-out) and bridges are now handled by **Nexus Widget** with `config.mode = "swap"`.

## Migration

Replace any `SwapWidget` usage with `NexusWidget`:

```tsx
import { NexusWidget } from "@/components/nexus/nexus";

<NexusWidget
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

## Install Nexus Widget

```bash
npx shadcn@latest add @avail-widgets/nexus
```

## Recommended skill to use instead

For integration guidance, refer to the **Nexus Widget Swaps agent skill**:

- `nexus-one-swaps` — Setup, prefill config, and callbacks for swaps and bridging with Nexus Widget.

## Documentation

- [Nexus Widget component docs](https://elements.nexus.availproject.org/docs/components/nexus)
- [Swap and Bridge docs](https://elements.nexus.availproject.org/docs/components/swaps)
