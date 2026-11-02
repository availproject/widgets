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


