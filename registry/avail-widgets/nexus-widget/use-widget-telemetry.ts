"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import type { NexusIdentity, NexusObservabilityConfig, createWidgetObservationHub } from "../nexus/widget-observability";
import { createWidgetTelemetry } from "./observability";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
export function useWidgetTelemetry({ identity, config, mode, walletAddress, hub, network }: {
  identity?: NexusIdentity;
  config?: NexusObservabilityConfig;
  mode: "deposit" | "swap" | "send";
  walletAddress?: string;
  hub: ReturnType<typeof createWidgetObservationHub>;
  network?: "mainnet" | "testnet";
}) {
  const [telemetry] = useState(() => createWidgetTelemetry({ identity, config, mode, walletAddress, network }));
  useBrowserLayoutEffect(() => {
    telemetry.configure({ identity, config, mode, walletAddress, network });
  }, [telemetry, identity, config, mode, walletAddress, network]);
  useBrowserLayoutEffect(() => {
    telemetry.resume();
    const unsubscribe = hub.subscribe(telemetry.startCall);
    return () => { unsubscribe(); telemetry.dispose(); };
  }, [hub, telemetry]);
  return telemetry;
}
