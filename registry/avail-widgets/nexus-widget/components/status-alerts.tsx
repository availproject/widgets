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

  const icons = {
    error: <AlertCircle className="w-3.5 h-3.5 mr-2 flex-none mt-0.5" />,
    info: <Info className="w-3.5 h-3.5 mr-2 flex-none mt-0.5" />,
    warning: <Info className="w-3.5 h-3.5 mr-2 flex-none mt-0.5" />,
  };

  return (
    <div
      className={`rounded-md py-2 px-2.5 text-xs flex items-start w-full leading-4 font-normal border-transparent ${className}`}
      style={styles[type]}
    >
      {icons[type]}
      <div className="flex-1">{message}</div>
    </div>
  );
}
