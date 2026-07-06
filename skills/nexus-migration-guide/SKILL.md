---
name: nexus-migration-guide
description: Detailed guidelines for LLMs and developer agents on migrating codebases from legacy standalone Avail Widgets widgets (swaps, fast-bridge, transfer, deposit) to the unified Nexus Widget component.
---

# Avail Widgets - Migration Guide for Agents & LLMs

Use this skill when migrating legacy Avail widgets to the unified `NexusWidget`.

## Replacement Mapping

- Standalone swaps and FastBridge:
  - Replace with `<NexusWidget config={{ mode: "swap" }} />`.
  - Use `config.destination` to restrict receive chain/token. Use `prefill.token` only to set the initial receive token without restricting later choices. Swap amount/source prefill is not supported.
- FastTransfer:
  - Replace with `<NexusWidget config={{ mode: "send" }} />`.
  - Use `recipientAddress`, `prefill.amount`, optional `prefill.token`, `validation`, and optional `destination`.
- NexusDeposit and BridgeDeposit:
  - Replace with `<NexusWidget config={{ mode: "deposit", destination, depositAddress, executeDeposit }} />`.
  - Do not use the removed `deposit` object.
- UnifiedBalance and ViewHistory:
  - Remove the components. Balances and history are handled inside NexusWidget, or use SDK APIs for custom surfaces.

## Install

```bash
npx shadcn@latest add @avail-widgets/nexus
```

Update imports:

```diff
-import { SwapWidget } from "@/components/avail-widgets/swaps";
-import { FastTransfer } from "@/components/avail-widgets/transfer";
+import { NexusWidget } from "@/components/nexus/nexus";
+import NexusProvider from "@/components/nexus/NexusProvider";
```

## Provider

Ensure `NexusProvider` wraps the app and initializes Nexus SDK v2 from an EIP-1193 provider on wallet connect.

## Examples

```tsx
<NexusWidget
  connectedAddress={address}
  config={{
    mode: "send",
    destination: {
      chain: 8453,
      tokens: [
        {
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          symbol: "USDC",
          decimals: 6,
        },
      ],
    },
    recipientAddress: "0xRecipient...",
    prefill: { amount: "10" },
  }}
/>
```

```tsx
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
      data: "0xCalldata...",
      tokenApproval: {
        toTokenAddress: tokenAddress,
        amount,
        spender: "0xContract...",
      },
    }),
    appearance: { appName: "My App", mode: "system" },
  }}
/>
```

## Safeguards

- Prefer public callbacks (`onStart`, `onComplete`, `onError`, `onConnectClick`) before editing component internals.
- Do not copy legacy component internals over the new `components/nexus` files.
- Preserve host app wallet behavior by wiring `onConnectClick` to the app/header connect function.
