// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import { X } from "lucide-react";
import React from "react";

export interface RecipientInputProps {
  hasError?: boolean;
  label?: string | null;
  onChange: (val: string) => void;
  onClear?: () => void;
  placeholder?: string;
  value: string;
}

export function RecipientInput({
  value,
  onChange,
  onClear,
  placeholder = "Search...",
  label = "To",
  hasError = false,
}: RecipientInputProps) {
  return (
    <div
      className="flex items-center w-full px-4 overflow-hidden outline-none transition-all placeholder:text-[var(--nexus-widget-text-secondary,_#848483)] text-[var(--nexus-widget-text-strong,_#161615)]"
      style={{
        background: "var(--nexus-widget-surface-raised, #FFFFFE)",
        height: "38px",
        borderRadius: "7px",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: hasError ? "var(--nexus-widget-error-accent, #E35454)" : "var(--foreground-brand)",
        gap: "8px",
        paddingTop: "8px",
        paddingBottom: "8px",
      }}
    >
      {label && (
        <div
          className="shrink-0 font-geist select-none flex items-center"
          style={{
            color:
              "var(--nexus-widget-text-strong, #161615)",
            fontSize: "14px",
            fontWeight: 400,
            lineHeight: "17px",
          }}
        >
          {label}
        </div>
      )}

      <style>
        {`
          .nexus-widget-recipient-input::placeholder {
            color: var(--nexus-widget-text-tertiary, #9E9E9C);
            -webkit-text-fill-color: var(--nexus-widget-text-tertiary, #9E9E9C);
            opacity: 1;
          }
        `}
      </style>
      <input
        className="nexus-widget-recipient-input flex-1 bg-transparent border-none outline-none focus:ring-0 font-geist placeholder:text-[var(--nexus-widget-text-secondary,_#848483)]"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          color: "var(--nexus-widget-text-strong, #161615)",
          caretColor: "var(--foreground-brand)",
          fontSize: "14px",
          fontWeight: 500,
          WebkitTextFillColor: "var(--nexus-widget-text-strong, #161615)",
          lineHeight: "17px",
        }}
        value={value}
      />
      {value && onClear && (
        <button
          aria-label="Clear recipient"
          onClick={onClear}
          style={{
            alignItems: "center",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexShrink: 0,
            justifyContent: "center",
            padding: 0,
          }}
          type="button"
        >
          <X style={{ color: "var(--nexus-widget-text-tertiary, #9E9E9C)", height: "16px", width: "16px" }} />
        </button>
      )}
    </div>
  );
}
