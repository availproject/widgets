// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import React from "react";
import { nexusWidgetTheme } from "../theme";
import type { NexusWidgetDappConfig } from "../types";

type FundingMethod = "wallet" | "local-currency" | `dapp-${number}`;

interface DepositFundingMethodProps {
  dapps?: NexusWidgetDappConfig[];
  enableOnRamp?: boolean;
  isBalanceLoading?: boolean;
  onSelectLocalCurrency: () => void;
  onSelectWallet: () => void;
  primaryButtonForeground: string;
  totalBalance: string;
}

const theme = nexusWidgetTheme;
const brand = "var(--foreground-brand)";

function RadioMark({ selected }: { selected: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        backgroundColor: "#FFFFFE",
        borderColor: selected ? brand : "#E8E8E7",
        borderRadius: "999px",
        borderStyle: "solid",
        borderWidth: selected ? "5px" : "1.5px",
        boxSizing: "border-box",
        flexShrink: 0,
        height: "18px",
        width: "18px",
        transition: "border-color 0.15s ease, border-width 0.15s ease",
      }}
    />
  );
}

function AmountSkeleton({
  height = "14px",
  width = "48px",
}: {
  height?: string;
  width?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className="animate-pulse"
      style={{
        background:
          "linear-gradient(90deg, #F0F0EF 0%, #E6EEFF 48%, #F0F0EF 100%)",
        backgroundSize: "200% 100%",
        borderRadius: "6px",
        display: "inline-block",
        flexShrink: 0,
        height,
        maxWidth: "100%",
        width,
      }}
    />
  );
}

function WalletIcons() {
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
              outline: "1.5px solid #FFFFFE",
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
              outline: "1.5px solid #FFFFFE",
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
              outline: "1.5px solid #FFFFFE",
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

function CashIcons() {
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
              outline: "1.5px solid #FFFFFE",
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
              translate: "-50% -50%",
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
              outline: "1.5px solid #FFFFFE",
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
              outline: "1.5px solid #FFFFFE",
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
              translate: "-50% -50%",
              width: "21px",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function DappIcon({ logo }: { logo?: string }) {
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
      {logo ? (
        <img
          alt=""
          src={logo}
          style={{
            borderRadius: "999px",
            height: "32px",
            objectFit: "cover",
            width: "32px",
          }}
        />
      ) : null}
    </div>
  );
}

function FundingOptionRow({
  active,
  icons,
  isLast,
  onClick,
  subtitle,
  title,
}: {
  active: boolean;
  icons: React.ReactNode;
  isLast: boolean;
  onClick: () => void;
  subtitle: React.ReactNode;
  title: string;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        alignItems: "center",
        backgroundColor: isHovered ? "#F8F8F7" : "#FFFFFE",
        border: "none",
        borderBottomColor: isLast ? "transparent" : "#F0F0EF",
        borderBottomStyle: "solid",
        borderBottomWidth: isLast ? 0 : "1px",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "flex",
        gap: "12px",
        paddingBlock: "14px",
        paddingInline: "16px",
        textAlign: "left",
        transition: "background-color 0.15s ease",
        width: "100%",
      }}
      type="button"
    >
      <RadioMark selected={active} />
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexBasis: "0%",
          flexDirection: "column",
          flexGrow: 1,
          gap: "2px",
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
              color: "#161615",
              fontFamily: '"Geist", system-ui, sans-serif',
              fontSize: "16px",
              fontWeight: 500,
              lineHeight: "20px",
            }}
          >
            {title}
          </div>
        </div>
        <div
          style={{
            boxSizing: "border-box",
            color: "#848483",
            fontFamily: '"Geist", system-ui, sans-serif',
            fontSize: "13px",
            lineHeight: "16px",
          }}
        >
          {subtitle}
        </div>
      </div>
      {icons}
    </button>
  );
}

export function DepositFundingMethod({
  dapps,
  enableOnRamp = false,
  isBalanceLoading = false,
  onSelectLocalCurrency,
  onSelectWallet,
  primaryButtonForeground,
  totalBalance,
}: DepositFundingMethodProps) {
  const [selectedMethod, setSelectedMethod] =
    React.useState<FundingMethod | null>("wallet");

  const validDapps = React.useMemo(
    () =>
      (dapps ?? []).filter(
        (dapp) => dapp.title && dapp.targetUrl,
      ),
    [dapps],
  );

  const handleContinue = () => {
    if (!selectedMethod) return;
    if (selectedMethod === "wallet") {
      onSelectWallet();
      return;
    }
    if (selectedMethod === "local-currency") {
      onSelectLocalCurrency();
      return;
    }
    // Handle dapp selection – open targetUrl in new tab
    if (selectedMethod.startsWith("dapp-")) {
      const dappIndex = Number.parseInt(
        selectedMethod.replace("dapp-", ""),
        10,
      );
      const dapp = validDapps[dappIndex];
      if (dapp?.targetUrl) {
        window.open(dapp.targetUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  const options: Array<{
    id: FundingMethod;
    title: string;
    subtitle: React.ReactNode;
    icons: React.ReactNode;
  }> = [];

  // 1. Wallet option
  options.push({
    id: "wallet",
    title: "Deposit with Wallet",
    subtitle: isBalanceLoading ? (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        Wallet balance: <AmountSkeleton height="14px" width="48px" />
      </span>
    ) : (
      `Wallet balance: $${totalBalance || "0.00"}`
    ),
    icons: <WalletIcons />,
  });

  // 2. OnRamp option (only if explicitly enabled)
  if (enableOnRamp) {
    options.push({
      id: "local-currency",
      title: "Deposit with Cash",
      subtitle: "Card, Apple Pay, Bank Transfer",
      icons: <CashIcons />,
    });
  }

  // 3. Dapps (e.g. Hyperliquid)
  validDapps.forEach((dapp, index) => {
    options.push({
      id: `dapp-${index}`,
      title: dapp.title,
      subtitle: dapp.description || "Spend your crypto",
      icons: <DappIcon logo={dapp.logo} />,
    });
  });

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
          alignSelf: "stretch",
          backgroundColor: "#FFFFFE",
          borderColor: "#E8E8E7",
          borderRadius: "14px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#5B5B5B0D 0px 1px 12px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflow: "clip",
          width: "100%",
        }}
      >
        {options.map((option, index) => (
          <FundingOptionRow
            active={selectedMethod === option.id}
            icons={option.icons}
            isLast={index === options.length - 1}
            key={option.id}
            onClick={() => setSelectedMethod(option.id)}
            subtitle={option.subtitle}
            title={option.title}
          />
        ))}
      </div>

      <div
        style={{
          alignSelf: "stretch",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          marginTop: "4px",
          width: "100%",
        }}
      >
        <button
          disabled={!selectedMethod}
          onClick={handleContinue}
          style={{
            alignItems: "center",
            backgroundColor: selectedMethod ? brand : theme.colors.surfaceCool,
            border: "none",
            borderRadius: "12px",
            boxShadow: selectedMethod ? theme.shadows.primaryButton : "none",
            boxSizing: "border-box",
            color: selectedMethod ? primaryButtonForeground : theme.colors.muted,
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
            transition: "all 0.15s ease",
            width: "100%",
          }}
          type="button"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
