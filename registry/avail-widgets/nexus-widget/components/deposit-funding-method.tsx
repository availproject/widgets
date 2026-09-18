// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import React from "react";
import { nexusWidgetTheme } from "../theme";

type FundingMethod = "wallet" | "local-currency";

interface DepositFundingMethodProps {
  enableOnRamp?: boolean;
  isBalanceLoading?: boolean;
  onSelectLocalCurrency: () => void;
  onSelectWallet: () => void;
  primaryButtonForeground: string;
  totalBalance: string;
}

interface LogoItem {
  alt: string;
  height?: string;
  invertDark?: boolean;
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
    alt: "Zerion",
    height: "20px",
    url: "https://files.availproject.org/widgets/assets/zerion.png",
    width: "20px",
  },
];

const CASH_LOGOS: LogoItem[] = [
  {
    alt: "Mastercard",
    height: "15px",
    url: "https://files.availproject.org/widgets/assets/mastercard.png",
    width: "24px",
  },
  {
    alt: "Apple Pay",
    height: "20px",
    invertDark: true,
    url: "https://files.availproject.org/widgets/assets/apple-pay.png",
    width: "20px",
  },
  {
    alt: "Google Pay",
    height: "20px",
    url: "https://files.availproject.org/widgets/assets/google-pay.png",
    width: "20px",
  },
];

const theme = nexusWidgetTheme;
const brand = "var(--foreground-brand)";

const useIsDarkMode = () => {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    const checkDark = () => {
      const root =
        typeof document !== "undefined" ? document.documentElement : undefined;
      const body = typeof document !== "undefined" ? document.body : undefined;
      const isDarkClass = Boolean(
        root?.classList?.contains("dark") || body?.classList?.contains("dark"),
      );
      const isDataThemeDark = root?.getAttribute?.("data-theme") === "dark";
      const prefersDark =
        typeof window.matchMedia === "function"
          ? Boolean(window.matchMedia("(prefers-color-scheme: dark)")?.matches)
          : false;
      return Boolean(isDarkClass || isDataThemeDark || prefersDark);
    };

    setIsDark(checkDark());

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : undefined;
    const handleMediaChange = () => setIsDark(checkDark());
    mediaQuery?.addEventListener?.("change", handleMediaChange);

    const root =
      typeof document !== "undefined" ? document.documentElement : undefined;
    let observer: MutationObserver | undefined;
    if (root && typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => {
        setIsDark(checkDark());
      });
      observer.observe(root, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
    }

    return () => {
      mediaQuery?.removeEventListener?.("change", handleMediaChange);
      observer?.disconnect();
    };
  }, []);

  return isDark;
};

function RadioMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: selected ? brand : theme.colors.border,
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
        borderRadius: "4px",
        display: "inline-block",
        flexShrink: 0,
        height,
        maxWidth: "100%",
        width,
      }}
    />
  );
}

