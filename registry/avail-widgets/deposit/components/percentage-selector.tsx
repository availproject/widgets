"use client";

import { Skeleton } from "../../ui/skeleton";

const PERCENTAGE_OPTIONS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "MAX", value: 1 },
] as const;

interface PercentageButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isLoading?: boolean;
}

function PercentageButton({
  label,
  onClick,
  disabled = false,
  isFirst,
  isLast,
  isLoading = false,
}: PercentageButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`py-2 bg-card max-w-[60px] h-[34px] flex items-center justify-center w-full px-4 font-sans text-sm leading-4.5 transition-colors ${
        !isLast ? "border-r border-border" : ""
      } ${isFirst ? "rounded-l-lg" : ""} ${isLast ? "rounded-r-lg" : ""} ${
        disabled ? "cursor-default opacity-70" : "hover:bg-muted cursor-pointer"
      }`}
    >
      {isLoading ? <Skeleton className="h-4 w-8 rounded-sm" /> : label}
    </button>
  );
}

export interface PercentageSelectorProps {
  onPercentageClick: (percentage: number) => void;
  disabled?: boolean;
  loadingMax?: boolean;
}

export function PercentageSelector({
  onPercentageClick,
  disabled = false,
  loadingMax = false,
}: PercentageSelectorProps) {
  return (
    <div className="relative mt-10.5">
      <div className="h-px w-full bg-border" />
      <div className="absolute flex top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-base h-9 rounded-lg border">
        {PERCENTAGE_OPTIONS.map((option, index) => (
          <PercentageButton
            key={option.label}
            label={option.label}
            onClick={() => onPercentageClick(option.value)}
            disabled={disabled}
            isFirst={index === 0}
            isLast={index === PERCENTAGE_OPTIONS.length - 1}
            isLoading={loadingMax && option.label === "MAX"}
          />
        ))}
      </div>
    </div>
  );
}
