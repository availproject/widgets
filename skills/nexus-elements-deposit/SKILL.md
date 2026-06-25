---
name: nexus-elements-deposit
description: "DEPRECATED — The standalone Deposit element (NexusDeposit) has been removed. Use Nexus Widget (config.mode = \"deposit\") for all deposit flows. Refer to the nexus-one-deposit agent skill for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus Widget Deposit

**The standalone Deposit element (NexusDeposit) has been removed from Nexus Elements.**

All deposit flows (swap + execute into a protocol) are now handled by **Nexus Widget** with `config.mode = "deposit"` and a specific `deposit` config object.

## Migration

Replace any `NexusDeposit` usage with `NexusWidget`:

```tsx
import { NexusWidget } from "@/components/nexus/nexus";
import { encodeFunctionData } from "viem";

const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const USDT_ARBITRUM = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";

<NexusWidget
  config={{
    mode: "deposit",
    deposit: {
      title: "Aave",
      protocol: "Aave",
      chainId: 42161,
      tokenSymbol: "USDT",
      tokenDecimals: 6,
      tokenAddress: USDT_ARBITRUM,
      executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) => ({
        to: AAVE_POOL,
        data: encodeFunctionData({ /* ... */ }),
        tokenApproval: {
          toTokenAddress: USDT_ARBITRUM,
          amount,
          spender: AAVE_POOL,
        },
      }),
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

For integration guidance, refer to the **Nexus Widget Deposit agent skill**:

- `nexus-one-deposit` — Setup, prefill config, and contract transaction building for deposits with Nexus Widget.

## Documentation

- [Nexus Widget component docs](https://elements.nexus.availproject.org/docs/components/nexus)
- [Deposit docs](https://elements.nexus.availproject.org/docs/components/deposit)
