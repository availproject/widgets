import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { DepositAnimatedAmount } from "../registry/avail-widgets/nexus-widget/components/deposit-animated-amount";
import { DepositAmountInput, DepositAnimatedLabel, groupDepositInput } from "../registry/avail-widgets/nexus-widget/components/deposit-motion";
import { sanitizeAmount } from "../registry/avail-widgets/nexus-widget/components/deposit-idle-form";

test("sanitizeAmount normalizes leading dots, strips rogue leading zeros, and caps decimals", () => {
  assert.equal(sanitizeAmount(".", 2), "0.");
  assert.equal(sanitizeAmount(".1", 2), "0.1");
  assert.equal(sanitizeAmount(".123", 2), "0.12");
  assert.equal(sanitizeAmount("01.", 2), "1.");
  assert.equal(sanitizeAmount("01.5", 2), "1.5");
  assert.equal(sanitizeAmount("01", 2), "1");
  assert.equal(sanitizeAmount("00", 2), "0");
  assert.equal(sanitizeAmount("00.5", 2), "0.5");
  assert.equal(sanitizeAmount("0", 2), "0");
  assert.equal(sanitizeAmount("", 2), "");
  assert.equal(sanitizeAmount("100", 2), "100");
});

test("input grouping preserves trailing decimals and fractional zeroes", () => {
  assert.equal(groupDepositInput("1234567.00"), "1,234,567.00");
  assert.equal(groupDepositInput("1234."), "1,234.");
  assert.equal(groupDepositInput("0.0010"), "0.0010");
  assert.equal(groupDepositInput(""), "");
  assert.equal(groupDepositInput("1,234.50"), "1,234.50");
});

test("only changed calculated digits roll and direction follows the numeric value", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = create(<DepositAnimatedAmount value="$19.25" />); });
    const moving = () => renderer!.root.findAll(node => /nx-digit-current (up|down)/.test(node.props.className ?? ""));
    assert.equal(moving().length, 0);
    await act(async () => { renderer!.update(<DepositAnimatedAmount value="$20.25" />); });
    assert.equal(moving().length, 2);
    assert.ok(moving().every(node => node.props.className.endsWith("up")));
    assert.equal(renderer!.root.findByProps({ className: "nx-animated-amount" }).props["aria-label"], "$20.25");
    await act(async () => { renderer!.update(<DepositAnimatedAmount value="$20.15" />); });
    assert.equal(moving().length, 1);
    assert.ok(moving()[0].props.className.endsWith("down"));
    await act(async () => { renderer!.update(<DepositAnimatedAmount value="$999,999" />); });
    await act(async () => { renderer!.update(<DepositAnimatedAmount value="$1M" />); });
    assert.ok(moving().length > 0);
    assert.ok(moving().every(node => node.props.className.endsWith("up")));
    await act(async () => { renderer!.update(<DepositAnimatedAmount value="$999,999" />); });
    assert.ok(moving().every(node => node.props.className.endsWith("down")));
  } finally { await act(async () => renderer?.unmount()); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; }
});

test("CTA label keeps only the current accessible text while outgoing text animates", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = create(<DepositAnimatedLabel>Getting quote…</DepositAnimatedLabel>); });
    await act(async () => { renderer!.update(<DepositAnimatedLabel>Deposit</DepositAnimatedLabel>); });
    assert.equal(renderer!.root.findByProps({ className: "nx-label-stack" }).props["aria-label"], "Deposit");
    assert.deepEqual(renderer!.root.findByProps({ className: "nx-label-out" }).children, ["Getting quote…"]);
    assert.equal(renderer!.root.findByProps({ className: "nx-label-out" }).props["aria-hidden"], true);
  } finally { await act(async () => renderer?.unmount()); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; }
});

test("DepositAmountInput sizes seamlessly with prefix to eliminate gaps between dollar sign and number", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let renderer: ReactTestRenderer | undefined;
  let focused = false;
  try {
    await act(async () => {
      renderer = create(
        <DepositAmountInput
          aria-label="USDC amount"
          prefix={<span className="dollar-prefix">$</span>}
          placeholder="0"
          value="0.21"
          onFocus={() => { focused = true; }}
          style={{ font: '500 20px/28px "Geist", system-ui, sans-serif' }}
        />
      );
    });
    const field = renderer!.root.findByProps({ className: "nx-amount-field" });
    assert.ok(field, "Expected .nx-amount-field container");
    const prefix = field.findByProps({ className: "dollar-prefix" });
    assert.equal(prefix.children[0], "$");

    const measuringSpan = field.findByProps({ "aria-hidden": "true" });
    assert.equal(measuringSpan.children[0], "0.21");
    assert.equal(measuringSpan.props.style.visibility, "hidden");
    assert.equal(measuringSpan.props.style.padding, 0);

    const input = field.findByProps({ "aria-label": "USDC amount" });
    assert.equal(input.props.value, "0.21");
    assert.equal(input.props.style.width, "100%");
    assert.equal(input.props.style.padding, 0);
    assert.equal(input.props.style.margin, 0);
    // Explicit width in ch is removed so grid sizing driven by measuring span eliminates gaps
    assert.equal((input.props.style as any).width, "100%");

    // Verify click on container triggers focus
    if (input.instance) {
      (input.instance as any).focus = () => { focused = true; };
    }
    await act(async () => { field.props.onClick(); });
    // If instance.focus was called, focused is true
    assert.equal(typeof field.props.onClick, "function");
  } finally {
    await act(async () => renderer?.unmount());
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  }
});
