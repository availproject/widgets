import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import {
  mergeOnrampSession, normalizeOnrampSession,
} from "../registry/avail-widgets/nexus-widget/utils/onramp-session";
import {
  getOnrampHistoryStorageKey, readOnrampHistory, upsertOnrampHistory, writeOnrampHistory,
  type OnrampHistoryEntry,
} from "../registry/avail-widgets/nexus-widget/utils/onramp-history";
import { useOnrampHistory } from "../registry/avail-widgets/nexus-widget/utils/use-onramp-history";
import { OnrampHistoryCard } from "../registry/avail-widgets/nexus-widget/components/onramp-history-card";

const owner = "0x1111111111111111111111111111111111111111";
const otherOwner = "0x2222222222222222222222222222222222222222";
const baseUrl = "https://example.com/middleware";
const originalFetch = globalThis.fetch;
const originalLog = console.log;
let storage: Map<string, string>;
let windowEvents: EventTarget;
let renderer: ReactTestRenderer | undefined;
let result: ReturnType<typeof useOnrampHistory>;

beforeEach(() => {
  storage = new Map();
  windowEvents = new EventTarget();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).window = Object.assign(windowEvents, {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  (globalThis as any).document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  console.log = () => {};
});

afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  globalThis.fetch = originalFetch;
  console.log = originalLog;
  delete (globalThis as any).window;
  delete (globalThis as any).document;
});

const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
};

const makeEntry = (state = "PENDING", sessionId = "session", address = owner) => upsertOnrampHistory([], {
  ownerAddress: address,
  session: { sessionId, state },
  context: {
    chainId: 10, tokenSymbol: "USDC", destinationAmount: "15",
    sourceAmount: "60", sourceCurrencyCode: "AED", provider: "BANXA", paymentMethodType: "CARD",
  },
}, 1000)[0];

function Harness({ address = owner, active = false }: { address?: string; active?: boolean }) {
  result = useOnrampHistory({ ownerAddress: address, active, baseUrl });
  return <div>{result.entries.map((entry) => <OnrampHistoryCard key={entry.id} entry={entry} relativeTime="Just now" chainName="Optimism" />)}</div>;
}

const save = (entries: OnrampHistoryEntry[], address = owner) => writeOnrampHistory(address, baseUrl, entries);

test("response amount and transaction payment method override the checkout selection", () => {
  const session = normalizeOnrampSession({
    provider: "OLD_PROVIDER", paymentMethodType: "CARD", state: "PENDING",
    transaction: {
      status: "SETTLED", serviceProvider: "BANXA", paymentMethodType: "APPLE_PAY",
      destinationAmount: 14.57, sourceAmount: 60, sourceCurrencyCode: "AED", chainId: "10",
    },
  }, "session");
  assert.equal(session.transaction?.destinationAmount, "14.57");
  assert.equal(session.transaction?.sourceAmount, "60");
  assert.equal(session.paymentMethodType, "APPLE_PAY");
  assert.equal(session.provider, "BANXA");
  const [entry] = upsertOnrampHistory([makeEntry()], { ownerAddress: owner, session });
  assert.equal(entry.context.destinationAmount, "15");
  assert.equal(entry.session.transaction?.destinationAmount, "14.57");
  assert.equal(entry.session.paymentMethodType, "APPLE_PAY");
});

test("partial responses preserve known amounts and methods and keep the latest status after normalization", () => {
  const previous = normalizeOnrampSession({
    transaction: { status: "PENDING", destinationAmount: 14.57, sourceAmount: 60, paymentMethodType: "APPLE_PAY" },
  }, "session");
  const session = mergeOnrampSession(previous, normalizeOnrampSession({ state: "SETTLED", transaction: { txHash: "hash" } }, "session"));
  assert.equal(session.transaction?.destinationAmount, "14.57");
  assert.equal(session.paymentMethodType, "APPLE_PAY");
  assert.equal(normalizeOnrampSession(session).state, "SETTLED");
  const zero = mergeOnrampSession(session, normalizeOnrampSession({ transaction: { destinationAmount: 0 } }, "session"));
  assert.equal(zero.transaction?.destinationAmount, "0");
  assert.equal(normalizeOnrampSession({ paymentMethodType: "CARD", transaction: { paymentMethodType: "" } }).paymentMethodType, "CARD");
});

