import { useMemo, useState, useEffect, useRef } from "react";
import ButtonCard from "./button-card";
import { RightChevronIcon, CoinIcon } from "./icons";
import { Skeleton } from "../../ui/skeleton";
import {
  LOADING_SKELETON_DELAY_MS,
  MIN_SELECTABLE_SOURCE_BALANCE_USD,
} from "../constants/widget";
import type { DestinationConfig, AssetFilterType } from "../types";
import type { UserAsset } from "../../nexus/NexusProvider";
import { resolveDepositSourceSelection } from "../utils";

function parseUsdAmount(value?: string): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

interface PayUsingProps {
  onClick?: () => void;
  selectedChainIds: Set<string>;
  filter: AssetFilterType;
  isManualSelection: boolean;
  amount?: string;
  swapBalance: UserAsset[] | null;
  destination: Pick<
    DestinationConfig,
    "chainId" | "tokenAddress" | "tokenSymbol"
  >;
}

function PayUsing({
  onClick,
  selectedChainIds,
  filter,
  isManualSelection,
  amount,
  swapBalance,
  destination,
}: PayUsingProps) {
  const [isLoading, setIsLoading] = useState(false);
  const previousAmountRef = useRef<string | undefined>(undefined);
  const hasAmount = Boolean(amount && amount.trim() !== "" && amount !== "0");

  useEffect(() => {
    const hadAmount = Boolean(
      previousAmountRef.current && previousAmountRef.current.trim() !== "",
    );

    if (hasAmount && !hadAmount) {
      setIsLoading(true);
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, LOADING_SKELETON_DELAY_MS);
      return () => clearTimeout(timer);
    }

    previousAmountRef.current = amount;
  }, [amount, hasAmount]);

  const subtitle = useMemo(() => {
    if (!swapBalance) return "No tokens selected";
    const symbolBySourceId = new Map<string, string>();

    swapBalance.forEach((asset) => {
      asset.breakdown?.forEach((breakdown) => {
        const chainId = breakdown.chain?.id;
        const tokenAddress = breakdown.contractAddress;
        if (!chainId || !tokenAddress) return;
        const sourceId = `${tokenAddress}-${chainId}`;
        symbolBySourceId.set(sourceId, breakdown.symbol);
      });
    });

    const { sourcePoolIds, selectedSourceIds: prioritizedSourceIds } =
      resolveDepositSourceSelection({
        swapBalance,
        destination,
        filter,
        selectedSourceIds: selectedChainIds,
        isManualSelection,
        minimumBalanceUsd: MIN_SELECTABLE_SOURCE_BALANCE_USD,
        targetAmountUsd: parseUsdAmount(amount),
      });

    if (sourcePoolIds.length === 0) return "No tokens selected";

    const orderedSymbols: string[] = [];
    const seenSymbols = new Set<string>();
    prioritizedSourceIds.forEach((sourceId) => {
      const symbol = symbolBySourceId.get(sourceId);
      if (!symbol || seenSymbols.has(symbol)) return;
      seenSymbols.add(symbol);
      orderedSymbols.push(symbol);
    });

    const symbols = orderedSymbols;
    const count = prioritizedSourceIds.length;

    let text: string;
    if (count === 0) {
      text = "No tokens selected";
    } else if (symbols.length <= 2) {
      text = symbols.join(", ");
    } else {
      text = `${symbols.slice(0, 2).join(", ")} +${symbols.length - 2} more`;
    }

    return text;
  }, [
    selectedChainIds,
    filter,
    isManualSelection,
    swapBalance,
    destination,
    amount,
  ]);

  const renderSubtitle = () => {
    if (!hasAmount) {
      return (
        <span className="text-[13px] leading-4.5 text-muted-foreground font-sans">
          Auto-selected based on amount
        </span>
      );
    }

    if (isLoading) {
      return <Skeleton className="h-4 w-32 bg-muted" />;
    }

    return (
      <span className="text-[13px] leading-4.5 text-muted-foreground font-sans">
        {subtitle}
      </span>
    );
  };

  const showEditControls = hasAmount && !isLoading;

  return (
    <ButtonCard
      title="Pay using"
      subtitle={renderSubtitle()}
      icon={<CoinIcon className="w-6 h-6 text-muted-foreground" />}
      rightIcon={
        showEditControls ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm leading-4.5 transition-colors duration-200 group-hover/button-card:text-card-foreground">
              Edit
            </span>
            <RightChevronIcon
              size={20}
              className="text-muted-foreground transition-colors duration-200 group-hover/button-card:text-card-foreground"
            />
          </div>
        ) : undefined
      }
      onClick={showEditControls ? onClick : undefined}
      disabled={!showEditControls}
      roundedBottom={false}
    />
  );
}

export default PayUsing;
