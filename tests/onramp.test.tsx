import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { EventEmitter } from "node:events";
import React from "react";
import { parseUnits } from "viem";
import type { OnrampHistoryUpdate } from "../registry/avail-widgets/nexus-widget/utils/onramp-history";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { DepositFundingMethod } from "../registry/avail-widgets/nexus-widget/components/deposit-funding-method";
import { DepositOnrampFlow } from "../registry/avail-widgets/nexus-widget/components/deposit-onramp-flow";
import { readOnrampWalletAddress, withOnrampWalletTimeout } from "../registry/avail-widgets/nexus-widget/utils/use-onramp-wallet";
import {
  getOnrampRemainingAmount,
  isOnrampTerminalState,
  logOnramp,
  normalizeOnrampSession,
  startOnrampPolling,
  waitForOnrampReceipt,
} from "../registry/avail-widgets/nexus-widget/utils/onramp-session";

const account = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}`;
const originalFetch = globalThis.fetch;
const originalLog = console.log;
let renderer: ReactTestRenderer | undefined;
let logs: string[] = [];
let windowEvents: EventTarget;
const flush = async () => {
  for (let i = 0; i < 8; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};

afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  globalThis.fetch = originalFetch;
  console.log = originalLog;
  delete (globalThis as any).window;
  delete (globalThis as any).document;
});

const mountFlow = async ({
  raw = true,
  wallet = true,
  receiptError = false,
  gasSwap = false,
  status = "SETTLED",
  needsApproval = false,
  providerConnected = true,
  resume = true,
  quoteFlow = false,
  initialChainId = 8453,
  destinationChainId = 8453,
  settlementChainId = String(destinationChainId) as string | number,
  receivedAmount = "10",
  actualPaymentMethod = undefined as string | undefined,
  actualSourceAmount = undefined as string | undefined,
  optionsData = undefined as any,
  mockCountry = "US",
  countryIsError = false,
  ipApiError = false,
  ipapiCoError = false,
  cloudflareError = false,
  storage = undefined as Map<string, string> | undefined,
  routesData = undefined as any,
} = {}) => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  logs = [];
  console.log = (...args) => {
    logs.push(args.join(" "));
  };
  windowEvents = new EventTarget();
  const sharedStorage = storage ?? new Map<string, string>();
  const fakeWindow = Object.assign(windowEvents, {
    location: { origin: "https://example.com", href: "https://example.com/" },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage: {
      getItem: (k: string) => sharedStorage.get(k) ?? null,
      setItem: (k: string, v: string) => sharedStorage.set(k, String(v)),
      removeItem: (k: string) => sharedStorage.delete(k),
    },
    open: () => ({ document: { body: { style: {} } }, location: { href: "" }, close() {} }),
  });
  (globalThis as any).window = fakeWindow;
  (globalThis as any).document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  let resolveReceipt!: (value: Response) => void;
  let paymentStatus = status;
  let sends = 0;
  let approvals = 0;
  let approvalConfirmed = false;
  let walletChainId = initialChainId;
  let swaps = 0;
  let receiptCalls = 0;
  let connectCalls = 0;
  let sessionCreates = 0;
  let liveAccount = account;
  const quoteWallets: string[] = [];
  const states: Array<string | null> = [];
  const historyUpdates: OnrampHistoryUpdate[] = [];
  const depositedAmounts: bigint[] = [];
  const submittedData: string[] = [];
  const statusRequests: RequestInit[] = [];
  const rpcResponse = (result: unknown) =>
    Response.json({ jsonrpc: "2.0", id: 1, result });
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.includes("/sessions/")) {
      statusRequests.push(init ?? {});
      return Response.json(
        raw
          ? {
              transaction: {
                id: "meld-tx",
                status: paymentStatus,
                destinationAmount: Number(receivedAmount),
                paymentMethodType: actualPaymentMethod,
                sourceAmount: actualSourceAmount,
                sourceCurrencyCode: actualSourceAmount ? "AED" : undefined,
                cryptoDetails: {
                  walletAddress: account,
                  chainId: settlementChainId,
                },
              },
            }
          : {
              sessionId: "session",
              state: paymentStatus,
              transaction: {
                destinationAmount: receivedAmount,
                paymentMethodType: actualPaymentMethod,
                sourceAmount: actualSourceAmount,
                sourceCurrencyCode: actualSourceAmount ? "AED" : undefined,
                walletAddress: account,
                chainId: settlementChainId,
              },
            },
      );
    }
    if (path.includes("/options"))
      return Response.json(
        typeof optionsData === "function"
          ? optionsData(path)
          : (optionsData ?? {
              countries: [{ countryCode: "US", name: "United States" }],
              selection: {
                countryCode: "US",
                defaultFiat: "USD",
                fiatCurrencies: ["USD"],
              },
            }),
      );
    if (path.includes("/routes")) {
      if (routesData) {
        const data = typeof routesData === "function" ? routesData(path) : routesData;
        return Response.json(data);
      }
      return Response.json({ routes: quoteFlow ? [{ provider: "BANXA", paymentMethods: [{ method: "CREDIT_DEBIT_CARD" }] }] : [] });
    }
    if (path.endsWith("/quote")) {
      const body = JSON.parse(String(init?.body));
      quoteWallets.push(body.walletAddress);
      return Response.json({ quotes: [{ provider: "BANXA", paymentMethodType: "CREDIT_DEBIT_CARD", destinationCurrencyCode: "USDC_BASE", destinationAmount: "10", sourceAmount: body.sourceAmount, sourceCurrencyCode: "USD" }] });
    }
    if (path.endsWith("/sessions")) {
      sessionCreates++;
      return Response.json({ sessionId: "session", state: "PENDING", widgetUrl: "https://example.com/checkout" });
    }
    if (path.includes("country.is")) {
      if (countryIsError) return new Response("Service Unavailable", { status: 503 });
      return Response.json({ country: mockCountry });
    }
    if (path.includes("ip-api.com")) {
      if (ipApiError) return new Response("Fail", { status: 500 });
      return Response.json({ status: "success", countryCode: mockCountry });
    }
    if (path.includes("ipapi.co")) {
      if (ipapiCoError) return new Response("Fail", { status: 500 });
      return Response.json({ country: mockCountry, country_code: mockCountry });
    }
    if (path.includes("cloudflare.com")) {
      if (cloudflareError) return new Response("Fail", { status: 500 });
      return new Response(JSON.stringify({ country: mockCountry }));
    }
    if (path.includes("open.er-api.com"))
      return Response.json({ rates: { USD: 1 } });
    const body = JSON.parse(String(init?.body));
    switch (body.method) {
      case "eth_call":
        return rpcResponse(
          `0x${(gasSwap ? (swaps ? 108_000_000 : 110_000_000) : parseUnits(receivedAmount, 6)).toString(16)}`,
        );
      case "eth_getTransactionReceipt":
        receiptCalls++;
        if (receiptError && receiptCalls === 1)
          return Response.json({
            error: { message: "RPC temporarily unavailable" },
          });
        return new Promise<Response>((resolve) => {
          resolveReceipt = resolve;
        });
      default:
        throw new Error(`Unexpected fetch ${path}: ${body.method}`);
    }
  };
  const walletClient = {
    account: { address: account },
    chain: { id: initialChainId },
    request: async ({ method }: { method: string }) => {
      switch (method) {
        case "eth_chainId":
          return `0x${walletChainId.toString(16)}`;
        case "eth_accounts":
          return [liveAccount];
        case "eth_call":
          return approvalConfirmed ? "0xffffffffff" : "0x0";
        case "eth_maxPriorityFeePerGas":
          return "0x3b9aca00";
        case "eth_getBlockByNumber":
          return { baseFeePerGas: "0x3b9aca00" };
        case "eth_getBalance":
          return gasSwap && !swaps ? "0x0" : "0xde0b6b3a7640000";
        default:
          throw new Error(`Unexpected wallet method ${method}`);
      }
    },
    switchChain: async ({ id }: { id: number }) => {
      walletChainId = id;
      walletClient.chain = { id };
      provider.emit("chainChanged", `0x${id.toString(16)}`);
    },
    writeContract: async () => {
      approvals++;
      return hash;
    },
    sendTransaction: async ({ data }: { data: string }) => {
      sends++;
      submittedData.push(data);
      return hash;
    },
  };
  const provider = Object.assign(new EventEmitter(), {
    get connected() { return providerConnected; },
    request: walletClient.request,
  });
  // Object.assign copies getters as values; keep connection state live for event tests.
  Object.defineProperty(provider, "connected", { get: () => providerConnected });
  const getWalletProvider = async () => provider as any;
  const sdk = {
    swapWithExactOut: async (_input: unknown, options: any) => {
      options.onEvent({ type: "status", status: "preparing" });
      options.hooks.onIntent({
        intent: { sources: [] },
        allow: () => {},
        deny: () => {
          throw new Error("denied");
        },
      });
      swaps++;
      options.onEvent({ type: "status", status: "completed" });
      return { intentExplorerUrl: "https://example.com/intent" };
    },
  };
  const renderFlow = () => (
      <DepositOnrampFlow
        getWalletProvider={getWalletProvider}
        walletConnected={wallet}
        baseUrl="https://nexus-v2.canary.avail.so/middleware"
        ownerAddress={account}
        walletClient={wallet ? (walletClient as any) : null}
        nexusSDK={sdk}
        opportunity={{
          chainId: destinationChainId,
          tokenAddress: token,
          tokenDecimals: 6,
          tokenSymbol: "USDC",
          executeDeposit: (_symbol, _token, amount) => {
            depositedAmounts.push(amount);
            return ({
            to: account,
            tokenApproval: needsApproval ? { toTokenAddress: token, spender: account, amount } : undefined,
            gas: BigInt(100000),
            value: BigInt(0),
            data: `0x${amount.toString(16).padStart(64, "0")}`,
            });
          },
        }}
        toToken={
          {
            chainId: destinationChainId,
            contractAddress: token,
            decimals: 6,
            symbol: "USDC",
            name: "USD Coin",
            balance: "0",
          } as any
        }
        onConnectWallet={() => { connectCalls++; }}
        onSessionStateChange={(state) => states.push(state)}
        onSessionUpdate={(update) => historyUpdates.push(update)}
        primaryButtonForeground="#fff"
      />
  );
  await act(async () => { renderer = create(renderFlow()); });
  await flush();
  if (resume) await act(async () => { window.setRampSessionId?.("session"); });
  await flush();
  return {
    states,
    historyUpdates,
    depositedAmounts,
    submittedData,
    setStatus: (value: string) => { paymentStatus = value; },
    statusRequests,
    sends: () => sends,
    swaps: () => swaps,
    approvals: () => approvals,
    connectCalls: () => connectCalls,
    quoteWallets,
    sessionCreates: () => sessionCreates,
    provider,
    silentlyDisconnect: () => { providerConnected = false; },
    disconnect: async () => {
      providerConnected = false;
      await act(async () => { provider.emit("disconnect"); });
      await flush();
    },
    reconnect: async (address = account) => {
      providerConnected = true;
      liveAccount = address;
      walletClient.account.address = address;
      wallet = true;
      await act(async () => { renderer!.update(renderFlow()); provider.emit("connect"); });
      await flush();
    },
    confirm: async () => {
      if (approvals && !sends) approvalConfirmed = true;
      resolveReceipt(rpcResponse({ status: "0x1" }));
      await flush();
    },
  };
};

test("raw Meld settlement on canary deposits despite zero cached UI balance and waits for the receipt", async () => {
  const flow = await mountFlow();
  assert.equal(flow.sends(), 1);
  assert.ok(!flow.states.includes("DEPOSIT_SUCCESS"));
  assert.equal(flow.statusRequests[0].cache, "no-store");
  await flow.confirm();
  assert.equal(flow.states.at(-1), "DEPOSIT_SUCCESS");
  assert.ok(logs.some((log) => log.includes("deposit.confirmed")));
});

test("middleware settlement also waits for a real receipt; RPC failure retry checks the same hash", async () => {
  const flow = await mountFlow({ raw: false, receiptError: true });
  assert.equal(flow.sends(), 1);
  assert.equal(flow.states.at(-1), "DEPOSIT_FAILED");
  const panel = renderer!.root.find(
    (node) => typeof node.props.onRetryDeposit === "function",
  );
  await act(async () => panel.props.onRetryDeposit());
  await flush();
  assert.equal(flow.sends(), 1);
  await flow.confirm();
  assert.equal(flow.states.at(-1), "DEPOSIT_SUCCESS");
});

for (const raw of [false, true]) {
  for (const settlementChainId of ["10", "EVM_10", "0xa", 10]) {
    test(`${raw ? "Meld" : "middleware"} Optimism settlement with chain ${JSON.stringify(settlementChainId)} confirms the deposit before success`, async () => {
      const flow = await mountFlow({
        raw,
        destinationChainId: 10,
        settlementChainId,
      });
      assert.equal(flow.sends(), 1);
      assert.ok(!flow.states.includes("DEPOSIT_SUCCESS"));
      await flow.confirm();
      assert.equal(flow.states.at(-1), "DEPOSIT_SUCCESS");
    });
  }

  test(`${raw ? "Meld" : "middleware"} settlement on a different chain blocks an Optimism deposit`, async () => {
    const flow = await mountFlow({
      raw,
      destinationChainId: 10,
      settlementChainId: "8453",
    });
    assert.equal(flow.sends(), 0);
    assert.equal(flow.approvals(), 0);
    assert.equal(flow.states.at(-1), "DEPOSIT_FAILED");
    assert.ok(logs.some((log) =>
      log.includes("The payment was delivered on a different chain"),
    ));
  });
}

test("settlement without a wallet requests reconnection and preserves the settled purchase", async () => {
  const flow = await mountFlow({ wallet: false });
  assert.equal(flow.sends(), 0);
  assert.equal(flow.states.at(-1), "SETTLED");
  assert.ok(renderer!.root.findByProps({ title: "Connect your wallet to deposit" }));
  assert.ok(!flow.states.includes("DEPOSIT_SUCCESS"));
  await flow.reconnect();
  assert.equal(flow.sends(), 1);
  await flow.confirm();
  assert.equal(flow.states.at(-1), "DEPOSIT_SUCCESS");
});

test("gas swap logs every SDK event and deposits only the purchase minus gas, leaving pre-existing funds", async () => {
  const flow = await mountFlow({ gasSwap: true });
  assert.equal(flow.swaps(), 1);
  assert.equal(flow.sends(), 1);
  await flow.confirm();
  assert.equal(logs.filter((log) => log.includes("sdk.event")).length, 2);
  assert.ok(
    logs.some(
      (log) =>
        log.includes("deposit.confirmed") && log.includes('"amount":"8"'),
    ),
  );
});

test("a stored address and wallet client cannot authorize deposit with a disconnected provider", async () => {
  const flow = await mountFlow({ providerConnected: false });
  assert.equal(flow.sends(), 0);
  const panel = renderer!.root.findByProps({ title: "Connect your wallet to deposit" });
  await act(async () => panel.props.onPrimary());
  assert.equal(flow.connectCalls(), 1);
  assert.equal(flow.sends(), 0);
  await flow.reconnect();
  assert.equal(flow.sends(), 1);
  await flow.confirm();
  assert.equal(flow.states.at(-1), "DEPOSIT_SUCCESS");
  assert.equal(flow.sessionCreates(), 0);
});

test("disconnect during provider checkout pauses the settled deposit until reconnect", async () => {
  const flow = await mountFlow({ status: "PENDING" });
  await flow.disconnect();
  flow.setStatus("SETTLED");
  await act(async () => { windowEvents.dispatchEvent(new Event("focus")); });
  await flush();
  assert.equal(flow.sends(), 0);
  assert.ok(renderer!.root.findByProps({ title: "Connect your wallet to deposit" }));
  await flow.reconnect();
  assert.equal(flow.sends(), 1);
  await flow.confirm();
});

test("reconnecting another wallet never spends the wrong account's funds for a settled purchase", async () => {
  const flow = await mountFlow({ providerConnected: false });
  await flow.reconnect("0x3333333333333333333333333333333333333333");
  assert.equal(flow.sends(), 0);
  assert.equal(flow.states.at(-1), "DEPOSIT_FAILED");
  assert.ok(logs.some(log => log.includes("Connect the wallet that received this onramp payment")));
});

const waitForQuotes = async () => {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
  await flush();
};
const buttonText = (button: any) => button.children.filter((child: unknown) => typeof child === "string").join("");

test("changed checkout amount and payment method drive the deposit, summary, and history", async () => {
  const flow = await mountFlow({
    resume: false, quoteFlow: true, receivedAmount: "14.57",
    actualSourceAmount: "60", actualPaymentMethod: "APPLE_PAY",
  });
  await act(async () => renderer!.root.findByType("input").props.onChange({ target: { value: "50" } }));
  await waitForQuotes();
  const pay = renderer!.root.findAllByType("button").find((button) => buttonText(button).startsWith("Pay "))!;
  assert.ok(pay && !pay.props.disabled);
  await act(async () => pay.props.onClick());
  await flush();
  assert.equal(flow.sends(), 1);
  assert.equal(BigInt(flow.submittedData[0]), parseUnits("14.57", 6));
  assert.ok(flow.historyUpdates.some((update) => update.session.state === "PENDING"));
  const update = flow.historyUpdates.at(-1)!;
  assert.equal(update.context?.destinationAmount, "10");
  assert.equal(update.context?.sourceAmount, "50");
  assert.equal(update.context?.provider, "BANXA");
  assert.equal(update.session.transaction?.destinationAmount, "14.57");
  assert.equal(update.session.transaction?.sourceAmount, "60");
  assert.equal(update.session.paymentMethodType, "APPLE_PAY");
  await flow.confirm();
  assert.equal(renderer!.root.findByProps({ label: "Payment method" }).props.value, "Apple Pay");
  assert.match(renderer!.root.findByProps({ label: "Deposit amount" }).props.value, /14\.57/);
  assert.match(renderer!.root.findByProps({ label: "Total charged" }).props.value, /60/);
});

test("failed onramp payments are reported to history without a deposit", async () => {
  const flow = await mountFlow({ status: "FAILED", actualSourceAmount: "60" });
  assert.equal(flow.sends(), 0);
  assert.equal(flow.historyUpdates.at(-1)?.session.state, "FAILED");
  assert.equal(flow.historyUpdates.at(-1)?.session.transaction?.sourceAmount, "60");
});

test("quotes show Connect Wallet for stale persisted addresses and refresh for the live account before Pay", async () => {
  const flow = await mountFlow({ resume: false, quoteFlow: true, providerConnected: false });
  await act(async () => renderer!.root.findByType("input").props.onChange({ target: { value: "50" } }));
  await waitForQuotes();
  const connect = renderer!.root.findAllByType("button").find(button => buttonText(button) === "Connect Wallet")!;
  assert.ok(connect);
  assert.equal(connect.props.disabled, false);
  assert.notEqual(flow.quoteWallets.at(-1)?.toLowerCase(), account.toLowerCase());
  await act(async () => connect.props.onClick());
  await flush();
  assert.equal(flow.connectCalls(), 1);
  assert.equal(flow.sessionCreates(), 0);
  const connectedAccount = "0x3333333333333333333333333333333333333333";
  await flow.reconnect(connectedAccount);
  assert.equal(renderer!.root.findAllByType("button").filter(button => buttonText(button).startsWith("Pay ") && !button.props.disabled).length, 0);
  await waitForQuotes();
  assert.equal(flow.quoteWallets.at(-1), connectedAccount);
  assert.ok(renderer!.root.findAllByType("button").some(button => buttonText(button).startsWith("Pay ") && !button.props.disabled));
  const before = flow.quoteWallets.length;
  await flow.disconnect();
  await flow.reconnect(connectedAccount);
  await waitForQuotes();
  assert.ok(flow.quoteWallets.length > before, "same-address reconnect also invalidates the old quote");
});

test("WalletConnect missing/expired sessions and empty provider accounts are not connections", async () => {
  for (const connection of [{ connected: false }, { session: undefined }, { session: { expiry: 1 } }]) {
    let requests = 0;
    const address = await readOnrampWalletAddress({ ...connection, request: async () => { requests++; return [account]; } } as any);
    assert.equal(address, undefined);
    assert.equal(requests, 0);
  }
  assert.equal(await readOnrampWalletAddress({ request: async ({method}: any) => method === "eth_accounts" ? [] : "0x1" } as any), undefined);
});

test("Pay rechecks the provider and does not create a payment when it disconnected without an event", async () => {
  const flow = await mountFlow({ resume: false, quoteFlow: true });
  await act(async () => renderer!.root.findByType("input").props.onChange({ target: { value: "50" } }));
  await waitForQuotes();
  const pay = renderer!.root.findAllByType("button").find(button => buttonText(button).startsWith("Pay "))!;
  assert.ok(pay);
  flow.silentlyDisconnect();
  await act(async () => pay.props.onClick());
  await flush();
  assert.equal(flow.sessionCreates(), 0);
});

test("disconnect while approval confirms blocks deposit until the funded wallet reconnects", async () => {
  const flow = await mountFlow({ needsApproval: true });
  assert.equal(flow.approvals(), 1);
  await flow.disconnect();
  await flow.confirm();
  assert.equal(flow.sends(), 0);
  await flow.reconnect();
  const panel = renderer!.root.find(node => typeof node.props.onRetryDeposit === "function");
  await act(async () => panel.props.onRetryDeposit());
  await flush();
  assert.equal(flow.sends(), 1);
  assert.equal(flow.approvals(), 1);
  await flow.confirm();
});

test("switching to the deposit chain does not falsely disconnect the verified wallet", async () => {
  const flow = await mountFlow({ initialChainId: 10 });
  assert.equal(flow.sends(), 1);
  await flow.confirm();
  assert.equal(flow.states.at(-1), "DEPOSIT_SUCCESS");
});

test("wallet checks time out, and provider listeners are removed on unmount", async () => {
  await assert.rejects(withOnrampWalletTimeout(() => new Promise(() => {}), new AbortController().signal, 5), /did not respond/);
  const flow = await mountFlow({ status: "PENDING" });
  assert.ok(flow.provider.listenerCount("disconnect") > 0);
  await act(async () => renderer!.unmount());
  renderer = undefined;
  assert.equal(flow.provider.eventNames().length, 0);
});

test("Meld states: ERROR/partial/2FA keep polling; all documented final states stop", () => {
  for (const status of [
    "ERROR",
    "PENDING",
    "PENDING CREATED",
    "SETTLING",
    "TWO_FA_REQUIRED",
    "TWO_FA_PROVIDED",
    "PARTIALLY_SETTLED",
    "ACCEPTED",
    "AUTHORIZED",
  ])
    assert.equal(isOnrampTerminalState(status), false, status);
  for (const status of [
    "SETTLED",
    "FAILED",
    "DECLINED",
    "CANCELLED",
    "REFUNDED",
    "AUTHORIZATION_EXPIRED",
  ])
    assert.equal(isOnrampTerminalState(status), true, status);
  const normalized = normalizeOnrampSession(
    {
      state: "PENDING",
      transaction: {
        status: "SETTLED",
        destinationAmount: 12.5,
        cryptoDetails: { blockchainTransactionId: hash, chainId: "8453" },
      },
    },
    "our-session",
  );
  assert.equal(normalized.state, "SETTLED");
  assert.equal(normalized.sessionId, "our-session");
  assert.equal(normalized.transaction?.txHash, hash);
  assert.equal(normalized.transaction?.destinationAmount, "12.5");
});

test("polling never overlaps; stop aborts the request and ignores a late response", async () => {
  let resolve!: (value: string) => void;
  let requests = 0;
  let applied = 0;
  let signal!: AbortSignal;
  const poller = startOnrampPolling({
    fetchSession: async (s) => {
      signal = s;
      requests++;
      return new Promise<string>((r) => {
        resolve = r;
      });
    },
    onData: () => {
      applied++;
      return false;
    },
    onError: () => {},
    intervalMs: 1,
  });
  void poller.refresh();
  void poller.refresh();
  assert.equal(requests, 1);
  poller.stop();
  assert.equal(signal.aborted, true);
  resolve("SETTLED");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(applied, 0);
  assert.equal(requests, 1);
});

test("receipt success requires status 0x1; reverted and pending receipts never pass", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(
    waitForOnrampReceipt(async () => ({ status: "0x0" }), signal),
    /reverted/,
  );
  await assert.rejects(
    waitForOnrampReceipt(async () => ({}), signal, {
      timeoutMs: 5,
      intervalMs: 1,
    }),
    /pending/,
  );
  assert.deepEqual(
    await waitForOnrampReceipt(async () => ({ status: "0x1" }), signal),
    { status: "0x1" },
  );
  assert.equal(
    getOnrampRemainingAmount(BigInt(10), BigInt(110), BigInt(108)),
    BigInt(8),
  );
});

test("logs use immutable JSON snapshots and redact checkout secrets", () => {
  const output: unknown[][] = [];
  console.log = (...args) => {
    output.push(args);
  };
  logOnramp("test", {
    amount: BigInt(123),
    token: "secret",
    widgetUrl: "https://provider/?token=secret",
  });
  assert.match(String(output[0][0]), /^\[Nexus Onramp\]/);
  assert.ok(!String(output[0][1]).includes("secret"));
  assert.match(String(output[0][1]), /123/);
});

test("provider return is only a refresh hint; focus picks up settlement immediately", async () => {
  const flow = await mountFlow({ status: "PENDING" });
  assert.equal(flow.sends(), 0);
  const returned = Object.assign(new Event("message"), { origin: "https://example.com", data: "nexus-onramp-success", source: { postMessage() {} } });
  await act(async () => { windowEvents.dispatchEvent(returned); });
  await flush();
  assert.equal(flow.sends(), 0);
  assert.ok(!flow.states.includes("DEPOSIT_SUCCESS"));
  flow.setStatus("SETTLED");
  await act(async () => { windowEvents.dispatchEvent(new Event("focus")); });
  await flush();
  assert.equal(flow.sends(), 1);
  await flow.confirm();
  assert.equal(flow.states.at(-1), "DEPOSIT_SUCCESS");
});

test("approval must confirm before deposit is sent, and deposit must confirm before success", async () => {
  const flow = await mountFlow({ needsApproval: true });
  assert.equal(flow.approvals(), 1);
  assert.equal(flow.sends(), 0);
  await flow.confirm();
  assert.equal(flow.sends(), 1);
  assert.ok(!flow.states.includes("DEPOSIT_SUCCESS"));
  await flow.confirm();
  assert.equal(flow.states.at(-1), "DEPOSIT_SUCCESS");
});

test("unmount while approval is pending prevents the subsequent deposit", async () => {
  const flow = await mountFlow({ needsApproval: true });
  assert.equal(flow.approvals(), 1);
  await act(async () => renderer!.unmount());
  renderer = undefined;
  await flow.confirm();
  assert.equal(flow.sends(), 0);
  assert.ok(!flow.states.includes("DEPOSIT_SUCCESS"));
  assert.equal(window.setRampSessionId, undefined);
});

test("polling retries transient errors and stops its timer after a terminal response", async () => {
  let requests = 0;
  let errors = 0;
  const poller = startOnrampPolling({
    fetchSession: async () => { requests++; if (requests === 1) throw new Error("temporary"); return "SETTLED"; },
    onData: isOnrampTerminalState,
    onError: () => { errors++; },
    intervalMs: 1,
  });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(requests, 2);
  assert.equal(errors, 1);
  await poller.refresh();
  assert.equal(requests, 2);
  poller.stop();
});

test("onramp funding is opt-in; the default only offers wallet funding", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let walletSelections = 0;
  let onrampSelections = 0;
  await act(async () => {
    renderer = create(<DepositFundingMethod
      onSelectWallet={() => { walletSelections++; }}
      onSelectLocalCurrency={() => { onrampSelections++; }}
      primaryButtonForeground="#fff"
      totalBalance="10"
    />);
  });
  assert.equal(renderer!.root.findAllByProps({ label: "Deposit with Cash" }).length, 0);
  await act(async () => renderer!.root.findByProps({ label: "Deposit with Wallet" }).props.onClick());
  await act(async () => renderer!.root.findAllByType("button").find(button => button.children.includes("Continue"))!.props.onClick());
  assert.equal(walletSelections, 1);
  assert.equal(onrampSelections, 0);
});

test("disabling onramp clears a selected local currency option and prevents continuing it", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let onrampSelections = 0;
  const props = {
    onSelectWallet: () => {},
    onSelectLocalCurrency: () => { onrampSelections++; },
    primaryButtonForeground: "#fff",
    totalBalance: "10",
  };
  await act(async () => { renderer = create(<DepositFundingMethod {...props} enableOnRamp />); });
  await act(async () => renderer!.root.findByProps({ label: "Deposit with Cash" }).props.onClick());
  await act(async () => renderer!.root.findAllByType("button").find(button => button.children.includes("Continue"))!.props.onClick());
  assert.equal(onrampSelections, 1);
  await act(async () => renderer!.update(<DepositFundingMethod {...props} enableOnRamp={false} />));
  assert.equal(renderer!.root.findAllByProps({ label: "Deposit with Cash" }).length, 0);
  const continueButton = renderer!.root.findAllByType("button").find(button => button.children.includes("Continue"))!;
  assert.equal(continueButton.props.disabled, true);
  await act(async () => continueButton.props.onClick());
  assert.equal(onrampSelections, 1);
});

test("options response caches provider and fiat metadata and renders logo and friendly name", async () => {
  const optionsData = {
    countries: [{ countryCode: "US", name: "United States" }],
    providers: [
      {
        provider: "BANXA",
        name: "Banxa",
        logo: {
          lightShort: "https://cdn.meld.io/images-serviceprovider/BANXA/short_logo_light.png",
          darkShort: "https://cdn.meld.io/images-serviceprovider/BANXA/short_logo_dark.png",
        },
      },
    ],
    selection: {
      countryCode: "US",
      defaultFiat: "USD",
      fiatCurrencies: ["USD"],
      fiatCurrencyMetadata: [
        {
          currencyCode: "USD",
          name: "US Dollar",
          decimals: 2,
          symbolUrl: "https://cdn.meld.io/images-currency/fiat/USD/symbol.png",
        },
      ],
    },
  };

  await mountFlow({ resume: false, quoteFlow: true, optionsData });
  await act(async () => renderer!.root.findByType("input").props.onChange({ target: { value: "50" } }));
  await waitForQuotes();

  const imgs = renderer!.root.findAllByType("img");
  const currencyImg = imgs.find((img) =>
    img.props.src?.includes("USD/symbol.png"),
  );
  assert.ok(currencyImg, "Expected currency logo img to be rendered");
  assert.equal(
    currencyImg.props.src,
    "https://cdn.meld.io/images-currency/fiat/USD/symbol.png",
  );

  const partnerLabel = renderer!.root.findAll((node) =>
    node.children?.includes("Banxa"),
  );
  assert.ok(partnerLabel.length > 0, "Expected friendly provider name Banxa");

  const providerImg = imgs.find((img) =>
    img.props.src?.includes("BANXA/short_logo_light.png"),
  );
  assert.ok(providerImg, "Expected provider short logo img to be rendered");
});

test("options response in dark mode renders dark short logo", async () => {
  const optionsData = {
    countries: [{ countryCode: "US", name: "United States" }],
    providers: [
      {
        provider: "BANXA",
        name: "Banxa",
        logo: {
          lightShort: "https://cdn.meld.io/images-serviceprovider/BANXA/short_logo_light.png",
          darkShort: "https://cdn.meld.io/images-serviceprovider/BANXA/short_logo_dark.png",
        },
      },
    ],
    selection: {
      countryCode: "US",
      defaultFiat: "USD",
      fiatCurrencies: ["USD"],
    },
  };

  await mountFlow({ resume: false, quoteFlow: true, optionsData });
  (globalThis as any).document.documentElement = {
    classList: { contains: (c: string) => c === "dark" },
    getAttribute: (a: string) => (a === "data-theme" ? "dark" : null),
  };
  await act(async () => renderer!.root.findByType("input").props.onChange({ target: { value: "50" } }));
  await waitForQuotes();

  const imgs = renderer!.root.findAllByType("img");
  const darkProviderImg = imgs.find((img) =>
    img.props.src?.includes("BANXA/short_logo_dark.png"),
  );
  assert.ok(darkProviderImg, "Expected provider dark short logo img to be rendered in dark mode");
});

test("country picker pre-fills with country.is resolved country and displays top country button", async () => {
  const optionsData = (path: string) => {
    if (path.includes("countryCode=IN")) {
      return {
        countries: [
          { countryCode: "IN", name: "India", flagUrl: "https://example.com/in.png" },
          { countryCode: "US", name: "United States", flagUrl: "https://example.com/us.png" },
        ],
        selection: {
          countryCode: "IN",
          defaultFiat: "INR",
          fiatCurrencies: ["INR"],
        },
      };
    }
    return {
      countries: [
        { countryCode: "IN", name: "India", flagUrl: "https://example.com/in.png" },
        { countryCode: "US", name: "United States", flagUrl: "https://example.com/us.png" },
      ],
      selection: {
        countryCode: "US",
        defaultFiat: "USD",
        fiatCurrencies: ["USD"],
      },
    };
  };

  await mountFlow({ resume: false, mockCountry: "IN", optionsData });

  const countryButton = renderer!.root.findByProps({ "aria-label": "Select country" });
  assert.ok(countryButton, "Expected country picker button in top section");

  const inrPill = renderer!.root.findAll((node) => node.children?.includes("INR"));
  assert.ok(inrPill.length > 0, "Expected mapped fiat currency INR to be prefilled");
});

test("changing country updates mapped fiat and populates currency dropdown, while changing currency does not change country", async () => {
  const optionsData = (path: string) => {
    if (path.includes("countryCode=US")) {
      return {
        countries: [
          { countryCode: "IN", name: "India", flagUrl: "https://example.com/in.png" },
          { countryCode: "US", name: "United States", flagUrl: "https://example.com/us.png" },
        ],
        selection: {
          countryCode: "US",
          defaultFiat: "USD",
          fiatCurrencies: ["USD", "EUR"],
        },
      };
    }
    return {
      countries: [
        { countryCode: "IN", name: "India", flagUrl: "https://example.com/in.png" },
        { countryCode: "US", name: "United States", flagUrl: "https://example.com/us.png" },
      ],
      selection: {
        countryCode: "IN",
        defaultFiat: "INR",
        fiatCurrencies: ["INR"],
      },
    };
  };

  await mountFlow({ resume: false, mockCountry: "IN", optionsData });

  assert.ok(renderer!.root.findAll((node) => node.children?.includes("INR")).length > 0);

  const countryButton = renderer!.root.findByProps({ "aria-label": "Select country" });
  await act(async () => countryButton.props.onClick());

  const usText = renderer!.root.findAll((node) =>
    node.children?.includes("United States"),
  );
  assert.ok(usText.length > 0, "Expected United States country text");
  let usButton = usText[0].parent;
  while (usButton && usButton.type !== "button") {
    usButton = usButton.parent;
  }
  assert.ok(usButton, "Expected button for United States");
  await act(async () => usButton.props.onClick());

  assert.ok(
    renderer!.root.findAll((node) => node.children?.includes("USD")).length > 0,
    "Expected mapped fiat USD",
  );

  const countryImg = renderer!.root
    .findAllByType("img")
    .find((img) => img.props.src === "https://example.com/us.png");
  assert.ok(countryImg, "Expected country flag to update to US");

  // Open currency sheet
  const usdText = renderer!.root.findAll((node) =>
    node.children?.includes("USD"),
  );
  let currencyButton = usdText[0].parent;
  while (currencyButton && currencyButton.type !== "button") {
    currencyButton = currencyButton.parent;
  }
  assert.ok(currencyButton, "Expected currency button");
  await act(async () => currencyButton.props.onClick());

  // Check that EUR is available in dropdown (populated from US fiat currencies)
  const eurText = renderer!.root.findAll((node) =>
    node.children?.includes("EUR"),
  );
  assert.ok(eurText.length > 0, "Expected EUR in currency dropdown");
  let eurButton = eurText[0].parent;
  while (eurButton && eurButton.type !== "button") {
    eurButton = eurButton.parent;
  }
  assert.ok(eurButton, "Expected button for EUR");
  await act(async () => eurButton.props.onClick());

  // Currency changed to EUR
  assert.ok(
    renderer!.root.findAll((node) => node.children?.includes("EUR")).length > 0,
    "Expected EUR selected",
  );

  // Country did NOT change when currency changed
  const countryImgAfter = renderer!.root
    .findAllByType("img")
    .find((img) => img.props.src === "https://example.com/us.png");
  assert.ok(
    countryImgAfter,
    "Expected country to remain US when currency is changed",
  );
});

test("country resolution falls back to alternative IP providers when country.is fails", async () => {
  const optionsData = (path: string) => {
    if (path.includes("countryCode=IN")) {
      return {
        countries: [
          { countryCode: "IN", name: "India", flagUrl: "https://example.com/in.png" },
        ],
        selection: {
          countryCode: "IN",
          defaultFiat: "INR",
          fiatCurrencies: ["INR"],
        },
      };
    }
    return {
      countries: [{ countryCode: "US", name: "United States" }],
      selection: { countryCode: "US", defaultFiat: "USD", fiatCurrencies: ["USD"] },
    };
  };

  // country.is fails (503), but ip-api.com / cloudflare / ipapi.co succeed with IN
  await mountFlow({
    resume: false,
    mockCountry: "IN",
    countryIsError: true,
    optionsData,
  });

  const inrPill = renderer!.root.findAll((node) => node.children?.includes("INR"));
  assert.ok(inrPill.length > 0, "Expected fallback IP provider to resolve country to IN and map fiat to INR");
});

test("switched country is persisted in storage for 7 days and used on next load", async () => {
  const sharedStorage = new Map<string, string>();
  const optionsData = (path: string) => {
    if (path.includes("countryCode=IN")) {
      return {
        countries: [
          { countryCode: "IN", name: "India", flagUrl: "https://example.com/in.png" },
          { countryCode: "US", name: "United States", flagUrl: "https://example.com/us.png" },
        ],
        selection: {
          countryCode: "IN",
          defaultFiat: "INR",
          fiatCurrencies: ["INR"],
        },
      };
    }
    return {
      countries: [
        { countryCode: "IN", name: "India", flagUrl: "https://example.com/in.png" },
        { countryCode: "US", name: "United States", flagUrl: "https://example.com/us.png" },
      ],
      selection: {
        countryCode: "US",
        defaultFiat: "USD",
        fiatCurrencies: ["USD"],
      },
    };
  };

  await mountFlow({
    resume: false,
    mockCountry: "US",
    storage: sharedStorage,
    optionsData,
  });

  const countryButton = renderer!.root.findByProps({ "aria-label": "Select country" });
  await act(async () => countryButton.props.onClick());

  const inText = renderer!.root.findAll((node) =>
    node.children?.includes("India"),
  );
  assert.ok(inText.length > 0, "Expected India country text");
  let inButton = inText[0].parent;
  while (inButton && inButton.type !== "button") {
    inButton = inButton.parent;
  }
  assert.ok(inButton, "Expected button for India");
  await act(async () => inButton.props.onClick());

  const rawSaved = sharedStorage.get("nexus-widgets:onramp:user-country:v1");
  assert.ok(rawSaved, "Expected user country cache record to be in storage");
  const parsed = JSON.parse(rawSaved!);
  assert.equal(parsed.value, "IN");
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  assert.ok(
    parsed.expiresAt >= Date.now() + sevenDaysMs - 5000 &&
      parsed.expiresAt <= Date.now() + sevenDaysMs + 5000,
    "Expected expiresAt to be ~7 days in the future",
  );

  // Unmount first renderer before remounting
  if (renderer) await act(async () => renderer!.unmount());

  // Second mount: next load uses persisted user country even if mockCountry is US
  await mountFlow({
    resume: false,
    mockCountry: "US",
    storage: sharedStorage,
    optionsData,
  });

  const inrPill = renderer!.root.findAll((node) =>
    node.children?.includes("INR"),
  );
  assert.ok(
    inrPill.length > 0,
    "Expected persisted user country IN to be used on next load",
  );
});

test("routes response with dynamic payment method name and logo renders custom name and light logo in light mode", async () => {
  const routesData = {
    routes: [
      {
        provider: "BANXA",
        paymentMethods: [
          {
            method: "CREDIT_DEBIT_CARD",
            name: "Credit & Debit Card",
            type: "CARD",
            logo: {
              dark: "https://cdn.meld.io/images-paymentmethod/CREDIT_DEBIT_CARD/logo_dark.png",
              light: "https://cdn.meld.io/images-paymentmethod/CREDIT_DEBIT_CARD/logo_light.png",
            },
          },
        ],
      },
    ],
  };

  await mountFlow({ resume: false, quoteFlow: true, routesData });
  await act(async () =>
    renderer!.root.findByType("input").props.onChange({ target: { value: "50" } }),
  );
  await waitForQuotes();

  const customNameNode = renderer!.root.findAll((node) =>
    node.children?.includes("Credit & Debit Card"),
  );
  assert.ok(
    customNameNode.length > 0,
    "Expected dynamic payment method name 'Credit & Debit Card' from routes API",
  );

  const imgs = renderer!.root.findAllByType("img");
  const lightMethodLogo = imgs.find((img) =>
    img.props.src ===
    "https://cdn.meld.io/images-paymentmethod/CREDIT_DEBIT_CARD/logo_light.png",
  );
  assert.ok(
    lightMethodLogo,
    "Expected payment method light logo from routes API to be rendered in light mode",
  );
});

test("routes response with dynamic payment method logo renders dark logo in dark mode", async () => {
  const routesData = {
    routes: [
      {
        provider: "BANXA",
        paymentMethods: [
          {
            method: "CREDIT_DEBIT_CARD",
            name: "Credit & Debit Card",
            type: "CARD",
            logo: {
              dark: "https://cdn.meld.io/images-paymentmethod/CREDIT_DEBIT_CARD/logo_dark.png",
              light: "https://cdn.meld.io/images-paymentmethod/CREDIT_DEBIT_CARD/logo_light.png",
            },
          },
        ],
      },
    ],
  };

  await mountFlow({ resume: false, quoteFlow: true, routesData });
  (globalThis as any).document.documentElement = {
    classList: { contains: (c: string) => c === "dark" },
    getAttribute: (a: string) => (a === "data-theme" ? "dark" : null),
  };
  await act(async () =>
    renderer!.root.findByType("input").props.onChange({ target: { value: "50" } }),
  );
  await waitForQuotes();

  const imgs = renderer!.root.findAllByType("img");
  const darkMethodLogo = imgs.find((img) =>
    img.props.src ===
    "https://cdn.meld.io/images-paymentmethod/CREDIT_DEBIT_CARD/logo_dark.png",
  );
  assert.ok(
    darkMethodLogo,
    "Expected payment method dark logo from routes API to be rendered in dark mode",
  );
});



