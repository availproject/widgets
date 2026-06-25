---
name: nexus-one-send
description: Scaffolding, configuration, and integration of the Nexus Widget component in send mode (config.mode = "send"). Used to send tokens to an external recipient address cross-chain.
---

# Nexus Widget - Send / Transfers

Use the **Nexus Widget** component with `config.mode = "send"` to enable cross-chain transfers directly to a recipient address. The user chooses the asset and amount to send, and Nexus automatically finds and routes from their available balances on different source chains.

## 1. Installation

Install dependencies and the component via the shadcn CLI:

```bash
npx shadcn@latest add @avail-widgets/nexus
```

Make sure peer dependencies are installed:
```bash
npm install @avail-project/nexus-sdk-v2@git+https://github.com/availproject/nexus-sdk-v2.git#v0.0.2 decimal.js lucide-react viem wagmi class-variance-authority clsx tailwind-merge
```

## 2. Basic Setup

Wrap the component with `NexusProvider`. Render `NexusWidget` with `config.mode = "send"`.

```tsx
import { NexusWidget } from "@/components/nexus/nexus";

export function SendWidget({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
      config={{
        mode: "send",
      }}
      connectedAddress={address}
    />
  );
}
```

## 3. Prefilling Recipient, Amount & Token

You can pre-populate the token, amount, and recipient address to speed up checkout.
- **USDC on Base (8453):** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

```tsx
const sendConfig = {
  mode: "send",
  prefill: {
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    chain: 8453,
    amount: "25.5",                                       // Prefilled amount
    recipient: "0xRecipientWalletAddressHere" as `0x${string}`, // Prefilled recipient
  },
};

<NexusWidget config={sendConfig} connectedAddress={address} />;
```

## 4. Restricting Token Options

Configure `allowedSourcePairs` (to restrict what tokens can be used to pay) or `allowedDestinationPairs` (to restrict what tokens can be sent to the recipient).

```tsx
const sendConfig = {
  mode: "send",
  allowedDestinationPairs: [
    { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: 8453 }, // Only allow sending USDC on Base
  ],
};
```

## 5. Event Callbacks

Wire lifecycle callbacks for notifications or analytics:

```tsx
<NexusWidget
  config={{ mode: "send" }}
  connectedAddress={address}
  onStart={() => console.log("Transfer started")}
  onComplete={(explorerUrl) => console.log("Transfer succeeded!", explorerUrl)}
  onError={(message) => console.error("Transfer failed:", message)}
/>
```
