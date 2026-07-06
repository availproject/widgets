---
name: avail-widgets-fast-bridge
description: "DEPRECATED — FastBridge has been removed. Use Nexus Widget (config.mode = \"swap\") for all cross-chain bridge and swap flows. Refer to the nexus-widget-swaps agent skill for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus Widget Swaps

**FastBridge has been removed from Avail Widgets.**

All cross-chain bridging is now handled by **Nexus Widget** with `config.mode = "swap"`. Nexus Widget automatically resolves the best route — including direct bridge paths — based on source and destination token/chain selection.

## Migration

Replace any `FastBridge` usage with `NexusWidget`:

```tsx
import { NexusWidget } from "@/components/nexus/nexus";

// Bridge USDC to Base — Nexus Widget resolves the optimal route automatically
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
npx shadcn@latest add availproject/widgets/nexus
```

## Recommended skill to use instead

For integration guidance, refer to the **Nexus Widget Swaps agent skill**:

- `nexus-widget-swaps` — Setup, prefill config, and callbacks for swaps and bridging with Nexus Widget.

## Documentation

- [Nexus Widget component docs](https://elements.nexus.availproject.org/docs/components/nexus)
- [Swap and Bridge docs](https://elements.nexus.availproject.org/docs/components/swaps)
