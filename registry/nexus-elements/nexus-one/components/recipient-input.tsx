import { nexusOneTheme } from "../theme";
import React from "react";
import { Search } from "lucide-react";

export interface RecipientInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
}

export function RecipientInput({
  value,
  onChange,
  placeholder = "Search...",
  label = "To",
}: RecipientInputProps) {
  return (
    <div
      className="flex items-center w-full px-4 overflow-hidden outline-none transition-all placeholder:text-[var(--foreground-muted, #848483)] text-[var(--foreground-primary, #161615)]"
      style={{
        background: "var(--background-tertiary, var(--background-tertiary, #F0F0EF))",
        height: "44px",
        borderRadius: "12px",
        borderWidth: "1px",
        borderColor: "transparent",
        gap: "12px",
        paddingTop: "12px",
        paddingBottom: "12px",
      }}
    >
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

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none focus:ring-0 font-geist"
        style={{
          fontSize: "14px",
          fontWeight: 400,
          lineHeight: "18px",
        }}
      />
    </div>
  );
}
