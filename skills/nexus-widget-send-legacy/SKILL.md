---
name: nexus-widget-send
description: Legacy alias for Nexus Widget send guidance. Prefer nexus-widget-send.
---

# Nexus Widget - Send

Use `NexusWidget` with `config.mode = "send"`. A supplied `recipientAddress` is locked; if it is omitted, users enter the recipient.

```tsx
<NexusWidget
  config={{
    mode: "send",
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
    recipientAddress: "0xRecipient",
    prefill: { amount: "25.5" },
    validation: { minAmount: "1", maxAmount: "500" },
    appearance: {
      heading: "Send",
      mode: "system",
      primaryColor: "#0A6BEB",
    },
  }}
  onConnectClick={openWalletModal}
/>
```

Use `prefill.token` only in the new object shape `{ chain, address, symbol, decimals, logo? }` when you want an initial destination token without restricting later choices. If `destination.tokens` is supplied, it wins and `prefill.token` is ignored.

Do not use the old `prefill.chain`, `prefill.recipient`, `allowedDestinationPairs`, or `allowedSourcePairs` fields.
