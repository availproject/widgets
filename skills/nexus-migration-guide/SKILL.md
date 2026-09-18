---
name: nexus-migration-guide
description: Guidelines for updating legacy Avail Widgets integrations (Nexus One, SwapWidget, FastBridge, FastTransfer, NexusDeposit) to the current NexusWidget API.
---

# Avail Widgets - Updating Legacy Integrations

All legacy standalone widgets and the old Nexus One component have been removed. **NexusWidget** is the single unified component for all swap, send, and deposit flows.

## Install

**npm (recommended):**
```bash
npm install @avail-project/widgets viem wagmi @tanstack/react-query
```

Import: `import { NexusWidget, NexusProvider, useNexus } from "@avail-project/widgets"`

**shadcn (source files):**
```bash
npx shadcn@latest add availproject/widgets/nexus
```

Import: `import { NexusWidget } from "@/components/nexus/nexus"`

## Replacement Mapping

- **Nexus One / SwapWidget / FastBridge** → `<NexusWidget config={{ mode: "swap" }} />`
  - `destination.chain` and `destination.tokens` replace `allowedDestinationPairs`
  - `prefill.token` replaces old `prefill.destination` (token only, no amount prefill in swap)
  - Remove `allowedSourcePairs` — not supported in current API
- **FastTransfer / Nexus One send** → `<NexusWidget config={{ mode: "send" }} />`
  - Use `recipientAddress` (not `prefill.recipient`)
  - Use `prefill.amount` (not `prefill.amount` inside nested `prefill`)
  - Use `destination.chain` / `destination.tokens` instead of `allowedDestinationPairs`
- **NexusDeposit / BridgeDeposit / Nexus One deposit** → `<NexusWidget config={{ mode: "deposit", destination, depositAddress, executeDeposit }} />`
  - Replace the old `deposit.chainId/tokenSymbol/tokenAddress/title` shape with `destination.chain`, `destination.tokens`, `depositAddress`, and `executeDeposit`
  - `executeDeposit` receives `(tokenSymbol, tokenAddress, amount, chainId, user)` and must return `{ to, gas, data?, value?, tokenApproval? }`
  - `gas` field is **required** as a positive `bigint`
- **UnifiedBalance / ViewHistory** → Remove. Use `sdk.getBalancesForBridge()` / `sdk.getMyIntents()` for programmatic access.

## Updated Examples

```tsx
// npm import:
import { NexusWidget } from "@avail-project/widgets";
// shadcn import:
// import { NexusWidget } from "@/components/nexus/nexus";

// Swap / Bridge
<NexusWidget
  connectedAddress={address}
  config={{
    mode: "swap",
    destination: {
      chain: 8453,
      tokens: [{ address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 }],
    },
  }}
/>

// Send
<NexusWidget
  connectedAddress={address}
  config={{
    mode: "send",
    destination: {
      chain: 8453,
      tokens: [{ address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 }],
    },
    recipientAddress: "0xRecipient...",
    prefill: { amount: "10" },
  }}
/>

// Deposit
<NexusWidget
  connectedAddress={address}
  config={{
    mode: "deposit",
    destination: {
      chain: 8453,
      tokens: [{ address: "0xToken...", symbol: "USDC", decimals: 6 }],
    },
    depositAddress: "0xContract...",
    executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) => ({
      to: "0xContract...",
      gas: 400_000n,
      data: "0xCalldata...",
      tokenApproval: { toTokenAddress: tokenAddress, amount, spender: "0xContract..." },
    }),
    appearance: { appName: "My App", mode: "system" },
  }}
/>
```

## Safeguards

- Prefer public callbacks (`onStart`, `onComplete`, `onError`, `onConnectClick`) before editing component internals.
- Do not copy legacy component internals over the new `components/nexus` files.
- Preserve host app wallet behavior by wiring `onConnectClick` to the app/header connect function.
- For deposit/bridge config generation, use the [Avail Configurator](https://configurator.availproject.org/).
