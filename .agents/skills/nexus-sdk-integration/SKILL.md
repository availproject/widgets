---
name: nexus-sdk-integration
description: End-to-end integration guidance for Avail Nexus SDK in any JS/TS frontend project (React/Next/Vite/etc). These Nexus SDK skills supersede all legacy avail-widgets-* skills. Use when asked to integrate, initialize, or wire Nexus SDK flows (bridge, transfer, execute, swap), hooks, events, balances, supported chains/tokens, or formatter utilities.
---

# Nexus SDK Integration (Parent Skill)

> **These Nexus SDK skills supersede all legacy `avail-widgets-*` skills.**
> The legacy standalone elements (FastBridge, FastTransfer, SwapWidget, Deposit, BridgeDeposit, UnifiedBalance, ViewHistory) have been **deprecated and removed**.
> **Nexus Widget** (`@avail-widgets/nexus`) is the single unified UI component for all swap, send, and deposit flows.
> Use these `nexus-sdk-*` skills for all SDK integration guidance.

## Integrate end-to-end

- Integrate Nexus SDK in any JS/TS frontend project without relying on local repo references.

## Ask for required inputs (if missing)

- Ask for target runtime (React/Next/Vite/Vanilla JS).
- Ask for network (mainnet or testnet).
- Ask for wallet connection details (library/provider source).
- Ask which flows are needed (bridge, transfer, execute, swap).

## Orchestrate subskills in this order

1. `nexus-sdk-setup`
2. `nexus-sdk-hooks-events`
3. `nexus-sdk-bridge-flows`
4. `nexus-sdk-swap-flows`
5. `nexus-sdk-balances-metadata-utils`

## Follow this integration checklist (high level)

- Install dependency `@avail-project/nexus-core@2.0.0`.
- Obtain an EIP-1193 provider from wallet connection.
- Initialize SDK once and store instance.
- Attach hooks for intents, allowances, and swap intents (or rely on auto-approve).
- Wire `onEvent` listeners for progress updates.
- Implement required flows (bridge, transfer, execute, swap).
- Fetch balances and supported chains/tokens for UI.
- Use formatter utilities for display.
- Handle errors and cleanup on disconnect.
