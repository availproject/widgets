"use client";
import React, { useState, useEffect } from "react";
import NetworkToggle from "../helpers/network-toggle";
import { PreviewPanel } from "../helpers/preview-panel";
import { Toggle } from "../ui/toggle";
import { Check, X } from "lucide-react";
import { getItem } from "@/lib/local-storage";
import { NETWORK_KEY } from "@/providers/Web3Provider";

type ElementType =
  | "deposit"
  | "swaps"
  | "fast-bridge"
  | "unified-balance"
  | "fast-transfer"
  | "view-history"
  | "nexus-one"
  | "swap-deposit";

const disabledTestnet = new Set<ElementType>([
  "deposit",
  "swaps",
  "nexus-one",
  "swap-deposit",
]);

type ToggleControlProps = Omit<
  React.ComponentProps<typeof Toggle>,
  "children" | "type"
>;

interface ShowcaseWrapperProps extends ToggleControlProps {
  children: React.ReactNode;
  connectLabel?: string;
  type: ElementType;
  toggleLabel?: string;
  toggle?: boolean;
  banner?: string;
}

const ShowcaseWrapper = ({
  children,
  connectLabel = "Connect wallet to use Nexus",
  type,
  toggle,
  toggleLabel,
  variant = "outline",
  size = "sm",
  pressed,
  defaultPressed,
  onPressedChange,
  banner,
  ...toggleProps
}: ShowcaseWrapperProps) => {
  const [currentNetwork, setCurrentNetwork] = useState<string | null>(null);

  useEffect(() => {
    // Read from localStorage on client side only
    const storedNetwork = getItem(NETWORK_KEY);
    setCurrentNetwork(storedNetwork ?? "mainnet");
  }, []);

  const resolvedToggle =
    typeof toggle === "boolean"
      ? toggle
      : pressed !== undefined ||
        defaultPressed !== undefined ||
        onPressedChange !== undefined;
  const isPressed = pressed ?? defaultPressed ?? false;
  const label = toggleLabel ?? "Swap with Exact In";
  const effectiveNetwork =
    type === "nexus-one" && currentNetwork === "testnet"
      ? "mainnet"
      : currentNetwork;
  const isTestnetUnsupported =
    disabledTestnet.has(type) && effectiveNetwork === "testnet";
  const isNexusOneTestnetUnsupported =
    type === "nexus-one" && isTestnetUnsupported;

  return (
    <div className="w-full flex flex-col gap-y-4">
      <div className="flex items-center justify-between w-full">
        <NetworkToggle disableTestnet={type === "nexus-one"} />
        {resolvedToggle && (
          <Toggle
            variant={variant}
            size={size}
            pressed={pressed}
            defaultPressed={defaultPressed}
            onPressedChange={onPressedChange}
            {...toggleProps}
          >
            <p className="text-sm font-medium">{label}</p>
            {isPressed ? (
              <Check className="size-4" />
            ) : (
              <X className="size-4" />
            )}
          </Toggle>
        )}
      </div>
      {isNexusOneTestnetUnsupported && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Testnet is not supported at the moment.
        </div>
      )}
      <p className="text-sm font-medium">{banner}</p>
      {isTestnetUnsupported ? (
        <div className="w-full h-64 flex flex-col gap-y-2 items-center justify-center">
          {isNexusOneTestnetUnsupported ? (
            <p className="text-lg font-medium">
              Testnet is not supported at the moment.
            </p>
          ) : (
            <>
              <p className="text-lg font-medium">
                This feature is not available on testnet
              </p>
              <p className="text-lg font-medium">Please switch to mainnet</p>
              <p className="text-center text-base">
                You can still view the source code or <br /> download the
                element with the command below.
              </p>
            </>
          )}
        </div>
      ) : (
        <PreviewPanel
          connectLabel={connectLabel}
          renderWhenDisconnected={type === "nexus-one"}
        >
          {children}
        </PreviewPanel>
      )}
    </div>
  );
};

export default ShowcaseWrapper;
