---
name: avail-widgets-bridge-deposit
description: "DEPRECATED — BridgeDeposit has been removed. Use Nexus Widget (config.mode = \"deposit\") for all deposit flows. Refer to the nexus-widget-deposit agent skill for current integration guidance."
---

# ⚠️ Deprecated — Use Nexus Widget Deposit

**BridgeDeposit has been removed from Avail Widgets.**

All deposit flows (bridge + execute and swap + execute) are now handled by **Nexus Widget** with `config.mode = "deposit"` and the NexusWidget deposit config shape.

## Migration

Replace any `BridgeDeposit` usage with `NexusWidget`:

```tsx
import { NexusWidget } from "@avail-project/widgets";
import { encodeFunctionData } from "viem";

const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

<NexusWidget
  config={{
    mode: "deposit",
    destination: {
      chain: 8453,
      tokens: [{ address: USDC_BASE, symbol: "USDC", decimals: 6 }],
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
