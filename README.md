# Nexus One

A unified component for **swap**, **send**, and **deposit** flows powered by [Avail Nexus](https://www.availproject.org/) intents.

> **Network support:** Nexus One currently supports mainnet only. Testnet is not supported at the moment.

## Installation

```bash
npx shadcn@latest add @nexus-elements/nexus-one
```

### Manual Installation

1. Install dependencies:

```bash
npm install @avail-project/nexus-core decimal.js lucide-react viem wagmi class-variance-authority clsx tailwind-merge
```

2. Copy the component source code into your project.
3. Update import paths to match your project setup.

## Setup

Wrap your app with `NexusProvider` before rendering `NexusOne`.

```tsx
import { NexusProvider } from "@/components/nexus/NexusProvider";

export default function RootLayout({ children }) {
  return <NexusProvider>{children}</NexusProvider>;
}
```

## Examples

### Swap

Swap between any supported token pairs across chains. Nexus One switches between exact-in and exact-out quoting based on which amount field the user changes.

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";

export function SwapExample({ address }: { address?: `0x${string}` }) {
  return (
    <NexusOne
      config={{
        mode: "swap",
        prefill: {
          source: {
            token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            chain: 42161, // USDC on Arbitrum
          },
          destination: {
            token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            chain: 8453, // USDC on Base
          },
        },
      }}
      connectedAddress={address}
    />
  );
}
```

### Send

Cross-chain send flow. Users choose the token and amount to send, then Nexus resolves the pay-with sources.

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";

export function SendExample({ address }: { address?: `0x${string}` }) {
  return (
    <NexusOne
      config={{
        mode: "send",
        prefill: {
          token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          chain: 8453, // USDC on Base
          amount: "0.1",
          recipient: "0xF3a15b38e63dBb1a1b2d7842CcD9B9dD8fB9b2E",
        },
      }}
      connectedAddress={address}
    />
  );
}
```

### Deposit

Deposit into a configured protocol or app action with a single intent. A single `deposit` config is required when `mode` is `"deposit"`.

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";
import { encodeFunctionData } from "viem";

const APP_DEPOSIT_CONTRACT = "0x...";
const DESTINATION_TOKEN = "0x...";

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

function buildDepositExecuteConfig(
  tokenAddress: `0x${string}`,
  amount: bigint,
  user: `0x${string}`,
) {
  return {
    to: APP_DEPOSIT_CONTRACT,
    data: encodeFunctionData({
      abi: APP_DEPOSIT_ABI,
      functionName: "deposit",
      args: [tokenAddress, amount, user],
      // Aave reference: supply(asset, amount, onBehalfOf, referralCode)
    }),
    tokenApproval: {
      token: tokenAddress,
      amount,
      spender: APP_DEPOSIT_CONTRACT,
    },
  };
}

<NexusOne
  config={{
    mode: "deposit",
    deposit: {
      chainId: 42161,
      tokenSymbol: "USDT",
      tokenDecimals: 6,
      tokenAddress: DESTINATION_TOKEN,
      title: "Your App",
      protocol: "Your App",
      executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) =>
        buildDepositExecuteConfig(tokenAddress, amount, user),
    },
  }}
  connectedAddress={address}
/>;
```

### With Callbacks

Use lifecycle callbacks to integrate with your app's toast, analytics, or navigation.

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";

export function SwapWithCallbacks({ address }: { address?: `0x${string}` }) {
  return (
    <NexusOne
      config={{ mode: "swap" }}
      connectedAddress={address}
      onStart={() => console.log("Transaction started")}
      onComplete={(explorerUrl) => {
        console.log("Transaction complete:", explorerUrl);
      }}
      onError={(message) => {
        console.error("Transaction failed:", message);
      }}
    />
  );
}
```

### Restricted Token Pairs

Limit which source or destination tokens users can select.

```tsx
import { NexusOne } from "@/components/nexus-one/nexus-one";

export function RestrictedSwap({ address }: { address?: `0x${string}` }) {
  return (
    <NexusOne
      config={{
        mode: "swap",
        allowedSourcePairs: [
          { token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", chain: 42161 }, // USDC on Arbitrum
          { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: 8453 }, // USDC on Base
        ],
        allowedDestinationPairs: [
          { token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", chain: 42161 }, // USDT on Arbitrum
        ],
      }}
      connectedAddress={address}
    />
  );
}
```

## Configuration

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `config` | `object` | ✅ | Selects the workflow and any mode-specific behavior. |
| `connectedAddress` | `` `0x${string}` `` | | Wallet address. Falls back to connected wagmi account. |
| `embed` | `boolean` | | Defaults to `true`. Set `false` for modal rendering. |
| `open`, `onOpenChange`, `defaultOpen` | modal controls | | Control modal rendering when `embed={false}`. |
| `onComplete` | `(explorerUrl?: string) => void` | | Called on success. |
| `onStart` | `() => void` | | Called when execution begins. |
| `onError` | `(message: string) => void` | | Called on failure. |
| `onClose` | `() => void` | | Close button handler (modal mode only). |
| `onConnectWallet` | `() => void \| Promise<void>` | | Called when the internal Connect Wallet CTA is clicked. Wire this to your app-level wallet flow. |

### Config Options

| Field | Type | Notes |
| --- | --- | --- |
| `mode` | `"swap" \| "send" \| "deposit"` | **Required.** Selects the active flow. |
| `prefill.amount` | `string` | Prefills the amount input. |
| `prefill.recipient` | `` `0x${string}` `` | Prefills recipient (send mode). |
| `prefill.token` | `` `0x${string}` `` | Prefills token address. |
| `prefill.chain` | `number` | Prefills chain id. |
| `prefill.source` | `{ token; chain }` | Prefills source token and chain. |
| `prefill.destination` | `{ token; chain }` | Prefills destination token and chain. |
| `allowedSourcePairs` | `{ token; chain }[]` | Restricts selectable source pairs. |
| `allowedDestinationPairs` | `{ token; chain }[]` | Restricts selectable destination pairs. |
| `deposit` | `object` | Required for deposit mode. |

## References

- [Avail Nexus Documentation](https://docs.availproject.org/)
- [shadcn Registry](https://ui.shadcn.com/docs/registry/getting-started)
