"use client";
import React, { ReactNode, useCallback, useEffect, useState } from "react";
import { LoaderPinwheel } from "lucide-react";
import { type EthereumProvider } from "@avail-project/nexus-core";
import { useAccount, useConnectorClient } from "wagmi";
import { useNexus } from "@/registry/nexus-elements/nexus/NexusProvider";
import { toast } from "sonner";
import { Button } from "@/registry/nexus-elements/ui/button";
interface PreviewPanelProps {
  children: ReactNode;
  connectLabel: string;
  renderWhenDisconnected?: boolean;
}

export function PreviewPanel({
  children,
  connectLabel,
  renderWhenDisconnected = false,
}: Readonly<PreviewPanelProps>) {
  const [mounted, setMounted] = useState(false);
  const { status, connector } = useAccount();
  const { data: walletClient } = useConnectorClient();
  const { nexusSDK, handleInit, loading } = useNexus();
  const [initializing, setInitializing] = useState(false);

  const initializeNexus = useCallback(async (silent = false) => {
    if (loading || initializing || nexusSDK) return;
    setInitializing(true);
    try {
      const mobileProvider = walletClient && {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request: (args: unknown) => walletClient.request(args as any),
      };
      let desktopProvider: any;
      try {
        desktopProvider = (await connector?.getProvider()) as any;
      } catch (error) {
        console.warn("Wallet provider is not ready yet", error);
      }
      const effectiveProvider =
        desktopProvider && typeof desktopProvider.request === "function"
          ? desktopProvider
          : mobileProvider;

      if (!effectiveProvider || typeof effectiveProvider.request !== "function") {
        if (!silent) {
          toast.error("Wallet provider is not ready yet. Please try again.");
        }
        return;
      }

      await handleInit(effectiveProvider as EthereumProvider);
      if (!silent) {
        toast.success("Nexus initialized successfully");
      }
    } catch (error) {
      console.error(error);
      if (!silent) {
        toast.error(`Failed to initialize Nexus ${(error as Error)?.message}`);
      }
    } finally {
      setInitializing(false);
    }
  }, [connector, handleInit, initializing, loading, nexusSDK, walletClient]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (
      status === "connected" &&
      !nexusSDK &&
      !loading &&
      !initializing &&
      walletClient
    ) {
      void initializeNexus(true);
    }
  }, [connector, initializeNexus, initializing, loading, nexusSDK, status, walletClient]);
  return (
    <div className="w-full">
      <div className="flex flex-col w-full items-center justify-center relative">
        {renderWhenDisconnected && mounted && <>{children}</>}
        {!renderWhenDisconnected &&
          (status === "connected" || status === "connecting") &&
          nexusSDK && (
            <>{children}</>
          )}
        {!renderWhenDisconnected && status === "connected" && !nexusSDK && (
          <Button
            disabled={loading || initializing}
            onClick={() => void initializeNexus(false)}
          >
            {loading || initializing ? (
              <LoaderPinwheel className="size-6 animate-spin" />
            ) : (
              "Initialize Nexus"
            )}
          </Button>
        )}
        {!renderWhenDisconnected && status !== "connected" && (
          <p className="text-lg font-semibold">{connectLabel}</p>
        )}
      </div>
    </div>
  );
}
