---
name: avail-widgets-deposit
description: "DEPRECATED — The standalone Deposit element (NexusDeposit) has been removed. Use Nexus Widget (config.mode = \"deposit\") for all deposit flows. Refer to the nexus-widget-deposit agent skill for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus Widget Deposit

**The standalone Deposit element (NexusDeposit) has been removed from Avail Widgets.**

All deposit flows (swap + execute into a protocol) are now handled by **Nexus Widget** with `config.mode = "deposit"` and the NexusWidget deposit config shape.

## Migration

Replace any `NexusDeposit` usage with `NexusWidget`:

```tsx
import { NexusWidget } from "@avail-project/widgets";
import { encodeFunctionData } from "viem";

const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const USDT_ARBITRUM = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";

<NexusWidget
  config={{
    mode: "deposit",
    destination: {
      chain: 42161,
      tokens: [{ address: USDT_ARBITRUM, symbol: "USDT", decimals: 6 }],
    },
    depositAddress: AAVE_POOL,
    executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) => ({
      to: AAVE_POOL,
      gas: 400_000n,
      data: encodeFunctionData({ /* ... */ }),
      tokenApproval: {
        toTokenAddress: tokenAddress,
        amount,
        spender: AAVE_POOL,
      },
    }),
    appearance: { appName: "Aave", mode: "system" },
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

For integration guidance, refer to the **Nexus Widget Deposit agent skill**:

- `nexus-widget-deposit` — Setup, prefill config, and contract transaction building for deposits with Nexus Widget.
