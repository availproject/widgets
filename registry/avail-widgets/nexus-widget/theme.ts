import type { CSSProperties } from "react";
import type { NexusWidgetTheme } from "./types";

/** Paper dark palette. Light values remain at each existing color use site. */
export const nexusWidgetDarkColors = {
  "--nexus-widget-text-strong": "#EDEDEC",
  "--nexus-widget-text": "#EDEDEC",
  "--nexus-widget-text-secondary": "#A1A1A0",
  "--nexus-widget-text-tertiary": "#878786",
  "--nexus-widget-text-disabled": "#5B5B5A",
  "--nexus-widget-surface": "#1A1A18",
  "--nexus-widget-surface-raised": "#292928",
  "--nexus-widget-surface-hover": "#2E2E2D",
  "--nexus-widget-surface-pressed": "#1F1F1E",
  "--nexus-widget-surface-active": "#454544",
  "--nexus-widget-surface-inset": "#111110",
  "--nexus-widget-background": "#0E0E0D",
  "--nexus-widget-border": "#2E2E2D",
  "--nexus-widget-border-control": "#2E2E2D",
  "--nexus-widget-border-empty": "#454544",
  "--nexus-widget-border-unchecked": "#A1A1A0",
  "--nexus-widget-error-background": "#541010",
  "--nexus-widget-error-text": "#FBE9E9",
  "--nexus-widget-error-border": "#541010",
  "--nexus-widget-error-accent": "#D43A3A",
  "--nexus-widget-warning-background": "#4A2A00",
  "--nexus-widget-warning-text": "#FEF3D8",
  "--nexus-widget-success-background": "#0C5626",
  "--nexus-widget-success-text": "#A5EFBF",
  "--nexus-widget-shadow-soft": "#00000040",
  "--nexus-widget-shadow-medium": "#00000059",
  "--nexus-widget-shadow-strong": "#00000073",
  "--nexus-widget-shadow-inset": "#00000040",
  "--nexus-widget-shadow-highlight": "#FFFFFF00",
  "--nexus-widget-root-shadow":
    "0 0 0 1px var(--nexus-widget-border), 0 12px 32px var(--nexus-widget-shadow-medium)",
  "--nexus-widget-overlay": "rgba(0,0,0,0.46)",
  "--nexus-widget-skeleton-highlight": "#454544",
  "--nexus-widget-focus-border": "var(--nexus-widget-primary)",
  "--nexus-widget-focus-ring": "color-mix(in srgb, var(--nexus-widget-primary) 16%, transparent)",
  "--nexus-widget-primary-soft": "#292928",
  "--nexus-widget-primary-soft-text": "#EDEDEC",
  "--nexus-widget-button-background": "var(--nexus-widget-primary)",
  "--nexus-widget-button-foreground": "var(--nexus-widget-primary-foreground)",
  "--nexus-widget-background-image": "none",
} as const;

/** Interaction colors only: the existing dimensions and event handlers stay intact. */
export const nexusWidgetInteractionStyles = `
  [data-nexus-widget-theme="dark"] input::placeholder {
    color: var(--nexus-widget-text-tertiary);
    -webkit-text-fill-color: var(--nexus-widget-text-tertiary);
  }
  [data-nexus-widget-percent-theme="dark"] {
    background-color: var(--nexus-widget-surface-raised) !important;
    color: var(--nexus-widget-text-secondary) !important;
  }
  [data-nexus-widget-percent-theme="dark"]:hover {
    background-color: var(--nexus-widget-surface-hover) !important;
    color: var(--nexus-widget-text) !important;
  }
  [data-nexus-widget-percent-theme="dark"][data-selected="true"] {
    background-color: var(--nexus-widget-surface-active) !important;
    color: var(--nexus-widget-text) !important;
  }
  [data-nexus-widget-percent-theme="dark"]:active {
    background-color: var(--nexus-widget-surface-pressed) !important;
    color: var(--nexus-widget-text) !important;
  }
  [data-nexus-widget-percent-theme="dark"]:disabled,
  [data-nexus-widget-percent-theme="dark"][data-disabled="true"] {
    background-color: var(--nexus-widget-surface-raised) !important;
    color: var(--nexus-widget-text-disabled) !important;
  }
`;

