import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { ERROR_CODES } from "@avail-project/nexus-core";
import { classifyWidgetError } from "../registry/avail-widgets/nexus-widget/error-classification";
import { createWidgetTelemetry, sanitizeWidgetFields, walletHint } from "../registry/avail-widgets/nexus-widget/observability";
import { createWidgetObservationHub, type NexusObservabilityConfig, type WidgetTelemetryRecord } from "../registry/avail-widgets/nexus/widget-observability";

const address = `0xccef8${"a".repeat(30)}4c636`;
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
function harness(config: NexusObservabilityConfig = {}, clientId = "integrator-001") {
  let time = 1000;
  let id = 0;
  const records: WidgetTelemetryRecord[] = [];
  const requests: { url: string; body: any; options: RequestInit }[] = [];
  const settings = { identity: { clientId }, mode: "swap" as const, walletAddress: address, config: { mode: "on" as const, onRecord: (r: WidgetTelemetryRecord) => records.push(r), ...config } };
  const telemetry = createWidgetTelemetry(settings, {
    browser: () => true, hostname: () => "dapp.example", production: () => true,
    now: () => time, uuid: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    fetch: async (url, options) => {
      requests.push({ url: String(url), body: JSON.parse(String(options?.body)), options: options! });
      return new Response("{}", { status: 200 });
    },
  });
  return { telemetry, records, requests, settings, advance: (ms: number) => { time += ms; } };
}

test("one attempt survives requotes; each usable quote and execution is timed once", async () => {
  const h = harness();
  try {
    const first = deferred<object>();
    const p1 = h.telemetry.observeSwap("swapWithExactIn", 1, () => first.promise);
    h.advance(120);
    h.telemetry.quoteReady(1);
    h.telemetry.quoteReady(1);
    first.reject({ code: "user_action/intent_hook_denied" });
    await assert.rejects(p1);
    const second = deferred<object>();
    const p2 = h.telemetry.observeSwap("swapWithExactIn", 2, () => second.promise);
    h.advance(80);
    h.telemetry.quoteReady(2);
    h.advance(5000); // Preview dwell must not pollute execution duration.
    h.telemetry.accept(2);
    h.advance(300);
    second.resolve({ success: true });
    await p2;
    assert.equal(h.records.filter(r => r.event === "widget_attempt_started").length, 1);
    assert.equal(new Set(h.records.map(r => r.properties["attempt.id"])).size, 1);
    const quotes = h.records.filter(r => r.properties.phase === "quote");
    assert.deepEqual(quotes.map(r => r.properties.durationMs), [120, 80]);
    assert.equal(h.records.at(-1)?.properties.durationMs, 300);
    assert.equal(new Set(h.records.map(r => r.properties.eventId)).size, h.records.length);
    assert.ok(h.records.every(r => !["widget_attempt_committed", "widget_attempt_outcome"].includes(r.event)));
  } finally { h.telemetry.dispose(); }
});

test("new user flow gets a new attempt while a late result retains its original attempt", async () => {
  const h = harness();
  try {
    const pending = deferred<object>();
    const operation = h.telemetry.observeSwap("swapWithExactIn", 1, () => pending.promise);
    const firstId = h.records[0].properties["attempt.id"];
    h.telemetry.resetAttempt();
    await h.telemetry.observeSwap("swapWithExactOut", 2, async () => ({}));
    const secondId = h.records.find(r => r.event === "widget_attempt_started" && r.properties["attempt.id"] !== firstId)?.properties["attempt.id"];
    assert.ok(secondId);
    pending.resolve({});
    await operation;
    assert.equal(h.records.at(-1)?.properties["attempt.id"], firstId);
    assert.ok(h.records.every(r => !('attempt.previous_id' in r.properties)));
  } finally { h.telemetry.dispose(); }
});

test("initialization and balance results before a quote have no invented attempt", async () => {
  const h = harness();
  try {
    await h.telemetry.observe("initialize", "initialization", async () => undefined);
    await h.telemetry.observe("getBalancesForSwap", "balance", async () => [address]);
    assert.equal(h.records.length, 2);
    assert.ok(h.records.every(r => !('attempt.id' in r.properties)));
  } finally { h.telemetry.dispose(); }
});

test("sink copies share event identity and allowlisted SDK error codes", async () => {
  const h = harness();
  try {
    h.telemetry.beginAttempt("swapWithExactIn");
    const error = { code: "backend/report_mayan_tx_failed", context: { service: "middleware", address }, message: `secret ${address}` };
    const finish = h.telemetry.startCall("swapWithExactIn", "quote");
    h.advance(40);
    finish("failed", error);
    await h.telemetry.flush();
    assert.equal(h.requests.length, 2);
    const events = h.requests[0].body.batch;
    const logs = h.requests[1].body.resourceLogs[0].scopeLogs[0].logRecords;
    assert.deepEqual(events.map((e: any) => e.uuid), logs.map((l: any) => l.attributes.find((a: any) => a.key === "eventId").value.stringValue));
    assert.equal(events[1].properties["error.code"], "backend/report_mayan_tx_failed");
    assert.ok(logs[1].attributes.some((a: any) => a.key === "error.code"));
    assert.equal(events[0].properties.$process_person_profile, false);
    assert.ok(h.requests.every(r => r.options.credentials === "omit" && r.options.referrerPolicy === "no-referrer"));
    assert.ok(!JSON.stringify(h.requests).includes(address));
    assert.ok(!JSON.stringify(h.requests).includes("secret"));
  } finally { h.telemetry.dispose(); }
});

test("privacy sanitizer rejects nested secrets, spoofed classifications, raw errors and full addresses", () => {
  const hash = `0x${"a".repeat(64)}`;
  const sanitized = sanitizeWidgetFields({
    operation: address, phase: "quote", result: "failed", sdkCode: `validation/${address}`,
    walletHint: "ccef8.....4c636", transactionHash: hash, intentHash: address,
    error: new Error(address), signature: hash, calldata: hash, recipient: address,
    nested: { token: "secret" }, amount: 123, fee: 2, durationMs: Infinity,
  });
  assert.deepEqual(sanitized, { phase: "quote", result: "failed", walletHint: "ccef8.....4c636", transactionHash: hash });
  assert.deepEqual(sanitizeWidgetFields({ walletHint: "ccef8.....4c636" }, { includeWalletHint: false }), {});
  assert.equal(walletHint(`0x${"C".repeat(40)}`), "ccccc.....ccccc");
  assert.equal(walletHint("not-a-wallet"), undefined);
  assert.equal(sanitizeWidgetFields({ amount: 123 }, { includeAmounts: true }).amount, undefined);
});

