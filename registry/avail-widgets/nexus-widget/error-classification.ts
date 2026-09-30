import { ERROR_CODES } from "@avail-project/nexus-core";

const KNOWN_CODES = new Set<string>(Object.values(ERROR_CODES));
const WALLET_REJECTION_CODES = new Set<unknown>([
  4001, "ACTION_REJECTED",
  "user_action/allowance_approval_denied", "user_action/intent_signature_denied",
  "user_action/siwe_signature_denied", "user_action/tx_send_denied", "user_action/ephemeral_key_denied",
]);
const reasonForCode = (code: string) => {
  const [category, detail] = code.split("/");
  return WALLET_REJECTION_CODES.has(code) ? "wallet_rejected" : detail === "error" ? `${category}_error` : detail;
};
const summaries: Record<string, string> = Object.fromEntries(
  [...KNOWN_CODES].map(code => {
    const reason = reasonForCode(code);
    const label = reason.replaceAll("_", " ");
    return [reason, `${label[0].toUpperCase()}${label.slice(1)}.`];
  }),
);
Object.assign(summaries, {
  unknown: "Unclassified error; no recognized error code or message template was available.",
  wallet_rejected: "The user rejected a wallet request.",
  destination_swap_quote_unavailable: "No destination swap quote is available.",
  destination_gas_quote_unavailable: "No destination gas swap quote is available.",
  destination_swap_resize_failed: "Failed to resize the destination swap quote.",
  destination_swap_requote_failed: "Failed to requote the destination swap.",
  invalid_quote: "The SDK returned a quote the widget could not render.",
  unsuccessful_result: "The SDK returned an unsuccessful result without an error.",
});
export const WIDGET_ERROR_SUMMARIES: Readonly<Record<string, string>> = Object.freeze(summaries);
export const WIDGET_ERROR_REASONS = new Set(Object.keys(summaries));
export const WIDGET_ERROR_CATEGORIES = new Set(["validation", "user_action", "simulation", "execution", "backend", "external_service", "internal", "widget"]);
export const WIDGET_ERROR_STEPS = new Set([
  "allowance", "allowance_approval", "request_signing", "vault_deposit", "bridge_deposit",
  "bridge_intent_submission", "bridge_fill", "source_swap", "destination_swap", "destination_transfer",
  "execute_approval", "execute", "transaction", "simulation", "refund",
]);
const read = (value: unknown, key: string): unknown => {
  try { return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined; }
  catch { return undefined; }
};

/** Returns only fixed classifications and public context. Raw messages/details never leave this function. */
export function classifyWidgetError(error: unknown): Record<string, unknown> {
  const seen = new Set<unknown>();
  let candidate = error;
  let fallbackService: unknown;
  for (let depth = 0; candidate != null && depth < 4 && !seen.has(candidate); depth++) {
    seen.add(candidate);
    const code = read(candidate, "code");
    const context = read(candidate, "context");
    const service = read(context, "service");
    fallbackService ??= service;
    const sdkCode = typeof code === "string" && KNOWN_CODES.has(code) ? code : undefined;
    let reason = sdkCode ? reasonForCode(sdkCode) : undefined;
    let errorCategory = sdkCode?.split("/")[0];
    if (WALLET_REJECTION_CODES.has(code)) { reason = "wallet_rejected"; errorCategory = "user_action"; }
    if (code === "widget/invalid_quote") { reason = "invalid_quote"; errorCategory = "widget"; }
    if (code === "widget/unsuccessful_result") { reason = "unsuccessful_result"; errorCategory = "widget"; }

    // Match complete, known SDK templates. Dynamic chain/token values are never copied to summaries.
    // A specific unrelated structured code takes precedence over message text.
    const message = typeof candidate === "string" ? candidate : read(candidate, "message");
    let templateChainId: number | undefined;
    if ((!reason || sdkCode === "external_service/destination_swap_quote_failed") && typeof message === "string" && message.length <= 2048) {
      const unavailable = /^(?:Quote failed: )?No destination swap quote available for chain (\d+) token 0x[0-9a-f]{40}$/i.exec(message);
      const gas = /^(?:Quote failed: )?No destination gas swap quote available for chain (\d+)$/i.exec(message);
      if (unavailable || gas) {
        reason = unavailable ? "destination_swap_quote_unavailable" : "destination_gas_quote_unavailable";
        templateChainId = Number((unavailable ?? gas)![1]);
        errorCategory = "external_service";
      } else if (message === "Quote failed: Failed to resize destination swap.") {
        reason = "destination_swap_resize_failed"; errorCategory = "external_service";
      } else if (message === "Quote failed: Failed to requote destination swap.") {
        reason = "destination_swap_requote_failed"; errorCategory = "external_service";
      }
    }
    if (reason) return {
      reason, errorSummary: summaries[reason], errorCategory,
      "error.code": sdkCode,
      service: reason === "wallet_rejected" ? "wallet" : service ?? fallbackService,
      errorStep: read(context, "stepType"),
      errorChainId: read(context, "chainId") ?? templateChainId,
    };
    candidate = read(candidate, "cause");
  }
  return { reason: "unknown", errorSummary: summaries.unknown, service: fallbackService };
}
