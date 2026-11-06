import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeFunctionData, encodeFunctionData, parseAbi, parseUnits } from "viem";
import { buildExactInputDeposit } from "../registry/avail-widgets/nexus-widget/utils/deposit-execution";

const abi = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
]);
const token = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d" as const;
const user = "0xccef861bab25549de5c8825ee3d553fb5304c636" as const;
const contract = "0x1111111111111111111111111111111111111111" as const;
const units = (amount: string) => parseUnits(amount, 18);
const source = { chainId: 56, tokenAddress: token, amountRaw: units("5") };
const buildExecute = (amount: bigint) => ({
  to: contract,
  gas: BigInt(350_000),
  data: encodeFunctionData({ abi, functionName: "supply", args: [token, amount, user, 0] }),
  tokenApproval: { toTokenAddress: token, amount, spender: contract },
});
const createDeposit = () => buildExactInputDeposit({
  sources: [source],
  toChainId: 56,
  toTokenAddress: token,
  buildExecute,
});

test("exact-input deposit uses fixed sources and omits the exact-output target", () => {
  const { input } = createDeposit();
  assert.equal(input.tradeType, "exactInput");
  assert.deepEqual(input.sources, [source]);
  assert.equal("toAmountRaw" in input, false);
  assert.deepEqual(input.execute.tokenApproval, {
    toTokenAddress: token,
    amount: BigInt(0),
    spender: contract,
  });
});

test("deposit calldata uses actual execution amount including selected local funds", async () => {
  const { input, beforeExecute } = createDeposit();
  // 130 funded + 5 selected locally; do not deposit only the proceeds or the
  // entire 140-token wallet balance, which includes 5 unselected tokens.
  const overrides = await beforeExecute({
    receivedAmountRaw: units("130"),
    executeAmountRaw: units("135"),
  });
  const finalExecute = { ...input.execute, ...overrides };
  const decoded = decodeFunctionData({ abi, data: finalExecute.data! });
  assert.equal(decoded.functionName, "supply");
  assert.equal(decoded.args[1], units("135"));
  assert.notEqual(finalExecute.data, input.execute.data);
  assert.equal("tokenApproval" in overrides, false);
});

test("local-only deposits rebuild calldata even when swap proceeds are zero", async () => {
  const { beforeExecute } = createDeposit();
  const execute = await beforeExecute({ receivedAmountRaw: BigInt(0), executeAmountRaw: units("5") });
  assert.equal(decodeFunctionData({ abi, data: execute.data! }).args[1], units("5"));
});

test("missing SDK context and non-positive execution amounts stop before building calldata", async () => {
  let builds = 0;
  const { beforeExecute } = buildExactInputDeposit({
    sources: [source], toChainId: 56, toTokenAddress: token,
    buildExecute: (amount) => { builds++; return buildExecute(amount); },
  });
  assert.equal(builds, 1);
  await assert.rejects(beforeExecute(), /did not provide the deposit execution amount/);
  for (const amount of [BigInt(0), BigInt(-1)]) {
    await assert.rejects(
      beforeExecute({ receivedAmountRaw: units("5"), executeAmountRaw: amount }),
      /must be greater than zero/,
    );
  }
  assert.equal(builds, 1);
});

test("empty or rounded-to-zero exact-input sources are rejected before planning", () => {
  for (const sources of [[], [{ ...source, amountRaw: BigInt(0) }], [{ ...source, amountRaw: BigInt(-1) }]]) {
    assert.throws(() => buildExactInputDeposit({
      sources, toChainId: 56, toTokenAddress: token, buildExecute,
    }), /positive raw amount/);
  }
});

test("native execution value is rebuilt from the SDK amount after its reserves", async () => {
  const { beforeExecute } = buildExactInputDeposit({
    sources: [source], toChainId: 56, toTokenAddress: token,
    buildExecute: (amount) => ({ to: contract, value: amount, gas: BigInt(350_000) }),
  });
  const overrides = await beforeExecute({ receivedAmountRaw: units("5"), executeAmountRaw: units("4.9") });
  assert.equal(overrides.value, units("4.9"));
  assert.equal(overrides.gas, BigInt(350_000));
});