for (const config of [{ disableLogging: true }, { mode: "off" as const }]) {
  test(`disabled collection has no callbacks or requests: ${JSON.stringify(config)}`, async () => {
    const h = harness(config);
    try {
      const value = await h.telemetry.observeSwap("swapWithExactIn", 1, async () => 42);
      await h.telemetry.flush();
      assert.equal(value, 42);
      assert.equal(h.records.length, 0);
      assert.equal(h.requests.length, 0);
    } finally { h.telemetry.dispose(); }
  });
}

test("opt-out clears queued records and suppresses completion of calls already in progress", async () => {
  const h = harness();
  try {
    const pending = deferred<number>();
    const operation = h.telemetry.observeSwap("swapWithExactIn", 1, () => pending.promise);
    assert.equal(h.records.length, 1);
    h.telemetry.configure({ ...h.settings, config: { ...h.settings.config, disableLogging: true } });
    pending.resolve(3);
    assert.equal(await operation, 3);
    await h.telemetry.flush();
    assert.equal(h.requests.length, 0);
    assert.equal(h.records.length, 1);
    h.telemetry.configure(h.settings);
    await h.telemetry.flush();
    assert.equal(h.requests.length, 0);
  } finally { h.telemetry.dispose(); }
});

test("SSR, local hosts, non-production and missing identity are suppressed by default", () => {
  for (const [browser, hostname, production, identity, config] of [
    [false, "prod.example", true, { clientId: "a" }, { mode: "on" }],
    [true, "localhost", true, { clientId: "a" }, {}],
    [true, "127.0.0.1", true, { clientId: "a" }, {}],
    [true, "[::1]", true, { clientId: "a" }, {}],
    [true, "prod.example", false, { clientId: "a" }, {}],
    [true, "prod.example", true, undefined, {}],
    [true, "prod.example", true, { clientId: address }, {}],
    [true, "prod.example", true, { clientId: "a" }, { environment: "staging" }],
  ] as const) {
    const telemetry = createWidgetTelemetry({ identity, config, mode: "send" }, {
      browser: () => browser, hostname: () => hostname, production: () => production,
    });
    assert.equal(telemetry.enabled(), false);
    telemetry.dispose();
  }
});

test("missing identity preserves SDK results and errors without collecting even in on mode", async () => {
  const records: WidgetTelemetryRecord[] = [];
  let requests = 0;
  const telemetry = createWidgetTelemetry({ mode: "swap", config: { mode: "on", onRecord: record => records.push(record) } }, {
    browser: () => true, hostname: () => "prod.example", production: () => true,
    fetch: async () => { requests++; return new Response("{}"); },
  });
  try {
    const result = { success: true, txHash: `0x${"a".repeat(64)}` };
    const error = new Error("Original SDK error");
    assert.equal(await telemetry.observeSwap("swapWithExactIn", 1, async () => result), result);
    assert.equal(await telemetry.observe("execute", "execution", async () => result), result);
    await assert.rejects(telemetry.observeSwap("swapWithExactOut", 2, async () => { throw error; }), value => value === error);
    await assert.rejects(telemetry.observe("getBalancesForSwap", "balance", async () => { throw error; }), value => value === error);
    await telemetry.flush();
    assert.equal(requests, 0);
    assert.deepEqual(records, []);
  } finally { telemetry.dispose(); }
});

test("separate integrators and widget modes cannot share identity or queues", async () => {
  const a = harness({}, "integrator-a"), b = harness({}, "integrator-b");
  b.telemetry.configure({ ...b.settings, mode: "deposit" });
  try {
    await a.telemetry.observeSwap("swapWithExactIn", 1, async () => ({}));
    await b.telemetry.observeSwap("swapAndExecute", 1, async () => ({}));
    await Promise.all([a.telemetry.flush(), b.telemetry.flush()]);
    assert.ok(a.records.every(r => r.properties["nexus.client.id"] === "integrator-a" && r.properties.mode === "swap"));
    assert.ok(b.records.every(r => r.properties["nexus.client.id"] === "integrator-b" && r.properties.mode === "deposit"));
  } finally { a.telemetry.dispose(); b.telemetry.dispose(); }
});

test("SDK throw, rejected callback and failed collector cannot change SDK results", async () => {
  const error = new Error("wallet secret");
  const h = harness({ onRecord: () => { throw Error("callback failed"); }, posthog: { apiHost: "invalid" } });
  try {
    assert.equal(await h.telemetry.observe("execute", "execution", async () => 10), 10);
    await assert.rejects(h.telemetry.observeSwap("swapWithExactIn", 1, async () => { throw error; }), candidate => candidate === error);
    await h.telemetry.flush();
  } finally { h.telemetry.dispose(); }
});

test("provider observations are silent without widget subscribers and preserve errors", async () => {
  const hub = createWidgetObservationHub();
  const h = harness();
  try {
    await hub.observe("initialize", "initialization", async () => 1);
    assert.equal(h.records.length, 0);
    const unsubscribe = hub.subscribe(h.telemetry.startCall);
    const error = { code: "user_action/siwe_signature_denied" };
    await assert.rejects(hub.observe("setEVMProvider", "initialization", async () => { throw error; }), e => e === error);
    assert.equal(h.records[0].properties.result, "cancelled");
    unsubscribe();
    await hub.observe("getBalancesForSwap", "balance", async () => []);
    assert.equal(h.records.length, 1);
  } finally { h.telemetry.dispose(); }
});

