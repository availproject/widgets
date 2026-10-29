// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import React from "react";
import { nexusWidgetTheme } from "../theme";

interface DepositFundingMethodProps {
  enableOnRamp?: boolean;
  isBalanceLoading?: boolean;
  onSelectLocalCurrency: () => void;
  onSelectWallet: () => void;
  primaryButtonForeground: string;
  totalBalance: string;
  title?: string;
  slideFromLeft?: boolean;
  onClose?: () => void;
}

const theme = nexusWidgetTheme;

const CHEVRON = (
  <svg
    aria-hidden="true"
    fill="none"
    height="16"
    viewBox="0 0 16 16"
    width="16"
  >
    <path
      d="M6 3.5L10.5 8L6 12.5"
      stroke="var(--nx-faint, #A3A3A2)"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </svg>
);

function LabeledButton({
  label: _label,
  ...props
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  void _label;
  return <button {...props} />;
}

function MethodRow({
  description,
  hasDivider,
  icon,
  label,
  onClick,
  tileBackground,
}: {
  description: string;
  hasDivider?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tileBackground: string;
}) {

  return (
    <>
      <LabeledButton
        label={label}
        onClick={onClick}
        className="nx-method-row"
        style={{
          alignItems: "center",
          background: undefined,
          border: "none",
          borderRadius: "18px",
          boxSizing: "border-box",
          cursor: "pointer",
          display: "flex",
          gap: "12px",
          padding: "12px",
          textAlign: "left",
          transition:
            "background-color 150ms cubic-bezier(.23,1,.32,1), transform 100ms cubic-bezier(.23,1,.32,1)",
          width: "100%",
        }}
        type="button"
      >
        <span
          style={{
            alignItems: "center",
            background: tileBackground,
            borderRadius: "14px",
            display: "grid",
            flexShrink: 0,
            height: "44px",
            justifyItems: "center",
            width: "44px",
          }}
        >
          {icon}
        </span>
        <span
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            gap: "2px",
            minWidth: 0,
          }}
        >
          <span
            style={{
              color: "var(--nx-ink, #161615)",
              fontFamily: theme.fonts.sans,
              fontSize: "16px",
              fontWeight: 500,
              lineHeight: "20px",
            }}
          >
            {label}
          </span>
          <span
            style={{
              color: "var(--nx-mute-2, #8C8C8B)",
              fontFamily: theme.fonts.sans,
              fontSize: "14px",
              fontWeight: 400,
              lineHeight: "18px",
            }}
          >
            {description}
          </span>
        </span>
        {CHEVRON}
      </LabeledButton>
      {hasDivider ? (
        <div
          style={{
            background: "var(--nx-line, #F0F0F0)",
            height: "1px",
            margin: "0 14px",
          }}
        />
      ) : null}
    </>
  );
}

export function DepositFundingMethod({
  enableOnRamp = false,
  isBalanceLoading = false,
  onSelectLocalCurrency,
  onSelectWallet,
  primaryButtonForeground: _primaryButtonForeground,
  totalBalance: _totalBalance,
  title = "Deposit",
  slideFromLeft = false,
  onClose,
}: DepositFundingMethodProps) {
  void _primaryButtonForeground;
  void _totalBalance;
  void isBalanceLoading;

  return (
    <div
      className={`nx-deposit-screen${slideFromLeft ? " nx-back" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      <div
        className="nx-card"
        style={{
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            alignItems: "center",
            borderBottom: "1px solid var(--nx-line, #F0F0F0)",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            padding: "12px",
          }}
        >
          <div
            style={{
              color: "var(--nx-ink, #161615)",
              fontFamily: theme.fonts.display,
              fontSize: "20px",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: "24px",
            }}
          >
            Deposit to {title}
          </div>
          {onClose ? (
            <button
              aria-label="Close"
              onClick={onClose}
              style={{
                alignItems: "center",
                background: "var(--nx-fill, #F3F3F3)",
                border: "none",
                borderRadius: "999px",
                cursor: "pointer",
                display: "grid",
                height: 32,
                placeItems: "center",
                width: 32,
              }}
              type="button"
            >
              <svg fill="none" height="13" viewBox="0 0 13 13" width="13">
                <path d="M3 3L10 10M10 3L3 10" stroke="var(--nx-ink-2, #3A3A39)" strokeLinecap="round" strokeWidth="1.5" />
              </svg>
            </button>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", paddingTop: "4px" }}>
          <MethodRow
            description="Pay using your crypto wallet"
            hasDivider={enableOnRamp}
            icon={
              <img
                alt=""
                height={26}
                src="https://files.availproject.org/widgets/assets/metamask.png"
                width={26}
              />
            }
            label="Pay from your wallet"
            onClick={onSelectWallet}
            tileBackground="var(--nx-tile-mm, #FFF4EA)"
          />
          {enableOnRamp ? (
            <MethodRow
              description="Card, Apple Pay or bank transfer"
              icon={
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="20"
                  viewBox="0 0 20 20"
                  width="20"
                >
                  <rect
                    height="10.5"
                    rx="2"
                    stroke="var(--nx-ink-2, #3A3A39)"
                    strokeWidth="1.5"
                    width="15"
                    x="2.5"
                    y="5"
                  />
                  <path
                    d="M2.5 8.5H17.5M5.5 12.5H8.5"
                    stroke="var(--nx-ink-2, #3A3A39)"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
              }
              label="Cash"
              onClick={onSelectLocalCurrency}
              tileBackground="var(--nx-fill, #F3F3F3)"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
