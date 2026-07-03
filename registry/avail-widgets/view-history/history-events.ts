export const INTENT_HISTORY_REFRESH_EVENT = "nexus:intent-history:refresh";

export const notifyIntentHistoryRefresh = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(INTENT_HISTORY_REFRESH_EVENT));
};
