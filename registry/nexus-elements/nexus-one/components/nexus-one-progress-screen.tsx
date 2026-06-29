// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

"use client";

import Decimal from "decimal.js";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import type {
  BridgeStepType,
  SwapStepType,
} from "../../common/types/transaction-flow";
import { getShortChainName } from "../../common/utils/constant";
import { type NexusOneDepositMetadata, type NexusOneMode } from "../types";
import { type SwapTokenOption } from "./swap-asset-selector";
import { type SwapIntentData } from "./swap-intent-preview";

type ProgressSdkStep = SwapStepType | BridgeStepType;

type ProgressStep = {
  id: number;
  completed: boolean;
  step: ProgressSdkStep;
};

export type NexusOneProgressEvent = {
  id: string;
  name: string;
  completed: boolean;
  event?: unknown;
  step?: ProgressSdkStep;
  steps?: ProgressSdkStep[];
};

interface NexusOneProgressScreenProps {
  failedStep?: ProgressSdkStep | null;
  fromAmountUsd?: string;
  fromTokens?: SwapTokenOption[];
  intentData?: SwapIntentData | null;
  mode: NexusOneMode;
  opportunity?: NexusOneDepositMetadata;
  progressEvents?: NexusOneProgressEvent[];
  recipientAddress?: string;
  steps?: ProgressStep[];
  toAmount?: string;
  toAmountUsd?: string;
  toToken?: SwapTokenOption;
  totalFeeUsd?: string;
}

const fontFamily = '"Geist", var(--font-geist-sans), system-ui, sans-serif';
const primary = "var(--foreground-primary, #161615)";
const muted = "var(--foreground-muted, #848483)";
const border = "var(--border-default, #E8E8E7)";
const brand = "var(--foreground-brand, #006BF4)";
const danger = "var(--foreground-negative, #E92C2C)";

const parseDecimal = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  if (Decimal.isDecimal(value)) return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") {
    return undefined;
  }
  try {
    const parsed = new Decimal(cleaned);
    return parsed.isFinite() ? parsed : undefined;
  } catch {
    return undefined;
  }
};

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
  "swapTokens",
  "receiveToken",
  "action",
];

const SWAP_APPROVAL_TYPES = [
  "SOURCE_SWAP",
  "CREATE_PERMIT_EOA_TO_EPHEMERAL",
  "CREATE_PERMIT_FOR_SOURCE_SWAP",
  "EOA_TO_EPHEMERAL_TRANSFER",
  "EOA_EXECUTE_CALL",
  // "BRIDGE_DEPOSIT",
];

const REFUND_ELIGIBLE_SWAP_TYPES = [
  "BRIDGE_INTENT_SUBMISSION",
  "BRIDGE_DEPOSIT",
];

const DESTINATION_SWAP_TYPES = [
  "DESTINATION_SWAP",
  "DESTINATION_SWAP_BATCH_TX",
  "DESTINATION_SWAP_HASH",
];
const BRIDGE_FILL_RECEIVE_TYPES = ["BRIDGE_FILL"];

const getStatusForStep = (
  step: ProgressSdkStep | undefined,
  mode: NexusOneMode,
  hasTransferAction = false
): ProgressStatusId | null => {
  const type = getStepType(step);

  if (
    type === "APPROVAL" ||
    type === "TRANSACTION_SENT" ||
    type === "TRANSACTION_CONFIRMED"
  ) {
    return mode === "swap" && !hasTransferAction ? null : "action";
  }

  if (type.includes("SWAP_START")) {
    return "swapTokens";
  }

  if (SWAP_APPROVAL_TYPES.some((token) => type.includes(token))) {
    return "approveTokens";
  }

  if (
    type.includes("SOURCE_SWAP") ||
    type.includes("SOURCE_BATCH") ||
    type.includes("SWAP_SOURCE") ||
    type.includes("BRIDGE_DEPOSIT") ||
    type.includes("BRIDGE_FILL") ||
    type.includes("BRIDGE_INTENT_SUBMISSION") ||
    type.includes("SWAP_COMPLETE") ||
    type.includes("SWAP_SKIPPED")
  ) {
    return "swapTokens";
  }

  if (type.includes("DESTINATION_SWAP") || type.includes("DESTINATION_BATCH")) {
    return "receiveToken";
  }

  return null;
};

