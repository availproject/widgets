"use client";

import React, { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { type BridgeStepType, type SwapStepType } from "../../common";
import { type NexusOneMode, type DepositOpportunity } from "../types";
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
  step?: ProgressSdkStep;
  steps?: ProgressSdkStep[];
};

interface NexusOneProgressScreenProps {
  fromTokens?: SwapTokenOption[];
  toToken?: SwapTokenOption;
  fromAmountUsd?: string;
  toAmount?: string;
  toAmountUsd?: string;
  intentData?: SwapIntentData | null;
  mode: NexusOneMode;
  opportunity?: DepositOpportunity;
  steps?: ProgressStep[];
  progressEvents?: NexusOneProgressEvent[];
  failedStep?: ProgressSdkStep | null;
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

const STATUS_ORDER: ProgressStatusId[] = [
  "approveTokens",
  "swapTokens",
  "receiveToken",
  "action",
];

const SWAP_APPROVAL_TYPES = [
  "CREATE_PERMIT_EOA_TO_EPHEMERAL",
  "CREATE_PERMIT_FOR_SOURCE_SWAP",
];

const REFUND_ELIGIBLE_SWAP_TYPES = ["RFF_ID", "BRIDGE_DEPOSIT"];

const DESTINATION_SWAP_TYPES = [
  "DESTINATION_SWAP_BATCH_TX",
  "DESTINATION_SWAP_HASH",
];

const getStatusForStep = (
  step: ProgressSdkStep | undefined,
  mode: NexusOneMode,
): ProgressStatusId | null => {
  const type = getStepType(step);

  if (
    type === "APPROVAL" ||
    type === "TRANSACTION_SENT" ||
    type === "TRANSACTION_CONFIRMED"
  ) {
    return mode === "swap" ? null : "action";
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
    type.includes("SWAP_COMPLETE") ||
    type.includes("SWAP_SKIPPED")
  ) {
    return "swapTokens";
  }

  if (
    type.includes("DESTINATION_SWAP") ||
    type.includes("DESTINATION_BATCH") ||
    type.includes("BRIDGE_DEPOSIT")
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
  events: NexusOneProgressEvent[],
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
  events: NexusOneProgressEvent[],
  steps: ProgressStep[],
  tokens: string[],
) =>
  events.some(
    (event) =>
      stepMatches(event.step, tokens) ||
      (event.steps ?? []).some((step) => stepMatches(step, tokens)),
  ) || steps.some((item) => stepMatches(item.step, tokens));

const hasEventType = (events: NexusOneProgressEvent[], tokens: string[]) =>
  events.some(
    (event) =>
      stepMatches(event.step, tokens) ||
      (event.steps ?? []).some((step) => stepMatches(step, tokens)),
  );

const getListedSteps = (
  events: NexusOneProgressEvent[],
  eventName: "SWAP_STEPS_LIST" | "STEPS_LIST",
) => {
  const listEvent = [...events]
    .reverse()
    .find(
      (event) => event.name === eventName && (event.steps?.length ?? 0) > 0,
    );
  return listEvent?.steps ?? [];
};

const getEventStepCount = (
  events: NexusOneProgressEvent[],
  eventName: "SWAP_STEP_COMPLETE" | "STEP_COMPLETE",
  tokens: string[],
  completedOnly = false,
) =>
  events.filter((event) => {
    if (event.name !== eventName || !event.step) return false;
    if (completedOnly && !event.completed) return false;
    return stepMatches(event.step, tokens);
  }).length;

const countListedSteps = (steps: ProgressSdkStep[], tokens: string[]) =>
  steps.filter((step) => stepMatches(step, tokens)).length;

const getApprovalTotalFromSwapStepsList = (events: NexusOneProgressEvent[]) =>
  countListedSteps(
    getListedSteps(events, "SWAP_STEPS_LIST"),
    SWAP_APPROVAL_TYPES,
  );

const hasStartedStatus = (
  events: NexusOneProgressEvent[],
  id: ProgressStatusId,
  mode: NexusOneMode,
) => events.some((event) => getStatusForStep(event.step, mode) === id);

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
  };
}): ProgressStatusRow[] => {
  const failedStatus = failedStep ? getStatusForStep(failedStep, mode) : null;
  const swapListSteps = getListedSteps(events, "SWAP_STEPS_LIST");
  const fallbackSteps = steps.map((item) => item.step);
  const destinationSymbol = context.destinationSymbol || "token";
  const destinationChain = context.destinationChain || "destination";
  const opportunityName = context.opportunityName || "app";
  const immutableApprovalTotal =
    approvalTotalCount ?? countListedSteps(swapListSteps, SWAP_APPROVAL_TYPES);
  const refundEligibleFailure =
    failedStep !== null &&
    failedStep !== undefined &&
    stepMatches(failedStep, REFUND_ELIGIBLE_SWAP_TYPES);
  const approvalCompletedCount = Math.min(
    immutableApprovalTotal || Number.MAX_SAFE_INTEGER,
    getEventStepCount(events, "SWAP_STEP_COMPLETE", SWAP_APPROVAL_TYPES, true),
  );
  const hasSwapList =
    swapListSteps.length > 0 ||
    hasStepType(events, steps, [
      "SWAP_START",
      "DETERMINING_SWAP",
      "SOURCE_SWAP",
      "DESTINATION_SWAP",
      "BRIDGE_DEPOSIT",
      "SWAP_COMPLETE",
      "SWAP_SKIPPED",
    ]);
  const hasReceiveTokenStep =
    countListedSteps(swapListSteps, DESTINATION_SWAP_TYPES) > 0 ||
    countListedSteps(fallbackSteps, DESTINATION_SWAP_TYPES) > 0;
  const destinationSwapStarted = hasEventType(events, DESTINATION_SWAP_TYPES);
  const swapComplete = hasCompletedType(events, steps, [
    "SWAP_COMPLETE",
    "SWAP_SKIPPED",
  ]);
  const swapSkipped = hasCompletedType(events, steps, ["SWAP_SKIPPED"]);
  const shouldShowSwapRows =
    hasSwapList && !(swapSkipped && (mode === "deposit" || mode === "send"));
  const swapTokensComplete = hasReceiveTokenStep
    ? destinationSwapStarted
    : swapComplete;
  const receiveTokenComplete = hasReceiveTokenStep && swapComplete;
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
      Math.max(1, approvalCompletedCount + 1),
    );
    let state: ProgressStatusState = "default";
    if (failedStatus === "approveTokens") {
      state = "error";
    } else if (approvalCompletedCount >= immutableApprovalTotal) {
      state = "completed";
    } else if (
      hasStartedStatus(events, "approveTokens", mode) ||
      events.length === 0
    ) {
      state = "preapproval";
    }

    pushRow({
      id: "approveTokens",
      state,
      description: state === "preapproval" ? "Approve in wallet" : undefined,
      label:
        state === "completed"
          ? `Approved tokens for swap (${immutableApprovalTotal} of ${immutableApprovalTotal})`
          : state === "error"
            ? "Collection failed"
            : `Approve tokens for swap (${approvalCurrent} of ${immutableApprovalTotal})`,
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
      (hasStartedStatus(events, "swapTokens", mode) ||
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
              : destinationSwapStarted
                ? "inProgress"
                : "default",
        label:
          failedStatus === "receiveToken"
            ? refundEligibleFailure
              ? "Destination swap failed. Refund initiated."
              : "Destination swap failed."
            : receiveTokenComplete
              ? `Received ${destinationSymbol} on ${destinationChain}`
              : destinationSwapStarted
                ? `Receiving ${destinationSymbol} on ${destinationChain}`
                : `Receive ${destinationSymbol} on ${destinationChain}`,
      });
    }
  }

  if (mode === "deposit" || mode === "send") {
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
                ? `Approve ${destinationSymbol} deposit to ${opportunityName}`
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
        src={src}
        alt={label || ""}
        onError={() => setFailed(true)}
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
        height: 34,
        position: "relative",
        width: 34,
      }}
    >
      <MiniLogo src={tokenLogo} label={tokenSymbol} size={34} />
      {chainLogo && (
        <MiniLogo
          src={chainLogo}
          label={chainName}
          size={14}
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
  intentData,
  mode,
  opportunity,
  steps,
  progressEvents = [],
  failedStep,
}: NexusOneProgressScreenProps) {
  const intentSources = intentData?.sources ?? [];
  const intentDestination = intentData?.destination;
  const sourceSymbols =
    intentSources.length > 0
      ? unique(intentSources.map((source) => source.token.symbol))
      : unique(fromTokens.map((token) => token.symbol));
  const sourceUsd =
    intentSources.length > 0
      ? intentSources.reduce(
          (sum, source) => sum.plus(parseDecimal(source.value) ?? 0),
          new Decimal(0),
        )
      : parseDecimal(fromAmountUsd);
  const destinationAmount =
    (mode === "deposit" || mode === "send") && toAmount
      ? toAmount
      : (intentDestination?.amount ?? toAmount ?? "0");
  const destinationSymbol =
    intentDestination?.token.symbol ||
    toToken?.symbol ||
    opportunity?.tokenSymbol ||
    "";
  const destinationChainName =
    intentDestination?.chain.name || toToken?.chainName || "";
  const destinationChain =
    mode === "deposit"
      ? opportunity?.title || opportunity?.protocol || destinationChainName
      : destinationChainName;
  const computedApprovalTotal =
    getApprovalTotalFromSwapStepsList(progressEvents);
  const [lockedApprovalTotal, setLockedApprovalTotal] = useState<number | null>(
    null,
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
  const getRowHeight = (row: ProgressStatusRow) => (row.description ? 58 : 48);
  const collapsedStatusHeight = activeRow ? getRowHeight(activeRow) : 48;
  const expandedStatusHeight = statusRows.reduce(
    (sum, row) => sum + getRowHeight(row),
    0,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          background: "#FFFFFE",
          border: `1px solid ${border}`,
          borderRadius: "12px",
          boxShadow: "0px 1px 12px 0px #5B5B5B0D",
          boxSizing: "border-box",
          padding: "18px 20px 14px",
          width: "100%",
        }}
      >
        <div
          style={{
            color: muted,
            fontFamily,
            fontSize: "12px",
            lineHeight: "16px",
            textAlign: "center",
          }}
        >
          {formatSymbolSummary(sourceSymbols)}
        </div>
        <div
          style={{
            color: primary,
            fontFamily,
            fontSize: "22px",
            fontWeight: 600,
            lineHeight: "28px",
            marginTop: "2px",
            textAlign: "center",
          }}
        >
          {formatUsd(sourceUsd)}
        </div>

        <img
          src="https://files.availproject.org/nexus-elements/nexus-one/progress-grid.gif"
          alt=""
          aria-hidden="true"
          style={{
            display: "block",
            height: "148px",
            margin: "18px auto 12px",
            objectFit: "cover",
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
              fontSize: "20px",
              fontWeight: 600,
              gap: "8px",
              lineHeight: "26px",
            }}
          >
            <TokenLogoPair
              tokenLogo={
                (intentDestination?.token as any)?.logo || toToken?.logo
              }
              chainLogo={intentDestination?.chain.logo || toToken?.chainLogo}
              tokenSymbol={destinationSymbol}
              chainName={destinationChain}
            />
            <span>{formatDecimal(destinationAmount, 9)}</span>
            <span style={{ fontSize: "13px", lineHeight: "18px" }}>
              {destinationSymbol}
            </span>
          </div>
          {destinationChain && (
            <div
              style={{
                color: muted,
                fontFamily,
                fontSize: "12px",
                lineHeight: "16px",
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
          borderRadius: "10px",
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
              ? `${Math.max(48, expandedStatusHeight)}px`
              : `${collapsedStatusHeight}px`,
            overflow: "hidden",
            transition: "max-height 260ms ease",
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
                  type="button"
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
                    fontSize: "13px",
                    fontWeight: 400,
                    gap: "10px",
                    minHeight: `${getRowHeight(row)}px`,
                    padding: "12px 16px",
                    textAlign: "left",
                    transition:
                      "color 220ms ease, min-height 220ms ease, opacity 220ms ease",
                    width: "100%",
                  }}
                >
                  {isCompleted || isError ? (
                    <span
                      style={{
                        alignItems: "center",
                        background: isError ? danger : brand,
                        borderRadius: "999px",
                        color: "#FFFFFE",
                        display: "inline-flex",
                        height: "18px",
                        justifyContent: "center",
                        width: "18px",
                      }}
                    >
                      {isError ? (
                        <X style={{ height: 12, width: 12 }} />
                      ) : (
                        <Check style={{ height: 13, width: 13 }} />
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
                        height: "18px",
                        width: "18px",
                      }}
                    />
                  ) : (
                    <Loader2
                      className="animate-spin"
                      style={{ color: brand, height: 18, width: 18 }}
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
                          fontSize: "12px",
                          fontStyle: "italic",
                          fontWeight: 400,
                          lineHeight: "16px",
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
