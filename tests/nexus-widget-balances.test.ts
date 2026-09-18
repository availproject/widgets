import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Decimal from "decimal.js";
import ts from "typescript";
import type { UserAsset } from "../registry/avail-widgets/nexus/NexusProvider";
import {
  deriveTokenOptions,
  formatSelectedTokenBalanceLabel,
  type SwapTokenOption,
} from "../registry/avail-widgets/nexus-widget/components/swap-asset-selector";
import { parseAmount } from "../registry/avail-widgets/nexus-widget/utils/amount";

for (const symbol of ["USDT0", "USD₮0", "1INCH", "TOKEN2026", "USDC", "ETH"]) {
  test(`${symbol} never contributes digits to its balance`, () => {
    for (const amount of ["0", "10", "2.050856", "100.01"]) {
      for (const balance of [amount, `${amount} ${symbol}`]) {
        assert.equal(parseAmount(balance)?.toFixed(), amount);
        assert.equal(formatSelectedTokenBalanceLabel({ balance, symbol }), `${amount} ${symbol}`);
      }
    }
  });
}

test("amount parsing preserves SDK precision, scientific notation, and formatted fiat", () => {
  for (const [input, expected] of [
    ["0.000000000000000001", "0.000000000000000001"],
    ["1e-18", "0.000000000000000001"],
    ["1e-7 ETH", "0.0000001"],
    ["$1,234.56", "1234.56"],
    ["<$0.01", "0.01"],
    ["≈ $10.00", "10"],
    ["-2.5%", "-2.5"],
  ]) {
    assert.equal(parseAmount(input)?.toFixed(), expected);
  }
  for (const input of [null, undefined, "", "USD₮0", "1.2.3", "1,23", "NaN", Infinity, new Decimal(Infinity)]) {
    assert.equal(parseAmount(input), undefined);
  }
});

// Exercise the actual private balance and quote helpers without mounting wallet
// providers or requesting live quotes. Extract their declarations, not copies.
const widgetSource = ts.createSourceFile(
  "nexus-widget.tsx",
  readFileSync(new URL("../registry/avail-widgets/nexus-widget/nexus-widget.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const helperNames = [
  "getDestinationBalanceFromSwapBalances",
  "getTokenUsdRate",
  "getExactOutDestinationBalanceCoverage",
  "buildDestinationBalanceDisplayToken",
];
const declarations = new Map<string, string>();
const visit = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && helperNames.includes(node.name.text)) {
    declarations.set(node.name.text, `const ${node.getText(widgetSource)};`);
  }
  ts.forEachChild(node, visit);
};
visit(widgetSource);
assert.equal(declarations.size, helperNames.length);
const helperCode = ts.transpileModule(
  `${[...declarations.values()].join("\n")}\nreturn { ${helperNames.join(", ")} };`,
  { compilerOptions: { target: ts.ScriptTarget.ES2020 } },
).outputText;

const token: SwapTokenOption = {
  balance: "10",
  balanceInFiat: "$10.00",
  chainId: 42161,
  contractAddress: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  decimals: 6,
  name: "USDT0",
  symbol: "USDT0",
};
const chainBalance: UserAsset["breakdown"][number] = {
  chain: { id: 42161, name: "Arbitrum", logo: "" },
  contractAddress: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  decimals: 6,
  symbol: "USD₮0",
  balance: "10",
  totalBalance: "10",
  usableBalance: "10",
  value: "10.00",
  universe: 0,
  balanceInFiat: 10,
};
const balances: UserAsset[] = [{
  symbol: "USD₮0",
  name: "USD₮0",
  logo: "",
  decimals: 6,
  balance: "10",
  totalBalance: "10",
  usableBalance: "10",
  value: "10.00",
  chainBalances: [chainBalance],
  breakdown: [chainBalance],
}];

const loadHelpers = (destinationBalance: string | null, activeMode = "deposit") => {
  const scope = {
    Decimal,
    parseFiatNumber: parseAmount,
    destinationBalance,
    activeMode,
    toToken: token,
    swapBalance: balances,
    isNativeTokenAddress: () => false,
    getFiatValue: () => 0,
    getCachedIntentUsdRate: () => undefined,
  };
  return new Function(...Object.keys(scope), helperCode)(...Object.values(scope));
};

test("Arbitrum API balance remains 10 through destination lookup and token selection", () => {
  const helpers = loadHelpers(null);
  const balance = helpers.getDestinationBalanceFromSwapBalances(token);
  assert.equal(balance, "10");
  assert.equal(formatSelectedTokenBalanceLabel({ ...token, balance }), "10 USDT0");
  const options = deriveTokenOptions(balances);
  assert.equal(options[0]?.balance, "10");
  assert.equal(formatSelectedTokenBalanceLabel(options[0]), "10 USD₮0");
});

for (const mode of ["deposit", "send"]) {
  test(`${mode} predictive coverage uses 10 held USDT0 and leaves 90 to fund`, () => {
    for (const balance of ["10", "10 USDT0", "10 USD₮0", null]) {
      const helpers = loadHelpers(balance, mode);
      const coverage = helpers.getExactOutDestinationBalanceCoverage({ requestedAmount: new Decimal(100) });
      assert.equal(coverage.amount.toFixed(), "10");
      assert.equal(coverage.usd.toFixed(), "10");
      assert.equal(new Decimal(100).minus(coverage.amount).toFixed(), "90");
      const displayToken = helpers.buildDestinationBalanceDisplayToken(coverage, token);
      assert.equal(displayToken.balance, "10");
      assert.equal(formatSelectedTokenBalanceLabel(displayToken), "10 USDT0");
      // Restored selections can still contain the old symbol-suffixed balance.
      assert.equal(helpers.getTokenUsdRate({ ...token, balance: "10 USDT0" }).toFixed(), "1");
    }
  });
}

test("coverage never exceeds the remaining request or rounds a small balance up", () => {
  const helpers = loadHelpers("0.000000001");
  const coverage = helpers.getExactOutDestinationBalanceCoverage({
    requestedAmount: new Decimal(100),
    producedAmount: new Decimal("99.9999999995"),
  });
  assert.equal(coverage.amount.toFixed(), "0.0000000005");
  assert.equal(loadHelpers("0").getExactOutDestinationBalanceCoverage({ requestedAmount: new Decimal(100) }), null);
});
