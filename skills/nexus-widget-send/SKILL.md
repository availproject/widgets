---
name: nexus-widget-send
description: Scaffolding, configuration, and integration of the Nexus Widget component in send mode (config.mode = "send"). Used to send tokens to an external recipient address cross-chain.
---

# Nexus Widget - Send / Transfers

Use `NexusWidget` with `config.mode = "send"` for recipient transfers. The recipient can be user-entered or locked by passing `recipientAddress`.

## Installation

```bash
npx shadcn@latest add availproject/widgets/nexus
```

```bash
npm install @avail-project/nexus-core@2.0.0 decimal.js lucide-react viem wagmi class-variance-authority clsx tailwind-merge
```

## Config Shape

- `destination.chain` is optional. If omitted, users can change chains.
- `destination.tokens` is optional. If supplied with `destination.chain`, the token selector is limited to those tokens.
- `recipientAddress` is optional and locked when supplied.
- `prefill.amount`, `prefill.token`, `validation.minAmount`, `validation.maxAmount`, and `appearance` are optional.
- `prefill.token` sets the initial destination token but keeps the full token selector available. If `destination.tokens` is supplied, the first destination token wins and `prefill.token` is ignored.

```tsx
import { NexusWidget } from "@/components/nexus/nexus";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const RECIPIENT = "0xRecipientWalletAddressHere" as const;

export function SendWidget({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
      connectedAddress={address}
      config={{
        mode: "send",
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
        recipientAddress: RECIPIENT,
        prefill: { amount: "25.5" },
        validation: { minAmount: "1", maxAmount: "500" },
        appearance: {
          heading: "Send",
          mode: "system",
          primaryColor: "hsl(216 100% 50%)",
        },
      }}
    />
  );
}
```

## Notes

- Do not use the old `prefill.chain`, `prefill.recipient`, `allowedDestinationPairs`, or `allowedSourcePairs` fields.
- `prefill.amount` must be greater than `0`.
- `prefill.token` must be shaped as `{ chain, address, symbol, decimals, logo? }`.
- Use the component prop `onConnectClick` to open the host app wallet modal.
