/** One allocated identity, shared by widget consumers. SDK header forwarding is pending. */
export interface NexusIdentity {
  clientId: string;
}

export type WidgetTelemetryEventName =
  | "widget_attempt_started"
  | "widget_sdk_result"
  | "widget_attempt_committed"
  | "widget_attempt_outcome";
export type WidgetTelemetryPhase = "initialization" | "balance" | "quote" | "execution";
export type WidgetTelemetryResult = "succeeded" | "failed" | "cancelled";
export type WidgetTelemetryProperties = Readonly<Record<string, string | number | boolean>>;
export interface WidgetTelemetryRecord {
  readonly event: WidgetTelemetryEventName;
  readonly properties: WidgetTelemetryProperties;
}

export interface NexusObservabilityConfig {
  /** Wins over mode: "on". Clears pending exports and suppresses onRecord. */
  disableLogging?: boolean;
  /** Auto requires a production browser; on permits intentional browser verification. */
  mode?: "auto" | "on" | "off";
  environment?: "production" | "staging" | "development" | "test";
  includeWalletHint?: boolean;
  /** Include optional estimated USD supplied by a trusted final-outcome publisher. */
  includeAmounts?: boolean;
  posthog?: { apiKey?: string; apiHost?: string };
  signoz?: { logsUrl?: string };
  /** Sanitized widget observations only. Never transaction callbacks or raw SDK payloads. */
  onRecord?: (record: WidgetTelemetryRecord) => void;
  /** Optional trusted backend publisher adapter. No backend subscription is installed by default. */
  subscribeToAttemptEvidence?: WidgetAttemptEvidenceSubscriber;
}

export type WidgetCallFinish = (
  result: WidgetTelemetryResult,
  error?: unknown,
  diagnostic?: { transactionHash?: string },
) => void;
export type WidgetCallObserver = (
  operation: string,
  phase: WidgetTelemetryPhase,
) => WidgetCallFinish;

/** Internal provider subscription: only mounted NexusWidgets subscribe. */
export function createWidgetObservationHub() {
  const observers = new Set<WidgetCallObserver>();
  return {
    subscribe(observer: WidgetCallObserver) {
      observers.add(observer);
      return () => { observers.delete(observer); };
    },
    async observe<T>(operation: string, phase: WidgetTelemetryPhase, call: () => Promise<T>): Promise<T> {
      const finishes: WidgetCallFinish[] = [];
      for (const observer of observers) {
        try { finishes.push(observer(operation, phase)); } catch { /* best effort */ }
      }
      const finish = (result: WidgetTelemetryResult, error?: unknown) => {
        for (const callback of finishes) {
          try { callback(result, error); } catch { /* never affect the SDK */ }
        }
      };
      try {
        const value = await call();
        finish("succeeded");
        return value;
      } catch (error) {
        finish("failed", error);
        throw error;
      }
    },
  };
}

export interface WidgetAttemptContext {
  readonly attempt_id: string;
  readonly clientId: string;
  readonly session_id: string;
  readonly surface: "nexus-widget";
  readonly mode: "deposit" | "swap" | "send";
  readonly environment: string;
}

/** Trusted publisher input, not an SDK 2.4.1 API. Never pass raw progress as this evidence. */
export type WidgetAttemptEvidence = {
  attempt_id: string;
  eventId: string;
  occurredAt: string;
  authority: "middleware" | "protocol";
} & (
  | {
      kind: "committed";
      boundary: "erc20_intent_signature" | "native_deposit_submission";
      intentHash?: string;
      transactionHash?: string;
    }
  | {
      kind: "outcome";
      /** Must cover recipient transfer/destination execution, not an intermediate bridge fill. */
      scope: "final_requested_result";
      outcome: "completed" | "failed";
      committed: boolean | "unknown";
      intentHash?: string;
      transactionHash?: string;
      service?: string;
      provider?: "nexus" | "mayan";
      commitToDeliveryMs?: number;
      estimatedValueUsd?: number;
    }
);

export type WidgetAttemptEvidenceSubscriber = (
  context: WidgetAttemptContext,
  report: (evidence: WidgetAttemptEvidence) => void,
) => void | (() => void);
