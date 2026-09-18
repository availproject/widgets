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
import { NexusWidget } from "@avail-project/widgets";

// Bridge USDC to Base — Nexus Widget resolves the optimal route automatically
<NexusWidget
  config={{
    mode: "swap",
    destination: {
      chain: 8453,
      tokens: [{ address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 }],
    },
  }}
  connectedAddress={address}
/>
```

## Install Nexus Widget

**npm (recommended):**
```bash
npm install @avail-project/widgets viem wagmi @tanstack/react-query
```

**shadcn:**
```bash
npx shadcn@latest add availproject/widgets/nexus
```

## Recommended skill to use instead

For integration guidance, refer to the **Nexus Widget Swaps agent skill**:

- `nexus-widget-swaps` — Setup, prefill config, and callbacks for swaps and bridging with Nexus Widget.
