---
name: avail-widgets-view-history
description: "DEPRECATED — ViewHistory has been removed. Intent history is not included in Nexus Widget V1. Use sdk.getMyIntents() directly for programmatic history access. Refer to the nexus-sdk-* agent skills for guidance."
---

# ⚠️ Deprecated — Use Nexus Widget

**ViewHistory has been removed from Avail Widgets.**

Intent history is not included in Nexus Widget V1. For programmatic access to intent history, use the Nexus SDK directly:

```ts
const intents = await sdk.getMyIntents();
```

## Install Nexus Widget

```bash
npx shadcn@latest add availproject/widgets/nexus
```

## Current skills to use instead

For SDK APIs, refer to the **Nexus SDK agent skills** (`.agents/skills/`):

- `nexus-sdk-balances-metadata-utils` — balances, supported chains/tokens, intent history
- `nexus-sdk-setup` — SDK initialization and wallet wiring
- `nexus-sdk-integration` — end-to-end integration guide

## Documentation

- [Nexus Widget component docs](https://elements.nexus.availproject.org/docs/components/nexus)
