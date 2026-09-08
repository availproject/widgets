import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { DepositFundingMethod } from "../registry/avail-widgets/nexus-widget/components/deposit-funding-method";
import { DepositOnrampFlow } from "../registry/avail-widgets/nexus-widget/components/deposit-onramp-flow";
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
} = {}) => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  logs = [];
  console.log = (...args) => {
    logs.push(args.join(" "));
  };
  windowEvents = new EventTarget();
  const fakeWindow = Object.assign(windowEvents, {
    location: { origin: "https://example.com", href: "https://example.com/" },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage: { getItem: () => null, setItem: () => {} },
  });
  (globalThis as any).window = fakeWindow;
  (globalThis as any).document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  let resolveReceipt!: (value: Response) => void;
  let paymentStatus = status;
  let sends = 0;
  let approvals = 0;
  let swaps = 0;
  let receiptCalls = 0;
  const states: Array<string | null> = [];
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
                destinationAmount: 10,
                cryptoDetails: { walletAddress: account, chainId: "8453" },
              },
            }
          : {
              sessionId: "session",
              state: paymentStatus,
              transaction: { destinationAmount: "10", walletAddress: account },
            },
      );
    }
    if (path.includes("/options"))
      return Response.json({
        countries: [{ countryCode: "US", name: "United States" }],
        selection: {
          countryCode: "US",
          defaultFiat: "USD",
          fiatCurrencies: ["USD"],
        },
      });
    if (path.includes("/routes")) return Response.json({ routes: [] });
    if (path.includes("country.is")) return Response.json({ country: "US" });
    if (path.includes("open.er-api.com"))
      return Response.json({ rates: { USD: 1 } });
    const body = JSON.parse(String(init?.body));
    switch (body.method) {
      case "eth_call":
        return rpcResponse(
          `0x${(gasSwap ? (swaps ? 108_000_000 : 110_000_000) : 10_000_000).toString(16)}`,
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
    chain: { id: 8453 },
    request: async ({ method }: { method: string }) => {
      switch (method) {
        case "eth_chainId":
          return "0x2105";
        case "eth_accounts":
          return [account];
        case "eth_call":
          return "0x0";
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
    switchChain: async () => {},
    writeContract: async () => {
      approvals++;
      return hash;
    },
    sendTransaction: async () => {
      sends++;
      return hash;
    },
  };
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
  await act(async () => {
    renderer = create(
      <DepositOnrampFlow
        baseUrl="https://nexus-v2.canary.avail.so/middleware"
        ownerAddress={account}
        walletClient={wallet ? (walletClient as any) : null}
        nexusSDK={sdk}
        opportunity={{
          chainId: 8453,
          tokenAddress: token,
          tokenDecimals: 6,
          tokenSymbol: "USDC",
          executeDeposit: (_symbol, _token, amount) => ({
            to: account,
            tokenApproval: needsApproval ? { toTokenAddress: token, spender: account, amount } : undefined,
            gas: BigInt(100000),
            value: BigInt(0),
            data: `0x${amount.toString(16).padStart(64, "0")}`,
          }),
        }}
        toToken={
          {
            chainId: 8453,
            contractAddress: token,
            decimals: 6,
            symbol: "USDC",
            name: "USD Coin",
            balance: "0",
          } as any
        }
        onConnectWallet={() => {}}
        onSessionStateChange={(state) => states.push(state)}
        primaryButtonForeground="#fff"
      />,
    );
  });
  await flush();
  await act(async () => {
    window.setRampSessionId?.("session");
  });
  await flush();
  return {
    states,
    setStatus: (value: string) => { paymentStatus = value; },
    statusRequests,
    sends: () => sends,
    swaps: () => swaps,
    approvals: () => approvals,
    confirm: async () => {
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

test("settlement without a wallet surfaces a retryable deposit error, never success", async () => {
  const flow = await mountFlow({ wallet: false });
  assert.equal(flow.sends(), 0);
  assert.equal(flow.states.at(-1), "DEPOSIT_FAILED");
  assert.ok(!flow.states.includes("DEPOSIT_SUCCESS"));
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
  assert.equal(renderer!.root.findAllByProps({ label: "Pay with Local Currency" }).length, 0);
  await act(async () => renderer!.root.findByProps({ label: "Pay with Wallet" }).props.onClick());
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
  await act(async () => renderer!.root.findByProps({ label: "Pay with Local Currency" }).props.onClick());
  await act(async () => renderer!.root.findAllByType("button").find(button => button.children.includes("Continue"))!.props.onClick());
  assert.equal(onrampSelections, 1);
  await act(async () => renderer!.update(<DepositFundingMethod {...props} enableOnRamp={false} />));
  assert.equal(renderer!.root.findAllByProps({ label: "Pay with Local Currency" }).length, 0);
  const continueButton = renderer!.root.findAllByType("button").find(button => button.children.includes("Continue"))!;
  assert.equal(continueButton.props.disabled, true);
  await act(async () => continueButton.props.onClick());
  assert.equal(onrampSelections, 1);
});
