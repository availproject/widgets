import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchOnrampSession,
  getOnrampBaseUrl,
  isOnrampTerminalState,
  logOnramp,
  startOnrampPolling,
} from "./onramp-session";
import {
  getOnrampHistoryStorageKey,
  readOnrampHistory,
  upsertOnrampHistory,
  writeOnrampHistory,
  type OnrampHistoryUpdate,
} from "./onramp-history";

export const useOnrampHistory = ({
  ownerAddress = "", active, baseUrl = getOnrampBaseUrl(),
}: { ownerAddress?: string; active: boolean; baseUrl?: string }) => {
  const owner = ownerAddress.toLowerCase();
  const key = getOnrampHistoryStorageKey(owner, baseUrl);
  const [history, setHistory] = useState(() => ({ key, entries: readOnrampHistory(owner, baseUrl) }));
  const historyRef = useRef(history);
  const scopeRef = useRef({ key, owner, baseUrl });
  scopeRef.current = { key, owner, baseUrl };

  useEffect(() => {
    const load = () => {
      const next = { key, entries: readOnrampHistory(owner, baseUrl) };
      historyRef.current = next;
      setHistory(next);
    };
    if (historyRef.current.key !== key) load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, owner, baseUrl]);

  const recordSession = useCallback((update: OnrampHistoryUpdate) => {
    // Archive delayed responses under the initiating wallet without changing the wallet currently shown.
    const paymentOwner = update.ownerAddress.toLowerCase();
    const paymentKey = getOnrampHistoryStorageKey(paymentOwner, baseUrl);
    const isCurrentScope = scopeRef.current.key === paymentKey;
    const current = isCurrentScope && historyRef.current.key === paymentKey
      ? historyRef.current.entries : readOnrampHistory(paymentOwner, baseUrl);
    const entries = upsertOnrampHistory(current, update);
    if (entries === current) return;
    writeOnrampHistory(paymentOwner, baseUrl, entries);
    if (isCurrentScope) {
      const next = { key: paymentKey, entries };
      historyRef.current = next;
      setHistory(next);
    }
  }, [baseUrl]);

  const entries = history.key === key ? history.entries : [];
  const pendingIds = entries.filter((entry) => !isOnrampTerminalState(entry.session.state))
    .map((entry) => entry.session.sessionId!).sort().join("|");

  useEffect(() => {
    if (!active || !owner || !pendingIds) return;
    const poller = startOnrampPolling({
      fetchSession: async (signal) => {
        if (document.visibilityState === "hidden") return;
        const pending = historyRef.current.entries
          .filter((entry) => !isOnrampTerminalState(entry.session.state));
        for (const entry of pending) {
          if (signal.aborted) return;
          try {
            const session = await fetchOnrampSession(baseUrl, entry.session.sessionId!, signal);
            if (signal.aborted) return;
            logOnramp("history.poll.status", { sessionId: session.sessionId, state: session.state });
            recordSession({ ownerAddress: owner, session });
          } catch (error) {
            if (!signal.aborted) logOnramp("history.poll.retry", { sessionId: entry.session.sessionId, error });
          }
        }
      },
      onData: () => historyRef.current.entries.every((entry) => isOnrampTerminalState(entry.session.state)),
      onError: (error) => logOnramp("history.poll.retry", { error }),
      intervalMs: 5000,
    });
    const refresh = () => { if (document.visibilityState !== "hidden") void poller.refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      poller.stop();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, owner, key, baseUrl, pendingIds, recordSession]);

  return { entries, recordSession };
};