const stepMatches = (step: ProgressSdkStep | undefined, tokens: string[]) => {
  const type = getStepType(step);
  return tokens.some((token) => type.includes(token));
};

const hasCompletedType = (
  events: NexusOneProgressEvent[],
  steps: ProgressStep[],
  tokens: string[]
) => {
  const completedEvent = events.some(
    (event) => event.completed && stepMatches(event.step, tokens)
  );
  if (completedEvent) return true;

  return steps.some((item) => item.completed && stepMatches(item.step, tokens));
};

const hasStepType = (
  events: NexusOneProgressEvent[],
  steps: ProgressStep[],
  tokens: string[]
) =>
  events.some(
    (event) =>
      stepMatches(event.step, tokens) ||
      (event.steps ?? []).some((step) => stepMatches(step, tokens))
  ) || steps.some((item) => stepMatches(item.step, tokens));

const hasEventType = (events: NexusOneProgressEvent[], tokens: string[]) =>
  events.some(
    (event) =>
      stepMatches(event.step, tokens) ||
      (event.steps ?? []).some((step) => stepMatches(step, tokens))
  );

const hasProgressEventType = (
  events: NexusOneProgressEvent[],
  tokens: string[]
) =>
  events.some(
    (event) =>
      (event.name === PROGRESS_EVENT_NAMES.BRIDGE_PLAN_PROGRESS ||
        event.name === PROGRESS_EVENT_NAMES.SWAP_PLAN_PROGRESS) &&
      stepMatches(event.step, tokens)
  );

const getListedSteps = (
  events: NexusOneProgressEvent[],
  eventName: ProgressListEventName
) => {
  const listEvent = [...events]
    .reverse()
    .find(
      (event) => event.name === eventName && (event.steps?.length ?? 0) > 0
    );
  return listEvent?.steps ?? [];
};

const countListedSteps = (steps: ProgressSdkStep[], tokens: string[]) =>
  steps.filter((step) => stepMatches(step, tokens)).length;

type ApprovalUnit = {
  symbol?: string;
};

const getStepSwaps = (step?: ProgressSdkStep) => {
  const swaps = (step as any)?.swaps;
  return Array.isArray(swaps) ? swaps : [];
};

const getApprovalUnitsForStep = (step?: ProgressSdkStep): ApprovalUnit[] => {
  if (!stepMatches(step, SWAP_APPROVAL_TYPES)) return [];

  const swaps = getStepSwaps(step);
  if (swaps.length > 0) {
    return swaps.map((swap) => ({
      symbol:
        typeof swap?.input?.symbol === "string" ? swap.input.symbol : undefined,
    }));
  }

  const assetSymbol = (step as any)?.asset?.symbol;
  const tokenSymbol = (step as any)?.token?.symbol;
  return [
    {
      symbol:
        typeof assetSymbol === "string"
          ? assetSymbol
          : typeof tokenSymbol === "string"
            ? tokenSymbol
            : undefined,
    },
  ];
};

const countApprovalUnits = (steps: ProgressSdkStep[]) =>
  steps.reduce((sum, step) => sum + getApprovalUnitsForStep(step).length, 0);

const countCompletedApprovalUnitsFromEvents = (
  events: NexusOneProgressEvent[]
) =>
  events.reduce((sum, event) => {
    if (
      event.name !== PROGRESS_EVENT_NAMES.SWAP_PLAN_PROGRESS ||
      !event.completed
    ) {
      return sum;
    }
    return sum + getApprovalUnitsForStep(event.step).length;
  }, 0);

