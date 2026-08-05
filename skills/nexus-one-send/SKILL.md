---
name: nexus-one-send
description: Scaffolding, configuration, and integration of NexusWidget in send mode (config.mode = "send"). Used to send tokens to an external recipient address cross-chain.
---

# Nexus Widget - Send / Transfers

Use `NexusWidget` with `config.mode = "send"` for recipient transfers. The recipient can be user-entered or locked by passing `recipientAddress`.

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

export function SendWidget({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
      config={{ mode: "send" }}
      connectedAddress={address}
    />
  );
}
```

## Prefilling Recipient, Amount & Token

```tsx
<NexusWidget
  connectedAddress={address}
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
    recipientAddress: "0xRecipientWalletAddressHere",
    prefill: { amount: "25.5" },
    validation: { minAmount: "1", maxAmount: "500" },
    appearance: {
      heading: "Send",
      mode: "system",
      primaryColor: "hsl(216 100% 50%)",
    },
  }}
/>
```

## Event Callbacks

```tsx
<NexusWidget
  config={{ mode: "send" }}
  connectedAddress={address}
  onStart={() => console.log("Transfer started")}
  onComplete={(explorerUrl) => console.log("Transfer succeeded!", explorerUrl)}
  onError={(message) => console.error("Transfer failed:", message)}
  onConnectClick={() => openWalletModal()}
/>
```

## Notes

- `recipientAddress` is locked when supplied — users cannot change it.
- `prefill.amount` must be greater than `0`.
- `prefill.token` sets initial token without restricting later choices. Ignored when `destination.tokens` is supplied.
- Do not use the old `prefill.chain`, `prefill.recipient`, `allowedSourcePairs`, or `allowedDestinationPairs` fields.
