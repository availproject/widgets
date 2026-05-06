export const nexusOneTheme = {
  colors: {
    background: {
      primary: "var(--widget-background, #F9F9F8)",
      secondary: "var(--background-secondary, #FFFFFE)",
      tertiary: "var(--background-tertiary, #F0F0EF)",
      accent: "var(--background-accent, #F4F6FF)",
    },
    foreground: {
      primary: "var(--foreground-primary, #161615)",
      muted: "var(--foreground-muted, #848483)",
      subtle: "var(--foreground-subtle, #9E9E9C)",
      brand: "var(--foreground-brand, #006BF4)",
      error: "var(--foreground-error, #FF3B30)",
      success: "var(--foreground-success, #34C759)",
    },
    border: {
      primary: "var(--border-default, #E8E8E7)",
      secondary: "var(--border-secondary, #C8C8C7)",
      focus: "var(--border-focus, #006BF4)",
    },
    shadow: {
      sm: "0px 1px 2px 0px rgba(22, 22, 21, 0.04)",
      md: "0px 1px 12px 0px rgba(91, 91, 91, 0.05)",
      lg: "0px 8px 24px 0px rgba(22, 22, 21, 0.12), 0px 1px 2px 0px rgba(22, 22, 21, 0.04)",
    },
  },
  typography: {
    fonts: {
      primary: 'var(--font-geist-sans), "Geist", system-ui, sans-serif',
      secondary: '"Delight-Medium", "Delight", system-ui, sans-serif',
      mono: 'var(--font-geist-mono), monospace',
    },
    sizes: {
      xs: "11px",
      sm: "12px",
      base: "14px",
      lg: "16px",
      xl: "18px",
      "2xl": "36px",
    },
  },
  radius: {
    sm: "4px",
    md: "8px",
    lg: "10px",
    xl: "12px",
    "2xl": "16px",
    full: "999px",
  },
};
