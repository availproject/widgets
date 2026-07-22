// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import Decimal from "decimal.js";
import {
  Check,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Info,
  Landmark,
  Loader2,
  Search,
  Smartphone,
  X,
} from "lucide-react";
import React from "react";
import {
  NEXUS_WIDGET_FAST_SPINNER_STYLE,
  nexusWidgetTheme,
} from "../theme";
import type { NexusWidgetDepositOpportunityConfig } from "../types";
import type { SwapTokenOption } from "./swap-asset-selector";

type OnrampCryptoCurrency = {
  chainId: number;
  contract?: string;
  currencyCode: string;
  decimals?: number;
  name?: string;
};

type OnrampOptionsResponse = {
  countries?: {
    countryCode: string;
    flagUrl?: string;
    name: string;
  }[];
  selection?: {
    countryCode: string;
    cryptoCurrencies?: OnrampCryptoCurrency[];
    defaultFiat?: string;
    defaultPaymentMethods?: string[];
    fiatCurrencies?: string[];
  } | null;
};

type OnrampPaymentMethod = {
  limits?: {
    currencyCode?: string;
    max?: string;
    min?: string;
  };
  method: string;
  type?: string;
};

type OnrampRoute = {
  paymentMethods?: OnrampPaymentMethod[];
  provider: string;
};

type OnrampRoutesResponse = {
  routes?: OnrampRoute[];
};

type OnrampQuote = {
  destinationAmount: string;
  destinationCurrencyCode: string;
  fees?: {
    network?: string;
    partner?: string;
    provider?: string;
    total?: string;
  };
  lowKyc?: boolean;
  paymentMethodType: string;
  provider: string;
  rampScore?: number;
  sourceAmount: string;
  sourceCurrencyCode: string;
};

type OnrampQuoteResponse = {
  quotes?: OnrampQuote[];
};

type OnrampSessionResponse = {
  createdAt?: string;
  fallbackWidgetUrl?: string;
  paymentMethodType?: string;
  provider?: string;
  rawMeldStatus?: string;
  deposit?: {
    explorerUrl?: string;
    state?: string;
    txHash?: string;
  };
  sessionId?: string;
  state?: string;
  transaction?: {
    destinationAmount?: string;
    destinationCurrencyCode?: string;
    sourceAmount?: string;
    sourceCurrencyCode?: string;
    txHash?: string;
    walletAddress?: string;
  };
  updatedAt?: string;
  widgetUrl?: string;
};

type OnrampSheet =
  | "currency"
  | "destination"
  | "fees"
  | "method"
  | "partner"
  | null;

interface DepositOnrampFlowProps {
  baseUrl?: string;
  destinationTokens?: SwapTokenOption[];
  onConnectWallet: () => void | Promise<void>;
  onError?: (message: string) => void;
  onSelectDestinationToken?: (token: SwapTokenOption) => void;
  onSessionStateChange?: (state: string | null) => void;
  ownerAddress?: string;
  opportunity?: NexusWidgetDepositOpportunityConfig;
  primaryButtonForeground: string;
  toToken?: SwapTokenOption;
}

const ONRAMP_CLIENT_HEADER = "nexus-widget";
const ONRAMP_DEFAULT_COUNTRY = "IN";
const ONRAMP_DEFAULT_BASE_URL = "http://localhost:8000";
const QUOTE_REFRESH_SECONDS = 15;
const ONRAMP_SESSION_POLL_MS = 3000;
const TEST_FIAT_CURRENCIES = ["INR", "USD", "EUR", "JPY", "GBP"] as const;
const theme = nexusWidgetTheme;
const brand = "var(--foreground-brand)";

const panelStyle: React.CSSProperties = {
  backgroundColor: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: "12px",
  boxShadow: theme.shadows.card,
  boxSizing: "border-box",
  overflow: "hidden",
  width: "100%",
};

const sectionLabelStyle: React.CSSProperties = {
  color: theme.colors.textSubtle,
  fontFamily: theme.fonts.sans,
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  lineHeight: "15px",
  textTransform: "uppercase",
};

const compactTitleStyle: React.CSSProperties = {
  color: theme.colors.textStrong,
  fontFamily: theme.fonts.display,
  fontSize: "18px",
  fontWeight: 500,
  letterSpacing: "0",
  lineHeight: "23px",
};

const compactBodyStyle: React.CSSProperties = {
  color: theme.colors.textSubtle,
  fontFamily: theme.fonts.sans,
  fontSize: "13px",
  lineHeight: "18px",
};

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

const normalizeAmountInput = (raw: string) => {
  let next = raw.replaceAll(/[^0-9.]/g, "");
  const parts = next.split(".");
  if (parts.length > 2) next = parts[0] + "." + parts.slice(1).join("");
  const [integerPart, decimalPart] = next.split(".");
  if (decimalPart !== undefined) {
    next = `${integerPart}.${decimalPart.slice(0, 2)}`;
  }
  if (next === ".") next = "0.";
  return next;
};

