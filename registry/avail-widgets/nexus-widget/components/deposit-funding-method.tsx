// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import React from "react";
import { nexusWidgetTheme } from "../theme";

type FundingMethod = "wallet" | "local-currency" | "transfer-crypto" | "hyperliquid";

interface DepositFundingMethodProps {
  enableOnRamp?: boolean;
  enableTransferCrypto?: boolean;
  enableHyperliquid?: boolean;
  isBalanceLoading?: boolean;
  onSelectLocalCurrency: () => void;
  onSelectWallet: () => void;
  onSelectTransferCrypto?: () => void;
  onSelectHyperliquid?: () => void;
  primaryButtonForeground?: string;
  totalBalance?: string;
  title?: string;
  slideFromLeft?: boolean;
  onBack?: () => void;
  onClose?: () => void;
}

interface LogoItem {
  alt: string;
  height?: string;
  url: string;
  width?: string;
}

const WALLET_LOGOS: LogoItem[] = [
  {
    alt: "MetaMask",
    height: "22px",
    url: "https://files.availproject.org/widgets/assets/metamask.png",
    width: "22px",
  },
  {
    alt: "Rabby",
    height: "22px",
    url: "https://files.availproject.org/widgets/assets/rabby.png",
    width: "22px",
  },
  {
    alt: "Coinbase",
    height: "22px",
    url: "https://files.availproject.org/widgets/assets/coinbase.png",
    width: "22px",
  },
];

const theme = nexusWidgetTheme;

function RadioMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        alignItems: "center",
        backgroundColor: "transparent",
        borderColor: selected ? "var(--nx-blue, #006BF4)" : "var(--nx-ring, #CFCFCD)",
        borderRadius: "999px",
        borderStyle: "solid",
        borderWidth: selected ? "2px" : "1.5px",
        boxSizing: "border-box",
        display: "inline-flex",
        flexShrink: 0,
        height: "18px",
        justifyContent: "center",
        transition: "border-color 150ms ease, border-width 150ms ease",
        width: "18px",
      }}
    >
      {selected ? (
        <span
          style={{
            backgroundColor: "var(--nx-blue, #006BF4)",
            borderRadius: "999px",
            display: "block",
            height: "8px",
            width: "8px",
          }}
        />
      ) : null}
    </span>
  );
}

function LogoStack({ items }: { items: LogoItem[] }) {
  return (
    <div
      style={{
        alignItems: "center",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.alt}
          style={{
            alignItems: "center",
            backgroundColor: "var(--nx-card, #FFFFFF)",
            borderRadius: "999px",
            boxShadow: "0 0 0 1.5px var(--nx-card, #FFFFFF)",
            boxSizing: "border-box",
            display: "grid",
            flexShrink: 0,
            height: "28px",
            marginLeft: index === 0 ? "0px" : "-8px",
            placeItems: "center",
            position: "relative",
            width: "28px",
            zIndex: index + 1,
          }}
        >
          <img
            alt={item.alt}
            src={item.url}
            style={{
              height: item.height ?? "20px",
              objectFit: "contain",
              width: item.width ?? "20px",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function MethodOptionRow({
  active,
  description,
  hasDivider,
  label,
  onClick,
  rightContent,
}: {
  active: boolean;
  description: React.ReactNode;
  hasDivider?: boolean;
  label: string;
  onClick: () => void;
  rightContent: React.ReactNode;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <>
      <button
        aria-label={label}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          alignItems: "center",
          backgroundColor: isHovered
            ? "var(--nx-fill-soft, rgba(0, 0, 0, 0.02))"
            : "transparent",
          border: "none",
          borderRadius: "14px",
          boxSizing: "border-box",
          cursor: "pointer",
          display: "flex",
          gap: "12px",
          justifyContent: "space-between",
          padding: "14px 12px",
          textAlign: "left",
          transition: "background-color 150ms ease",
          width: "100%",
        }}
        type="button"
        {...({ label } as any)}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            gap: "2px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              color: "var(--nx-ink, #161615)",
              fontFamily: theme.fonts.sans,
              fontSize: "16px",
              fontWeight: 500,
              lineHeight: "20px",
            }}
          >
            {label}
          </div>
          <div
            style={{
              color: "var(--nx-mute-2, #8C8C8B)",
              fontFamily: theme.fonts.sans,
              fontSize: "14px",
              fontWeight: 400,
              lineHeight: "18px",
            }}
          >
            {description}
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexShrink: 0,
            gap: "12px",
          }}
        >
          {rightContent}
          <RadioMark selected={active} />
        </div>
      </button>
      {hasDivider ? (
        <div
          style={{
            background: "var(--nx-line, #F0F0F0)",
            height: "1px",
            margin: "0 12px",
          }}
        />
      ) : null}
    </>
  );
}

