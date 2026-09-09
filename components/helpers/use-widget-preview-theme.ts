"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import type { NexusWidgetTheme } from "@/registry/avail-widgets/nexus-widget/types";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Share the site's saved preference without changing the initial hydration markup. */
export function useWidgetPreviewTheme(): NexusWidgetTheme {
  const { theme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  return mounted && (theme === "light" || theme === "dark") ? theme : "system";
}
