---
name: nexus-widget-deposit
description: Scaffolding, configuration, and integration of the Nexus Widget component in deposit mode (config.mode = "deposit"). Handles swapping assets and executing custom smart contract calls on the destination chain.
---

# Nexus Widget - Protocol Deposits

Use `NexusWidget` with `config.mode = "deposit"` when the app owns the final smart-contract action. Nexus routes funds into one configured destination token/chain and then calls `executeDeposit`.

## Installation

```bash
npx shadcn@latest add @avail-widgets/nexus
```

```bash
npm install @avail-project/nexus-core@2.0.0 decimal.js lucide-react viem wagmi class-variance-authority clsx tailwind-merge
```

## Config Shape

Deposit config requires:

- `destination.chain`: supported destination chain id. This is fixed in the UI.
- `destination.tokens`: one or more accepted destination tokens. The token selector is limited to this list.
- `depositAddress`: smart contract address for the destination action.
- `executeDeposit`: transaction builder called as `(tokenSymbol, tokenAddress, amount, chainId, user)`.
- Optional `prefill.amount`, `validation.minAmount`, `validation.maxAmount`, and `appearance`.

```tsx
import { NexusWidget } from "@/components/nexus/nexus";
import { encodeFunctionData } from "viem";

const DEPOSIT_CONTRACT = "0xYourDepositContract" as const;
const USDT = "0xYourDestinationToken" as const;

const ABI = [
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
          chain: 42161,
          tokens: [
            {
              address: USDT,
              symbol: "USDT",
              decimals: 6,
              logo: "https://example.com/usdt.svg",
            },
          ],
        },
        depositAddress: DEPOSIT_CONTRACT,
        executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) => ({
          to: DEPOSIT_CONTRACT,
          data: encodeFunctionData({
            abi: ABI,
            functionName: "deposit",
            args: [tokenAddress, amount, user],
          }),
          tokenApproval: {
            toTokenAddress: tokenAddress,
            amount,
            spender: DEPOSIT_CONTRACT,
          },
        }),
        prefill: { amount: "10" },
        validation: { minAmount: "1", maxAmount: "1000" },
        appearance: {
          heading: "Deposit",
          appName: "MyProtocol",
          appLogoURL: "https://example.com/logo.svg",
          mode: "system",
          primaryColor: "#0A6BEB",
        },
      }}
    />
  );
}
```

## Notes

- Do not use the old `deposit`, `amountInput`, `allowedSourcePairs`, or `destination.type` config fields.
- `prefill.amount` must be greater than `0`.
- `validation.minAmount` must be `0` or greater; `validation.maxAmount` must be greater than `0`.
- `appearance.primaryColor` accepts any valid CSS color; the widget chooses readable CTA text automatically.
- Use the component prop `onConnectClick` to open the host app wallet modal.
