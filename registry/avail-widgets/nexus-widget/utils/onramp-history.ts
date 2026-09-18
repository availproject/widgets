import {
  getNormalizedOnrampState,
  isOnrampTerminalState,
  mergeOnrampSession,
  normalizeOnrampSession,
  type OnrampSessionResponse,
} from "./onramp-session";

export type OnrampHistoryContext = {
  chainId?: number;
  tokenSymbol?: string;
  destinationAmount?: string;
  sourceAmount?: string;
  sourceCurrencyCode?: string;
  provider?: string;
  paymentMethodType?: string;
};

export type OnrampHistoryUpdate = {
  ownerAddress: string;
  session: OnrampSessionResponse;
  context?: OnrampHistoryContext;
};

export type OnrampHistoryEntry = {
  kind: "onramp";
  id: string;
  ownerAddress: string;
  createdAt: number;
  startedAt: number;
  session: Omit<OnrampSessionResponse, "widgetUrl" | "fallbackWidgetUrl" | "deposit">;
  context: OnrampHistoryContext;
};

export const getOnrampHistoryStorageKey = (ownerAddress: string, baseUrl: string) =>
  `nexus-widget-onramp-history-v1:${encodeURIComponent(baseUrl)}:${ownerAddress.toLowerCase()}`;

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const sanitizeContext = (context?: OnrampHistoryContext): OnrampHistoryContext => ({
  chainId: Number.isSafeInteger(context?.chainId) && context!.chainId! > 0
    ? context!.chainId : undefined,
  tokenSymbol: optionalText(context?.tokenSymbol),
  destinationAmount: optionalText(context?.destinationAmount),
  sourceAmount: optionalText(context?.sourceAmount),
  sourceCurrencyCode: optionalText(context?.sourceCurrencyCode),
  provider: optionalText(context?.provider),
  paymentMethodType: optionalText(context?.paymentMethodType),
});

const sanitizeSession = (session: OnrampSessionResponse) => {
  const { widgetUrl: _widgetUrl, fallbackWidgetUrl: _fallbackWidgetUrl, deposit: _deposit, ...safe } =
    normalizeOnrampSession(session);
  return safe;
};

export const upsertOnrampHistory = (
  entries: OnrampHistoryEntry[],
  update: OnrampHistoryUpdate,
  now = Date.now(),
): OnrampHistoryEntry[] => {
  const sessionId = optionalText(update.session.sessionId);
  const ownerAddress = update.ownerAddress.toLowerCase();
  if (!sessionId || !/^0x[\da-f]{40}$/i.test(ownerAddress)) return entries;
  if (update.session.transaction?.walletAddress &&
    update.session.transaction.walletAddress.toLowerCase() !== ownerAddress) return entries;
  const id = `onramp:${sessionId}`;
  const previous = entries.find((entry) => entry.id === id);
  const incoming = sanitizeSession(update.session);
  const previousTime = Date.parse(previous?.session.updatedAt ?? "");
  const incomingTime = Date.parse(incoming.updatedAt ?? "");
  if (previous && (
    incomingTime < previousTime ||
    (incoming.state && isOnrampTerminalState(previous.session.state) &&
      !isOnrampTerminalState(incoming.state))
  )) return entries;
  const createdAt = previous?.createdAt || Date.parse(incoming.createdAt ?? "") || now;
  const context = sanitizeContext({ ...previous?.context, ...update.context });
  const session = mergeOnrampSession(previous?.session, incoming);
  session.state = getNormalizedOnrampState(session.state) || "AWAITING_USER";
  const entry: OnrampHistoryEntry = {
    kind: "onramp", id, ownerAddress, createdAt, startedAt: createdAt, context, session,
  };
  if (previous && JSON.stringify(previous) === JSON.stringify(entry)) return entries;
  return [entry, ...entries.filter((item) => item.id !== id)]
    .sort((a, b) => b.createdAt - a.createdAt);
};

export const readOnrampHistory = (ownerAddress: string, baseUrl: string): OnrampHistoryEntry[] => {
  if (!ownerAddress || typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(
      getOnrampHistoryStorageKey(ownerAddress, baseUrl),
    ) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    let entries: OnrampHistoryEntry[] = [];
    for (const value of parsed) {
      try {
        if (value?.kind !== "onramp" || value.ownerAddress !== ownerAddress.toLowerCase() ||
          !Number.isFinite(value.createdAt) || value.createdAt <= 0) continue;
        entries = upsertOnrampHistory(entries, {
          ownerAddress, session: value.session, context: value.context,
        }, value.createdAt);
      } catch { /* Ignore one malformed stored entry without losing the rest. */ }
    }
    return entries;
  } catch { return []; }
};

export const writeOnrampHistory = (
  ownerAddress: string,
  baseUrl: string,
  entries: OnrampHistoryEntry[],
) => {
  if (!ownerAddress || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getOnrampHistoryStorageKey(ownerAddress, baseUrl), JSON.stringify(entries));
  } catch { /* In-memory history remains usable when storage is unavailable. */ }
};
