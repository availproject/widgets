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

/** Visual system extracted from the Nexus deposit prototype. */
export const NEXUS_DEPOSIT_MOTION_CSS = `
[data-nexus-widget-root] {
  --nx-ink:#161615; --nx-ink-2:#3A3A39; --nx-mute:#737372; --nx-mute-2:#8C8C8B; --nx-faint:#A3A3A2; --nx-ghost:#C4C4C2;
  --nx-shell:#F7F7F7; --nx-card:#FFFFFF; --nx-line:#F0F0F0; --nx-line-2:#EDEDED; --nx-fill:#F3F3F3; --nx-fill-2:#EDEDEC;
  --nx-hover:#F7F7F7; --nx-press:#F2F2F1; --nx-pop:#FFFFFF; --nx-shim:#EFEFEE; --nx-shim-hi:#F7F7F6; --nx-blue:#006BF4;
  --nx-blue-soft:#E5F0FE; --nx-red:#D93636; --nx-red-band:#FEF6F6; --nx-amber:#B26B00; --nx-tile-mm:#FFF4EA;
  --nx-pop-ring:#1616150A; --nx-input:#F7F7F6; --nx-band:#F8F8F8; --nx-cta-off:#EDEDED;
  --nx-sh-shell:#FFFFFFB3 0 1px 0 inset, #1616150A 0 12px 40px;
  --nx-sh-edge:0 0 0 1px #1616150D, #1616151A 0 0 3px, #16161512 0 6px 20px;
  --nx-sh-card:#16161508 0 1px 2px, #1616150A 0 6px 18px;
  --nx-sh-cta:#FFFFFF40 0 1px 0 inset, #006BF41A 0 3px 8px;
}
[data-nexus-widget-theme="dark"] {
  --nx-ink:#EDEDEC; --nx-ink-2:#CFCFCD; --nx-mute:#9C9C9A; --nx-mute-2:#878785; --nx-faint:#6E6E6C; --nx-ghost:#4A4A48;
  --nx-shell:#141413; --nx-card:#1A1A18; --nx-line:#262625; --nx-line-2:#2B2B29; --nx-fill:#292928; --nx-fill-2:#2E2E2C;
  --nx-hover:#20201F; --nx-press:#242423; --nx-pop:#292928; --nx-shim:#262624; --nx-shim-hi:#30302E; --nx-blue:#2F86FF;
  --nx-blue-soft:#132A4A; --nx-red:#F05A5A; --nx-red-band:#2A1616; --nx-amber:#E8A23B; --nx-tile-mm:#2E2418;
  --nx-pop-ring:#FFFFFF14; --nx-input:#21211F; --nx-band:#212120; --nx-cta-off:#262624;
  --nx-sh-shell:#FFFFFF14 0 1px 0 inset, #FFFFFF0A 0 0 0 1px inset;
  --nx-sh-edge:0 0 0 1px #FFFFFF1C;
  --nx-sh-card:#00000040 0 1px 2px, #00000033 0 6px 18px;
  --nx-sh-cta:#FFFFFF26 0 1px 0 inset, #2F86FF14 0 4px 10px;
}
@keyframes nx-scr-in { from { opacity:0; transform:translateX(16px) } to { opacity:1; transform:none } }
@keyframes nx-scr-in-back { from { opacity:0; transform:translateX(-16px) } to { opacity:1; transform:none } }
@keyframes nx-shimmer { to { transform:translateX(100%) } }
@keyframes nx-arrive { from { opacity:0; filter:blur(3px); transform:translateY(4px) } to { opacity:1; filter:none; transform:none } }
@keyframes nx-tip-in { from { opacity:0; transform:translateX(-50%) translateY(4px) scale(.98) } to { opacity:1; transform:translateX(-50%) } }
@keyframes nx-blink { 50% { opacity:0 } }
@keyframes nx-slide-in { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }
@keyframes nx-row-in { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
@keyframes nx-spin { to { transform:rotate(360deg) } }
.nx-deposit-screen { animation: nx-scr-in 250ms cubic-bezier(.23,1,.32,1) 60ms both; }
.nx-deposit-screen.nx-back { animation-name: nx-scr-in-back; }
.nx-card { background:var(--nx-card); border-radius:24px; box-shadow:var(--nx-sh-card); padding:8px; display:flex; flex-direction:column; }
.nx-head { display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid var(--nx-line-2); }
.nx-title { font:500 20px/24px "Delight","Geist",system-ui,sans-serif; letter-spacing:-.01em; color:var(--nx-ink); }
.nx-sub { display:flex; gap:8px; margin-top:4px; font:400 14px/18px "Geist",system-ui,sans-serif; color:var(--nx-mute); }
.nx-sub b { font-weight:500; color:var(--nx-ink); }
.nx-skel-row { display:flex; align-items:center; gap:12px; padding:12px; animation: nx-row-in 200ms cubic-bezier(.23,1,.32,1) both; }
.nx-shim { position:relative; overflow:hidden; border-radius:10px; background:var(--nx-shim); }
.nx-shim::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,transparent,var(--nx-shim-hi),transparent); transform:translateX(-100%); animation:nx-shimmer 1.4s linear infinite; }
.nx-hero { display:flex; flex-direction:column; align-items:center; gap:6px; padding:20px 12px 18px; }
.nx-who { font:400 16px/20px "Geist",system-ui,sans-serif; color:var(--nx-ink); }
.nx-amt-line { display:flex; align-items:center; gap:8px; min-height:56px; }
.nx-big { font:300 48px/56px "Geist",system-ui,sans-serif; letter-spacing:-.03em; font-variant-numeric:tabular-nums; color:var(--nx-ink); }
.nx-arrive { animation: nx-arrive 200ms cubic-bezier(.23,1,.32,1) both; }
.nx-usd { font:400 18px/22px "Geist",system-ui,sans-serif; color:var(--nx-mute-2); font-variant-numeric:tabular-nums; }
.nx-meta { display:flex; align-items:center; gap:6px; font:400 15px/20px "Geist",system-ui,sans-serif; color:var(--nx-mute); }
.nx-warn { display:flex; align-items:center; gap:6px; font:400 13px/16px "Geist",system-ui,sans-serif; color:var(--nx-amber); animation:nx-slide-in 200ms cubic-bezier(.23,1,.32,1) both; }
.nx-swap-div { height:1px; background:var(--nx-line-2); margin:0 14px; }
.nx-spend { display:flex; align-items:center; padding:12px; font:400 16px/20px "Geist",system-ui,sans-serif; color:var(--nx-ink); }
.nx-spend .nx-tnum { margin-left:auto; font-weight:500; font-variant-numeric:tabular-nums; }
.nx-spend-label { margin-left:6px; font:400 14px/18px "Geist",system-ui,sans-serif; color:var(--nx-mute); }
.nx-plist { background:var(--nx-card); border-radius:18px; box-shadow:var(--nx-sh-list, #1616150D 0 0 2px 1px, #16161517 0 0 10px); overflow:hidden; }
.nx-prow { display:flex; flex-direction:column; padding:12px; transition:background-color 150ms cubic-bezier(.23,1,.32,1), opacity 200ms cubic-bezier(.23,1,.32,1); }
.nx-prow.open { background:var(--nx-input); }
.nx-prow.err { background:var(--nx-red-band); }
.nx-focus .nx-focusable, .nx-focus .nx-prow:not(.open) { opacity:.15; }
.nx-pr-top { display:flex; align-items:center; gap:10px; cursor:pointer; }
.nx-pr-tok { display:flex; gap:12px; width:126px; flex-shrink:0; align-items:center; }
.nx-nm { display:flex; align-items:center; gap:4px; font:500 16px/20px "Geist",system-ui,sans-serif; color:var(--nx-ink); }
.nx-ch { display:block; font:400 14px/18px "Geist",system-ui,sans-serif; color:var(--nx-mute); }
.nx-pr-amt { flex:1; display:flex; flex-direction:column; align-items:flex-end; min-width:0; }
.nx-pr-val { display:flex; align-items:center; justify-content:flex-end; width:100%; }
.nx-caret { width:2px; height:32px; border-radius:1px; background:var(--nx-blue); animation:nx-blink 1.06s steps(1) infinite; flex-shrink:0; }
.nx-pr-sub { display:flex; align-items:center; gap:4px; font:400 14px/18px "Geist",system-ui,sans-serif; color:var(--nx-mute); font-variant-numeric:tabular-nums; }
.nx-collapse { display:grid; grid-template-rows:0fr; transition:grid-template-rows 200ms cubic-bezier(.2,0,0,1); }
.nx-collapse > div { overflow:hidden; min-height:0; }
.nx-collapse.on { grid-template-rows:1fr; }
.nx-pr-bal { display:flex; align-items:center; gap:8px; padding-top:10px; font:400 14px/16px "Geist",system-ui,sans-serif; color:var(--nx-mute); }
.nx-pr-bal > span { flex:1; }
.nx-pr-err { display:flex; gap:6px; padding-top:10px; font:400 13px/16px "Geist",system-ui,sans-serif; color:var(--nx-red); }
.nx-add { display:flex; align-items:center; justify-content:flex-end; gap:12px; width:100%; padding:12px; border:none; background:transparent; font:500 16px/20px "Geist",system-ui,sans-serif; color:var(--nx-blue); cursor:pointer; }
.nx-focus .nx-add { opacity: .15; }
.nx-add:disabled { color:var(--nx-mute); cursor:default; }
.nx-plus { width:40px; height:40px; border-radius:999px; border:1.5px dashed var(--nx-blue, #9DBFF5); display:grid; place-items:center; font-size:20px; transition:transform 150ms cubic-bezier(.23,1,.32,1); }
.nx-add:active:not(:disabled) .nx-plus { transform:rotate(90deg) scale(.92); }
.nx-cap { display:flex; justify-content:center; padding:0 12px 12px; font:400 13px/16px "Geist",system-ui,sans-serif; color:var(--nx-mute-2); }
.nx-fees { display:flex; justify-content:space-between; align-items:center; padding:8px; font:400 14px/18px "Geist",system-ui,sans-serif; color:var(--nx-mute-2); }
.nx-fees > div { display:flex; align-items:center; gap:6px; }
.nx-fees b { font-weight:500; color:var(--nx-ink); font-variant-numeric:tabular-nums; }
.nx-auto { background:var(--nx-blue-soft); color:var(--nx-blue); border-radius:999px; padding:3px 9px; font:500 12px/16px "Geist",system-ui,sans-serif; }
.nx-deposit-cta { height:56px; border-radius:999px; background:var(--nx-blue); box-shadow:var(--nx-sh-cta); color:#fff; font:500 16px/20px "Geist",system-ui,sans-serif; }
.nx-deposit-cta:active:not(:disabled) { transform:scale(.97); }
.nx-deposit-cta:disabled { background:var(--nx-cta-off); color:var(--nx-mute-2); box-shadow:none; }
@media (prefers-reduced-motion: reduce) {
  .nx-deposit-screen, .nx-arrive, .nx-shim::after, .nx-caret, .nx-warn { animation:none !important; }
}
`;

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
