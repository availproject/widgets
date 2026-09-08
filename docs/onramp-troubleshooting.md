# Onramp + Deposit diagnostics (2.1.0-rc.1)

Both package manifests and the shadcn registry pin `@avail-project/nexus-core` to `2.4.1`.

## Fixed failure paths

- Next.js needs literal `process.env.NEXT_PUBLIC_…` references to inline browser configuration. The previous dynamic lookup could miss the configured production environment, infer sandbox from the canary proxy URL, and report deposit success when a cached balance was missing or small. The sandbox success shortcut has been removed. Success requires a successful deposit receipt in every environment.
- Both middleware session responses (`sessionId`, `state`, `transaction`) and Meld responses (`transaction.status`, numeric amounts, `cryptoDetails`) are normalized. Provider checkout URLs, quote provider names and route method names support the documented Meld field names too.
- `SETTLED` means the purchase is complete. It triggers the deposit once the funded wallet is connected; it no longer means the whole flow succeeded. The actual received amount comes from the transaction, not the earlier quote. The wallet balance is checked immediately, then retried every second up to 60 times before showing a retryable insufficient-balance error (RPC response time can extend the wait). Missing amounts surface a deposit error with a retry action. A disconnected wallet gets a Connect Wallet action while retaining the settled purchase.
- A stored `connectedAddress` is only a display hint for onramp. Connection checks use the active wagmi connector's provider, its connection/session state, `eth_accounts`, `eth_chainId`, and the signing client's account. Disconnected or expired WalletConnect sessions cannot enable Pay. Once a preview quote arrives, disconnected users see Connect Wallet. Reconnecting invalidates the quote, including for the same address, and refreshes it for the verified account before enabling Pay. A final provider check runs before session creation and each deposit signing step.
- Wallet checks have an eight-second timeout, listen for provider connection/account/session events, and refresh on focus, visibility, reconnect, and a five-second interval without overlapping checks. Unmount removes listeners/timers and ignores late responses. `[Nexus Onramp]` includes `wallet.connection`, `wallet.connect_requested`, `wallet.disconnected`, and `wallet.check_failed`. These checks cannot keep a wallet connected throughout an external checkout; the settled screen offers reconnection if the session drops.
- Popup widgets (`embed={false}`) ignore outside clicks and Escape. The header close button is present even without an `onClose` callback. Existing restrictions on closing during transaction progress still apply.
- Gas and token balances are read again after checkout. A gas swap deducts its spend from this purchase rather than depositing the wallet's entire balance. The intent is denied if its source spend would consume the purchased amount.
- Deposit and approval transaction hashes are retained during this mounted session. Retrying confirmation checks the submitted transaction instead of blindly submitting another. An on-chain revert permits a new attempt.
- Polling uses a single request at a time, requests uncached responses, has a 20-second HTTP deadline, and refreshes immediately on provider return, window focus, visibility restoration or reconnect. Cleanup removes timers/listeners, aborts requests and prevents subsequent deposit submissions from an abandoned flow. RPC fetches have a 15-second deadline. Receipt polling has a two-minute confirmation window.
- The callback page does not claim payment success. Callback messages only request a fresh status check. The UI now asks users to keep the original page open because the final deposit needs their connected wallet. An SDK gas swap or wallet transaction already submitted can still finish after closing the page. There is no durable background deposit worker or notification service in this repository.

## Tester capture

Use the deployed frontend's browser console, enable **Preserve log**, and filter on:

```text
[Nexus Onramp]
```

These logs are always enabled for the onramp component, including production builds. Wallet-funded deposits, sends and ordinary swaps do not call this logger. Logs contain transaction identifiers, wallet addresses and amounts; checkout tokens and URLs are redacted. SDK events are serialized to JSON, including bigint amounts and SDK error context, so console logging does not retain live SDK/client objects.

Expected sequence:

