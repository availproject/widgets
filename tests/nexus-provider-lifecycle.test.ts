import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createSdkOwner, createInFlightRequests } from "../registry/avail-widgets/nexus/request-lifecycle";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

// Run the actual provider callbacks with controlled SDK/network promises. No wallet/network traffic.
function providerHarness(options: { init?: Promise<void>; swap?: Promise<any[]>; bridge?: Promise<any[]>; rates?: Promise<Record<string, string>> } = {}) {
  const text = readFileSync(new URL("../registry/avail-widgets/nexus/NexusProvider.tsx", import.meta.url), "utf8");
  const source = ts.createSourceFile("provider.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ["getOrCreateSdk", "readBridgeBalance", "readSwapBalance", "setupNexus", "initializeNexus", "deinitializeNexus", "attachEventHooks", "handleInit", "fetchBridgableBalance", "fetchSwapBalance"];
  const declarations = new Map<string, string>();
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(source))) declarations.set(node.name.getText(source), node.initializer!.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  const state: Record<string, any> = {};
  const counts = { created: 0, alive: 0, maxAlive: 0, initialize: 0, wallet: 0, swap: 0, bridge: 0 };
  const observations: string[] = [];
  const sdkRef = createSdkOwner<any>();
  const environment: Record<string, any> = {
    balanceUpdatesRef: { current: { bridge: 0, swap: 0 } },
    sdkRef, stableConfig: { network: "mainnet", debug: false },
    inFlightRequests: createInFlightRequests(),
    useCallback: (fn: unknown) => fn,
    createNexusClient: () => {
      counts.created++; counts.alive++; counts.maxAlive = Math.max(counts.maxAlive, counts.alive);
      let destroyed = false;
      return {
        initialize: () => { counts.initialize++; return options.init ?? Promise.resolve(); },
        setEVMProvider: async () => { counts.wallet++; },
        getSupportedChains: () => [],
        getBalancesForSwap: () => { counts.swap++; return options.swap ?? Promise.resolve([{ symbol: "USDT0", balance: "5" }]); },
        getBalancesForBridge: () => { counts.bridge++; return options.bridge ?? Promise.resolve([]); },
        destroy: () => { if (!destroyed) counts.alive--; destroyed = true; },
      };
    },
    widgetObservationHub: { observe: async (operation: string, _phase: string, call: () => Promise<unknown>) => { observations.push(operation); return call(); } },
    normalizeAccountAddress: (value?: string) => value?.toLowerCase() ?? null,
    buildUsdPeggedSymbolSet: () => new Set(), normalizeTokenSymbol: (s: string) => s,
    TOKEN_PRICE_PEGS: {}, getCoinbaseRates: () => options.rates ?? Promise.resolve({}),
    normalizeUserAssetFiatValues: (value: unknown) => value,
    filterUnsupportedSwapSources: (value: unknown) => value,
    startBalanceFetchTiming: () => ({}), finishBalanceFetchTiming: () => {},
    console: { log() {}, error() {} },
  };
  for (const name of ["initializedRef", "initializedAccountAddress", "initRequest", "walletAttachRequest", "swapBalanceCache", "supportedChainsAndTokens", "swapSupportedChainsAndTokens", "usdPeggedSymbols", "exchangeRate", "intent", "swapIntent", "allowance", "balanceFetchRunId", "latestBalanceFetchRunId"]) environment[name] = { current: name === "initializedRef" ? false : name.endsWith("RunId") ? 0 : null };
  for (const name of ["Sdk", "NexusSDK", "Loading", "BridgableBalance", "SwapBalance", "BridgableBalanceLoading", "SwapBalanceLoading", "SupportedChainsAndTokensState", "SwapSupportedChainsAndTokensState", "ExchangeRateState"]) environment[`set${name}`] = (value: unknown) => { state[name] = value; };
  const code = names.map(name => { assert.ok(declarations.has(name), name); return `const ${name} = ${declarations.get(name)};`; }).join("\n");
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const api = new Function(...Object.keys(environment), `${compiled}\nreturn { ${names.join(",")} };`)(...Object.values(environment));
  return { api, state, counts, observations, sdkRef };
}
const wallet = { request: async () => [] };

test("read-only setup and concurrent wallet initialization reuse one SDK and one balance setup", async () => {
  const init = deferred<void>();
  const h = providerHarness({ init: init.promise });
  try {
    const readOnly = h.api.getOrCreateSdk();
    const connects = [h.api.handleInit(wallet, "0xAAA"), h.api.handleInit(wallet, "0xAAA"), h.api.handleInit(wallet, "0xAAA")];
    await tick();
    assert.equal(h.counts.created, 1);
    assert.equal(h.counts.initialize, 1);
    init.resolve();
    await Promise.all([readOnly, ...connects]);
    assert.deepEqual(h.counts, { created: 1, alive: 1, maxAlive: 1, initialize: 1, wallet: 1, swap: 1, bridge: 1 });
  } finally { h.sdkRef.reset(); }
});

