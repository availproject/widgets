---
name: nexus-elements-deposit
description: "DEPRECATED — The standalone Deposit element (NexusDeposit) has been removed. Use Nexus One (config.mode = \"deposit\" with opportunities) for all deposit flows. Refer to the nexus-sdk-* agent skills for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus One

**The standalone Deposit element (NexusDeposit) has been removed from Nexus Elements.**

All deposit flows (swap + execute into a protocol) are now handled by **Nexus One** with `config.mode = "deposit"` and an `opportunities` array.

## Migration

Replace any `NexusDeposit` usage with `NexusOne`:

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";
import { encodeFunctionData } from "viem";

const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const USDT_ARBITRUM = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";

<NexusOne
  config={{
    mode: "deposit",
    opportunities: [
      {
        id: "aave-usdt-arbitrum",
        title: "Aave",
        protocol: "Aave",
        subtitle: "Deposit USDT on Arbitrum",
        chainId: 42161,
        tokenSymbol: "USDT",
        tokenAddress: USDT_ARBITRUM,
        execute: (amount, connectedAddress) => ({
          to: AAVE_POOL,
          data: encodeFunctionData({ /* ... */ }),
          gas: 300000n,
          tokenApproval: {
            token: USDT_ARBITRUM,
            amount,
            spender: AAVE_POOL,
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
- `nexus-sdk-swap-flows` — swapWithExactIn, swapWithExactOut, swapAndExecute
- `nexus-sdk-hooks-events` — intent hooks and event streaming
- `nexus-sdk-balances-metadata-utils` — balances, supported chains/tokens, formatters
- `nexus-sdk-integration` — end-to-end integration guide

## Documentation

- [Nexus One component docs](https://elements.nexus.availproject.org/docs/components/nexus-one)
- [Deposit docs](https://elements.nexus.availproject.org/docs/components/deposit)
