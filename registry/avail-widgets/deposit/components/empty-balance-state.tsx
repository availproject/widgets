"use client";

import { Button } from "../../ui/button";
import { InfoIcon } from "./icons";

type EmptyBalanceStateMode = "no-swap-assets" | "zero-balance";

interface EmptyBalanceStateProps {
  mode: EmptyBalanceStateMode;
  onRefresh?: () => void;
}

const CONTENT: Record<
  EmptyBalanceStateMode,
  { title: string; description: string; hint: string }
> = {
  "no-swap-assets": {
    title: "No Supported Assets Found",
    description:
      "Your wallet doesn’t hold any assets supported for this deposit. Certain assets on chains such as Monad or MegaETH may be temporarily unavailable for use.",
    hint: "Add a supported asset, then refresh balances to continue.",
  },
  "zero-balance": {
    title: "No available balance to deposit",
    description:
      "We found swap-supported assets for this wallet, but every available balance is currently zero.",
    hint: "Fund one of the supported assets, then refresh balances to continue.",
  },
};

export function EmptyBalanceState({ mode, onRefresh }: EmptyBalanceStateProps) {
  const content = CONTENT[mode];

  return (
    <div className="py-8 px-6 min-h-[212px] w-full rounded-lg border bg-base text-muted-foreground shadow-[0_1px_12px_0_rgba(91,91,91,0.05)]">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center">
          <InfoIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-sans text-sm font-medium text-card-foreground">
            {content.title}
          </h3>
          <p className="font-sans text-[13px] leading-5 text-muted-foreground">
            {content.description}
          </p>
          <p className="font-sans text-[13px] leading-5 text-muted-foreground">
            {content.hint}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-1"
          onClick={onRefresh}
        >
          Refresh balances
        </Button>
      </div>
    </div>
  );
}
