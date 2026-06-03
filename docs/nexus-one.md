# Nexus One — Production Element

Last updated: June 2, 2026

## 1) Status

**Nexus One is now the production, primary element.** It has been published to the registry and is the only recommended component for all cross-chain flows. All legacy standalone elements have been deprecated and removed.

## 2) What Nexus One provides

A single unified component that handles:
- **Swap and Bridge** (`config.mode = "swap"`) — cross-chain swaps with exact-in and exact-out. Bridge paths are resolved automatically when tokens match.
- **Send / Transfer** (`config.mode = "send"`) — cross-chain transfers to a recipient address.
- **Deposit** (`config.mode = "deposit"`) — swap-and-execute deposit into protocols like Aave, with configurable opportunities.

## 3) Install

```bash
npx shadcn@latest add @nexus-elements/nexus-one
```

## 4) Registry and docs

- Registry: `@nexus-elements/nexus-one`
- Docs: `https://elements.nexus.availproject.org/docs/components/nexus-one`
- Mode-specific docs:
  - Swap: `/docs/components/swaps`
  - Send: `/docs/components/transfer`
  - Deposit: `/docs/components/deposit`

## 5) Configuration Model

```ts
type NexusOneMode = "swap" | "send" | "deposit";

interface NexusOneConfig {
  mode: NexusOneMode;
  prefill?: {
    token?: `0x${string}`;
    chain?: number;
    amount?: string;
    recipient?: `0x${string}`;
    source?: { token: `0x${string}`; chain: number };
    destination?: { token: `0x${string}`; chain: number };
  };
  allowedSourcePairs?: { token: `0x${string}`; chain: number }[];
  allowedDestinationPairs?: { token: `0x${string}`; chain: number }[];
  opportunities?: DepositOpportunity[]; // required for deposit mode
}

interface NexusOneProps {
  config: NexusOneConfig;
  connectedAddress?: `0x${string}`;
  embed?: boolean; // default true
  onComplete?: (explorerUrl?: string) => void;
  onStart?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}
```

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
| `send` | `swapAndTransfer` | Exact-out, users choose token/amount to send |
| `deposit` | `swapAndExecute` | Exact-out, with opportunity execute builder |

## 8) Deposit Opportunities

`opportunities` is required only when `mode` is `"deposit"`. Each opportunity describes a destination asset and the contract execution Nexus performs after the swap settles.

```ts
interface DepositOpportunity {
  id: string;
  protocol: string;
  chainId: number;
  tokenSymbol: string;
  tokenAddress: `0x${string}`;
  execute:
    | ExecuteConfig
    | ((amount: bigint, connectedAddress: `0x${string}`) => ExecuteConfig);
  label?: string;
  title?: string;
  subtitle?: string;
  logo?: string;
  tokenLogo?: string;
  apy?: string;
  description?: string;
}

interface ExecuteConfig {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
  gas: bigint;
  gasPrice?: "low" | "medium" | "high";
  tokenApproval?: {
    token: `0x${string}`;
    amount: bigint;
    spender: `0x${string}`;
  };
}
```

## 9) Architecture

- `NexusProvider` = SDK lifecycle + shared data + hooks (unchanged, still required)
- `NexusOne` = unified element with internal state management per mode
- Legacy elements (FastBridge, FastTransfer, SwapWidget, Deposit, BridgeDeposit, UnifiedBalance, ViewHistory) = **deprecated and removed**

## 10) Module layout

- `registry/nexus-elements/nexus-one/nexus-one.tsx` — main component
- `registry/nexus-elements/nexus-one/components/*` — mode-specific UI
- `registry/nexus-elements/nexus-one/hooks/*` — flow hooks
- `registry/nexus-elements/nexus-one/types.ts` — shared types
- `registry/nexus-elements/nexus/NexusProvider.tsx` — SDK provider (shared)

## 11) What was deprecated

| Legacy element | What it did | Why removed |
|---|---|---|
| `FastBridge` | Self-bridge via `sdk.bridge` | Subsumed by Nexus One swap mode |
| `FastTransfer` | Bridge-to-recipient via `sdk.bridgeAndTransfer` | Subsumed by Nexus One send mode |
| `SwapWidget` | Cross-chain swap via `sdk.swapWithExactIn`/`Out` | Subsumed by Nexus One swap mode |
| `Deposit` (NexusDeposit) | Swap+execute deposit via `sdk.swapAndExecute` | Subsumed by Nexus One deposit mode |
| `BridgeDeposit` | Bridge+execute deposit via `sdk.bridgeAndExecute` | Subsumed by Nexus One deposit mode |
| `UnifiedBalance` | Balance visualization | Inline in Nexus One |
| `ViewHistory` | Intent history list | Not in V1; use `sdk.getMyIntents()` |
