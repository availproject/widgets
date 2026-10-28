// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

"use client";

import Decimal from "decimal.js";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { parseAmount as parseDecimal } from "../utils/amount";
import type {
  BridgeStepType,
  SwapStepType,
} from "../../common/types/transaction-flow";
import { getShortChainName } from "../../common/utils/constant";
import {
  type NexusWidgetDepositOpportunityMetadata,
  type NexusWidgetMode,
} from "../types";
import { NEXUS_WIDGET_FAST_SPINNER_STYLE } from "../theme";
import { type SwapTokenOption } from "./swap-asset-selector";
import { type SwapIntentData } from "./swap-intent-preview";

type ProgressSdkStep = SwapStepType | BridgeStepType;

type ProgressStep = {
  id: number;
  completed: boolean;
  step: ProgressSdkStep;
};

export type NexusWidgetProgressEvent = {
  id: string;
  name: string;
  completed: boolean;
  event?: unknown;
  step?: ProgressSdkStep;
  steps?: ProgressSdkStep[];
};

interface NexusWidgetProgressScreenProps {
  failedStep?: ProgressSdkStep | null;
  fromAmountUsd?: string;
  fromTokens?: SwapTokenOption[];
  intentData?: SwapIntentData | null;
  isRejected?: boolean;
  mode: NexusWidgetMode;
  opportunity?: NexusWidgetDepositOpportunityMetadata;
  progressEvents?: NexusWidgetProgressEvent[];
  recipientAddress?: string;
  steps?: ProgressStep[];
  toAmount?: string;
  toAmountUsd?: string;
  toToken?: SwapTokenOption;
  totalFeeUsd?: string;
}

const fontFamily = '"Geist", var(--font-geist-sans), system-ui, sans-serif';
const primary = "var(--nexus-widget-text-strong, #161615)";
const muted = "var(--nexus-widget-text-secondary, #848483)";
const border = "var(--nexus-widget-border, #E8E8E7)";
const brand = "var(--foreground-brand)";
const danger = "var(--nexus-widget-error-text, #E92C2C)";

const formatDecimal = (value: unknown, decimals = 2) =>
  (parseDecimal(value) ?? new Decimal(0)).toDecimalPlaces(decimals).toFixed();

const formatUsd = (value: unknown) => `$${formatDecimal(value, 2)}`;

const unique = (values: Array<string | undefined>) =>
  Array.from(new Set(values.filter(Boolean) as string[]));

const formatSymbolSummary = (symbols: string[]) => {
  if (symbols.length <= 2) return symbols.join(", ");
  return `${symbols.slice(0, 2).join(", ")} and ${symbols.length - 2} others`;
};

const getStepType = (step?: ProgressSdkStep) =>
  String((step as any)?.type ?? (step as any)?.typeID ?? "").toUpperCase();

type ProgressStatusId =
  | "approveTokens"
  | "intentVerified"
  | "swapTokens"
  | "receiveToken"
  | "action";

type ProgressStatusState =
  | "default"
  | "preapproval"
  | "inProgress"
  | "completed"
  | "error";

type ProgressStatusRow = {
  id: ProgressStatusId;
  label: string;
  description?: string;
  state: ProgressStatusState;
};

const PROGRESS_EVENT_NAMES = {
  BRIDGE_PLAN_LIST: "bridge_plan_list",
  BRIDGE_PLAN_PROGRESS: "bridge_plan_progress",
  SWAP_PLAN_LIST: "swap_plan_list",
  SWAP_PLAN_PROGRESS: "swap_plan_progress",
} as const;

type ProgressListEventName =
  | typeof PROGRESS_EVENT_NAMES.BRIDGE_PLAN_LIST
  | typeof PROGRESS_EVENT_NAMES.SWAP_PLAN_LIST;

const STATUS_ORDER: ProgressStatusId[] = [
  "approveTokens",
  "intentVerified",
  "swapTokens",
  "receiveToken",
  "action",
];

const SWAP_APPROVAL_TYPES = [
  "ALLOWANCE",
  "ALLOWANCE_APPROVAL",
  "ERC20_APPROVAL",
  "TOKEN_APPROVAL",
  "SOURCE_APPROVAL_SIGNATURE",
];

const isActionApprovalStep = (step?: ProgressSdkStep) => {
  const stepId = String((step as any)?.id ?? (step as any)?.typeID ?? "").toLowerCase();
  return (
    stepId.includes("execute") ||
    stepId.includes("action") ||
    stepId === "execute_approval"
  );
};

const isSwapApprovalStep = (step?: ProgressSdkStep) => {
  if (!step) return false;
  if (isActionApprovalStep(step)) return false;
  const type = getStepType(step);
  return (
    SWAP_APPROVAL_TYPES.some((token) => type.includes(token)) ||
    type === "APPROVAL"
  );
};

const isGenericApprovalId = (id: string) => {
  const upper = String(id || "").trim().toUpperCase();
  return (
    upper === "" ||
    upper === "APPROVAL" ||
    upper === "ALLOWANCE" ||
    upper === "ALLOWANCE_APPROVAL" ||
    upper === "ERC20_APPROVAL" ||
    upper === "TOKEN_APPROVAL" ||
    upper === "SOURCE_APPROVAL_SIGNATURE" ||
    SWAP_APPROVAL_TYPES.includes(upper)
  );
};

const REFUND_ELIGIBLE_SWAP_TYPES = [
  "BRIDGE_INTENT_SUBMISSION",
  "BRIDGE_DEPOSIT",
  "INTENT_SUBMISSION",
];

const DESTINATION_SWAP_TYPES = [
  "DESTINATION_SWAP",
  "DESTINATION_SWAP_BATCH_TX",
  "DESTINATION_SWAP_HASH",
  "INTENT_FULFILLMENT",
];
const BRIDGE_FILL_RECEIVE_TYPES = ["BRIDGE_FILL", "INTENT_FULFILLMENT"];

const getStatusForStep = (
  step: ProgressSdkStep | undefined,
  mode: NexusWidgetMode,
  hasTransferAction = false,
): ProgressStatusId | null => {
  const type = getStepType(step);

  if (
    type === "TRANSACTION_SENT" ||
    type === "TRANSACTION_CONFIRMED" ||
    (type === "APPROVAL" && isActionApprovalStep(step))
  ) {
    return mode === "swap" && !hasTransferAction ? null : "action";
  }

  if (isSwapApprovalStep(step)) {
    return "approveTokens";
  }

  if (
    type.includes("INTENT_SIGNATURE") ||
    type.includes("REQUEST_SIGNING")
  ) {
    return "intentVerified";
  }

  if (type.includes("SWAP_START")) {
    return "swapTokens";
  }

  if (
    type.includes("EOA_TO_EPHEMERAL_TRANSFER") ||
    type.includes("SOURCE_SWAP") ||
    type.includes("SOURCE_BATCH") ||
    type.includes("SWAP_SOURCE") ||
    type.includes("BRIDGE_DEPOSIT") ||
    type.includes("BRIDGE_FILL") ||
    type.includes("BRIDGE_INTENT_SUBMISSION") ||
    type.includes("INTENT_SUBMISSION") ||
    type.includes("NATIVE_TRANSACTION") ||
    type.includes("SWAP_COMPLETE") ||
    type.includes("SWAP_SKIPPED")
  ) {
    return "swapTokens";
  }

  if (
    type.includes("DESTINATION_SWAP") ||
    type.includes("DESTINATION_BATCH") ||
    type.includes("INTENT_FULFILLMENT")
  ) {
    return "receiveToken";
  }

  return null;
};

