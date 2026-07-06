---
name: avail-widgets-unified-balance
description: "DEPRECATED — UnifiedBalance has been removed. Nexus Widget includes an inline balance view. Refer to the nexus-sdk-* agent skills for balance API guidance."
---

# ⚠️ Deprecated — Use Nexus Widget

**UnifiedBalance has been removed from Avail Widgets.**

Nexus Widget includes an **inline balance view** as part of its unified swap, send, and deposit flows. There is no longer a standalone balance widget.

## Migration

Remove `UnifiedBalance` from your app. If you need to display balances, use Nexus Widget — it shows relevant balances inline during flow execution.

For programmatic balance access, use the Nexus SDK directly:

```ts
// Bridge balances
const bridgeBalances = await sdk.getBalancesForBridge();

// Swap balances
const swapBalances = await sdk.getBalancesForSwap();

// Format for display
const formatted = sdk.utils.formatTokenBalance(balance);
```

## Install Nexus Widget

```bash
npx shadcn@latest add availproject/widgets/nexus
```

## Current skills to use instead

For balance and metadata APIs, refer to the **Nexus SDK agent skills** (`.agents/skills/`):

- `nexus-sdk-balances-metadata-utils` — balances, supported chains/tokens, formatters
- `nexus-sdk-setup` — SDK initialization and wallet wiring
- `nexus-sdk-integration` — end-to-end integration guide

## Documentation

- [Nexus Widget component docs](https://elements.nexus.availproject.org/docs/components/nexus)
