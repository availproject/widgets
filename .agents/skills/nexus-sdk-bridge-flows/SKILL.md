---
name: nexus-sdk-bridge-flows
description: Implement bridge, bridgeAndTransfer, bridgeAndExecute, and execute flows with Nexus SDK. Use when wiring cross-chain bridge and execution operations, simulations, or max-amount checks.
---

# Bridge and Execute Flows

## Call bridge(params, options?)
- Use to move tokens cross-chain (intent-based bridge).
- Signature:
  - `sdk.bridge(params, { onEvent? })`
- Params (`BridgeParams`):
  - `toTokenSymbol: string` — token symbol (e.g., "ETH", "USDC")
  - `toAmountRaw: bigint` — smallest units
  - `toChainId: number` — destination chain id
  - `recipient?: Hex` — defaults to connected user address
  - `toNativeAmountRaw?: bigint` — optional native token output
  - `sources?: number[]` — restrict source chains
- Result (`BridgeResult`):
  - `intentExplorerUrl: string`
  - `sourceTxs: { chain, txHash, txExplorerUrl }[]`
  - `intent: BridgeIntent`

## Call bridgeAndTransfer(params, options?)
- Use to bridge and transfer to a recipient address.
- Signature:
  - `sdk.bridgeAndTransfer(params, { onEvent? })`
- Params (`TransferParams`):
  - `toTokenSymbol: string`
  - `toAmountRaw: bigint`
  - `toChainId: number`
  - `recipient: Hex`
  - `sources?: number[]`
- Result (`TransferResult`):
  - Transfer result follows `BridgeAndExecuteResult`.

## Call bridgeAndExecute(params, options?)
- Use to bridge (if needed) and then execute a contract call.
- Signature:
  - `sdk.bridgeAndExecute(params, { onEvent?, beforeExecute? })`
- Params (`BridgeAndExecuteParams`):
  - `toTokenSymbol: string`, `toAmountRaw: bigint`, `toChainId: number`
  - `execute: Omit<ExecuteParams, "toChainId">`
  - Optional: `waitForReceipt`, `requiredConfirmations`, timeouts
- `beforeExecute` hook (optional):
  - `beforeExecute?: () => Promise<{ value?: bigint; data?: Hex; gas?: bigint }>`
  - Use to dynamically override execute payload before sending.
- Result (`BridgeAndExecuteResult`):
  - `execute` transaction result and optional `approval` transaction result
  - bridge result fields when a bridge was required
  - `bridgeSkipped: boolean`
  - `intent?: BridgeIntent`

## Call execute(params, options?)
- Use for a standalone contract call on a chain.
- Signature:
  - `sdk.execute(params, { onEvent? })`
- Params (`ExecuteParams`):
  - `toChainId: number`
  - `to: Hex` (contract address)
  - `data?: Hex`
  - `value?: bigint`
  - `gas?: bigint` (optional but recommended for deterministic behavior)
  - `gasPrice?: 'low' | 'medium' | 'high'`
  - Optional receipt config: `waitForReceipt`, `receiptTimeout`, `requiredConfirmations`
  - Optional `tokenApproval?: { toTokenSymbol: string; amount: bigint; spender: Hex }`
- Result (`ExecuteResult`):
  - `execute`, optional `approval`, and `chainId`
  - optional receipt fields

## Use simulation helpers
- Call `sdk.simulateBridge(params)` → `SimulationResult`.
- Call `sdk.simulateBridgeAndTransfer(params)` → `BridgeAndExecuteSimulationResult`.
- Call `sdk.simulateBridgeAndExecute(params)` → `BridgeAndExecuteSimulationResult`.
- Use simulation to show fees and gas before execution.
- Expect `BridgeAndExecuteSimulationResult.bridgeSimulation` to be `null` if bridge is skipped.

## Compute max bridgeable amount
- Call `sdk.calculateMaxForBridge({ toTokenSymbol, toChainId, recipient?, sources? })`.
- Use `BridgeMaxResult` to set “max” or validate input.

## Convert amounts to bigint
- Use `sdk.convertTokenReadableAmountToBigInt(amountString, tokenSymbol, chainId)`.
- Or use `sdk.utils.parseUnits(value, decimals)` if decimals are known.

## Attach hooks and events
- Attach intent and allowance hooks before calling bridge flows.
- Use `NEXUS_EVENTS.STEPS_LIST` and `NEXUS_EVENTS.STEP_COMPLETE` for progress UI.

## Handle common failures
- On throw, clear intent/allowance refs and reset UI state.
- On user cancel, call `deny()` on the active hook and abort.
