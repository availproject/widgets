"use client";

import { cn } from "@/lib/utils";

export type NexusWidgetRenderMode = "inline" | "popup";

interface NexusWidgetRenderModeToggleProps {
  value: NexusWidgetRenderMode;
  onValueChange: (value: NexusWidgetRenderMode) => void;
}

const MODES: Array<{ label: string; value: NexusWidgetRenderMode }> = [
  { label: "Inline", value: "inline" },
  { label: "Popup", value: "popup" },
];

export function NexusWidgetRenderModeToggle({
  value,
  onValueChange,
}: NexusWidgetRenderModeToggleProps) {
  return (
    <div
      aria-label="Nexus widget display mode"
      className="inline-flex items-center rounded-md border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      role="group"
    >
      {MODES.map((mode) => {
        const isSelected = value === mode.value;

        return (
          <button
            key={mode.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onValueChange(mode.value)}
            className={cn(
              "h-7 min-w-16 rounded px-3 text-xs font-medium transition-colors",
              isSelected
                ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
            )}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
