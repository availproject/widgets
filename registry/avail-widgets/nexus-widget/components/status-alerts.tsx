// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import { AlertCircle, Info } from "lucide-react";
import { nexusWidgetTheme } from "../theme";

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
    error: "bg-[#FCEEED] text-[#D32F2F] border-transparent",
    info: "bg-[#F5F5F5] text-[#424242] border-transparent",
    warning: "bg-[#FFF8E1] text-[#F57F17] border-transparent",
  };

  const icons = {
    error: <AlertCircle className="w-3.5 h-3.5 mr-2 flex-none mt-0.5" />,
    info: <Info className="w-3.5 h-3.5 mr-2 flex-none mt-0.5" />,
    warning: <Info className="w-3.5 h-3.5 mr-2 flex-none mt-0.5" />,
  };

  return (
    <div
      className={`rounded-md py-2 px-2.5 text-xs flex items-start w-full leading-4 font-normal ${styles[type]} ${className}`}
    >
      {icons[type]}
      <div className="flex-1">{message}</div>
    </div>
  );
}
