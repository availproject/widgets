import {
  type NexusClient,
  type BridgeEvent,
} from "@avail-project/nexus-core";
import { type Address } from "viem";

export type TransactionFlowType = "bridge" | "transfer";

export type BridgeStepType = {
  type: string;
  typeID: string;
  completed?: boolean;
  [key: string]: any;
};

export type SwapStepType = {
  type: string;
  typeID: string;
  completed?: boolean;
  [key: string]: any;
};

export interface TransactionFlowInputs {
  chain: number;
  token: string;
  amount?: string;
  recipient?: `0x${string}`;
}

export interface TransactionFlowPrefill {
  token: string;
  chainId: number;
  amount?: string;
  recipient?: Address;
}

export type TransactionFlowEvent = BridgeEvent;

export type TransactionFlowOnEvent = (event: BridgeEvent) => void;

export interface TransactionFlowExecuteParams {
  token: string;
  amount: bigint;
  toChainId: number;
  recipient: `0x${string}`;
  sourceChains?: number[];
  onEvent: TransactionFlowOnEvent;
}

export type TransactionFlowExecutor = (
  params: TransactionFlowExecuteParams,
) => Promise<{ explorerUrl: string } | null>;

export type SourceCoverageState = "healthy" | "warning" | "error";

export interface SourceSelectionValidation {
  coverageState: SourceCoverageState;
  isBelowRequired: boolean;
  missingToProceed: string;
  missingToSafety: string;
}
