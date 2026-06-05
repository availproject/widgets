---
name: nexus-elements-transfer
description: "DEPRECATED — FastTransfer has been removed. Use Nexus One (config.mode = \"send\") for all cross-chain recipient transfer flows. Refer to the nexus-sdk-* agent skills for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus One

**FastTransfer has been removed from Nexus Elements.**

All cross-chain transfers to a recipient are now handled by **Nexus One** with `config.mode = "send"`.

## Migration

Replace any `FastTransfer` usage with `NexusOne`:

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";

<NexusOne
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

## Install Nexus One

```bash
npx shadcn@latest add @nexus-elements/nexus-one
```

## Current skills to use instead

For integration guidance, refer to the **Nexus SDK agent skills** (`.agents/skills/`):

- `nexus-sdk-setup` — SDK initialization and wallet wiring
- `nexus-sdk-bridge-flows` — bridge, bridgeAndTransfer, bridgeAndExecute
- `nexus-sdk-hooks-events` — intent hooks and event streaming
- `nexus-sdk-balances-metadata-utils` — balances, supported chains/tokens, formatters
- `nexus-sdk-integration` — end-to-end integration guide

## Documentation

- [Nexus One component docs](https://elements.nexus.availproject.org/docs/components/nexus-one)
- [Send docs](https://elements.nexus.availproject.org/docs/components/transfer)
