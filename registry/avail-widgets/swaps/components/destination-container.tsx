import React, { type RefObject, useMemo } from "react";
import { Label } from "../../ui/label";
import { cn } from "@/lib/utils";
import {
  CHAIN_METADATA,
} from "../../common";
import { type UserAsset } from "../../nexus/NexusProvider";
import { type OnSwapIntentHookData } from "@avail-project/nexus-core";
import {
  type SwapInputs,
  type SwapMode,
  type TransactionStatus,
} from "../hooks/useSwaps";
import { Button } from "../../ui/button";
import { TokenIcon } from "./token-icon";
import AmountInput from "./amount-input";
import { usdFormatter } from "../../common";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import { ChevronDown } from "lucide-react";
import DestinationAssetSelect from "./destination-asset-select";
import { TOKEN_IMAGES } from "../config/destination";

interface DestinationContainerProps {
  destinationHovered: boolean;
  inputs: SwapInputs;
  swapIntent: RefObject<OnSwapIntentHookData | null>;
  destinationBalance?: UserAsset["breakdown"][0];
  swapBalance: UserAsset[] | null;
  availableStables: UserAsset[];
  swapMode: SwapMode;
  status: TransactionStatus;
  setInputs: (inputs: Partial<SwapInputs>) => void;
  setSwapMode: (mode: SwapMode) => void;
  getFiatValue: (amount: number, token: string) => number;
  formatBalance: (
    balance?: string | number,
    symbol?: string,
    decimals?: number
  ) => string | undefined;
}

type AssetBreakdownWithOptionalIcon = UserAsset["breakdown"][number] & {
  icon?: string;
};

const DestinationContainer: React.FC<DestinationContainerProps> = ({
  destinationHovered,
  inputs,
  swapIntent,
  destinationBalance,
  swapBalance,
  availableStables,
  swapMode,
  status,
  setInputs,
  setSwapMode,
  getFiatValue,
  formatBalance,
}) => {
  // In exactOut mode, show user's input; in exactIn mode, show calculated destination
  const displayedAmount =
    swapMode === "exactOut"
      ? inputs.toAmount ?? ""
      : formatBalance(
          swapIntent?.current?.intent?.destination?.amount,
          swapIntent?.current?.intent?.destination?.token?.symbol,
          swapIntent?.current?.intent?.destination?.token?.decimals
        ) ?? "";

  const quickPickTokens = useMemo(
    () =>
      availableStables
        .map((token) => {
          const breakdown =
            token.breakdown?.find(
              (entry) => Number.parseFloat(entry.balance ?? "0") > 0,
            ) ?? token.breakdown?.[0];
          if (!breakdown) return null;
          return { token, breakdown };
        })
        .filter(
          (
            item,
          ): item is {
            token: UserAsset;
            breakdown: UserAsset["breakdown"][number];
          } => item !== null,
        ),
    [availableStables],
  );

  return (
    <div className="bg-background rounded-xl flex flex-col items-center w-full gap-y-4">
      <div className="w-full flex items-center justify-between">
        <Label className="text-lg font-medium text-foreground">Buy</Label>
        {(!inputs?.toToken || !inputs?.toChainID) && (
          <div
            className={cn(
              "flex transition-all duration-150 ease-out w-full justify-end gap-x-2",
              destinationHovered
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-1"
            )}
          >
            {quickPickTokens.map(({ token, breakdown }) => (
              <Button
                key={`${breakdown.symbol}-${breakdown.chain.id}-${breakdown.contractAddress}`}
                size={"icon-sm"}
                variant={"secondary"}
                onClick={() => {
                  const normalizedSymbol = breakdown.symbol.toUpperCase();
                  const breakdownIcon = (
                    breakdown as AssetBreakdownWithOptionalIcon
                  ).icon;
                  const tokenLogo =
                    breakdownIcon ||
                    TOKEN_IMAGES[breakdown.symbol] ||
                    TOKEN_IMAGES[normalizedSymbol] ||
                    token.logo ||
                    "";
                  setInputs({
                    ...inputs,
                    toToken: {
                      tokenAddress: breakdown.contractAddress,
                      decimals: breakdown.decimals ?? token.decimals,
                      logo: tokenLogo,
                      name: breakdown.symbol,
                      symbol: breakdown.symbol,
                    },
                    toChainID: breakdown.chain.id,
                  });
                }}
                className="bg-transparent rounded-full hover:-translate-y-1 hover:object-scale-down"
              >
                <TokenIcon
                  symbol={breakdown.symbol}
                  tokenLogo={
                    (breakdown as AssetBreakdownWithOptionalIcon).icon ||
                    TOKEN_IMAGES[breakdown.symbol] ||
                    TOKEN_IMAGES[breakdown.symbol.toUpperCase()] ||
                    token.logo ||
                    ""
                  }
                  chainLogo={breakdown.chain.logo}
                  size="sm"
                />
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-x-4 w-full">
        <AmountInput
          amount={displayedAmount}
          onChange={(val) => {
            setSwapMode("exactOut");
            setInputs({ toAmount: val, fromAmount: undefined });
          }}
          disabled={status === "simulating" || status === "swapping"}
        />
        <Dialog>
          <DialogTrigger asChild>
            <div className="flex items-center gap-x-3 bg-card/50 hover:bg-card-foreground/10 border border-border min-w-max rounded-full p-1 cursor-pointer transition-colors">
              <TokenIcon
                symbol={inputs?.toToken?.symbol}
                tokenLogo={inputs?.toToken?.logo}
                chainLogo={
                  inputs?.toChainID
                    ? CHAIN_METADATA[inputs?.toChainID]?.logo
                    : undefined
                }
                size="lg"
              />
              <span className="font-medium">{inputs?.toToken?.symbol}</span>
              <ChevronDown size={16} className="mr-1" />
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-md!">
            <DialogHeader>
              <DialogTitle>Select Destination</DialogTitle>
            </DialogHeader>
            <DestinationAssetSelect
              swapBalance={swapBalance}
              onSelect={(toChainID, toToken) =>
                setInputs({ ...inputs, toChainID, toToken })
              }
            />
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex items-center justify-between gap-x-4 w-full">
        {swapIntent?.current?.intent?.destination?.amount && inputs?.toToken ? (
          <span className="text-sm text-accent-foreground">
            {usdFormatter.format(
              getFiatValue(
                Number.parseFloat(
                  swapIntent?.current?.intent?.destination?.amount
                ),
                inputs.toToken?.symbol
              )
            )}
          </span>
        ) : (
          <span className="h-5" />
        )}
        {inputs?.toToken ? (
          <span className="text-sm text-muted-foreground">
            {formatBalance(
              destinationBalance?.balance,
              inputs?.toToken?.symbol,
              destinationBalance?.decimals
            ) ?? ""}
          </span>
        ) : (
          <span className="h-5" />
        )}
      </div>
    </div>
  );
};

export default DestinationContainer;
