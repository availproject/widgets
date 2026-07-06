"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogTitle,
} from "@/registry/avail-widgets/ui/dialog";
import { Clock, LoaderPinwheel, SquareArrowOutUpRight } from "lucide-react";
import { TOKEN_METADATA } from "../common";
import { type IntentRecord } from "@avail-project/nexus-core";
import { cn } from "@/lib/utils";
import { Badge } from "@/registry/avail-widgets/ui/badge";
import { Button } from "@/registry/avail-widgets/ui/button";
import { Card } from "@/registry/avail-widgets/ui/card";
import { Separator } from "@/registry/avail-widgets/ui/separator";
import useViewHistory from "./hooks/useViewHistory";
import { useEffect, useState } from "react";

const TOKEN_ICON_FALLBACKS: Record<string, string> = {
  USDM:
    "https://raw.githubusercontent.com/availproject/nexus-assets/main/tokens/usdm/logo.png",
};

function resolveTokenMetadata(symbol?: string) {
  const normalized = symbol?.trim() ?? "";
  if (!normalized) {
    return { icon: "", name: "token" };
  }

  const upper = normalized.toUpperCase();
  const normalizedMetadata =
    TOKEN_METADATA[normalized as keyof typeof TOKEN_METADATA];
  const upperMetadata = TOKEN_METADATA[upper as keyof typeof TOKEN_METADATA];

  const icon =
    normalizedMetadata?.logo ||
    upperMetadata?.logo ||
    TOKEN_ICON_FALLBACKS[normalized] ||
    TOKEN_ICON_FALLBACKS[upper] ||
    "";
  const name = normalizedMetadata?.name || upperMetadata?.name || upper;

  return { icon, name };
}

const SourceChains = ({ sources }: { sources: IntentRecord["sources"] }) => {
  const sourceList = sources ?? [];
  return (
    <div className="flex items-center">
      {sourceList.map((source, index) => (
        <div
          key={source?.chain?.id}
          className={cn(
            "rounded-full transition-transform hover:scale-110",
            index > 0 && "-ml-2"
          )}
          style={{ zIndex: sourceList.length - index }}
        >
          <img
            src={source?.chain?.logo}
            alt={source?.chain?.name}
            width={24}
            height={24}
            className="rounded-full"
          />
        </div>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const getVariant = (status: string) => {
    if (status === "Fulfilled") {
      return "default";
    } else if (status === "Deposited") {
      return "secondary";
    } else if (status === "Refunded") {
      return "outline";
    } else if (status === "Failed") {
      return "destructive";
    } else {
      return "default";
    }
  };

  return (
    <Badge variant={getVariant(status)} className="px-3 py-1">
      <p className="text-xs font-semibold tracking-wide">{status}</p>
    </Badge>
  );
};

const DestinationToken = ({
  destination,
}: {
  destination: IntentRecord["destinations"];
}) => {
  return (
    <div className="flex items-center">
      {destination.map((dest, index) => {
        const tokenMeta = resolveTokenMetadata(dest.token.symbol);
        return (
          <div
            key={dest.token.symbol}
            className={cn(
              "rounded-full transition-transform hover:scale-110",
              index > 0 && "-ml-2"
            )}
            style={{ zIndex: destination.length - index }}
          >
            <img
              src={tokenMeta.icon}
              alt={tokenMeta.name}
              width={24}
              height={24}
              className="rounded-full"
            />
          </div>
        );
      })}
    </div>
  );
};

const ViewHistory = ({
  viewAsModal = true,
  className,
}: {
  viewAsModal?: boolean;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    history,
    loadError,
    displayedHistory,
    hasMore,
    isLoadingMore,
    getStatus,
    observerTarget,
    refreshHistory,
    ITEMS_PER_PAGE,
    formatExpiryDate,
  } = useViewHistory();

  useEffect(() => {
    if (!viewAsModal || !isOpen) return;
    void refreshHistory();
  }, [isOpen, refreshHistory, viewAsModal]);

  const renderHistoryContent = () => {
    if (displayedHistory.length > 0) {
      return (
        <>
          {displayedHistory?.map((pastIntent) => (
            <Card
              key={pastIntent.requestHash}
              className="p-4 hover:shadow-md transition-shadow duration-200 border-border/50 gap-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <DestinationToken destination={pastIntent?.destinations} />
                  <div className="flex flex-col">
                    <p className="text-sm font-medium">
                      {pastIntent?.destinations
                        .map((d) => d?.token?.symbol)
                        .join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Intent #{pastIntent?.requestHash ? `${pastIntent.requestHash.slice(0, 10)}...` : ""}
                    </p>
                  </div>
                </div>
                <StatusBadge status={getStatus(pastIntent)} />
              </div>

              <Separator className="my-1" />

              <div className="flex flex-col sm:flex-row  items-start sm:items-center justify-between gap-4">
                <div className="flex items-center justify-between gap-x-3 flex-1 w-full sm:min-w-fit">
                  <SourceChains sources={pastIntent?.sources} />
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-px w-8 bg-border" />
                    <span className="text-xs">→</span>
                    <div className="h-px w-8 bg-border" />
                  </div>
                  <div className="rounded-full hover:scale-110">
                    <img
                      src={pastIntent?.destinationChain?.logo ?? ""}
                      alt={pastIntent?.destinationChain?.name}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end  gap-x-2 w-full">
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-muted-foreground">Expiry</p>
                    <p className="text-xs font-medium">
                      {formatExpiryDate(pastIntent?.expiry)}
                    </p>
                  </div>
                  <a
                    href={pastIntent?.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="icon">
                      <SquareArrowOutUpRight className="size-4" />
                    </Button>
                  </a>
                </div>
              </div>
            </Card>
          ))}

          {hasMore && (
            <div ref={observerTarget} className="flex justify-center py-4">
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LoaderPinwheel className="size-4 animate-spin" />
                  <span className="text-sm">Loading more...</span>
                </div>
              )}
            </div>
          )}

          {!hasMore && displayedHistory?.length > ITEMS_PER_PAGE && (
            <div className="flex justify-center py-4">
              <p className="text-sm text-muted-foreground">
                No more transactions to load
              </p>
            </div>
          )}
        </>
      );
    }

    if (history === null) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full" />
            <LoaderPinwheel className="relative animate-spin size-12 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-medium">Loading your history</p>
            <p className="text-sm text-muted-foreground">
              Fetching your past transactions...
            </p>
          </div>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Clock className="size-16 text-muted-foreground/30" />
          <div className="text-center space-y-1">
            <p className="text-base font-medium">Unable to load history</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void refreshHistory();
            }}
          >
            Retry
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Clock className="size-16 text-muted-foreground/30" />
        <div className="text-center space-y-1">
          <p className="text-base font-medium">No history yet</p>
          <p className="text-sm text-muted-foreground">
            Your transaction history will appear here
          </p>
        </div>
      </div>
    );
  };

  if (!viewAsModal) {
    return (
      <div className="flex flex-col gap-y-3 max-h-96 no-scrollbar overflow-y-auto w-full max-w-md">
        {renderHistoryContent()}
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative group", className)}
        >
          <Clock className="size-5 text-primary transition-transform group-hover:scale-110" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            Transaction History
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-y-3 max-h-96 no-scrollbar overflow-y-auto w-full">
          {renderHistoryContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewHistory;
