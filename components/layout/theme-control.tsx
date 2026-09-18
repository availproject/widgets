"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/avail-widgets/ui/select";
import { useWidgetPreviewTheme } from "../helpers/use-widget-preview-theme";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export default function ThemeControl() {
  const theme = useWidgetPreviewTheme();
  const { setTheme } = useTheme();

  return (
    <Select
      value={theme}
      onValueChange={(value) => {
        if (value === "light" || value === "dark" || value === "system") {
          setTheme(value);
        }
      }}
    >
      <SelectTrigger
        aria-label="Choose color theme"
        className="w-32"
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <SelectItem key={value} value={value}>
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
