# NexusWidget observability

NexusWidget swap, send and deposit modes share an attempt publisher supporting
all four spec records: `widget_attempt_started`, `widget_sdk_result`,
`widget_attempt_committed` and `widget_attempt_outcome`. Records go to PostHog and
correlated OTLP/HTTP JSON logs in SigNoz. Commitment/outcome emission requires the
evidence described below; final success is not inferred from an SDK return.
The npm package and shadcn registry use the same implementation. Collection is
limited to mounted NexusWidgets; the provider subscription does not export
standalone provider or legacy component observations.

## Configuration

```tsx
<NexusProvider
  config={{
    identity: { clientId: "YOUR_ALLOCATED_NEXUS_CLIENT_ID" },
    observability: { environment: "production" },
  }}
>
  <NexusWidget config={{ mode: "swap" }} />
</NexusProvider>
```

Supply a Nexus-allocated client ID once. It maps to `nexus.client.id` in both
collectors. No hostname, wallet or random ID substitutes for client identity.
Missing/invalid IDs suppress widget telemetry without blocking transactions.
The current ID syntax accepts 1–100 letters, digits, dots, underscores or hyphens,
starting with a letter or digit; full wallet addresses are rejected. Allocation
and server registry validation are separate dependencies.

| Provider observability option | Default | Meaning |
| --- | --- | --- |
| `disableLogging` | `false` | Stops widget collection, queued exports and `onRecord`; aborts outstanding exports. Core SDK analytics remains independent. |
| `mode` | `"auto"` | Auto suppresses SSR, development/tests, non-production labels and local hosts. `"on"` allows intentional browser verification; `"off"` disables widget telemetry. |
| `environment` | Production build detection | Explicit production label is needed in environments without `process.env.NODE_ENV` (for example some Vite builds). Use `mode: "on"` for staging verification. |
| `includeWalletHint` | `true` | Lowercase `first5.....last5` without `0x`. `false` removes it from every widget export and callback. |
| `includeAmounts` | `false` | Include `estimatedValueUsd` supplied by the trusted publisher for completed outcomes. No amounts are collected from form inputs or SDK payloads. |
| `posthog.apiKey` | Public Fast Bridge capture token | Optional public project token override. Never supply a personal API key. |
| `posthog.apiHost` | `https://us.i.posthog.com` | Optional collector base URL; `/batch/` is appended. An HTTPS URL or same-origin path is accepted. |
| `signoz.logsUrl` | `https://otel2.avail.so/v1/logs` | Optional full HTTPS/same-origin OTLP logs endpoint. |
| `onRecord` | None | Receives the same sanitized summary as PostHog. Exceptions cannot block the operation. |
| `subscribeToAttemptEvidence` | None | Optional trusted backend adapter, invoked once per attempt. Returns cleanup; never receives raw wallets/signatures. Keep its function identity stable across renders. |

```tsx
// Can change at runtime without recreating the wallet SDK.
<NexusProvider config={{
  identity: { clientId: "YOUR_ALLOCATED_NEXUS_CLIENT_ID" },
  observability: { disableLogging: true },
}}>{children}</NexusProvider>
```

`disableLogging: true` wins over `mode: "on"`. Accepted network requests cannot
be retracted; the switch clears unsent records, cancels outstanding requests
where possible and suppresses pending SDK observations. Disabling widget logging
does not remove identity from configuration or disable Core SDK analytics. Both
Core SDK analytics and its upstream OTel logger remain outside the widget logging
switch; this provider preserves the SDK's existing analytics defaults. Transaction callbacks such as `onComplete`,
`onError` and `onStart` retain their existing behavior and are not analytics
callbacks. There are no global console, request, DOM or SDK progress interceptors.

The PostHog proxy is deferred per the implementation discussion. Both collectors
currently receive browser requests directly; integrators need no collector
environment variables. Direct ingestion can still be blocked by Brave/adblockers.
Allow the configured collector URLs in CSP `connect-src`; collector CORS and
collector-side IP/access-log retention remain deployment responsibilities.

## Repository demo

The showcase uses the client ID `avail-widgets`. To override it for another
deployment, set `NEXT_PUBLIC_NEXUS_CLIENT_ID` before the Next.js build. This
default belongs only to the showcase; npm/shadcn consumers receive no default
client ID. Set
`NEXT_PUBLIC_NEXUS_WIDGET_DISABLE_LOGGING=true` to opt the demo out at build time.
These are demo identity/preference settings; npm/shadcn integrators pass provider
config directly and do not need environment variables.

## Browser measurements and boundaries

