---
name: nexus-elements-bridge-deposit
description: "DEPRECATED — BridgeDeposit has been removed. Use Nexus One (config.mode = \"deposit\") for all deposit flows. Refer to the nexus-one-deposit agent skill for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus One Deposit

**BridgeDeposit has been removed from Nexus Elements.**

All deposit flows (bridge + execute and swap + execute) are now handled by **Nexus One** with `config.mode = "deposit"` and a specific `deposit` config object.

## Migration

Replace any `BridgeDeposit` usage with `NexusOne`:

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";
import { encodeFunctionData } from "viem";

const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

<NexusOne
  config={{
    mode: "deposit",
    deposit: {
      title: "Aave",
      protocol: "Aave",
      chainId: 8453,
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      tokenAddress: USDC_BASE,
      executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) => ({
        to: AAVE_POOL,
        data: encodeFunctionData({ /* ... */ }),
        tokenApproval: {
          token: USDC_BASE,
          amount,
          spender: AAVE_POOL,
        },
      }),
    },
  }}
  connectedAddress={address}
/>
```

## Install Nexus One

```bash
npx shadcn@latest add @nexus-elements/nexus-one
```

## Recommended skill to use instead

For integration guidance, refer to the **Nexus One Deposit agent skill**:

- `nexus-one-deposit` — Setup, prefill config, and contract transaction building for deposits with Nexus One.

## Documentation

- [Nexus One component docs](https://elements.nexus.availproject.org/docs/components/nexus-one)
- [Deposit docs](https://elements.nexus.availproject.org/docs/components/deposit)
