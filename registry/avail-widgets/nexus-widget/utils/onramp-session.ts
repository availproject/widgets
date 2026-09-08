/** Logs are scoped to onramp; stringify snapshots so DevTools cannot retain SDK/client objects. */
export const logOnramp = (step: string, details: unknown = {}) => {
  try {
    const seen = new WeakSet<object>();
    const snapshot = JSON.stringify(details, (key, value) => {
      if (
        (key === "token" && typeof value === "string") ||
        /^(authorization|signature|privateKey|seed|email|phone|clientIpAddress|widgetUrl|fallbackWidgetUrl|serviceProviderWidgetUrl)$/i.test(
          key,
        )
      ) {
        return "[redacted]";
      }
      if (typeof value === "bigint") return value.toString();
      if (typeof value === "function") return undefined;
      if (value instanceof Error) {
        return { ...value, name: value.name, message: value.message };
      }
      if (value && typeof value === "object") {
        if (seen.has(value)) return "[circular]";
        seen.add(value);
      }
      return value;
    });
    console.log(`[Nexus Onramp] ${new Date().toISOString()} ${step}`, snapshot);
  } catch {
    console.log(`[Nexus Onramp] ${step} [unserializable details]`);
  }
};

export type OnrampSessionResponse = {
  createdAt?: string;
  fallbackWidgetUrl?: string;
  paymentMethodType?: string;
  provider?: string;
  rawMeldStatus?: string;
  deposit?: { explorerUrl?: string; state?: string; txHash?: string };
  sessionId?: string;
  state?: string;
  transaction?: {
    id?: string;
    status?: string;
    destinationAmount?: string;
    destinationCurrencyCode?: string;
    sourceAmount?: string;
    sourceCurrencyCode?: string;
    txHash?: string;
    walletAddress?: string;
    chainId?: number;
  };
  updatedAt?: string;
  widgetUrl?: string;
};

export const getNormalizedOnrampState = (state?: string | null) =>
  (state ?? "").trim().toUpperCase();

const TERMINAL_STATES = new Set([
  "SETTLED",
  "FAILED",
  "DECLINED",
  "CANCELLED",
  "REFUNDED",
  "AUTHORIZATION_EXPIRED",
  "EXPIRED",
]);

export const isOnrampTerminalState = (state?: string | null) =>
  TERMINAL_STATES.has(getNormalizedOnrampState(state));

/** Accept both the middleware session envelope and Meld's documented transaction envelope. */
export const normalizeOnrampSession = (
  payload: any,
  currentSessionId?: string,
): OnrampSessionResponse => {
  const data = payload?.session ?? payload ?? {};
  const transaction = data.transaction;
  const crypto = transaction?.cryptoDetails;
  const amount = (value: unknown) =>
    value == null ? undefined : String(value);
  return {
    sessionId:
      currentSessionId ?? data.sessionId ?? data.externalSessionId ?? data.id,
    state: getNormalizedOnrampState(
      transaction?.status ?? data.rawMeldStatus ?? data.status ?? data.state,
    ),
    rawMeldStatus: transaction?.status ?? data.rawMeldStatus ?? data.status,
    provider:
      data.provider ?? data.serviceProvider ?? transaction?.serviceProvider,
    paymentMethodType: data.paymentMethodType ?? transaction?.paymentMethodType,
    createdAt: data.createdAt ?? transaction?.createdAt,
    updatedAt: data.updatedAt ?? transaction?.updatedAt,
    widgetUrl: data.serviceProviderWidgetUrl ?? data.widgetUrl,
    fallbackWidgetUrl: data.fallbackWidgetUrl,
    // A payment response cannot certify a wallet-executed deposit.
    transaction: transaction
      ? {
          id: transaction.id,
          status: transaction.status,
          destinationAmount: amount(transaction.destinationAmount),
          destinationCurrencyCode: transaction.destinationCurrencyCode,
          sourceAmount: amount(transaction.sourceAmount),
          sourceCurrencyCode: transaction.sourceCurrencyCode,
          txHash: crypto?.blockchainTransactionId ?? transaction.txHash,
          walletAddress: crypto?.walletAddress ?? transaction.walletAddress,
          chainId:
            crypto?.chainId == null
              ? transaction.chainId
              : Number(crypto.chainId),
        }
      : undefined,
  };
};

/** One request at a time. Refresh hints coalesce; stop aborts the request and clears the timer. */
export const startOnrampPolling = <T>({
  fetchSession,
  onData,
  onError,
  intervalMs = 3000,
}: {
  fetchSession: (signal: AbortSignal) => Promise<T>;
  onData: (data: T) => boolean; // true stops polling
  onError: (error: unknown) => void;
  intervalMs?: number;
}) => {
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    controller.abort();
  };
  const refresh = async () => {
    if (stopped || inFlight) return;
    clearTimeout(timer);
    inFlight = true;
    try {
      const data = await fetchSession(controller.signal);
      if (!stopped && onData(data)) stop();
    } catch (error) {
      if (!stopped) onError(error);
    } finally {
      inFlight = false;
      if (!stopped) timer = setTimeout(refresh, intervalMs);
    }
  };
  void refresh();
  return { refresh, stop };
};

export const onrampDelay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });

export const waitForOnrampReceipt = async (
  readReceipt: () => Promise<{ status?: string } | null>,
  signal: AbortSignal,
  { timeoutMs = 120_000, intervalMs = 2000 } = {},
) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const receipt = await readReceipt();
    signal.throwIfAborted();
    if (receipt?.status === "0x0")
      throw new Error("Transaction reverted on chain.");
    if (receipt?.status === "0x1") return receipt;
    await onrampDelay(intervalMs, signal);
  }
  throw new Error(
    "Transaction confirmation is pending. Retry to check the same transaction; do not pay again.",
  );
};

/** Spend only this purchase, even when the wallet already held tokens before the gas swap. */
export const getOnrampRemainingAmount = (
  received: bigint,
  before: bigint,
  after: bigint,
) => {
  const spent = before > after ? before - after : BigInt(0);
  const remaining = received - spent;
  if (remaining <= BigInt(0) || after < remaining) {
    throw new Error(
      "The onramp balance cannot cover the deposit after gas funding.",
    );
  }
  return remaining;
};
