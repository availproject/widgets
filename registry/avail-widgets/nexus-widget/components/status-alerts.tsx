// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import { AlertCircle, Info } from "lucide-react";

export type AlertType = "error" | "info" | "warning";

export function StatusAlert({
  type,
  message,
  className = "",
}: Readonly<{
  type: AlertType;
  message: React.ReactNode;
  className?: string;
}>) {
  const styles = {
    error: {
      backgroundColor: "var(--nexus-widget-error-background, #FCEEED)",
      color: "var(--nexus-widget-error-text, #D32F2F)",
    },
    info: {
      backgroundColor: "var(--nexus-widget-surface-raised, #F5F5F5)",
      color: "var(--nexus-widget-text-secondary, #424242)",
    },
    warning: {
      backgroundColor: "var(--nexus-widget-warning-background, #FFF8E1)",
      color: "var(--nexus-widget-warning-text, #F57F17)",
    },
  };

  const iconStyle: React.CSSProperties = {
    flex: "0 0 14px",
    height: "14px",
    marginTop: "1px",
    width: "14px",
  };

  const icons = {
    error: <AlertCircle aria-hidden="true" style={iconStyle} />,
    info: <Info aria-hidden="true" style={iconStyle} />,
    warning: <Info aria-hidden="true" style={iconStyle} />,
  };

  return (
    <div
      className={`rounded-md py-2 px-2.5 text-xs flex items-start w-full leading-4 font-normal border-transparent ${className}`}
      style={{
        ...styles[type],
        alignItems: "flex-start",
        borderRadius: "6px",
        boxSizing: "border-box",
        display: "flex",
        fontSize: "12px",
        fontWeight: 400,
        gap: "8px",
        lineHeight: "16px",
        padding: "8px 10px",
        width: "100%",
      }}
    >
      {icons[type]}
      <div className="flex-1" style={{ flex: "1 1 0%", minWidth: 0 }}>
        {message}
      </div>
    </div>
  );
}
