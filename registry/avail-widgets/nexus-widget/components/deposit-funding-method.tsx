// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import { CreditCard, Wallet } from "lucide-react";
import React from "react";
import { nexusWidgetTheme } from "../theme";

type FundingMethod = "wallet" | "local-currency";

interface DepositFundingMethodProps {
  onSelectLocalCurrency: () => void;
  onSelectWallet: () => void;
  primaryButtonForeground: string;
  totalBalance: string;
}

const theme = nexusWidgetTheme;
const brand = "var(--foreground-brand)";

const optionBaseStyle: React.CSSProperties = {
  alignItems: "center",
  backgroundColor: theme.colors.surface,
  borderRadius: "12px",
  borderStyle: "solid",
  borderWidth: "1px",
  boxSizing: "border-box",
  cursor: "pointer",
  display: "flex",
  gap: "10px",
  minHeight: "66px",
  padding: "12px",
  textAlign: "left",
  width: "100%",
};

function MethodIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: "7px",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        height: "36px",
        justifyContent: "center",
        width: "36px",
      }}
    >
      {children}
    </div>
  );
}

function RadioMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        alignItems: "center",
        border: `1.5px solid ${selected ? brand : theme.colors.border}`,
        borderRadius: "999px",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        height: "20px",
        justifyContent: "center",
        width: "20px",
      }}
    >
      {selected && (
        <span
          style={{
            backgroundColor: brand,
            borderRadius: "999px",
            height: "10px",
            width: "10px",
          }}
        />
      )}
    </span>
  );
}

function FundingOption({
  active,
  amount,
  description,
  icon,
  label,
  onClick,
  recommended,
}: {
  active: boolean;
  amount?: string;
  description: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...optionBaseStyle,
        borderColor: active ? brand : theme.colors.divider,
      }}
      type="button"
    >
      <MethodIcon>{icon}</MethodIcon>
      <div
        style={{
          display: "flex",
          flex: "1 1 0%",
          flexDirection: "column",
          gap: "4px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "7px",
          }}
        >
          <span
            style={{
              color: theme.colors.textStrong,
              fontFamily: theme.fonts.sans,
              fontSize: "15px",
              fontWeight: 500,
              letterSpacing: "0",
              lineHeight: "19px",
            }}
          >
            {label}
          </span>
          {recommended && (
            <span
              style={{
                backgroundColor: "#E8F5E9",
                borderRadius: "999px",
                color: "#2E7D32",
                fontFamily: theme.fonts.sans,
                fontSize: "11px",
                fontWeight: 500,
                lineHeight: "14px",
                padding: "2px 8px",
              }}
            >
              Recommended
            </span>
          )}
        </div>
        <span
          style={{
            color: theme.colors.textSubtle,
            fontFamily: theme.fonts.sans,
            fontSize: "13px",
            letterSpacing: "0",
            lineHeight: "17px",
          }}
        >
          {description}
        </span>
      </div>
      {amount && (
        <span
          style={{
            color: theme.colors.textStrong,
            flexShrink: 0,
            fontFamily: theme.fonts.display,
            fontSize: "15px",
            fontWeight: 500,
            letterSpacing: "0",
            lineHeight: "20px",
          }}
        >
          ${amount}
        </span>
      )}
      <RadioMark selected={active} />
    </button>
  );
}

export function DepositFundingMethod({
  onSelectLocalCurrency,
  onSelectWallet,
  primaryButtonForeground,
  totalBalance,
}: DepositFundingMethodProps) {
  const [selectedMethod, setSelectedMethod] =
    React.useState<FundingMethod | null>(null);

  const handleContinue = () => {
    if (!selectedMethod) return;
    if (selectedMethod === "wallet") {
      onSelectWallet();
      return;
    }
    onSelectLocalCurrency();
  };

  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
      }}
    >
      <div
        style={{
          color: theme.colors.textSubtle,
          fontFamily: theme.fonts.sans,
          fontSize: "13px",
          lineHeight: "17px",
        }}
      >
        Select a funding method
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <FundingOption
          active={selectedMethod === "wallet"}
          amount={totalBalance}
          description="Wallet balance"
          icon={
            <Wallet
              aria-hidden="true"
              color={theme.colors.textStrong}
              size={20}
              strokeWidth={1.7}
            />
          }
          label="Pay with Wallet"
          onClick={() => {
            setSelectedMethod("wallet");
          }}
        />
        <FundingOption
          active={selectedMethod === "local-currency"}
          description="Card, Apple Pay, UPI"
          icon={
            <CreditCard
              aria-hidden="true"
              color={theme.colors.textStrong}
              size={20}
              strokeWidth={1.7}
            />
          }
          label="Pay with Local Currency"
          onClick={() => {
            setSelectedMethod("local-currency");
          }}
          recommended
        />
      </div>
      <button
        disabled={!selectedMethod}
        onClick={handleContinue}
        style={{
          alignItems: "center",
          backgroundColor: selectedMethod ? brand : theme.colors.surfaceCool,
          border: "none",
          borderRadius: theme.radius.primaryButton,
          boxShadow: selectedMethod ? theme.shadows.primaryButton : "none",
          boxSizing: "border-box",
          color: selectedMethod ? primaryButtonForeground : theme.colors.muted,
          cursor: selectedMethod ? "pointer" : "default",
          display: "flex",
          fontFamily: theme.fonts.sans,
          fontSize: "14px",
          fontWeight: 500,
          height: "44px",
          justifyContent: "center",
          lineHeight: "18px",
          marginTop: "4px",
          width: "100%",
        }}
        type="button"
      >
        Continue
      </button>
    </div>
  );
}
