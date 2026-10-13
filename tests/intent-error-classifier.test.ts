import assert from "node:assert/strict";
import { test } from "node:test";
import { ERROR_CODES, BackendError } from "@avail-project/nexus-core";
import {
  classifyIntentError,
  extractIntentQuoteFailure,
} from "../registry/avail-widgets/nexus/intent-error-classifier";
import { useNexusError } from "../registry/avail-widgets/common/hooks/useNexusError";

const USER_MOCK_ERROR_PAYLOAD = {
  operation: "quote request",
  error: "Every provider refused this intent",
  middlewareCode: "QUOTE_UNAVAILABLE",
  middlewareSubcode: "INTENT_REFUSED",
  errorId: "768f3418-36af-454c-a7d0-206471bf9c31",
  middlewareDetails: {
    sourceVerdicts: [
      {
        chainId: "EVM_43114",
        tokenAddress: "0x0000…0000",
        tokenSymbol: "AVAX",
        state: "unused",
      },
    ],
    providerReasons: [
      "nexus-v2: nexus-v2 bridges same-currency only; AVAX is a different currency than HYPE",
      "mayan: Mayan quote failed for 43114:0x0000000000000000000000000000000000000000: AMOUNT_TOO_SMALL: Amount too small (min ~0.09058 AVAX)",
      "relay: Provider quote output is below the 90% fair-value floor",
    ],
  },
  httpStatus: 422,
  intentQuoteFailure: {
    code: "QUOTE_UNAVAILABLE",
    subcode: "INTENT_REFUSED",
    errorId: "768f3418-36af-454c-a7d0-206471bf9c31",
    retryable: false,
    sourceVerdicts: [
      {
        chainId: 43114,
        tokenAddress: "0x0000…0000",
        tokenSymbol: "AVAX",
        state: "unused",
      },
    ],
    providerReasons: [
      "nexus-v2: nexus-v2 bridges same-currency only; AVAX is a different currency than HYPE",
      "mayan: Mayan quote failed for 43114:0x0000000000000000000000000000000000000000: AMOUNT_TOO_SMALL: Amount too small (min ~0.09058 AVAX)",
      "relay: Provider quote output is below the 90% fair-value floor",
    ],
    details: {
      sourceVerdicts: [
        {
          chainId: "EVM_43114",
          tokenAddress: "0x0000…0000",
          tokenSymbol: "AVAX",
          state: "unused",
        },
      ],
      providerReasons: [
        "nexus-v2: nexus-v2 bridges same-currency only; AVAX is a different currency than HYPE",
        "mayan: Mayan quote failed for 43114:0x0000000000000000000000000000000000000000: AMOUNT_TOO_SMALL: Amount too small (min ~0.09058 AVAX)",
        "relay: Provider quote output is below the 90% fair-value floor",
      ],
    },
  },
};

test("extractIntentQuoteFailure extracts quote failure from plain JSON payload", () => {
  const extracted = extractIntentQuoteFailure(USER_MOCK_ERROR_PAYLOAD);
  assert.ok(extracted, "Should extract quote failure");
  assert.equal(extracted.code, "QUOTE_UNAVAILABLE");
  assert.equal(extracted.subcode, "INTENT_REFUSED");
  assert.equal(extracted.providerReasons?.length, 3);
});

test("classifyIntentError classifies user intent refused error with actionable minimum amount", () => {
  const classified = classifyIntentError(USER_MOCK_ERROR_PAYLOAD);
  assert.equal(classified.bucket, "quote_provider");
  assert.equal(classified.retryable, false);
  assert.match(classified.message, /min ~0\.09058 AVAX/i);
  assert.match(classified.message, /Amount is too small/i);
});

test("classifyIntentError classifies NexusError instance wrapping the quote failure", () => {
  const nexusError = new BackendError(
    ERROR_CODES.BACKEND_INTENT_REFUSED,
    "The available providers cannot fulfill this swap.",
    { context: { service: "middleware" }, details: USER_MOCK_ERROR_PAYLOAD }
  );

  const classified = classifyIntentError(nexusError);
  assert.equal(classified.bucket, "quote_provider");
  assert.match(classified.message, /min ~0\.09058 AVAX/i);
});

test("useNexusError hook handler returns actionable classified message for user error", () => {
  const handler = useNexusError();
  const nexusError = new BackendError(
    ERROR_CODES.BACKEND_INTENT_REFUSED,
    "The available providers cannot fulfill this swap.",
    { context: { service: "middleware" }, details: USER_MOCK_ERROR_PAYLOAD }
  );

  const result = handler(nexusError);
  assert.equal(result.code, ERROR_CODES.BACKEND_INTENT_REFUSED);
  assert.match(result.message, /min ~0\.09058 AVAX/i);

  // Also test with raw object without NexusError instance
  const rawResult = handler(USER_MOCK_ERROR_PAYLOAD);
  assert.match(rawResult.message, /min ~0\.09058 AVAX/i);
});

test("classifyIntentError handles other backend codes cleanly", () => {
  const valueAboveCeiling = classifyIntentError({
    code: ERROR_CODES.BACKEND_VALUE_ABOVE_CEILING,
    message: "Value exceeds maximum",
  });
  assert.equal(valueAboveCeiling.bucket, "invalid_request");
  assert.match(valueAboveCeiling.message, /Reduce the swap value/i);

  const quoteUnavailable = classifyIntentError({
    code: ERROR_CODES.BACKEND_QUOTE_UNAVAILABLE,
    message: "No quote available",
  });
  assert.equal(quoteUnavailable.bucket, "quote_provider");
  assert.match(quoteUnavailable.message, /quote is not available/i);

  const noRoutable = classifyIntentError({
    code: ERROR_CODES.BACKEND_NO_ROUTABLE_SOURCE,
    message: "No routable sources",
  });
  assert.equal(noRoutable.bucket, "quote_provider");
  assert.match(noRoutable.message, /source asset/i);
});
