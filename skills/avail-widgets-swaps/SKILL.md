---
name: avail-widgets-swaps
description: "DEPRECATED — SwapWidget has been removed. Use Nexus Widget (config.mode = \"swap\") for all cross-chain swap and bridge flows. Refer to the nexus-widget-swaps agent skill for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus Widget Swaps

**SwapWidget has been removed from Avail Widgets.**

All cross-chain swaps (exact-in and exact-out) and bridges are now handled by **Nexus Widget** with `config.mode = "swap"`.

## Migration

Replace any `SwapWidget` usage with `NexusWidget`:

```tsx
import { NexusWidget } from "@avail-project/widgets";

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