/** Reset every token in light mode so nested widgets cannot inherit dark colors. */
export function getNexusWidgetThemeStyle(isDark: boolean): CSSProperties {
  return {
    ...Object.fromEntries(
      Object.entries(nexusWidgetDarkColors).map(([name, value]) => [
        name,
        isDark ? value : "initial",
      ])
    ),
    colorScheme: isDark ? "dark" : "light",
  } as CSSProperties;
}

export function resolveNexusWidgetTheme(
  theme: NexusWidgetTheme | undefined,
  legacyMode?: NexusWidgetTheme
): NexusWidgetTheme {
  const mode = theme ?? legacyMode;
  return mode === "dark" || mode === "system" ? mode : "light";
}

const ink = {
  900: "var(--nexus-widget-text-strong, #161615)",
  800: "var(--nexus-widget-text, #1F1F1F)",
  600: "var(--nexus-widget-text-secondary, #5B5B5A)",
  500: "var(--nexus-widget-text-secondary, #848483)",
  400: "var(--nexus-widget-text-secondary, #8E8E89)",
  300: "var(--nexus-widget-text-tertiary, #C9C9C5)",
} as const;

export const NEXUS_WIDGET_DEFAULT_PRIMARY_COLOR = "rgb(0, 107, 244)" as const;
export const NEXUS_WIDGET_FAST_SPINNER_STYLE = {
  animation: "nexusWidgetSpin 700ms linear infinite",
} as const;
export const NEXUS_WIDGET_FAST_SPINNER_ANIMATION =
  "nexusWidgetSpin 700ms linear infinite" as const;

const blue = {
  700: "var(--foreground-brand)",
  500: "var(--foreground-brand)",
  100: "var(--nexus-widget-primary-soft, #EAF1FF)",
  50: "var(--nexus-widget-primary-soft, #E5EEFF)",
  tab: "var(--nexus-widget-surface-raised, #F0F3F9)",
} as const;

const surface = {
  default: "var(--nexus-widget-surface, #FFFFFE)",
  soft: "var(--nexus-widget-surface-inset, #FAFAFC)",
  cool: "var(--nexus-widget-surface-raised, #F6F6F6)",
  border: "var(--nexus-widget-border, #ECECEA)",
  border2: "var(--nexus-widget-border, #E8E8E7)",
} as const;

const status = {
  success: "var(--nexus-widget-success-text, #1BC57A)",
  successBg: "var(--nexus-widget-success-background, rgba(27, 197, 122, 0.18))",
} as const;

