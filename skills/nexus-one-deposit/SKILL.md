---
name: nexus-one-deposit
description: Scaffolding, configuration, and integration of NexusWidget in deposit mode (config.mode = "deposit"). Handles swapping assets and executing custom smart contract calls on the destination chain.
---

# Nexus Widget - Protocol Deposits

Use `NexusWidget` with `config.mode = "deposit"` when the app owns the final smart-contract action.

For deposit config generation, use the [Avail Configurator](https://configurator.availproject.org/) to generate the exact `depositConfig` object based on your contract and token setup.

## Installation

**npm (recommended):**
```bash
npm install @avail-project/widgets viem wagmi @tanstack/react-query
```

**shadcn (source files):**
```bash
npx shadcn@latest add availproject/widgets/nexus
```

## Basic Setup

```tsx
// npm:
import { NexusWidget } from "@avail-project/widgets";
import { encodeFunctionData } from "viem";
// shadcn: import { NexusWidget } from "@/components/nexus/nexus";

const APP_DEPOSIT_CONTRACT = "0xYourDepositContractAddress" as const;
const DESTINATION_TOKEN = "0xYourDestinationTokenAddress" as const;

const APP_DEPOSIT_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "user", type: "address" },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function DepositWidget({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
      connectedAddress={address}
      config={{
        mode: "deposit",
        destination: {
          chain: 8453,            // Destination chain ID
          tokens: [
            {
              address: DESTINATION_TOKEN,
              symbol: "USDT",
              decimals: 6,
            },
          ],
        },
        depositAddress: APP_DEPOSIT_CONTRACT,
        executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) => ({
          to: APP_DEPOSIT_CONTRACT,
          gas: 400_000n,          // Required: positive bigint
          data: encodeFunctionData({
            abi: APP_DEPOSIT_ABI,
            functionName: "deposit",
            args: [tokenAddress, amount, user],
          }),
          tokenApproval: {
            toTokenAddress: tokenAddress,
            amount,
            spender: APP_DEPOSIT_CONTRACT,
          },
        }),
        prefill: { amount: "150.0" },
        validation: { minAmount: "1", maxAmount: "1000" },
        appearance: {
          appName: "MyProtocol",
          heading: "Deposit",
          mode: "system",
          primaryColor: "#0A6BEB",
        },
      }}
    />
  );
}
```

## Callbacks

```tsx
<NexusWidget
  config={depositConfig}
  connectedAddress={address}
  onStart={() => console.log("Deposit started")}
  onComplete={(explorerUrl) => console.log("Deposit succeeded!", explorerUrl)}
  onError={(err) => console.error("Deposit failed:", err)}
  onConnectClick={() => openWalletModal()}
/>
```

## Notes

- Do not use the old `deposit.chainId/tokenSymbol/tokenAddress/title` shape — use `destination`, `depositAddress`, and `executeDeposit` instead.
- `gas` inside `executeDeposit` return is **required** as a positive `bigint`.
- `prefill.amount` must be greater than `0`.
- Do not use `allowedSourcePairs` — not supported in current API.
- `appearance.primaryColor` accepts any valid CSS color.
