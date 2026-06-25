// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import { Pencil, Settings } from "lucide-react";
import React from "react";
import { nexusOneTheme } from "../theme";

export interface PayUsingSelectorProps {
  disabled?: boolean;
  hasSources?: boolean;
  label?: string;
  onClick?: () => void;
  sublabel?: string;
}

export function PayUsingSelector({
  label = "Paying with",
  sublabel = "Auto-selected based on amount",
  onClick,
  disabled = false,
  hasSources = false,
}: PayUsingSelectorProps) {
  const isInteractiveRow = !hasSources;

  const content = (
    <>
      <div className="flex items-center gap-x-2.5">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
          style={{
            background:
              "var(--background-tertiary, var(--background-tertiary, #F0F0EF))",
          }}
        >
          <Settings className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <div className="flex flex-col gap-y-0.5 text-left">
          <span
            style={{
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontWeight: 500,
              fontSize: "13px",
              color:
                "var(--foreground-primary, var(--foreground-primary, #161615))",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontSize: "11px",
              color:
                "var(--foreground-muted, var(--foreground-muted, #848483))",
            }}
          >
            {sublabel}
          </span>
        </div>
      </div>

      {/* Edit button */}
      {!isInteractiveRow && (
        <button
          className="flex items-center gap-x-1 px-2 py-1 rounded hover:bg-black/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          style={{
            fontFamily: "var(--font-geist-sans), sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            color:
              "var(--interactive-button-primary-background, var(--foreground-brand, #006BF4))",
          }}
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      )}
    </>
  );

  return (
    <div className="w-full">
      {isInteractiveRow ? (
        <button
          className="w-full flex items-center justify-between px-3 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-black/5"
          disabled={disabled}
          onClick={onClick}
          style={{
            background: "var(--background-secondary, #F5F5F4)",
            borderRadius: "10px",
            border:
              "1px solid var(--border-default, var(--border-default, #E8E8E7))",
          }}
        >
          {content}
        </button>
      ) : (
        <div
          className="w-full flex items-center justify-between px-3 py-2.5"
          style={{
            background: "var(--background-secondary, #F5F5F4)",
            borderRadius: "10px",
            border:
              "1px solid var(--border-default, var(--border-default, #E8E8E7))",
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
