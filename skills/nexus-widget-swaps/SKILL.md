---
name: nexus-widget-swaps
description: Scaffolding, configuration, and integration of the Nexus Widget component in swap mode (config.mode = "swap"). Handles cross-chain swaps and bridges.
---

# Nexus Widget - Swaps & Bridges

Use `NexusWidget` with `config.mode = "swap"` for the unified swap and bridge flow.

## Installation

```bash
npx shadcn@latest add availproject/widgets/nexus
```

```bash
npm install @avail-project/nexus-core@2.0.0 decimal.js lucide-react viem wagmi class-variance-authority clsx tailwind-merge
```

## Config Shape

Swap config is intentionally small:

- `destination.chain` is optional. If supplied, receive-chain selection is restricted.
- `destination.tokens` is optional. If supplied with `destination.chain`, receive-token selection is restricted.
- `prefill.token` is optional and sets the initial receive token without restricting later choices.
- `recipientAddress` is optional for custom-recipient swaps.
- `appearance` is optional.

Swap supports `prefill.token` only. It does not support `prefill.amount`, source-token prefill, or validation yet. If `destination.tokens` is supplied, the first destination token wins and `prefill.token` is ignored.

```tsx
import { NexusWidget } from "@/components/nexus/nexus";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export function SwapWidget({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
      connectedAddress={address}
      config={{
        mode: "swap",
        destination: {
          chain: 8453,
          tokens: [
            {
              address: USDC_BASE,
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
  );
}
```

## Notes

- Do not use the old `prefill.source`, `prefill.destination`, `allowedSourcePairs`, or `allowedDestinationPairs` fields.
- `prefill.token` must be shaped as `{ chain, address, symbol, decimals, logo? }`.
- Use the component prop `onConnectClick` to open the host app wallet modal.
