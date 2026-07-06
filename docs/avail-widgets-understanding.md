# Avail Widgets: Current Architecture

Last updated: June 2, 2026

## Status

**All legacy standalone elements have been deprecated and removed.** Nexus Widget is the single unified element for all cross-chain flows.

## Element inventory

### Active

| Element | Current shadcn install address | Purpose |
|---|---|---|
| `NexusWidget` | `availproject/widgets/nexus` | Unified swap, send, and deposit element |
| `NexusProvider` | `availproject/widgets/nexus-provider` | SDK lifecycle, shared state, hooks |

### Deprecated and removed

| Element | Status | Replaced by |
|---|---|---|
| `FastBridge` | ❌ Removed | `NexusWidget` with `config.mode = "swap"` |
| `FastTransfer` | ❌ Removed | `NexusWidget` with `config.mode = "send"` |
| `SwapWidget` | ❌ Removed | `NexusWidget` with `config.mode = "swap"` |
| `Deposit` (NexusDeposit) | ❌ Removed | `NexusWidget` with `config.mode = "deposit"` + `deposit` |
| `BridgeDeposit` | ❌ Removed | `NexusWidget` with `config.mode = "deposit"` + `deposit` |
| `UnifiedBalance` | ❌ Removed | Inline balance view in Nexus Widget |
| `ViewHistory` | ❌ Removed | Use `sdk.getMyIntents()` directly |

## The brain: `NexusProvider`

File: `registry/avail-widgets/nexus/NexusProvider.tsx`

`NexusProvider` is the shared state and SDK control plane used by Nexus Widget.

### What it initializes

- Creates one Nexus SDK client.
- On `handleInit(provider)`:
  - initializes SDK
  - loads supported chains/tokens (`getSupportedChains`, `getSwapSupportedChainsAndTokens`)
  - fetches bridge balances (`getBalancesForBridge`)
  - fetches rates (`utils.getCoinbaseRates`) and normalizes to USD-per-unit
  - attaches hooks (`setOnAllowanceHook`, `setOnIntentHook`, `setOnSwapIntentHook`)

### Important shared state

- `bridgableBalance`: from `sdk.getBalancesForBridge()`
- `swapBalance`: from `sdk.getBalancesForSwap()` (lazy, only when explicitly fetched)
- `intent`, `allowance`, `swapIntent`: refs to active hook payloads that power confirm/deny UX
- `supportedChainsAndTokens`, `swapSupportedChainsAndTokens`
- pricing helpers: `getFiatValue`, `resolveTokenUsdRate`

### Important behavior

- On wallet disconnect, it deinitializes SDK and clears provider state.
- `swapBalance` is not fetched during initial setup by default; Nexus Widget calls `fetchSwapBalance()` when needed.

## Nexus Widget

File: `registry/avail-widgets/nexus-widget/nexus-widget.tsx`

### Modes

| Mode | SDK operations | Behavior |
|---|---|---|
| `swap` | `swapWithExactIn`, `swapWithExactOut` | Users choose source and receive assets. Nexus Widget switches between exact-in and exact-out quoting. Also handles direct bridge paths automatically. |
| `send` | exact-out transfer path | Exact-out. Users choose the token and amount to send, then Nexus resolves the pay-with sources. |
| `deposit` | `swapAndExecute` | Exact-out. Users enter amount for one configured deposit target, and Nexus executes the deposit. |

### Configuration model

Use `config.mode` to select `swap`, `send`, or `deposit`. Optional config fields include `prefill`, source/destination filters, and `deposit` for deposit mode.

### Props

| Prop | Type | Notes |
|---|---|---|
| `config` | `object` | Selects workflow and mode-specific behavior |
| `connectedAddress` | `` `0x${string}` `` | Optional. Falls back to wagmi connected wallet. |
| `embed` | `boolean` | Defaults to `true`. Set `false` for modal mode. |
| `onComplete` | `(explorerUrl?) => void` | Called after success |
| `onStart` | `() => void` | Called when execution starts |
| `onError` | `(message) => void` | Called on failure |
| `onClose` | `() => void` | Used by modal mode |

## SDK skills reference

For detailed SDK integration guidance, use the Nexus SDK agent skills (`.agents/skills/`):

- `nexus-sdk-setup` — SDK initialization and wallet wiring
- `nexus-sdk-bridge-flows` — bridge, bridgeAndTransfer, bridgeAndExecute
- `nexus-sdk-swap-flows` — swapWithExactIn, swapWithExactOut, swapAndExecute
- `nexus-sdk-hooks-events` — intent hooks and event streaming
- `nexus-sdk-balances-metadata-utils` — balances, supported chains/tokens, formatters
- `nexus-sdk-integration` — end-to-end integration guide

## Useful references

- Export map: `registry/avail-widgets/all/index.ts`
- Provider brain: `registry/avail-widgets/nexus/NexusProvider.tsx`
- Nexus Widget: `registry/avail-widgets/nexus-widget/nexus-widget.tsx`
