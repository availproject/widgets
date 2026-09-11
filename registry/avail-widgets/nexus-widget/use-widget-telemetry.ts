"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import type { NexusIdentity, NexusObservabilityConfig, createWidgetObservationHub } from "../nexus/widget-observability";
import { createWidgetTelemetry } from "./observability";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
export function useWidgetTelemetry({ identity, config, mode, walletAddress, hub }: {
  identity?: NexusIdentity;
  config?: NexusObservabilityConfig;
  mode: "deposit" | "swap" | "send";
  walletAddress?: string;
  hub: ReturnType<typeof createWidgetObservationHub>;
}) {
  const [telemetry] = useState(() => createWidgetTelemetry({ identity, config, mode, walletAddress }));
  useBrowserLayoutEffect(() => {
    telemetry.configure({ identity, config, mode, walletAddress });
  }, [telemetry, identity, config, mode, walletAddress]);
  useBrowserLayoutEffect(() => {
    telemetry.resume();
    const unsubscribe = hub.subscribe(telemetry.startCall);
    return () => { unsubscribe(); telemetry.dispose(); };
  }, [hub, telemetry]);
  return telemetry;
}
