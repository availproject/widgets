import { type IntentHistoryRecord } from "@avail-project/nexus-core";
import { useNexus } from "../../nexus/NexusProvider";
import { useCallback, useEffect, useState } from "react";
import { INTENT_HISTORY_REFRESH_EVENT } from "../history-events";

const ITEMS_PER_PAGE = 10;

export interface IntentHistoryItem {
  destinationChain?: { id: number; name: string; logo: string };
  destinations: Array<{ token: { symbol: string } }>;
  expiry: number;
  explorerUrl?: string;
  id: string;
  provider?: string;
  requestHash: string;
  sources: Array<{ chain: { id: number; name: string; logo: string } }>;
  status: string;
}

const normalizeIntentRecord = (
  intent: IntentHistoryRecord
): IntentHistoryItem => ({
  destinations: [],
  expiry: intent.updatedAt ?? intent.createdAt ?? 0,
  explorerUrl: intent.explorerUrl,
  id: intent.id,
  provider: intent.provider,
  requestHash: intent.id,
  sources: [],
  status: intent.status,
});

function formatExpiryDate(timestamp: number) {
  if (!timestamp) return "—";
  const date = new Date(timestamp * (timestamp < 1e12 ? 1000 : 1));
  const formatted = date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  return formatted.replace(" ", ", ");
}

const useViewHistory = () => {
  const { nexusSDK } = useNexus();
  const [history, setHistory] = useState<IntentHistoryItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [displayedHistory, setDisplayedHistory] = useState<IntentHistoryItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sentinelNode, setSentinelNode] = useState<HTMLDivElement | null>(null);

  const observerTarget = useCallback((node: HTMLDivElement | null) => {
    setSentinelNode(node);
  }, []);

  const fetchIntentHistory = useCallback(async () => {
    if (!nexusSDK) return;
    try {
      const result = await nexusSDK.listIntents();
      const rawIntents = result?.intents ?? [];
      const nextHistory = rawIntents.map(normalizeIntentRecord);
      setLoadError(null);
      setHistory(nextHistory);
      const firstPage = nextHistory.slice(0, ITEMS_PER_PAGE);
      setDisplayedHistory(firstPage);
      setPage(0);
      setHasMore(nextHistory.length > ITEMS_PER_PAGE);
    } catch (error) {
      console.error("Error fetching intent history:", error);
      setLoadError("Please check your wallet connection and try again.");
      setHistory([]);
      setDisplayedHistory([]);
      setPage(0);
      setHasMore(false);
    }
  }, [nexusSDK]);

  useEffect(() => {
    void fetchIntentHistory();
  }, [fetchIntentHistory]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRefresh = () => {
      void fetchIntentHistory();
    };

    window.addEventListener(INTENT_HISTORY_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(INTENT_HISTORY_REFRESH_EVENT, handleRefresh);
    };
  }, [fetchIntentHistory]);

  const loadMore = useCallback(() => {
    if (!history || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    setTimeout(() => {
      const nextPage = page + 1;
      const startIndex = nextPage * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const newItems = history.slice(startIndex, endIndex);

      if (newItems.length > 0) {
        setDisplayedHistory((prev) => [...prev, ...newItems]);
        setPage(nextPage);
        setHasMore(endIndex < history.length);
      } else {
        setHasMore(false);
      }

      setIsLoadingMore(false);
    }, 300);
  }, [history, page, isLoadingMore, hasMore]);

  useEffect(() => {
    if (!sentinelNode) {
      return;
    }

    const rootElement = sentinelNode.parentElement;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1, root: rootElement ?? null }
    );

    observer.observe(sentinelNode);

    return () => {
      observer.disconnect();
    };
  }, [sentinelNode, loadMore, hasMore, isLoadingMore, displayedHistory.length]);

  const getStatus = (pastIntent: IntentHistoryItem) => {
    switch (pastIntent?.status?.toLowerCase()) {
      case "fulfilled":
        return "Fulfilled";
      case "deposited":
        return "Deposited";
      case "created":
        return "Created";
      case "expired":
        return "Expired";
      case "refunded":
        return "Refunded";
      default:
        return pastIntent?.status
          ? pastIntent.status.charAt(0).toUpperCase() + pastIntent.status.slice(1)
          : "Failed";
    }
  };

  return {
    history,
    loadError,
    displayedHistory,
    page,
    hasMore,
    isLoadingMore,
    getStatus,
    observerTarget,
    refreshHistory: fetchIntentHistory,
    ITEMS_PER_PAGE,
    formatExpiryDate,
  };
};

export default useViewHistory;