const stepMatches = (step: ProgressSdkStep | undefined, tokens: string[]) => {
  const type = getStepType(step);
  return tokens.some((token) => type.includes(token));
};

const hasCompletedType = (
  events: NexusWidgetProgressEvent[],
  steps: ProgressStep[],
  tokens: string[],
) => {
  const completedEvent = events.some(
    (event) => event.completed && stepMatches(event.step, tokens),
  );
  if (completedEvent) return true;

  return steps.some((item) => item.completed && stepMatches(item.step, tokens));
};

const hasStepType = (
  events: NexusWidgetProgressEvent[],
  steps: ProgressStep[],
  tokens: string[],
) =>
  events.some(
    (event) =>
      stepMatches(event.step, tokens) ||
      (event.steps ?? []).some((step) => stepMatches(step, tokens)),
  ) || steps.some((item) => stepMatches(item.step, tokens));

const hasEventType = (events: NexusWidgetProgressEvent[], tokens: string[]) =>
  events.some(
    (event) =>
      stepMatches(event.step, tokens) ||
      (event.steps ?? []).some((step) => stepMatches(step, tokens)),
  );

const hasProgressEventType = (
  events: NexusWidgetProgressEvent[],
  tokens: string[],
) =>
  events.some(
    (event) =>
      (event.name === PROGRESS_EVENT_NAMES.BRIDGE_PLAN_PROGRESS ||
        event.name === PROGRESS_EVENT_NAMES.SWAP_PLAN_PROGRESS) &&
      stepMatches(event.step, tokens),
  );

const getListedSteps = (
  events: NexusWidgetProgressEvent[],
  eventName: ProgressListEventName,
) => {
  const listEvent = [...events]
    .reverse()
    .find(
      (event) => event.name === eventName && event.steps !== undefined,
    );
  return listEvent?.steps ?? [];
};

const countListedSteps = (steps: ProgressSdkStep[], tokens: string[]) =>
  steps.filter((step) => stepMatches(step, tokens)).length;

const getStepId = (step?: ProgressSdkStep) => step?.id ?? step?.typeID;
const getStepChainId = (step?: ProgressSdkStep) => step?.chain?.id ?? step?.chainId;
const isSameStep = (left?: ProgressSdkStep, right?: ProgressSdkStep) => {
  if (!left || !right) return false;
  const leftType = getStepType(left);
  const rightType = getStepType(right);
  if (leftType !== rightType) return false;

  const leftChain = getStepChainId(left);
  const rightChain = getStepChainId(right);
  if (leftChain !== undefined && rightChain !== undefined && leftChain !== rightChain) {
    return false;
  }

  const leftToken = getStepTokenAddress(left);
  const rightToken = getStepTokenAddress(right);
  if (leftToken !== "" && rightToken !== "" && leftToken !== rightToken) {
    return false;
  }

  const leftId = left.id ? String(left.id) : "";
  const rightId = right.id ? String(right.id) : "";
  const isGenericLeftId = isGenericApprovalId(leftId);
  const isGenericRightId = isGenericApprovalId(rightId);

  if (!isGenericLeftId && !isGenericRightId && leftId === rightId) {
    return true;
  }

  const leftKey = getStepId(left);
  const rightKey = getStepId(right);
  return Boolean(leftKey && leftKey === rightKey);
};
const getEventState = (event: NexusWidgetProgressEvent) =>
  String((event.event as { state?: string } | undefined)?.state ?? "").toLowerCase();

const getStepTokenAddress = (step?: ProgressSdkStep): string => {
  if (!step) return "";
  const raw =
    (step as any).tokenAddress ??
    step.token?.contractAddress ??
    (step.token as any)?.address ??
    (step as any).asset?.contractAddress ??
    (step as any).asset?.address ??
    "";
  return String(raw).toLowerCase();
};

export type BuildStatusRowsContext = {
  destinationChain?: string;
  destinationSymbol?: string;
  opportunityName?: string;
  recipientAddress?: string;
  fromTokens?: Array<{
    chainId?: number;
    contractAddress?: string;
    symbol?: string;
  }>;
  intentSources?: Array<{
    chain?: { id?: number };
    token?: { contractAddress?: string; symbol?: string };
  }>;
  opportunity?: {
    chainId?: number;
    tokenAddress?: string;
    tokenSymbol?: string;
  };
  toToken?: {
    chainId?: number;
    contractAddress?: string;
    symbol?: string;
  };
};

const getStepTokenSymbol = (
  step?: ProgressSdkStep,
  context?: BuildStatusRowsContext,
): string => {
  if (!step) return "";
  const directSymbol =
    (step as any).tokenSymbol ??
    step.token?.symbol ??
    (step as any).symbol;
  if (directSymbol && typeof directSymbol === "string" && directSymbol.trim() !== "") {
    return directSymbol.trim();
  }
  const tokenAddress = getStepTokenAddress(step);
  const chainId = getStepChainId(step);

  if (tokenAddress) {
    const fromMatch = context?.fromTokens?.find(
      (t) =>
        (chainId === undefined || t.chainId === undefined || t.chainId === chainId) &&
        String(t.contractAddress || "").toLowerCase() === tokenAddress,
    );
    if (fromMatch?.symbol) return fromMatch.symbol;

    const sourceMatch = context?.intentSources?.find(
      (s) =>
        (chainId === undefined || s.chain?.id === undefined || s.chain.id === chainId) &&
        String(s.token?.contractAddress || "").toLowerCase() === tokenAddress,
    );
    if (sourceMatch?.token?.symbol) return sourceMatch.token.symbol;

    if (
      (chainId === undefined || context?.toToken?.chainId === undefined || context.toToken.chainId === chainId) &&
      String(context?.toToken?.contractAddress || "").toLowerCase() === tokenAddress
    ) {
      if (context?.toToken?.symbol) return context.toToken.symbol;
    }

    if (
      (chainId === undefined || context?.opportunity?.chainId === undefined || context.opportunity.chainId === chainId) &&
      String(context?.opportunity?.tokenAddress || "").toLowerCase() === tokenAddress
    ) {
      if (context?.opportunity?.tokenSymbol) return context.opportunity.tokenSymbol;
    }
  }

  if (context?.fromTokens && context.fromTokens.length === 1 && context.fromTokens[0]?.symbol) {
    return context.fromTokens[0].symbol;
  }
  if (context?.intentSources && context.intentSources.length === 1 && context.intentSources[0]?.token?.symbol) {
    return context.intentSources[0].token.symbol;
  }

  return "";
};