const countCompletedApprovalUnitsFromSteps = (steps: ProgressStep[]) =>
  steps.reduce(
    (sum, item) =>
      item.completed ? sum + getApprovalUnitsForStep(item.step).length : sum,
    0
  );

const getApprovalUnitSymbols = (steps: ProgressSdkStep[]) =>
  steps
    .flatMap((step) => getApprovalUnitsForStep(step))
    .map((unit) => unit.symbol)
    .filter(Boolean) as string[];

const getNumericEventIndex = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
      return Number(value);
    }
  }
  return undefined;
};

const getApprovalIndexFromEvent = (event?: NexusOneProgressEvent) => {
  const rawEvent = event?.event as any;
  const rawStep = event?.step as any;
  return getNumericEventIndex(
    rawEvent?.approvalIndex,
    rawEvent?.swapIndex,
    rawEvent?.currentIndex,
    rawEvent?.index,
    rawEvent?.data?.approvalIndex,
    rawEvent?.data?.swapIndex,
    rawEvent?.data?.currentIndex,
    rawEvent?.data?.index,
    rawStep?.approvalIndex,
    rawStep?.swapIndex,
    rawStep?.currentIndex,
    rawStep?.index,
    rawStep?.data?.approvalIndex,
    rawStep?.data?.swapIndex,
    rawStep?.data?.currentIndex,
    rawStep?.data?.index
  );
};

const getActiveApprovalProgressEvent = (events: NexusOneProgressEvent[]) =>
  [...events]
    .reverse()
    .find(
      (event) =>
        event.name === PROGRESS_EVENT_NAMES.SWAP_PLAN_PROGRESS &&
        !event.completed &&
        getApprovalUnitsForStep(event.step).length > 0
    );

const getApprovalSymbolFromProgressEvent = (event?: NexusOneProgressEvent) => {
  const units = getApprovalUnitsForStep(event?.step);
  if (units.length === 0) return undefined;
  if (units.length === 1) return units[0]?.symbol;

  const index = getApprovalIndexFromEvent(event);
  if (index === undefined || index >= units.length) return undefined;
  return units[index]?.symbol;
};

const getApprovalTotalFromSwapStepsList = (events: NexusOneProgressEvent[]) =>
  countApprovalUnits(
    getListedSteps(events, PROGRESS_EVENT_NAMES.SWAP_PLAN_LIST)
  );

const hasStartedStatus = (
  events: NexusOneProgressEvent[],
  id: ProgressStatusId,
  mode: NexusOneMode,
  hasTransferAction = false
) =>
  events.some(
    (event) => getStatusForStep(event.step, mode, hasTransferAction) === id
  );

