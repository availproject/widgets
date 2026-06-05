---
name: nexus-elements-common
description: "DEPRECATED — Common hooks and helpers are now internal to Nexus One. Use Nexus One for all flows. Refer to the nexus-sdk-* agent skills for building custom integrations."
---

# ⚠️ Deprecated — Use Nexus One

**The Common hooks package is now internal to Nexus One.**

Shared hooks like `useTransactionSteps`, `usePolling`, `useDebouncedValue`, and `useNexusError` are bundled inside Nexus One and no longer need separate installation or direct usage.

## Migration

- If you were using Common hooks to build custom flows, use **Nexus One** directly — it handles all swap, send, and deposit flows out of the box.
- If you need programmatic SDK access for custom UX, use the Nexus SDK directly.

## Install Nexus One

```bash
npx shadcn@latest add @nexus-elements/nexus-one
```

## Current skills to use instead

For building custom integrations, refer to the **Nexus SDK agent skills** (`.agents/skills/`):

- `nexus-sdk-setup` — SDK initialization and wallet wiring
- `nexus-sdk-bridge-flows` — bridge, bridgeAndTransfer, bridgeAndExecute
- `nexus-sdk-swap-flows` — swapWithExactIn, swapWithExactOut, swapAndExecute
- `nexus-sdk-hooks-events` — intent hooks and event streaming
- `nexus-sdk-balances-metadata-utils` — balances, supported chains/tokens, formatters
- `nexus-sdk-integration` — end-to-end integration guide

## Documentation

- [Nexus One component docs](https://elements.nexus.availproject.org/docs/components/nexus-one)
