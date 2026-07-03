import {
  type NexusNetwork,
  type NexusClient,
} from "@avail-project/nexus-core";
import { formatUnits } from "@avail-project/nexus-core/utils";
import { SUPPORTED_CHAINS } from "./constant";
import { type Address } from "viem";

const MAX_AMOUNT_REGEX = /^\d*\.?\d+$/;

export const MAX_AMOUNT_DEBOUNCE_MS = 300;

export const normalizeMaxAmount = (
  maxAmount?: string | number,
): string | undefined => {
  if (maxAmount === undefined || maxAmount === null) return undefined;
  const value = String(maxAmount).trim();
  if (!value || value === "." || !MAX_AMOUNT_REGEX.test(value)) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return value;
};

export const clampAmountToMax = ({
  amount,
  maxAmount,
  nexusSDK,
  token,
  chainId,
}: {
  amount: string;
  maxAmount?: string;
  nexusSDK: NexusClient;
  token: string;
  chainId: number;
}): string => {
  if (!maxAmount) return amount;
  try {
    const amountRaw = nexusSDK.convertTokenReadableAmountToBigInt(
      amount,
      token,
      chainId,
    );
    const maxRaw = nexusSDK.convertTokenReadableAmountToBigInt(
      maxAmount,
      token,
      chainId,
    );
    return amountRaw > maxRaw ? maxAmount : amount;
  } catch {
    return amount;
  }
};

export const formatAmountForDisplay = (
  amount: bigint,
  decimals: number | undefined,
  nexusSDK: NexusClient,
): string => {
  if (typeof decimals !== "number") return amount.toString();
  const formatted = formatUnits(amount, decimals);
  if (!formatted.includes(".")) return formatted;
  const [whole, fraction] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, 6).replace(/0+$/, "");
  if (!trimmedFraction && whole === "0" && amount > BigInt(0)) {
    return "0.000001";
  }
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
};

export const buildInitialInputs = ({
  type,
  network,
  connectedAddress,
  prefill,
}: {
  type: "bridge" | "transfer";
  network: NexusNetwork;
  connectedAddress?: Address;
  prefill?: {
    token: string;
    chainId: number;
    amount?: string;
    recipient?: Address;
  };
}) => {
  return {
    chain:
      prefill?.chainId ??
      (network === "testnet"
        ? SUPPORTED_CHAINS.SEPOLIA
        : SUPPORTED_CHAINS.ETHEREUM),
    token: prefill?.token ?? "USDC",
    amount: prefill?.amount ?? undefined,
    recipient:
      (prefill?.recipient as `0x${string}`) ??
      (type === "bridge" ? connectedAddress : undefined),
  };
};

export const getCoverageDecimals = ({
  type,
  token,
  chainId,
  fallback,
}: {
  type: "bridge" | "transfer";
  token?: string;
  chainId?: number;
  fallback: number | undefined;
}) => {
  if (token === "USDM") return 18;
  if (
    type === "bridge" &&
    token === "USDC" &&
    chainId === SUPPORTED_CHAINS.BNB
  ) {
    return 18;
  }
  return fallback;
};
