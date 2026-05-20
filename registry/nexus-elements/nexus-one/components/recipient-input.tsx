import React from "react";
import { X } from "lucide-react";

export interface RecipientInputProps {
  value: string;
  onChange: (val: string) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string | null;
  hasError?: boolean;
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
      className="flex items-center w-full px-4 overflow-hidden outline-none transition-all placeholder:text-[var(--foreground-muted, #848483)] text-[var(--foreground-primary, #161615)]"
      style={{
        background: "#FFFFFE",
        height: "46px",
        borderRadius: "8px",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: hasError ? "#E35454" : "#006BF4",
        gap: "10px",
        paddingTop: "10px",
        paddingBottom: "10px",
      }}
    >
      {label && (
        <div
          className="shrink-0 font-geist select-none flex items-center"
          style={{
            color: "var(--foreground-primary, var(--foreground-primary, #161615))",
            fontSize: "14px",
            fontWeight: 400,
            lineHeight: "18px",
          }}
        >
          {label}
        </div>
      )}

      <style>
        {`
          .nexus-one-recipient-input::placeholder {
            color: #9E9E9C;
            -webkit-text-fill-color: #9E9E9C;
            opacity: 1;
          }
        `}
      </style>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="nexus-one-recipient-input flex-1 bg-transparent border-none outline-none focus:ring-0 font-geist placeholder:text-[var(--foreground-muted, #848483)]"
        style={{
          color: "#161615",
          caretColor: "#006BF4",
          fontSize: "14px",
          fontWeight: 500,
          WebkitTextFillColor: "#161615",
          lineHeight: "18px",
        }}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear recipient"
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
        >
          <X style={{ color: "#9E9E9C", height: "16px", width: "16px" }} />
        </button>
      )}
    </div>
  );
}
