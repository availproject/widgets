---
name: nexus-elements-bridge-deposit
description: "DEPRECATED — BridgeDeposit has been removed. Use Nexus One (config.mode = \"deposit\" with opportunities) for all deposit flows. Refer to the nexus-sdk-* agent skills for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus One

**BridgeDeposit has been removed from Nexus Elements.**

All deposit flows (bridge + execute and swap + execute) are now handled by **Nexus One** with `config.mode = "deposit"` and an `opportunities` array.

## Migration

Replace any `BridgeDeposit` usage with `NexusOne`:

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";

<NexusOne
  config={{
    mode: "deposit",
    opportunities: [
      {
        id: "my-deposit",
        protocol: "MyProtocol",
        chainId: 8453,
        tokenSymbol: "USDC",
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        execute: (amount, connectedAddress) => ({
          to: "0xContractAddress",
          data: "0xCalldata",
          gas: 300000n,
          tokenApproval: {
            token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount,
            spender: "0xContractAddress",
          },
        }),
      },
    ],
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
- `nexus-sdk-swap-flows` — swapWithExactIn, swapWithExactOut, swapAndExecute
- `nexus-sdk-hooks-events` — intent hooks and event streaming
- `nexus-sdk-balances-metadata-utils` — balances, supported chains/tokens, formatters
- `nexus-sdk-integration` — end-to-end integration guide

## Documentation

- [Nexus One component docs](https://elements.nexus.availproject.org/docs/components/nexus-one)
- [Deposit docs](https://elements.nexus.availproject.org/docs/components/deposit)
