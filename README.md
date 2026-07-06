# Nexus Widget

A unified component for **swap**, **send**, and **deposit** flows powered by [Avail Nexus](https://www.availproject.org/) intents.

> **Migrating from legacy standalone elements?** If you are already using elements like `Swap`, `FastBridge`, `FastTransfer`, or `Deposit`, refer to the [Migration Guide](https://elements.nexus.availproject.org/docs/migration-guide) to upgrade to Nexus Widget.

> **Network support:** Nexus Widget currently supports mainnet only. Testnet is not supported at the moment.

## Installation

```bash
npx shadcn@latest add availproject/widgets/nexus
```

This uses the public GitHub shadcn registry at
`https://github.com/availproject/widgets`. The `@avail-widgets/nexus`
namespace install will be documented after the registry is listed in shadcn.

### Manual Installation

1. Install dependencies:

```bash
npm install @avail-project/nexus-core@2.0.0 decimal.js lucide-react viem wagmi class-variance-authority clsx tailwind-merge
```

2. Copy the component source code into your project.
3. Update import paths to match your project setup.

## Setup

Wrap your app with `NexusProvider` before rendering `NexusWidget`.

```tsx
import { NexusProvider } from "@/components/nexus/NexusProvider";

export default function RootLayout({ children }) {
  return <NexusProvider>{children}</NexusProvider>;
}
```

## Config

NexusWidget supports three public modes: `swap`, `send`, and `deposit`.

- `deposit` requires `destination.chain`, at least one `destination.tokens[]` entry, `depositAddress`, and `executeDeposit`.
- `send` accepts optional `destination`, optional locked `recipientAddress`, optional `prefill.amount`, optional `prefill.token`, and optional `validation`.
- `swap` accepts optional `destination`, optional `prefill.token`, optional `recipientAddress`, and optional `appearance`. Swap amount prefill and validation are intentionally not supported.
- `appearance` supports `heading`, `appName`, `appLogoURL`, `mode: "system" | "light" | "dark"`, and any browser-supported CSS `primaryColor`.
- `onConnectClick` is a component prop, not a config field. Use it to open your app/header wallet modal from the widget CTA.

## Examples

### Swap

Swap between any supported token pairs across chains. Nexus Widget switches between exact-in and exact-out quoting based on which amount field the user changes.

```tsx
import { NexusWidget } from "@/components/nexus/nexus";

export function SwapExample({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
      config={{
        mode: "swap",
        destination: {
          chain: 8453,
          tokens: [
            {
              address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              symbol: "USDC",
              decimals: 6,
            },
          ],
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
import { NexusWidget } from "@/components/nexus/nexus";

export function SendExample({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
      config={{
        mode: "send",
        destination: {
          chain: 8453,
          tokens: [
            {
              address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              symbol: "USDC",
              decimals: 6,
            },
          ],
        },
        recipientAddress: "0xF3a15b38e63dBb1a1b2d7842CcD9B9dD8fB9b2E",
        prefill: {
          amount: "0.1",
        },
        validation: {
          minAmount: "0.01",
          maxAmount: "1000",
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
import { NexusWidget } from "@/components/nexus/nexus";
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
      toTokenAddress: tokenAddress,
      amount,
      spender: APP_DEPOSIT_CONTRACT,
    },
  };
}

<NexusWidget
  config={{
    mode: "deposit",
    destination: {
      chain: 42161,
      tokens: [
        {
          address: DESTINATION_TOKEN,
          symbol: "USDT",
          decimals: 6,
        },
      ],
    },
    depositAddress: APP_DEPOSIT_CONTRACT,
    executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) =>
      buildDepositExecuteConfig(tokenAddress, amount, user),
    prefill: {
      amount: "10",
    },
    validation: {
      minAmount: "1",
      maxAmount: "1000",
    },
    appearance: {
      appName: "Your App",
      heading: "Deposit",
      appLogoURL: "https://example.com/logo.svg",
      mode: "system",
      primaryColor: "#0A6BEB",
    },
  }}
  connectedAddress={address}
/>;
```

### With Callbacks

Use lifecycle callbacks to integrate with your app's toast, analytics, or navigation.

```tsx
import { NexusWidget } from "@/components/nexus/nexus";

export function SwapWithCallbacks({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
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

### Destination Restrictions

Limit which destination chain and token users can select.

```tsx
import { NexusWidget } from "@/components/nexus/nexus";

export function RestrictedSwap({ address }: { address?: `0x${string}` }) {
  return (
    <NexusWidget
      config={{
        mode: "swap",
        destination: {
          chain: 42161,
          tokens: [
            {
              address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
              symbol: "USDT",
              decimals: 6,
            },
          ],
        },
      }}
      connectedAddress={address}
    />
  );
}
```

## Configuration

| Prop                                  | Type                             | Required | Notes                                                                                                  |
| ------------------------------------- | -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `config`                              | `object`                         | Yes      | Selects the workflow and any mode-specific behavior.                                                   |
| `connectedAddress`                    | `` `0x${string}` ``              |          | Wallet address. Falls back to connected wagmi account.                                                 |
| `embed`                               | `boolean`                        |          | Defaults to `true`. Set `false` for modal rendering.                                                   |
| `open`, `onOpenChange`, `defaultOpen` | modal controls                   |          | Control modal rendering when `embed={false}`.                                                          |
| `onComplete`                          | `(explorerUrl?: string) => void` |          | Called on success.                                                                                     |
| `onStart`                             | `() => void`                     |          | Called when execution begins.                                                                          |
| `onError`                             | `(message: string) => void`      |          | Called on failure.                                                                                     |
| `onClose`                             | `() => void`                     |          | Close button handler (modal mode only).                                                                |
| `onConnectClick`                      | `() => void \| Promise<void>`    |          | Called when the internal Connect Wallet CTA is clicked. Use this to open your app/header wallet modal. |
| `onConnectWallet`                     | `() => void \| Promise<void>`    |          | Called when the internal Connect Wallet CTA is clicked. Wire this to your app-level wallet flow.       |

### Config Options

| Field                  | Modes        | Notes                                                                                                                                                    |
| ---------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                 | all          | Required. `"swap"`, `"send"`, or `"deposit"`.                                                                                                            |
| `destination.chain`    | all          | Required for deposit. Optional for send/swap; when supplied, destination chain selection is restricted.                                                  |
| `destination.tokens`   | all          | Required for deposit with at least one token. Optional for send/swap; when supplied with `destination.chain`, destination token selection is restricted. |
| `recipientAddress`     | send/swap    | Prefills the recipient. In send mode, a supplied recipient is locked.                                                                                    |
| `depositAddress`       | deposit      | Required smart contract address for the deposit target.                                                                                                  |
| `executeDeposit`       | deposit      | Required transaction builder: `(tokenSymbol, tokenAddress, amount, chainId, user) => { to, data?, value?, gas?, tokenApproval? }`.                       |
| `prefill.amount`       | deposit/send | Optional amount prefill. Must be greater than `0`.                                                                                                       |
| `prefill.token`        | send/swap    | Optional initial destination/receive token: `{ chain, address, symbol, decimals, logo? }`. Ignored when `destination.tokens` is supplied.                |
| `validation.minAmount` | deposit/send | Optional minimum amount. Must be `0` or greater.                                                                                                         |
| `validation.maxAmount` | deposit/send | Optional maximum amount. Must be greater than `0`.                                                                                                       |
| `appearance`           | all          | Optional app display config: `heading`, `appName`, `appLogoURL`, `mode`, `primaryColor`.                                                                 |

Use `destination.tokens` when you want to restrict selectable destination tokens. Use `prefill.token` when you only want an initial token selected and still want users to choose from the full supported list. If both are supplied, `destination.tokens[0]` is honored and `prefill.token` is ignored.

## References

- [Avail Nexus Documentation](https://docs.availproject.org/)
- [shadcn Registry](https://ui.shadcn.com/docs/registry/getting-started)
