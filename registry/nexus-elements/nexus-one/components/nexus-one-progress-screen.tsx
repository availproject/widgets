"use client";

import React, { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { Check, Loader2, X } from "lucide-react";
import { type BridgeStepType, type SwapStepType } from "@avail-project/nexus-core";
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
  step: ProgressSdkStep;
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
  | "confirmIntent"
  | "approveTokens"
  | "swapTokens"
  | "receiveToken"
  | "action";

type ProgressStatusState = "pending" | "loading" | "completed" | "error";

type ProgressStatusRow = {
  id: ProgressStatusId;
  label: string;
  description?: string;
  state: ProgressStatusState;
};

const STATUS_ORDER: ProgressStatusId[] = [
  "confirmIntent",
  "approveTokens",
  "swapTokens",
  "receiveToken",
  "action",
];

const getStatusLabel = (
  id: ProgressStatusId,
  mode: NexusOneMode,
  state: ProgressStatusState,
  context: {
    approvalCompletedCount?: number;
    approvalTotalCount?: number;
    destinationChain?: string;
    destinationSymbol?: string;
    opportunityName?: string;
  } = {},
) => {
  const isDeposit = mode === "deposit";
  const destinationSymbol = context.destinationSymbol || "token";
  const destinationChain = context.destinationChain || "destination";
  const opportunityName = context.opportunityName || "app";
  const approvalTotal = Math.max(1, context.approvalTotalCount ?? 1);
  const approvalCurrent = Math.min(
    approvalTotal,
    state === "completed"
      ? approvalTotal
      : Math.max(1, (context.approvalCompletedCount ?? 0) + 1),
  );

  if (id === "confirmIntent") {
    if (state === "completed") return "Intent approved";
    if (state === "error") return "Intent Cancelled";
    return "Confirm Intent";
  }

  if (id === "approveTokens") {
    if (state === "completed") {
      return `Approved tokens for swap (${approvalTotal} of ${approvalTotal})`;
    }
    if (state === "error") return "Collection failed";
    return `Approve tokens for swap (${approvalCurrent} of ${approvalTotal})`;
  }

  if (id === "swapTokens") {
    if (state === "loading") return "Swaps in progress";
    if (state === "completed") return "Swaps completed";
    if (state === "error") return "Swap failed. Refund initiated";
    return "Swap tokens";
  }

  if (id === "receiveToken") {
    if (state === "loading") {
      return `Receiving ${destinationSymbol} on ${destinationChain}`;
    }
    if (state === "completed") {
      return `Received ${destinationSymbol} on ${destinationChain}`;
    }
    if (state === "error") {
      return "Destination Swap Failed. USDC refund initiated.";
    }
    return `Receive ${destinationSymbol} on ${destinationChain}`;
  }

  if (isDeposit) {
    if (state === "pending") {
      return `Approve ${destinationSymbol} deposit to ${opportunityName}`;
    }
    if (state === "loading") {
      return `Depositing ${destinationSymbol} to ${opportunityName}`;
    }
    if (state === "completed") {
      return `${destinationSymbol} deposited to ${opportunityName}`;
    }
    return "Deposit failed. Funds are in your wallet.";
  }

  if (state === "pending") return `Send ${destinationSymbol}`;
  if (state === "loading") return `Sending ${destinationSymbol}`;
  if (state === "completed") return `${destinationSymbol} sent`;
  return "Send failed. Funds are in your wallet.";
};

const getStatusDescription = (
  id: ProgressStatusId,
  state: ProgressStatusState,
) => {
  if (state !== "loading") {
    return undefined;
  }

  if (
    id === "confirmIntent" ||
    id === "approveTokens" ||
    id === "action"
  ) {
    return "Approve in wallet";
  }

  return undefined;
};

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

  if (
    [
      "CREATE_PERMIT_EOA_TO_EPHEMERAL",
      "RFF_ID",
      "INTENT_ACCEPTED",
      "INTENT_HASH_SIGNED",
      "INTENT_SUBMITTED",
      "ALLOWANCE_USER_APPROVAL",
      "ALLOWANCE_APPROVAL_MINED",
      "ALLOWANCE_ALL_DONE",
    ].some((token) => type.includes(token))
  ) {
    return "confirmIntent";
  }

  if (type.includes("SWAP_START") || type.includes("DETERMINING_SWAP")) {
    return "swapTokens";
  }

  if (type.includes("CREATE_PERMIT_FOR_SOURCE_SWAP")) {
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

const stepMatches = (
  step: ProgressSdkStep | undefined,
  tokens: string[],
) => {
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

  return steps.some(
    (item) => item.completed && stepMatches(item.step, tokens),
  );
};

const hasStepType = (
  events: NexusOneProgressEvent[],
  steps: ProgressStep[],
  tokens: string[],
) =>
  events.some((event) => stepMatches(event.step, tokens)) ||
  steps.some((item) => stepMatches(item.step, tokens));

const hasEventType = (
  events: NexusOneProgressEvent[],
  tokens: string[],
) => events.some((event) => stepMatches(event.step, tokens));

const getStepKey = (step: ProgressSdkStep | undefined) => {
  if (!step) return "";
  const raw = (step as any)?.typeID ?? (step as any)?.type;
  if (raw) return String(raw);
  try {
    return JSON.stringify(step);
  } catch {
    return String(step);
  }
};

const countUniqueSteps = (
  events: NexusOneProgressEvent[],
  steps: ProgressStep[],
  tokens: string[],
  completedOnly = false,
) => {
  const keys = new Set<string>();

  for (const item of steps) {
    if (completedOnly && !item.completed) continue;
    if (!stepMatches(item.step, tokens)) continue;
    keys.add(getStepKey(item.step));
  }

  for (const event of events) {
    if (completedOnly && !event.completed) continue;
    if (!stepMatches(event.step, tokens)) continue;
    keys.add(getStepKey(event.step));
  }

  return keys.size;
};

const hasStartedStatus = (
  events: NexusOneProgressEvent[],
  id: ProgressStatusId,
  mode: NexusOneMode,
) => events.some((event) => getStatusForStep(event.step, mode) === id);

const isStatusCompleted = (
  id: ProgressStatusId,
  events: NexusOneProgressEvent[],
  steps: ProgressStep[],
  mode: NexusOneMode,
) => {
  if (id === "confirmIntent") {
    return (
      hasCompletedType(events, steps, [
        "CREATE_PERMIT_EOA_TO_EPHEMERAL",
        "RFF_ID",
        "INTENT_SUBMITTED",
        "CREATE_PERMIT_FOR_SOURCE_SWAP",
        "SOURCE_SWAP_HASH",
        "DESTINATION_SWAP_HASH",
        "SWAP_COMPLETE",
        "SWAP_SKIPPED",
        "TRANSACTION_SENT",
        "TRANSACTION_CONFIRMED",
      ]) ||
      hasStartedStatus(events, "approveTokens", mode) ||
      hasEventType(events, [
        "SOURCE_SWAP",
        "BRIDGE_DEPOSIT",
        "DESTINATION_SWAP",
        "SWAP_COMPLETE",
        "SWAP_SKIPPED",
        "TRANSACTION_SENT",
        "TRANSACTION_CONFIRMED",
      ])
    );
  }

  if (id === "approveTokens") {
    const total = countUniqueSteps(events, steps, [
      "CREATE_PERMIT_FOR_SOURCE_SWAP",
    ]);
    if (total === 0) return false;
    const completed = countUniqueSteps(
      events,
      steps,
      ["CREATE_PERMIT_FOR_SOURCE_SWAP"],
      true,
    );
    return (
      completed >= total ||
      hasEventType(events, [
        "SOURCE_SWAP",
        "BRIDGE_DEPOSIT",
        "DESTINATION_SWAP",
        "SWAP_COMPLETE",
        "SWAP_SKIPPED",
        "TRANSACTION_SENT",
        "TRANSACTION_CONFIRMED",
      ])
    );
  }

  if (id === "swapTokens") {
    return hasCompletedType(events, steps, [
      "SOURCE_SWAP_HASH",
      "SWAP_COMPLETE",
      "SWAP_SKIPPED",
      "BRIDGE_DEPOSIT",
      "DESTINATION_SWAP_HASH",
      "TRANSACTION_SENT",
      "TRANSACTION_CONFIRMED",
    ]);
  }

  if (id === "receiveToken") {
    return hasCompletedType(events, steps, [
      "DESTINATION_SWAP_HASH",
      "SWAP_COMPLETE",
      "SWAP_SKIPPED",
      "TRANSACTION_SENT",
      "TRANSACTION_CONFIRMED",
    ]);
  }

  return mode === "swap"
    ? false
    : hasCompletedType(events, steps, ["TRANSACTION_CONFIRMED"]);
};

const getStatusState = (
  id: ProgressStatusId,
  events: NexusOneProgressEvent[],
  steps: ProgressStep[],
  mode: NexusOneMode,
  failedStatus: ProgressStatusId | null,
): ProgressStatusState => {
  if (failedStatus === id) return "error";
  if (isStatusCompleted(id, events, steps, mode)) return "completed";

  if (id === "swapTokens") {
    const approvalsTotal = countUniqueSteps(events, steps, [
      "CREATE_PERMIT_FOR_SOURCE_SWAP",
    ]);
    const approvalsCompleted = countUniqueSteps(
      events,
      steps,
      ["CREATE_PERMIT_FOR_SOURCE_SWAP"],
      true,
    );
    const approvalsSatisfied =
      approvalsTotal === 0 || approvalsCompleted >= approvalsTotal;
    if (approvalsSatisfied && hasStartedStatus(events, id, mode)) {
      return "loading";
    }
  } else if (id === "receiveToken") {
    if (
      hasStartedStatus(events, id, mode) ||
      hasEventType(events, [
        "BRIDGE_DEPOSIT",
        "DESTINATION_SWAP_BATCH_TX",
        "DESTINATION_SWAP_HASH",
        "SWAP_COMPLETE",
        "SWAP_SKIPPED",
      ])
    ) {
      return "loading";
    }
  } else if (hasStartedStatus(events, id, mode)) {
    return "loading";
  }

  return "pending";
};

const buildStatusRows = ({
  events,
  failedStep,
  mode,
  steps,
  context,
}: {
  events: NexusOneProgressEvent[];
  failedStep?: ProgressSdkStep | null;
  mode: NexusOneMode;
  steps: ProgressStep[];
  context: {
    destinationChain?: string;
    destinationSymbol?: string;
    opportunityName?: string;
  };
}): ProgressStatusRow[] => {
  const failedStatus = failedStep ? getStatusForStep(failedStep, mode) : null;
  const involvedStatuses: ProgressStatusId[] = [];
  const approvalTotalCount = countUniqueSteps(events, steps, [
    "CREATE_PERMIT_FOR_SOURCE_SWAP",
  ]);
  const approvalCompletedCount = countUniqueSteps(
    events,
    steps,
    ["CREATE_PERMIT_FOR_SOURCE_SWAP"],
    true,
  );
  const addStatus = (id: ProgressStatusId | null) => {
    if (!id) return;
    if (mode === "swap" && id === "action") return;
    if (!involvedStatuses.includes(id)) {
      involvedStatuses.push(id);
    }
  };

  addStatus("confirmIntent");

  for (const item of steps) {
    addStatus(getStatusForStep(item.step, mode));
  }
  for (const event of events) {
    addStatus(getStatusForStep(event.step, mode));
  }
  addStatus(failedStatus);

  if (approvalTotalCount > 0) {
    addStatus("approveTokens");
  }

  if (mode === "swap") {
    addStatus("swapTokens");
    addStatus("receiveToken");
  }

  if (
    hasStepType(events, steps, [
      "BRIDGE_DEPOSIT",
      "DESTINATION_SWAP",
      "SWAP_COMPLETE",
      "SWAP_SKIPPED",
    ])
  ) {
    addStatus("receiveToken");
  }

  if (mode === "deposit" || mode === "send") {
    addStatus("action");
  }

  if (involvedStatuses.length === 0) {
    addStatus("confirmIntent");
  }

  const orderedStatuses = involvedStatuses.sort(
    (a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b),
  );
  const visibleStatuses = failedStatus
    ? orderedStatuses.filter(
        (id) => STATUS_ORDER.indexOf(id) <= STATUS_ORDER.indexOf(failedStatus),
      )
    : orderedStatuses;

  const contextWithCounts = {
    ...context,
    approvalCompletedCount,
    approvalTotalCount,
  };
  const rows = visibleStatuses
    .map((id) => {
      const state = getStatusState(id, events, steps, mode, failedStatus);

      return {
        id,
        description: getStatusDescription(id, state),
        label: getStatusLabel(id, mode, state, contextWithCounts),
        state,
      };
    });

  if (failedStatus || rows.some((row) => row.state === "loading")) {
    return rows;
  }

  const nextActiveIndex = rows.findIndex((row) => row.state === "pending");
  if (nextActiveIndex === -1) return rows;

  return rows.map((row, index) => {
    if (index !== nextActiveIndex) return row;

    return {
      ...row,
      description: getStatusDescription(row.id, "loading"),
      label:
        row.id === "action"
          ? row.label
          : getStatusLabel(row.id, mode, "loading", contextWithCounts),
      state: "loading",
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
  const destinationAmount = intentDestination?.amount ?? toAmount ?? "0";
  const destinationSymbol =
    intentDestination?.token.symbol || toToken?.symbol || opportunity?.tokenSymbol || "";
  const destinationChainName =
    intentDestination?.chain.name || toToken?.chainName || "";
  const destinationChain =
    mode === "deposit"
      ? opportunity?.title || opportunity?.protocol || destinationChainName
      : destinationChainName;
  const statusRows = buildStatusRows({
    events: progressEvents,
    failedStep,
    mode,
    steps: steps ?? [],
    context: {
      destinationChain: destinationChainName || destinationChain,
      destinationSymbol,
      opportunityName: opportunity?.title || opportunity?.protocol,
    },
  });

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
          src="/nexus-one/progress-grid.gif"
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
              tokenLogo={(intentDestination?.token as any)?.logo || toToken?.logo}
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
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {statusRows.map((row) => {
          const isCompleted = row.state === "completed";
          const isError = row.state === "error";
          const isPending = row.state === "pending";
          const isLoading = row.state === "loading";

          return (
            <div
              key={row.id}
              className="animate-in fade-in slide-in-from-top-2 duration-300"
              style={{
                alignItems: isLoading ? "flex-start" : "center",
                background: "#FFFFFE",
                border: `1px solid ${border}`,
                borderRadius: "10px",
                boxShadow: "0px 1px 12px 0px #5B5B5B0D",
                boxSizing: "border-box",
                color: primary,
                display: "flex",
                fontFamily,
                fontSize: "13px",
                fontWeight: 600,
                gap: "10px",
                minHeight: isLoading ? "58px" : "48px",
                padding: "12px 16px",
                transition:
                  "opacity 220ms ease, transform 220ms ease, min-height 220ms ease",
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
              ) : isPending ? (
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
                <span>{row.label}</span>
                {row.description && (
                  <span
                    style={{
                      color: isLoading ? brand : muted,
                      fontSize: "12px",
                      fontStyle: "italic",
                      fontWeight: 500,
                      lineHeight: "16px",
                    }}
                  >
                    {row.description}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
