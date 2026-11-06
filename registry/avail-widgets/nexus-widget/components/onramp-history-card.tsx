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
  const fg = settled ? "var(--nexus-widget-success-text, #168A47)" : pending ? "var(--nexus-widget-warning-text, #B7791F)" : "var(--nexus-widget-error-text, #E92C2C)";
  const bg = settled ? "var(--nexus-widget-success-background, #E8F6EF)" : pending ? "var(--nexus-widget-warning-background, #FFF3DE)" : "var(--nexus-widget-error-background, #FFE6EA)";
  return (
    <article aria-label={`Onramp with ${provider}`} className="nx-history-card">
      <div className="nx-history-top">
        <div className="nx-history-asset">
          <span className="nx-history-cash-icon"><CreditCard size={22} aria-hidden="true" /></span>
          <div>
            <div style={{ fontWeight: 400, fontSize: "13px", color: theme.colors.textSubtle }}>Onramp · {provider}</div>
            <div style={{ margin: "4px 0", fontSize: "20px", lineHeight: "24px", fontWeight: 500, overflowWrap: "anywhere" }}>
              {tokenAmount(amount)} {symbol}
            </div>
            <div style={{ fontSize: "12px", color: theme.colors.textSubtle }}>
              {settled && transaction?.destinationAmount ? "Received" : transaction?.destinationAmount ? "Tokens" : "Estimated"}
              {chainName ? ` on ${chainName}` : ""}
            </div>
          </div>
        </div>
        <div className="nx-history-meta">
          <span className="nx-history-status" style={{ color: fg, background: bg }}>
            {status}
          </span>
          <div style={{ fontSize: "12px", color: theme.colors.textSubtle }}>{relativeTime}</div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--nx-line-2)", marginTop: "16px", paddingTop: "12px", fontSize: "13px", lineHeight: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
          <span>
            {settled && transaction?.sourceAmount != null ? "Fiat spent" : "Fiat amount"}: {fiatAmount && fiatCurrency ? `${fiatAmount} ${fiatCurrency}` : "—"}
            {fiatAmount && transaction?.sourceAmount == null ? " (quoted)" : ""}
          </span>
          {explorerUrl && <a className="nx-history-link" href={explorerUrl} target="_blank" rel="noopener noreferrer" aria-label="View onramp transaction"
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
