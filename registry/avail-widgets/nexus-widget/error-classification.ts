const WALLET_REJECTION_CODES = new Set<unknown>([
  4001,
  "ACTION_REJECTED",
  "user_action/allowance_approval_denied",
  "user_action/intent_signature_denied",
  "user_action/siwe_signature_denied",
  "user_action/tx_send_denied",
  "user_action/ephemeral_key_denied",
]);

/** Classify explicit wallet evidence only; hook denial and error text are not wallet evidence. */
export function widgetErrorReason(error: unknown): "wallet_rejected" | "unknown" {
  try {
    const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
    return WALLET_REJECTION_CODES.has(code) ? "wallet_rejected" : "unknown";
  } catch { return "unknown"; }
}
