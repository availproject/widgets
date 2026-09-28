import { getIntentQuoteFailure } from "@avail-project/nexus-core";

export type IntentErrorBucket =
  | "user_rejected"
  | "quote_expired"
  | "quote_provider"
  | "insufficient_funds"
  | "wallet_network"
  | "invalid_request"
  | "sdk_internal"
  | "unknown";

export interface ClassifiedIntentError {
  bucket: IntentErrorBucket;
  message: string;
  retryable: boolean;
  technicalDetails?: string;
}

interface ErrorLike {
  category?: string;
  code?: number | string;
  context?: { service?: string };
  details?: Record<string, unknown>;
  message?: string;
  name?: string;
  service?: string;
}

const USER_REJECTED_PATTERN = /user (rejected|denied)|denied swap intent/i;
const QUOTE_EXPIRED_PATTERN = /quote.+expired|expired before submission/i;
const INSUFFICIENT_BALANCE_PATTERN =
  /insufficient balance|sources are not enough|source.+not enough/i;
const INSUFFICIENT_GAS_PATTERN =
  /gas required exceeds allowance|insufficient funds for gas/i;

const quoteFailureMessages: Record<string, string> = {
  INSUFFICIENT_APPROVAL_GAS:
    "You need more native gas on the source chain to approve this token.",
  INSUFFICIENT_BALANCE:
    "You do not have enough balance to complete this transaction.",
  INTENT_REFUSED:
    "No provider can complete this route with the selected assets and amount. Try another amount, asset, or network.",
  NO_PROVIDERS_ENABLED: "No quote provider is enabled for this route.",
  NO_ROUTABLE_SOURCE:
    "None of the selected assets can be used for this route. Try another source asset.",
  PROVIDER_UNAVAILABLE:
    "Quote providers are temporarily unavailable. Please try again.",
  QUOTE_PRICE_OUTLIER:
    "This quote was rejected because the price was outside the safe range.",
  QUOTE_PRICE_UNAVAILABLE:
    "A reliable price is not available for this route. Try another asset or network.",
  SAME_CHAIN_GAS_DROP_UNSUPPORTED:
    "This route cannot provide the requested destination gas.",
};

const stringifyDetails = (value: unknown) => {
  try {
    return JSON.stringify(
      value,
      (_key, item) => (typeof item === "bigint" ? item.toString() : item),
      2
    );
  } catch {
    return String(value);
  }
};

