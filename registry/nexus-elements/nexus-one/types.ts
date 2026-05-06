import { type Address } from "viem";
import { type SUPPORTED_CHAINS_IDS, type SUPPORTED_TOKENS } from "@avail-project/nexus-core";

export type NexusOneMode = "swap" | "send" | "deposit";

/** Exact In: user specifies the "from" amount. Exact Out: user specifies the "to" amount. */
export type SwapType = "exactIn" | "exactOut";

/**
 * A single DeFi yield/deposit opportunity that can be listed in the deposit widget.
 * Devs pass an array of these so users can pick which protocol to deposit into.
 */
export interface DepositOpportunity {
  id: string;
  /** Display label, e.g. "Aave USDC on Polygon" */
  label?: string;
  /** Protocol name, e.g. "Aave" */
  protocol: string;
  /** Optional URL to a protocol/token logo */
  logo?: string;
  /** New title for UI (e.g. "Aave") */
  title?: string;
  /** New subtitle for UI (e.g. "Deposit USDC on Arbitrum") */
  subtitle?: string;
  chainId: number;
  tokenSymbol: string;
  /** Optional custom token logo provided by developer */
  tokenLogo?: string;
  tokenAddress: Address;
  /** Optional APY string shown in the card, e.g. "4.2%" */
  apy?: string;
  /** Short description shown in the card */
  description?: string;
  /** Parameters for sdk.swapAndExecute */
  execute?: 
    | {
        to: `0x${string}`;
        data?: `0x${string}`;
        value?: bigint;
        gas: bigint;
        gasPrice?: 'low' | 'medium' | 'high';
        tokenApproval?: {
          token: `0x${string}`;
          amount: bigint;
          spender: `0x${string}`;
        };
      }
    | ((amount: bigint, connectedAddress: `0x${string}`) => {
        to: `0x${string}`;
        data?: `0x${string}`;
        value?: bigint;
        gas: bigint;
        gasPrice?: 'low' | 'medium' | 'high';
        tokenApproval?: {
          token: `0x${string}`;
          amount: bigint;
          spender: `0x${string}`;
        };
      });
}

export interface NexusOnePrefill {
  token?: Address;
  chain?: number;
  amount?: string;
  recipient?: Address;
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
  /** For deposit mode: list of DeFi opportunities the user can pick from */
  opportunities?: DepositOpportunity[];
}

export interface NexusOneProps {
  config: NexusOneConfig;
  connectedAddress?: Address;
  onComplete?: (explorerUrl?: string) => void;
  onStart?: () => void;
  onError?: (message: string) => void;
}