1. `flow.mounted`: proxy URL and resolved onramp environment.
2. Country/options/cache, route and quote API requests, responses and selections.
3. `session.create`, `session.created`, `provider.open`.
4. `poll.status`: session and Meld transaction IDs, previous/new state, raw status, transaction hash, received amount, provider update timestamp and elapsed time. `api.response` includes request duration and exposed cache headers.
5. `provider.return` / `poll.wake` followed by another authoritative status request.
6. `deposit.handoff`, `deposit.amount`, wallet/chain checks, `deposit.balance`, `deposit.gas_check`.
7. When gas is needed: `sdk.swapWithExactOut.start`, `sdk.intent`, every emitted `sdk.event`, and the SDK result/error. The SDK performs the gas swap; approval and final deposit currently use the wallet client directly and therefore emit `wallet.*` diagnostics rather than SDK events.
8. Approval check/prompt/hash/receipt, then `wallet.deposit.prompt`, `wallet.deposit.submitted`, receipt polls, and **`deposit.confirmed`** with the final deposit hash.
9. `ui.state` becomes `DEPOSIT_SUCCESS` only after that receipt. `poll.stop` / `flow.cleanup` show cleanup.

A `deposit.error` preserves error details and any pending deposit hash. If no `deposit.handoff` appears, inspect the last `poll.status`. If the handoff occurs but no deposit hash follows, inspect the balance, gas, SDK and wallet steps. Wallet signature prompts still require the user to approve them.

## When Meld has not settled

Meld documents these as temporary: `PENDING CREATED`, `PENDING`, `SETTLING`, `TWO_FA_REQUIRED`, `TWO_FA_PROVIDED`, `ERROR`, and legacy `ACCEPTED`, `AUTHORIZED`, `PARTIALLY_SETTLED`. `ERROR` can recover; it must not stop polling. The tester must complete outstanding verification in the provider window.

Terminal payment failures are `FAILED`, `DECLINED`, `CANCELLED`, `REFUNDED` and legacy `AUTHORIZATION_EXPIRED`. Only `SETTLED` authorizes the automatic deposit handoff. Receipt of a redirect or an unrelated wallet balance increase does not establish settlement.

If crypto arrives before `poll.status` changes to `SETTLED`, compare the receipt time of the onramp transaction with `api.response` timestamps and the provider's `updatedAt`. The frontend checks every three seconds after each completed request while mounted, plus wake events; a stalled request can add up to its timeout. Background browser throttling can also delay checks. The logs distinguish request latency from a server repeatedly returning an old status. The middleware must not cache transaction/session responses and must consume Meld's transaction webhooks (or otherwise fetch fresh Meld transaction data). Its implementation and the tester's transaction trace were not supplied, so this change does not establish whether Meld, Mercuryo, Banxa or the proxy caused a particular reporting delay.

Meld references: [integration and transaction tracking](https://docs.meld.io/docs/stablecoins/white-label-api-integration/whitelabel-api-guide), [transaction statuses](https://docs.meld.io/docs/stablecoins/for-all-products/transaction-statuses).

## Configuration and verification

Onramp is opt-in for deposit widgets: set `config.enableOnRamp: true`. The default is `false`, which opens the wallet deposit flow without mounting the onramp component. In the deposit showcase, enable the **Onramp** toggle before running a payment test.

```dotenv
NEXT_PUBLIC_NEXUS_ONRAMP_BASE_URL=https://nexus-v2.canary.avail.so/middleware
NEXT_PUBLIC_NEXUS_ONRAMP_ENV=production
```

Rebuild/redeploy after changing public environment variables. A canary Nexus hostname does not identify the Meld sandbox. Even an explicitly configured sandbox cannot fake a successful deposit without a receipt.

```sh
pnpm test:onramp
pnpm exec tsc --noEmit
pnpm build:registry:json
pnpm build:registry
pnpm build:widgets-package
```

The regression suite uses mocked Meld/proxy responses and wallet/RPC calls. It does not charge a card, sign a transaction or test provider webhook delivery. For the RC payment test, keep the page open, approve the wallet prompts, and verify the deposit explorer receipt as well as the provider's onramp receipt. Reload recovery is not automatic; a retained session ID can be inspected with the existing `window.setRampSessionId(id)` helper, but always check already-submitted transactions before attempting recovery after a reload.
