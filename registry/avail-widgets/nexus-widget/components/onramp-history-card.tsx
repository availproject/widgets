import React from "react";
import Decimal from "decimal.js";
import { CreditCard, ExternalLink } from "lucide-react";
import { nexusWidgetTheme as theme } from "../theme";
import { getNormalizedOnrampState, isOnrampTerminalState } from "../utils/onramp-session";
import type { OnrampHistoryEntry } from "../utils/onramp-history";

const displayName = (value?: string) => value?.split(/[_\s-]+/)
  .filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase()).join(" ");

const tokenAmount = (value?: string) => {
  if (value == null) return "—";
  try {
    const amount = new Decimal(value);
    return amount.isFinite() && amount.gte(0)
      ? amount.toDecimalPlaces(8, Decimal.ROUND_DOWN).toFixed() : "—";
  } catch { return "—"; }
};

export function OnrampHistoryCard({
  entry, relativeTime, chainName, explorerUrl,
}: { entry: OnrampHistoryEntry; relativeTime: string; chainName?: string; explorerUrl?: string | null }) {
  const { session, context } = entry;
  const transaction = session.transaction;
  const state = getNormalizedOnrampState(session.state);
  const settled = state === "SETTLED";
  const pending = !isOnrampTerminalState(state);
  const status = settled ? "Completed" : pending ? "Pending"
    : state === "REFUNDED" ? "Refunded" : state === "CANCELLED" ? "Cancelled"
      : ["EXPIRED", "AUTHORIZATION_EXPIRED"].includes(state) ? "Expired" : "Failed";
  const provider = displayName(session.provider ?? context.provider) ?? "Payment partner";
  const method = session.paymentMethodType ?? context.paymentMethodType;
  const amount = transaction?.destinationAmount ?? context.destinationAmount;
  const symbol = context.tokenSymbol ?? transaction?.destinationCurrencyCode ?? "tokens";
  const fiatAmount = transaction?.sourceAmount ?? context.sourceAmount;
  const fiatCurrency = transaction?.sourceCurrencyCode ?? context.sourceCurrencyCode;
  const fg = settled ? "#168A47" : pending ? "#B7791F" : "#E92C2C";
  const bg = settled ? "#E8F6EF" : pending ? "#FFF3DE" : "#FFE6EA";
  return (
    <article aria-label={`Onramp with ${provider}`} style={{
      background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
      borderRadius: "10px", padding: "12px 14px", fontFamily: theme.fonts.sans,
      color: theme.colors.textStrong,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", minWidth: 0 }}>
          <CreditCard size={26} aria-hidden="true" />
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px" }}>Onramp · {provider}</div>
            <div style={{ marginTop: "4px", fontSize: "17px", fontWeight: 700 }}>
              {tokenAmount(amount)} {symbol}
            </div>
            <div style={{ fontSize: "12px", color: theme.colors.textSubtle }}>
              {settled && transaction?.destinationAmount ? "Received" : transaction?.destinationAmount ? "Tokens" : "Estimated"}
              {chainName ? ` on ${chainName}` : ""}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ color: fg, background: bg, borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 600 }}>
            {status}
          </span>
          <div style={{ marginTop: "8px", fontSize: "12px", color: theme.colors.textSubtle }}>{relativeTime}</div>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${theme.colors.border}`, marginTop: "12px", paddingTop: "10px", fontSize: "13px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
          <span>
            {settled && transaction?.sourceAmount != null ? "Fiat spent" : "Fiat amount"}: {fiatAmount && fiatCurrency ? `${fiatAmount} ${fiatCurrency}` : "—"}
            {fiatAmount && transaction?.sourceAmount == null ? " (quoted)" : ""}
          </span>
          {explorerUrl && <a href={explorerUrl} target="_blank" rel="noopener noreferrer" aria-label="View onramp transaction"
            style={{ color: "var(--foreground-brand)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            View transaction <ExternalLink size={12} aria-hidden="true" />
          </a>}
        </div>
        {method && <div style={{ marginTop: "5px", color: theme.colors.textSubtle }}>Payment method: {displayName(method)}</div>}
        {pending && <div style={{ marginTop: "5px", color: theme.colors.textSubtle }}>Payment status refreshes while history is open.</div>}
      </div>
    </article>
  );
}
