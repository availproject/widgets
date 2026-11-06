"use client";
import React from "react";
import NetworkToggle from "../helpers/network-toggle";
import { PreviewPanel } from "../helpers/preview-panel";
import { Toggle } from "../ui/toggle";
import { Check, X } from "lucide-react";

type ElementType =
  | "deposit"
  | "swaps"
  | "fast-bridge"
  | "unified-balance"
  | "fast-transfer"
  | "view-history"
  | "nexus-widget"
  | "swap-deposit";

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
  controls?: React.ReactNode;
  showNetworkToggle?: boolean;
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
  controls,
  showNetworkToggle = true,
  ...toggleProps
}: ShowcaseWrapperProps) => {
  const resolvedToggle =
    typeof toggle === "boolean"
      ? toggle
      : pressed !== undefined ||
        defaultPressed !== undefined ||
        onPressedChange !== undefined;
  const isPressed = pressed ?? defaultPressed ?? false;
  const label = toggleLabel ?? "Swap with Exact In";

  return (
    <div className="w-full flex flex-col gap-y-4">
      {showNetworkToggle || resolvedToggle || controls ? (
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          {showNetworkToggle ? <NetworkToggle /> : <div />}
          {resolvedToggle || controls ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {controls}
              {resolvedToggle ? (
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
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {banner ? <p className="text-sm font-medium">{banner}</p> : null}
      <PreviewPanel
        connectLabel={connectLabel}
        renderWhenDisconnected={type === "nexus-widget"}
      >
        {children}
      </PreviewPanel>
    </div>
  );
};

export default ShowcaseWrapper;
