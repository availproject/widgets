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
import { NexusWidget } from "@/components/nexus/nexus";

<NexusWidget
  config={{
    mode: "send",
    prefill: {
      token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      chain: 8453, // USDC on Base
      amount: "10",
      recipient: "0xRecipientAddress",
    },
  }}
  connectedAddress={address}
/>
```

## Install Nexus Widget

```bash
npx shadcn@latest add @avail-widgets/nexus
```

## Recommended skill to use instead

For integration guidance, refer to the **Nexus Widget Send agent skill**:

- `nexus-widget-send` — Setup, prefill config, and callbacks for recipient transfers with Nexus Widget.

## Documentation

- [Nexus Widget component docs](https://elements.nexus.availproject.org/docs/components/nexus)
- [Send docs](https://elements.nexus.availproject.org/docs/components/transfer)
