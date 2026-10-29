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
  --nx-green:#12AD59; --nx-green-soft:#EEF9F2; --nx-blue-soft:#E5F0FE; --nx-red:#D93636; --nx-red-band:#FEF6F6; --nx-amber:#B26B00; --nx-tile-mm:#FFF4EA;
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
  --nx-green:#24C56C; --nx-green-soft:#142C1E; --nx-blue-soft:#132A4A; --nx-red:#F05A5A; --nx-red-band:#2A1616; --nx-amber:#E8A23B; --nx-tile-mm:#2E2418;
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
/* History shares the deposit shell, cards and control sizes. */
.nx-history-header { background:var(--nx-card); border-radius:24px; box-shadow:var(--nx-sh-card); gap:12px; }
.nx-history-header > div:first-child { min-width:0; }
.nx-history-card { background:var(--nx-card); border-radius:24px; box-shadow:var(--nx-sh-card); padding:20px; color:var(--nx-ink); font-family:"Geist",system-ui,sans-serif; container-type:inline-size; }
.nx-history-top { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; }
.nx-history-asset { display:flex; align-items:center; gap:12px; min-width:0; }
.nx-history-asset > :first-child { flex-shrink:0; }
.nx-history-asset > :last-child { min-width:0; }
.nx-history-meta { display:flex; flex-direction:column; align-items:flex-end; gap:6px; text-align:right; }
.nx-history-status { display:inline-flex; justify-content:center; border-radius:999px; padding:4px 9px; font:500 12px/16px "Geist",system-ui,sans-serif; text-align:center; }
.nx-history-cash-icon { width:40px; height:40px; display:grid; place-items:center; border-radius:14px; background:var(--nx-fill); color:var(--nx-ink-2); }
.nx-history-link { border-radius:8px; min-height:32px; padding:4px 6px; margin:-4px -6px; text-decoration:none; transition:background-color 150ms; }
.nx-history-link:hover { background:var(--nx-blue-soft); }
.nx-history-link:focus-visible, .nx-history-header button:focus-visible { outline:2px solid var(--nx-blue); outline-offset:3px; }
@container (max-width:330px) {
  .nx-history-top { grid-template-columns:minmax(0,1fr); }
  .nx-history-meta { flex-direction:row; align-items:center; justify-content:space-between; gap:8px; padding-left:52px; text-align:left; }
}
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
.nx-add:disabled .nx-plus { border-color:currentColor; }
.nx-add:active:not(:disabled) .nx-plus { transform:rotate(90deg) scale(.92); }
.nx-cap { display:flex; justify-content:center; padding:0 12px 12px; font:400 13px/16px "Geist",system-ui,sans-serif; color:var(--nx-mute-2); }
.nx-fees { display:flex; justify-content:space-between; align-items:center; padding:8px; font:400 14px/18px "Geist",system-ui,sans-serif; color:var(--nx-mute-2); }
.nx-fees > div { display:flex; align-items:center; gap:6px; }
.nx-fees b { font-weight:500; color:var(--nx-ink); font-variant-numeric:tabular-nums; }
.nx-auto { background:var(--nx-blue-soft); color:var(--nx-blue); border-radius:999px; padding:3px 9px; font:500 12px/16px "Geist",system-ui,sans-serif; }
.nx-deposit-cta { height:56px; border-radius:999px; background:var(--nx-blue); box-shadow:var(--nx-sh-cta); color:#fff; font:500 16px/20px "Geist",system-ui,sans-serif; }
.nx-deposit-cta:active:not(:disabled) { transform:scale(.97); }
.nx-deposit-cta:disabled { background:var(--nx-cta-off); color:var(--nx-mute-2); box-shadow:none; }
@keyframes nx-value-in { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
@keyframes nx-token-out { 0% { grid-template-rows:1fr; opacity:1; } 30% { grid-template-rows:1fr; opacity:0; } 100% { grid-template-rows:0fr; opacity:0; } }
.nx-mode-change, .nx-progress-change { animation:nx-value-in 220ms cubic-bezier(.23,1,.32,1) both; }
.nx-token-presence { display:grid; grid-template-rows:1fr; }
.nx-token-clip { min-height:0; overflow:hidden; }
.nx-token-presence.exiting { animation:nx-token-out 340ms cubic-bezier(.2,0,0,1) forwards; pointer-events:none; }
button.nx-pr-tok { background:none; border:0; padding:0; text-align:left; color:inherit; font:inherit; cursor:pointer; }
button.nx-pr-tok:disabled { cursor:default; }
.nx-animated-amount { font-variant-numeric:tabular-nums; }
.nx-digit-group { display:inline-flex; vertical-align:baseline; }
.nx-digit-window { display:inline-block; width:1ch; height:1em; overflow:hidden; position:relative; }
@keyframes nx-roll-up { from { transform:translateY(100%); opacity:0; } }
@keyframes nx-roll-down { from { transform:translateY(-100%); opacity:0; } }
.nx-digit-current { display:block; line-height:1em; }
.nx-digit-current.up { animation:nx-roll-up 250ms cubic-bezier(.23,1,.32,1) both; }
.nx-digit-current.down { animation:nx-roll-down 250ms cubic-bezier(.23,1,.32,1) both; }
.nx-focusable { transition:opacity 200ms cubic-bezier(.23,1,.32,1); }
.nx-focus .nx-focusable, .nx-focus .nx-prow:not(.open), .nx-focus .nx-add { pointer-events:none; }
.nx-collapse > div { opacity:0; transform:translateY(-4px); transition:opacity 100ms,transform 100ms; }
.nx-collapse.on { transition-duration:250ms; }
.nx-collapse.on > div { opacity:1; transform:none; transition:opacity 150ms 50ms,transform 150ms 50ms; }
.nx-pr-val input, .nx-pr-val > span { transition:font-size 250ms cubic-bezier(.2,0,0,1),line-height 250ms cubic-bezier(.2,0,0,1); }
.nx-prow.keying input { caret-animation:manual; }
.nx-pr-val input { caret-color:var(--nx-blue); max-width:100%; }
.nx-prow.err input, .nx-prow.shake input { caret-color:var(--nx-red); }
.nx-prow button, .nx-head button, .nx-history-header button { transition:transform 100ms,background-color 150ms; }
.nx-prow button:active:not(:disabled), .nx-head button:active, .nx-history-header button:active { transform:scale(.92); }
.nx-prow button[aria-label="Remove"]:active { transform:scale(.9); }
.nx-pr-bal button:active { transform:scale(.96); }
.nx-add.full { color:var(--nx-mute); }
.nx-add.full .nx-plus { border-color:var(--nx-line-2); background:var(--nx-fill); }
@media (hover:hover) and (pointer:fine) {
  .nx-add:hover:not(:disabled):not(.full) .nx-plus { transform:rotate(90deg); border-color:var(--nx-blue); }
  .nx-method-row:hover, .nx-asset-row:hover { background:var(--nx-hover); }
  .nx-method-row:hover > svg:last-child, .nx-asset-row:hover > svg:last-child { transform:translateX(2px); }
}
.nx-method-row > svg:last-child, .nx-asset-row > svg:last-child { transition:transform 150ms; }
.nx-method-row { background:transparent; }
.nx-method-row:active, .nx-asset-row:active { transform:scale(.98); background:var(--nx-press); }
.nx-add:focus-visible:not(.full) .nx-plus { transform:rotate(90deg); }
@keyframes nx-highlight { from { background:var(--nx-blue-soft); } }
@keyframes nx-token-in { from { opacity:0; transform:translateY(-6px); } }
.nx-token-presence.entering { animation:nx-token-in 250ms cubic-bezier(.23,1,.32,1) both; }
.nx-token-presence.entering .nx-prow { animation:nx-highlight 600ms cubic-bezier(.23,1,.32,1) 250ms backwards; }
@keyframes nx-row-fade { to { opacity:0; transform:scale(.98); } }
@keyframes nx-row-collapse { to { grid-template-rows:0fr; } }
.nx-token-presence.exiting { animation:nx-row-collapse 200ms cubic-bezier(.2,0,0,1) 150ms forwards; }
.nx-token-presence.exiting .nx-prow { animation:nx-row-fade 150ms cubic-bezier(.23,1,.32,1) forwards; }
@keyframes nx-label-in { from { opacity:0; transform:translateY(6px); filter:blur(2px); } }
@keyframes nx-label-out { to { opacity:0; transform:translateY(-6px); filter:blur(2px); } }
.nx-label-stack { display:inline-grid; position:relative; }
.nx-label-stack > span { grid-area:1/1; }
.nx-label-in { animation:nx-label-in 200ms cubic-bezier(.23,1,.32,1) both; }
.nx-label-out { animation:nx-label-out 150ms cubic-bezier(.23,1,.32,1) forwards; pointer-events:none; }
.nx-deposit-cta { transition:background-color 200ms,box-shadow 200ms,color 200ms,transform 160ms; }
.nx-deposit-cta[aria-disabled=true] { background:var(--nx-cta-off); color:var(--nx-mute-2); box-shadow:none; }
@keyframes nx-shake { 20% { transform:translateX(-4px); } 45% { transform:translateX(3px); } 70% { transform:translateX(-2px); } }
.nx-prow.shake { animation:nx-shake 320ms cubic-bezier(.23,1,.32,1); }
@keyframes nx-menu-in { from { opacity:0; transform:scale(.96) translateY(-4px); } }
.nx-asset-menu { transform-origin:top right; animation:nx-menu-in 150ms cubic-bezier(.23,1,.32,1) both; }
.nx-tip { animation:nx-tooltip-in 150ms cubic-bezier(.23,1,.32,1) both; }
@keyframes nx-tooltip-in { from { opacity:0; transform:translateY(4px) scale(.98); } }
.nx-asset-controls[aria-busy=true] { opacity:.5; pointer-events:none; }
.nx-asset-controls { transition:opacity 200ms; }
.nx-asset-row { animation:nx-row-in 200ms cubic-bezier(.23,1,.32,1) both; transition:background-color 150ms,transform 100ms; }
.nx-screen-stage { position:relative; width:100%; }
.nx-screen-entering { display:flex; flex-direction:column; gap:8px; animation:nx-scr-in 250ms cubic-bezier(.23,1,.32,1) 60ms both; }
.nx-screen-stage.back > .nx-screen-entering { animation-name:nx-scr-in-back; }
.nx-screen-entering .nx-deposit-screen { animation:none; }
.nx-screen-leaving { position:absolute; inset:0 0 auto; display:flex; flex-direction:column; gap:8px; pointer-events:none; animation:nx-screen-out 150ms cubic-bezier(.23,1,.32,1) both; }
@keyframes nx-screen-out { to { opacity:0; transform:translateX(-16px); } }
.nx-screen-stage.back > .nx-screen-leaving { animation-name:nx-screen-out-back; }
@keyframes nx-screen-out-back { to { opacity:0; transform:translateX(16px); } }
@keyframes nx-sheet-in { from { transform:translateY(105%); } }
@keyframes nx-scrim-in { from { opacity:0; } }
.nx-deposit-sheet { animation:nx-sheet-in 400ms cubic-bezier(.32,.72,0,1) backwards; }
.nx-deposit-scrim { animation:nx-scrim-in 400ms ease-out; }
.nx-deposit-sheet.closing { animation:none; }
.nx-sheet-grip { height:26px; width:100%; display:grid; place-items:center; flex-shrink:0; touch-action:none; cursor:grab; }
.nx-sheet-grip > span { width:36px; height:4px; border-radius:99px; background:var(--nx-line-2); }
.nx-sheet-grip:focus-visible { outline:2px solid var(--nx-blue); outline-offset:-3px; }
@keyframes nx-pop { from { opacity:0; transform:scale(.4); } }
.nx-step-icon { animation:nx-pop 250ms cubic-bezier(.23,1,.32,1) both; }
.nx-step-text { animation:nx-label-in 200ms cubic-bezier(.23,1,.32,1) both; }
.nx-step-presence { display:grid; grid-template-rows:0fr; opacity:0; transition:grid-template-rows 250ms cubic-bezier(.2,0,0,1),opacity 150ms; }
.nx-step-presence.on { grid-template-rows:1fr; opacity:1; transition:grid-template-rows 250ms cubic-bezier(.2,0,0,1),opacity 200ms 60ms; }
.nx-step-presence > div { min-height:0; overflow:hidden; }
@keyframes nx-spring { 0% { transform:scale(.5); opacity:0; } 30% { transform:scale(1.08); opacity:1; } 55% { transform:scale(.97); } 75% { transform:scale(1.01); } 100% { transform:scale(1); } }
@keyframes nx-ring-in { from { opacity:0; transform:scale(.6); } }
@keyframes nx-check-draw { to { stroke-dashoffset:0; } }
.nx-receipt-success .nx-receipt-band { animation:nx-scrim-in 250ms both; }
.nx-receipt-success .nx-ring-outer { animation:nx-ring-in 600ms cubic-bezier(.23,1,.32,1) 160ms both; }
.nx-receipt-success .nx-ring-middle { animation:nx-ring-in 600ms cubic-bezier(.23,1,.32,1) 80ms both; }
.nx-receipt-success .nx-ring-center { animation:nx-spring 500ms linear both; }
.nx-receipt-success .nx-ring-center path { stroke-dasharray:30; stroke-dashoffset:30; animation:nx-check-draw 300ms cubic-bezier(.23,1,.32,1) 320ms forwards; }
.nx-receipt-success .nx-receipt-details > div { animation:nx-row-in 250ms cubic-bezier(.23,1,.32,1) both; animation-delay:200ms; }
.nx-receipt-success .nx-receipt-details > div:nth-child(2) { animation-delay:240ms; }
.nx-receipt-success .nx-receipt-details > div:nth-child(3) { animation-delay:280ms; }
.nx-receipt-success .nx-receipt-details > div:nth-child(n+4) { animation-delay:320ms; }
.nx-receipt-success > .nx-deposit-cta { animation:nx-row-in 250ms 400ms both; }
[data-nexus-widget-root] input::selection { background:var(--nx-blue-soft); color:var(--nx-ink); }
@media (prefers-reduced-motion: reduce) {
  .nx-deposit-screen, .nx-arrive, .nx-shim::after, .nx-caret, .nx-warn, .nx-mode-change, .nx-progress-change { animation:none !important; }
  [data-nexus-widget-root] *, .nx-tip { animation-duration:.01ms !important; animation-delay:0ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; transition-delay:0ms !important; }
  .nx-screen-leaving { display:none; }
  .nx-ring-center path { stroke-dashoffset:0 !important; }
  .nx-digit-current { animation:none !important; }
  .nx-plus { transition:none !important; }
  .nx-token-presence.exiting { animation:none; display:none; }
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
