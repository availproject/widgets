import type { WidgetAttemptContext, WidgetAttemptEvidence, WidgetAttemptEvidenceSubscriber, WidgetTelemetryEventName } from "../nexus/widget-observability";

type Fields = Record<string, unknown>;
type Stamp = { eventId: string; timestamp: number };
const HASH = /^0x[0-9a-f]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NATIVE = new Set(["0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", "0x0000000000000000000000000000000000000000"]);
const object = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" ? value as Record<string, unknown> : undefined;
const isHash = (value: unknown): value is string => typeof value === "string" && HASH.test(value);

/** One publisher per attempt. SDK observations cannot publish completed/failed outcomes. */
export function createWidgetAttemptPublisher(options: {
  context: WidgetAttemptContext;
  now: () => number;
  publish: (event: WidgetTelemetryEventName, fields: Fields, stamp?: Stamp) => void;
  subscribe?: WidgetAttemptEvidenceSubscriber;
}) {
  let active = true;
  let committed = false;
  let commitmentPublished = false;
  let terminal = false;
  let executionStarted = false;
  let unsubscribe: void | (() => void);
  let depositKinds: Array<"native" | "erc20" | "unknown"> = [];
  const canonicalEventIds = new Set<string>();
  let lastStep: string | undefined;
  let lastNativeDeposit = false;
  let irreversibleActivity = false;
  const publish = (event: WidgetTelemetryEventName, fields: Fields, stamp?: Stamp) => {
    if (!active) return;
    try { options.publish(event, fields, stamp); } catch { /* analytics never controls transactions */ }
  };
  const localCommit = (boundary: "erc20_intent_signature" | "native_deposit_submission", fields: Fields, signal: string) => {
    if (!active || terminal || committed) return;
    committed = true;
    // With an adapter, only its canonical commitment is exported. SDK evidence still
    // prevents an incorrect pre-commit stop while that canonical record is in flight.
    if (options.subscribe) return;
    commitmentPublished = true;
    publish("widget_attempt_committed", {
      committed: true, commitmentBoundary: boundary, evidenceSource: "sdk",
      evidenceSignal: signal, commitmentTimeBasis: "observed", evidenceObservedAt: new Date(options.now()).toISOString(),
      authoritative: false, publicationSource: "browser", ...fields,
    });
  };
  const stop = (outcome: "stopped" | "rejected", evidenceSignal: string, source: "browser" | "sdk") => {
    if (!active || terminal || committed) return;
    terminal = true;
    publish("widget_attempt_outcome", {
      outcome, outcomeAuthority: "browser", committed: false, reason: "unknown",
      evidenceSource: source, evidenceSignal, authoritative: true, publicationSource: "browser",
    });
  };
  function report(evidence: WidgetAttemptEvidence) {
    try {
      if (!active || !evidence || evidence.attempt_id !== options.context.attempt_id || !UUID.test(evidence.eventId) || canonicalEventIds.has(evidence.eventId)) return;
      if (evidence.authority !== "middleware" && evidence.authority !== "protocol") return;
      if (typeof evidence.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(evidence.occurredAt)) return;
      const timestamp = Date.parse(evidence.occurredAt);
      if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > options.now() + 60_000) return;
      const stamp = { eventId: evidence.eventId, timestamp };
      if (evidence.kind === "committed") {
        if (commitmentPublished || (terminal && !committed)) return;
        if (!["erc20_intent_signature", "native_deposit_submission"].includes(evidence.boundary)) return;
        if (evidence.boundary === "erc20_intent_signature" && !isHash(evidence.intentHash)) return;
        if (evidence.boundary === "native_deposit_submission" && !isHash(evidence.transactionHash)) return;
        committed = true;
        commitmentPublished = true;
        canonicalEventIds.add(evidence.eventId);
        publish("widget_attempt_committed", {
          committed: true, commitmentBoundary: evidence.boundary, evidenceSource: evidence.authority,
          commitmentTime: new Date(timestamp).toISOString(), commitmentTimeBasis: "authoritative",
          authoritative: true, publicationSource: "backend_adapter",
          intentHash: evidence.intentHash, transactionHash: evidence.transactionHash,
        }, stamp);
      } else if (evidence.kind === "outcome") {
        if (terminal || evidence.scope !== "final_requested_result" || !["completed", "failed"].includes(evidence.outcome)) return;
        if (![true, false, "unknown"].includes(evidence.committed)) return;
        if (committed && evidence.committed !== true) return;
        if (!isHash(evidence.intentHash) && !isHash(evidence.transactionHash)) return;
        committed = evidence.committed === true;
        terminal = true;
        canonicalEventIds.add(evidence.eventId);
        publish("widget_attempt_outcome", {
          outcome: evidence.outcome, outcomeAuthority: evidence.authority, committed: evidence.committed,
          evidenceSource: evidence.authority, authoritative: true, publicationSource: "backend_adapter",
          reason: evidence.outcome === "failed" ? "unknown" : undefined, service: evidence.service,
          provider: evidence.provider, intentHash: evidence.intentHash, transactionHash: evidence.transactionHash,
          commitToDeliveryMs: evidence.committed === true ? evidence.commitToDeliveryMs : undefined,
          estimatedValueUsd: evidence.outcome === "completed" ? evidence.estimatedValueUsd : undefined,
          valueIsEstimated: evidence.outcome === "completed" && evidence.estimatedValueUsd !== undefined ? true : undefined,
        }, stamp);
      }
    } catch { /* Invalid or untrusted payloads cannot escape into the widget. */ }
  }
  return {
    id: options.context.attempt_id,
    get terminal() { return terminal; },
    get executionStarted() { return executionStarted; },
    subscribe() {
      if (!active || !options.subscribe) return;
      try {
        const cleanup = options.subscribe(Object.freeze(options.context), report);
        if (!active) cleanup?.();
        else unsubscribe = cleanup;
      } catch { /* best effort */ }
    },
    dispose() {
      active = false;
      try { unsubscribe?.(); } catch { /* best effort */ }
    },
    accept() { executionStarted = true; },
    stopBeforeExecution(outcome: "stopped" | "rejected") {
      if (!executionStarted && !irreversibleActivity) stop(outcome, outcome === "rejected" ? "preview_rejected" : "explicit_cancel", "browser");
    },
    observeRejection(error: unknown) {
      try {
        if (!active || committed || terminal) return;
        const code = object(error)?.code;
        // A generic rejected promise or a timeout is not pre-commitment evidence.
        const signatureDenied = code === "user_action/intent_signature_denied" && lastStep === "request_signing";
        const allowanceDenied = code === "user_action/allowance_approval_denied" && ["allowance", "allowance_approval"].includes(lastStep ?? "") && !irreversibleActivity;
        const nativeDepositDenied = lastNativeDeposit && new Set<unknown>([4001, "ACTION_REJECTED", "user_action/tx_send_denied"]).has(code);
        if (signatureDenied || allowanceDenied || nativeDepositDenied) stop("stopped", "wallet_rejected_before_commitment", "sdk");
      } catch { /* best effort */ }
    },
    observeEvent(raw: unknown) {
      try {
        if (!active || terminal) return;
        const event = object(raw);
        if (!event) return;
        const plan = object(event.plan);
        if ((event.type === "plan_preview" || event.type === "plan_confirmed") && Array.isArray(plan?.steps)) {
          depositKinds = plan.steps.map(object).filter(step => step && ["bridge_deposit", "vault_deposit"].includes(String(step.type))).map(step => {
            if (step!.type === "vault_deposit") {
              if (step!.assetType === "native" && step!.submissionMode === "local_wallet") return "native";
              if (step!.assetType === "erc20" && step!.submissionMode === "middleware") return "erc20";
              return "unknown";
            }
            const address = object(step!.asset)?.contractAddress;
            if (typeof address !== "string" || !/^0x[0-9a-f]{40}$/i.test(address)) return "unknown";
            return NATIVE.has(address.toLowerCase()) ? "native" : "erc20";
          });
          return;
        }
        const step = object(event.step);
        if (event.type !== "plan_progress" || !step || step.type !== event.stepType) return;
        const stepType = String(event.stepType);
        const state = String(event.state);
        executionStarted = true;
        const native = step.type === "vault_deposit"
          ? step.assetType === "native" && step.submissionMode === "local_wallet"
          : step.type === "bridge_deposit" && NATIVE.has(String(object(step.asset)?.contractAddress).toLowerCase());
        lastStep = stepType;
        lastNativeDeposit = native && ["started", "wallet_prompted", "failed"].includes(state);
        if (["submitted", "confirmed"].includes(state) && isHash(event.txHash) && !["allowance", "allowance_approval", "execute_approval"].includes(stepType)) irreversibleActivity = true;
        if (native && event.state === "submitted" && isHash(event.txHash)) {
          localCommit("native_deposit_submission", { transactionHash: event.txHash }, "native_deposit_submitted");
          return;
        }
        // Native-only and mixed plans must not be committed on intent submission:
        // the native deposit can still be denied at a subsequent wallet prompt.
        const erc20Only = depositKinds.length > 0 && depositKinds.every(kind => kind === "erc20");
        if (erc20Only && event.state === "completed" && isHash(event.intentRequestHash)) {
          if (event.stepType === "request_signing") localCommit("erc20_intent_signature", { intentHash: event.intentRequestHash }, "request_signing_completed");
          else if (event.stepType === "bridge_intent_submission") localCommit("erc20_intent_signature", { intentHash: event.intentRequestHash }, "bridge_intent_submission_completed");
        }
      } catch { /* No raw event is exported. */ }
    },
  };
}