const formatNumberDisplay = (value: unknown, maxDecimals = 2) => {
  const parsed = parseDecimal(value) ?? new Decimal(0);
  return parsed
    .toDecimalPlaces(maxDecimals, Decimal.ROUND_DOWN)
    .toFixed()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const formatCurrencyAmount = (value: unknown, currencyCode?: string) => {
  const suffix = currencyCode ? ` ${currencyCode}` : "";
  return `${formatNumberDisplay(value)}${suffix}`;
};

const formatUsdDisplay = (value: unknown) => {
  const parsed = parseDecimal(value) ?? new Decimal(0);
  if (parsed.gt(0) && parsed.lt(0.01)) return "<$0.01";
  return `$${formatNumberDisplay(parsed, 2)}`;
};

const getFiatCurrencyName = (currencyCode?: string) => {
  switch ((currencyCode ?? "").toUpperCase()) {
    case "EUR":
      return "Euro";
    case "GBP":
      return "British Pound";
    case "INR":
      return "Indian Rupee";
    case "JPY":
      return "Japanese Yen";
    case "USD":
      return "US Dollar";
    default:
      return currencyCode ?? "";
  }
};

const getMethodLabel = (method?: string) => {
  switch ((method ?? "").toUpperCase()) {
    case "APPLE_PAY":
      return "Apple Pay";
    case "GOOGLE_PAY":
      return "Google Pay";
    case "UPI":
      return "UPI";
    case "BANK_TRANSFER":
    case "IMPS":
    case "NEFT":
    case "RTGS":
      return "Bank Transfer";
    case "CREDIT_DEBIT_CARD":
    case "CARD":
      return "Credit / Debit Cards";
    default:
      return method
        ? method
            .split("_")
            .filter(Boolean)
            .map(
              (part) =>
                part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            )
            .join(" ")
        : "Payment method";
  }
};

const getMethodSubtitle = (method?: string) => {
  switch ((method ?? "").toUpperCase()) {
    case "UPI":
      return "~1 min";
    case "APPLE_PAY":
    case "GOOGLE_PAY":
      return "~2 min";
    case "BANK_TRANSFER":
    case "IMPS":
    case "NEFT":
    case "RTGS":
      return "~3 min";
    case "CREDIT_DEBIT_CARD":
    case "CARD":
      return "~3 min";
    default:
      return "Available route";
  }
};

const getProviderLabel = (provider?: string) =>
  provider
    ? provider
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
    : "Payment partner";

const getProviderInitials = (provider?: string) => {
  const label = getProviderLabel(provider);
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return label.slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unable to continue with local currency.";
};

const ONRAMP_TERMINAL_STATES = new Set([
  "CANCELLED",
  "EXPIRED",
  "FAILED",
  "REFUNDED",
  "SETTLED",
]);

const getNormalizedOnrampState = (state?: string | null) =>
  (state ?? "").trim().toUpperCase();

const isOnrampTerminalState = (state?: string | null) =>
  ONRAMP_TERMINAL_STATES.has(getNormalizedOnrampState(state)) ||
  isOnrampDepositSuccessState(state) ||
  isOnrampDepositFailedState(state);

const isOnrampProcessingState = (state?: string | null) => {
  const normalized = getNormalizedOnrampState(state);
  return normalized === "PROCESSING" || normalized === "SETTLING";
};

const ONRAMP_DEPOSIT_PROCESSING_STATES = new Set([
  "COMPLETING_DEPOSIT",
  "DEPOSIT_PROCESSING",
  "DEPOSITING",
]);

const ONRAMP_DEPOSIT_SUCCESS_STATES = new Set([
  "COMPLETED",
  "DEPOSIT_COMPLETE",
  "DEPOSIT_SUCCESS",
  "DEPOSITED",
]);

const ONRAMP_DEPOSIT_FAILED_STATES = new Set([
  "DEPOSIT_ATTENTION",
  "DEPOSIT_FAILED",
  "DEPOSIT_REQUIRES_ATTENTION",
]);

const isOnrampDepositProcessingState = (state?: string | null) =>
  ONRAMP_DEPOSIT_PROCESSING_STATES.has(getNormalizedOnrampState(state));

const isOnrampDepositSuccessState = (state?: string | null) =>
  ONRAMP_DEPOSIT_SUCCESS_STATES.has(getNormalizedOnrampState(state));

const isOnrampDepositFailedState = (state?: string | null) =>
  ONRAMP_DEPOSIT_FAILED_STATES.has(getNormalizedOnrampState(state));

const isNativeAddress = (address?: string) => {
  const lower = address?.toLowerCase();
  return (
    lower === "0x0000000000000000000000000000000000000000" ||
    lower === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  );
};

const getChainCurrencySuffix = (chainId?: number, chainName?: string) => {
  switch (chainId) {
    case 1:
      return "ETHEREUM";
    case 10:
      return "OPTIMISM";
    case 56:
      return "BNB";
    case 137:
      return "POLYGON";
    case 8453:
      return "BASE";
    case 42161:
      return "ARBITRUM";
    case 43114:
      return "AVALANCHE";
    default:
      return (chainName ?? "CHAIN").replaceAll(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
  }
};

const getFallbackDestinationCurrencyCode = (token?: SwapTokenOption) => {
  if (!token?.symbol) return "";
  return `${token.symbol.toUpperCase()}_${getChainCurrencySuffix(
    token.chainId,
    token.chainName
  )}`;
};

const getDestinationCurrencyCode = (
  options: OnrampOptionsResponse | null,
  token?: SwapTokenOption
) => {
  if (!token?.chainId || !token.contractAddress) {
    return getFallbackDestinationCurrencyCode(token);
  }

  const targetAddress = token.contractAddress.toLowerCase();
  const currencies = options?.selection?.cryptoCurrencies ?? [];
  const matched = currencies.find((currency) => {
    if (currency.chainId !== token.chainId) return false;
    const contract = currency.contract?.toLowerCase();
    if (!contract) return false;
    return (
      contract === targetAddress ||
      (isNativeAddress(contract) && isNativeAddress(targetAddress))
    );
  });

  return matched?.currencyCode ?? getFallbackDestinationCurrencyCode(token);
};

const getOnrampTokenKey = (token?: SwapTokenOption) => {
  if (!token?.chainId || !token.contractAddress) return "";
  return `${token.chainId}:${token.contractAddress.toLowerCase()}`;
};

const isSameOnrampToken = (
  left?: SwapTokenOption,
  right?: SwapTokenOption
) => Boolean(left && right && getOnrampTokenKey(left) === getOnrampTokenKey(right));

const sortQuotes = (quotes: OnrampQuote[]) =>
  [...quotes].sort((a, b) => {
    const scoreDelta = (b.rampScore ?? 0) - (a.rampScore ?? 0);
    if (scoreDelta !== 0) return scoreDelta;
    const destinationDelta =
      parseDecimal(b.destinationAmount)?.cmp(
        parseDecimal(a.destinationAmount) ?? new Decimal(0)
      ) ?? 0;
    return destinationDelta;
  });

const matchesSearch = (query: string, values: Array<string | undefined>) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return values.some((value) =>
    (value ?? "").toLowerCase().includes(normalizedQuery)
  );
};

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const fetchOnrampJson = async <T,>(
  baseUrl: string,
  path: string,
  init?: RequestInit
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-nexus-client": ONRAMP_CLIENT_HEADER,
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : `Onramp request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
};

function TokenLogo({
  label,
  size = 30,
  src,
}: {
  label?: string;
  size?: number;
  src?: string;
}) {
  const [failed, setFailed] = React.useState(!src);

  React.useEffect(() => {
    setFailed(!src);
  }, [src]);

  if (!failed && src) {
    return (
      <img
        alt={label ?? ""}
        onError={() => setFailed(true)}
        src={src}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: "999px",
          height: size,
          objectFit: "cover",
          width: size,
        }}
      />
    );
  }

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#E8F0FF",
        borderRadius: "999px",
        color: brand,
        display: "flex",
        fontFamily: theme.fonts.sans,
        fontSize: `${Math.max(10, size * 0.36)}px`,
        fontWeight: 700,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      {(label || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

function TokenLogoPair({ token }: { token?: SwapTokenOption }) {
  return (
    <div
      style={{
        flexShrink: 0,
        height: "32px",
        position: "relative",
        width: "32px",
      }}
    >
      <TokenLogo label={token?.symbol} size={32} src={token?.logo} />
      {token?.chainLogo && (
        <div
          style={{
            bottom: "-2px",
            position: "absolute",
            right: "-2px",
          }}
        >
          <TokenLogo label={token.chainName} size={14} src={token.chainLogo} />
        </div>
      )}
    </div>
  );
}

function CurrencyMark({ code }: { code?: string }) {
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#EEF3FF",
        borderRadius: "999px",
        color: brand,
        display: "flex",
        flexShrink: 0,
        fontFamily: theme.fonts.sans,
        fontSize: "11px",
        fontWeight: 700,
        height: "32px",
        justifyContent: "center",
        width: "32px",
      }}
    >
      {(code ?? "?").slice(0, 3).toUpperCase()}
    </div>
  );
}

function ProviderMark({ provider }: { provider?: string }) {
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: brand,
        borderRadius: "8px",
        color: "#FFFFFE",
        display: "flex",
        flexShrink: 0,
        fontFamily: theme.fonts.sans,
        fontSize: "12px",
        fontWeight: 700,
        height: "34px",
        justifyContent: "center",
        width: "34px",
      }}
    >
      {getProviderInitials(provider)}
    </div>
  );
}

function MethodMark({ method }: { method?: string }) {
  const normalized = (method ?? "").toUpperCase();
  const icon =
    normalized === "UPI" || normalized === "APPLE_PAY" || normalized === "GOOGLE_PAY" ? (
      <Smartphone aria-hidden="true" size={20} strokeWidth={1.7} />
    ) : normalized.includes("BANK") ||
      normalized === "IMPS" ||
      normalized === "NEFT" ||
      normalized === "RTGS" ? (
      <Landmark aria-hidden="true" size={20} strokeWidth={1.7} />
    ) : (
      <CreditCard aria-hidden="true" size={20} strokeWidth={1.7} />
    );

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: "8px",
        color: theme.colors.textStrong,
        display: "flex",
        flexShrink: 0,
        height: "34px",
        justifyContent: "center",
        width: "34px",
      }}
    >
      {icon}
    </div>
  );
}

function SelectPill({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.tokenPill,
        boxShadow: theme.shadows.tokenPill,
        boxSizing: "border-box",
        color: theme.colors.textStrong,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        flexShrink: 0,
        gap: "8px",
        minHeight: "40px",
        padding: "4px 10px 4px 6px",
      }}
      type="button"
    >
      {children}
      {!disabled && (
        <ChevronDown
          aria-hidden="true"
          color={theme.colors.icon}
          size={15}
          strokeWidth={1.8}
        />
      )}
    </button>
  );
}

function EditButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        backgroundColor: disabled ? theme.colors.surfaceCool : "#E8F0FF",
        border: "none",
        borderRadius: "999px",
        color: disabled ? theme.colors.muted : brand,
        cursor: disabled ? "default" : "pointer",
        fontFamily: theme.fonts.sans,
        fontSize: "13px",
        fontWeight: 500,
        lineHeight: "17px",
        padding: "7px 13px",
      }}
      type="button"
    >
      Edit
    </button>
  );
}

function DetailRow({
  action,
  children,
  divider,
  label,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  divider?: boolean;
  label: string;
}) {
  return (
    <div
      style={{
        borderTop: divider ? `1px solid ${theme.colors.divider}` : undefined,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "12px",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={sectionLabelStyle}>{label}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Sheet({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "rgba(22, 22, 21, 0.36)",
        bottom: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 60,
      }}
    >
      <button
        aria-label="Close onramp sheet"
        onClick={onClose}
        style={{
          backgroundColor: "transparent",
          border: "none",
          bottom: 0,
          cursor: "default",
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
        type="button"
      />
      <div
        className="animate-in slide-in-from-bottom-full duration-300"
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: "16px 16px 0 0",
          boxShadow: theme.shadows.sheet,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          height: "min(420px, calc(100% - 16px))",
          maxHeight: "calc(100% - 16px)",
          overflow: "hidden",
          padding: "16px",
          position: "relative",
          width: "100%",
          zIndex: 1,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div
            style={compactTitleStyle}
          >
            {title}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              height: "32px",
              justifyContent: "center",
              width: "32px",
            }}
            type="button"
          >
            <X aria-hidden="true" color={theme.colors.textStrong} size={17} />
          </button>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            minHeight: 0,
            overflow: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SheetSearchInput({
  onChange,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#F0F0EF",
        border: `1px solid ${focused ? "#A8C9FF" : theme.colors.border}`,
        borderRadius: "12px",
        boxShadow: focused ? "0 0 0 1px rgba(0,107,244,0.16)" : "none",
        display: "flex",
        gap: "8px",
        height: "42px",
        padding: "0 8px 0 14px",
      }}
    >
      <Search aria-hidden="true" color={theme.colors.textSubtle} size={18} />
      <input
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        style={{
          backgroundColor: "transparent",
          border: "none",
          color: theme.colors.textStrong,
          flex: "1 1 0%",
          fontFamily: theme.fonts.sans,
          fontSize: "14px",
          lineHeight: "18px",
          minWidth: 0,
          outline: "none",
          padding: 0,
        }}
        value={value}
      />
      {value && (
        <button
          aria-label={`Clear ${placeholder.toLowerCase()}`}
          onClick={() => onChange("")}
          style={{
            alignItems: "center",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            padding: "2px",
          }}
          type="button"
        >
          <X aria-hidden="true" color={theme.colors.textSubtle} size={15} />
        </button>
      )}
    </div>
  );
}

function SelectRow({
  icon,
  onClick,
  primary,
  selected,
  subtitle,
  title,
  value,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  selected: boolean;
  subtitle?: string;
  title: string;
  value?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        border: `1px solid ${selected ? brand : theme.colors.divider}`,
        borderRadius: "10px",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "flex",
        gap: "10px",
        minHeight: "60px",
        padding: "10px 12px",
        textAlign: "left",
        width: "100%",
      }}
      type="button"
    >
      {icon}
      <div
        style={{
          display: "flex",
          flex: "1 1 0%",
          flexDirection: "column",
          gap: "3px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: "7px",
            minWidth: 0,
          }}
        >
          <span
            style={{
              color: theme.colors.textStrong,
              fontFamily: theme.fonts.sans,
              fontSize: "15px",
              fontWeight: 500,
              lineHeight: "19px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
          {primary && (
            <span
              style={{
                backgroundColor: "#E8F5E9",
                borderRadius: "999px",
                color: "#2E7D32",
                flexShrink: 0,
                fontFamily: theme.fonts.sans,
                fontSize: "11px",
                fontWeight: 500,
                lineHeight: "14px",
                padding: "2px 8px",
              }}
            >
              Best rate
            </span>
          )}
        </div>
        {subtitle && (
          <span
            style={{
              color: theme.colors.textSubtle,
              fontFamily: theme.fonts.sans,
              fontSize: "13px",
              lineHeight: "16px",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {value && (
        <span
          style={{
            color: theme.colors.textStrong,
            flexShrink: 0,
            fontFamily: theme.fonts.display,
            fontSize: "14px",
            fontWeight: 500,
            lineHeight: "18px",
          }}
        >
          {value}
        </span>
      )}
      <span
        style={{
          alignItems: "center",
          border: `1.5px solid ${selected ? brand : theme.colors.border}`,
          borderRadius: "999px",
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
    </button>
  );
}

function EmptySheetMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...compactBodyStyle,
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        minHeight: "160px",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function SkeletonBlock({
  borderRadius = "8px",
  height,
  width,
}: {
  borderRadius?: string;
  height: string;
  width: string;
}) {
  return (
    <div
      className="animate-pulse"
      style={{
        backgroundColor: theme.colors.surfaceCool,
        borderRadius,
        height,
        width,
      }}
    />
  );
}

function QuoteDetailsSkeleton() {
  return (
    <div style={panelStyle}>
      <DetailRow
        action={<SkeletonBlock borderRadius="999px" height="30px" width="62px" />}
        label="Payment Method"
      >
        <div style={{ alignItems: "center", display: "flex", gap: "10px" }}>
          <SkeletonBlock height="38px" width="38px" />
          <SkeletonBlock height="20px" width="120px" />
        </div>
      </DetailRow>

      <DetailRow
        action={<SkeletonBlock borderRadius="999px" height="30px" width="62px" />}
        divider
        label="Payment Partner"
      >
        <div style={{ alignItems: "center", display: "flex", gap: "10px" }}>
          <SkeletonBlock height="38px" width="38px" />
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            <SkeletonBlock height="20px" width="112px" />
            <SkeletonBlock height="16px" width="88px" />
          </div>
        </div>
      </DetailRow>

      <div
        style={{
          alignItems: "center",
          borderTop: `1px solid ${theme.colors.divider}`,
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "space-between",
          padding: "14px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          <SkeletonBlock height="19px" width="78px" />
          <SkeletonBlock height="17px" width="104px" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          <SkeletonBlock height="20px" width="76px" />
          <SkeletonBlock height="17px" width="92px" />
        </div>
      </div>
    </div>
  );
}

const formatTokenAmountDisplay = (amount: unknown, symbol?: string) => {
  const suffix = symbol ? ` ${symbol}` : "";
  if (amount === null || amount === undefined || amount === "") {
    return suffix ? `--${suffix}` : "--";
  }
  return `${formatNumberDisplay(amount, 6)}${suffix}`;
};

const getOnrampSessionSubtitle = (
  state: string | null | undefined,
  opportunity?: NexusWidgetDepositOpportunityConfig
) => {
  const normalized = getNormalizedOnrampState(state);
  if (normalized === "SETTLED" || isOnrampDepositSuccessState(normalized)) {
    return `The amount was deposited on ${getDepositTargetLabel(opportunity)}`;
  }
  if (isOnrampDepositFailedState(normalized)) {
    return "The funds are in your wallet, but the deposit transaction could not be performed automatically.";
  }
  if (isOnrampDepositProcessingState(normalized)) {
    return "Usually takes 20 seconds";
  }
  if (normalized === "FAILED") return "The payment could not be completed";
  if (normalized === "CANCELLED") return "No payment was completed";
  if (normalized === "REFUNDED") return "The payment was refunded";
  if (normalized === "EXPIRED") return "Start a new payment to continue";
  if (isOnrampProcessingState(normalized)) return "Usually takes 2 - 5 min";
  return "The payment processor requires some information";
};

const getOnrampSummaryLabel = (
  state: string | null | undefined,
  provider?: string
) => {
  const partner = getProviderLabel(provider);
  const normalized = getNormalizedOnrampState(state);
  if (normalized === "SETTLED") return `Payment received from ${partner}`;
  if (normalized === "FAILED") return `Payment failed with ${partner}`;
  if (normalized === "CANCELLED") return `Payment cancelled with ${partner}`;
  if (normalized === "REFUNDED") return `Payment refunded by ${partner}`;
  if (normalized === "EXPIRED") return `Payment expired with ${partner}`;
  if (isOnrampProcessingState(normalized)) {
    return `Payment to be received by ${partner}`;
  }
  return `Payment to receive from ${partner}`;
};

const getDepositTargetLabel = (
  opportunity?: NexusWidgetDepositOpportunityConfig
) =>
  opportunity?.title ||
  opportunity?.label ||
  opportunity?.protocol ||
  "the selected market";

const getDepositChainName = (
  opportunity?: NexusWidgetDepositOpportunityConfig,
  token?: SwapTokenOption
) => token?.chainName ?? opportunity?.subtitle?.replace(/^on\s+/i, "") ?? "chain";

const getExplorerBaseUrl = (chainId?: number) => {
  switch (chainId) {
    case 1:
      return "https://etherscan.io/tx/";
    case 10:
      return "https://optimistic.etherscan.io/tx/";
    case 56:
      return "https://bscscan.com/tx/";
    case 137:
      return "https://polygonscan.com/tx/";
    case 8453:
      return "https://basescan.org/tx/";
    case 42161:
      return "https://arbiscan.io/tx/";
    case 43114:
      return "https://snowtrace.io/tx/";
    default:
      return undefined;
  }
};

const getOnrampExplorerUrl = (
  session: OnrampSessionResponse,
  opportunity?: NexusWidgetDepositOpportunityConfig,
  token?: SwapTokenOption
) => {
  if (session.deposit?.explorerUrl) return session.deposit.explorerUrl;
  if (opportunity?.explorerUrl) return opportunity.explorerUrl;
  const txHash = session.deposit?.txHash ?? session.transaction?.txHash;
  const baseUrl = getExplorerBaseUrl(token?.chainId ?? opportunity?.chainId);
  return txHash && baseUrl ? `${baseUrl}${txHash}` : undefined;
};

function OnrampStatusArtwork({ tone = "neutral" }: { tone?: "green" | "neutral" }) {
  const pulseColor =
    tone === "green"
      ? "rgba(67, 190, 162, 0.72)"
      : "rgba(115, 129, 148, 0.58)";
  return (
    <div
      aria-hidden="true"
      style={{
        alignItems: "center",
        backgroundColor: "#FAFBFC",
        backgroundImage:
          "radial-gradient(circle at center, rgba(250, 251, 252, 0) 0 36%, rgba(250, 251, 252, 0.92) 72%, #FAFBFC 100%), repeating-linear-gradient(0deg, rgba(132, 132, 131, 0.09) 0 8px, transparent 8px 14px), repeating-linear-gradient(90deg, rgba(132, 132, 131, 0.09) 0 8px, transparent 8px 14px)",
        borderRadius: "10px",
        display: "flex",
        height: "150px",
        justifyContent: "center",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "5px",
        }}
      >
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            className="animate-pulse"
            key={`onramp-status-pulse-${index}`}
            style={{
              animationDelay: `${index * 45}ms`,
              backgroundColor: pulseColor,
              display: "block",
              height: "7px",
              width: "7px",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SafeCloseNotice() {
  return (
    <div
      style={{
        alignItems: "center",
        color: theme.colors.textSubtle,
        display: "flex",
        fontFamily: theme.fonts.sans,
        fontSize: "13px",
        gap: "8px",
        justifyContent: "center",
        lineHeight: "18px",
        paddingBottom: "2px",
      }}
    >
      <Info aria-hidden="true" size={15} strokeWidth={1.8} />
      Safe to close - we'll notify you when complete
    </div>
  );
}

function OnrampStatusButton({
  children,
  onClick,
  primaryButtonForeground,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  primaryButtonForeground: string;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      style={{
        alignItems: "center",
        backgroundColor: isPrimary ? brand : theme.colors.surface,
        border: isPrimary ? "none" : `1px solid ${brand}`,
        borderRadius: theme.radius.primaryButton,
        boxShadow: isPrimary ? theme.shadows.primaryButton : "none",
        color: isPrimary ? primaryButtonForeground : brand,
        cursor: "pointer",
        display: "flex",
        fontFamily: theme.fonts.sans,
        fontSize: "14px",
        fontWeight: 500,
        height: isPrimary ? "44px" : "40px",
        justifyContent: "center",
        lineHeight: "18px",
        width: "100%",
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function WarningStatusIcon({ tone = "red" }: { tone?: "orange" | "red" }) {
  const color = tone === "orange" ? "#F59E0B" : "#E8453C";
  const backgroundColor = tone === "orange" ? "#FFF7ED" : "#FEF2F2";
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor,
        borderRadius: "14px",
        display: "flex",
        height: "56px",
        justifyContent: "center",
        width: "56px",
      }}
    >
      <svg
        aria-hidden="true"
        height="32"
        viewBox="0 0 32 32"
        width="32"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="16"
          cy="16"
          fill="none"
          r="14"
          stroke={color}
          strokeWidth="2"
        />
        <path
          d="M16 10v8M16 22v2"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function OnrampActionStatusPanel({
  description,
  onPrimary,
  onSecondary,
  primaryButtonForeground,
  primaryLabel,
  secondaryLabel,
  title,
}: {
  description: string;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryButtonForeground: string;
  primaryLabel: string;
  secondaryLabel: string;
  title: string;
}) {
  return (
    <div
      style={{
        ...panelStyle,
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "28px 14px 18px",
        textAlign: "center",
      }}
    >
      <WarningStatusIcon />
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={compactTitleStyle}>
          {title}
        </div>
        <div style={compactBodyStyle}>
          {description}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "6px",
          width: "100%",
        }}
      >
        <OnrampStatusButton
          onClick={onPrimary}
          primaryButtonForeground={primaryButtonForeground}
        >
          {primaryLabel}
        </OnrampStatusButton>
        <OnrampStatusButton
          onClick={onSecondary}
          primaryButtonForeground={primaryButtonForeground}
          variant="secondary"
        >
          {secondaryLabel}
        </OnrampStatusButton>
      </div>
    </div>
  );
}

function TimelineMarker({
  isComplete,
  isLast,
  isPending,
}: {
  isComplete?: boolean;
  isLast?: boolean;
  isPending?: boolean;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: isComplete
            ? brand
            : isPending
              ? "#F0F0EF"
              : "#E8F0FF",
          borderRadius: "999px",
          display: "flex",
          height: "24px",
          justifyContent: "center",
          width: "24px",
        }}
      >
        {isComplete ? (
          <Check
            aria-hidden="true"
            color={primaryButtonContrastColor}
            size={13}
            strokeWidth={2.4}
          />
        ) : (
          <span
            style={{
              backgroundColor: isPending ? "#C8C8C6" : brand,
              borderRadius: "999px",
              height: "8px",
              width: "8px",
            }}
          />
        )}
      </div>
      {!isLast && (
        <div
          style={{
            backgroundColor: isComplete ? brand : theme.colors.divider,
            height: "32px",
            width: "2px",
          }}
        />
      )}
    </div>
  );
}

const primaryButtonContrastColor = "#FFFFFE";

function TimelineStep({
  isComplete,
  isLast,
  isPending,
  subtitle,
  title,
}: {
  isComplete?: boolean;
  isLast?: boolean;
  isPending?: boolean;
  subtitle: string;
  title: string;
}) {
  return (
    <div
      style={{
        alignItems: "flex-start",
        display: "flex",
        gap: "12px",
      }}
    >
      <TimelineMarker
        isComplete={isComplete}
        isLast={isLast}
        isPending={isPending}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          minWidth: 0,
          paddingBottom: isLast ? 0 : "12px",
          paddingTop: "2px",
        }}
      >
        <div
          style={{
            color: isPending ? theme.colors.textSubtle : theme.colors.textStrong,
            fontFamily: theme.fonts.sans,
            fontSize: "14px",
            fontWeight: isPending ? 400 : 500,
            lineHeight: "20px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: isPending ? "#C8C8C6" : theme.colors.textSubtle,
            fontFamily: theme.fonts.sans,
            fontSize: "13px",
            lineHeight: "18px",
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function OnrampProcessingTimelinePanel({
  destinationAmount,
  destinationChainName,
  destinationSymbol,
  isSettling,
  provider,
  sourceAmount,
  sourceCurrencyCode,
  targetLabel,
}: {
  destinationAmount: string;
  destinationChainName: string;
  destinationSymbol?: string;
  isSettling: boolean;
  provider?: string;
  sourceAmount: string;
  sourceCurrencyCode: string;
  targetLabel: string;
}) {
  const destinationDisplay = formatTokenAmountDisplay(
    destinationAmount,
    destinationSymbol
  );
  const sourceDisplay = formatCurrencyAmount(sourceAmount, sourceCurrencyCode);
  return (
    <>
      <div
        style={{
          color: theme.colors.textSubtle,
          fontFamily: theme.fonts.sans,
          fontSize: "14px",
          lineHeight: "18px",
          marginTop: "-8px",
          textAlign: "center",
        }}
      >
        Usually takes 2 - 5 min
      </div>
      <div
        style={{
          ...panelStyle,
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "14px",
        }}
      >
        <OnrampStatusArtwork />
        <div
          style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: "10px",
            boxShadow: theme.shadows.card,
            overflow: "hidden",
            width: "100%",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: "10px",
              justifyContent: "space-between",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                color: theme.colors.textStrong,
                fontFamily: theme.fonts.sans,
                fontSize: "14px",
                lineHeight: "20px",
              }}
            >
              {isSettling
                ? "Sending amount to your wallet"
                : "Processing your payment"}
            </div>
            <div
              style={{
                alignItems: "center",
                color: theme.colors.textStrong,
                display: "flex",
                flexShrink: 0,
                fontFamily: theme.fonts.display,
                fontSize: "14px",
                fontWeight: 500,
                gap: "6px",
                lineHeight: "20px",
              }}
            >
              {isSettling ? destinationDisplay : sourceDisplay}
              <ChevronDown
                aria-hidden="true"
                color={theme.colors.icon}
                size={15}
                strokeWidth={1.8}
                style={{ transform: "rotate(180deg)" }}
              />
            </div>
          </div>
          <div
            style={{
              backgroundColor: "#EFEFEF",
              display: "flex",
              flexDirection: "column",
              padding: "14px",
            }}
          >
            <TimelineStep
              isComplete={isSettling}
              subtitle={`${sourceDisplay} by ${getProviderLabel(provider)}`}
              title={isSettling ? "Payment received" : "Payment processing"}
            />
            <TimelineStep
              isPending={!isSettling}
              subtitle={`On ${destinationChainName}`}
              title={`Sending ${destinationDisplay} to your wallet`}
            />
            <TimelineStep
              isLast
              isPending
              subtitle={`On ${destinationChainName}`}
              title={`Depositing on ${targetLabel}`}
            />
          </div>
        </div>
        <SafeCloseNotice />
      </div>
    </>
  );
}

function OnrampCompletingDepositPanel({
  destinationAmount,
  destinationSymbol,
  targetLabel,
}: {
  destinationAmount: string;
  destinationSymbol?: string;
  targetLabel: string;
}) {
  return (
    <>
      <div
        style={{
          color: theme.colors.textSubtle,
          fontFamily: theme.fonts.sans,
          fontSize: "14px",
          lineHeight: "18px",
          marginTop: "-8px",
          textAlign: "center",
        }}
      >
        Usually takes 20 seconds
      </div>
      <div
        style={{
          ...panelStyle,
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "14px",
        }}
      >
        <OnrampStatusArtwork />
        <div
          style={{
            alignItems: "center",
            border: `1px solid ${theme.colors.border}`,
            borderRadius: "10px",
            display: "flex",
            gap: "10px",
            justifyContent: "space-between",
            padding: "14px",
          }}
        >
          <div
            style={{
              color: theme.colors.textSubtle,
              fontFamily: theme.fonts.sans,
              fontSize: "14px",
              lineHeight: "18px",
            }}
          >
            Depositing to {targetLabel}
          </div>
          <div
            style={{
              alignItems: "center",
              color: theme.colors.textStrong,
              display: "flex",
              fontFamily: theme.fonts.display,
              fontSize: "14px",
              fontWeight: 500,
              gap: "8px",
              lineHeight: "18px",
            }}
          >
            {formatTokenAmountDisplay(destinationAmount, destinationSymbol)}
            <ChevronDown
              aria-hidden="true"
              color={theme.colors.icon}
              size={15}
              strokeWidth={1.8}
            />
          </div>
        </div>
        <SafeCloseNotice />
      </div>
    </>
  );
}

function OnrampSuccessPanel({
  destinationAmount,
  destinationSymbol,
  explorerUrl,
  onDone,
  paymentMethod,
  primaryButtonForeground,
  provider,
  sourceAmount,
  sourceCurrencyCode,
  subtitle,
}: {
  destinationAmount: string;
  destinationSymbol?: string;
  explorerUrl?: string;
  onDone: () => void;
  paymentMethod?: string;
  primaryButtonForeground: string;
  provider?: string;
  sourceAmount: string;
  sourceCurrencyCode: string;
  subtitle: string;
}) {
  return (
    <>
      <div
        style={{
          color: theme.colors.textSubtle,
          fontFamily: theme.fonts.sans,
          fontSize: "14px",
          lineHeight: "18px",
          marginTop: "-8px",
          textAlign: "center",
        }}
      >
        {subtitle}
      </div>
      <OnrampStatusArtwork tone="green" />
      <div
        style={{
          ...panelStyle,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "14px",
        }}
      >
        <div style={sectionLabelStyle}>Transaction Summary</div>
        <SummaryRow
          label="Deposit amount"
          value={formatTokenAmountDisplay(destinationAmount, destinationSymbol)}
        />
        <SummaryRow
          label="Payment method"
          value={getMethodLabel(paymentMethod)}
        />
        <SummaryRow
          label="Payment Partner"
          value={getProviderLabel(provider)}
        />
        <div
          style={{
            borderTop: `1px solid ${theme.colors.divider}`,
            marginTop: "4px",
            paddingTop: "8px",
          }}
        >
          <SummaryRow
            label="Total charged"
            value={formatCurrencyAmount(sourceAmount, sourceCurrencyCode)}
          />
        </div>
      </div>
      {explorerUrl && (
        <a
          href={explorerUrl}
          rel="noreferrer"
          style={{
            alignItems: "center",
            color: brand,
            display: "flex",
            fontFamily: theme.fonts.sans,
            fontSize: "13px",
            fontWeight: 500,
            gap: "6px",
            justifyContent: "center",
            lineHeight: "18px",
            textDecoration: "none",
          }}
          target="_blank"
        >
          <Info
            aria-hidden="true"
            color={theme.colors.textSubtle}
            size={15}
            strokeWidth={1.8}
          />
          View Explorer
          <ExternalLink aria-hidden="true" size={13} strokeWidth={1.8} />
        </a>
      )}
      <OnrampStatusButton
        onClick={onDone}
        primaryButtonForeground={primaryButtonForeground}
      >
        Done
      </OnrampStatusButton>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: "10px",
        justifyContent: "space-between",
      }}
    >
      <span
        style={{
          color: theme.colors.textSubtle,
          fontFamily: theme.fonts.sans,
          fontSize: "13px",
          lineHeight: "18px",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: theme.colors.textStrong,
          fontFamily: theme.fonts.sans,
          fontSize: "13px",
          fontWeight: 600,
          lineHeight: "18px",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function OnrampHandoffPanel({
  provider,
  summaryAmount,
}: {
  provider?: string;
  summaryAmount: string;
}) {
  return (
    <>
      <div
        style={{
          color: theme.colors.textSubtle,
          fontFamily: theme.fonts.sans,
          fontSize: "14px",
          lineHeight: "18px",
          marginTop: "-8px",
          textAlign: "center",
        }}
      >
        The payment processor requires some information
      </div>
      <div
        style={{
          ...panelStyle,
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "14px",
        }}
      >
        <OnrampStatusArtwork />
        <div
          style={{
            alignItems: "center",
            border: `1px solid ${theme.colors.border}`,
            borderRadius: "10px",
            display: "flex",
            gap: "10px",
            justifyContent: "space-between",
            minHeight: "56px",
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              color: theme.colors.textSubtle,
              fontFamily: theme.fonts.sans,
              fontSize: "14px",
              lineHeight: "18px",
            }}
          >
            {getOnrampSummaryLabel("AWAITING_USER", provider)}
          </div>
          <div
            style={{
              alignItems: "center",
              color: theme.colors.textStrong,
              display: "flex",
              flexShrink: 0,
              fontFamily: theme.fonts.display,
              fontSize: "15px",
              fontWeight: 500,
              gap: "6px",
              lineHeight: "20px",
            }}
          >
            {summaryAmount}
            <ChevronDown
              aria-hidden="true"
              color={theme.colors.icon}
              size={15}
              strokeWidth={1.8}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function OnrampSessionStatusPanel({
  onCancel,
  onDone,
  onRetryPayment,
  opportunity,
  primaryButtonForeground,
  quote,
  session,
  sourceAmount,
  sourceCurrencyCode,
  toToken,
}: {
  onCancel: () => void;
  onDone: () => void;
  onRetryPayment: () => void;
  opportunity?: NexusWidgetDepositOpportunityConfig;
  primaryButtonForeground: string;
  quote?: OnrampQuote;
  session: OnrampSessionResponse;
  sourceAmount: string;
  sourceCurrencyCode: string;
  toToken?: SwapTokenOption;
}) {
  const normalizedState =
    getNormalizedOnrampState(session.state) || "AWAITING_USER";
  const provider = session.provider ?? quote?.provider;
  const transaction = session.transaction;
  const destinationSymbol = toToken?.symbol ?? quote?.destinationCurrencyCode;
  const destinationAmount =
    transaction?.destinationAmount ?? quote?.destinationAmount ?? "";
  const sourceDisplayAmount =
    transaction?.sourceAmount ?? quote?.sourceAmount ?? sourceAmount;
  const sourceDisplayCurrency =
    transaction?.sourceCurrencyCode ??
    quote?.sourceCurrencyCode ??
    sourceCurrencyCode;
  const destinationChainName = getDepositChainName(opportunity, toToken);
  const targetLabel = getDepositTargetLabel(opportunity);
  const explorerUrl = getOnrampExplorerUrl(session, opportunity, toToken);
  const containerStyle: React.CSSProperties = {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "100%",
  };

  if (normalizedState === "FAILED") {
    return (
      <div style={containerStyle}>
        <OnrampActionStatusPanel
          description={`${getProviderLabel(
            provider
          )} declined the payment. Your card wasn't charged.`}
          onPrimary={onRetryPayment}
          onSecondary={onCancel}
          primaryButtonForeground={primaryButtonForeground}
          primaryLabel="Try Again"
          secondaryLabel="Cancel Transaction"
          title="Payment failed"
        />
      </div>
    );
  }

  if (["CANCELLED", "EXPIRED", "REFUNDED"].includes(normalizedState)) {
    const title =
      normalizedState === "CANCELLED"
        ? "Payment cancelled"
        : normalizedState === "REFUNDED"
          ? "Payment refunded"
          : "Payment expired";
    const description =
      normalizedState === "CANCELLED"
        ? "No payment was completed."
        : normalizedState === "REFUNDED"
          ? `${getProviderLabel(provider)} refunded the payment.`
          : "Start a new local currency payment to continue.";
    return (
      <div style={containerStyle}>
        <OnrampActionStatusPanel
          description={description}
          onPrimary={onRetryPayment}
          onSecondary={onCancel}
          primaryButtonForeground={primaryButtonForeground}
          primaryLabel="Try Again"
          secondaryLabel="Cancel Transaction"
          title={title}
        />
      </div>
    );
  }

  if (isOnrampDepositFailedState(normalizedState)) {
    return (
      <div style={containerStyle}>
        <OnrampActionStatusPanel
          description={getOnrampSessionSubtitle(normalizedState, opportunity)}
          onPrimary={onCancel}
          onSecondary={onCancel}
          primaryButtonForeground={primaryButtonForeground}
          primaryLabel="Retry Deposit"
          secondaryLabel="Skip Deposit"
          title="Deposit needs your attention"
        />
      </div>
    );
  }

  if (normalizedState === "SETTLED" || isOnrampDepositSuccessState(normalizedState)) {
    return (
      <div style={containerStyle}>
        <OnrampSuccessPanel
          destinationAmount={destinationAmount}
          destinationSymbol={destinationSymbol}
          explorerUrl={explorerUrl}
          onDone={onDone}
          paymentMethod={session.paymentMethodType ?? quote?.paymentMethodType}
          primaryButtonForeground={primaryButtonForeground}
          provider={provider}
          sourceAmount={sourceDisplayAmount}
          sourceCurrencyCode={sourceDisplayCurrency}
          subtitle={getOnrampSessionSubtitle(normalizedState, opportunity)}
        />
      </div>
    );
  }

  if (isOnrampDepositProcessingState(normalizedState)) {
    return (
      <div style={containerStyle}>
        <OnrampCompletingDepositPanel
          destinationAmount={destinationAmount}
          destinationSymbol={destinationSymbol}
          targetLabel={targetLabel}
        />
      </div>
    );
  }

  if (isOnrampProcessingState(normalizedState)) {
    return (
      <div style={containerStyle}>
        <OnrampProcessingTimelinePanel
          destinationAmount={destinationAmount}
          destinationChainName={destinationChainName}
          destinationSymbol={destinationSymbol}
          isSettling={normalizedState === "SETTLING"}
          provider={provider}
          sourceAmount={sourceDisplayAmount}
          sourceCurrencyCode={sourceDisplayCurrency}
          targetLabel={targetLabel}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <OnrampHandoffPanel
        provider={provider}
        summaryAmount={formatTokenAmountDisplay(
          destinationAmount,
          destinationSymbol
        )}
      />
    </div>
  );
}

