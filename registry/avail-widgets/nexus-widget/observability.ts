import { createWidgetAttemptPublisher } from "./attempt-publisher";
import { ERROR_CODES } from "@avail-project/nexus-core";
import type {
  NexusIdentity, NexusObservabilityConfig, WidgetCallFinish,
  WidgetTelemetryPhase, WidgetTelemetryProperties, WidgetTelemetryRecord,
  WidgetTelemetryResult, WidgetTelemetryEventName,
} from "../nexus/widget-observability";

// Public project capture token from nexus-fast-bridge chore/add-signoz (257f685).
export const DEFAULT_WIDGET_POSTHOG_KEY = "phc_UD6lQU3PEw1d8oo8E17rJLmRAR7kxJbQ5OseHuCvi7N";
export const DEFAULT_WIDGET_POSTHOG_HOST = "https://us.i.posthog.com";
export const DEFAULT_WIDGET_SIGNOZ_URL = "https://otel2.avail.so/v1/logs";
const SCHEMA_VERSION = "1";
const MAX_QUEUE = 100;
const BATCH_SIZE = 20;
const FLUSH_DELAY_MS = 500;
const MAX_RETRIES = 2;
const KNOWN_CODES = new Set<string>(Object.values(ERROR_CODES));
const OPERATIONS = new Set([
  "initialize", "setEVMProvider", "getBalancesForBridge", "getBalancesForSwap",
  "swapWithExactIn", "swapWithExactOut", "swapAndExecute", "swapAndTransfer", "execute", "refresh",
]);
const SERVICES = new Set(["wallet", "hook", "rpc", "middleware", "lifi", "bebop", "zerox", "mystic", "relay", "coinbase"]);
const CANCELLATIONS = new Set([
  "USER_DENIED_INTENT", "ACTION_REJECTED",
  ...Object.values(ERROR_CODES).filter(code => code.startsWith("user_action/") && code.endsWith("_denied")),
]);
const noop: WidgetCallFinish = () => {};
type Mode = "deposit" | "swap" | "send";
type Settings = { identity?: NexusIdentity; config?: NexusObservabilityConfig; mode: Mode; walletAddress?: string };
type Runtime = {
  browser: () => boolean;
  hostname: () => string;
  production: () => boolean;
  now: () => number;
  uuid: () => string;
  fetch: typeof fetch;
};
const defaultRuntime: Runtime = {
  browser: () => typeof window !== "undefined",
  hostname: () => window.location.hostname,
  production: () => typeof process !== "undefined" && process.env.NODE_ENV === "production",
  now: () => Date.now(),
  uuid: () => crypto.randomUUID(),
  fetch: (...args) => fetch(...args),
};
const validClientId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value) && !/0x[0-9a-f]{40}/i.test(value);
const publicHash = (value: unknown): value is string => typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value);
export function walletHint(address: unknown): string | undefined {
  if (typeof address !== "string" || !/^0x[0-9a-f]{40}$/i.test(address)) return undefined;
  const lower = address.slice(2).toLowerCase();
  return `${lower.slice(0, 5)}.....${lower.slice(-5)}`;
}

