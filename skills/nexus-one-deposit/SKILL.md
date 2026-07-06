---
name: nexus-one-deposit
description: Scaffolding, configuration, and integration of the Nexus One component in deposit mode (config.mode = "deposit"). Handles swapping assets and executing custom smart contract calls on the destination chain.
---

# Nexus One - Protocol Deposits

Use the **Nexus One** component with `config.mode = "deposit"` to allow users to pay for a smart contract execution/deposit on a destination chain with assets from any source chain. Nexus One resolves pay-with assets, handles the cross-chain swap, and executes your custom deposit payload in a single flow.

## 1. Installation

Install dependencies and the component via the shadcn CLI:

```bash
npx shadcn@latest add availproject/widgets/nexus
```

Make sure peer dependencies are installed:
```bash
npm install @avail-project/nexus-core@1.6.0 decimal.js lucide-react viem wagmi class-variance-authority clsx tailwind-merge
```

## 2. Basic Setup

Wrap the component with `NexusProvider` (usually in your root layout or app provider stack). In `"deposit"` mode, the `deposit` object is **required** inside the config.

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";
import { encodeFunctionData } from "viem";

export function DepositWidget({ address }: { address?: `0x${string}` }) {
  // Define destination contract details and ABI
  const APP_DEPOSIT_CONTRACT = "0xYourDepositContractAddress";
  const DESTINATION_TOKEN = "0xUSDTBaseAddress";

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

  // Transaction builder function executed post-swap settlement
  function buildDepositExecuteConfig(
    tokenAddress: `0x${string}`,
    amount: bigint,
    user: `0x${string}`
  ) {
    return {
      to: APP_DEPOSIT_CONTRACT,
      data: encodeFunctionData({
        abi: APP_DEPOSIT_ABI,
        functionName: "deposit",
        args: [tokenAddress, amount, user],
      }),
      tokenApproval: {
        token: tokenAddress,
        amount,
        spender: APP_DEPOSIT_CONTRACT,
      },
    };
  }

  const depositConfig = {
    mode: "deposit",
    deposit: {
      chainId: 8453,                 // Destination Chain ID (e.g. Base)
      tokenSymbol: "USDT",           // Destination Token Symbol
      tokenDecimals: 6,              // Destination Token Decimals
      tokenAddress: DESTINATION_TOKEN,
      title: "MyProtocol",           // Name of your application/action
      protocol: "MyProtocol",
      executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) =>
        buildDepositExecuteConfig(tokenAddress, amount, user),
    },
  } as const;

  return <NexusOne config={depositConfig} connectedAddress={address} />;
}
```

## 3. Prefilling and Restricting Inputs

- **Prefill Amount:** Use `prefill.amount` to prefill the exact output deposit amount.
- **Restrict Pay-with Sources:** Use `allowedSourcePairs` to restrict which source assets are displayed as deposit payment options.

```tsx
const depositConfig = {
  mode: "deposit",
  prefill: {
    amount: "150.0", // Pre-populate deposit field with 150 USDT
  },
  allowedSourcePairs: [
    { token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", chain: 42161 }, // USDC on Arbitrum
    { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: 8453 },   // USDC on Base
  ],
  deposit: {
    // ... mandatory deposit configuration
  }
};
```

## 4. Callbacks

Leverage standard callbacks to manage your app's flow:

```tsx
<NexusOne
  config={depositConfig}
  connectedAddress={address}
  onStart={() => console.log("Deposit started")}
  onComplete={(explorerUrl) => console.log("Deposit succeeded!", explorerUrl)}
  onError={(err) => console.error("Deposit failed:", err)}
/>
```
