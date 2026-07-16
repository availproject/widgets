const ink = {
  900: "#161615",
  800: "#1F1F1F",
  600: "#5B5B5A",
  500: "#848483",
  400: "#8E8E89",
  300: "#C9C9C5",
} as const;

export const NEXUS_WIDGET_DEFAULT_PRIMARY_COLOR = "rgb(0, 107, 244)" as const;
export const NEXUS_WIDGET_FAST_SPINNER_STYLE = {
  animationDuration: "700ms",
} as const;
export const NEXUS_WIDGET_FAST_SPINNER_ANIMATION =
  "spin 700ms linear infinite" as const;

const blue = {
  700: "var(--foreground-brand)",
  500: "var(--foreground-brand)",
  100: "#EAF1FF",
  50: "#E5EEFF",
  tab: "#F0F3F9",
} as const;

const surface = {
  default: "#FFFFFE",
  soft: "#FAFAFC",
  cool: "#F6F6F6",
  border: "#ECECEA",
  border2: "#E8E8E7",
} as const;

const status = {
  success: "#1BC57A",
  successBg: "rgba(27, 197, 122, 0.18)",
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
    card: "#3C286433 0px 0px 3px, #3C28640A 0px 1px 4px",
    control: "#3C28640F 0px 1px 2px, #3C28640A 0px 2px 6px",
    iconButton: "#3C28640F 0px 1px 2px, #3C28640A 0px 2px 4px",
    inset: "#3C28640F 0px 1px 2px inset",
    primaryButton:
      "#FFFFFF12 0px 1px 0px inset, #0000001F 0px 1px 2px, #14141E24 0px 4px 10px",
    root: "#FFFFFFE6 0px 1px 0px inset, #FFFFFF8C 0px 0px 0px 9px, #11346A0A 0px 2px 4px, #0078F721 0px 9px 18px, #1571FE1F 0px 22px 42px",
    segmentedActive:
      "#FFFFFFE6 0px 1px 0px inset, #3C286414 0px 1px 2px, #3C28640F 0px 2px 6px",
    sheet: "#0000001F 0px -4px 20px",
    tokenPill: "#3C28640F 0px 1px 2px, #3C28640A 0px 2px 8px",
    tooltip: "0 8px 24px rgba(22,22,21,0.12)",
  },
  primitives: {
    badge: {
      backgroundColor: blue[100],
      color: blue[500],
    },
    iconButton: {
      backgroundColor: surface.default,
      borderColor: "#0000000F",
      boxShadow: "#3C28640F 0px 1px 2px, #3C28640A 0px 2px 4px",
      size: "29px",
    },
    tokenPill: {
      backgroundColor: surface.default,
      borderColor: "#0000000A",
      boxShadow: "#3C28640F 0px 1px 2px, #3C28640A 0px 2px 8px",
    },
  },
} as const;
