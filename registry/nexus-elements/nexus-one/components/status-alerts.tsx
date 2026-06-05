import { nexusOneTheme } from "../theme";
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
    error: "bg-[#FCEEED] text-[#D32F2F] border-transparent",
    info: "bg-[#F5F5F5] text-[#424242] border-transparent",
    warning: "bg-[#FFF8E1] text-[#F57F17] border-transparent",
  };

  const icons = {
    error: <AlertCircle className="w-4 h-4 mr-2.5 flex-none mt-0.5" />,
    info: <Info className="w-4 h-4 mr-2.5 flex-none mt-0.5" />,
    warning: <Info className="w-4 h-4 mr-2.5 flex-none mt-0.5" />,
  };

  return (
    <div
      className={`rounded-lg p-3 text-sm flex items-start w-full leading-5 font-normal ${styles[type]} ${className}`}
    >
      {icons[type]}
      <div className="flex-1">{message}</div>
    </div>
  );
}
