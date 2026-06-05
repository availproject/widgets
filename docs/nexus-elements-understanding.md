# Nexus Elements: Current Architecture

Last updated: June 2, 2026

## Status

**All legacy standalone elements have been deprecated and removed.** Nexus One is the single unified element for all cross-chain flows.

## Element inventory

### Active

| Element | Registry name | Purpose |
|---|---|---|
| `NexusOne` | `@nexus-elements/nexus-one` | Unified swap, send, and deposit element |
| `NexusProvider` | `@nexus-elements/nexus-provider` | SDK lifecycle, shared state, hooks |

### Deprecated and removed

| Element | Status | Replaced by |
|---|---|---|
| `FastBridge` | ❌ Removed | `NexusOne` with `config.mode = "swap"` |
| `FastTransfer` | ❌ Removed | `NexusOne` with `config.mode = "send"` |
| `SwapWidget` | ❌ Removed | `NexusOne` with `config.mode = "swap"` |
| `Deposit` (NexusDeposit) | ❌ Removed | `NexusOne` with `config.mode = "deposit"` + `opportunities` |
| `BridgeDeposit` | ❌ Removed | `NexusOne` with `config.mode = "deposit"` + `opportunities` |
| `UnifiedBalance` | ❌ Removed | Inline balance view in Nexus One |
| `ViewHistory` | ❌ Removed | Use `sdk.getMyIntents()` directly |

## The brain: `NexusProvider`

File: `registry/nexus-elements/nexus/NexusProvider.tsx`

`NexusProvider` is the shared state and SDK control plane used by Nexus One.

### What it initializes

- Creates one `NexusSDK` instance.
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
- `swapBalance` is not fetched during initial setup by default; Nexus One calls `fetchSwapBalance()` when needed.

## Nexus One

File: `registry/nexus-elements/nexus-one/nexus-one.tsx`

### Modes

| Mode | SDK operations | Behavior |
|---|---|---|
| `swap` | `swapWithExactIn`, `swapWithExactOut` | Users choose source and receive assets. Nexus One switches between exact-in and exact-out quoting. Also handles direct bridge paths automatically. |
| `send` | `swapAndTransfer` | Exact-out. Users choose the token and amount to send, then Nexus resolves the pay-with sources. |
| `deposit` | `swapAndExecute` | Exact-out. Users select from opportunities, enter amount, and Nexus executes the deposit. |

### Configuration model

```ts
type NexusOneMode = "swap" | "send" | "deposit";

interface NexusOneConfig {
  mode: NexusOneMode;
  prefill?: { /* token, chain, amount, recipient, source, destination */ };
  allowedSourcePairs?: { token; chain }[];
  allowedDestinationPairs?: { token; chain }[];
  opportunities?: DepositOpportunity[]; // required for deposit mode
}
```

### Props

| Prop | Type | Notes |
|---|---|---|
| `config` | `NexusOneConfig` | Selects workflow and mode-specific behavior |
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

- Export map: `registry/nexus-elements/all/index.ts`
- Provider brain: `registry/nexus-elements/nexus/NexusProvider.tsx`
- Nexus One: `registry/nexus-elements/nexus-one/nexus-one.tsx`
