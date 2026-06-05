import { type FC, useMemo } from "react";
import {
  type BridgeStepType,
  type SwapStepType,
} from "@avail-project/nexus-core";
import { StepFlow } from "./step-flow";

export type DisplayStep = { id: string; label: string; completed: boolean; failed?: boolean; explorerUrl?: string | null };
type ProgressStep = BridgeStepType | SwapStepType;

interface TokenSource {
  tokenLogo: string;
  chainLogo: string;
  symbol: string;
}

interface TransactionProgressProps {
  steps: Array<{ id: number; completed: boolean; step: ProgressStep }>;
  explorerUrls: {
    sourceExplorerUrl: string | null;
    destinationExplorerUrl: string | null;
  };
  sourceSymbol: string;
  destinationSymbol: string;
  sourceLogos: {
    token: string;
    chain: string;
  };
  destinationLogos: {
    token: string;
    chain: string;
  };
  hasMultipleSources?: boolean;
  sources?: TokenSource[];
  isTransferMode?: boolean;
  depositOpportunityName?: string;
}

const STEP_TYPES = {
  INTENT_VERIFICATION: ["CREATE_PERMIT_FOR_SOURCE_SWAP"],
  SOURCE_STEP_TYPES: [
    "CREATE_PERMIT_EOA_TO_EPHEMERAL",
    "CREATE_PERMIT_FOR_SOURCE_SWAP",
    "SOURCE_SWAP_BATCH_TX",
    "SOURCE_SWAP_HASH",
  ],
  SOURCE_TRANSACTION: ["SOURCE_SWAP_HASH", "SOURCE_SWAP_BATCH_TX"],
  DESTINATION_STEP_TYPES: [
    "DESTINATION_SWAP_BATCH_TX",
    "DESTINATION_SWAP_HASH",
    "SWAP_COMPLETE",
  ],
  TRANSACTION_COMPLETE: ["SWAP_COMPLETE"],
};

const TransactionProgress: FC<TransactionProgressProps> = ({
  steps,
  explorerUrls,
  sourceSymbol,
  destinationSymbol,
  sourceLogos,
  destinationLogos,
  hasMultipleSources,
  sources,
  isTransferMode,
  depositOpportunityName,
}) => {
  const { effectiveSteps, currentIndex, allCompleted } = useMemo(() => {
    const completedTypes = new Set<string | undefined>(
      steps?.filter((s) => s?.completed).map((s) => s?.step?.type)
    );
    // Consider only steps that were actually emitted by the SDK (ignore pre-seeded placeholders)
    const eventfulTypes = new Set<string | undefined>(
      steps
        ?.filter((s) => {
          const st = s?.step ?? {};
          return (
            "explorerURL" in st || "chain" in st || "completed" in st // present when event args were merged into step
          );
        })
        .map((s) => s?.step?.type)
    );
    const hasAny = (types: string[]) =>
      types.some((t) => completedTypes.has(t));
    const sawAny = (types: string[]) => types.some((t) => eventfulTypes.has(t));

    // Mark overall completion ONLY when the SDK reports SWAP_COMPLETE
    const baseDone = hasAny(STEP_TYPES.TRANSACTION_COMPLETE);

    // Collected on sources requires destination relayer to pick it up or full completion
    const collectedOnSources =
      hasAny(STEP_TYPES.DESTINATION_STEP_TYPES) || baseDone;

    // Filled on destination requires full on-chain swap completion
    const filledOnDestination = baseDone;

    const intentVerified =
      hasAny(["DETERMINING_SWAP", "SWAP_START"]) ||
      sawAny(STEP_TYPES.SOURCE_STEP_TYPES) ||
      sawAny(STEP_TYPES.DESTINATION_STEP_TYPES) ||
      collectedOnSources ||
      filledOnDestination;

    const displaySteps: DisplayStep[] = [
      { id: "intent", label: "Intent verified", completed: intentVerified },
      {
        id: "collected",
        label: "Collected on sources",
        completed: collectedOnSources,
        explorerUrl: explorerUrls.sourceExplorerUrl,
      },
      {
        id: "filled",
        label: "Filled on destination",
        completed: filledOnDestination,
        explorerUrl: explorerUrls.destinationExplorerUrl,
      },
    ];
    if (isTransferMode) {
      displaySteps.push({
        id: "transfer",
        label: "Sent to recipient",
        completed: baseDone,
        explorerUrl: explorerUrls.destinationExplorerUrl,
      });
    }


    if (depositOpportunityName) {
      displaySteps.push({
        id: "deposit",
        label: `Deposit on ${depositOpportunityName}`,
        completed: baseDone, // swapAndExecute handles execution automatically
        failed: false, // You could parse failed state from SDK here if needed, but keeping simple for now
        explorerUrl: explorerUrls.destinationExplorerUrl, // Use destination Tx hash for deposit trace
      });
    }

    const done = baseDone;
    const current = displaySteps.findIndex((st) => !st.completed && !st.failed);
    return {
      effectiveSteps: displaySteps,
      currentIndex: current,
      allCompleted: done,
    };
  }, [
    steps,
    isTransferMode,
    depositOpportunityName,
    explorerUrls.sourceExplorerUrl,
    explorerUrls.destinationExplorerUrl,
  ]);

  return (
    <div className="w-full flex flex-col items-start">
      <StepFlow
        steps={effectiveSteps}
        currentIndex={currentIndex}
        totalSteps={effectiveSteps.length}
        sourceLogos={sourceLogos}
        sourceSymbol={sourceSymbol}
        destinationLogos={destinationLogos}
        destinationSymbol={destinationSymbol}
        explorerUrls={explorerUrls}
        allCompleted={allCompleted}
        hasMultipleSources={hasMultipleSources}
        sources={sources}
      />
    </div>
  );
};

export default TransactionProgress;
