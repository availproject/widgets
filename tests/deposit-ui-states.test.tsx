import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { DepositIdleForm } from "../registry/avail-widgets/nexus-widget/components/deposit-idle-form";
import { NexusWidgetProgressScreen } from "../registry/avail-widgets/nexus-widget/components/nexus-widget-progress-screen";
import { SwapReceiptPanel } from "../registry/avail-widgets/nexus-widget/nexus-widget";
import type { SwapTokenOption } from "../registry/avail-widgets/nexus-widget/components/swap-asset-selector";

const token: SwapTokenOption = {
  chainId: 56, contractAddress: "0x0000000000000000000000000000000000000000",
  symbol: "BNB", name: "BNB", decimals: 18, balance: "1", balanceInFiat: "500",
  userAmount: "", userAmountMode: "usd",
};

test("editing an amount undims immediately, stays undimmed during quotes, and dims again when cleared", async () => {
  const originals = Object.fromEntries(["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: { addEventListener() {}, removeEventListener() {} },
    window: { setTimeout, clearTimeout },
  });
  let renderer: ReactTestRenderer | undefined;
  function Form() {
    const [tokens, setTokens] = React.useState([token]);
    return <DepositIdleForm amount="" amountMode="usd" fromTokens={tokens}
      onUpdateTokens={setTokens} onAmountChange={() => {}} onAmountModeToggle={() => {}}
      onOpenSourcePicker={() => {}} onSetPercent={() => {}} tokenValue="0"
      usdValue="0" totalBalance="500" isQuoteRefreshing={false} maxSourceTokens={1} />;
  }
  try {
    await act(async () => { renderer = create(<Form />); });
    const screen = () => renderer!.root.findAllByType("div").find(node => node.props.className?.includes("nx-deposit-screen"))!;
    const input = () => renderer!.root.findByProps({ "aria-label": "BNB amount" });
    const receiveShimmers = () => renderer!.root.findByProps({ className: "nx-amt-line" })
      .findAllByProps({ className: "nx-shim" });
    assert.match(screen().props.className, /nx-focus/);
    assert.equal(receiveShimmers().length, 0);
    for (const value of ["1", "0", "0.25"]) {
      await act(async () => { input().props.onChange({ target: { value } }); });
      assert.doesNotMatch(screen().props.className, /nx-focus/);
      // Assert in the same render as the keystroke, before the typing timer ends.
      assert.equal(receiveShimmers().length, 0);
    }
    const add = renderer!.root.findByProps({ className: "nx-add full" });
    assert.equal(add.props["aria-expanded"], false);
    await act(async () => { add.props.onClick(); });
    assert.ok(renderer!.root.findAllByProps({ className: "nx-cap" }).length);
    assert.ok(add.children.includes("Add another token"));
    await act(async () => { input().props.onChange({ target: { value: "" } }); });
    assert.match(screen().props.className, /nx-focus/);
    assert.equal(receiveShimmers().length, 0);
  } finally {
    await act(async () => { renderer?.unmount(); });
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("progress starts collapsed and toggles open and closed", async () => {
  const previous = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = create(<NexusWidgetProgressScreen mode="deposit" />); });
    const buttons = () => renderer!.root.findAllByType("button").filter(button => button.props["aria-expanded"] !== undefined);
    assert.equal(buttons().length, 1);
    assert.equal(buttons()[0].props["aria-expanded"], false);
    await act(async () => { buttons()[0].props.onClick(); });
    assert.ok(buttons().length > 1);
    assert.ok(buttons().every(button => button.props["aria-expanded"] === true));
    await act(async () => { buttons()[0].props.onClick(); });
    assert.equal(buttons().length, 1);
    assert.equal(buttons()[0].props["aria-expanded"], false);
  } finally {
    await act(async () => { renderer?.unmount(); });
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("token controls edit by index, switch balance units, and remove from selection before the exit animation", async () => {
  const previous = Object.fromEntries(["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, document: { addEventListener() {}, removeEventListener() {} }, window: { setTimeout, clearTimeout, matchMedia: () => ({matches:false}) } });
  let renderer: ReactTestRenderer | undefined;
  let current: SwapTokenOption[] = [];
  let edited: number | undefined;
  function Form() {
    const [tokens, setTokens] = React.useState<SwapTokenOption[]>([
      {...token,userAmount:"10"}, {...token,contractAddress:"0xusdc",symbol:"USDC",name:"USDC",userAmount:"2"},
    ]);
    current = tokens;
    return <DepositIdleForm amount="" amountMode="usd" fromTokens={tokens} onUpdateTokens={setTokens}
      onOpenSourcePicker={index => { edited = index; }} onAmountChange={()=>{}} onAmountModeToggle={()=>{}}
      onSetPercent={()=>{}} tokenValue="0" usdValue="0" totalBalance="500" />;
  }
  try {
    await act(async () => { renderer = create(<Form />); });
    await act(async () => { renderer!.root.findAllByProps({className:"nx-pr-tok"})[1].props.onClick({stopPropagation(){}}); });
    assert.equal(edited,1);
    await act(async () => { renderer!.root.findByProps({"aria-label":"Enter in BNB"}).props.onClick({stopPropagation(){}}); });
    assert.equal(current[0].userAmountMode,"token");
    assert.equal(current[0].userAmount,"0.02");
    assert.ok(renderer!.root.findAllByType("span").some(node=>node.children.includes("Balance: 1 BNB")));
    await act(async () => { renderer!.root.findAllByProps({"aria-label":"Remove"})[0].props.onClick({stopPropagation(){}}); });
    assert.equal(current.length,1);
    assert.equal(current[0].symbol,"USDC");
    assert.equal(current[0].userAmount,"2");
    assert.equal(renderer!.root.findAllByProps({className:"nx-token-presence exiting"}).length,1);
    await act(async () => { await new Promise(resolve=>setTimeout(resolve,380)); });
    assert.equal(renderer!.root.findAllByProps({className:"nx-token-presence exiting"}).length,0);
  } finally {
    await act(async () => { renderer?.unmount(); });
    for(const [key,descriptor] of Object.entries(previous)) {
      if(descriptor) Object.defineProperty(globalThis,key,descriptor);
      else Reflect.deleteProperty(globalThis,key);
    }
  }
});

test("deposit quote dims immediately, delays shimmer, holds it, and cancels on errors or clearing", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const originals = Object.fromEntries(["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: { addEventListener() {}, removeEventListener() {} },
    window: { setTimeout, clearTimeout },
  });
  let renderer: ReactTestRenderer | undefined;
  const form = (props: Partial<React.ComponentProps<typeof DepositIdleForm>>) => (
    <DepositIdleForm amount="" amountMode="usd" fromTokens={[{ ...token, userAmount: "1" }]}
      onUpdateTokens={() => {}} onAmountChange={() => {}} onAmountModeToggle={() => {}}
      onOpenSourcePicker={() => {}} onSetPercent={() => {}} tokenValue="0"
      usdValue="0" totalBalance="500" isQuoteRefreshing={false} {...props} />
  );
  const shimmer = () => renderer!.root.findByProps({ className: "nx-amt-line" }).findAllByProps({ className: "nx-shim" }).length;
  const update = async (props: Partial<React.ComponentProps<typeof DepositIdleForm>>) => {
    await act(async () => { renderer!.update(form(props)); });
  };
  try {
    // Neither the debounce timer nor the SDK has set a loading flag yet.
    await act(async () => { renderer = create(form({})); });
    assert.equal(shimmer(), 0);
    await act(async () => { t.mock.timers.tick(449); });
    assert.equal(shimmer(), 0);
    await act(async () => { t.mock.timers.tick(1); });
    assert.equal(shimmer(), 1);
    await update({ isQuoteRefreshing: true });
    assert.equal(shimmer(), 1);
    await update({ receiveAmount: "0.98", receiveUsd: "0.98" });
    assert.equal(shimmer(), 1);
    await act(async () => { t.mock.timers.tick(399); });
    assert.equal(shimmer(), 1);
    await act(async () => { t.mock.timers.tick(1); });
    assert.equal(shimmer(), 0);
    // Editing invalidates the previous quote before the next request starts.
    await update({ fromTokens: [{ ...token, userAmount: "2" }] });
    assert.equal(shimmer(), 0);
    const quoteLine = renderer!.root.findByProps({ className: "nx-amt-line" });
    assert.equal(quoteLine.props.style.opacity, 0.45);
    assert.ok(quoteLine.findAllByProps({ "aria-label": "~0.98" }).length);
    await act(async () => { t.mock.timers.tick(450); });
    assert.equal(shimmer(), 1);
    await update({ routeStatus: "error", routeMessage: "No route available" });
    assert.equal(shimmer(), 0);
    await update({ routeStatus: "insufficient" });
    assert.equal(shimmer(), 0);
    await update({ fromTokens: [{ ...token, userAmount: "600" }] });
    assert.equal(shimmer(), 0);
    await update({ fromTokens: [{ ...token, userAmount: "" }] });
    assert.equal(shimmer(), 0);
    await update({ receiveAmount: "0" });
    assert.equal(shimmer(), 0);
    // A fast quote skips shimmer entirely, including any old pending timer.
    await update({});
    await act(async () => { t.mock.timers.tick(100); });
    await update({ receiveAmount: "0.97", receiveUsd: "0.97" });
    await act(async () => { t.mock.timers.tick(1000); });
    assert.equal(shimmer(), 0);
    // Repeated edits restart the delay, but keep the last successful quote visible.
    await update({ fromTokens: [{ ...token, userAmount: "2" }] });
    await act(async () => { t.mock.timers.tick(300); });
    await update({ fromTokens: [{ ...token, userAmount: "3" }] });
    await act(async () => { t.mock.timers.tick(300); });
    assert.equal(shimmer(), 0);
    await act(async () => { t.mock.timers.tick(150); });
    assert.equal(shimmer(), 1);
    await update({ fromTokens: [{ ...token, userAmount: "" }] });
    assert.equal(shimmer(), 0);
    await act(async () => { t.mock.timers.tick(1000); });
    assert.equal(shimmer(), 0);
  } finally {
    await act(async () => { renderer?.unmount(); });
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("deposit receive amount is truncated to 3 decimal places and timer pill has balanced padding", async () => {
  const originals = Object.fromEntries(
    ["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: { addEventListener() {}, removeEventListener() {} },
    window: { setTimeout, clearTimeout },
  });
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <DepositIdleForm
          amount=""
          amountMode="usd"
          fromTokens={[{ ...token, userAmount: "10" }]}
          onUpdateTokens={() => {}}
          onAmountChange={() => {}}
          onAmountModeToggle={() => {}}
          onOpenSourcePicker={() => {}}
          onSetPercent={() => {}}
          tokenValue="0"
          usdValue="10"
          totalBalance="500"
          receiveAmount="6.471653"
          receiveUsd="6.47"
          quoteLabel="28s"
          toToken={{
            chainId: 10,
            contractAddress: "0xusdc",
            symbol: "USDC",
            name: "USD Coin",
            decimals: 6,
            balance: "100",
            balanceInFiat: "100",
          }}
        />
      );
    });
    const quoteLine = renderer!.root.findByProps({ className: "nx-amt-line" });
    // Truncated to 3 decimal places: 6.471653 -> ~6.471
    assert.ok(
      quoteLine.findAllByProps({ "aria-label": "~6.471" }).length > 0,
      "Expected receive amount to be truncated to 3 decimals: ~6.471"
    );

    // Timer pill has balanced padding (0 8px) and quoteLabel span has no minWidth
    const timerPill = renderer!.root.find(
      (node) =>
        node.props?.style?.borderRadius === 999 &&
        node.props?.style?.padding === "0 8px"
    );
    assert.ok(timerPill, "Timer pill with padding '0 8px' should exist");
    const labelSpan = timerPill.find(
      (node) => node.type === "span" && node.children.includes("28s")
    );
    assert.ok(labelSpan, "Label span with 28s should exist");
    assert.equal(labelSpan.props.style?.minWidth, undefined);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("MAX in USD mode on native gas tokens and ERC20 tokens does not produce max/gas error", async () => {
  const originals = Object.fromEntries(
    ["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: { addEventListener() {}, removeEventListener() {} },
    window: { setTimeout, clearTimeout, matchMedia: () => ({ matches: false }) },
  });
  let renderer: ReactTestRenderer | undefined;

  // HYPE is native (0x0 address), balance ~0.12762897 HYPE, fiat $11.73
  const hypeToken: SwapTokenOption = {
    chainId: 999,
    contractAddress: "0x0000000000000000000000000000000000000000",
    symbol: "HYPE",
    name: "Hyperliquid",
    decimals: 18,
    balance: "0.12762897",
    balanceInFiat: "$11.73",
    userAmount: "",
    userAmountMode: "usd",
  };

  // LINK is ERC20, balance 1.054321 LINK, fiat $11.73
  const linkToken: SwapTokenOption = {
    chainId: 1,
    contractAddress: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    symbol: "LINK",
    name: "ChainLink Token",
    decimals: 18,
    balance: "1.054321",
    balanceInFiat: "$11.73",
    userAmount: "",
    userAmountMode: "usd",
  };

  try {
    let currentTokens: SwapTokenOption[] = [hypeToken, linkToken];
    function Form() {
      const [tokens, setTokens] = React.useState<SwapTokenOption[]>([hypeToken, linkToken]);
      currentTokens = tokens;
      return (
        <DepositIdleForm
          amount=""
          amountMode="usd"
          fromTokens={tokens}
          onUpdateTokens={setTokens}
          onAmountChange={() => {}}
          onAmountModeToggle={() => {}}
          onOpenSourcePicker={() => {}}
          onSetPercent={() => {}}
          tokenValue="0"
          usdValue="0"
          totalBalance="23.46"
          isQuoteRefreshing={false}
        />
      );
    }

    await act(async () => {
      renderer = create(<Form />);
    });

    // 1. Click MAX on HYPE (first token, index 0)
    const maxButtons = renderer!.root.findAll(
      (node) => node.type === "button" && node.children.includes("MAX")
    );
    assert.equal(maxButtons.length, 2);

    await act(async () => {
      maxButtons[0].props.onClick({ stopPropagation() {} });
    });

    // Verify HYPE amount was set and no error is rendered for HYPE
    assert.ok(Number(currentTokens[0].userAmount) > 0);
    const errorsAfterHypeMax = renderer!.root.findAllByProps({ className: "nx-pr-err" });
    assert.equal(
      errorsAfterHypeMax.length,
      0,
      `Expected no gas error on HYPE MAX, but found: ${errorsAfterHypeMax.map((e) => e.children).join(", ")}`
    );

    // 2. Test manual $11.5 on HYPE (the exact case from user screenshot)
    const hypeInput = renderer!.root.findByProps({ "aria-label": "HYPE amount" });
    await act(async () => {
      hypeInput.props.onChange({ target: { value: "11.5" } });
    });
    const errorsAfterManual11_5 = renderer!.root.findAllByProps({ className: "nx-pr-err" });
    assert.equal(
      errorsAfterManual11_5.length,
      0,
      `Expected no gas error for manual 11.5 on HYPE, but found: ${errorsAfterManual11_5.map((e) => e.children).join(", ")}`
    );

    // 3. Click MAX on LINK (second token, index 1)
    await act(async () => {
      maxButtons[1].props.onClick({ stopPropagation() {} });
    });

    // Verify LINK amount was set and no error is rendered
    assert.ok(Number(currentTokens[1].userAmount) > 0);
    const errorsAfterLinkMax = renderer!.root.findAllByProps({ className: "nx-pr-err" });
    assert.equal(
      errorsAfterLinkMax.length,
      0,
      `Expected no balance error on LINK MAX, but found: ${errorsAfterLinkMax.map((e) => e.children).join(", ")}`
    );
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("SwapReceiptPanel renders refund reassurance message when transaction was rejected", async () => {
  const originals = Object.fromEntries(
    ["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: { addEventListener() {}, removeEventListener() {} },
    window: { setTimeout, clearTimeout },
  });

  try {
    const rejectedEntry: any = {
      id: "test-reject",
      status: "failed",
      mode: "deposit",
      failureMessage: "Transaction failed",
      failureDescription: "Transaction was rejected in your wallet.",
      fromTokens: [],
      intentData: null,
      toToken: { symbol: "USDC", chainName: "Optimism", chainId: 10 },
      startedAt: Date.now() - 1000,
      endedAt: Date.now(),
      durationSeconds: 1,
      createdAt: Date.now(),
    };

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <SwapReceiptPanel entry={rejectedEntry} onDone={() => {}} />
      );
    });

    const text = JSON.stringify(renderer!.toJSON());
    assert.ok(text.includes("Transaction was rejected in your wallet."));
    assert.ok(
      text.includes("Any tokens collected will be refunded to your wallet"),
      "Should display refund reassurance below description"
    );

    // When failure already states funds are safe or in wallet, reassurance is not added
    const safeEntry: any = {
      ...rejectedEntry,
      failureMessage: "Deposit failed. Funds are in your wallet",
      failureDescription: undefined,
    };

    await act(async () => {
      renderer!.update(
        <SwapReceiptPanel entry={safeEntry} onDone={() => {}} />
      );
    });

    const safeText = JSON.stringify(renderer!.toJSON());
    assert.ok(safeText.includes("Funds are in your wallet"));
    assert.ok(
      !safeText.includes("Any tokens collected will be refunded to your wallet"),
      "Should not show refund reassurance when headline already conveys funds are in wallet"
    );

    // Also test swap mode
    const swapRejectedEntry: any = {
      ...rejectedEntry,
      mode: "swap",
    };

    await act(async () => {
      renderer!.update(
        <SwapReceiptPanel entry={swapRejectedEntry} onDone={() => {}} />
      );
    });

    const swapText = JSON.stringify(renderer!.toJSON());
    assert.ok(
      swapText.includes("Any tokens collected will be refunded to your wallet"),
      "Should show refund reassurance in swap mode as well"
    );
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("DepositIdleForm receive section has not-allowed cursor to indicate non-editable", async () => {
  const originals = Object.fromEntries(
    ["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: { addEventListener() {}, removeEventListener() {} },
    window: { setTimeout, clearTimeout },
  });

  try {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <DepositIdleForm
          amount=""
          amountMode="usd"
          fromTokens={[token]}
          destinationLabel="Aave"
          onUpdateTokens={() => {}}
          onAmountChange={() => {}}
          onAmountModeToggle={() => {}}
          onOpenSourcePicker={() => {}}
          onSetPercent={() => {}}
          tokenValue="0"
          usdValue="0"
          totalBalance="500"
          isQuoteRefreshing={false}
          maxSourceTokens={3}
        />
      );
    });

    const hero = renderer!.root.findByProps({ className: "nx-hero nx-focusable" });
    assert.ok(hero);
    assert.equal(hero.props.style?.cursor, "not-allowed");
    assert.equal(hero.props.style?.userSelect, "none");
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("DepositIdleForm does not dismiss open input when value is not entered", async () => {
  const originals = Object.fromEntries(
    ["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );

  let capturedPointerDown: ((e: any) => void) | undefined;
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: {
      addEventListener(type: string, fn: any) {
        if (type === "pointerdown") capturedPointerDown = fn;
      },
      removeEventListener() {},
    },
    window: { setTimeout, clearTimeout },
  });

  try {
    let renderer: ReactTestRenderer | undefined;
    const emptyToken: SwapTokenOption = {
      ...token,
      userAmount: "",
    };

    await act(async () => {
      renderer = create(
        <DepositIdleForm
          amount=""
          amountMode="usd"
          fromTokens={[emptyToken]}
          destinationLabel="Aave"
          onUpdateTokens={() => {}}
          onAmountChange={() => {}}
          onAmountModeToggle={() => {}}
          onOpenSourcePicker={() => {}}
          onSetPercent={() => {}}
          tokenValue="0"
          usdValue="0"
          totalBalance="500"
          isQuoteRefreshing={false}
          maxSourceTokens={3}
        />
      );
    });

    assert.ok(capturedPointerDown, "pointerdown listener should be registered");

    let prevented = false;
    let stopped = false;
    const fakeEvent = {
      target: {}, // outside node
      preventDefault() {
        prevented = true;
      },
      stopPropagation() {
        stopped = true;
      },
    };

    capturedPointerDown!(fakeEvent);
    assert.ok(prevented, "Click outside should be prevented when amount is empty");
    assert.ok(stopped, "Click outside propagation should be stopped when amount is empty");
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("deposit receipt and progress screen include destination-chain source token when source matches destination", async () => {
  const originals = Object.fromEntries(
    ["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: { addEventListener() {}, removeEventListener() {} },
    window: { setTimeout, clearTimeout },
  });

  try {
    const toToken: SwapTokenOption = {
      chainId: 10,
      contractAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      balance: "5.0",
      balanceInFiat: "5.0",
    };

    // User selected 3 sources:
    // 1. USDC on Optimism ($1.41)
    // 2. USDT on Arbitrum ($1.48)
    // 3. USDC on Base ($1.00)
    const fromTokens: SwapTokenOption[] = [
      {
        chainId: 10,
        contractAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        balance: "5.0",
        balanceInFiat: "5.0",
        userAmount: "1.41",
        userAmountMode: "usd",
        chainName: "Optimism",
      },
      {
        chainId: 42161,
        contractAddress: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        balance: "10.0",
        balanceInFiat: "10.0",
        userAmount: "1.48",
        userAmountMode: "usd",
        chainName: "Arbitrum",
      },
      {
        chainId: 8453,
        contractAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        balance: "10.0",
        balanceInFiat: "10.0",
        userAmount: "1.00",
        userAmountMode: "usd",
        chainName: "Base",
      },
    ];

    // Cross-chain swap intent only contains the cross-chain sources (Arbitrum and Base)
    const intentData: any = {
      swapRequired: true,
      destination: {
        chain: { id: 10, name: "Optimism" },
        token: {
          contractAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
          symbol: "USDC",
          decimals: 6,
        },
        amount: "3.89",
        value: "3.89",
      },
      sources: [
        {
          chain: { id: 42161, name: "Arbitrum" },
          token: {
            contractAddress: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
            symbol: "USDT",
          },
          amount: "1.48",
          value: "1.48",
        },
        {
          chain: { id: 8453, name: "Base" },
          token: {
            contractAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            symbol: "USDC",
          },
          amount: "1.00",
          value: "1.00",
        },
      ],
      executeRequirement: {
        chain: { id: 10, name: "Optimism" },
        token: {
          address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
          amount: "3.89",
          amountRaw: BigInt(3890000),
          decimals: 6,
          symbol: "USDC",
          valueUsd: "3.89",
        },
      },
    };

    const entry: any = {
      id: "deposit-multi-source-test",
      status: "fulfilled",
      mode: "deposit",
      createdAt: Date.now(),
      startedAt: Date.now() - 1000,
      durationSeconds: 1,
      fromTokens,
      toToken,
      intentData,
      requestedToAmount: "3.89",
      requestedToValue: "3.89",
      opportunity: {
        title: "Aave",
        protocol: "Aave",
        chainId: 10,
        tokenSymbol: "USDC",
      },
    };

    let receiptRenderer: ReactTestRenderer | undefined;
    await act(async () => {
      receiptRenderer = create(
        <SwapReceiptPanel entry={entry} onDone={() => {}} />
      );
    });

    const receiptJson = JSON.stringify(receiptRenderer!.toJSON());
    // 1. Must count 3 tokens: children: ["3", " token", "s", " ", "▾"]
    assert.ok(receiptJson.includes('"3"') && receiptJson.includes('" token"'), "Receipt should show 3 tokens");
    // 2. Must show total deposited $3.89
    assert.ok(receiptJson.includes("$3.89"), "Receipt should show $3.89 total deposited");

    // Click the tokens button to expand the source breakdown
    const toggleButton = receiptRenderer!.root
      .findAllByType("button")
      .find((b) =>
        b.props.children?.some?.(
          (c: any) => typeof c === "string" && c.includes("token")
        )
      );
    assert.ok(toggleButton, "Toggle button should exist");
    await act(async () => {
      toggleButton.props.onClick();
    });

    const expandedJson = JSON.stringify(receiptRenderer!.toJSON());
    assert.ok(expandedJson.includes("USDC"), "Receipt breakdown should include USDC");
    assert.ok(expandedJson.includes("USDT"), "Receipt breakdown should include USDT");
    assert.ok(expandedJson.includes("Optimism"), "Receipt breakdown should include Optimism");
    assert.ok(expandedJson.includes("Arbitrum"), "Receipt breakdown should include Arbitrum");
    assert.ok(expandedJson.includes("Base"), "Receipt breakdown should include Base");

    // Test Progress Screen
    let progressRenderer: ReactTestRenderer | undefined;
    await act(async () => {
      progressRenderer = create(
        <NexusWidgetProgressScreen
          mode="deposit"
          fromTokens={fromTokens}
          toToken={toToken}
          intentData={intentData}
          toAmount="3.89"
          toAmountUsd="3.89"
          fromAmountUsd="3.89"
          opportunity={entry.opportunity}
        />
      );
    });

    const progressJson = JSON.stringify(progressRenderer!.toJSON());
    // Progress screen must show "You Spend $3.89"
    assert.ok(progressJson.includes("$3.89"), "Progress screen should include $3.89 spend");
    assert.ok(
      progressJson.includes('"Aave"') && progressJson.includes('" Receives"'),
      "Progress screen should show Aave Receives"
    );
    assert.ok(
      progressJson.includes('"on"') && progressJson.includes('"Optimism"'),
      "Progress screen should show on Optimism"
    );
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("NexusWidgetProgressScreen and SwapReceiptPanel persist exact-in destination amount and round stablecoins to 2 decimal places", async () => {
  const originals = Object.fromEntries(
    ["window", "document", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: {
      addEventListener() {},
      removeEventListener() {},
      documentElement: { style: {} },
    },
    window: {
      addEventListener() {},
      removeEventListener() {},
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    },
  });

  try {
    const toToken: SwapTokenOption = {
      chainId: 10,
      chainName: "Optimism",
      contractAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
      symbol: "USDC",
      decimals: 6,
      name: "USD Coin",
      balance: "0",
      balanceInFiat: "$0.00",
    };

    // 1. Test Progress Screen: toAmount is empty or "0", but executeRequirement has 1.53 USDC
    const intentDataWithRequirement: any = {
      bridgeProvider: "Across",
      destination: {
        amount: "0", // raw intent might have 0
        chain: { id: 10, name: "Optimism" },
        token: { symbol: "USDC", decimals: 6, contractAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85" },
        value: "1.53",
      },
      executeRequirement: {
        token: {
          symbol: "USDC",
          decimals: 6,
          amount: "1.53",
          amountRaw: BigInt(1530000),
          valueUsd: "1.53",
        },
      },
      sources: [
        {
          chain: { id: 999, name: "HyperEVM" },
          token: { symbol: "HYPE", decimals: 18 },
          amount: "0.01",
          value: "1.55",
        },
      ],
    };

    let progressRenderer: ReactTestRenderer | undefined;
    await act(async () => {
      progressRenderer = create(
        <NexusWidgetProgressScreen
          mode="deposit"
          toToken={toToken}
          intentData={intentDataWithRequirement}
          toAmount="0"
          toAmountUsd="1.53"
          fromAmountUsd="1.55"
          opportunity={{ title: "Aave", protocol: "aave-v3", chainId: 10, tokenAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", tokenSymbol: "USDC", tokenDecimals: 6 }}
        />
      );
    });

    const progressJson = JSON.stringify(progressRenderer!.toJSON());
    // Should NOT show ~0 USDC, but should show ~1.53
    assert.ok(!progressJson.includes('"~0"'), "Progress screen should not show ~0");
    assert.ok(progressJson.includes("1.53"), "Progress screen should show ~1.53 USDC");

    // 2. Test SwapReceiptPanel: destination amount is 0.754421 USDC (should format to ~0.75 USDC)
    const receiptEntry: any = {
      id: "test-receipt-entry",
      mode: "deposit",
      status: "success",
      createdAt: Date.now() - 5000,
      durationSeconds: 1,
      toToken,
      opportunity: { title: "Aave", protocol: "aave-v3", chainId: 10, tokenSymbol: "USDC" },
      intentData: {
        destination: {
          amount: "0.754421",
          chain: { id: 10, name: "Optimism" },
          token: { symbol: "USDC", decimals: 6 },
          value: "0.75",
        },
        sources: [
          {
            chain: { id: 56, name: "BNB" },
            token: { symbol: "BNB", decimals: 18 },
            amount: "0.00071633",
            value: "0.5",
          },
          {
            chain: { id: 999, name: "HyperEVM" },
            token: { symbol: "HYPE", decimals: 18 },
            amount: "0.00118685",
            value: "0.1",
          },
        ],
      },
      fromTokens: [],
    };

    let receiptRenderer: ReactTestRenderer | undefined;
    await act(async () => {
      receiptRenderer = create(
        <SwapReceiptPanel
          entry={receiptEntry}
          onDone={() => {}}
        />
      );
    });

    const receiptJson = JSON.stringify(receiptRenderer!.toJSON());
    // Should display ~0.75 USDC, NOT ~0.754421 USDC
    assert.ok(receiptJson.includes("0.75"), "Receipt should show rounded down 2-decimal 0.75");
    assert.ok(!receiptJson.includes("0.754421"), "Receipt should not show 6-decimal 0.754421");
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});



