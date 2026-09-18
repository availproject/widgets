---
name: avail-widgets-transfer
description: "DEPRECATED — FastTransfer has been removed. Use Nexus Widget (config.mode = \"send\") for all cross-chain recipient transfer flows. Refer to the nexus-widget-send agent skill for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus Widget Send

**FastTransfer has been removed from Avail Widgets.**

All cross-chain transfers to a recipient are now handled by **Nexus Widget** with `config.mode = "send"`.

## Migration

Replace any `FastTransfer` usage with `NexusWidget`:

```tsx
import { NexusWidget } from "@avail-project/widgets";

<NexusWidget
  config={{
    mode: "send",
    destination: {
      chain: 8453,
      tokens: [{ address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 }],
    },
    recipientAddress: "0xRecipientAddress",
    prefill: {
      amount: "10",
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

For integration guidance, refer to the **Nexus Widget Send agent skill**:

- `nexus-widget-send` — Setup, prefill config, and callbacks for recipient transfers with Nexus Widget.
