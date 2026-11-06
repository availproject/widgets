import type {
  BeforeExecuteContext,
  SwapAndExecuteParams,
} from "@avail-project/nexus-core";
import type { DepositExecuteConfig } from "../types";

export function buildExactInputDeposit({
  sources,
  toChainId,
  toTokenAddress,
  buildExecute,
}: {
  sources: { chainId: number; tokenAddress: `0x${string}`; amountRaw: bigint }[];
  toChainId: number;
  toTokenAddress: `0x${string}`;
  buildExecute: (amountRaw: bigint) => DepositExecuteConfig;
}) {
  if (!sources.length || sources.some((source) => source.amountRaw <= BigInt(0))) {
    throw new Error("Every deposit source must have a positive raw amount.");
  }
  // Resolve target, value and gas for planning. The SDK calls beforeExecute
  // after funding to replace amount-sensitive calldata and value.
  const initialExecute = buildExecute(BigInt(0));
  return {
    input: {
      tradeType: "exactInput" as const,
      sources,
      toChainId,
      toTokenAddress,
      execute: {
        ...initialExecute,
        tokenApproval: initialExecute.tokenApproval
          ? {
              ...initialExecute.tokenApproval,
              toTokenAddress:
                initialExecute.tokenApproval.toTokenAddress || toTokenAddress,
              // The SDK constructs approval for executeAmountRaw after funding.
              amount: BigInt(0),
            }
          : undefined,
      },
    } satisfies SwapAndExecuteParams,
    beforeExecute: createDepositBeforeExecute(buildExecute),
  };
}

/** Build amount-sensitive calldata only after the SDK has resolved funding. */
export function createDepositBeforeExecute(
  buildExecute: (amountRaw: bigint) => DepositExecuteConfig,
) {
  return async (context?: BeforeExecuteContext) => {
    // Older SDKs call this hook without context. Never turn that into a zero deposit.
    if (typeof context?.executeAmountRaw !== "bigint") {
      throw new Error(
        "The Nexus SDK did not provide the deposit execution amount. Use an SDK version supporting exact-input swapAndExecute.",
      );
    }
    if (context.executeAmountRaw <= BigInt(0)) {
      throw new Error("The deposit execution amount must be greater than zero.");
    }

    const execute = buildExecute(context.executeAmountRaw);
    if (typeof execute.gas !== "bigint" || execute.gas <= BigInt(0)) {
      throw new Error(
        "Deposit config executeDeposit must return a positive gas limit.",
      );
    }
    return {
      data: execute.data,
      value: execute.value,
      gas: execute.gas,
    };
  };
}
