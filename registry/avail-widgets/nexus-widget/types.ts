import type { Address } from "viem";

export type NexusWidgetMode = "swap" | "send" | "deposit";
export type NexusWidgetNumericString = string;
export type NexusWidgetUrlString = `http://${string}` | `https://${string}`;

/** Exact In: user specifies the "from" amount. Exact Out: user specifies the "to" amount. */
export type SwapType = "exactIn" | "exactOut";

export type DepositExecuteConfig = {
  to: Address;
  value?: bigint;
  data?: `0x${string}`;
  gas: bigint;
  tokenApproval?: {
    toTokenAddress: Address;
    amount: bigint;
    spender: Address;
  };
};

export interface NexusWidgetDepositOpportunityConfig {
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

export type NexusWidgetDepositOpportunityMetadata = Omit<
  NexusWidgetDepositOpportunityConfig,
  "executeDeposit"
>;

export interface NexusWidgetRuntimePrefill {
  amount?: string;
  chain?: number;
  destination?: {
    chain: number;
    decimals?: number;
    logo?: string;
    symbol?: string;
    token: Address;
  };
  recipient?: Address;
  source?: {
    chain: number;
    decimals?: number;
    logo?: string;
    symbol?: string;
    token: Address;
  };
  token?: Address;
}

export interface NexusWidgetDestinationToken {
  address: Address;
  decimals: number;
  logo?: NexusWidgetUrlString | string;
  symbol: string;
}

export interface NexusWidgetPrefillToken extends NexusWidgetDestinationToken {
  chain: number;
}

export type NexusWidgetDestinationTokenList = [
  NexusWidgetDestinationToken,
  ...NexusWidgetDestinationToken[],
];

export interface NexusWidgetConfiguredDestination {
  chain?: number;
  tokens?: NexusWidgetDestinationTokenList;
}

export interface NexusWidgetDepositDestination {
  chain: number;
  tokens: NexusWidgetDestinationTokenList;
}

export type NexusWidgetDestination =
  | NexusWidgetConfiguredDestination
  | NexusWidgetDepositDestination;

export interface NexusWidgetAmountPrefill {
  amount?: NexusWidgetNumericString;
}

export interface NexusWidgetTokenPrefill {
  token?: NexusWidgetPrefillToken;
}

export type NexusWidgetSendPrefill =
  NexusWidgetAmountPrefill & NexusWidgetTokenPrefill;

export type NexusWidgetSwapPrefill = NexusWidgetTokenPrefill;

export interface NexusWidgetValidation {
  maxAmount?: NexusWidgetNumericString;
  minAmount?: NexusWidgetNumericString;
}

export interface NexusWidgetAppearance {
  appName?: string;
  appLogoURL?: NexusWidgetUrlString | string;
  heading?: string;
  primaryColor?: string;
  mode?: "system" | "light" | "dark";
}

export interface NexusWidgetConfigBase {
  appearance?: NexusWidgetAppearance;
}

export interface NexusWidgetDepositConfig extends NexusWidgetConfigBase {
  depositAddress: Address;
  destination: NexusWidgetDepositDestination;
  executeDeposit: NexusWidgetDepositOpportunityConfig["executeDeposit"];
  mode: "deposit";
  prefill?: NexusWidgetAmountPrefill;
  validation?: NexusWidgetValidation;
}

export interface NexusWidgetSendConfig extends NexusWidgetConfigBase {
  destination?: NexusWidgetConfiguredDestination;
  mode: "send";
  prefill?: NexusWidgetSendPrefill;
  recipientAddress?: Address;
  validation?: NexusWidgetValidation;
}

export interface NexusWidgetSwapConfig extends NexusWidgetConfigBase {
  destination?: NexusWidgetConfiguredDestination;
  mode: "swap";
  prefill?: NexusWidgetSwapPrefill;
  recipientAddress?: Address;
}

export type NexusWidgetConfig =
  | NexusWidgetDepositConfig
  | NexusWidgetSendConfig
  | NexusWidgetSwapConfig;

export interface NexusWidgetProps {
  className?: string;
  config: NexusWidgetConfig;
  connectedAddress?: Address;
  defaultOpen?: boolean;
  embed?: boolean;
  onClose?: () => void;
  onComplete?: (explorerUrl?: string) => void;
  onConnectClick?: () => void | Promise<void>;
  onConnectWallet?: () => void | Promise<void>;
  onError?: (message: string) => void;
  onOpenChange?: (open: boolean) => void;
  onReceiveAssetChange?: (asset: any) => void;
  onStart?: () => void;
  open?: boolean;
}