const buildStatusRows = ({
  events,
  failedStep,
  mode,
  steps,
  approvalTotalCount,
  context,
}: {
  events: NexusOneProgressEvent[];
  failedStep?: ProgressSdkStep | null;
  mode: NexusOneMode;
  steps: ProgressStep[];
  approvalTotalCount?: number | null;
  context: {
    destinationChain?: string;
    destinationSymbol?: string;
    opportunityName?: string;
    recipientAddress?: string;
  };
}): ProgressStatusRow[] => {
  const hasTransferAction =
    mode === "send" || (mode === "swap" && Boolean(context.recipientAddress));
  const failedStatus = failedStep
    ? getStatusForStep(failedStep, mode, hasTransferAction)
    : null;
  const swapListSteps = getListedSteps(
    events,
    PROGRESS_EVENT_NAMES.SWAP_PLAN_LIST
  );
  const fallbackSteps = steps.map((item) => item.step);
  const destinationSymbol = context.destinationSymbol || "token";
  const destinationChain = context.destinationChain || "destination";
  const opportunityName = context.opportunityName || "app";
  const immutableApprovalTotal =
    approvalTotalCount ??
    Math.max(
      countApprovalUnits(swapListSteps),
      countApprovalUnits(fallbackSteps),
      countCompletedApprovalUnitsFromEvents(events)
    );
  const refundEligibleFailure =
    failedStep !== null &&
    failedStep !== undefined &&
    stepMatches(failedStep, REFUND_ELIGIBLE_SWAP_TYPES);
  const approvalCompletedCount = Math.min(
    immutableApprovalTotal || Number.MAX_SAFE_INTEGER,
    Math.max(
      countCompletedApprovalUnitsFromEvents(events),
      countCompletedApprovalUnitsFromSteps(steps)
    )
  );
  const approvalSymbols = getApprovalUnitSymbols(
    swapListSteps.length > 0 ? swapListSteps : fallbackSteps
  );
  const activeApprovalSymbol = getApprovalSymbolFromProgressEvent(
    getActiveApprovalProgressEvent(events)
  );
  const hasSwapList =
    swapListSteps.length > 0 ||
    hasStepType(events, steps, [
      "SWAP_START",
      "DETERMINING_SWAP",
      "SOURCE_SWAP",
      "DESTINATION_SWAP",
      "BRIDGE_DEPOSIT",
      "BRIDGE_FILL",
      "BRIDGE_INTENT_SUBMISSION",
      "SWAP_COMPLETE",
      "SWAP_SKIPPED",
    ]);
  const hasDestinationReceiveStep =
    countListedSteps(swapListSteps, DESTINATION_SWAP_TYPES) > 0 ||
    countListedSteps(fallbackSteps, DESTINATION_SWAP_TYPES) > 0 ||
    hasProgressEventType(events, DESTINATION_SWAP_TYPES);
  const receiveTokenTypes = hasDestinationReceiveStep
    ? DESTINATION_SWAP_TYPES
    : BRIDGE_FILL_RECEIVE_TYPES;
  const hasReceiveTokenStep =
    hasDestinationReceiveStep ||
    countListedSteps(swapListSteps, receiveTokenTypes) > 0 ||
    countListedSteps(fallbackSteps, receiveTokenTypes) > 0 ||
    hasProgressEventType(events, receiveTokenTypes);
  const receiveTokenStarted = hasProgressEventType(events, receiveTokenTypes);
  const receiveTokenComplete =
    hasReceiveTokenStep && hasCompletedType(events, steps, receiveTokenTypes);
  const swapComplete = hasCompletedType(events, steps, [
    "SWAP_COMPLETE",
    "SWAP_SKIPPED",
  ]);
  const swapSkipped = hasCompletedType(events, steps, ["SWAP_SKIPPED"]);
  const shouldShowSwapRows =
    hasSwapList && !(swapSkipped && (mode === "deposit" || mode === "send"));
  const swapTokensComplete = hasReceiveTokenStep
    ? receiveTokenStarted
    : swapComplete;
  const transactionSent = hasCompletedType(events, steps, ["TRANSACTION_SENT"]);
  const transactionConfirmed = hasCompletedType(events, steps, [
    "TRANSACTION_CONFIRMED",
  ]);
  const rows: ProgressStatusRow[] = [];

  const pushRow = (row: ProgressStatusRow) => {
    if (failedStatus) {
      const failedIndex = STATUS_ORDER.indexOf(failedStatus);
      const currentIndex = STATUS_ORDER.indexOf(row.id);
      if (failedIndex >= 0 && currentIndex > failedIndex) return;
    }
    rows.push(row);
  };

  if (immutableApprovalTotal > 0) {
    const approvalCurrent = Math.min(
      immutableApprovalTotal,
      Math.max(1, approvalCompletedCount + 1)
    );
    const approvalSymbol =
      activeApprovalSymbol ??
      approvalSymbols[
        Math.min(approvalCompletedCount, approvalSymbols.length - 1)
      ];
    const approvalDescription = approvalSymbol
      ? `Approve ${approvalSymbol} in wallet`
      : "Approve in wallet";
    let state: ProgressStatusState = "default";
    if (failedStatus === "approveTokens") {
      state = "error";
    } else if (approvalCompletedCount >= immutableApprovalTotal) {
      state = "completed";
    } else if (
      hasStartedStatus(events, "approveTokens", mode, hasTransferAction) ||
      events.length === 0
    ) {
      state = "preapproval";
    }

    pushRow({
      id: "approveTokens",
      state,
      description: state === "preapproval" ? approvalDescription : undefined,
      label:
        state === "completed"
          ? `Approved Swaps (${immutableApprovalTotal} of ${immutableApprovalTotal})`
          : state === "error"
            ? "Collection failed"
            : `Approve Swaps (${approvalCurrent} of ${immutableApprovalTotal})`,
    });
  }

  if (shouldShowSwapRows) {
    const approvalsSatisfied =
      immutableApprovalTotal === 0 ||
      approvalCompletedCount >= immutableApprovalTotal;
    let state: ProgressStatusState = "default";
    if (failedStatus === "swapTokens") {
      state = "error";
    } else if (swapTokensComplete) {
      state = "completed";
    } else if (
      approvalsSatisfied &&
      (hasStartedStatus(events, "swapTokens", mode, hasTransferAction) ||
        hasEventType(events, [
          "DESTINATION_SWAP_BATCH_TX",
          "BRIDGE_DEPOSIT",
          "SOURCE_SWAP_BATCH_TX",
          "SOURCE_SWAP_HASH",
          "SWAP_START",
        ]))
    ) {
      state = "inProgress";
    }

    pushRow({
      id: "swapTokens",
      state,
      label:
        state === "completed"
          ? "Swaps completed"
          : state === "error"
            ? refundEligibleFailure
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
              : receiveTokenStarted
                ? "inProgress"
                : "default",
        label:
          failedStatus === "receiveToken"
            ? refundEligibleFailure
              ? "Destination swap failed. Refund initiated."
              : "Destination swap failed."
            : receiveTokenComplete
              ? `Received ${destinationSymbol} on ${destinationChain}`
              : receiveTokenStarted
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
      description: state === "preapproval" ? "Approve in wallet" : undefined,
      label: isDeposit
        ? state === "completed"
          ? `${destinationSymbol} deposited to ${opportunityName}`
          : state === "inProgress"
            ? `Depositing ${destinationSymbol} to ${opportunityName}`
            : state === "error"
              ? "Deposit failed. Funds are in your wallet."
              : state === "preapproval"
                ? `Approve Deposit of ${destinationSymbol} to ${opportunityName}`
                : `Deposit ${destinationSymbol} to ${opportunityName}`
        : state === "completed"
          ? `${destinationSymbol} sent`
          : state === "inProgress"
            ? `Sending ${destinationSymbol}`
            : state === "error"
              ? "Send failed. Funds are in your wallet."
              : state === "preapproval"
                ? `Approve ${destinationSymbol} transfer`
                : `Send ${destinationSymbol}`,
    });
  }

  const orderedRows = rows.sort(
    (a, b) => STATUS_ORDER.indexOf(a.id) - STATUS_ORDER.indexOf(b.id)
  );

  if (
    orderedRows.some(
      (row) => row.state === "preapproval" || row.state === "inProgress"
    ) ||
    orderedRows.some((row) => row.state === "error")
  ) {
    return orderedRows;
  }

  const nextActiveIndex = orderedRows.findIndex(
    (row) => row.state === "default"
  );
  if (nextActiveIndex === -1) return orderedRows;

  return orderedRows.map((row, index) => {
    if (index !== nextActiveIndex) return row;
    const nextState =
      row.id === "approveTokens" || row.id === "action"
        ? "preapproval"
        : "inProgress";
    return {
      ...row,
      description:
        nextState === "preapproval" ? "Approve in wallet" : undefined,
      label:
        row.id === "swapTokens"
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
          background: "#FFFFFE",
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
        background: "#E8F0FF",
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
            outline: "1px solid #FFFFFE",
            position: "absolute",
            right: -1,
          }}
        />
      )}
    </span>
  );
}