/** Allowances have no standalone swap progress events. The SDK reports them
 * through the associated swap/transfer/deposit on the same chain. */
const getApprovalProgress = (
  plan: ProgressSdkStep[],
  events: NexusWidgetProgressEvent[],
  steps: ProgressStep[],
  failedStep?: ProgressSdkStep | null,
  context?: BuildStatusRowsContext,
) => {
  const seen = new Set<string>();
  const approvals = plan.flatMap((step, index) => {
    if (!isSwapApprovalStep(step)) return [];
    const stepId = step.id ? String(step.id) : "";
    const isGenericId = isGenericApprovalId(stepId);
    const key = isGenericId
      ? `${getStepType(step)}:${getStepChainId(step) ?? ""}:${getStepTokenAddress(step)}:${index}`
      : `${stepId}:${getStepChainId(step) ?? ""}:${getStepTokenAddress(step)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const tokenAddress = getStepTokenAddress(step);
    const chainId = getStepChainId(step);
    const tokenSymbol = getStepTokenSymbol(step, context);
    const owners = plan.slice(index + 1).filter((candidate) =>
      getStepChainId(candidate) === chainId &&
      ["SOURCE_SWAP", "DESTINATION_SWAP", "EOA_TO_EPHEMERAL_TRANSFER", "BRIDGE_DEPOSIT"]
        .includes(getStepType(candidate)),
    );
    const owner = getStepType(step) === "ALLOWANCE_APPROVAL" ? step :
      owners.find((candidate) => {
        const inputs = candidate.swaps?.map((swap: any) => swap.input) ?? [candidate.asset];
        return inputs.some((input: any) => tokenAddress &&
          String(input?.contractAddress ?? "").toLowerCase() === tokenAddress);
      }) ?? owners[0];
    const ownerEvents = owner ? events.filter((event) =>
      !event.steps && isSameStep(event.step, owner),
    ) : [];
    const directEvents = events.filter((event) =>
      !event.steps && (
        isSameStep(event.step, step) ||
        (tokenAddress !== "" && chainId !== undefined &&
         getStepChainId(event.step) === chainId &&
         getStepTokenAddress(event.step) === tokenAddress &&
         isSwapApprovalStep(event.step))
      ),
    );
    const directCompleted =
      steps.some((item) => item.completed && (
        isSameStep(item.step, step) ||
        (tokenAddress !== "" && chainId !== undefined &&
         getStepChainId(item.step) === chainId &&
         getStepTokenAddress(item.step) === tokenAddress &&
         isSwapApprovalStep(item.step))
      )) ||
      directEvents.some((event) =>
        event.completed ||
        ["confirmed", "completed"].includes(getEventState(event)) ||
        (getEventState(event) === "submitted" && getStepType(step) !== "ALLOWANCE_APPROVAL")
      );
    const ownerCompleted = Boolean(
      owner && owner !== step && (
        steps.some((item) => item.completed && isSameStep(item.step, owner)) ||
        ownerEvents.some((event) =>
          event.completed ||
          ["confirmed", "completed"].includes(getEventState(event)) ||
          (getEventState(event) === "submitted" && getStepType(owner) !== "ALLOWANCE_APPROVAL") ||
          (getEventState(event) === "started" && ["SOURCE_SWAP", "DESTINATION_SWAP"].includes(getStepType(owner)))
        ) ||
        (getStepType(owner) === "EOA_TO_EPHEMERAL_TRANSFER" && events.some((event) =>
          !event.steps && getStepType(event.step) === "BRIDGE_DEPOSIT" &&
          getStepChainId(event.step) === getStepChainId(owner) &&
          (event.completed || ["submitted", "confirmed"].includes(getEventState(event)))
        ))
      )
    );
    const completed = directCompleted || ownerCompleted;
    const failed = !completed && (
      isSameStep(failedStep ?? undefined, step) ||
      (owner && isSameStep(failedStep ?? undefined, owner)) ||
      ownerEvents.some((event) => getEventState(event) === "failed") ||
      directEvents.some((event) => getEventState(event) === "failed")
    );
    return [{ step, owner, tokenAddress, chainId, tokenSymbol, completed, failed }];
  });

  // Infer completion if later approval progressed or subsequent steps started
  for (let i = 0; i < approvals.length; i++) {
    if (!approvals[i].completed) {
      const laterApprovalActiveOrDone = approvals.slice(i + 1).some((later) =>
        later.completed ||
        events.some((event) =>
          !event.steps &&
          (isSameStep(event.step, later.step) ||
           (later.tokenAddress && getStepTokenAddress(event.step) === later.tokenAddress && getStepChainId(event.step) === later.chainId)) &&
          ["wallet_prompted", "started", "submitted", "confirmed", "completed"].includes(getEventState(event))
        )
      );
      if (laterApprovalActiveOrDone) {
        approvals[i].completed = true;
      }
    }
  }

  const allSourceApprovalsCompleted =
    hasCompletedType(events, steps, [
      "INTENT_FULFILLMENT",
      "TRANSACTION_SENT",
      "TRANSACTION_CONFIRMED",
    ]) ||
    events.some((event) =>
      !event.steps &&
      stepMatches(event.step, ["INTENT_FULFILLMENT", "TRANSACTION_SENT", "TRANSACTION_CONFIRMED"]) &&
      (event.completed || ["confirmed", "completed"].includes(getEventState(event)))
    );

  if (allSourceApprovalsCompleted) {
    for (const app of approvals) {
      if (getStepType(app.owner) !== "DESTINATION_SWAP") {
        app.completed = true;
      }
    }
  }

  const pending = approvals.filter((approval) => !approval.completed);
  const activeEvent = [...events].reverse().find((event) =>
    !event.steps && getEventState(event) === "wallet_prompted" &&
    pending.some((approval) =>
      isSameStep(approval.step, event.step) ||
      (approval.owner && isSameStep(approval.owner, event.step)) ||
      (approval.tokenAddress && getStepTokenAddress(event.step) === approval.tokenAddress && getStepChainId(event.step) === approval.chainId)
    ),
  );
  const activeApproval = (activeEvent && pending.find((approval) =>
    isSameStep(approval.step, activeEvent.step) ||
    (approval.owner && isSameStep(approval.owner, activeEvent.step)) ||
    (approval.tokenAddress && getStepTokenAddress(activeEvent.step) === approval.tokenAddress && getStepChainId(activeEvent.step) === approval.chainId)
  )) ?? pending[0];
  const active = activeApproval ? [activeApproval] : [];
  const isCompleted = (step: ProgressSdkStep) =>
    steps.some((item) => item.completed && isSameStep(item.step, step)) ||
    events.some((event) => !event.steps && event.completed && isSameStep(event.step, step));
  const activeOwner = activeApproval?.owner ?? activeApproval?.step;
  const prerequisites = getStepType(activeOwner) === "DESTINATION_SWAP"
    ? plan.filter((step) => getStepType(step) === "BRIDGE_FILL")
    : ["EOA_TO_EPHEMERAL_TRANSFER", "BRIDGE_DEPOSIT"].includes(getStepType(activeOwner))
      ? plan.filter((step) => getStepType(step) === "SOURCE_SWAP")
      : [];
  return {
    total: approvals.length,
    completed: approvals.filter((approval) => approval.completed).length,
    failed: approvals.some((approval) => approval.failed),
    symbols: unique(active.map((approval) => approval.tokenSymbol).filter(Boolean) as string[]),
    permitsOnly: active.length > 0 && active.every((approval) => approval.step.method === "permit"),
    pendingOwnerIds: new Set(pending.map((approval) => getStepId(approval.owner ?? approval.step))),
    awaitingWallet: Boolean(activeEvent) || prerequisites.every(isCompleted),
    blocksSwapExecution: pending.some((approval) => getStepType(approval.owner) !== "DESTINATION_SWAP"),
  };
};

const hasStartedStatus = (
  events: NexusWidgetProgressEvent[],
  id: ProgressStatusId,
  mode: NexusWidgetMode,
  hasTransferAction = false,
) =>
  events.some(
    (event) => getStatusForStep(event.step, mode, hasTransferAction) === id,
  );

export const buildStatusRows = ({
  events,
  failedStep,
  mode,
  steps,
  context,
  isRejected: isRejectedProp,
}: {
  events: NexusWidgetProgressEvent[];
  failedStep?: ProgressSdkStep | null;
  mode: NexusWidgetMode;
  steps: ProgressStep[];
  context: BuildStatusRowsContext;
  isRejected?: boolean;
}): ProgressStatusRow[] => {
  const isRejected = Boolean(isRejectedProp || (failedStep as any)?.isRejected);
  const hasTransferAction =
    mode === "send" || (mode === "swap" && Boolean(context.recipientAddress));
  let failedStatus = failedStep
    ? getStatusForStep(failedStep, mode, hasTransferAction)
    : null;
  const bridgeListSteps = getListedSteps(
    events,
    PROGRESS_EVENT_NAMES.BRIDGE_PLAN_LIST,
  );
  const swapListSteps = getListedSteps(
    events,
    PROGRESS_EVENT_NAMES.SWAP_PLAN_LIST,
  );
  const planListSteps = swapListSteps.length > 0 ? swapListSteps : bridgeListSteps;
  const fallbackSteps = steps.map((item) => item.step);
  const currentPlan =
    planListSteps.length > 0
      ? planListSteps
      : events.some(
            (event) =>
              (event.name === PROGRESS_EVENT_NAMES.SWAP_PLAN_LIST ||
                event.name === PROGRESS_EVENT_NAMES.BRIDGE_PLAN_LIST) &&
              event.steps !== undefined,
          )
        ? planListSteps
        : fallbackSteps;
  const destinationSymbol = context.destinationSymbol || "token";
  const destinationChain = context.destinationChain || "destination";
  const opportunityName = context.opportunityName || "app";
  // The latest confirmed plan replaces provisional allowances; never freeze a preview count.
  const approval = getApprovalProgress(
    currentPlan,
    events,
    steps,
    failedStep,
    context,
  );
  const approvalTotal = approval.total;
  const approvalCompletedCount = approval.completed;
  if (approval.failed) failedStatus = "approveTokens";
  const refundEligibleFailure = Boolean(failedStep &&
    stepMatches(failedStep, REFUND_ELIGIBLE_SWAP_TYPES));
  const isExplicitSourceOnlyPlan =
    currentPlan.length > 0 &&
    currentPlan.every((step) => {
      const type = getStepType(step);
      return (
        type.includes("SOURCE_SWAP") ||
        type.includes("ALLOWANCE") ||
        type === "TRANSACTION_SENT" ||
        type === "TRANSACTION_CONFIRMED"
      );
    });
  const hasDestinationReceiveStep =
    countListedSteps(swapListSteps, DESTINATION_SWAP_TYPES) > 0 ||
    countListedSteps(fallbackSteps, DESTINATION_SWAP_TYPES) > 0 ||
    hasProgressEventType(events, DESTINATION_SWAP_TYPES);
  const receiveTokenTypes = hasDestinationReceiveStep
    ? DESTINATION_SWAP_TYPES
    : BRIDGE_FILL_RECEIVE_TYPES;
  const hasReceiveTokenStep =
    !isExplicitSourceOnlyPlan &&
    (hasDestinationReceiveStep ||
      countListedSteps(swapListSteps, receiveTokenTypes) > 0 ||
      countListedSteps(fallbackSteps, receiveTokenTypes) > 0 ||
      hasProgressEventType(events, receiveTokenTypes) ||
      currentPlan.length === 0);
  const receiveTokenStarted = events.some((event) =>
    !event.steps && stepMatches(event.step, receiveTokenTypes) &&
    !approval.pendingOwnerIds.has(getStepId(event.step)),
  );
  const receiveTokenComplete =
    hasReceiveTokenStep && hasCompletedType(events, steps, receiveTokenTypes);
  const swapComplete = hasCompletedType(events, steps, [
    "SWAP_COMPLETE",
    "SWAP_SKIPPED",
  ]);
  const swapSkipped = hasCompletedType(events, steps, ["SWAP_SKIPPED"]);
  const shouldShowSwapRows =
    !(swapSkipped && (mode === "deposit" || mode === "send"));
  const swapExecutionSteps = currentPlan.filter((step) =>
    getStatusForStep(step, mode, hasTransferAction) === "swapTokens",
  );
  const swapExecutionComplete = swapExecutionSteps.length > 0 && swapExecutionSteps.every((step) =>
    steps.some((item) => item.completed && isSameStep(item.step, step)) ||
    events.some((event) => !event.steps && event.completed && isSameStep(event.step, step)),
  );
  const swapTokensComplete = hasReceiveTokenStep
    ? receiveTokenStarted || receiveTokenComplete || swapExecutionComplete
    : swapComplete || swapExecutionComplete;
  const transactionSent = hasCompletedType(events, steps, ["TRANSACTION_SENT"]) ||
    events.some((event) => !event.steps && getStepType(event.step) === "TRANSACTION_SENT" &&
      getEventState(event) === "submitted");
  const transactionConfirmed = hasCompletedType(events, steps, [
    "TRANSACTION_CONFIRMED",
  ]);

  const intentVerifiedComplete =
    hasCompletedType(events, steps, [
      "INTENT_SIGNATURE",
      "INTENT_SUBMISSION",
      "REQUEST_SIGNING",
      "REQUEST_SUBMISSION",
      "BRIDGE_INTENT_SUBMISSION",
      "SWAP_START",
      "DETERMINING_SWAP",
    ]) ||
    hasStartedStatus(events, "swapTokens", mode, hasTransferAction) ||
    hasStartedStatus(events, "receiveToken", mode, hasTransferAction) ||
    hasEventType(events, [
      "SOURCE_SWAP",
      "SOURCE_SWAP_BATCH_TX",
      "SOURCE_SWAP_HASH",
      "BRIDGE_DEPOSIT",
      "NATIVE_TRANSACTION",
      "DESTINATION_SWAP",
      "DESTINATION_SWAP_BATCH_TX",
      "DESTINATION_SWAP_HASH",
      "BRIDGE_FILL",
      "INTENT_FULFILLMENT",
      "SWAP_COMPLETE",
    ]) ||
    swapTokensComplete ||
    receiveTokenComplete;

  let intentVerifiedState: ProgressStatusState = "default";
  if (failedStatus === "intentVerified") {
    intentVerifiedState = "error";
  } else if (intentVerifiedComplete) {
    intentVerifiedState = "completed";
  } else if (approvalCompletedCount >= approvalTotal) {
    intentVerifiedState = "preapproval";
  }

  const rows: ProgressStatusRow[] = [];

  const pushRow = (row: ProgressStatusRow) => {
    if (failedStatus) {
      const failedIndex = STATUS_ORDER.indexOf(failedStatus);
      const currentIndex = STATUS_ORDER.indexOf(row.id);
      if (failedIndex >= 0 && currentIndex > failedIndex) return;
    }
    rows.push(row);
  };

  if (approvalTotal > 0) {
    const approvalCurrent = Math.min(
      approvalTotal,
      Math.max(1, approvalCompletedCount + 1),
    );
    const symbols = formatSymbolSummary(approval.symbols);
    const approvalDescription = symbols
      ? `${approval.permitsOnly ? "Sign permit for" : "Approve"} ${symbols} in wallet`
      : "Approve in wallet";
    const state: ProgressStatusState = failedStatus === "approveTokens"
      ? "error"
      : approvalCompletedCount >= approvalTotal
        ? "completed"
        : approval.awaitingWallet ? "preapproval" : "default";

    pushRow({
      id: "approveTokens",
      state,
      description:
        state === "error" && isRejected
          ? "Rejected in wallet"
          : state === "preapproval"
            ? approvalDescription
            : undefined,
      label:
        state === "completed"
          ? `${mode === "deposit" ? "Tokens approved for deposit" : "Tokens approved for swap"} (${approvalTotal} of ${approvalTotal})`
          : state === "error"
            ? isRejected
              ? "Token approval rejected"
              : "Token approval failed"
            : `${mode === "deposit" ? "Approve tokens for deposit" : "Approve tokens for swap"} (${approvalCurrent} of ${approvalTotal})`,
    });
  }

  const hasIntentSignatureStep =
    countListedSteps(swapListSteps, ["INTENT_SIGNATURE", "REQUEST_SIGNING"]) > 0 ||
    countListedSteps(fallbackSteps, ["INTENT_SIGNATURE", "REQUEST_SIGNING"]) > 0 ||
    hasProgressEventType(events, ["INTENT_SIGNATURE", "REQUEST_SIGNING"]) ||
    hasEventType(events, ["INTENT_SIGNATURE", "REQUEST_SIGNING"]);

  if (shouldShowSwapRows) {
    if (hasIntentSignatureStep) {
      pushRow({
        id: "intentVerified",
        state: intentVerifiedState,
        description:
          intentVerifiedState === "error" && isRejected
            ? "Rejected in wallet"
            : intentVerifiedState === "preapproval"
              ? "Approve in wallet"
              : undefined,
        label:
          intentVerifiedState === "completed"
            ? "Intent approved"
            : intentVerifiedState === "error"
              ? isRejected
                ? "Intent approval rejected"
                : "Intent approval failed"
              : "Approve intent",
      });
    }

    const approvalsSatisfied = !approval.blocksSwapExecution;
    let state: ProgressStatusState = "default";
    if (failedStatus === "swapTokens") {
      state = "error";
    } else if (swapTokensComplete) {
      state = "completed";
    } else if (
      approvalsSatisfied &&
      (intentVerifiedComplete ||
        hasStartedStatus(events, "swapTokens", mode, hasTransferAction) ||
        hasEventType(events, [
          "DESTINATION_SWAP_BATCH_TX",
          "BRIDGE_DEPOSIT",
          "SOURCE_SWAP_BATCH_TX",
          "SOURCE_SWAP_HASH",
          "SWAP_START",
          "NATIVE_TRANSACTION",
          "INTENT_SUBMISSION",
        ]))
    ) {
      state = "inProgress";
    }

    pushRow({
      id: "swapTokens",
      state,
      description:
        state === "error" && isRejected ? "Rejected in wallet" : undefined,
      label:
        state === "completed"
          ? "Swaps completed"
          : state === "error"
            ? isRejected
              ? "Swap rejected"
              : refundEligibleFailure
                ? "Swap failed. Refund initiated"
                : "Swap failed"
            : state === "inProgress"
              ? "Swaps in progress"
              : "Swap tokens",
    });

    if (hasReceiveTokenStep) {
      pushRow({
        id: "receiveToken",
        state:
          failedStatus === "receiveToken"
            ? "error"
            : receiveTokenComplete
              ? "completed"
              : receiveTokenStarted || (swapTokensComplete && !receiveTokenComplete)
                ? "inProgress"
                : "default",
        description:
          failedStatus === "receiveToken" && isRejected
            ? "Rejected in wallet"
            : undefined,
        label:
          failedStatus === "receiveToken"
            ? isRejected
              ? "Destination swap rejected"
              : refundEligibleFailure
                ? "Destination swap failed. Refund initiated."
                : "Destination swap failed."
            : receiveTokenComplete
              ? `Received ${destinationSymbol} on ${destinationChain}`
              : receiveTokenStarted || (swapTokensComplete && !receiveTokenComplete)
                ? `Receiving ${destinationSymbol} on ${destinationChain}`
                : `Receive ${destinationSymbol} on ${destinationChain}`,
      });
    }
  }

  if (mode === "deposit" || hasTransferAction) {
    const receiveComplete =
      swapSkipped ||
      !shouldShowSwapRows ||
      (hasReceiveTokenStep ? receiveTokenComplete : swapTokensComplete);
    const isDeposit = mode === "deposit";
    let state: ProgressStatusState = "default";
    if (failedStatus === "action") {
      state = "error";
    } else if (transactionConfirmed) {
      state = "completed";
    } else if (transactionSent) {
      state = "inProgress";
    } else if (receiveComplete) {
      state = "preapproval";
    }

    pushRow({
      id: "action",
      state,
      description:
        state === "error" && isRejected
          ? "Rejected in wallet"
          : state === "preapproval"
            ? "Approve in wallet"
            : undefined,
      label: isDeposit
        ? state === "completed"
          ? `${destinationSymbol} deposited to ${opportunityName}`
          : state === "inProgress"
            ? `Depositing ${destinationSymbol} to ${opportunityName}`
            : state === "error"
              ? isRejected
                ? "Deposit cancelled by user"
                : "Deposit failed. Funds are in your wallet."
              : state === "preapproval"
                ? `Approve Deposit of ${destinationSymbol} to ${opportunityName}`
                : `Deposit ${destinationSymbol} to ${opportunityName}`
        : state === "completed"
          ? `${destinationSymbol} sent`
          : state === "inProgress"
            ? `Sending ${destinationSymbol}`
            : state === "error"
              ? isRejected
                ? "Send cancelled by user"
                : "Send failed. Funds are in your wallet."
              : state === "preapproval"
                ? `Approve ${destinationSymbol} transfer`
                : `Send ${destinationSymbol}`,
    });
  }

  const orderedRows = rows.sort(
    (a, b) => STATUS_ORDER.indexOf(a.id) - STATUS_ORDER.indexOf(b.id),
  );

  if (
    orderedRows.some(
      (row) => row.state === "preapproval" || row.state === "inProgress",
    ) ||
    orderedRows.some((row) => row.state === "error")
  ) {
    return orderedRows;
  }

  const nextActiveIndex = orderedRows.findIndex(
    (row) => row.state === "default",
  );
  if (nextActiveIndex === -1) return orderedRows;

  return orderedRows.map((row, index) => {
    if (index !== nextActiveIndex) return row;
    const nextState =
      row.id === "approveTokens" || row.id === "action" || row.id === "intentVerified"
        ? "preapproval"
        : "inProgress";
    return {
      ...row,
      description:
        nextState === "preapproval"
          ? row.id === "intentVerified"
            ? "Approve in wallet"
            : (row.description || "Approve in wallet")
          : undefined,
      label:
        row.id === "intentVerified" && nextState === "preapproval"
          ? "Approve intent"
          : row.id === "swapTokens"
            ? "Swaps in progress"
            : row.id === "receiveToken"
              ? `Receiving ${destinationSymbol} on ${destinationChain}`
              : row.label,
      state: nextState,
    };
  });
};

function MiniLogo({
  src,
  label,
  size,
  style,
}: {
  src?: string;
  label?: string;
  size: number;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(!src);

  useEffect(() => {
    setFailed(!src);
  }, [src]);

  if (!failed && src) {
    return (
      <img
        alt={label || ""}
        onError={() => setFailed(true)}
        src={src}
        style={{
          background: "var(--nexus-widget-surface, #FFFFFE)",
          borderRadius: "999px",
          height: size,
          objectFit: "cover",
          width: size,
          ...style,
        }}
      />
    );
  }

  return (
    <span
      style={{
        alignItems: "center",
        background: "var(--nexus-widget-primary-soft, #E8F0FF)",
        borderRadius: "999px",
        color: brand,
        display: "inline-flex",
        fontFamily,
        fontSize: Math.max(10, Math.round(size * 0.42)),
        fontWeight: 700,
        height: size,
        justifyContent: "center",
        width: size,
        ...style,
      }}
    >
      {(label || "?").trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

function TokenLogoPair({
  tokenLogo,
  chainLogo,
  tokenSymbol,
  chainName,
}: {
  tokenLogo?: string;
  chainLogo?: string;
  tokenSymbol?: string;
  chainName?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        flexShrink: 0,
        height: 27,
        position: "relative",
        width: 27,
      }}
    >
      <MiniLogo label={tokenSymbol} size={27} src={tokenLogo} />
      {chainLogo && (
        <MiniLogo
          label={chainName}
          size={12}
          src={chainLogo}
          style={{
            bottom: -1,
            outline: "1px solid var(--nexus-widget-surface, #FFFFFE)",
            position: "absolute",
            right: -1,
          }}
        />
      )}
    </span>
  );
}

export function NexusWidgetProgressScreen({
  fromTokens = [],
  toToken,
  fromAmountUsd,
  toAmount,
  toAmountUsd,
  totalFeeUsd,
  intentData,
  isRejected = false,
  mode,
  opportunity,
  steps,
  progressEvents = [],
  failedStep,
  recipientAddress,
}: NexusWidgetProgressScreenProps) {
  const intentSources = intentData?.sources ?? [];
  const intentDestination = intentData?.destination;
  const destinationSourceToken = fromTokens.find((token) => {
    const destinationChainId = intentDestination?.chain.id ?? toToken?.chainId;
    const destinationTokenAddress = (
      intentDestination?.token.contractAddress ??
      toToken?.contractAddress ??
      ""
    ).toLowerCase();
    const tokenAmount =
      parseDecimal(token.userAmount) ?? parseDecimal(token.balance);

    return (
      destinationChainId !== undefined &&
      destinationTokenAddress !== "" &&
      token.chainId === destinationChainId &&
      token.contractAddress.toLowerCase() === destinationTokenAddress &&
      Boolean(tokenAmount && tokenAmount.gt(0))
    );
  });
  const sourceSymbols = unique([
    ...(destinationSourceToken ? [destinationSourceToken.symbol] : []),
    ...(intentSources.length > 0
      ? intentSources.map((source) => source.token.symbol)
      : fromTokens.map((token) => token.symbol)),
  ]);
  const intentSourceUsd =
    intentSources.length > 0
      ? intentSources.reduce(
          (sum, source) => sum.plus(parseDecimal(source.value) ?? 0),
          new Decimal(0),
        )
      : parseDecimal(fromAmountUsd);
  const requestedDestinationAmount = parseDecimal(toAmount);
  const quotedDestinationAmount = parseDecimal(intentDestination?.amount);
  const destinationBalanceAmount = parseDecimal(toToken?.balance);
  const requestedDestinationUsd = parseDecimal(toAmountUsd);
  const destinationUsdRate =
    requestedDestinationAmount &&
    requestedDestinationAmount.gt(0) &&
    requestedDestinationUsd &&
    requestedDestinationUsd.gt(0)
      ? requestedDestinationUsd.div(requestedDestinationAmount)
      : quotedDestinationAmount &&
          quotedDestinationAmount.gt(0) &&
          intentDestination?.value
        ? (parseDecimal(intentDestination.value) ?? new Decimal(0)).div(
            quotedDestinationAmount,
          )
        : undefined;
  const destinationCoverageUsd =
    (mode === "deposit" || mode === "send") &&
    requestedDestinationAmount &&
    requestedDestinationAmount.gt(0) &&
    quotedDestinationAmount &&
    requestedDestinationAmount.gt(quotedDestinationAmount) &&
    destinationBalanceAmount &&
    destinationBalanceAmount.gt(0) &&
    destinationUsdRate &&
    destinationUsdRate.gt(0)
      ? Decimal.min(
          requestedDestinationAmount.minus(quotedDestinationAmount),
          destinationBalanceAmount,
        ).mul(destinationUsdRate)
      : undefined;
  const quotedDestinationUsd = parseDecimal(intentDestination?.value);
  const feeUsd = parseDecimal(totalFeeUsd);
  const sourceUsd =
    mode === "deposit" || mode === "send"
      ? [
          destinationCoverageUsd !== undefined
            ? (intentSourceUsd ?? new Decimal(0)).plus(destinationCoverageUsd)
            : intentSourceUsd,
          requestedDestinationUsd,
          requestedDestinationUsd &&
          requestedDestinationUsd.gt(0) &&
          intentSourceUsd &&
          intentSourceUsd.gt(0) &&
          quotedDestinationUsd &&
          quotedDestinationUsd.gt(0)
            ? requestedDestinationUsd.plus(
                Decimal.max(intentSourceUsd.minus(quotedDestinationUsd), 0),
              )
            : undefined,
          requestedDestinationUsd &&
          requestedDestinationUsd.gt(0) &&
          feeUsd &&
          feeUsd.gt(0)
            ? requestedDestinationUsd.plus(feeUsd)
            : undefined,
        ]
          .filter((value): value is Decimal => Boolean(value && value.gt(0)))
          .reduce<Decimal | undefined>(
            (max, value) => (!max || value.gt(max) ? value : max),
            undefined,
          )
      : intentSourceUsd;
  const destinationAmount =
    (mode === "deposit" || mode === "send") && toAmount
      ? toAmount
      : (intentDestination?.amount ?? toAmount ?? "0");
  const destinationSymbol =
    intentDestination?.token.symbol ||
    toToken?.symbol ||
    opportunity?.tokenSymbol ||
    "";
  const destinationChainName = getShortChainName(
    intentDestination?.chain.id ?? toToken?.chainId,
    intentDestination?.chain.name || toToken?.chainName || "",
  );
  const destinationChain =
    mode === "deposit"
      ? opportunity?.title || opportunity?.protocol || destinationChainName
      : destinationChainName;
  const statusRows = buildStatusRows({
    events: progressEvents,
    failedStep,
    isRejected,
    mode,
    steps: steps ?? [],
    context: {
      destinationChain: destinationChainName || destinationChain,
      destinationSymbol,
      fromTokens,
      intentSources,
      opportunity: opportunity
        ? {
            chainId: opportunity.chainId,
            tokenAddress: opportunity.tokenAddress,
            tokenSymbol: opportunity.tokenSymbol,
          }
        : undefined,
      opportunityName: opportunity?.title || opportunity?.protocol,
      recipientAddress,
      toToken: toToken
        ? {
            chainId: toToken.chainId,
            contractAddress: toToken.contractAddress,
            symbol: toToken.symbol,
          }
        : undefined,
    },
  });
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const activeRow =
    statusRows.find(
      (row) => row.state === "preapproval" || row.state === "inProgress",
    ) ??
    statusRows.find((row) => row.state === "error") ??
    statusRows.find((row) => row.state === "default") ??
    statusRows[statusRows.length - 1];
  const visibleRows = stepsExpanded ? statusRows : activeRow ? [activeRow] : [];
  const canExpand = statusRows.length > 1;
  const getRowHeight = (row: ProgressStatusRow) =>
    mode === "deposit"
      ? row.description
        ? 64
        : 52
      : row.description
        ? 47
        : 40;
  const collapsedStatusHeight = activeRow ? getRowHeight(activeRow) : 40;
  const expandedStatusHeight = statusRows.reduce(
    (sum, row) => sum + getRowHeight(row),
    0,
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "7px",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "var(--nx-card, var(--nexus-widget-surface, #FFFFFE))",
          border: mode === "deposit" ? "none" : `1px solid ${border}`,
          borderRadius: mode === "deposit" ? "24px" : "8px",
          boxShadow:
            mode === "deposit"
              ? "var(--nx-sh-card, #16161508 0 1px 2px, #1616150A 0 6px 18px)"
              : "0px 1px 12px 0px var(--nexus-widget-shadow-soft, #5B5B5B0D)",
          boxSizing: "border-box",
          padding: mode === "deposit" ? "14px 12px 12px" : "12px 13px 9px",
          width: "100%",
        }}
      >
        {mode === "deposit" ? (
          <>
            <div
              style={{
                color: "var(--nx-mute-2, #8C8C8B)",
                fontFamily,
                fontSize: "14px",
                lineHeight: "18px",
                textAlign: "center",
              }}
            >
              {destinationChain || "Deposit"} Receives
            </div>
            <div
              style={{
                alignItems: "baseline",
                color: primary,
                display: "flex",
                fontFamily,
                fontSize: "48px",
                fontWeight: 300,
                gap: "8px",
                justifyContent: "center",
                letterSpacing: "-0.03em",
                lineHeight: "56px",
                marginTop: "2px",
              }}
            >
              <span>~{formatDecimal(destinationAmount, 2)}</span>
              <span
                style={{
                  color: "var(--nx-mute, #737372)",
                  fontSize: "18px",
                  fontWeight: 500,
                  letterSpacing: "0",
                  lineHeight: "22px",
                }}
              >
                {destinationSymbol}
              </span>
            </div>
            <div
              style={{
                color: "var(--nx-mute-2, #8C8C8B)",
                fontFamily,
                fontSize: "14px",
                lineHeight: "18px",
                textAlign: "center",
              }}
            >
              ≈ {formatUsd(toAmountUsd ?? sourceUsd)}
            </div>
            <div
              style={{
                alignItems: "center",
                color: "var(--nx-faint, #A3A3A2)",
                display: "flex",
                fontFamily,
                fontSize: "12px",
                gap: "4px",
                justifyContent: "center",
                lineHeight: "16px",
                marginTop: "4px",
              }}
            >
              on
              {toToken?.chainLogo ? (
                <img
                  alt=""
                  src={toToken.chainLogo}
                  style={{ borderRadius: "999px", height: 12, width: 12 }}
                />
              ) : null}
              {destinationChainName || destinationChain}
            </div>
            <div
              style={{
                background: "var(--nx-band, #F8F8F8)",
                borderRadius: "18px",
                marginTop: "8px",
                padding: "12px 16px",
              }}
            >
              <img
                alt=""
                aria-hidden="true"
                src="https://files.availproject.org/nexus-elements/nexus-one/progress-grid.gif"
                style={{
                  display: "block",
                  height: "167px",
                  objectFit: "cover",
                  width: "100%",
                }}
              />
            </div>
            <div
              style={{
                color: "var(--nx-mute-2, #8C8C8B)",
                fontFamily,
                fontSize: "14px",
                lineHeight: "18px",
                marginTop: "14px",
                textAlign: "center",
              }}
            >
              You Spend
            </div>
            <div
              style={{
                color: primary,
                fontFamily,
                fontSize: "36px",
                fontWeight: 300,
                letterSpacing: "-0.03em",
                lineHeight: "42px",
                textAlign: "center",
              }}
            >
              {formatUsd(sourceUsd)}
            </div>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "center",
                marginTop: "6px",
              }}
            >
              {fromTokens.slice(0, 4).map((token, index) => (
                <img
                  alt={token.symbol}
                  key={`${token.contractAddress}-${token.chainId}-${index}`}
                  src={token.logo}
                  style={{
                    background: "var(--nx-card, #FFFFFF)",
                    borderRadius: "999px",
                    height: 22,
                    marginLeft: index === 0 ? 0 : -6,
                    outline: "2px solid var(--nx-card, #FFFFFF)",
                    width: 22,
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <>
        <div
          style={{
            color: muted,
            fontFamily,
            fontSize: "10px",
            lineHeight: "14px",
            textAlign: "center",
          }}
        >
          {formatSymbolSummary(sourceSymbols)}
        </div>
        <div
          style={{
            color: primary,
            fontFamily,
            fontSize: "16px",
            fontWeight: 600,
            lineHeight: "22px",
            marginTop: "2px",
            textAlign: "center",
          }}
        >
          {formatUsd(sourceUsd)}
        </div>

        <img
          alt=""
          aria-hidden="true"
          src="https://files.availproject.org/nexus-elements/nexus-one/progress-grid.gif"
          style={{
            display: "block",
            height: "148px",
            margin: "13px auto 9px",
            objectFit: "cover",
            objectPosition: "center",
            width: "100%",
          }}
        />

        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              color: primary,
              display: "flex",
              fontFamily,
              fontSize: "15px",
              fontWeight: 600,
              gap: "5px",
              lineHeight: "22px",
            }}
          >
            <TokenLogoPair
              chainLogo={intentDestination?.chain.logo || toToken?.chainLogo}
              chainName={destinationChain}
              tokenLogo={
                (intentDestination?.token as any)?.logo || toToken?.logo
              }
              tokenSymbol={destinationSymbol}
            />
            <span>{formatDecimal(destinationAmount, 8)}</span>
            <span style={{ fontSize: "10px", lineHeight: "14px" }}>
              {destinationSymbol}
            </span>
          </div>
          {destinationChain && (
            <div
              style={{
                color: muted,
                fontFamily,
                fontSize: "9px",
                lineHeight: "13px",
              }}
            >
              on {destinationChain}
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <div
        aria-live="polite"
        style={{
          background: "var(--nx-card, var(--nexus-widget-surface, #FFFFFE))",
          border: mode === "deposit" ? "none" : `1px solid ${border}`,
          borderRadius: mode === "deposit" ? "24px" : "8px",
          boxShadow:
            mode === "deposit"
              ? "var(--nx-sh-card, #16161508 0 1px 2px, #1616150A 0 6px 18px)"
              : "0px 1px 12px 0px var(--nexus-widget-shadow-soft, #5B5B5B0D)",
          boxSizing: "border-box",
          overflow: "hidden",
          transition:
            mode === "deposit"
              ? "grid-template-rows 250ms cubic-bezier(.2,0,0,1)"
              : "box-shadow 220ms ease, border-color 220ms ease",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr",
            maxHeight: stepsExpanded
              ? `${Math.max(43, expandedStatusHeight)}px`
              : `${collapsedStatusHeight}px`,
            overflow: "hidden",
            transition: "max-height 220ms ease",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {visibleRows.map((row, index) => {
              const isCompleted = row.state === "completed";
              const isError = row.state === "error";
              const isDefault = row.state === "default";
              const isLoading =
                row.state === "preapproval" || row.state === "inProgress";
              const hasDescription = Boolean(row.description);
              const rowColor = isDefault ? muted : isError ? danger : primary;

              return (
                <button
                  key={row.id}
                  onClick={() => {
                    if (canExpand) setStepsExpanded((current) => !current);
                  }}
                  style={{
                    alignItems: hasDescription ? "flex-start" : "center",
                    appearance: "none",
                    background: "transparent",
                    border: "0",
                    borderTop:
                      index > 0 && stepsExpanded ? `1px solid ${border}` : "0",
                    boxSizing: "border-box",
                    color: rowColor,
                    cursor: canExpand ? "pointer" : "default",
                    display: "flex",
                    fontFamily,
                    fontSize: mode === "deposit" ? "16px" : "11px",
                    fontWeight: mode === "deposit" ? 500 : 400,
                    gap: "7px",
                    minHeight: `${getRowHeight(row)}px`,
                    padding: "8px 11px",
                    textAlign: "left",
                    transition:
                      "color 220ms ease, min-height 220ms ease, opacity 220ms ease",
                    width: "100%",
                  }}
                  type="button"
                >
                  {isCompleted || isError ? (
                    <span
                      style={{
                        alignItems: "center",
                        background: isError ? "var(--nexus-widget-error-background, #E92C2C)" : brand,
                        borderRadius: "999px",
                        color: isError
                          ? "var(--nexus-widget-error-text, #FFFFFE)"
                          : "var(--nexus-widget-primary-foreground, #FFFFFE)",
                        display: "inline-flex",
                        height: "15px",
                        justifyContent: "center",
                        width: "15px",
                      }}
                    >
                      {isError ? (
                        <X style={{ height: 10, width: 10 }} />
                      ) : (
                        <Check style={{ height: 11, width: 11 }} />
                      )}
                    </span>
                  ) : isDefault ? (
                    <span
                      style={{
                        background: "var(--nexus-widget-surface, #FFFFFE)",
                        border: "2px solid var(--nexus-widget-text-tertiary, #E8E8E7)",
                        borderRadius: "999px",
                        boxSizing: "border-box",
                        display: "inline-flex",
                        height: "15px",
                        width: "15px",
                      }}
                    />
                  ) : (
	                    <Loader2
	                      className="animate-spin"
	                      style={{
	                        ...NEXUS_WIDGET_FAST_SPINNER_STYLE,
	                        color: brand,
	                        height: 15,
	                        width: 15,
	                      }}
	                    />
                  )}
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                      lineHeight: "18px",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        color: rowColor,
                        fontWeight: isLoading ? 600 : 400,
                      }}
                    >
                      {row.label}
                    </span>
                    {row.description && (
                      <span
                        style={{
                          color: isLoading ? brand : muted,
                          fontSize: "10px",
                          fontWeight: 400,
                          lineHeight: "13px",
                        }}
                      >
                        {row.description}
                      </span>
                    )}
                  </span>
                  {canExpand && index === 0 && (
                    <ChevronDown
                      style={{
                        color: muted,
                        flexShrink: 0,
                        height: 16,
                        marginLeft: "auto",
                        marginTop: hasDescription ? 2 : 0,
                        transform: stepsExpanded
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 220ms ease",
                        width: 16,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