const getTechnicalDetails = (error: ErrorLike) => {
  const details = error.details;
  if (!details || typeof details !== "object") {
    return undefined;
  }

  const labels = [
    details.middlewareCode
      ? `code: ${String(details.middlewareCode)}`
      : undefined,
    details.middlewareSubcode
      ? `subcode: ${String(details.middlewareSubcode)}`
      : undefined,
    details.errorId ? `error ID: ${String(details.errorId)}` : undefined,
  ].filter(Boolean);
  const payload = details.middlewareDetails ?? details;

  return [
    labels.length > 0 ? `Middleware ${labels.join(" · ")}` : undefined,
    Object.keys(details).length > 0
      ? `Details:\n${stringifyDetails(payload)}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");
};

export const isUserRejectedIntentError = (error: unknown) => {
  const value = (error ?? {}) as ErrorLike;
  const code = String(value.code ?? "").toLowerCase();
  const message = value.message ?? (typeof error === "string" ? error : "");

  return (
    value.category === "user_action" ||
    value.code === 4001 ||
    code === "action_rejected" ||
    code === "user_denied_intent" ||
    code.startsWith("user_action/") ||
    value.name === "UserRejectedRequestError" ||
    USER_REJECTED_PATTERN.test(message)
  );
};

const classifyQuoteFailure = (
  error: unknown
): ClassifiedIntentError | undefined => {
  const quoteFailure = getIntentQuoteFailure(error);
  if (!quoteFailure) {
    return undefined;
  }

  const labels = [
    quoteFailure.code ? `code: ${quoteFailure.code}` : undefined,
    `subcode: ${quoteFailure.subcode}`,
    quoteFailure.errorId ? `error ID: ${quoteFailure.errorId}` : undefined,
  ].filter(Boolean);
  const details = {
    sourceVerdicts: quoteFailure.sourceVerdicts,
    providerReasons: quoteFailure.providerReasons,
    ...quoteFailure.details,
  };

  return {
    bucket:
      quoteFailure.subcode === "INSUFFICIENT_BALANCE" ||
      quoteFailure.subcode === "INSUFFICIENT_APPROVAL_GAS"
        ? "insufficient_funds"
        : "quote_provider",
    message:
      quoteFailureMessages[quoteFailure.subcode] ??
      "A quote is not available for this route. Try another amount, asset, or network.",
    retryable: quoteFailure.retryable,
    technicalDetails: [
      `Middleware ${labels.join(" · ")}`,
      `Details:\n${stringifyDetails(details)}`,
    ].join("\n"),
  };
};

const classifyNonQuoteError = (
  value: ErrorLike,
  code: string,
  message: string
): ClassifiedIntentError => {
  if (
    code === "validation/insufficient_balance" ||
    INSUFFICIENT_BALANCE_PATTERN.test(message)
  ) {
    return {
      bucket: "insufficient_funds",
      message: "You do not have enough balance to complete this transaction.",
      retryable: false,
      technicalDetails: getTechnicalDetails(value),
    };
  }

  if (INSUFFICIENT_GAS_PATTERN.test(message)) {
    return {
      bucket: "wallet_network",
      message:
        "You need more native gas on the source chain to approve this token. Sponsored gas is not supported in this flow.",
      retryable: false,
      technicalDetails: getTechnicalDetails(value),
    };
  }

  if (
    value.category === "execution" ||
    value.context?.service === "wallet" ||
    value.context?.service === "rpc" ||
    value.service === "wallet" ||
    value.service === "rpc"
  ) {
    return {
      bucket: "wallet_network",
      message:
        "The wallet or network could not complete this transaction. Check your network and gas balance, then try again.",
      retryable: true,
      technicalDetails: getTechnicalDetails(value),
    };
  }

  if (value.category === "validation" || code.startsWith("validation/")) {
    return {
      bucket: "invalid_request",
      message:
        message ||
        "The transaction details are invalid. Review them and try again.",
      retryable: false,
      technicalDetails: getTechnicalDetails(value),
    };
  }

  if (value.category === "internal" || code.startsWith("internal/")) {
    return {
      bucket: "sdk_internal",
      message:
        "Something went wrong in the Nexus SDK. Please try again. If it continues, contact support.",
      retryable: true,
      technicalDetails: getTechnicalDetails(value),
    };
  }

  return {
    bucket: "unknown",
    message: "Transaction failed. Please try again.",
    retryable: true,
    technicalDetails:
      getTechnicalDetails(value) ??
      (message ? `Original error: ${message}` : undefined),
  };
};

export const classifyIntentError = (error: unknown): ClassifiedIntentError => {
  const value = (error ?? {}) as ErrorLike;
  const message = value.message ?? (typeof error === "string" ? error : "");

  if (isUserRejectedIntentError(error)) {
    return {
      bucket: "user_rejected",
      message: "Transaction cancelled.",
      retryable: true,
    };
  }

  if (QUOTE_EXPIRED_PATTERN.test(message)) {
    return {
      bucket: "quote_expired",
      message: "This quote expired. Request a new quote and try again.",
      retryable: true,
      technicalDetails: getTechnicalDetails(value),
    };
  }

  return (
    classifyQuoteFailure(error) ??
    classifyNonQuoteError(value, String(value.code ?? ""), message)
  );
};

export const formatClassifiedIntentError = (
  classified: ClassifiedIntentError
) => classified.message;