/** Explicit field/value allowlist used before either sink or the analytics callback. */
export function sanitizeWidgetFields(input: Record<string, unknown>, config: NexusObservabilityConfig = {}): WidgetTelemetryProperties {
  const output: Record<string, string | number | boolean> = {};
  const choices: Record<string, ReadonlySet<string>> = {
    operation: OPERATIONS,
    phase: new Set(["initialization", "balance", "quote", "execution"]),
    result: new Set(["succeeded", "failed", "cancelled"]),
    service: SERVICES,
    reason: new Set(["unknown"]),
    sdkCode: KNOWN_CODES,
    outcome: new Set(["completed", "failed", "stopped", "rejected"]),
    outcomeAuthority: new Set(["browser", "middleware", "protocol"]),
    evidenceSource: new Set(["browser", "sdk", "middleware", "protocol"]),
    publicationSource: new Set(["browser", "backend_adapter"]),
    commitmentBoundary: new Set(["erc20_intent_signature", "native_deposit_submission"]),
    commitmentTimeBasis: new Set(["observed", "authoritative"]),
    evidenceSignal: new Set(["preview_rejected", "explicit_cancel", "wallet_rejected_before_commitment", "native_deposit_submitted", "request_signing_completed", "bridge_intent_submission_completed"]),
    provider: new Set(["nexus", "mayan"]),
  };
  for (const [key, values] of Object.entries(choices)) {
    const value = input[key];
    if (typeof value === "string" && values.has(value)) output[key] = value;
  }
  if (typeof input.durationMs === "number" && Number.isFinite(input.durationMs) && input.durationMs >= 0) {
    output.durationMs = Math.round(input.durationMs);
  }
  if (config.includeWalletHint !== false && typeof input.walletHint === "string" && /^[0-9a-f]{5}\.{5}[0-9a-f]{5}$/.test(input.walletHint)) {
    output.walletHint = input.walletHint;
  }
  for (const key of ["transactionHash", "intentHash"]) {
    if (publicHash(input[key])) output[key] = input[key];
  }
  for (const key of ["committed", "authoritative"]) {
    if (typeof input[key] === "boolean") output[key] = input[key];
  }
  if (input.committed === "unknown") output.committed = "unknown";
  for (const key of ["commitmentTime", "evidenceObservedAt"]) {
    if (typeof input[key] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(input[key]) && Number.isFinite(Date.parse(input[key]))) output[key] = new Date(input[key]).toISOString();
  }
  if (typeof input.previous_attempt_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.previous_attempt_id)) output.previous_attempt_id = input.previous_attempt_id;
  if (input.committed === true && typeof input.commitToDeliveryMs === "number" && Number.isFinite(input.commitToDeliveryMs) && input.commitToDeliveryMs >= 0) output.commitToDeliveryMs = Math.round(input.commitToDeliveryMs);
  if (config.includeAmounts && typeof input.estimatedValueUsd === "number" && Number.isFinite(input.estimatedValueUsd) && input.estimatedValueUsd >= 0) {
    output.estimatedValueUsd = input.estimatedValueUsd;
    output.valueIsEstimated = true;
  }
  // Final route mapping is deferred; arbitrary metadata is never forwarded.
  return Object.freeze(output);
}

function errorFields(error: unknown) {
  try {
    if (!error || typeof error !== "object") return {};
    const candidate = error as { code?: unknown; context?: { service?: unknown } };
    return { sdkCode: candidate.code, service: candidate.context?.service };
  } catch { return {}; }
}
function resultDiagnostic(result: unknown): { transactionHash?: string } {
  try {
    if (!result || typeof result !== "object") return {};
    const value = result as {
      txHash?: unknown;
      execute?: { txHash?: unknown };
      destinationSwap?: { txHash?: unknown };
      swapResult?: { destinationSwap?: { txHash?: unknown } };
    };
    const hash = value.execute?.txHash ?? value.destinationSwap?.txHash
      ?? value.swapResult?.destinationSwap?.txHash ?? value.txHash;
    return publicHash(hash) ? { transactionHash: hash } : {};
  } catch { return {}; }
}
function resultForError(error: unknown): WidgetTelemetryResult {
  try {
    const code = (error as { code?: unknown } | null)?.code;
    return code === 4001 || (typeof code === "string" && CANCELLATIONS.has(code)) ? "cancelled" : "failed";
  } catch { return "failed"; }
}
function endpoint(value: string, suffix = "") {
  if (value.startsWith("/") && !value.startsWith("//")) return `${value.replace(/\/$/, "")}${suffix}`;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Invalid collector URL");
  return `${value.replace(/\/$/, "")}${suffix}`;
}
function attributes(properties: WidgetTelemetryProperties) {
  return Object.entries(properties).map(([key, value]) => ({
    key,
    value: typeof value === "boolean" ? { boolValue: value }
      : typeof value === "number" ? { doubleValue: value } : { stringValue: value },
  }));
}
type Pending = { record: WidgetTelemetryRecord; diagnostic: WidgetTelemetryProperties; timestamp: number; posthog: boolean; signoz: boolean; retries: number };
type AttemptPublisher = ReturnType<typeof createWidgetAttemptPublisher>;
type SwapCall = { publisher?: AttemptPublisher; operation: string; quote: WidgetCallFinish; execution?: WidgetCallFinish; fallbackExecution: WidgetCallFinish; quoteReady: boolean };

