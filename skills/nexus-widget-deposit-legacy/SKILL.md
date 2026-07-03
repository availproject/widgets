---
name: nexus-widget-deposit
description: Legacy alias for Nexus Widget deposit guidance. Prefer nexus-widget-deposit.
---

# Nexus Widget - Protocol Deposits

Use `NexusWidget` with `config.mode = "deposit"` when the app owns the final smart-contract action. Nexus routes funds into one configured destination token/chain and then calls `executeDeposit`.

Required config:

- `destination.chain`
- `destination.tokens` with at least one `{ address, symbol, decimals, logo? }`
- `depositAddress`
- `executeDeposit`

```tsx
<NexusWidget
  config={{
    mode: "deposit",
    destination: {
      chain: 42161,
      tokens: [
        {
          address: "0xDestinationToken",
          symbol: "USDT",
          decimals: 6,
        },
      ],
    },
    depositAddress: "0xDepositContract",
    executeDeposit: (_symbol, tokenAddress, amount, _chainId, user) => ({
      to: "0xDepositContract",
      data,
      tokenApproval: {
        toTokenAddress: tokenAddress,
        amount,
        spender: "0xDepositContract",
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
  onConnectClick={openWalletModal}
/>
```

Do not use the old `deposit`, `amountInput`, `allowedSourcePairs`, or `destination.type` config fields.
