import { type FC, Fragment, useEffect, useMemo, useRef } from "react";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { formatTokenBalance } from "@avail-project/nexus-core/utils";
import { type UserAsset } from "../../nexus/NexusProvider";
import { useNexus } from "../../nexus/NexusProvider";
import { type FastBridgeState } from "../hooks/useBridge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";
import { SHORT_CHAIN_NAME } from "../../common";
import {
  clampAmountToMax,
  normalizeMaxAmount,
} from "../../common/utils/transaction-flow";
import { LoaderCircle } from "lucide-react";

interface AmountInputProps {
  amount?: string;
  onChange: (value: string) => void;
  bridgableBalance?: UserAsset;
  onCommit?: (value: string) => void;
  disabled?: boolean;
  inputs: FastBridgeState;
  maxAmount?: string | number;
  maxAvailableAmount?: string;
}

const AmountInput: FC<AmountInputProps> = ({
  amount,
  onChange,
  bridgableBalance,
  onCommit,
  disabled,
  inputs,
  maxAmount,
  maxAvailableAmount,
}) => {
  const { nexusSDK, loading } = useNexus();
  const commitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const normalizedMaxAmount = useMemo(
    () => normalizeMaxAmount(maxAmount),
    [maxAmount],
  );

  const applyMaxCap = (value: string) => {
    if (!nexusSDK || !inputs?.token || !inputs?.chain) {
      return value;
    }
    return clampAmountToMax({
      amount: value,
      maxAmount: normalizedMaxAmount,
      nexusSDK,
      token: inputs.token,
      chainId: inputs.chain,
    });
  };

  const scheduleCommit = (val: string) => {
    if (!onCommit || disabled) return;
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      onCommit(val);
    }, 800);
  };

  const onMaxClick = () => {
    if (!maxAvailableAmount) return;
    const capped = applyMaxCap(maxAvailableAmount);
    onChange(capped);
    onCommit?.(capped);
  };

  useEffect(() => {
    return () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-y-2 pb-2 w-full">
      <div className="w-full flex sm:flex-row flex-col border border-border rounded-lg gap-y-2">
        <Input
          type="text"
          inputMode="decimal"
          value={amount ?? ""}
          placeholder="Enter Amount"
          onChange={(e) => {
            let next = e.target.value.replaceAll(/[^0-9.]/g, "");
            const parts = next.split(".");
            if (parts.length > 2)
              next = parts[0] + "." + parts.slice(1).join("");
            if (next === ".") next = "0.";
            onChange(next);
            scheduleCommit(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (commitTimerRef.current) {
                clearTimeout(commitTimerRef.current);
                commitTimerRef.current = null;
              }
              onCommit?.(amount ?? "");
            }
          }}
          className="w-full border-none bg-transparent rounded-r-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none py-0 px-3  h-12!"
          aria-invalid={Boolean(amount) && Number.isNaN(Number(amount))}
          disabled={disabled || loading}
        />
        <div className="flex items-center justify-end-safe gap-x-2 sm:gap-x-4 w-fit px-2 border-l border-border">
          {bridgableBalance && (
            <p className="text-base font-medium min-w-max">
              {formatTokenBalance(bridgableBalance?.balance, {
                symbol: bridgableBalance?.symbol,
                decimals: bridgableBalance?.decimals,
              })}
            </p>
          )}
          {loading && !bridgableBalance && (
            <LoaderCircle className="size-4 animate-spin" />
          )}
          <Button
            size={"sm"}
            variant={"ghost"}
            onClick={onMaxClick}
            className="px-0 font-medium"
            disabled={disabled || maxAvailableAmount === undefined}
          >
            MAX
          </Button>
        </div>
      </div>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="balance-breakdown">
          <AccordionTrigger
            className="w-fit justify-end items-center py-0 mt-2 gap-x-0.5 cursor-pointer text-sm font-normal"
            hideChevron={false}
          >
            View Balance Breakdown
          </AccordionTrigger>
          <AccordionContent className="pb-0 bg-muted rounded-lg mt-4">
            <div className="space-y-1 py-2">
              {bridgableBalance?.breakdown.map((chain) => {
                if (Number.parseFloat(chain.balance) === 0) return null;
                if (inputs?.chain === chain.chain.id) return null;
                return (
                  <Fragment key={chain.chain.id}>
                    <div className="flex items-center justify-between px-2 py-1 rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="relative h-6 w-6">
                          <img
                            src={chain?.chain?.logo}
                            alt={chain.chain.name}
                            sizes="100%"
                            className="rounded-full"
                            loading="lazy"
                            decoding="async"
                            width="20"
                            height="20"
                          />
                        </div>
                        <span className="text-sm font-light sm:block hidden">
                          {SHORT_CHAIN_NAME[chain.chain.id]}
                        </span>
                      </div>
                      <p className="text-sm font-light text-right">
                        {formatTokenBalance(chain.balance, {
                          symbol: chain.symbol,
                          decimals: chain.decimals,
                        })}
                      </p>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default AmountInput;