test("all widget execution calls are wrapped and legacy analytics forwarding is gone", () => {
  const sourceText = readFileSync(new URL("../registry/avail-widgets/nexus-widget/nexus-widget.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(sourceText, /analytics\.track|trackDeposit|widgetAttemptId|widgetSessionId/);
  const source = ts.createSourceFile("widget.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let count = 0;
  const walk = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && /^(nexusSDK|sdkWithOptionalTransfer)$/.test(node.expression.expression.getText(source)) && /^(execute|swapWithExactIn|swapWithExactOut|swapAndExecute|swapAndTransfer)$/.test(node.expression.name.text)) {
      assert.ok(ts.isArrowFunction(node.parent));
      assert.ok(ts.isCallExpression(node.parent.parent));
      assert.match(node.parent.parent.expression.getText(source), /^telemetry\.observe(Swap)?$/);
      count++;
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  assert.equal(count, 7);
});

test("failed sinks retry independently with identical IDs and stop at the retry limit", async () => {
  const bodies: { url: string; body: any }[] = [];
  const telemetry = createWidgetTelemetry({ identity: { clientId: "retry-client" }, mode: "send", config: { mode: "on" } }, {
    browser: () => true,
    fetch: async (url, options) => {
      bodies.push({ url: String(url), body: JSON.parse(String(options?.body)) });
      return new Response("{}", { status: String(url).includes("posthog") ? 503 : 200 });
    },
  });
  try {
    telemetry.beginAttempt("swapAndExecute");
    for (let i = 0; i < 5; i++) await telemetry.flush();
    const posthog = bodies.filter(b => b.url.includes("posthog"));
    const signoz = bodies.filter(b => !b.url.includes("posthog"));
    assert.equal(posthog.length, 3);
    assert.equal(signoz.length, 1);
    assert.deepEqual(posthog[0].body, posthog[1].body);
    assert.deepEqual(posthog[0].body, posthog[2].body);
  } finally { telemetry.dispose(); }
});

test("malformed PostHog configuration cannot block SigNoz", async () => {
  const h = harness({ posthog: { apiHost: "invalid" } });
  try {
    h.telemetry.beginAttempt("swapAndExecute");
    await h.telemetry.flush();
    assert.equal(h.requests.length, 1);
    assert.match(h.requests[0].url, /otel2\.avail\.so/);
  } finally { h.telemetry.dispose(); }
});

test("opt-out aborts in-flight exports and cannot requeue them after re-enable", async () => {
  const signals: AbortSignal[] = [];
  const settings = { identity: { clientId: "abort-client" }, mode: "swap" as const, config: { mode: "on" as const } };
  const telemetry = createWidgetTelemetry(settings, {
    browser: () => true,
    fetch: async (_url, options) => new Promise<Response>((_resolve, reject) => {
      const signal = options!.signal!;
      signals.push(signal);
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  });
  try {
    telemetry.beginAttempt("swapWithExactIn");
    const flushing = telemetry.flush();
    telemetry.configure({ ...settings, config: { ...settings.config, disableLogging: true } });
    await flushing;
    assert.equal(signals.length, 2);
    assert.ok(signals.every(s => s.aborted));
    telemetry.configure(settings);
    await telemetry.flush();
    assert.equal(signals.length, 2);
  } finally { telemetry.dispose(); }
});

test("queue stays bounded during sustained collector outage", async () => {
  const h = harness();
  try {
    for (let i = 0; i < 150; i++) h.telemetry.startCall("refresh", "quote")("succeeded");
    for (let i = 0; i < 10; i++) await h.telemetry.flush();
    const count = h.requests.filter(r => r.url.includes("posthog")).reduce((sum, r) => sum + r.body.batch.length, 0);
    assert.equal(count, 100);
  } finally { h.telemetry.dispose(); }
});

test("wallet hint opt-out applies equally to callbacks and both collectors", async () => {
  const h = harness({ includeWalletHint: false });
  try {
    h.telemetry.beginAttempt("swapWithExactIn");
    await h.telemetry.flush();
    assert.ok(h.records.every(r => !("walletHint" in r.properties)));
    assert.ok(!JSON.stringify(h.requests).includes("walletHint"));
  } finally { h.telemetry.dispose(); }
});

test("timeout and skipped swap do not manufacture attempt outcomes or usable quotes", async () => {
  const h = harness();
  try {
    await h.telemetry.observeSwap("swapAndExecute", 1, async () => ({ swapSkipped: true }));
    await assert.rejects(h.telemetry.observeSwap("swapWithExactOut", 2, async () => { throw { code: "backend/request_timeout" }; }));
    assert.equal(h.records.filter(r => r.event === "widget_attempt_started").length, 1);
    assert.ok(h.records.every(r => r.event !== "widget_attempt_outcome" && r.event !== "widget_attempt_committed"));
    assert.ok(!h.records.some(r => r.properties.phase === "quote" && r.properties.result === "succeeded"));
  } finally { h.telemetry.dispose(); }
});

test("known public result hashes reach diagnostics without exporting transaction payloads", async () => {
  const h = harness();
  const hash = `0x${"b".repeat(64)}`;
  try {
    const value = { execute: { txHash: hash, receipt: { from: address, secret: "private" } }, calldata: "private" };
    assert.equal(await h.telemetry.observe("execute", "execution", async () => value), value);
    await h.telemetry.flush();
    assert.ok(!JSON.stringify(h.records).includes(hash));
    assert.ok(!JSON.stringify(h.requests[0]).includes(hash));
    assert.ok(JSON.stringify(h.requests[1]).includes(hash));
    assert.ok(!JSON.stringify(h.requests).includes("private"));
    assert.ok(!JSON.stringify(h.requests).includes(address));
  } finally { h.telemetry.dispose(); }
});

test("a setup call started before a quote cannot borrow its later attempt ID", async () => {
  const h = harness();
  try {
    const setup = deferred<void>();
    const operation = h.telemetry.observe("initialize", "initialization", () => setup.promise);
    h.telemetry.beginAttempt("swapWithExactIn");
    setup.resolve();
    await operation;
    assert.ok(h.records[0].properties["attempt.id"]);
    assert.equal(h.records[1].properties["attempt.id"], undefined);
  } finally { h.telemetry.dispose(); }
});

test("widget opt-out never configures or toggles Core SDK analytics", () => {
  const text = readFileSync(new URL("../registry/avail-widgets/nexus/NexusProvider.tsx", import.meta.url), "utf8");
  const source = ts.createSourceFile("provider.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let sdkCreations = 0;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      assert.doesNotMatch(node.expression.getText(source), /analytics\.(?:disable|enable)$/);
      if (node.expression.getText(source) === "createNexusClient") {
        sdkCreations++;
        assert.doesNotMatch(node.arguments[0].getText(source), /analytics|disableLogging|observability/);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(sdkCreations, 1);
});

const publicIntentHash = `0x${"1".repeat(64)}`;
const publicTxHash = `0x${"2".repeat(64)}`;
const depositStep = (native = false) => ({
  type: "bridge_deposit", id: "deposit", chain: { id: 1 },
  asset: { contractAddress: native ? `0x${"e".repeat(40)}` : `0x${"a".repeat(40)}`, symbol: native ? "ETH" : "USDC" },
});
const submission = { type: "plan_progress", stepType: "bridge_intent_submission", state: "completed", step: { type: "bridge_intent_submission", id: "submit" }, intentRequestHash: publicIntentHash };
function pendingSwap(h: ReturnType<typeof harness>, operation = "swapWithExactIn") {
  const pending = deferred<object>();
  const result = h.telemetry.observeSwap(operation, 1, () => pending.promise);
  return { pending, result };
}

for (const mode of ["swap", "send", "deposit"] as const) {
  test(`${mode}: ERC20 commitment uses evidence once and is labelled browser-observed`, async () => {
    const h = harness();
    h.telemetry.configure({ ...h.settings, mode });
    const p = pendingSwap(h);
    try {
      h.telemetry.observeEvent(1, { type: "plan_confirmed", plan: { steps: [depositStep()] } });
      h.telemetry.observeEvent(1, submission);
      h.telemetry.observeEvent(1, submission);
      h.telemetry.observeEvent(1, { ...submission, stepType: "bridge_fill", step: { type: "bridge_fill" } });
      p.pending.resolve({ success: true });
      await p.result;
      const commits = h.records.filter(r => r.event === "widget_attempt_committed");
      assert.equal(commits.length, 1);
      assert.equal(commits[0].properties.commitmentBoundary, "erc20_intent_signature");
      assert.equal(commits[0].properties.authoritative, false);
      assert.equal(commits[0].properties.intentHash, publicIntentHash);
      assert.equal(commits[0].properties.mode, mode);
      assert.equal(commits[0].properties["attempt.id"], h.records[0].properties["attempt.id"]);
      assert.ok(!h.records.some(r => r.event === "widget_attempt_outcome"));
    } finally { h.telemetry.dispose(); }
  });
}

test("native commitment requires a submitted deposit hash, never signing or approval", async () => {
  const h = harness(); const p = pendingSwap(h);
  try {
    h.telemetry.observeEvent(1, { type: "plan_confirmed", plan: { steps: [depositStep(true)] } });
    h.telemetry.observeEvent(1, submission);
    h.telemetry.observeEvent(1, { type: "plan_progress", stepType: "allowance_approval", state: "confirmed", step: { type: "allowance_approval" }, txHash: publicTxHash });
    assert.equal(h.records.filter(r => r.event === "widget_attempt_committed").length, 0);
    h.telemetry.observeEvent(1, { type: "plan_progress", stepType: "bridge_deposit", state: "submitted", step: depositStep(true), txHash: address });
    assert.equal(h.records.filter(r => r.event === "widget_attempt_committed").length, 0);
    h.telemetry.observeEvent(1, { type: "plan_progress", stepType: "bridge_deposit", state: "submitted", step: depositStep(true), txHash: publicTxHash });
    const commit = h.records.at(-1)!;
    assert.equal(commit.event, "widget_attempt_committed");
    assert.equal(commit.properties.commitmentBoundary, "native_deposit_submission");
    assert.equal(commit.properties.transactionHash, publicTxHash);
    p.pending.resolve({}); await p.result;
  } finally { h.telemetry.dispose(); }
});

test("native second-prompt denial is stopped, with no commitment or failure", async () => {
  const h = harness(); const p = pendingSwap(h);
  try {
    h.telemetry.observeEvent(1, { type: "plan_confirmed", plan: { steps: [depositStep(true)] } });
    h.telemetry.quoteReady(1); h.telemetry.accept(1);
    h.telemetry.observeEvent(1, submission);
    h.telemetry.observeEvent(1, { type: "plan_progress", stepType: "bridge_deposit", state: "started", step: depositStep(true) });
    p.pending.reject({ code: "user_action/tx_send_denied" }); await assert.rejects(p.result);
    assert.ok(!h.records.some(r => r.event === "widget_attempt_committed"));
    const outcome = h.records.find(r => r.event === "widget_attempt_outcome")!;
    assert.equal(outcome.properties.outcome, "stopped");
    assert.equal(outcome.properties.committed, false);
    assert.equal(outcome.properties.outcomeAuthority, "browser");
  } finally { h.telemetry.dispose(); }
});

test("mixed or absent plans do not establish ERC20 commitment from submission", async () => {
  for (const steps of [[], [depositStep(), depositStep(true)]]) {
    const h = harness(); const p = pendingSwap(h);
    try {
      h.telemetry.observeEvent(1, { type: "plan_confirmed", plan: { steps } });
      h.telemetry.observeEvent(1, submission);
      p.pending.resolve({}); await p.result;
      assert.ok(!h.records.some(r => r.event === "widget_attempt_committed"));
    } finally { h.telemetry.dispose(); }
  }
});

for (const choice of ["stopped", "rejected"] as const) {
  test(`explicit pre-execution ${choice} is deduplicated and links the next attempt`, async () => {
    const h = harness();
    try {
      h.telemetry.beginAttempt("swapWithExactIn");
      const first = h.records[0].properties["attempt.id"];
      h.telemetry.stopBeforeExecution(choice);
      h.telemetry.stopBeforeExecution(choice);
      assert.equal(h.records.filter(r => r.event === "widget_attempt_outcome").length, 1);
      h.telemetry.beginAttempt("swapWithExactIn");
      const next = h.records.at(-1)!;
      assert.equal(next.event, "widget_attempt_started");
      assert.notEqual(next.properties["attempt.id"], first);
      assert.equal(next.properties["attempt.previous_id"], first);
      await h.telemetry.flush();
      const events = h.requests[0].body.batch;
      const logs = h.requests[1].body.resourceLogs[0].scopeLogs[0].logRecords;
      assert.deepEqual(events.map((e: any) => e.uuid), logs.map((l: any) => l.attributes.find((a: any) => a.key === "eventId").value.stringValue));
    } finally { h.telemetry.dispose(); }
  });
}

test("post-commit rejection, raw errors and timeout do not publish terminal outcomes", async () => {
  const h = harness(); const p = pendingSwap(h);
  try {
    h.telemetry.observeEvent(1, { type: "plan_confirmed", plan: { steps: [depositStep()] } });
    h.telemetry.observeEvent(1, submission);
    h.telemetry.stopBeforeExecution("rejected");
    p.pending.reject({ code: "user_action/tx_send_denied" }); await assert.rejects(p.result);
    assert.ok(!h.records.some(r => r.event === "widget_attempt_outcome"));
  } finally { h.telemetry.dispose(); }
});

test("trusted backend adapter publishes all four records and deduplicates canonical evidence", async () => {
  let report!: (e: import("../registry/avail-widgets/nexus/widget-observability").WidgetAttemptEvidence) => void;
  let context!: import("../registry/avail-widgets/nexus/widget-observability").WidgetAttemptContext;
  const h = harness({ includeAmounts: true, subscribeToAttemptEvidence: (c, r) => { context = c; report = r; } });
  const p = pendingSwap(h);
  try {
    h.telemetry.observeEvent(1, { type: "plan_confirmed", plan: { steps: [depositStep()] } });
    h.telemetry.observeEvent(1, submission);
    assert.ok(!h.records.some(r => r.event === "widget_attempt_committed"));
    const commit = { kind: "committed" as const, attempt_id: context.attempt_id, eventId: "10000000-0000-4000-8000-000000000001", occurredAt: new Date(1000).toISOString(), authority: "middleware" as const, boundary: "erc20_intent_signature" as const, intentHash: publicIntentHash };
    report(commit); report(commit);
    const outcome = { kind: "outcome" as const, attempt_id: context.attempt_id, eventId: "10000000-0000-4000-8000-000000000002", occurredAt: new Date(2000).toISOString(), authority: "protocol" as const, scope: "final_requested_result" as const, outcome: "completed" as const, committed: true, transactionHash: publicTxHash, provider: "mayan" as const, commitToDeliveryMs: 1000, estimatedValueUsd: 30 };
    h.advance(1000); report(outcome); report(outcome);
    p.pending.resolve({}); await p.result;
    assert.deepEqual(new Set(h.records.map(r => r.event)), new Set(["widget_attempt_started", "widget_sdk_result", "widget_attempt_committed", "widget_attempt_outcome"]));
    assert.equal(h.records.filter(r => r.event === "widget_attempt_outcome").length, 1);
    const final = h.records.find(r => r.event === "widget_attempt_outcome")!;
    assert.equal(final.properties.authoritative, true);
    assert.equal(final.properties.estimatedValueUsd, 30);
    assert.equal(final.properties.eventId, outcome.eventId);
    assert.equal(final.properties.timestamp, outcome.occurredAt);
    await h.telemetry.flush();
    const events = h.requests[0].body.batch;
    assert.equal(events.find((e: any) => e.event === "widget_attempt_outcome").uuid, outcome.eventId);
    assert.ok(!JSON.stringify(h.requests).includes(address));
  } finally { h.telemetry.dispose(); }
});

test("backend failures require final-result scope and correct attempt; amounts remain opt-in", () => {
  let report!: (e: any) => void;
  const h = harness({ subscribeToAttemptEvidence: (_c, r) => { report = r; } });
  try {
    h.telemetry.beginAttempt("swapAndExecute");
    const evidence = { kind: "outcome", attempt_id: h.records[0].properties["attempt.id"], eventId: "10000000-0000-4000-8000-000000000003", occurredAt: new Date(1000).toISOString(), authority: "middleware", scope: "final_requested_result", outcome: "failed", committed: true, intentHash: publicIntentHash, estimatedValueUsd: 30 };
    report({ ...evidence, scope: "bridge_fill" });
    report({ ...evidence, attempt_id: "other-attempt" });
    report({ ...evidence, authority: "sdk" });
    report({ ...evidence, intentHash: address });
    assert.equal(h.records.length, 1);
    report(evidence);
    const final = h.records.at(-1)!;
    assert.equal(final.properties.outcome, "failed");
    assert.equal(final.properties.estimatedValueUsd, undefined);
    assert.equal(final.properties.reason, "unknown");
  } finally { h.telemetry.dispose(); }
});

test("opt-out closes the publisher adapter and suppresses late backend callbacks", () => {
  let report!: (e: any) => void; let removed = 0; let subscriptions = 0;
  const h = harness({ subscribeToAttemptEvidence: (_c, r) => { subscriptions++; report = r; return () => { removed++; }; } });
  try {
    h.telemetry.beginAttempt("swapAndExecute");
    const id = h.records[0].properties["attempt.id"];
    h.telemetry.configure({ ...h.settings, config: { ...h.settings.config, disableLogging: true } });
    report({ kind: "outcome", attempt_id: id, eventId: "10000000-0000-4000-8000-000000000004", occurredAt: new Date(1000).toISOString(), authority: "middleware", scope: "final_requested_result", outcome: "completed", committed: true, transactionHash: publicTxHash });
    h.telemetry.beginAttempt("swapAndExecute");
    assert.equal(subscriptions, 1); assert.equal(removed, 1); assert.equal(h.records.length, 1);
  } finally { h.telemetry.dispose(); }
});

test("a backend outcome can arrive before its commitment record without losing either", () => {
  let report!: (e: any) => void;
  const h = harness({ subscribeToAttemptEvidence: (_c, r) => { report = r; } });
  try {
    h.telemetry.beginAttempt("swapAndExecute");
    const base = { attempt_id: h.records[0].properties["attempt.id"], occurredAt: new Date(1000).toISOString(), authority: "middleware", intentHash: publicIntentHash };
    report({ ...base, eventId: "10000000-0000-4000-8000-000000000005", kind: "outcome", scope: "final_requested_result", outcome: "completed", committed: true });
    report({ ...base, eventId: "10000000-0000-4000-8000-000000000006", kind: "committed", boundary: "erc20_intent_signature" });
    assert.equal(h.records.filter(r => r.event === "widget_attempt_outcome").length, 1);
    assert.equal(h.records.filter(r => r.event === "widget_attempt_committed").length, 1);
  } finally { h.telemetry.dispose(); }
});

test("late backend outcome stays joined to its original attempt after a form reset", () => {
  const subscriptions: Array<{ context: import("../registry/avail-widgets/nexus/widget-observability").WidgetAttemptContext; report: (e: any) => void }> = [];
  const h = harness({ subscribeToAttemptEvidence: (context, report) => { subscriptions.push({ context, report }); } });
  try {
    h.telemetry.beginAttempt("swapAndExecute");
    h.telemetry.resetAttempt();
    h.telemetry.beginAttempt("swapAndExecute");
    const first = subscriptions[0];
    first.report({ kind: "outcome", attempt_id: first.context.attempt_id, eventId: "10000000-0000-4000-8000-000000000007", occurredAt: new Date(1000).toISOString(), authority: "middleware", scope: "final_requested_result", outcome: "completed", committed: "unknown", transactionHash: publicTxHash });
    const outcome = h.records.at(-1)!;
    assert.equal(outcome.properties["attempt.id"], first.context.attempt_id);
    assert.notEqual(outcome.properties["attempt.id"], subscriptions[1].context.attempt_id);
    assert.equal(outcome.properties.committed, "unknown");
    assert.equal(outcome.properties.commitToDeliveryMs, undefined);
  } finally { h.telemetry.dispose(); }
});

test("completed outcome values remain absent without amount opt-in", () => {
  let report!: (e: any) => void;
  const h = harness({ subscribeToAttemptEvidence: (_c, r) => { report = r; } });
  try {
    h.telemetry.beginAttempt("swapWithExactOut");
    report({ kind: "outcome", attempt_id: h.records[0].properties["attempt.id"], eventId: "10000000-0000-4000-8000-000000000008", occurredAt: new Date(1000).toISOString(), authority: "protocol", scope: "final_requested_result", outcome: "completed", committed: true, transactionHash: publicTxHash, estimatedValueUsd: 100, signature: publicTxHash, address });
    assert.equal(h.records.at(-1)?.properties.estimatedValueUsd, undefined);
    assert.equal(h.records.at(-1)?.properties.valueIsEstimated, undefined);
    assert.ok(!JSON.stringify(h.records).includes(address));
    assert.ok(!JSON.stringify(h.records).includes("signature"));
  } finally { h.telemetry.dispose(); }
});

test("a failing backend adapter cannot change the SDK result", async () => {
  const h = harness({ subscribeToAttemptEvidence: () => { throw new Error("offline"); } });
  try {
    assert.equal(await h.telemetry.observeSwap("swapAndExecute", 1, async () => 42), 42);
  } finally { h.telemetry.dispose(); }
});

test("synchronous opt-out from the start callback prevents opening a publisher subscription", () => {
  let subscriptions = 0;
  const h = harness();
  h.telemetry.configure({ ...h.settings, config: { ...h.settings.config,
    onRecord: () => h.telemetry.configure({ ...h.settings, config: { disableLogging: true } }),
    subscribeToAttemptEvidence: () => { subscriptions++; },
  } });
  try {
    h.telemetry.beginAttempt("swapAndExecute");
    assert.equal(subscriptions, 0);
  } finally { h.telemetry.dispose(); }
});

for (const quoteReady of [false, true]) {
  test(`superseded quotes emit no SDK rejection status (preview ready: ${quoteReady})`, async () => {
    const h = harness();
    try {
      const old = deferred<object>();
      const result = h.telemetry.observeSwap("swapWithExactIn", 1, () => old.promise);
      if (quoteReady) h.telemetry.quoteReady(1);
      const before = h.records.length;
      const refresh = h.telemetry.startQuoteRefresh(1);
      h.telemetry.supersedeQuote(1);
      refresh("failed", new Error("User denied swap intent"));
      old.reject(new Error("User denied swap intent"));
      await assert.rejects(result);
      assert.equal(h.records.length, before);
      await h.telemetry.observeSwap("swapWithExactIn", 2, async () => ({}));
      assert.equal(h.records.filter(r => r.event === "widget_attempt_started").length, 1);
      await h.telemetry.flush();
      assert.ok(!JSON.stringify(h.requests).includes('"result":"failed"'));
      assert.ok(!JSON.stringify(h.requests).includes('"result":"cancelled"'));
    } finally { h.telemetry.dispose(); }
  });
}

test("current quote and refresh errors remain observable; accepted executions cannot be suppressed", async () => {
  const h = harness();
  try {
    await assert.rejects(h.telemetry.observeSwap("swapWithExactIn", 1, async () => { throw new Error("Quote RPC failed"); }));
    assert.equal(h.records.at(-1)?.properties.result, "failed");
    const pending = deferred<object>();
    const result = h.telemetry.observeSwap("swapWithExactIn", 2, () => pending.promise);
    h.telemetry.quoteReady(2);
    h.telemetry.startQuoteRefresh(2)("failed", new Error("Refresh RPC failed"));
    assert.equal(h.records.at(-1)?.properties.operation, "refresh");
    assert.equal(h.records.at(-1)?.properties.result, "failed");
    h.telemetry.accept(2);
    h.telemetry.supersedeQuote(2);
    pending.reject(new Error("Execution failed"));
    await assert.rejects(result);
    assert.equal(h.records.at(-1)?.properties.phase, "execution");
    assert.equal(h.records.at(-1)?.properties.result, "failed");
  } finally { h.telemetry.dispose(); }
});

test("input change before a delayed SDK call starts cannot produce a stale quote failure", async () => {
  const h = harness();
  try {
    h.telemetry.supersedeQuote(5);
    const error = new Error("User denied swap intent");
    await assert.rejects(h.telemetry.observeSwap("swapWithExactIn", 4, async () => { throw error; }), value => value === error);
    assert.equal(h.records.length, 0);
    await h.telemetry.observeSwap("swapWithExactIn", 6, async () => ({}));
    assert.equal(h.records[0].event, "widget_attempt_started");
  } finally { h.telemetry.dispose(); }
});

for (const code of [4001, "ACTION_REJECTED", "user_action/allowance_approval_denied", "user_action/intent_signature_denied", "user_action/siwe_signature_denied", "user_action/tx_send_denied", "user_action/ephemeral_key_denied"]) {
  test(`explicit wallet rejection has a reason in both collectors: ${code}`, async () => {
    const h = harness();
    try {
      const error = { code, message: `private wallet error ${address}` };
      await assert.rejects(h.telemetry.observe("execute", "execution", async () => { throw error; }), value => value === error);
      const record = h.records[0];
      assert.equal(record.properties.result, "cancelled");
      assert.equal(record.properties.reason, "wallet_rejected");
      assert.equal(record.properties.service, "wallet");
      await h.telemetry.flush();
      assert.equal(h.requests[0].body.batch[0].properties.reason, "wallet_rejected");
      const log = h.requests[1].body.resourceLogs[0].scopeLogs[0].logRecords[0];
      assert.ok(log.attributes.some((item: any) => item.key === "reason" && item.value.stringValue === "wallet_rejected"));
      assert.ok(!JSON.stringify(h.requests).includes("private wallet error"));
      assert.ok(!JSON.stringify(h.requests).includes(address));
    } finally { h.telemetry.dispose(); }
  });
}

test("pre-commit approval denial carries wallet reason without becoming a platform failure", async () => {
  const h = harness();
  try {
    const pending = deferred<object>();
    const result = h.telemetry.observeSwap("swapWithExactIn", 1, () => pending.promise);
    h.telemetry.quoteReady(1);
    h.telemetry.accept(1);
    h.telemetry.observeEvent(1, { type: "plan_progress", stepType: "allowance", state: "started", step: { type: "allowance" } });
    pending.reject({ code: "user_action/allowance_approval_denied", context: { service: "wallet" } });
    await assert.rejects(result);
    const outcome = h.records.find(record => record.event === "widget_attempt_outcome");
    assert.equal(outcome?.properties.outcome, "stopped");
    assert.equal(outcome?.properties.reason, "wallet_rejected");
    assert.equal(outcome?.properties.service, "wallet");
    assert.equal(h.records.at(-1)?.properties.reason, "wallet_rejected");
    assert.equal(h.records.at(-1)?.properties.result, "cancelled");
  } finally { h.telemetry.dispose(); }
});

test("hook cancellation and error text cannot masquerade as explicit wallet rejection", async () => {
  const h = harness();
  try {
    for (const error of [{ code: "user_action/intent_hook_denied" }, { code: "USER_DENIED_INTENT" }, { message: "User rejected request", context: { service: "wallet" } }, { code: "rpc/error" }]) {
      await assert.rejects(h.telemetry.observe("execute", "execution", async () => { throw error; }));
      assert.notEqual(h.records.at(-1)?.properties.reason, "wallet_rejected");
    }
    assert.deepEqual(sanitizeWidgetFields({ reason: "wallet_rejected" }), { reason: "wallet_rejected" });
    assert.deepEqual(sanitizeWidgetFields({ reason: `secret ${address}` }), {});
  } finally { h.telemetry.dispose(); }
});


test("every installed SDK error code has a bounded reason, category and static summary", () => {
  for (const code of Object.values(ERROR_CODES)) {
    const classified = classifyWidgetError({ code, message: `private ${address}` });
    const fields = sanitizeWidgetFields(classified);
    assert.equal(fields["error.code"], code);
    assert.notEqual(fields.reason, "unknown", code);
    assert.ok(fields.errorSummary, code);
    assert.equal(fields.errorCategory, code.split("/")[0]);
    assert.ok(!JSON.stringify(fields).includes("private"));
  }
});

for (const phase of ["quote", "execution"] as const) {
  test(`${phase}: destination quote unavailable is actionable in both sinks without leaking the token address`, async () => {
    const h = harness();
    const error = { code: "external_service/destination_swap_quote_failed", context: { service: "lifi", stepType: "destination_swap" }, message: `Quote failed: No destination swap quote available for chain 4114 token ${address}` };
    try {
      if (phase === "quote") await assert.rejects(h.telemetry.observeSwap("swapAndExecute", 1, async () => { throw error; }), value => value === error);
      else await assert.rejects(h.telemetry.observe("swapAndExecute", phase, async () => { throw error; }), value => value === error);
      const record = h.records.at(-1)!;
      assert.equal(record.properties.reason, "destination_swap_quote_unavailable");
      assert.equal(record.properties.errorSummary, "No destination swap quote is available.");
      assert.equal(record.properties["error.code"], error.code);
      assert.equal(record.properties.errorCategory, "external_service");
      assert.equal(record.properties.errorStep, "destination_swap");
      assert.equal(record.properties.errorChainId, 4114);
      assert.equal(record.properties.service, "lifi");
      await h.telemetry.flush();
      assert.ok(h.requests[0].body.batch.some((event: any) => event.properties.reason === "destination_swap_quote_unavailable"));
      assert.ok(h.requests[1].body.resourceLogs[0].scopeLogs[0].logRecords.some((log: any) => log.attributes.some((item: any) => item.key === "reason" && item.value.stringValue === "destination_swap_quote_unavailable")));
      assert.ok(!JSON.stringify(h.requests).includes(address));
    } finally { h.telemetry.dispose(); }
  });
}

test("typed execution reasons, wrapped causes and malformed errors remain safe", () => {
  for (const code of ["execution/slippage_exceeded", "execution/tx_onchain_reverted", "backend/fulfilment_wait_timeout", "validation/insufficient_balance"]) {
    const fields = sanitizeWidgetFields(classifyWidgetError({ cause: { code, context: { stepType: "destination_swap", chainId: BigInt(4114) } } }));
    assert.equal(fields.reason, code.split("/")[1]);
    assert.equal(fields.errorChainId, 4114);
  }
  const cyclic: any = { message: "private" }; cyclic.cause = cyclic;
  assert.equal(classifyWidgetError(cyclic).reason, "unknown");
  assert.equal(classifyWidgetError({ get code() { throw new Error("private"); } }).reason, "unknown");
  assert.deepEqual(sanitizeWidgetFields({ reason: "destination_swap_quote_unavailable", errorSummary: `secret ${address}`, sdkCode: `invalid/${address}`, errorStep: address, errorChainId: Infinity }), { reason: "destination_swap_quote_unavailable" });
  assert.equal(classifyWidgetError({ code: "execution/slippage_exceeded", message: `Quote failed: No destination swap quote available for chain 4114 token ${address}` }).reason, "slippage_exceeded");
  assert.equal(classifyWidgetError({ code: 4001, message: `Quote failed: No destination swap quote available for chain 4114 token ${address}` }).reason, "wallet_rejected");
  for (const [message, reason] of [
    ["Quote failed: No destination gas swap quote available for chain 4114", "destination_gas_quote_unavailable"],
    ["Quote failed: Failed to resize destination swap.", "destination_swap_resize_failed"],
    ["Quote failed: Failed to requote destination swap.", "destination_swap_requote_failed"],
  ]) assert.equal(classifyWidgetError(new Error(message)).reason, reason);
});

test("unsuccessful return values preserve their errors and original values", async () => {
  const h = harness();
  try {
    const value = { success: false, error: { code: "execution/tx_onchain_reverted", message: "private" } };
    assert.equal(await h.telemetry.observeSwap("swapAndExecute", 1, async () => value), value);
    assert.equal(h.records.at(-1)?.properties.reason, "tx_onchain_reverted");
    assert.equal(await h.telemetry.observe("execute", "execution", async () => value), value);
    assert.equal(h.records.at(-1)?.properties.result, "failed");
    await h.telemetry.observe("execute", "execution", async () => ({ success: false }));
    assert.equal(h.records.at(-1)?.properties.reason, "unsuccessful_result");
  } finally { h.telemetry.dispose(); }
});

test("invalid quote shapes have a widget reason instead of unknown", async () => {
  const h = harness();
  try {
    const pending = deferred<object>();
    const operation = h.telemetry.observeSwap("swapWithExactIn", 1, () => pending.promise);
    h.telemetry.quoteFailed(1);
    pending.reject({ code: "user_action/intent_hook_denied" });
    await assert.rejects(operation);
    assert.equal(h.records.at(-1)?.properties.reason, "invalid_quote");
    assert.equal(h.records.at(-1)?.properties.errorCategory, "widget");
  } finally { h.telemetry.dispose(); }
});

test("records carry nexus.network, surface.version, session.id, attempt.id, and error.code", async () => {
  const h = harness({ network: "testnet" });
  try {
    h.telemetry.beginAttempt("swapWithExactIn");
    const error = { code: "backend/report_mayan_tx_failed" };
    h.telemetry.startCall("swapWithExactIn", "quote")("failed", error);
    await h.telemetry.flush();
    const startRecord = h.records[0];
    assert.equal(startRecord.properties["nexus.network"], "testnet");
    assert.equal(startRecord.properties["surface.version"], "2.1.0");
    assert.equal(startRecord.properties["surface.name"], "nexus-widget");
    assert.ok(startRecord.properties["session.id"]);
    assert.equal(startRecord.properties.session_id, undefined);
    assert.ok(startRecord.properties["attempt.id"]);
    assert.equal(startRecord.properties.attempt_id, undefined);

    const callRecord = h.records[1];
    assert.equal(callRecord.properties["error.code"], "backend/report_mayan_tx_failed");
    assert.equal(callRecord.properties.sdkCode, undefined);
  } finally { h.telemetry.dispose(); }
});

test("queued records survive configure() on wallet address or mode change without being dropped", async () => {
  const h = harness();
  try {
    h.telemetry.beginAttempt("swapWithExactIn");
    assert.equal(h.records.length, 1);
    // User connects wallet before flush
    h.telemetry.configure({ ...h.settings, walletAddress: "0x1111111111111111111111111111111111111111" });
    await h.telemetry.flush();
    // The queued record was NOT discarded, it reached requests!
    assert.ok(h.requests.length > 0);
    const posthog = h.requests.find(r => r.url.includes("posthog"));
    assert.ok(posthog);
    assert.equal(posthog.body.batch[0].event, "widget_attempt_started");
  } finally { h.telemetry.dispose(); }
});

test("queued records are sent when dispose() is called", async () => {
  const h = harness();
  h.telemetry.beginAttempt("swapWithExactIn");
  assert.equal(h.records.length, 1);
  // Dispose triggers flush of queued items
  h.telemetry.dispose();
  assert.ok(h.requests.length > 0);
  const posthog = h.requests.find(r => r.url.includes("posthog"));
  assert.ok(posthog);
  assert.equal(posthog.body.batch[0].event, "widget_attempt_started");
});

test("dispose() sends all queued records across multiple batches without dropping any", async () => {
  const h = harness();
  for (let i = 0; i < 45; i++) {
    h.telemetry.startCall("refresh", "quote")("succeeded");
  }
  assert.equal(h.records.length, 45);
  // Dispose flushes all 45 records in 3 batches (20, 20, 5)
  h.telemetry.dispose();
  await new Promise(r => setTimeout(r, 20));
  const posthog = h.requests.filter(r => r.url.includes("posthog"));
  const signoz = h.requests.filter(r => !r.url.includes("posthog"));
  assert.equal(posthog.length, 3);
  assert.equal(signoz.length, 3);
  const posthogCount = posthog.reduce((sum, r) => sum + r.body.batch.length, 0);
  assert.equal(posthogCount, 45);
});

test("all fetch requests use keepalive: true", async () => {
  const h = harness();
  try {
    h.telemetry.beginAttempt("swapWithExactIn");
    await h.telemetry.flush();
    assert.ok(h.requests.length > 0);
    assert.ok(h.requests.every(r => (r.options as any).keepalive === true));
  } finally { h.telemetry.dispose(); }
});

test("pagehide event drains all queued records across batches immediately", async () => {
  const savedWindow = (globalThis as any).window;
  const mockWindow = new EventTarget();
  (mockWindow as any).location = { hostname: "dapp.example" };
  (globalThis as any).window = mockWindow;
  try {
    const h = harness();
    for (let i = 0; i < 25; i++) {
      h.telemetry.startCall("refresh", "quote")("succeeded");
    }
    // Simulate pagehide
    mockWindow.dispatchEvent(new Event("pagehide"));
    await new Promise(r => setTimeout(r, 20));
    const posthog = h.requests.filter(r => r.url.includes("posthog"));
    assert.equal(posthog.length, 2); // batches of 20 and 5
    const total = posthog.reduce((sum, r) => sum + r.body.batch.length, 0);
    assert.equal(total, 25);
    h.telemetry.dispose();
  } finally {
    if (savedWindow !== undefined) (globalThis as any).window = savedWindow;
    else delete (globalThis as any).window;
  }
});

test("terminal backend outcome with committed: 'unknown' is not dropped after local commit", async () => {
  let report!: (e: any) => void;
  let context!: any;
  const h = harness({ subscribeToAttemptEvidence: (c, r) => { context = c; report = r; } });
  const p = pendingSwap(h);
  try {
    h.telemetry.observeEvent(1, { type: "plan_confirmed", plan: { steps: [depositStep()] } });
    h.telemetry.observeEvent(1, submission);
    // Backend reports outcome with committed: "unknown"
    report({
      kind: "outcome",
      attempt_id: context.attempt_id,
      eventId: "10000000-0000-4000-8000-000000000099",
      occurredAt: new Date(2000).toISOString(),
      authority: "middleware",
      scope: "final_requested_result",
      outcome: "completed",
      committed: "unknown",
      transactionHash: publicTxHash,
    });
    p.pending.resolve({});
    await p.result;
    const outcomes = h.records.filter(r => r.event === "widget_attempt_outcome");
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].properties.outcome, "completed");
  } finally { h.telemetry.dispose(); }
});

test("terminal backend failure outcome without on-chain hash is not dropped", async () => {
  let report!: (e: any) => void;
  let context!: any;
  const h = harness({ subscribeToAttemptEvidence: (c, r) => { context = c; report = r; } });
  try {
    h.telemetry.beginAttempt("swapWithExactIn");
    report({
      kind: "outcome",
      attempt_id: context.attempt_id,
      eventId: "10000000-0000-4000-8000-000000000098",
      occurredAt: new Date(2000).toISOString(),
      authority: "middleware",
      scope: "final_requested_result",
      outcome: "failed",
      committed: false,
    });
    const outcomes = h.records.filter(r => r.event === "widget_attempt_outcome");
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].properties.outcome, "failed");
  } finally { h.telemetry.dispose(); }
});

test("first-prompt signature rejection with 4001 or ACTION_REJECTED publishes stopped outcome", async () => {
  for (const code of [4001, "ACTION_REJECTED"]) {
    const h = harness();
    const p = pendingSwap(h);
    try {
      h.telemetry.observeEvent(1, { type: "plan_confirmed", plan: { steps: [depositStep()] } });
      h.telemetry.quoteReady(1);
      h.telemetry.accept(1);
      h.telemetry.observeEvent(1, { type: "plan_progress", stepType: "request_signing", state: "started", step: { type: "request_signing" } });
      p.pending.reject({ code });
      await assert.rejects(p.result);
      const outcome = h.records.find(r => r.event === "widget_attempt_outcome");
      assert.ok(outcome);
      assert.equal(outcome.properties.outcome, "stopped");
      assert.equal(outcome.properties.reason, "wallet_rejected");
    } finally { h.telemetry.dispose(); }
  }
});