export function createWidgetTelemetry(initial: Settings, overrides: Partial<Runtime> = {}) {
  const runtime = { ...defaultRuntime, ...overrides };
  let settings = initial;
  let active = true;
  let epoch = 0;
  let sessionId: string | undefined;
  let attemptId: string | undefined;
  let publisher: AttemptPublisher | undefined;
  let previousAttemptId: string | undefined;
  const publishers = new Set<AttemptPublisher>();
  let queue: Pending[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controllers = new Set<AbortController>();
  const swaps = new Map<number, SwapCall>();
  let flushing = false;

  const enabled = () => {
    try {
      const config = settings.config ?? {};
      if (!active || !runtime.browser() || config.disableLogging || config.mode === "off" || !validClientId(settings.identity?.clientId)) return false;
      if (config.mode === "on") return true;
      if (config.environment && config.environment !== "production") return false;
      const host = runtime.hostname();
      if (/^(localhost|127(?:\.\d+){3}|\[?::1\]?)$/.test(host) || host.endsWith(".localhost") || host.endsWith(".local")) return false;
      // An explicit non-production build must stay suppressed, even if mislabelled.
      if (typeof process !== "undefined" && ["development", "test"].includes(process.env.NODE_ENV ?? "")) return false;
      return config.environment === "production" || runtime.production();
    } catch { return false; }
  };
  const clear = () => {
    epoch++;
    if (timer) clearTimeout(timer);
    timer = undefined;
    queue = [];
    for (const controller of controllers) controller.abort();
    controllers.clear();
    swaps.clear();
    attemptId = undefined;
    publisher = undefined;
    previousAttemptId = undefined;
    for (const item of publishers) item.dispose();
    publishers.clear();
    sessionId = undefined;
  };
  const schedule = (delay = FLUSH_DELAY_MS) => {
    if (!timer && queue.length && enabled()) timer = setTimeout(() => { timer = undefined; void flush(); }, delay);
  };
  const send = async (url: string, body: unknown, signoz: boolean, suffix = "") => {
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await runtime.fetch(endpoint(url, suffix), {
        method: "POST", headers: { "Content-Type": "application/json", ...(signoz ? { "x-otlp-force-fetch": "1" } : {}) },
        body: JSON.stringify(body), credentials: "omit", referrerPolicy: "no-referrer",
        signal: controller.signal, cache: "no-store",
      });
      return response.ok;
    } catch { return false; }
    finally { clearTimeout(timeout); controllers.delete(controller); }
  };
  async function flush() {
    if (flushing || !enabled() || !queue.length) return;
    flushing = true;
    const currentEpoch = epoch;
    const batch = queue.splice(0, BATCH_SIZE);
    const config = settings.config ?? {};
    try {
      const posthogItems = batch.filter(item => item.posthog);
      const signozItems = batch.filter(item => item.signoz);
      const results = await Promise.allSettled([
        posthogItems.length ? send(config.posthog?.apiHost ?? DEFAULT_WIDGET_POSTHOG_HOST, {
          api_key: config.posthog?.apiKey ?? DEFAULT_WIDGET_POSTHOG_KEY,
          batch: posthogItems.map(({ record, timestamp }) => ({
            event: record.event, uuid: record.properties.eventId,
            timestamp: new Date(timestamp).toISOString(),
            properties: { ...record.properties, distinct_id: record.properties.session_id,
              $insert_id: record.properties.eventId, $process_person_profile: false, $geoip_disable: true },
          })),
        }, false, "/batch/") : Promise.resolve(true),
        signozItems.length ? send(config.signoz?.logsUrl ?? DEFAULT_WIDGET_SIGNOZ_URL, {
          resourceLogs: [{ resource: { attributes: attributes({ "service.name": "nexus-widget" }) }, scopeLogs: [{
            scope: { name: "nexus-widget", version: SCHEMA_VERSION },
            logRecords: signozItems.map(({ record, diagnostic, timestamp }) => ({
              timeUnixNano: `${timestamp}000000`, severityNumber: (record.properties.result === "failed" || record.properties.outcome === "failed") ? 17 : 9,
              severityText: (record.properties.result === "failed" || record.properties.outcome === "failed") ? "ERROR" : "INFO",
              body: { stringValue: record.event },
              attributes: attributes({ ...record.properties, ...diagnostic }),
            })),
          }] }],
        }, true) : Promise.resolve(true),
      ]);
      if (currentEpoch !== epoch || !enabled()) return;
      const succeeded = results.map(result => result.status === "fulfilled" && result.value);
      for (const item of batch) {
        item.posthog = item.posthog && !succeeded[0];
        item.signoz = item.signoz && !succeeded[1];
        if ((item.posthog || item.signoz) && item.retries++ < MAX_RETRIES && queue.length < MAX_QUEUE) queue.push(item);
      }
    } catch { /* Bad configuration and transport failure never escape. */ }
    finally { flushing = false; schedule(1000); }
  }
  const emit = (event: WidgetTelemetryEventName, fields: Record<string, unknown>, capturedAttempt?: string, stamp?: { eventId: string; timestamp: number }) => {
    try {
      if (!enabled()) return;
      sessionId ??= runtime.uuid();
      const timestamp = stamp?.timestamp ?? runtime.now();
      const sanitized = sanitizeWidgetFields({ ...fields, walletHint: walletHint(settings.walletAddress) }, settings.config);
      const { sdkCode, transactionHash, intentHash, ...summary } = sanitized;
      const includeLookupKeys = event === "widget_attempt_committed" || event === "widget_attempt_outcome";
      const properties = Object.freeze({
        ...summary,
        ...(includeLookupKeys && transactionHash ? { transactionHash } : {}),
        ...(includeLookupKeys && intentHash ? { intentHash } : {}),
        "nexus.client.id": settings.identity!.clientId, "surface.name": "nexus-widget",
        environment: settings.config?.environment ?? (runtime.production() ? "production" : "development"),
        mode: settings.mode, ...(capturedAttempt ? { attempt_id: capturedAttempt } : {}),
        session_id: sessionId, eventId: stamp?.eventId ?? runtime.uuid(), timestamp: new Date(timestamp).toISOString(), schemaVersion: SCHEMA_VERSION,
      });
      const record = Object.freeze({ event, properties });
      const diagnostic = Object.freeze({
        ...(sdkCode ? { sdkCode } : {}), ...(transactionHash ? { transactionHash } : {}), ...(intentHash ? { intentHash } : {}),
        sdkVersion: "2.4.1",
      });
      if (queue.length >= MAX_QUEUE) queue.shift();
      queue.push({ record, diagnostic, timestamp, posthog: true, signoz: true, retries: 0 });
      schedule();
      try { settings.config?.onRecord?.(record); } catch { /* developer callback is best effort */ }
    } catch { /* crypto or browser APIs may be unavailable */ }
  };
  const beginAttempt = (operation: string) => {
    try {
      if (!enabled()) return;
      if (publisher?.terminal) {
        previousAttemptId = publisher.id;
        attemptId = undefined;
        publisher = undefined;
      }
      if (!attemptId) {
        attemptId = runtime.uuid();
        sessionId ??= runtime.uuid();
        const id = attemptId;
        const generation = epoch;
        emit("widget_attempt_started", { operation, previous_attempt_id: previousAttemptId }, id);
        if (generation !== epoch || !enabled()) return;
        publisher = createWidgetAttemptPublisher({
          context: { attempt_id: id, session_id: sessionId, clientId: settings.identity!.clientId,
            surface: "nexus-widget", mode: settings.mode,
            environment: settings.config?.environment ?? (runtime.production() ? "production" : "development") },
          now: runtime.now,
          publish: (event, fields, stamp) => { if (generation === epoch) emit(event, fields, id, stamp); },
          subscribe: settings.config?.subscribeToAttemptEvidence,
        });
        if (publishers.size >= 100) {
          const oldest = publishers.values().next().value;
          oldest?.dispose();
          if (oldest) publishers.delete(oldest);
        }
        publishers.add(publisher);
        publisher.subscribe();
      }
    } catch { /* no identity, no collection */ }
  };
  const startCall = (operation: string, phase: WidgetTelemetryPhase): WidgetCallFinish => {
    if (!enabled()) return noop;
    const startedAt = runtime.now();
    const currentEpoch = epoch;
    const capturedAttempt = attemptId;
    let finished = false;
    return (result, error, diagnostic) => {
      if (finished || currentEpoch !== epoch) return;
      finished = true;
      const observedResult = result === "failed" ? resultForError(error) : result;
      emit("widget_sdk_result", {
        ...diagnostic, operation, phase, result: observedResult, durationMs: Math.max(0, runtime.now() - startedAt),
        ...(observedResult !== "succeeded" ? { reason: "unknown", ...errorFields(error) } : {}),
      }, capturedAttempt);
    };
  };
  return {
    enabled,
    configure(next: Settings) {
      const before = { ...settings, config: { ...settings.config, onRecord: undefined, subscribeToAttemptEvidence: undefined } };
      const after = { ...next, config: { ...next.config, onRecord: undefined, subscribeToAttemptEvidence: undefined } };
      if (JSON.stringify(before) !== JSON.stringify(after) || settings.config?.subscribeToAttemptEvidence !== next.config?.subscribeToAttemptEvidence) clear();
      settings = next;
      if (!enabled()) clear();
    },
    resume() { active = true; },
    dispose() { active = false; clear(); },
    resetAttempt() {
      previousAttemptId = publisher?.terminal ? publisher.id : undefined;
      attemptId = undefined;
      publisher = undefined;
      swaps.clear();
    },
    stopBeforeExecution(outcome: "stopped" | "rejected" = "stopped") { publisher?.stopBeforeExecution(outcome); },
    observeEvent(runId: number, event: unknown) { swaps.get(runId)?.publisher?.observeEvent(event); },
    beginAttempt,
    startCall,
    flush,
    quoteFailed(runId: number) {
      swaps.get(runId)?.quote("failed");
    },
    quoteReady(runId: number) {
      const call = swaps.get(runId);
      if (call) { call.quoteReady = true; call.quote("succeeded"); }
    },
    accept(runId: number | undefined) {
      const call = runId === undefined ? undefined : swaps.get(runId);
      // Preview acceptance starts observed execution timing, never commitment.
      if (call && !call.execution) {
        call.execution = startCall(call.operation, "execution");
        call.publisher?.accept();
      }
    },
    async observe<T>(operation: string, phase: WidgetTelemetryPhase, call: () => Promise<T>): Promise<T> {
      const finish = startCall(operation, phase);
      try { const result = await call(); finish("succeeded", undefined, resultDiagnostic(result)); return result; }
      catch (error) { finish("failed", error); throw error; }
    },
    async observeSwap<T>(operation: string, runId: number, call: () => Promise<T>): Promise<T> {
      beginAttempt(operation);
      const observation: SwapCall = { publisher, operation, quote: startCall(operation, "quote"), fallbackExecution: startCall(operation, "execution"), quoteReady: false };
      if (enabled()) swaps.set(runId, observation);
      try {
        const value = await call();
        const failed = value && typeof value === "object" && "success" in value && value.success === false;
        (observation.execution ?? observation.fallbackExecution)(failed ? "failed" : "succeeded", undefined, resultDiagnostic(value));
        // No onIntent can mean the SDK skipped the swap. Do not invent a usable quote.
        return value;
      } catch (error) {
        observation.publisher?.observeRejection(error);
        if (!observation.quoteReady) observation.quote("failed", error);
        else if (observation.execution) observation.execution("failed", error);
        // Denying a stale quote is a call cancellation, not a terminal attempt outcome.
        else observation.fallbackExecution(resultForError(error), error);
        throw error;
      } finally { swaps.delete(runId); }
    },
  };
}