test("pending, failed and completed purchases persist once per session and survive reload", () => {
  let entries = [makeEntry("PENDING", "pending"), makeEntry("FAILED", "failed"), makeEntry("SETTLED", "done")];
  entries = upsertOnrampHistory(entries, { ownerAddress: owner, session: { sessionId: "pending", state: "SETTLING" } });
  assert.equal(entries.length, 3);
  save(entries);
  const reloaded = readOnrampHistory(owner, baseUrl);
  assert.equal(reloaded.length, 3);
  assert.deepEqual(reloaded.map((entry) => entry.session.state).sort(), ["FAILED", "SETTLED", "SETTLING"]);
  assert.ok(reloaded.every((entry) => entry.context.sourceAmount === "60"));
  assert.equal(readOnrampHistory(otherOwner, baseUrl).length, 0);
  assert.equal(readOnrampHistory(owner, "https://another.example/middleware").length, 0);
});

test("storage omits checkout secrets and ignores malformed or foreign entries", () => {
  const entries = upsertOnrampHistory([], {
    ownerAddress: owner,
    session: {
      sessionId: "session", state: "PENDING", widgetUrl: "https://checkout.example/secret",
      fallbackWidgetUrl: "https://checkout.example/fallback-secret", email: "private@example.com",
      transaction: { sourceAmount: "60", cardNumber: "private-card" },
    } as any,
  }, 1000);
  save(entries);
  const key = getOnrampHistoryStorageKey(owner, baseUrl);
  assert.doesNotMatch(storage.get(key)!, /secret|private|cardNumber|widgetUrl/i);
  storage.set(key, JSON.stringify([null, {}, ...entries, makeEntry("PENDING", "foreign", otherOwner)]));
  assert.equal(readOnrampHistory(owner, baseUrl).length, 1);
});

test("stale pending replies cannot revert terminal history, and older replies cannot replace amounts", () => {
  const current = upsertOnrampHistory([makeEntry()], {
    ownerAddress: owner,
    session: { sessionId: "session", state: "SETTLED", updatedAt: "2026-09-10T10:00:00Z", transaction: { destinationAmount: "14.57" } },
  });
  assert.equal(upsertOnrampHistory(current, { ownerAddress: owner, session: { sessionId: "session", state: "PENDING" } }), current);
  assert.equal(upsertOnrampHistory(current, { ownerAddress: owner, session: { sessionId: "session", state: "SETTLED", updatedAt: "2026-09-10T09:00:00Z", transaction: { destinationAmount: "15" } } }), current);
  assert.equal(upsertOnrampHistory(current, { ownerAddress: owner, session: { sessionId: "session", transaction: { sourceAmount: "60" } } })[0].session.transaction?.sourceAmount, "60");
});

test("history polls saved pending sessions only when open, updates amounts and method, and stops at settlement", async () => {
  save([makeEntry(), makeEntry("FAILED", "failed"), makeEntry("SETTLED", "done")]);
  let calls = 0;
  const requests: RequestInit[] = [];
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), `${baseUrl}/api/v1/onramp/sessions/session`);
    requests.push(init!);
    return Response.json({ transaction: {
      status: calls === 1 ? "SETTLING" : "SETTLED", destinationAmount: "14.57",
      paymentMethodType: "APPLE_PAY", sourceAmount: "61", sourceCurrencyCode: "AED", chainId: "10",
    } });
  };
  await act(async () => { renderer = create(<Harness />); });
  await flush();
  assert.equal(calls, 0);
  await act(async () => renderer!.update(<Harness active />));
  await flush();
  assert.equal(calls, 1);
  assert.equal(requests[0].method, "GET");
  assert.equal(requests[0].cache, "no-store");
  assert.equal((requests[0].headers as any)["x-nexus-client"], "nexus-widgets");
  const entry = result.entries.find((item) => item.id === "onramp:session")!;
  assert.equal(entry.session.transaction?.destinationAmount, "14.57");
  assert.equal(entry.session.transaction?.sourceAmount, "61");
  assert.equal(entry.session.paymentMethodType, "APPLE_PAY");
  await act(async () => { windowEvents.dispatchEvent(new Event("focus")); });
  await flush();
  assert.equal(calls, 2);
  assert.equal(readOnrampHistory(owner, baseUrl).find((item) => item.id === entry.id)?.session.state, "SETTLED");
  await act(async () => { windowEvents.dispatchEvent(new Event("focus")); });
  await flush();
  assert.equal(calls, 2);
});