function LogoStack({
  isDark,
  items,
}: {
  isDark: boolean;
  items: LogoItem[];
}) {
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
        overflow: "hidden",
      }}
    >
      <div
        style={{
          alignItems: "center",
          boxSizing: "border-box",
          display: "flex",
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.alt}
            style={{
              alignItems: "center",
              backgroundColor: isDark ? "#262626" : "#F2F2F2",
              borderRadius: "999px",
              boxSizing: "border-box",
              display: "flex",
              flexShrink: 0,
              height: "32px",
              justifyContent: "center",
              marginLeft: index === 0 ? "0px" : "-4px",
              outline: `1.5px solid ${theme.colors.surface}`,
              position: "relative",
              width: "32px",
              zIndex: index + 1,
            }}
          >
            <img
              alt={item.alt}
              src={item.url}
              style={{
                filter: item.invertDark && isDark ? "invert(1)" : undefined,
                height: item.height ?? "20px",
                objectFit: "contain",
                width: item.width ?? "20px",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FundingOption({
  active,
  amount,
  amountLoading = false,
  description,
  hasDivider = false,
  isDark = false,
  label,
  logos,
  onClick,
}: {
  active: boolean;
  amount?: string;
  amountLoading?: boolean;
  description: string;
  hasDivider?: boolean;
  isDark?: boolean;
  label: string;
  logos: LogoItem[];
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        alignItems: "center",
        backgroundColor: isHovered
          ? isDark
            ? "rgba(255, 255, 255, 0.04)"
            : "#FBFBFA"
          : theme.colors.surface,
        border: "none",
        borderBottom: hasDivider ? `1px solid ${theme.colors.divider}` : "none",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "flex",
        gap: "12px",
        paddingBlock: "14px",
        paddingInline: "16px",
        textAlign: "left",
        transition: "background-color 150ms ease",
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
          minWidth: 0,
        }}
      >
        <div
          style={{
            boxSizing: "border-box",
            color: theme.colors.textStrong,
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
            alignItems: "center",
            boxSizing: "border-box",
            color: theme.colors.textSubtle,
            display: "flex",
            fontFamily: theme.fonts.sans,
            fontSize: amount !== undefined || amountLoading ? "13px" : "14px",
            gap: "4px",
            lineHeight: amount !== undefined || amountLoading ? "16px" : "18px",
          }}
        >
          {amountLoading ? (
            <>
              <span>Wallet balance: </span>
              <AmountSkeleton />
            </>
          ) : amount !== undefined ? (
            `Wallet balance: $${amount || "0.00"}`
          ) : (
            description
          )}
        </div>
      </div>
      <LogoStack isDark={isDark} items={logos} />
    </button>
  );
}

export function DepositFundingMethod({
  enableOnRamp = false,
  isBalanceLoading = false,
  onSelectLocalCurrency,
  onSelectWallet,
  primaryButtonForeground,
  totalBalance,
}: DepositFundingMethodProps) {
  const [selectedMethod, setSelectedMethod] =
    React.useState<FundingMethod | null>(null);
  const isDark = useIsDarkMode();

  React.useEffect(() => {
    if (!enableOnRamp) {
      setSelectedMethod((current) =>
        current === "local-currency" ? null : current,
      );
    }
  }, [enableOnRamp]);

  const handleContinue = () => {
    if (!selectedMethod) return;
    if (selectedMethod === "wallet") {
      onSelectWallet();
      return;
    }
    if (enableOnRamp) onSelectLocalCurrency();
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
          alignSelf: "stretch",
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: "14px",
          borderStyle: "solid",
          borderWidth: "1px",
          boxShadow: "#5B5B5B0D 0px 1px 12px",
          boxSizing: "border-box",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <FundingOption
          active={selectedMethod === "wallet"}
          amount={totalBalance}
          amountLoading={isBalanceLoading}
          description="Wallet balance"
          hasDivider={enableOnRamp}
          isDark={isDark}
          label="Deposit with Wallet"
          logos={WALLET_LOGOS}
          onClick={() => {
            setSelectedMethod("wallet");
          }}
        />
        {enableOnRamp && (
          <FundingOption
            active={selectedMethod === "local-currency"}
            description="Card, Apple Pay, Bank Transfer"
            hasDivider={false}
            isDark={isDark}
            label="Deposit with Cash"
            logos={CASH_LOGOS}
            onClick={() => {
              setSelectedMethod("local-currency");
            }}
          />
        )}
      </div>

      <div
        style={{
          alignSelf: "stretch",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div
          style={{
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
              backgroundColor: selectedMethod
                ? brand
                : isDark
                  ? "#262626"
                  : theme.colors.surfaceCool,
              border: "none",
              borderRadius: "12px",
              boxShadow: selectedMethod ? theme.shadows.primaryButton : "none",
              boxSizing: "border-box",
              color: selectedMethod
                ? primaryButtonForeground
                : theme.colors.muted,
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
              transition: "background-color 150ms ease, box-shadow 150ms ease",
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