- A widget mints `attempt_id` at its first SDK request for a quote/conditional
  swap. Requotes, source changes and recipient execution retain it. Automatic
  denial of an obsolete quote is suppressed from both collectors and `onRecord`.
  Input/source changes and replacement quotes mark the old run before `deny()`;
  stale callbacks and in-flight refresh results cannot publish failure or cancellation
  records. Genuine current quote/refresh errors and accepted execution errors remain
  observable. Explicit user rejection still has its browser-owned outcome.
- A usable quote is recorded once when the accepted `onIntent` callback returns
  a renderable quote. Refresh calls are timed separately. A skipped swap without
  a quote hook does not create a successful quote sample.
- Execution duration starts when the widget invokes the quote's `allow()` and
  ends at the SDK result. This excludes preview dwell. If the SDK skips the hook,
  execution duration covers the whole observed SDK call. A subsequent `execute`
  call gets its own SDK result under the same attempt.
- Initialization, wallet-provider setup and actual bridge/swap balance reads
  are observed at the provider's SDK call boundary while a widget subscribes.
  Read-only initialization and wallet attachment reuse one SDK per provider.
  Setup and concurrent refreshes share in-flight balance reads by SDK, account and
  balance kind; later manual/post-transaction refreshes perform a fresh read.
  Calls before the first quote omit `attempt_id`; they carry session/client/mode
  context. Swallowed provider balance errors are still recorded as failed reads.
- Each record has one UUID `eventId`, reused across collectors and retries,
  plus timestamp, schema version, session, environment, client, surface and mode.
  Validated execution/destination transaction hashes from SDK results appear only
  in SigNoz diagnostics. A returned hash does not establish final delivery.
  Sessions are in memory per mounted widget; there are no tracking cookies,
  localStorage identifiers, person profiles or pageview events.
- Quote errors do not rotate attempts. An explicit UI reset/new flow creates a
  fresh attempt at its next quote. A browser success/failure screen is not a
  canonical outcome. A retry after a published terminal outcome includes
  `previous_attempt_id`; unknown outcomes never become retry predecessors.
  Late results keep their original attempt context.
- The only exported errors are allowlisted SDK codes (diagnostics), known service
  labels and `reason: "unknown"`. The approved Reason taxonomy is not agreed.
  Full wallets/recipients, signatures, calldata, credentials, raw errors, balances,
  fees and arbitrary metadata never enter the widget export queue. The only
  supported monetary field is publisher-supplied estimated USD on a completed
  outcome, gated by `includeAmounts: true` and labelled `valueIsEstimated`.

## Commitment and outcomes

| Evidence | Export |
| --- | --- |
| Known ERC20-only plan and `request_signing/completed` or `bridge_intent_submission/completed`, with a public intent hash | One `widget_attempt_committed`, boundary `erc20_intent_signature` |
| Native `bridge_deposit/submitted` or native/local-wallet `vault_deposit/submitted`, with a public transaction hash | One `widget_attempt_committed`, boundary `native_deposit_submission` |
| Explicit preview rejection before execution | One browser-owned `widget_attempt_outcome`, `outcome: "rejected"`, `committed: false` |
| Explicit widget cancel/close before execution | One browser-owned outcome, `outcome: "stopped"`, `committed: false` |
| Known signature/allowance denial at the corresponding pre-commit step, or native deposit prompt denial before submission | Browser-owned `stopped`, not platform failure |
| Matching trusted backend evidence for the final requested result | One authoritative `completed` or `failed` outcome |

Without a backend adapter, SDK commitment evidence has `evidenceSource: "sdk"`,
`publicationSource: "browser"`, `authoritative: false` and
`commitmentTimeBasis: "observed"`. Its timestamp is when the browser observed the
signal, not a fabricated signature time. Native-only or mixed plans do not commit
on signature/submission alone: the native deposit can still be denied at the next
wallet prompt. Incomplete plans remain unknown. Pure same-chain operations can
lack either contract commitment boundary and therefore remain unknown unless the
backend supplies its commitment state.

Preview confirmation, approval transactions, source transfers, individual bridge
fills, generic SDK success, raw errors, timeouts and browser closure never publish
final completion/failure. No general UI/progress events were added. Explicit
rejection is distinguished from automatic denial of stale quotes and editing/back
navigation, which retain the attempt. Rejections after known commitment remain
SDK call cancellations until authoritative outcome evidence arrives.

When a backend adapter is configured, local SDK evidence still guards against
incorrect pre-commitment outcomes, but only the backend's commitment record is
exported. This avoids publishing provisional and canonical copies for one attempt.
Final records preserve the publisher's UUID/time. Repeated commitment/outcome
notifications are deduplicated per attempt; a delayed commitment record can follow
an already-received committed outcome. Public lookup hashes accompany commitment
and outcome records in both sinks. Ordinary SDK-result lookup hashes remain
SigNoz-only.