test("polling coalesces refresh events and preserves pending data on request failure", async () => {
  save([makeEntry()]);
  let calls = 0;
  let resolve!: (response: Response) => void;
  globalThis.fetch = async () => {
    calls++;
    return new Promise<Response>((r) => { resolve = r; });
  };
  await act(async () => { renderer = create(<Harness active />); });
  await act(async () => {
    windowEvents.dispatchEvent(new Event("focus"));
    windowEvents.dispatchEvent(new Event("online"));
  });
  assert.equal(calls, 1);
  await act(async () => resolve(Response.json({}, { status: 503 })));
  await flush();
  assert.equal(result.entries[0].session.state, "PENDING");
  assert.equal(result.entries[0].context.sourceAmount, "60");
  await act(async () => { windowEvents.dispatchEvent(new Event("focus")); });
  assert.equal(calls, 2);
  await act(async () => resolve(Response.json({ state: "FAILED" })));
  await flush();
  assert.equal(result.entries[0].session.state, "FAILED");
});

test("closing history aborts pending reads and ignores late responses", async () => {
  save([makeEntry()]);
  let resolve!: (response: Response) => void;
  let signal!: AbortSignal;
  globalThis.fetch = async (_url, init) => {
    signal = init!.signal!;
    return new Promise<Response>((r) => { resolve = r; });
  };
  await act(async () => { renderer = create(<Harness active />); });
  await act(async () => renderer!.update(<Harness />));
  assert.equal(signal.aborted, true);
  await act(async () => resolve(Response.json({ state: "SETTLED" })));
  await flush();
  assert.equal(result.entries[0].session.state, "PENDING");
});

test("switching wallets archives delayed callbacks under the initiating wallet without leaking history", async () => {
  save([makeEntry()]);
  await act(async () => { renderer = create(<Harness />); });
  const oldRecorder = result.recordSession;
  await act(async () => renderer!.update(<Harness address={otherOwner} />));
  assert.equal(result.entries.length, 0);
  await act(async () => oldRecorder({ ownerAddress: owner, session: { sessionId: "session", state: "SETTLED" } }));
  assert.equal(result.entries.length, 0);
  assert.equal(readOnrampHistory(owner, baseUrl)[0].session.state, "SETTLED");
  assert.equal(readOnrampHistory(otherOwner, baseUrl).length, 0);
  await act(async () => result.recordSession({ ownerAddress: owner, session: { sessionId: "new-delayed-session", state: "PENDING" } }));
  assert.equal(result.entries.length, 0);
  assert.equal(readOnrampHistory(owner, baseUrl).length, 2);
  await act(async () => renderer!.update(<Harness />));
  assert.equal(result.entries.length, 2);
});

test("blocked local storage still allows in-memory history", async () => {
  window.localStorage.getItem = () => { throw new Error("denied"); };
  window.localStorage.setItem = () => { throw new Error("denied"); };
  await act(async () => { renderer = create(<Harness />); });
  await act(async () => result.recordSession({ ownerAddress: owner, session: { sessionId: "session", state: "PENDING" } }));
  assert.equal(result.entries.length, 1);
});

test("onramp cards show actual fiat and received tokens; payment method is omitted when unavailable", () => {
  const [entry] = upsertOnrampHistory([makeEntry()], {
    ownerAddress: owner,
    session: { sessionId: "session", state: "SETTLED", paymentMethodType: "APPLE_PAY", transaction: { destinationAmount: "14.57", sourceAmount: "61", sourceCurrencyCode: "AED" } },
  });
  const html = renderToStaticMarkup(<OnrampHistoryCard entry={entry} relativeTime="Just now" chainName="Optimism" />);
  assert.match(html, /Onramp · Banxa/);
  assert.match(html, /14\.57 USDC/);
  assert.match(html, /Received on Optimism/);
  assert.match(html, /Fiat spent: 61 AED/);
  assert.match(html, /Apple Pay/);
  assert.match(html, /Completed/);
  const unknown = { ...makeEntry(), context: {} };
  assert.doesNotMatch(renderToStaticMarkup(<OnrampHistoryCard entry={unknown} relativeTime="Just now" />), /Payment method:/);
  for (const [state, label] of [["PENDING", "Pending"], ["ERROR", "Pending"], ["FAILED", "Failed"], ["CANCELLED", "Cancelled"], ["REFUNDED", "Refunded"]]) {
    const markup = renderToStaticMarkup(<OnrampHistoryCard entry={makeEntry(state)} relativeTime="Just now" />);
    assert.match(markup, new RegExp(label));
    assert.match(markup, /Fiat amount: 60 AED/);
    assert.doesNotMatch(markup, /Fiat spent/);
  }
});