export function DepositFundingMethod({
  enableOnRamp = false,
  enableTransferCrypto = false,
  enableHyperliquid = false,
  isBalanceLoading = false,
  onSelectLocalCurrency,
  onSelectWallet,
  onSelectTransferCrypto,
  onSelectHyperliquid,
  primaryButtonForeground = "#FFFFFF",
  totalBalance = "0.00",
  title = "Deposit",
  slideFromLeft = false,
  onBack,
  onClose,
}: DepositFundingMethodProps) {
  const [selectedMethod, setSelectedMethod] =
    React.useState<FundingMethod | null>(null);

  React.useEffect(() => {
    if (!enableOnRamp && selectedMethod === "local-currency") {
      setSelectedMethod(null);
    }
    if (!enableTransferCrypto && selectedMethod === "transfer-crypto") {
      setSelectedMethod(null);
    }
    if (!enableHyperliquid && selectedMethod === "hyperliquid") {
      setSelectedMethod(null);
    }
  }, [enableOnRamp, enableTransferCrypto, enableHyperliquid, selectedMethod]);

  const handleContinue = () => {
    if (!selectedMethod) return;
    if (selectedMethod === "wallet") {
      onSelectWallet();
      return;
    }
    if (selectedMethod === "local-currency" && enableOnRamp) {
      onSelectLocalCurrency();
      return;
    }
    if (selectedMethod === "transfer-crypto") {
      onSelectTransferCrypto?.();
      return;
    }
    if (selectedMethod === "hyperliquid") {
      onSelectHyperliquid?.();
      return;
    }
  };

  const navBack = onBack || onClose;

  const showCash = Boolean(enableOnRamp);
  const showTransferCrypto = Boolean(enableTransferCrypto);
  const showHyperliquid = Boolean(enableHyperliquid);

  const formattedBalance = totalBalance
    ? totalBalance.startsWith("$")
      ? totalBalance
      : `$${totalBalance}`
    : "$0.00";

  const options: Array<{
    id: FundingMethod;
    label: string;
    description: React.ReactNode;
    rightContent: React.ReactNode;
  }> = [
    {
      id: "wallet",
      label: "Pay from your wallet",
      description: isBalanceLoading ? (
        <span
          style={{
            alignItems: "center",
            display: "inline-flex",
            gap: "4px",
          }}
        >
          <span>Wallet balance: </span>
          <span
            className="nx-shim"
            style={{
              borderRadius: "4px",
              display: "inline-block",
              height: "14px",
              width: "48px",
            }}
          />
        </span>
      ) : (
        `Wallet balance: ${formattedBalance}`
      ),
      rightContent: <LogoStack items={WALLET_LOGOS} />,
    },
    ...(showCash
      ? [
          {
            id: "local-currency" as const,
            label: "Cash",
            description: "Card, Apple Pay or bank transfer",
            rightContent: (
              <div
                style={{
                  alignItems: "center",
                  backgroundColor: "var(--nx-fill, #F3F3F3)",
                  borderRadius: "999px",
                  display: "grid",
                  height: "32px",
                  placeItems: "center",
                  width: "32px",
                }}
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  viewBox="0 0 20 20"
                  width="18"
                >
                  <rect
                    height="11"
                    rx="2"
                    stroke="var(--nx-ink-2, #3A3A39)"
                    strokeWidth="1.5"
                    width="15"
                    x="2.5"
                    y="4.5"
                  />
                  <path
                    d="M2.5 8H17.5M5.5 12H8.5"
                    stroke="var(--nx-ink-2, #3A3A39)"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            ),
          },
        ]
      : []),
    ...(showTransferCrypto
      ? [
          {
            id: "transfer-crypto" as const,
            label: "Transfer crypto",
            description: "Send from another wallet or exchange",
            rightContent: (
              <div
                style={{
                  alignItems: "center",
                  backgroundColor: "var(--nx-fill, #F3F3F3)",
                  borderRadius: "999px",
                  display: "grid",
                  height: "32px",
                  placeItems: "center",
                  width: "32px",
                }}
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  viewBox="0 0 18 18"
                  width="18"
                >
                  <rect
                    height="5"
                    rx="1.5"
                    stroke="var(--nx-ink-2, #3A3A39)"
                    strokeWidth="1.5"
                    width="5"
                    x="2"
                    y="2"
                  />
                  <rect
                    height="5"
                    rx="1.5"
                    stroke="var(--nx-ink-2, #3A3A39)"
                    strokeWidth="1.5"
                    width="5"
                    x="11"
                    y="2"
                  />
                  <rect
                    height="5"
                    rx="1.5"
                    stroke="var(--nx-ink-2, #3A3A39)"
                    strokeWidth="1.5"
                    width="5"
                    x="2"
                    y="11"
                  />
                  <rect
                    height="5"
                    rx="1.5"
                    stroke="var(--nx-ink-2, #3A3A39)"
                    strokeWidth="1.5"
                    width="5"
                    x="11"
                    y="11"
                  />
                </svg>
              </div>
            ),
          },
        ]
      : []),
    ...(showHyperliquid
      ? [
          {
            id: "hyperliquid" as const,
            label: "Hyperliquid",
            description: "Use your USDC on Hyperliquid",
            rightContent: (
              <div
                style={{
                  alignItems: "center",
                  backgroundColor: "var(--nx-fill, #F3F3F3)",
                  borderRadius: "999px",
                  display: "grid",
                  height: "32px",
                  placeItems: "center",
                  width: "32px",
                }}
              >
                <img
                  alt="Hyperliquid"
                  src="https://files.availproject.org/widgets/assets/hyperliquid.png"
                  style={{
                    height: "20px",
                    objectFit: "contain",
                    width: "20px",
                  }}
                />
              </div>
            ),
          },
        ]
      : []),
  ];

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
          display: "flex",
          flexDirection: "column",
          padding: "8px",
        }}
      >
        <div
          style={{
            alignItems: "center",
            borderBottom: "1px solid var(--nx-line, #F0F0F0)",
            display: "flex",
            gap: "12px",
            padding: "12px 14px 16px 14px",
          }}
        >
          {navBack ? (
            <button
              aria-label="Back"
              onClick={navBack}
              style={{
                alignItems: "center",
                background: "var(--nx-fill, #F3F3F3)",
                border: "none",
                borderRadius: "999px",
                cursor: "pointer",
                display: "grid",
                flexShrink: 0,
                height: 32,
                placeItems: "center",
                width: 32,
              }}
              type="button"
            >
              <svg fill="none" height="14" viewBox="0 0 14 14" width="14">
                <path
                  d="M8.5 3L4.5 7L8.5 11"
                  stroke="var(--nx-ink-2, #3A3A39)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                />
              </svg>
            </button>
          ) : null}
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              gap: "2px",
              minWidth: 0,
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
            <div
              style={{
                color: "var(--nx-mute-2, #8C8C8B)",
                fontFamily: theme.fonts.sans,
                fontSize: "14px",
                fontWeight: 400,
                lineHeight: "18px",
              }}
            >
              Select a funding method
            </div>
          </div>
          {onClose && onBack ? (
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
                flexShrink: 0,
                height: 32,
                placeItems: "center",
                width: 32,
              }}
              type="button"
            >
              <svg fill="none" height="13" viewBox="0 0 13 13" width="13">
                <path
                  d="M3 3L10 10M10 3L3 10"
                  stroke="var(--nx-ink-2, #3A3A39)"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            paddingTop: "4px",
          }}
        >
          {options.map((option, index) => (
            <MethodOptionRow
              active={selectedMethod === option.id}
              description={option.description}
              hasDivider={index < options.length - 1}
              key={option.id}
              label={option.label}
              onClick={() => setSelectedMethod(option.id)}
              rightContent={option.rightContent}
            />
          ))}
        </div>

        <div
          style={{
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            marginTop: "16px",
            padding: "0 4px 4px 4px",
            width: "100%",
          }}
        >
          <button
            disabled={!selectedMethod}
            onClick={handleContinue}
            style={{
              alignItems: "center",
              backgroundColor: selectedMethod
                ? "var(--nx-blue, #006BF4)"
                : "var(--nx-fill, #F3F3F3)",
              border: "none",
              borderRadius: "999px",
              boxShadow: selectedMethod
                ? "var(--nx-sh-btn, 0 1px 2px rgba(0,0,0,0.05))"
                : "none",
              boxSizing: "border-box",
              color: selectedMethod
                ? primaryButtonForeground
                : "var(--nx-mute-2, #8C8C8B)",
              cursor: selectedMethod ? "pointer" : "default",
              display: "flex",
              flexShrink: 0,
              fontFamily: theme.fonts.sans,
              fontSize: "16px",
              fontWeight: 500,
              height: "52px",
              justifyContent: "center",
              letterSpacing: "-0.005em",
              lineHeight: "20px",
              transition:
                "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
              width: "100%",
            }}
            type="button"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
