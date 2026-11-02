// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import React from "react";
import { nexusWidgetTheme } from "../theme";

type FundingMethod =
  | "wallet"
  | "local-currency"
  | "transfer-crypto"
  | "hyperliquid";

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

const theme = nexusWidgetTheme;

function RadioMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        backgroundColor: "var(--nx-card, #FFFFFE)",
        borderColor: selected
          ? "var(--nx-blue, #006BF4)"
          : "var(--nx-line-2, #E8E8E7)",
        borderRadius: "999px",
        borderStyle: "solid",
        borderWidth: selected ? "5px" : "1.5px",
        boxSizing: "border-box",
        display: "inline-block",
        flexShrink: 0,
        height: "18px",
        transition: "border-color 150ms ease, border-width 150ms ease",
        width: "18px",
      }}
    />
  );
}

function WalletLogos() {
  return (
    <div
      style={{
        alignItems: "center",
        borderRadius: "999px",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        height: "36px",
        justifyContent: "center",
        overflow: "clip",
        width: "89px",
      }}
    >
      <div
        style={{
          alignItems: "start",
          boxSizing: "border-box",
          display: "flex",
        }}
      >
        <div
          style={{
            boxSizing: "border-box",
            flexShrink: 0,
            height: "32px",
            position: "relative",
            width: "32px",
          }}
        >
          <div
            style={{
              backgroundColor: "#F2F2F2",
              borderRadius: "999px",
              boxSizing: "border-box",
              height: "32px",
              left: 0,
              outline: "1.5px solid var(--nx-card, #FFFFFE)",
              position: "absolute",
              top: 0,
              width: "32px",
            }}
          />
          <div
            style={{
              backgroundImage:
                "url(https://app.paper.design/file-assets/01KS00EAWSTF1EENZNDW5RNCD4/01KZQRK3NFSCFRWJQXF2Y6477G.png)",
              backgroundPosition: "57.143% 33.333%",
              backgroundRepeat: "no-repeat",
              backgroundSize: "116.667%",
              boxSizing: "border-box",
              height: "23px",
              left: 5,
              position: "absolute",
              top: 5,
              width: "21px",
            }}
          />
        </div>
        <div
          style={{
            boxSizing: "border-box",
            flexShrink: 0,
            height: "32px",
            marginLeft: "-4px",
            position: "relative",
            width: "32px",
          }}
        >
          <div
            style={{
              backgroundImage:
                "url(https://app.paper.design/file-assets/01KS00EAWSTF1EENZNDW5RNCD4/01KZQSM9DRH7GN3W78VRTVSZXJ.png)",
              backgroundPosition: "50%",
              backgroundSize: "cover",
              borderRadius: "999px",
              boxSizing: "border-box",
              height: "32px",
              left: 0,
              outline: "1.5px solid var(--nx-card, #FFFFFE)",
              position: "absolute",
              top: 0,
              width: "32px",
            }}
          />
        </div>
        <div
          style={{
            boxSizing: "border-box",
            flexShrink: 0,
            height: "32px",
            marginLeft: "-4px",
            position: "relative",
            width: "32px",
          }}
        >
          <div
            style={{
              backgroundImage:
                "url(https://app.paper.design/file-assets/01KS00EAWSTF1EENZNDW5RNCD4/01KZQTS1TFZAJFD945BFM8ZDC0.png)",
              backgroundPosition: "50%",
              backgroundSize: "cover",
              borderRadius: "999px",
              boxSizing: "border-box",
              height: "32px",
              left: 0,
              outline: "1.5px solid var(--nx-card, #FFFFFE)",
              position: "absolute",
              top: 0,
              width: "32px",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CashLogos() {
  return (
    <div
      style={{
        alignItems: "center",
        borderRadius: "999px",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        height: "36px",
        justifyContent: "center",
        overflow: "clip",
        width: "89px",
      }}
    >
      <div
        style={{
          alignItems: "start",
          boxSizing: "border-box",
          display: "flex",
        }}
      >
        <div
          style={{
            boxSizing: "border-box",
            flexShrink: 0,
            height: "32px",
            position: "relative",
            width: "32px",
          }}
        >
          <div
            style={{
              backgroundColor: "#F2F2F2",
              borderRadius: "999px",
              boxSizing: "border-box",
              height: "32px",
              left: 0,
              outline: "1.5px solid var(--nx-card, #FFFFFE)",
              position: "absolute",
              top: 0,
              width: "32px",
            }}
          />
          <div
            style={{
              backgroundImage:
                "url(https://app.paper.design/file-assets/01KS00EAWSTF1EENZNDW5RNCD4/01KZQV6GH49YDFT560SEYR63SA.png)",
              backgroundPosition: "50%",
              backgroundSize: "cover",
              boxSizing: "border-box",
              height: "15px",
              left: "50%",
              position: "absolute",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "26px",
            }}
          />
        </div>
        <div
          style={{
            boxSizing: "border-box",
            flexShrink: 0,
            height: "32px",
            marginLeft: "-4px",
            position: "relative",
            width: "32px",
          }}
        >
          <div
            style={{
              backgroundColor: "#F2F2F2",
              borderRadius: "999px",
              boxSizing: "border-box",
              height: "32px",
              left: 0,
              outline: "1.5px solid var(--nx-card, #FFFFFE)",
              position: "absolute",
              top: 0,
              width: "32px",
            }}
          />
          <div
            style={{
              backgroundImage:
                "url(https://app.paper.design/file-assets/01KS00EAWSTF1EENZNDW5RNCD4/01KZQV8WWM08Y64A73CV3J8A20.png)",
              backgroundPosition: "50%",
              backgroundSize: "cover",
              boxSizing: "border-box",
              height: "20px",
              left: 7.5,
              position: "absolute",
              top: 6,
              width: "16px",
            }}
          />
        </div>
        <div
          style={{
            boxSizing: "border-box",
            flexShrink: 0,
            height: "32px",
            marginLeft: "-4px",
            position: "relative",
            width: "32px",
          }}
        >
          <div
            style={{
              backgroundColor: "#F2F2F2",
              borderRadius: "999px",
              boxSizing: "border-box",
              height: "32px",
              left: 0,
              outline: "1.5px solid var(--nx-card, #FFFFFE)",
              position: "absolute",
              top: 0,
              width: "32px",
            }}
          />
          <div
            style={{
              backgroundImage:
                "url(https://app.paper.design/file-assets/01KS00EAWSTF1EENZNDW5RNCD4/01KZQVBJFAG0P2T8S1KY38PVTT.png)",
              backgroundPosition: "33.333%",
              backgroundRepeat: "no-repeat",
              backgroundSize: "contain",
              boxSizing: "border-box",
              height: "20px",
              left: "50%",
              position: "absolute",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "21px",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TransferCryptoLogos() {
  return (
    <div
      style={{
        alignItems: "center",
        borderRadius: "999px",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        height: "36px",
        justifyContent: "center",
        overflow: "clip",
        width: "91px",
      }}
    >
      <div
        style={{
          alignItems: "start",
          boxSizing: "border-box",
          display: "flex",
        }}
      >
        <div
          style={{
            boxSizing: "border-box",
            flexShrink: 0,
            height: "32px",
            position: "relative",
            width: "32px",
          }}
        >
          <div
            style={{
              backgroundImage:
                "url(https://app.paper.design/file-assets/01KS00EAWSTF1EENZNDW5RNCD4/01KZQVN4Y8Q3ADRYKXY4J6R22C.png)",
              backgroundPosition: "50%",
              backgroundRepeat: "no-repeat",
              backgroundSize: "104.065%",
              borderRadius: "999px",
              boxSizing: "border-box",
              height: "32px",
              left: 0,
              outline: "1.5px solid var(--nx-card, #FFFFFE)",
              position: "absolute",
              top: 0,
              width: "32px",
            }}
          />
        </div>
        <div
          style={{
            boxSizing: "border-box",
            flexShrink: 0,
            height: "32px",
            marginLeft: "-4px",
            position: "relative",
            width: "32px",
          }}
        >
          <div
            style={{
              backgroundImage:
                "url(https://app.paper.design/file-assets/01KS00EAWSTF1EENZNDW5RNCD4/01KZQVHQH1402W4F784BH626JA.png)",
              backgroundPosition: "50% 53.333%",
              backgroundRepeat: "no-repeat",
              backgroundSize: "111.111%",
              borderRadius: "999px",
              boxSizing: "border-box",
              height: "32px",
              left: 0,
              outline: "1.5px solid var(--nx-card, #FFFFFE)",
              position: "absolute",
              top: 0,
              width: "32px",
            }}
          />
        </div>
        <div
          style={{
            boxSizing: "border-box",
            flexShrink: 0,
            height: "32px",
            marginLeft: "-4px",
            position: "relative",
            width: "32px",
          }}
        >
          <div
            style={{
              backgroundImage:
                "url(https://app.paper.design/file-assets/01KS00EAWSTF1EENZNDW5RNCD4/01KZQVQ9YTKYJ2XV8RE1JJZ0KV.png)",
              backgroundPosition: "50%",
              backgroundSize: "cover",
              borderRadius: "999px",
              boxSizing: "border-box",
              height: "32px",
              left: 0,
              outline: "1.5px solid var(--nx-card, #FFFFFE)",
              position: "absolute",
              top: 0,
              width: "32px",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function HyperliquidLogo() {
  return (
    <div
      style={{
        alignItems: "center",
        borderRadius: "999px",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        height: "36px",
        justifyContent: "center",
        overflow: "clip",
        width: "36px",
      }}
    >
      <div
        style={{
          backgroundImage:
            "url(https://app.paper.design/file-assets/01KS00EAWSTF1EENZNDW5RNCD4/4RQEH0TV7F8T0V0WSTWQ2CF7MS.png)",
          backgroundPosition: "50%",
          backgroundSize: "cover",
          borderRadius: "999px",
          boxSizing: "border-box",
          flexShrink: 0,
          height: "32px",
          width: "32px",
        }}
      />
    </div>
  );
}

function MethodOptionRow({
  active,
  badge,
  description,
  hasDivider,
  label,
  onClick,
  rightContent,
}: {
  active: boolean;
  badge?: React.ReactNode;
  description: React.ReactNode;
  hasDivider?: boolean;
  label: string;
  onClick: () => void;
  rightContent: React.ReactNode;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
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
        borderBottom: hasDivider ? "1px solid var(--nx-line, #F0F0EF)" : "none",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "flex",
        gap: "12px",
        justifyContent: "space-between",
        paddingBlock: "14px",
        paddingInline: "16px",
        textAlign: "left",
        transition: "background-color 150ms ease",
        width: "100%",
      }}
      type="button"
      {...({ label } as any)}
    >
      <RadioMark selected={active} />
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          flex: 1,
          flexBasis: "0%",
          flexDirection: "column",
          gap: badge ? "4px" : "2px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            alignItems: "center",
            boxSizing: "border-box",
            display: "flex",
            gap: "8px",
          }}
        >
          <div
            style={{
              boxSizing: "border-box",
              color: "var(--nx-ink, #161615)",
              fontFamily: theme.fonts.sans,
              fontSize: "16px",
              fontWeight: 500,
              lineHeight: "20px",
            }}
          >
            {label}
          </div>
          {badge}
        </div>
        <div
          style={{
            boxSizing: "border-box",
            color: "var(--nx-mute-2, #848483)",
            fontFamily: theme.fonts.sans,
            fontSize: label === "Deposit with Wallet" ? "13px" : "14px",
            lineHeight: label === "Deposit with Wallet" ? "16px" : "18px",
          }}
        >
          {description}
        </div>
      </div>
      {rightContent}
    </button>
  );
}

export function DepositFundingMethod({
  enableOnRamp = false,
  enableTransferCrypto = true,
  enableHyperliquid = true,
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
    badge?: React.ReactNode;
    description: React.ReactNode;
    rightContent: React.ReactNode;
  }> = [
    {
      id: "wallet",
      label: "Deposit with Wallet",
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
      rightContent: <WalletLogos />,
    },
    ...(showCash
      ? [
          {
            id: "local-currency" as const,
            label: "Deposit with Cash",
            description: "Card, Apple Pay, Bank Transfer",
            rightContent: <CashLogos />,
          },
        ]
      : []),
    ...(showTransferCrypto
      ? [
          {
            id: "transfer-crypto" as const,
            label: "Transfer Crypto",
            description: "Send crypto from any wallet",
            rightContent: <TransferCryptoLogos />,
          },
        ]
      : []),
    ...(showHyperliquid
      ? [
          {
            id: "hyperliquid" as const,
            label: "Deposit from Hyperliquid",
            description: "Spend your USDC from Hyperliquid",
            rightContent: <HyperliquidLogo />,
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
            paddingTop: "16px",
          }}
        >
          <div
            style={{
              alignSelf: "stretch",
              backgroundColor: "var(--nx-card, #FFFFFE)",
              borderColor: "var(--nx-line-2, #E8E8E7)",
              borderRadius: "14px",
              borderStyle: "solid",
              borderWidth: "1px",
              boxShadow:
                "var(--nx-shadow-sm, 0px 1px 12px rgba(91, 91, 91, 0.05))",
              boxSizing: "border-box",
              display: "flex",
              flex: 1,
              flexDirection: "column",
              overflow: "clip",
              overflowWrap: "anywhere",
              WebkitFontSmoothing: "antialiased",
            }}
          >
            {options.map((option, index) => (
              <MethodOptionRow
                active={selectedMethod === option.id}
                badge={option.badge}
                description={option.description}
                hasDivider={index < options.length - 1}
                key={option.id}
                label={option.label}
                onClick={() => setSelectedMethod(option.id)}
                rightContent={option.rightContent}
              />
            ))}
          </div>
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
