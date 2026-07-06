# Nexus Widget — Production Element

Last updated: June 2, 2026

## 1) Status

**Nexus Widget is now the production, primary element.** It is available from the public GitHub shadcn registry and is the only recommended component for all cross-chain flows. All legacy standalone elements have been deprecated and removed.

## 2) What Nexus Widget provides

A single unified component that handles:
- **Swap and Bridge** (`config.mode = "swap"`) — cross-chain swaps with exact-in and exact-out. Bridge paths are resolved automatically when tokens match.
- **Send / Transfer** (`config.mode = "send"`) — cross-chain transfers to a recipient address.
- **Deposit** (`config.mode = "deposit"`) — swap-and-execute deposit into a single configured protocol or app action.

## 3) Install

```bash
npx shadcn@latest add availproject/widgets/nexus
```

## 4) Registry and docs

- GitHub registry: `availproject/widgets/nexus`
- Future shadcn namespace: `@avail-widgets/nexus`
- Docs: `https://elements.nexus.availproject.org/docs/components/nexus`
- Mode-specific docs:
  - Swap: `/docs/components/swaps`
  - Send: `/docs/components/transfer`
  - Deposit: `/docs/components/deposit`

## 5) Configuration Model

Use `config.mode` to select `swap`, `send`, or `deposit`. Optional config fields include `prefill`, `allowedSourcePairs`, `allowedDestinationPairs`, and `deposit` for deposit mode.

## 6) UX Principles

1. Outcome-first input model: user describes desired result, not protocol mechanics.
2. One primary action per screen: avoid multiple competing CTAs.
3. Progressive disclosure: advanced controls hidden by default.
4. Smart defaults: auto mode, preselected best route, prefilled likely values.
5. Fast feedback: quote and route clarity appear early.
6. Calm language: direct, low-jargon text and actionable errors.

## 7) SDK Operations Per Mode

| Mode | SDK call | Behavior |
|---|---|---|
| `swap` | `swapWithExactIn` / `swapWithExactOut` | Users choose source and receive assets |
| `send` | exact-out transfer path | Exact-out, users choose token/amount to send |
| `deposit` | `swapAndExecute` | Exact-out, with a configured deposit execute builder |

## 8) Deposit Config

`deposit` is required only when `mode` is `"deposit"`. It describes the destination asset and the contract execution Nexus performs after the swap settles.

## 9) Architecture

- `NexusProvider` = SDK lifecycle + shared data + hooks (unchanged, still required)
- `NexusWidget` = unified element with internal state management per mode
- Legacy elements (FastBridge, FastTransfer, SwapWidget, Deposit, BridgeDeposit, UnifiedBalance, ViewHistory) = **deprecated and removed**

## 10) Module layout

- `registry/avail-widgets/nexus-widget/nexus-widget.tsx` — main component
- `registry/avail-widgets/nexus-widget/components/*` — mode-specific UI
- `registry/avail-widgets/nexus-widget/hooks/*` — flow hooks
- `registry/avail-widgets/nexus-widget/types.ts` — shared types
- `registry/avail-widgets/nexus/NexusProvider.tsx` — SDK provider (shared)

## 11) What was deprecated

| Legacy element | What it did | Why removed |
|---|---|---|
| `FastBridge` | Self-bridge via `sdk.bridge` | Subsumed by Nexus Widget swap mode |
| `FastTransfer` | Bridge-to-recipient via `sdk.bridgeAndTransfer` | Subsumed by Nexus Widget send mode |
| `SwapWidget` | Cross-chain swap via `sdk.swapWithExactIn`/`Out` | Subsumed by Nexus Widget swap mode |
| `Deposit` (NexusDeposit) | Swap+execute deposit via `sdk.swapAndExecute` | Subsumed by Nexus Widget deposit mode |
| `BridgeDeposit` | Bridge+execute deposit via `sdk.bridgeAndExecute` | Subsumed by Nexus Widget deposit mode |
| `UnifiedBalance` | Balance visualization | Inline in Nexus Widget |
| `ViewHistory` | Intent history list | Not in V1; use `sdk.getMyIntents()` |