test("setup and concurrent manual balance reads share requests; a later refresh reads again", async () => {
  const swap = deferred<any[]>(), bridge = deferred<any[]>();
  const h = providerHarness({ swap: swap.promise, bridge: bridge.promise });
  try {
    const connect = h.api.handleInit(wallet, "a");
    await tick();
    const refreshes = [h.api.fetchSwapBalance(), h.api.fetchSwapBalance(), h.api.fetchBridgableBalance()];
    await tick();
    assert.equal(h.counts.swap, 1); assert.equal(h.counts.bridge, 1);
    swap.resolve([{ symbol: "USDT0", balance: "5" }]); bridge.resolve([]);
    await Promise.all([connect, ...refreshes]);
    assert.equal(h.observations.filter(x => x === "getBalancesForSwap").length, 1);
    assert.equal(h.observations.filter(x => x === "getBalancesForBridge").length, 1);
    await h.api.fetchSwapBalance({ onlyIfMissing: true });
    assert.equal(h.counts.swap, 1);
    await h.api.fetchSwapBalance();
    assert.equal(h.counts.swap, 2);
    assert.equal(h.state.SwapBalance[0].balance, "5");
  } finally { h.sdkRef.reset(); }
});

test("disconnect invalidates pending SDK initialization without resurrecting a wallet client", async () => {
  const init = deferred<void>();
  const h = providerHarness({ init: init.promise });
  const connecting = h.api.handleInit(wallet, "a");
  const rejected = assert.rejects(connecting, /superseded/);
  await tick();
  await h.api.deinitializeNexus();
  init.resolve();
  await rejected;
  assert.equal(h.sdkRef.current, null);
  assert.equal(h.state.NexusSDK, null);
  assert.equal(h.counts.wallet, 0);
  assert.equal(h.counts.alive, 0);
});

test("account changes replace the old SDK before constructing the next client", async () => {
  const h = providerHarness();
  try {
    await h.api.handleInit(wallet, "a");
    const old = h.sdkRef.current;
    await Promise.all([h.api.handleInit(wallet, "b"), h.api.handleInit(wallet, "b")]);
    assert.notEqual(h.sdkRef.current, old);
    assert.equal(h.counts.created, 2);
    assert.equal(h.counts.maxAlive, 1);
    assert.equal(h.counts.wallet, 2);
    assert.equal(h.counts.swap, 2);
  } finally { h.sdkRef.reset(); }
});

test("late balance responses cannot repopulate a disconnected wallet", async () => {
  const swap = deferred<any[]>();
  const h = providerHarness({ swap: swap.promise });
  const connecting = h.api.handleInit(wallet, "a");
  await tick();
  await h.api.deinitializeNexus();
  swap.resolve([{ symbol: "STALE", balance: "999" }]);
  await connecting;
  assert.equal(h.state.SwapBalance, null);
  assert.equal(h.state.BridgableBalance, null);
});

test("failed balance requests are coalesced but a retry is allowed", async () => {
  const requests = createInFlightRequests();
  const scope = {}, gate = deferred<number>();
  let reads = 0;
  const read = () => { reads++; return gate.promise; };
  const a = requests.run(scope, "swap:a", read), b = requests.run(scope, "swap:a", read);
  assert.equal(a, b);
  const rejected = assert.rejects(a, /rpc/);
  gate.reject(new Error("rpc"));
  await rejected;
  assert.equal(reads, 1);
  assert.equal(await requests.run(scope, "swap:a", async () => 7), 7);
  assert.equal(await requests.run(scope, "swap:b", async () => 9), 9);
});


test("direct wallet initialization is coalesced and the widget can lazily fetch missing balances", async () => {
  const h = providerHarness();
  try {
    await Promise.all([h.api.initializeNexus(wallet, "a"), h.api.initializeNexus(wallet, "a")]);
    assert.equal(h.counts.created, 1);
    assert.equal(h.counts.wallet, 1);
    assert.equal(h.counts.swap, 0);
    await h.api.fetchSwapBalance({ onlyIfMissing: true });
    await h.api.fetchSwapBalance({ onlyIfMissing: true });
    assert.equal(h.counts.swap, 1);
  } finally { h.sdkRef.reset(); }
});

test("failed SDK initialization destroys the failed client and permits a clean retry", async () => {
  const owner = createSdkOwner<{ destroy(): void }>();
  let destroyed = 0;
  const create = () => ({ destroy() { destroyed++; } });
  await assert.rejects(owner.get(create, async () => { throw new Error("setup failed"); }), /setup failed/);
  assert.equal(owner.current, null);
  assert.equal(destroyed, 1);
  const next = await owner.get(create, async () => {});
  assert.equal(owner.current, next);
  owner.reset();
  assert.equal(destroyed, 2);
});


test("slow setup pricing cannot overwrite a newer manual balance refresh", async () => {
  const rates = deferred<Record<string, string>>();
  const options = { rates: rates.promise, swap: Promise.resolve([{ symbol: "USDT0", balance: "5" }]) };
  const h = providerHarness(options);
  try {
    const connecting = h.api.handleInit(wallet, "a");
    await tick();
    options.swap = Promise.resolve([{ symbol: "USDT0", balance: "9" }]);
    await h.api.fetchSwapBalance();
    rates.resolve({});
    await connecting;
    assert.equal(h.state.SwapBalance[0].balance, "9");
    assert.equal((await h.api.fetchSwapBalance({ onlyIfMissing: true }))[0].balance, "9");
  } finally { h.sdkRef.reset(); }
});
