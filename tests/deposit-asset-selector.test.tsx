import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { DepositAssetSelector } from "../registry/avail-widgets/nexus-widget/components/deposit-asset-selector";
import type { SwapTokenOption } from "../registry/avail-widgets/nexus-widget/components/swap-asset-selector";

const usdc: SwapTokenOption = {
  chainId: 1, chainName: "Ethereum", contractAddress: "0xAbC", symbol: "USDC", name: "USD Coin",
  decimals: 6, balance: "3.24", balanceInFiat: "$3.24",
};
const tokens = [
  usdc,
  { ...usdc, chainId: 42161, chainName: "Arbitrum", balance: "10.33", balanceInFiat: "$10.33" },
  { ...usdc, symbol: "ETH", name: "Ether", contractAddress: "0xdef", balance: "0.00094", balanceInFiat: "$0.50" },
];

test("deposit picker searches and filters individual chains, excludes selected assets, and selects immediately", async () => {
  const previous = Object.fromEntries(["document", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, document: { addEventListener() {}, removeEventListener() {} } });
  let renderer: ReactTestRenderer | undefined;
  const picked: SwapTokenOption[] = [];
  try {
    await act(async () => { renderer = create(<DepositAssetSelector tokens={tokens}
      selectedTokens={[{ ...usdc, contractAddress: "0xabc", userAmount: "2" }]} onSelect={token => picked.push(token)} />); });
    const rows = () => renderer!.root.findAllByProps({ className: "nx-asset-row" });
    const search = () => renderer!.root.findByType("input");
    assert.equal(rows().length, 2, "same address on another chain stays selectable, including dust balances");
    await act(async () => { search().props.onChange({ target: { value: "ARBITRUM" } }); });
    assert.equal(rows().length, 1);
    await act(async () => { rows()[0].props.onClick(); });
    assert.equal(picked[0], tokens[1], "row click selects the exact chain-specific token immediately");
    await act(async () => { search().props.onChange({ target: { value: "" } }); });
    await act(async () => { renderer!.root.findByProps({ className: "nx-asset-chain" }).props.onClick(); });
    const chainOption = renderer!.root.findAllByType("button").find(button => button.children.includes("Ethereum"))!;
    await act(async () => { chainOption.props.onClick(); });
    assert.equal(rows().length, 1);
    await act(async () => { rows()[0].props.onClick(); });
    assert.equal(picked[1], tokens[2]);
    await act(async () => { search().props.onChange({ target: { value: "no match" } }); });
    assert.equal(rows().length, 0);
    assert.match(renderer!.root.findByProps({ role: "status" }).children.join(""), /No tokens match/);
    await act(async () => {
      renderer!.update(<DepositAssetSelector key="edit" tokens={tokens} selectedTokens={[usdc, tokens[1]]}
        editingToken={usdc} onSelect={token => picked.push(token)} />);
    });
    assert.equal(rows().length, 2, "edit includes the current token but excludes other selected tokens");
    assert.equal(rows().filter(row => row.props["aria-pressed"] === true).length, 1);
    await act(async () => { rows().find(row => row.props["aria-pressed"] === true)!.props.onClick(); });
    assert.equal(picked.at(-1), usdc);
  } finally {
    await act(async () => { renderer?.unmount(); });
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("chain menu renders radio buttons for all chains and each chain option", async () => {
  const previous = Object.fromEntries(
    ["document", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: { addEventListener() {}, removeEventListener() {} },
  });
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <DepositAssetSelector tokens={tokens} onSelect={() => {}} />
      );
    });
    // Open chain menu
    await act(async () => {
      renderer!.root.findByProps({ className: "nx-asset-chain" }).props.onClick();
    });
    const menu = renderer!.root.findByProps({ className: "nx-asset-menu" });
    const radioButtons = menu.findAllByProps({ role: "radio" });
    assert.equal(radioButtons.length, 3); // "All Chains", Ethereum, Arbitrum
    // "All Chains" is selected initially
    assert.equal(radioButtons[0].props["aria-checked"], true);
    assert.equal(radioButtons[1].props["aria-checked"], false);
    // Radio indicator is present
    const radios = menu.findAllByProps({ className: "nx-asset-menu-radio" });
    assert.equal(radios.length, 3);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("deposit picker hides tokens whose balance is below minBalanceUsd ($1)", async () => {
  const previous = Object.fromEntries(
    ["document", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: { addEventListener() {}, removeEventListener() {} },
  });
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <DepositAssetSelector
          tokens={tokens}
          minBalanceUsd={1}
          onSelect={() => {}}
        />
      );
    });
    const rows = renderer!.root.findAllByProps({ className: "nx-asset-row" });
    // tokens has usdc ($3.24), Arbitrum usdc ($10.33), and ETH ($0.50).
    // With minBalanceUsd=1, ETH ($0.50) is hidden, so only 2 selectable tokens remain.
    assert.equal(rows.length, 2);
    const symbols = rows.map((r) => r.findAllByProps({ className: "nx-asset-primary" })[0]?.children?.join(""));
    assert.ok(!symbols.includes("ETH"));

    // Verify the hidden tokens toggle button
    const toggle = renderer!.root.findByProps({ className: "nx-asset-hidden-toggle" });
    assert.ok(toggle, "Expected hidden tokens toggle button");
    assert.equal(toggle.props["aria-expanded"], false);
    const spanTexts = toggle.findAllByType("span").map((s) => (Array.isArray(s.children) ? s.children.join("") : String(s.children ?? "")));
    assert.ok(spanTexts.some((t) => /1 token below \$1 hidden/.test(t)));

    // Expand the hidden tokens section
    await act(async () => {
      toggle.props.onClick();
    });
    assert.equal(toggle.props["aria-expanded"], true);

    // Verify info message and disabled hidden row
    const info = renderer!.root.findByProps({ className: "nx-asset-hidden-info" });
    const infoText = info.findAllByType("span").map((s) => (Array.isArray(s.children) ? s.children.join("") : String(s.children ?? ""))).join("");
    assert.match(infoText, /Too small to deposit, so they can’t be selected\./);

    const disabledRow = renderer!.root.findByProps({ className: "nx-asset-row nx-asset-row-disabled" });
    assert.ok(disabledRow, "Expected disabled row for ETH below $1");
    assert.equal(disabledRow.props["aria-disabled"], "true");
    const disabledSymbol = disabledRow.findAllByProps({ className: "nx-asset-primary" })[0]?.children?.join("");
    assert.equal(disabledSymbol, "ETH");

    // Collapse again
    await act(async () => {
      toggle.props.onClick();
    });
    assert.equal(toggle.props["aria-expanded"], false);
    assert.equal(renderer!.root.findAllByProps({ className: "nx-asset-hidden-info" }).length, 0);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