export function NexusOneProgressScreen({
  fromTokens = [],
  toToken,
  fromAmountUsd,
  toAmount,
  toAmountUsd,
  totalFeeUsd,
  intentData,
  mode,
  opportunity,
  steps,
  progressEvents = [],
  failedStep,
  recipientAddress,
}: NexusOneProgressScreenProps) {
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
          new Decimal(0)
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
            quotedDestinationAmount
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
          destinationBalanceAmount
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
                Decimal.max(intentSourceUsd.minus(quotedDestinationUsd), 0)
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
            undefined
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
    intentDestination?.chain.name || toToken?.chainName || ""
  );
  const destinationChain =
    mode === "deposit"
      ? opportunity?.title || opportunity?.protocol || destinationChainName
      : destinationChainName;
  const seededApprovalTotal = countApprovalUnits(
    (steps ?? []).map((item) => item.step)
  );
  const completedApprovalEventTotal =
    countCompletedApprovalUnitsFromEvents(progressEvents);
  const computedApprovalTotal = Math.max(
    getApprovalTotalFromSwapStepsList(progressEvents),
    seededApprovalTotal,
    completedApprovalEventTotal
  );
  const [lockedApprovalTotal, setLockedApprovalTotal] = useState<number | null>(
    null
  );
  const approvalTotalCount =
    lockedApprovalTotal ??
    (computedApprovalTotal > 0 ? computedApprovalTotal : null);

  useEffect(() => {
    if (progressEvents.length === 0) {
      setLockedApprovalTotal(null);
      return;
    }
    if (lockedApprovalTotal !== null || computedApprovalTotal <= 0) return;
    setLockedApprovalTotal(computedApprovalTotal);
  }, [computedApprovalTotal, lockedApprovalTotal, progressEvents.length]);

  const statusRows = buildStatusRows({
    events: progressEvents,
    failedStep,
    mode,
    steps: steps ?? [],
    approvalTotalCount,
    context: {
      destinationChain: destinationChainName || destinationChain,
      destinationSymbol,
      opportunityName: opportunity?.title || opportunity?.protocol,
      recipientAddress,
    },
  });
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const activeRow =
    statusRows.find(
      (row) => row.state === "preapproval" || row.state === "inProgress"
    ) ??
    statusRows.find((row) => row.state === "error") ??
    statusRows.find((row) => row.state === "default") ??
    statusRows[statusRows.length - 1];
  const visibleRows = stepsExpanded ? statusRows : activeRow ? [activeRow] : [];
  const canExpand = statusRows.length > 1;
  const getRowHeight = (row: ProgressStatusRow) => (row.description ? 47 : 40);
  const collapsedStatusHeight = activeRow ? getRowHeight(activeRow) : 40;
  const expandedStatusHeight = statusRows.reduce(
    (sum, row) => sum + getRowHeight(row),
    0
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
          background: "#FFFFFE",
          border: `1px solid ${border}`,
          borderRadius: "8px",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D",
          boxSizing: "border-box",
          padding: "12px 13px 9px",
          width: "100%",
        }}
      >
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
      </div>

      <div
        aria-live="polite"
        style={{
          background: "#FFFFFE",
          border: `1px solid ${border}`,
          borderRadius: "8px",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D",
          boxSizing: "border-box",
          overflow: "hidden",
          transition: "box-shadow 220ms ease, border-color 220ms ease",
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
                    fontSize: "11px",
                    fontWeight: 400,
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
                        background: isError ? danger : brand,
                        borderRadius: "999px",
                        color: "#FFFFFE",
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
                        background: "#FFFFFE",
                        border: `2px solid ${border}`,
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
                      style={{ color: brand, height: 15, width: 15 }}
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
                          fontStyle: "italic",
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