### Backend adapter contract

`subscribeToAttemptEvidence(context, report)` is an explicit **widget integration
extension**, not an existing Core 2.4.1 API or a deployed backend service. The
context contains the client ID, attempt ID, anonymous session, mode, environment
and surface. The integration must subscribe to an authenticated/trusted publisher
that persists these joins and determines the final result. Only pass verified
publisher records to `report`; setting an authority string is not verification.
There is no default endpoint, polling, global fetch interceptor or inferred SDK
context forwarding.

```tsx
import type { WidgetAttemptEvidenceSubscriber } from "@avail-project/widgets";

// Supply your own implementation once the backend publisher exists.
const subscribeToAttemptEvidence: WidgetAttemptEvidenceSubscriber = (context, report) => {
  const unsubscribe = trustedPublisher.subscribe(context.attempt_id, (record) => {
    // record must match WidgetAttemptEvidence, including the canonical eventId,
    // occurredAt, authority and final_requested_result scope for outcomes.
    report(record);
  });
  return unsubscribe;
};
```

`trustedPublisher` above is a placeholder for the backend integration, not an
exported SDK object. Supply this stable function in provider `observability`.
The evidence union is exported by npm and included in the shadcn provider source.
Its validation rejects mismatched attempts, malformed IDs/times/hashes, authority values other than middleware/protocol
and intermediate-result scope. A terminal failed
outcome comes only from this adapter; call-level failures cannot create one.
Optional provider (`nexus`/`mayan`), known service, commit-to-delivery duration and
opt-in estimated USD are accepted. Approved Reason and paired-route mapping remain
pending.

The adapter can report outcomes for an earlier unresolved attempt while the
widget stays mounted, including after a new form attempt begins. Opt-out,
identity/privacy changes, unmount and eviction of the oldest of 100 retained
attempts invoke its cleanup and suppress late callbacks. Cleanup must stop its
subscription; backend-owned analytics preference propagation still needs the
agreed backend API. A real backend publisher must continue after browser closure
and export independently. This browser adapter alone cannot satisfy that part of
Q1/Q7. If that backend also exports directly, it must reuse the canonical event IDs
and deduplicate sink copies; this package does not provide global server deduplication.

## Coverage and remaining integration work

| Question | Available now | Still required |
| --- | --- | --- |
| Q1 reliability | Browser commitment evidence and pre-commit stops/rejections; authoritative records when an adapter supplies them | Deployed canonical publisher, persistence and browser-closure delivery |
| Q2 integrators | Widget attempts grouped by client ID and mode | API-only records and registry validation |
| Q3 trouble | SDK results and browser stops/rejections by client | Backend final-outcome coverage |
| Q4 volume | Completed count and opt-in estimated USD from an attached trusted publisher | Deployed publisher, paired routes and opt-in coverage dashboards |
| Q5 failures | SDK code diagnostics, known service, call phase | Approved Reason mapping, safe requested route, authoritative final route/provider |
| Q6 latency | Browser call durations; publisher-supplied commit-to-delivery duration | Server latency instruments and deployed publisher |
| Q7 support | Wallet hint + time, session, attempt, correlated event IDs and returned execution/destination transaction hashes | Accepted attempt context, intent lookup keys and persisted backend timeline |

Core 2.4.1 exposes progress evidence but neither the agreed attempt-context API
nor a canonical publisher integration. This implementation does not use SDK internals,
add identity HTTP headers, change signed payloads or synthesize that support.
Next steps require agreed surface values (currently declared `nexus-widget`),
identity/header forwarding, accepted attempt IDs across all legs, canonical
persistence/deduplication, final recipient/destination delivery and logging-preference
propagation. Backend
identity enforcement, dashboards, server metrics and end-to-end browser-closure
acceptance are not implemented here. Schema `1` observations must not be mixed
with the removed `deposit_*` widget funnel history.

Transport is best effort: at most 100 queued records, batches of 20, 500 ms initial
flush delay, a five-second request timeout and two retries per failed sink. A
successful sink is not retried because the other failed. PostHog receives the
UUID as `uuid`/`$insert_id`; SigNoz queries should deduplicate by `eventId`.
Unmount discards pending exports. Nothing waits for telemetry before proceeding
with a transaction. No live ingestion or wallet transaction is required by tests.

Reference branch: `availproject/nexus-fast-bridge`, `chore/add-signoz`, verified
at `257f685374518b07124286b0b97e8d07247ff8e9`. Only public collector configuration
was reused. Wire formats follow the [PostHog capture API](https://posthog.com/docs/api/capture)
and [OTLP/HTTP JSON specification](https://opentelemetry.io/docs/specs/otlp/).
