import type { Address } from "viem";

export type NexusOneMode = "swap" | "send" | "deposit";

/** Exact In: user specifies the "from" amount. Exact Out: user specifies the "to" amount. */
export type SwapType = "exactIn" | "exactOut";

export type DepositExecuteConfig = {
  to: Address;
  value?: bigint;
  data?: `0x${string}`;
  gas?: bigint;
  gasPrice?: "low" | "medium" | "high";
  tokenApproval?: {
    toTokenAddress: Address;
    amount: bigint;
    spender: Address;
  };
};

export interface NexusOneDepositConfig {
  apy?: string;
  chainId: number;
  depositTargetLogo?: string;
  description?: string;
  estimatedTime?: string;
  executeDeposit: (
    tokenSymbol: string,
    tokenAddress: Address,
    amount: bigint,
    chainId: number,
    user: Address
  ) => DepositExecuteConfig;
  explorerUrl?: string;
  gasTokenSymbol?: string;
  label?: string;
  logo?: string;

  /** Optional labels used by Nexus One history/progress copy. */
  protocol?: string;
  subtitle?: string;
  title?: string;
  tokenAddress: Address;
  tokenDecimals: number;
  tokenLogo?: string;
  tokenSymbol: string;
}

export type NexusOneDepositMetadata = Omit<
  NexusOneDepositConfig,
  "executeDeposit"
>;

export interface NexusOnePrefill {
  amount?: string;
  chain?: number;
  destination?: {
    token: Address;
    chain: number;
  };
  recipient?: Address;
  source?: {
    token: Address;
    chain: number;
  };
  token?: Address;
}

export interface NexusOneConfig {
  allowedDestinationPairs?: {
    token: Address;
    chain: number;
  }[];
  allowedSourcePairs?: {
    token: Address;
    chain: number;
  }[];
  /** Required for deposit mode. Describes the single destination and app call. */
  deposit?: NexusOneDepositConfig;
  mode: NexusOneMode;
  onConnectWalletClick?: () => void | Promise<void>;
  prefill?: NexusOnePrefill;
}

export interface NexusOneProps {
  className?: string;
  config: NexusOneConfig;
  connectedAddress?: Address;
  defaultOpen?: boolean;
  embed?: boolean;
  onClose?: () => void;
  onComplete?: (explorerUrl?: string) => void;
  onConnectWallet?: () => void | Promise<void>;
  onError?: (message: string) => void;
  onOpenChange?: (open: boolean) => void;
  onReceiveAssetChange?: (asset: any) => void;
  onStart?: () => void;
  open?: boolean;
}
