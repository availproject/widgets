# @avail-project/widgets

Public npm distribution for Avail widgets.

Install from npm:

```bash
pnpm add @avail-project/widgets
```

For internal GitHub installs, the package runs its `prepare` script and builds `dist` after clone:

```bash
pnpm add github:availproject/widgets
```

```tsx
import { NexusProvider, NexusWidget } from "@avail-project/widgets";
import "@avail-project/widgets/styles.css";

export function App() {
  return (
    <NexusProvider config={{ network: "mainnet", debug: false }}>
      <NexusWidget config={{ mode: "swap" }} />
    </NexusProvider>
  );
}
```

The shadcn registry remains the open source code-install path. Until the
namespace is listed in shadcn, install with:

```bash
npx shadcn@latest add availproject/widgets/nexus
```

## Onramp + Deposit diagnostics

For `config.mode: "deposit"`, set `config.enableOnRamp: true` to offer local currency funding. It defaults to `false`, which opens the wallet deposit flow directly. The deposit showcase includes an Onramp toggle for both settings.

Onramp checks the active wallet provider instead of trusting a persisted address. Disconnected users see Connect Wallet after quotes arrive; reconnecting refreshes the quote for the verified account before Pay is enabled. If the wallet disconnects during checkout, reconnect the funded wallet from the settled purchase screen to finish the deposit. Popup widgets (`embed={false}`) dismiss through the header close button, not outside clicks or Escape.

Version `2.1.0` uses Nexus Core `2.5.0`. Filter the browser console by `[Nexus Onramp]` to trace payment status, SDK gas-swap events, wallet approval and the final deposit receipt. Keep the page open and approve the wallet prompts. See [onramp troubleshooting](../../docs/onramp-troubleshooting.md) in the source repository for configuration, failure cases and testing.

## Widget observability

### Upgrading an existing integration

`config.identity.clientId` is new and optional for widget operation, but required
for the four widget telemetry records. Upgrading without it keeps transactions
working and sends no new widget telemetry, including when `observability.mode`
is `"on"`. Core SDK analytics remains enabled independently. The previous
`deposit_*` widget events are replaced by this telemetry and are not a fallback.

Before enabling collection, arrange one stable client ID per integrating app with
the Nexus team and add it once to the provider config. Early IDs can be allocated
manually; this package does not include an allocation service or server registry
validation. A client ID identifies the integrating app, not an end user or wallet.
Do not ship the placeholder below. Integrations that do not want widget tracking
can leave identity unset or explicitly set `observability.disableLogging: true`.

Both npm and shadcn installations support the same provider configuration:

```tsx
<NexusProvider config={{
  identity: { clientId: "YOUR_ALLOCATED_NEXUS_CLIENT_ID" },
  observability: { environment: "production" },
}}>
  <NexusWidget config={{ mode: "swap" }} />
</NexusProvider>
```

Production browsers send attempt starts, SDK results, evidence-backed commitment
and browser pre-commitment stopped/rejected outcomes to PostHog and SigNoz. Set `observability.disableLogging: true` to stop widget tracking,
clear queued widget exports. Core SDK analytics remains enabled independently. Missing client IDs,
SSR, development and tests suppress widget collection by default. For intentional
browser verification, use `observability: { mode: "on", environment: "test" }`.
Set `includeWalletHint: false` to omit truncated wallet hints. Full wallet addresses,
raw errors, signatures and fees are excluded; estimated USD requires explicit opt-in. Transaction callbacks are
unchanged; SDK-owned upstream OTel logs remain outside widget scope.

Failed SDK calls include allowlisted `sdkCode`, a classified `reason`, a fixed
`errorSummary` and known service/step/chain context in both collectors. Known SDK
templates distinguish unavailable destination quotes from generic quote failures.
Raw error messages and payloads are excluded; unrecognized errors remain unknown.

The PostHog proxy is deferred; ingestion currently goes directly to PostHog.
SDK commitment signals are explicitly labelled browser-observed. The optional
`subscribeToAttemptEvidence` adapter accepts trusted canonical commitment and final
completed/failed outcomes; no backend is installed by default. SDK success, bridge
fill and timeout never imply terminal outcomes. `includeAmounts: true` permits
publisher-supplied estimated USD on completed outcomes. Core SDK analytics stays
independent of the widget opt-out.

See [observability configuration and coverage](https://github.com/availproject/widgets/blob/main/docs/widget-observability.md)
for collector overrides, privacy, event definitions and remaining backend work.

