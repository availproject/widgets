"use client";
import React from "react";
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
      {resolvedToggle ? (
        <div className="flex items-center justify-end w-full">
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
