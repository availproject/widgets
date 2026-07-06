import {
  type NexusNetwork,
  type NexusClient,
  type OnAllowanceHookData,
  type OnIntentHookData,
  type TokenBalance,
} from "@avail-project/nexus-core";
import { useCallback, type RefObject } from "react";
import { type Address } from "viem";
import {
  type TransactionFlowExecuteParams,
  type TransactionFlowInputs,
  type TransactionFlowPrefill,
  useTransactionFlow,
} from "../../common";
import { notifyIntentHistoryRefresh } from "../../view-history/history-events";

export type FastTransferState = TransactionFlowInputs;

interface UseTransferProps {
  network: NexusNetwork;
  nexusSDK: NexusClient | null;
  intent: RefObject<OnIntentHookData | null>;
  allowance: RefObject<OnAllowanceHookData | null>;
  bridgableBalance: TokenBalance[] | null;
  prefill?: {
    token: string;
    chainId: number;
    amount?: string;
    recipient?: Address;
  };
  onComplete?: (explorerUrl?: string) => void;
  onStart?: () => void;
  onError?: (message: string) => void;
  fetchBalance: () => Promise<void>;
  maxAmount?: string | number;
  isSourceMenuOpen?: boolean;
}

const useTransfer = ({
  network,
  nexusSDK,
  intent,
  bridgableBalance,
  prefill,
  onComplete,
  onStart,
  onError,
  allowance,
  fetchBalance,
  maxAmount,
  isSourceMenuOpen = false,
}: UseTransferProps) => {
  const executeTransaction = useCallback(
    async ({
      token,
      amount,
      toChainId,
      recipient,
      sourceChains,
      onEvent,
    }: TransactionFlowExecuteParams) => {
      if (!nexusSDK) return null;
      const result = await nexusSDK.bridgeAndTransfer(
        {
          toTokenSymbol: token,
          toAmountRaw: amount,
          toChainId,
          recipient,
          sources: sourceChains,
        },
        {
          onEvent,
          hooks: {
            onIntent: (data) => {
              intent.current = data;
            },
            onAllowance: (data) => {
              allowance.current = data;
            },
          },
        },
      );
      return {
        ...result,
        explorerUrl: result.bridgeSkipped
          ? result.execute.txExplorerUrl
          : (result.bridgeResult?.intentExplorerUrl ?? result.execute.txExplorerUrl),
      };
    },
    [nexusSDK, intent, allowance],
  );

  const flow = useTransactionFlow({
    type: "transfer",
    network,
    nexusSDK,
    intent,
    bridgableBalance,
    prefill: prefill as TransactionFlowPrefill | undefined,
    onComplete,
    onStart,
    onError,
    allowance,
    fetchBalance,
    maxAmount,
    isSourceMenuOpen,
    notifyHistoryRefresh: notifyIntentHistoryRefresh,
    executeTransaction,
  });

  return {
    ...flow,
    inputs: flow.inputs as FastTransferState,
    setInputs: flow.setInputs as (
      next: FastTransferState | Partial<FastTransferState>,
    ) => void,
  };
};

export default useTransfer;
