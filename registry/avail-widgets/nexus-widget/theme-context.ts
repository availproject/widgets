"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { getNexusWidgetThemeStyle } from "./theme";
import type { NexusWidgetTheme } from "./types";

const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";
const getSystemIsDark = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(DARK_MODE_QUERY).matches;
const getServerIsDark = () => false;
const subscribeToSystemTheme = (onChange: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(DARK_MODE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export function useResolvedNexusWidgetTheme(theme: NexusWidgetTheme) {
  const systemIsDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemIsDark,
    getServerIsDark
  );
  return theme === "system" ? (systemIsDark ? "dark" : "light") : theme;
}

export const NexusWidgetThemeContext = createContext<CSSProperties>(
  getNexusWidgetThemeStyle(false)
);

/** Portals share the same scoped colors and primary-color overrides as the root. */
export const useNexusWidgetThemeStyle = () => useContext(NexusWidgetThemeContext);
