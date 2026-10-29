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
