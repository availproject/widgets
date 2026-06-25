import type { Address } from "viem";

export type NexusWidgetMode = "swap" | "send" | "deposit" | "fastBridge";
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

  /** Optional labels used by Nexus Widget history/progress copy. */
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

export interface NexusWidgetDestinationToken {
  contractAddress: Address;
  decimals: number;
  logo?: string;
  name?: string;
  tokenSymbol: string;
}

export interface NexusWidgetSmartContractDestination {
  abi?: unknown;
  args?: readonly unknown[];
  arguments?: readonly unknown[];
  chainId: number;
  contractAddress: Address;
  executeDeposit?: NexusOneDepositConfig["executeDeposit"];
  functionArgs?: readonly unknown[];
  functionName?: string;
  gasLimit?: bigint | number | string;
  protocol?: string;
  title?: string;
  type: "smartContract" | "smart-contract" | "contract";
  tokens: NexusWidgetDestinationToken[];
}

export interface NexusWidgetWalletDestination {
  chainId?: number;
  recipient?: Address;
  tokens?: NexusWidgetDestinationToken[];
  type: "wallet" | "eoa" | "EOA";
}

export type NexusWidgetDestination =
  | NexusWidgetSmartContractDestination
  | NexusWidgetWalletDestination;

export interface NexusWidgetAmountInput {
  fixedAmount?: string | number;
  max?: string | number;
  min?: string | number;
  mode?: "user" | "userSpecified" | "fixed";
  type?: "user" | "userSpecified" | "fixed";
  value?: string | number;
}

export interface NexusWidgetAppearance {
  appName?: string;
  logoUrl?: string;
  primaryColor?: string;
  themeMode?: "auto" | "light" | "dark";
  widgetHeading?: string;
}

export interface NexusWidgetConfig {
  allowedDestinationChains?: number[];
  allowedDestinationPairs?: {
    token: Address;
    chain: number;
  }[];
  allowedSourcePairs?: {
    token: Address;
    chain: number;
  }[];
  amount?: NexusWidgetAmountInput;
  appearance?: NexusWidgetAppearance;
  /** Required for deposit mode. Describes the single destination and app call. */
  deposit?: NexusOneDepositConfig;
  /** Multiple configured deposit destinations. Used by NexusWidget configurator output. */
  deposits?: NexusOneDepositConfig[];
  /** Configurator destination. Smart contracts render deposit mode; EOA wallets render send mode. */
  destination?: NexusWidgetDestination;
  mode: NexusWidgetMode;
  onConnectWalletClick?: () => void | Promise<void>;
  prefill?: NexusOnePrefill;
}

export type NexusOneConfig = NexusWidgetConfig;

export interface NexusWidgetProps {
  className?: string;
  config: NexusWidgetConfig;
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

export type NexusOneProps = NexusWidgetProps;