export const nexusWidgetTheme = {
  colors: {
    ink,
    blue,
    surfaceScale: surface,
    status,

    background: surface.default,
    border: surface.border2,
    divider: surface.border,
    icon: ink[600],
    muted: ink[400],
    primary: blue[700],
    primaryText: blue[500],
    segmented: blue.tab,
    surface: surface.default,
    surfaceCool: surface.cool,
    surfaceInset: surface.soft,
    text: ink[800],
    textEmpty: ink[300],
    textStrong: ink[900],
    textSubtle: ink[500],
  },
  fonts: {
    display: '"Delight-Medium", "Delight", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    sans: '"Geist", var(--font-geist-sans), system-ui, sans-serif',
  },
  typography: {
    displayXl: {
      fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
      fontSize: "31px",
      fontWeight: 500,
      letterSpacing: "0",
      lineHeight: "36px",
    },
    displayLg: {
      fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
      fontSize: "22px",
      fontWeight: 500,
      letterSpacing: "0",
      lineHeight: "26px",
    },
    headingPanel: {
      fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
      fontSize: "17px",
      fontWeight: 500,
      letterSpacing: "0",
      lineHeight: "21px",
    },
    bodyLg: {
      fontFamily: '"Geist", var(--font-geist-sans), system-ui, sans-serif',
      fontSize: "14px",
      fontWeight: 400,
      letterSpacing: "0",
      lineHeight: "17px",
    },
    bodyMd: {
      fontFamily: '"Geist", var(--font-geist-sans), system-ui, sans-serif',
      fontSize: "14px",
      fontWeight: 400,
      letterSpacing: "0",
      lineHeight: "20px",
    },
    bodySm: {
      fontFamily: '"Geist", var(--font-geist-sans), system-ui, sans-serif',
      fontSize: "13px",
      fontWeight: 400,
      letterSpacing: "0",
      lineHeight: "17px",
    },
    labelCap: {
      fontFamily: '"Geist", var(--font-geist-sans), system-ui, sans-serif',
      fontSize: "11px",
      fontWeight: 500,
      letterSpacing: "0.08em",
      lineHeight: "14px",
      textTransform: "uppercase",
    },
    caption: {
      fontFamily: '"Geist", var(--font-geist-sans), system-ui, sans-serif',
      fontSize: "11px",
      fontWeight: 400,
      letterSpacing: "0",
      lineHeight: "15px",
    },
    code: {
      fontFamily:
        '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: "11px",
      fontWeight: 400,
      letterSpacing: "0",
      lineHeight: "14px",
    },
  },
  radius: {
    modal: "16px",
    panel: "9px",
    primaryButton: "10px",
    segmented: "7px",
    segmentedItem: "5px",
    tokenPill: "999px",
    iconButton: "999px",
  },
  shadows: {
    card: "var(--nexus-widget-shadow-medium, #3C286433) 0px 0px 3px, var(--nexus-widget-shadow-soft, #3C28640A) 0px 1px 4px",
    control: "var(--nexus-widget-shadow-soft, #3C28640F) 0px 1px 2px, var(--nexus-widget-shadow-soft, #3C28640A) 0px 2px 6px",
    iconButton: "var(--nexus-widget-shadow-soft, #3C28640F) 0px 1px 2px, var(--nexus-widget-shadow-soft, #3C28640A) 0px 2px 4px",
    inset: "var(--nexus-widget-shadow-soft, #3C28640F) 0px 1px 2px inset",
    primaryButton:
      "var(--nexus-widget-shadow-highlight, #FFFFFF12) 0px 1px 0px inset, var(--nexus-widget-shadow-strong, #0000001F) 0px 1px 2px, var(--nexus-widget-shadow-medium, #14141E24) 0px 4px 10px",
    root: "var(--nexus-widget-shadow-highlight, #FFFFFFE6) 0px 1px 0px inset, var(--nexus-widget-shadow-highlight, #FFFFFF8C) 0px 0px 0px 9px, var(--nexus-widget-shadow-soft, #11346A0A) 0px 2px 4px, var(--nexus-widget-shadow-soft, #0078F721) 0px 9px 18px, var(--nexus-widget-shadow-soft, #1571FE1F) 0px 22px 42px",
    segmentedActive:
      "var(--nexus-widget-shadow-highlight, #FFFFFFE6) 0px 1px 0px inset, var(--nexus-widget-shadow-soft, #3C286414) 0px 1px 2px, var(--nexus-widget-shadow-soft, #3C28640F) 0px 2px 6px",
    sheet: "var(--nexus-widget-shadow-strong, #0000001F) 0px -4px 20px",
    tokenPill: "var(--nexus-widget-shadow-soft, #3C28640F) 0px 1px 2px, var(--nexus-widget-shadow-soft, #3C28640A) 0px 2px 8px",
    tooltip: "0 8px 24px var(--nexus-widget-shadow-strong, rgba(22,22,21,0.12))",
  },
  primitives: {
    badge: {
      backgroundColor: blue[100],
      color: blue[500],
    },
    iconButton: {
      backgroundColor: surface.default,
      borderColor: "var(--nexus-widget-border-control, #0000000F)",
      boxShadow: "var(--nexus-widget-shadow-soft, #3C28640F) 0px 1px 2px, var(--nexus-widget-shadow-soft, #3C28640A) 0px 2px 4px",
      size: "29px",
    },
    tokenPill: {
      backgroundColor: "var(--nexus-widget-surface-raised, #FFFFFE)",
      borderColor: "var(--nexus-widget-border-control, #0000000A)",
      boxShadow: "var(--nexus-widget-shadow-soft, #3C28640F) 0px 1px 2px, var(--nexus-widget-shadow-soft, #3C28640A) 0px 2px 8px",
    },
  },
} as const;
