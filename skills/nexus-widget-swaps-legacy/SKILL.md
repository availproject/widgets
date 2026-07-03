---
name: nexus-widget-swaps
description: Legacy alias for Nexus Widget swap guidance. Prefer nexus-widget-swaps.
---

# Nexus Widget - Swap And Bridge

Use `NexusWidget` with `config.mode = "swap"` for the unified swap and bridge flow.

```tsx
<NexusWidget
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
  onConnectClick={openWalletModal}
/>
```

Swap supports `prefill.token` only in the new object shape `{ chain, address, symbol, decimals, logo? }`. It sets the initial receive token without restricting later choices. If `destination.tokens` is supplied, it wins and `prefill.token` is ignored.

Swap does not support `prefill.amount`, source-token prefill, or validation yet. Do not use the old `prefill.source`, `prefill.destination`, `allowedSourcePairs`, or `allowedDestinationPairs` fields.