export function DepositOnrampFlow({
  baseUrl = ONRAMP_DEFAULT_BASE_URL,
  destinationTokens,
  onConnectWallet,
  onError,
  onSelectDestinationToken,
  onSessionStateChange,
  ownerAddress,
  opportunity,
  primaryButtonForeground,
  toToken,
}: DepositOnrampFlowProps) {
  const [countryCode] = React.useState(ONRAMP_DEFAULT_COUNTRY);
  const [sourceCurrencyCode, setSourceCurrencyCode] = React.useState("INR");
  const [sourceAmount, setSourceAmount] = React.useState("");
  const [options, setOptions] = React.useState<OnrampOptionsResponse | null>(
    null
  );
  const [routes, setRoutes] = React.useState<OnrampRoute[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    React.useState("");
  const [quotes, setQuotes] = React.useState<OnrampQuote[]>([]);
  const [selectedProvider, setSelectedProvider] = React.useState("");
  const [activeSheet, setActiveSheet] = React.useState<OnrampSheet>(null);
  const [currencySearch, setCurrencySearch] = React.useState("");
  const [destinationSearch, setDestinationSearch] = React.useState("");
  const [methodSearch, setMethodSearch] = React.useState("");
  const [partnerSearch, setPartnerSearch] = React.useState("");
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [routesLoading, setRoutesLoading] = React.useState(false);
  const [quotesLoading, setQuotesLoading] = React.useState(false);
  const [sessionLoading, setSessionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<OnrampSessionResponse | null>(
    null
  );
  const [quoteRefreshSeconds, setQuoteRefreshSeconds] = React.useState(
    QUOTE_REFRESH_SECONDS
  );
  const quoteRunIdRef = React.useRef(0);
  const normalizedSessionState = getNormalizedOnrampState(session?.state);

  const fiatCurrencies = TEST_FIAT_CURRENCIES;
  const availableDestinationTokens = React.useMemo(() => {
    const tokens = destinationTokens?.length ? destinationTokens : toToken ? [toToken] : [];
    const byKey = new Map<string, SwapTokenOption>();
    for (const token of tokens) {
      const key = getOnrampTokenKey(token);
      if (!key) continue;
      byKey.set(key, token);
    }
    return Array.from(byKey.values());
  }, [destinationTokens, toToken]);
  const destinationCurrencyCode = React.useMemo(
    () => getDestinationCurrencyCode(options, toToken),
    [options, toToken]
  );
  const availablePaymentMethods = React.useMemo(() => {
    const map = new Map<string, OnrampPaymentMethod>();
    for (const route of routes) {
      for (const method of route.paymentMethods ?? []) {
        if (!method.method || map.has(method.method)) continue;
        map.set(method.method, method);
      }
    }
    return Array.from(map.values());
  }, [routes]);
  const selectedPaymentMethodDetails = availablePaymentMethods.find(
    (method) => method.method === selectedPaymentMethod
  );
  const selectedQuote =
    quotes.find((quote) => quote.provider === selectedProvider) ?? quotes[0];
  const filteredFiatCurrencies = React.useMemo(
    () =>
      fiatCurrencies.filter((currencyCode) =>
        matchesSearch(currencySearch, [
          currencyCode,
          getFiatCurrencyName(currencyCode),
        ])
      ),
    [currencySearch, fiatCurrencies]
  );
  const filteredDestinationTokens = React.useMemo(
    () =>
      availableDestinationTokens.filter((token) =>
        matchesSearch(destinationSearch, [
          token.symbol,
          token.name,
          token.chainName,
          token.contractAddress,
        ])
      ),
    [availableDestinationTokens, destinationSearch]
  );
  const filteredPaymentMethods = React.useMemo(
    () =>
      availablePaymentMethods.filter((method) =>
        matchesSearch(methodSearch, [
          method.method,
          getMethodLabel(method.method),
          getMethodSubtitle(method.method),
        ])
      ),
    [availablePaymentMethods, methodSearch]
  );
  const filteredQuotes = React.useMemo(
    () =>
      quotes.filter((quote) =>
        matchesSearch(partnerSearch, [
          quote.provider,
          getProviderLabel(quote.provider),
          quote.paymentMethodType,
          getMethodLabel(quote.paymentMethodType),
        ])
      ),
    [partnerSearch, quotes]
  );
  const hasMultipleCurrencies = fiatCurrencies.length > 1;
  const hasMultipleDestinationTokens = availableDestinationTokens.length > 1;
  const hasMultipleMethods = availablePaymentMethods.length > 1;
  const hasMultipleProviders = quotes.length > 1;
  const isLoading = optionsLoading || routesLoading || quotesLoading;
  const parsedSourceAmount = React.useMemo(
    () => parseDecimal(sourceAmount),
    [sourceAmount]
  );
  const hasPositiveSourceAmount = Boolean(parsedSourceAmount?.gt(0));
  const amountLimitMessage = (() => {
    const limits = selectedPaymentMethodDetails?.limits;
    if (!limits || !parsedSourceAmount?.gt(0)) return null;
    const min = parseDecimal(limits.min);
    const max = parseDecimal(limits.max);
    if (min && parsedSourceAmount.lt(min)) {
      return `Minimum ${formatCurrencyAmount(min, sourceCurrencyCode)}`;
    }
    if (max && parsedSourceAmount.gt(max)) {
      return `Maximum ${formatCurrencyAmount(max, sourceCurrencyCode)}`;
    }
    return null;
  })();

  const loadOptions = React.useCallback(async () => {
    setOptionsLoading(true);
    setError(null);
    try {
      const data = await fetchOnrampJson<OnrampOptionsResponse>(
        baseUrl,
        `/api/v1/onramp/options?countryCode=${encodeURIComponent(countryCode)}`,
        { method: "GET" }
      );
      setOptions(data);
      setSourceCurrencyCode((current) => current || "INR");
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      onError?.(message);
    } finally {
      setOptionsLoading(false);
    }
  }, [baseUrl, countryCode, onError]);

  React.useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  React.useEffect(() => {
    if (activeSheet !== "currency") setCurrencySearch("");
    if (activeSheet !== "destination") setDestinationSearch("");
    if (activeSheet !== "method") setMethodSearch("");
    if (activeSheet !== "partner") setPartnerSearch("");
  }, [activeSheet]);

  React.useEffect(() => {
    if (!sourceCurrencyCode || !destinationCurrencyCode) return;
    let cancelled = false;

    const loadRoutes = async () => {
      setRoutesLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          countryCode,
          destinationCurrencyCode,
          sourceCurrencyCode,
        });
        const data = await fetchOnrampJson<OnrampRoutesResponse>(
          baseUrl,
          `/api/v1/onramp/routes?${params.toString()}`,
          { method: "GET" }
        );
        if (cancelled) return;
        const nextRoutes = data.routes ?? [];
        setRoutes(nextRoutes);
        const methods = nextRoutes.flatMap((route) => route.paymentMethods ?? []);
        const preferred =
          options?.selection?.defaultPaymentMethods?.find((method) =>
            methods.some((candidate) => candidate.method === method)
          ) ?? methods[0]?.method;
        setSelectedPaymentMethod((current) =>
          current && methods.some((method) => method.method === current)
            ? current
            : preferred ?? ""
        );
      } catch (requestError) {
        if (cancelled) return;
        const message = getErrorMessage(requestError);
        setError(message);
        onError?.(message);
      } finally {
        if (!cancelled) setRoutesLoading(false);
      }
    };

    void loadRoutes();
    return () => {
      cancelled = true;
    };
  }, [
    baseUrl,
    countryCode,
    destinationCurrencyCode,
    onError,
    options?.selection?.defaultPaymentMethods,
    sourceCurrencyCode,
  ]);

  const fetchQuotes = React.useCallback(async () => {
    if (
      !ownerAddress ||
      !sourceCurrencyCode ||
      !destinationCurrencyCode ||
      !selectedPaymentMethod ||
      !parsedSourceAmount?.gt(0) ||
      amountLimitMessage
    ) {
      return;
    }

    const runId = quoteRunIdRef.current + 1;
    quoteRunIdRef.current = runId;
    setQuotesLoading(true);
    setError(null);
    try {
      const data = await fetchOnrampJson<OnrampQuoteResponse>(
        baseUrl,
        "/api/v1/onramp/quote",
        {
          body: JSON.stringify({
            countryCode,
            destinationCurrencyCode,
            paymentMethodType: selectedPaymentMethod,
            sourceAmount,
            sourceCurrencyCode,
            walletAddress: ownerAddress,
          }),
          method: "POST",
        }
      );
      if (quoteRunIdRef.current !== runId) return;
      const nextQuotes = sortQuotes(data.quotes ?? []);
      setQuotes(nextQuotes);
      setSelectedProvider((current) =>
        current && nextQuotes.some((quote) => quote.provider === current)
          ? current
          : nextQuotes[0]?.provider ?? ""
      );
      if (nextQuotes.length === 0) {
        setError("No onramp quotes are available for this amount.");
      }
    } catch (requestError) {
      if (quoteRunIdRef.current !== runId) return;
      const message = getErrorMessage(requestError);
      setQuotes([]);
      setError(message);
      onError?.(message);
    } finally {
      if (quoteRunIdRef.current === runId) {
        setQuotesLoading(false);
        setQuoteRefreshSeconds(QUOTE_REFRESH_SECONDS);
      }
    }
  }, [
    amountLimitMessage,
    baseUrl,
    countryCode,
    destinationCurrencyCode,
    onError,
    ownerAddress,
    parsedSourceAmount,
    selectedPaymentMethod,
    sourceAmount,
    sourceCurrencyCode,
  ]);

  React.useEffect(() => {
    setRoutes([]);
    setSelectedPaymentMethod("");
    setQuotes([]);
    setSelectedProvider("");
    setSession(null);
  }, [destinationCurrencyCode]);

  React.useEffect(() => {
    if (session?.sessionId) return;
    setQuotes([]);
    setSelectedProvider("");
    if (
      !ownerAddress ||
      !sourceCurrencyCode ||
      !destinationCurrencyCode ||
      !selectedPaymentMethod ||
      !parsedSourceAmount?.gt(0) ||
      amountLimitMessage
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchQuotes();
    }, 350);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    amountLimitMessage,
    destinationCurrencyCode,
    fetchQuotes,
    ownerAddress,
    parsedSourceAmount,
    selectedPaymentMethod,
    session?.sessionId,
    sourceCurrencyCode,
  ]);

  React.useEffect(() => {
    if (session?.sessionId || !selectedQuote || quotesLoading || sessionLoading) {
      return;
    }
    setQuoteRefreshSeconds(QUOTE_REFRESH_SECONDS);
    const interval = window.setInterval(() => {
      setQuoteRefreshSeconds((current) => {
        if (current <= 1) {
          void fetchQuotes();
          return QUOTE_REFRESH_SECONDS;
        }
        return current - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [
    fetchQuotes,
    quotesLoading,
    selectedQuote,
    session?.sessionId,
    sessionLoading,
  ]);

  React.useEffect(() => {
    onSessionStateChange?.(
      session?.sessionId
        ? normalizedSessionState || "AWAITING_USER"
        : null
    );
  }, [
    normalizedSessionState,
    onSessionStateChange,
    session?.sessionId,
  ]);

  React.useEffect(
    () => () => {
      onSessionStateChange?.(null);
    },
    [onSessionStateChange]
  );

  React.useEffect(() => {
    const sessionId = session?.sessionId;
    if (!sessionId || isOnrampTerminalState(normalizedSessionState)) return;

    let cancelled = false;
    let inFlight = false;

    const pollSession = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await fetchOnrampJson<OnrampSessionResponse>(
          baseUrl,
          `/api/v1/onramp/sessions/${encodeURIComponent(sessionId)}`,
          { method: "GET" }
        );
        if (cancelled) return;
        setSession((current) =>
          current?.sessionId === sessionId ? { ...current, ...data } : current
        );
      } catch (requestError) {
        if (cancelled) return;
        const message = getErrorMessage(requestError);
        setError(message);
        onError?.(message);
      } finally {
        inFlight = false;
      }
    };

    void pollSession();
    const interval = window.setInterval(pollSession, ONRAMP_SESSION_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    baseUrl,
    normalizedSessionState,
    onError,
    session?.sessionId,
  ]);

  const createSession = async () => {
    if (!selectedQuote || !ownerAddress || !selectedPaymentMethod) return;
    setSessionLoading(true);
    setError(null);
    try {
      const returnUrl =
        typeof window !== "undefined"
          ? window.location.href
          : "http://localhost:8000/onramp/complete";
      const data = await fetchOnrampJson<OnrampSessionResponse>(
        baseUrl,
        "/api/v1/onramp/sessions",
        {
          body: JSON.stringify({
            countryCode,
            destinationCurrencyCode: selectedQuote.destinationCurrencyCode,
            paymentMethodType: selectedPaymentMethod,
            provider: selectedQuote.provider,
            returnUrl,
            sourceAmount: selectedQuote.sourceAmount,
            sourceCurrencyCode: selectedQuote.sourceCurrencyCode,
            walletAddress: ownerAddress,
          }),
          headers: {
            "Idempotency-Key": createIdempotencyKey(),
          },
          method: "POST",
        }
      );
      setSession(data);
      const widgetUrl = data.widgetUrl ?? data.fallbackWidgetUrl;
      if (widgetUrl && typeof window !== "undefined") {
        const opened = window.open(widgetUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
          window.location.assign(widgetUrl);
        }
      }
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      onError?.(message);
    } finally {
      setSessionLoading(false);
    }
  };

  const resetSession = () => {
    setError(null);
    setSession(null);
  };

  const completeSession = () => {
    setError(null);
    setQuotes([]);
    setSelectedProvider("");
    setSession(null);
    setSourceAmount("");
  };

  const handleCurrencySelect = (currencyCode: string) => {
    setSourceCurrencyCode(currencyCode);
    setSelectedPaymentMethod("");
    setSelectedProvider("");
    setQuotes([]);
    setRoutes([]);
    setActiveSheet(null);
  };

  const handleDestinationTokenSelect = (token: SwapTokenOption) => {
    if (!isSameOnrampToken(token, toToken)) {
      onSelectDestinationToken?.(token);
      setSelectedPaymentMethod("");
      setSelectedProvider("");
      setQuotes([]);
      setRoutes([]);
      setSession(null);
    }
    setActiveSheet(null);
  };

  const handleMethodSelect = (method: string) => {
    setSelectedPaymentMethod(method);
    setSelectedProvider("");
    setQuotes([]);
    setActiveSheet(null);
  };

  const receiveAmount = selectedQuote?.destinationAmount;
  const receiveUsd = selectedQuote?.destinationAmount;
  const feeTotal = selectedQuote?.fees?.total;
  const fetchingBestRates =
    hasPositiveSourceAmount &&
    !selectedQuote &&
    !amountLimitMessage &&
    !error &&
    Boolean(destinationCurrencyCode) &&
    (isLoading || Boolean(selectedPaymentMethod));
  const ctaRateLoading = fetchingBestRates || (hasPositiveSourceAmount && isLoading);
  const quoteDetailsLoading = fetchingBestRates;
  const shouldShowQuoteDetails =
    hasPositiveSourceAmount && (quoteDetailsLoading || Boolean(selectedQuote));
  const shouldShowQuoteTimer = Boolean(selectedQuote);
  const ctaDisabled =
    !ownerAddress ||
    !hasPositiveSourceAmount ||
    !selectedQuote ||
    Boolean(amountLimitMessage) ||
    ctaRateLoading ||
    sessionLoading;

  if (!ownerAddress) {
    return (
      <div style={panelStyle}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "18px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: theme.colors.textStrong,
              fontFamily: theme.fonts.sans,
              fontSize: "15px",
              fontWeight: 500,
              lineHeight: "19px",
            }}
          >
            Connect wallet to continue
          </div>
          <div
            style={{
              color: theme.colors.textSubtle,
              fontFamily: theme.fonts.sans,
              fontSize: "13px",
              lineHeight: "18px",
            }}
          >
            Your wallet address is required for the hosted onramp session.
          </div>
          <button
            onClick={() => void onConnectWallet()}
            style={{
              backgroundColor: brand,
              border: "none",
              borderRadius: theme.radius.primaryButton,
              color: primaryButtonForeground,
              cursor: "pointer",
              fontFamily: theme.fonts.sans,
              fontSize: "14px",
              fontWeight: 500,
              height: "40px",
              paddingInline: "16px",
            }}
            type="button"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (session?.sessionId) {
    return (
      <OnrampSessionStatusPanel
        onCancel={resetSession}
        onDone={completeSession}
        onRetryPayment={() => void createSession()}
        opportunity={opportunity}
        primaryButtonForeground={primaryButtonForeground}
        quote={selectedQuote}
        session={session}
        sourceAmount={sourceAmount}
        sourceCurrencyCode={sourceCurrencyCode}
        toToken={toToken}
      />
    );
  }

  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: activeSheet ? "500px" : undefined,
        position: "relative",
        width: "100%",
      }}
    >
      {shouldShowQuoteTimer && (
        <div
          style={{
            alignItems: "center",
            alignSelf: "flex-end",
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: "9px",
            boxShadow: theme.shadows.iconButton,
            color: brand,
            display: "flex",
            fontFamily: theme.fonts.sans,
            fontSize: "13px",
            fontWeight: 600,
            gap: "6px",
            height: "32px",
            justifyContent: "center",
            marginTop: "-48px",
            paddingInline: "10px",
            pointerEvents: "none",
          }}
        >
          <Loader2
            className={quotesLoading || routesLoading ? "animate-spin" : undefined}
            size={16}
            style={
              quotesLoading || routesLoading
                ? NEXUS_WIDGET_FAST_SPINNER_STYLE
                : undefined
            }
          />
          {quotesLoading || routesLoading ? "..." : `${quoteRefreshSeconds}s`}
        </div>
      )}

      <div style={panelStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            padding: "14px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: "12px",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                flex: "1 1 0%",
                flexDirection: "column",
                gap: "6px",
                minWidth: 0,
              }}
            >
              <div style={sectionLabelStyle}>You Pay</div>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  setSourceAmount(normalizeAmountInput(event.target.value))
                }
                placeholder="0"
                style={{
                  background: "transparent",
                  border: "none",
                  color: theme.colors.textStrong,
                  fontFamily: theme.fonts.display,
                  fontSize: "31px",
                  fontWeight: 500,
                  letterSpacing: "0",
                  lineHeight: "36px",
                  outline: "none",
                  padding: 0,
                  width: "100%",
                }}
                value={sourceAmount}
              />
              <div
                style={{
                  color: theme.colors.textSubtle,
                  fontFamily: theme.fonts.sans,
                  fontSize: "14px",
                  lineHeight: "18px",
                }}
              >
                {selectedQuote
                  ? `${formatUsdDisplay(sourceAmount)} USD`
                  : hasPositiveSourceAmount
                    ? `${formatUsdDisplay(sourceAmount)} USD`
                    : "Select currency"}
              </div>
            </div>
            <SelectPill
              disabled={!hasMultipleCurrencies}
              onClick={() => setActiveSheet("currency")}
            >
              <CurrencyMark code={sourceCurrencyCode} />
              <span
                style={{
                  fontFamily: theme.fonts.sans,
                  fontSize: "15px",
                  fontWeight: 600,
                  lineHeight: "20px",
                }}
              >
                {sourceCurrencyCode || "---"}
              </span>
            </SelectPill>
          </div>

          {selectedPaymentMethodDetails?.limits && (
            <div
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.surfaceCool,
                borderRadius: "8px",
                color: theme.colors.textSubtle,
                display: "flex",
                fontFamily: theme.fonts.sans,
                fontSize: "13px",
                gap: "8px",
                lineHeight: "17px",
                padding: "10px 12px",
              }}
            >
              <Info aria-hidden="true" size={15} strokeWidth={1.8} />
              <span>
                Limits
                {selectedPaymentMethodDetails.limits.min
                  ? ` · Min ${formatCurrencyAmount(
                      selectedPaymentMethodDetails.limits.min,
                      sourceCurrencyCode
                    )}`
                  : ""}
                {selectedPaymentMethodDetails.limits.max
                  ? ` · Max ${formatCurrencyAmount(
                      selectedPaymentMethodDetails.limits.max,
                      sourceCurrencyCode
                    )}`
                  : ""}
              </span>
            </div>
          )}

          <div
            style={{
              borderTop: `1px solid ${theme.colors.divider}`,
              marginTop: "2px",
            }}
          />

          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: "12px",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                minWidth: 0,
              }}
            >
              <div style={sectionLabelStyle}>Receive</div>
              <div
                style={{
                  color: receiveAmount
                    ? theme.colors.textStrong
                    : theme.colors.textEmpty,
                  fontFamily: theme.fonts.display,
                  fontSize: "31px",
                  fontWeight: 500,
                  letterSpacing: "0",
                  lineHeight: "36px",
                }}
              >
                {receiveAmount ? formatNumberDisplay(receiveAmount, 6) : "0"}
              </div>
              <div
                style={{
                  color: theme.colors.textSubtle,
                  fontFamily: theme.fonts.sans,
                  fontSize: "14px",
                  lineHeight: "18px",
                }}
              >
                {receiveAmount ? formatUsdDisplay(receiveUsd) : "$0.00 USD"}
              </div>
            </div>
            <SelectPill
              disabled={!hasMultipleDestinationTokens}
              onClick={() => setActiveSheet("destination")}
            >
              <TokenLogoPair token={toToken} />
              <span
                style={{
                  fontFamily: theme.fonts.sans,
                  fontSize: "15px",
                  fontWeight: 600,
                  lineHeight: "20px",
                }}
              >
                {toToken?.symbol ?? "Token"}
              </span>
            </SelectPill>
          </div>
        </div>
      </div>

      {shouldShowQuoteDetails &&
        (quoteDetailsLoading ? (
          <QuoteDetailsSkeleton />
        ) : selectedQuote ? (
          <div style={panelStyle}>
            <DetailRow
              action={
                <EditButton
                  disabled={!hasMultipleMethods}
                  onClick={() => setActiveSheet("method")}
                />
              }
              label="Payment Method"
            >
              <div style={{ alignItems: "center", display: "flex", gap: "10px" }}>
                <MethodMark method={selectedPaymentMethod} />
                <div
                  style={{
                    color: theme.colors.textStrong,
                    fontFamily: theme.fonts.sans,
                    fontSize: "15px",
                    fontWeight: 500,
                    lineHeight: "19px",
                  }}
                >
                  {getMethodLabel(selectedPaymentMethod)}
                </div>
              </div>
            </DetailRow>

            <DetailRow
              action={
                <EditButton
                  disabled={!hasMultipleProviders}
                  onClick={() => setActiveSheet("partner")}
                />
              }
              divider
              label="Payment Partner"
            >
              <div style={{ alignItems: "center", display: "flex", gap: "10px" }}>
                <ProviderMark provider={selectedQuote.provider} />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  <div
                    style={{
                      color: theme.colors.textStrong,
                      fontFamily: theme.fonts.sans,
                      fontSize: "15px",
                      fontWeight: 500,
                      lineHeight: "19px",
                    }}
                  >
                    {getProviderLabel(selectedQuote.provider)}
                  </div>
                  <div
                    style={{
                      color: theme.colors.textSubtle,
                      fontFamily: theme.fonts.sans,
                      fontSize: "13px",
                      lineHeight: "17px",
                    }}
                  >
                    Best available quote
                  </div>
                </div>
              </div>
            </DetailRow>

            <button
              onClick={() => setActiveSheet("fees")}
              style={{
                alignItems: "center",
                backgroundColor: "transparent",
                border: "none",
                borderTop: `1px solid ${theme.colors.divider}`,
                boxSizing: "border-box",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                padding: "14px",
                textAlign: "left",
                width: "100%",
              }}
              type="button"
            >
              <div>
                <div
                  style={{
                    color: theme.colors.textStrong,
                    fontFamily: theme.fonts.sans,
                    fontSize: "15px",
                    fontWeight: 600,
                    lineHeight: "19px",
                  }}
                >
                  Total Fees
                </div>
                <div
                  style={{
                    color: theme.colors.textSubtle,
                    fontFamily: theme.fonts.sans,
                    fontSize: "13px",
                    lineHeight: "17px",
                  }}
                >
                  Inclusive of fees
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  textAlign: "right",
                }}
              >
                <div
                  style={{
                    color: theme.colors.textStrong,
                    fontFamily: theme.fonts.display,
                    fontSize: "15px",
                    fontWeight: 500,
                    lineHeight: "19px",
                  }}
                >
                  {feeTotal
                    ? formatCurrencyAmount(feeTotal, sourceCurrencyCode)
                    : "--"}
                </div>
                <div
                  style={{
                    color: brand,
                    fontFamily: theme.fonts.sans,
                    fontSize: "13px",
                    lineHeight: "17px",
                  }}
                >
                  View breakdown
                </div>
              </div>
            </button>
          </div>
        ) : null)}

      {(error || amountLimitMessage || session?.state) && (
        <div
          style={{
            backgroundColor: error || amountLimitMessage ? "#FCEEED" : "#E8F5E9",
            borderRadius: "8px",
            color: error || amountLimitMessage ? "#D32F2F" : "#2E7D32",
            fontFamily: theme.fonts.sans,
            fontSize: "13px",
            lineHeight: "18px",
            padding: "10px 12px",
          }}
        >
          {error ??
            amountLimitMessage ??
            `Onramp session ${session?.state?.toLowerCase() ?? "created"}.`}
        </div>
      )}

      <button
        disabled={ctaDisabled}
        onClick={() => void createSession()}
        style={{
          alignItems: "center",
          backgroundColor: ctaDisabled ? theme.colors.surfaceCool : brand,
          border: "none",
          borderRadius: theme.radius.primaryButton,
          boxShadow: ctaDisabled ? "none" : theme.shadows.primaryButton,
          color: ctaDisabled ? theme.colors.muted : primaryButtonForeground,
          cursor: ctaDisabled ? "default" : "pointer",
          display: "flex",
          fontFamily: theme.fonts.sans,
          fontSize: "14px",
          fontWeight: 500,
          gap: "8px",
          height: "44px",
          justifyContent: "center",
          lineHeight: "18px",
          width: "100%",
        }}
        type="button"
      >
        {sessionLoading || ctaRateLoading ? (
          <Loader2
            className="animate-spin"
            size={16}
            style={NEXUS_WIDGET_FAST_SPINNER_STYLE}
          />
        ) : selectedQuote ? (
          <ExternalLink aria-hidden="true" size={16} strokeWidth={1.8} />
        ) : null}
        {sessionLoading
          ? "Opening provider..."
          : ctaRateLoading
            ? "fetching best rates..."
            : selectedQuote
              ? `Pay ${formatCurrencyAmount(sourceAmount, sourceCurrencyCode)}`
              : "Enter amount"}
      </button>

      {activeSheet === "fees" && (
        <Sheet onClose={() => setActiveSheet(null)} title={`Buying ${formatNumberDisplay(receiveAmount, 6)} ${toToken?.symbol ?? ""}`}>
          <div
            style={{
              color: theme.colors.textSubtle,
              fontFamily: theme.fonts.sans,
              fontSize: "13px",
              lineHeight: "17px",
            }}
          >
            1 {toToken?.symbol ?? "token"} ≈{" "}
            {selectedQuote && parseDecimal(selectedQuote.destinationAmount)?.gt(0)
              ? formatCurrencyAmount(
                  parseDecimal(selectedQuote.sourceAmount)?.div(
                    parseDecimal(selectedQuote.destinationAmount) ?? new Decimal(1)
                  ),
                  sourceCurrencyCode
                )
              : "--"}
          </div>
          <div style={panelStyle}>
            {[
              ["Provider fee", selectedQuote?.fees?.provider],
              ["Network fee", selectedQuote?.fees?.network],
              ["Partner fee", selectedQuote?.fees?.partner],
            ].map(([label, value], index) => (
              <div
                key={label}
                style={{
                  alignItems: "center",
                  borderTop:
                    index > 0 ? `1px solid ${theme.colors.divider}` : undefined,
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                }}
              >
                <span
                  style={{
                    color: theme.colors.textSubtle,
                    fontFamily: theme.fonts.sans,
                    fontSize: "14px",
                    lineHeight: "18px",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    color: theme.colors.textStrong,
                    fontFamily: theme.fonts.sans,
                    fontSize: "14px",
                    fontWeight: 500,
                    lineHeight: "18px",
                  }}
                >
                  {value ? formatCurrencyAmount(value, sourceCurrencyCode) : "--"}
                </span>
              </div>
            ))}
            <div
              style={{
                alignItems: "center",
                borderTop: `1px solid ${theme.colors.divider}`,
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 14px",
              }}
            >
              <span
                style={{
                  color: theme.colors.textStrong,
                  fontFamily: theme.fonts.sans,
                  fontSize: "15px",
                  fontWeight: 600,
                  lineHeight: "19px",
                }}
              >
                Total you pay
              </span>
              <span
                style={{
                  color: theme.colors.textStrong,
                  fontFamily: theme.fonts.display,
                  fontSize: "15px",
                  fontWeight: 500,
                  lineHeight: "19px",
                }}
              >
                {formatCurrencyAmount(sourceAmount, sourceCurrencyCode)}
              </span>
            </div>
          </div>
        </Sheet>
      )}

      {activeSheet === "partner" && (
        <Sheet onClose={() => setActiveSheet(null)} title="Payment partner">
          <SheetSearchInput
            onChange={setPartnerSearch}
            placeholder="Search payment partner"
            value={partnerSearch}
          />
          {filteredQuotes.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredQuotes.map((quote) => {
                const quoteIndex = quotes.findIndex(
                  (candidate) =>
                    candidate.provider === quote.provider &&
                    candidate.paymentMethodType === quote.paymentMethodType
                );
                return (
                  <SelectRow
                    icon={<ProviderMark provider={quote.provider} />}
                    key={`${quote.provider}-${quote.paymentMethodType}`}
                    onClick={() => {
                      setSelectedProvider(quote.provider);
                      setActiveSheet(null);
                    }}
                    primary={quoteIndex === 0}
                    selected={quote.provider === selectedQuote?.provider}
                    subtitle={`${getMethodLabel(quote.paymentMethodType)} · ${getMethodSubtitle(quote.paymentMethodType)}`}
                    title={getProviderLabel(quote.provider)}
                    value={`${formatNumberDisplay(quote.destinationAmount, 6)} ${toToken?.symbol ?? ""}`}
                  />
                );
              })}
            </div>
          ) : (
            <EmptySheetMessage>No payment partners found.</EmptySheetMessage>
          )}
        </Sheet>
      )}

      {activeSheet === "currency" && (
        <Sheet onClose={() => setActiveSheet(null)} title="Select currency">
          <SheetSearchInput
            onChange={setCurrencySearch}
            placeholder="Search currency"
            value={currencySearch}
          />
          <div style={sectionLabelStyle}>Fiat currencies</div>
          {filteredFiatCurrencies.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredFiatCurrencies.map((currencyCode) => (
                <SelectRow
                  icon={<CurrencyMark code={currencyCode} />}
                  key={currencyCode}
                  onClick={() => handleCurrencySelect(currencyCode)}
                  selected={currencyCode === sourceCurrencyCode}
                  subtitle={getFiatCurrencyName(currencyCode)}
                  title={currencyCode}
                />
              ))}
            </div>
          ) : (
            <EmptySheetMessage>No currencies found.</EmptySheetMessage>
          )}
        </Sheet>
      )}

      {activeSheet === "method" && (
        <Sheet onClose={() => setActiveSheet(null)} title="Payment method">
          <SheetSearchInput
            onChange={setMethodSearch}
            placeholder="Search payment method"
            value={methodSearch}
          />
          {filteredPaymentMethods.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredPaymentMethods.map((method) => (
                <SelectRow
                  icon={<MethodMark method={method.method} />}
                  key={method.method}
                  onClick={() => handleMethodSelect(method.method)}
                  selected={method.method === selectedPaymentMethod}
                  subtitle={getMethodSubtitle(method.method)}
                  title={getMethodLabel(method.method)}
                />
              ))}
            </div>
          ) : (
            <EmptySheetMessage>No payment methods found.</EmptySheetMessage>
          )}
        </Sheet>
      )}

      {activeSheet === "destination" && (
        <Sheet onClose={() => setActiveSheet(null)} title="Select token">
          <SheetSearchInput
            onChange={setDestinationSearch}
            placeholder="Search token or chain"
            value={destinationSearch}
          />
          {filteredDestinationTokens.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredDestinationTokens.map((token) => (
                <SelectRow
                  icon={<TokenLogoPair token={token} />}
                  key={getOnrampTokenKey(token)}
                  onClick={() => handleDestinationTokenSelect(token)}
                  selected={isSameOnrampToken(token, toToken)}
                  subtitle={token.chainName}
                  title={token.symbol}
                  value={token.balanceInFiat}
                />
              ))}
            </div>
          ) : (
            <EmptySheetMessage>No tokens found.</EmptySheetMessage>
          )}
        </Sheet>
      )}
    </div>
  );
}
