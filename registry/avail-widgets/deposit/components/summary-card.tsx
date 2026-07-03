import { ChevronDownIcon, ChevronUpIcon } from "./icons";
import { Skeleton } from "../../ui/skeleton";
import { formatUsdForDisplay } from "../../common";

interface SummaryCardProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  subText?: React.ReactNode;
  value: string;
  valueSuffix?: string;
  showBreakdown?: boolean;
  loading?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children?: React.ReactNode;
}

function isPlainNumericString(value: string): boolean {
  const trimmed = value.trim();
  return /^-?\d+(\.\d+)?$/u.test(trimmed);
}

function SummaryCard({
  icon,
  title,
  subtitle,
  value,
  valueSuffix,
  showBreakdown,
  loading = false,
  expanded = false,
  onToggleExpand,
  subText,
  children,
}: SummaryCardProps) {
  return (
    <div className="border-t border-border py-5">
      <div className="flex justify-between">
        <div className="flex gap-4 items-center">
          {icon}
          <div className="flex-col flex gap-2">
            <div className="font-sans text-sm leading-4.5 text-card-foreground">
              {title}
            </div>
            {subtitle && (
              <div className="font-sans text-[13px] leading-4.5 text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex gap-1 items-end">
            {loading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <>
                <span className="font-display text-card-foreground tracking-[0.36px] leading-4.5 font-medium">
                  {valueSuffix === "USD" ||
                  (!valueSuffix && isPlainNumericString(value))
                    ? formatUsdForDisplay(parseFloat(value))
                    : value}
                </span>
                {valueSuffix && (
                  <span className="text-muted-foreground text-[13px] leading-4.5">
                    {valueSuffix}
                  </span>
                )}
              </>
            )}
          </div>
          {showBreakdown && (
            <button
              className="flex gap-0.5 cursor-pointer"
              onClick={onToggleExpand}
            >
              <span className="font-sans text-[13px] underline leading-4.5 text-muted-foreground underline-offset-2">
                View details
              </span>
              {expanded ? (
                <ChevronUpIcon size={16} className="text-muted-foreground" />
              ) : (
                <ChevronDownIcon size={16} className="text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>
      {subText ? subText : null}
      {expanded && children && (
        <div className="mt-4 p-4 bg-background/30">{children}</div>
      )}
    </div>
  );
}

export default SummaryCard;
