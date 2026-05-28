import { ERROR_CODES, NexusError } from "@avail-project/nexus-core";

const DEFAULT_ERROR_MESSAGE = "Oops! Something went wrong. Please try again.";
const USER_REJECTED_MESSAGE = "Transaction was rejected in your wallet.";
const EMPTY_ERROR_MESSAGE =
  "Unable to determine transaction state. Please refresh and try again.";

const ERROR_MESSAGE_BY_CODE: Partial<Record<string, string>> = {
  [ERROR_CODES.INVALID_VALUES_ALLOWANCE_HOOK]:
    "Invalid allowance selection. Please review allowance values and try again.",
  [ERROR_CODES.SDK_NOT_INITIALIZED]:
    "Nexus SDK is not initialized. Reconnect your wallet and try again.",
  [ERROR_CODES.SDK_INIT_STATE_NOT_EXPECTED]:
    "Nexus is still initializing. Please wait a few seconds and retry.",
  [ERROR_CODES.CHAIN_NOT_FOUND]:
    "Selected chain is not supported for this route.",
  [ERROR_CODES.CHAIN_DATA_NOT_FOUND]:
    "Chain metadata is unavailable for this route. Please try another chain.",
  [ERROR_CODES.ASSET_NOT_FOUND]:
    "Requested asset was not found in your balances.",
  [ERROR_CODES.COSMOS_ERROR]:
    "Cosmos-side operation failed. Please retry in a moment.",
  [ERROR_CODES.TOKEN_NOT_SUPPORTED]:
    "Selected token is not supported for this route.",
  [ERROR_CODES.UNIVERSE_NOT_SUPPORTED]:
    "Selected chain universe is not supported yet.",
  [ERROR_CODES.ENVIRONMENT_NOT_SUPPORTED]:
    "Selected environment is not supported yet.",
  [ERROR_CODES.ENVIRONMENT_NOT_KNOWN]:
    "Selected environment is not recognized.",
  [ERROR_CODES.UNKNOWN_SIGNATURE]:
    "Unsupported signature type for this transaction.",
  [ERROR_CODES.LIQUIDITY_TIMEOUT]:
    "Timed out waiting for liquidity. Please retry.",
  [ERROR_CODES.USER_DENIED_INTENT]: USER_REJECTED_MESSAGE,
  [ERROR_CODES.USER_DENIED_ALLOWANCE]: USER_REJECTED_MESSAGE,
  [ERROR_CODES.USER_DENIED_INTENT_SIGNATURE]: USER_REJECTED_MESSAGE,
  [ERROR_CODES.USER_DENIED_SIWE_SIGNATURE]: USER_REJECTED_MESSAGE,
  [ERROR_CODES.INSUFFICIENT_BALANCE]: "Insufficient balance to proceed.",
  [ERROR_CODES.WALLET_NOT_CONNECTED]:
    "Wallet is not connected. Connect your wallet and try again.",
  [ERROR_CODES.FETCH_GAS_PRICE_FAILED]:
    "Unable to estimate gas right now. Please retry.",
  [ERROR_CODES.SIMULATION_FAILED]:
    "Simulation failed. Please review your inputs and try again.",
  [ERROR_CODES.QUOTE_FAILED]:
    "Unable to fetch a quote right now. Please retry.",
  [ERROR_CODES.SWAP_FAILED]: "Swap execution failed. Please retry.",
  [ERROR_CODES.VAULT_CONTRACT_NOT_FOUND]:
    "Required vault contract is unavailable on this chain.",
  [ERROR_CODES.SLIPPAGE_EXCEEDED_ALLOWANCE]:
    "Slippage exceeded tolerance. Refresh quote and retry.",
  [ERROR_CODES.RATES_CHANGED_BEYOND_TOLERANCE]:
    "Rates changed beyond tolerance. Review and retry.",
  [ERROR_CODES.RFF_FEE_EXPIRED]: "Quote expired. Refresh and try again.",
  [ERROR_CODES.INVALID_INPUT]:
    "Some transaction inputs are invalid. Please review and try again.",
  [ERROR_CODES.INVALID_ADDRESS_LENGTH]:
    "Address format is invalid for the selected chain.",
  [ERROR_CODES.NO_BALANCE_FOR_ADDRESS]:
    "No balance found for this wallet on supported source chains.",
  [ERROR_CODES.TRANSACTION_TIMEOUT]:
    "Transaction is taking longer than expected. Check your wallet and explorer.",
  [ERROR_CODES.TRANSACTION_REVERTED]:
    "Transaction reverted on-chain. Please verify inputs and retry.",
  [ERROR_CODES.DESTINATION_REQUEST_HASH_NOT_FOUND]:
    "Could not finalize destination request. Please retry.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const message = value.message;
  return typeof message === "string" ? message : undefined;
}

function getErrorCode(value: unknown): string | number | undefined {
  if (!isRecord(value)) return undefined;
  const code = value.code;
  if (typeof code === "string" || typeof code === "number") {
    return code;
  }
  return undefined;
}

function looksLikeUserRejection(err: unknown): boolean {
  if (err instanceof NexusError) {
    return (
      err.code === ERROR_CODES.USER_DENIED_ALLOWANCE ||
      err.code === ERROR_CODES.USER_DENIED_INTENT ||
      err.code === ERROR_CODES.USER_DENIED_INTENT_SIGNATURE ||
      err.code === ERROR_CODES.USER_DENIED_SIWE_SIGNATURE
    );
  }

  const code = getErrorCode(err);
  if (code === 4001 || code === "ACTION_REJECTED") {
    return true;
  }

  const message = getErrorMessage(err)?.toLowerCase();
  if (!message) return false;
  return (
    message.includes("user denied") ||
    message.includes("user rejected") ||
    message.includes("rejected request") ||
    message.includes("denied transaction signature")
  );
}

function sanitizeMessage(message?: string): string {
  if (!message) return DEFAULT_ERROR_MESSAGE;
  const cleaned = message
    .replace(/^Internal error:\s*/i, "")
    .replace(/^COSMOS:\s*/i, "")
    .trim();
  return cleaned || DEFAULT_ERROR_MESSAGE;
}

function handler(err: unknown) {
  if (err === null || err === undefined) {
    console.error("Unexpected empty error from Nexus SDK:", err);
    return {
      code: "unexpected_error",
      message: EMPTY_ERROR_MESSAGE,
      context: undefined,
      details: undefined,
    };
  }

  if (looksLikeUserRejection(err)) {
    return {
      code: ERROR_CODES.USER_DENIED_INTENT,
      message: USER_REJECTED_MESSAGE,
      context: undefined,
      details: undefined,
    };
  }

  if (err instanceof NexusError) {
    const mappedMessage =
      ERROR_MESSAGE_BY_CODE[err.code] ?? sanitizeMessage(err.message);
    return {
      code: err.code,
      message: mappedMessage,
      context: err?.data?.context,
      details: err?.data?.details,
    };
  }

  const unknownMessage = sanitizeMessage(getErrorMessage(err));
  console.error("Unexpected error:", err);
  return {
    code: String(getErrorCode(err) ?? "unexpected_error"),
    message: unknownMessage || DEFAULT_ERROR_MESSAGE,
    context: undefined,
    details: undefined,
  };
}

export function useNexusError() {
  return handler;
}
