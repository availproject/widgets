import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeOnrampSession } from "../registry/avail-widgets/nexus-widget/utils/onramp-session";

for (const raw of [false, true]) {
  for (const wrapped of [false, true]) {
    const shape = `${wrapped ? "wrapped " : ""}${raw ? "Meld" : "middleware"}`;
    const payload = (chainId: unknown) => {
      const data = {
        state: "SETTLED",
        transaction: {
          status: "SETTLED",
          destinationAmount: "14.57",
          destinationCurrencyCode: "USDC_OPTIMISM",
          ...(raw ? { cryptoDetails: { chainId } } : { chainId }),
        },
      };
      return wrapped ? { session: data } : data;
    };

    test(`${shape} normalizes equivalent Optimism chain IDs and is idempotent`, () => {
      for (const chainId of [10, "10", " 10 ", "0xa", "0xA", "EVM_10"]) {
        const session = normalizeOnrampSession(payload(chainId));
        assert.equal(session.transaction?.chainId, 10, String(chainId));
        assert.equal(session.transaction?.destinationAmount, "14.57");
        assert.equal(
          session.transaction?.destinationCurrencyCode,
          "USDC_OPTIMISM",
        );
        assert.deepEqual(normalizeOnrampSession(session), session);
      }
    });

    test(`${shape} preserves absent IDs and other chains`, () => {
      for (const chainId of [undefined, null]) {
        assert.equal(
          normalizeOnrampSession(payload(chainId)).transaction?.chainId,
          undefined,
        );
      }
      for (const chainId of [8453, "8453", "EVM_8453", "0x2105"]) {
        assert.equal(
          normalizeOnrampSession(payload(chainId)).transaction?.chainId,
          8453,
        );
      }
    });

    test(`${shape} rejects malformed IDs instead of bypassing the chain check`, () => {
      for (const chainId of [
        "", " ", 0, "0", -10, "-10", 1.5, "1.5", "1e1", "other_10",
        "EVM_", "0x", true, {}, [], Number.NaN, Infinity,
        Number.MAX_SAFE_INTEGER + 1, "9007199254740993",
      ]) {
        assert.throws(
          () => normalizeOnrampSession(payload(chainId)),
          /invalid chain ID/,
        );
      }
    });
  }
}

test("Meld cryptoDetails takes precedence; missing nested IDs fall back to middleware", () => {
  const transaction = { chainId: "10", cryptoDetails: { chainId: "8453" } };
  assert.equal(normalizeOnrampSession({ transaction }).transaction?.chainId, 8453);
  for (const chainId of [undefined, null]) {
    const session = normalizeOnrampSession({
      transaction: { ...transaction, cryptoDetails: { chainId } },
    });
    assert.equal(session.transaction?.chainId, 10);
  }
  assert.throws(
    () => normalizeOnrampSession({
      transaction: { ...transaction, cryptoDetails: { chainId: "invalid" } },
    }),
    /invalid chain ID/,
  );
});
