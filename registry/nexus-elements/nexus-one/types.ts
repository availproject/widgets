import { type Address } from "viem";
import {
  type ExecuteParams,
  type SUPPORTED_CHAINS_IDS,
} from "@avail-project/nexus-core";

export type NexusOneMode = "swap" | "send" | "deposit";

/** Exact In: user specifies the "from" amount. Exact Out: user specifies the "to" amount. */
export type SwapType = "exactIn" | "exactOut";

export type DepositExecuteConfig = Omit<ExecuteParams, "toChainId">;

export interface NexusOneDepositConfig {
  chainId: SUPPORTED_CHAINS_IDS;
  depositTargetLogo?: string;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenLogo?: string;
  label?: string;
  estimatedTime?: string;
  gasTokenSymbol?: string;
  explorerUrl?: string;
  executeDeposit: (
    tokenSymbol: string,
    tokenAddress: Address,
    amount: bigint,
    chainId: number,
    user: Address,
  ) => DepositExecuteConfig;

  /** Optional labels used by Nexus One history/progress copy. */
  protocol?: string;
  logo?: string;
  title?: string;
  subtitle?: string;
  apy?: string;
  description?: string;
}

export type NexusOneDepositMetadata = Omit<
  NexusOneDepositConfig,
  "executeDeposit"
>;

export interface NexusOnePrefill {
  token?: Address;
  chain?: number;
  amount?: string;
  recipient?: Address;
  source?: {
    token: Address;
    chain: number;
  };
  destination?: {
    token: Address;
    chain: number;
  };
}

export interface NexusOneConfig {
  mode: NexusOneMode;
  prefill?: NexusOnePrefill;
  allowedSourcePairs?: {
    token: Address;
    chain: number;
  }[];
  allowedDestinationPairs?: {
    token: Address;
    chain: number;
  }[];
  /** Required for deposit mode. Describes the single destination and app call. */
  deposit?: NexusOneDepositConfig;
}

export interface NexusOneProps {
  config: NexusOneConfig;
  embed?: boolean;
  className?: string;
  connectedAddress?: Address;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  onComplete?: (explorerUrl?: string) => void;
  onStart?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}
