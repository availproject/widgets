import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { DepositIdleForm } from "../registry/avail-widgets/nexus-widget/components/deposit-idle-form";
import { NexusWidgetProgressScreen } from "../registry/avail-widgets/nexus-widget/components/nexus-widget-progress-screen";
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
