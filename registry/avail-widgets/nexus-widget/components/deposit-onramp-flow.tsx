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
  erc20Abi,
  formatUnits,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";
import { NEXUS_WIDGET_FAST_SPINNER_STYLE, nexusWidgetTheme } from "../theme";
import type { NexusWidgetDepositOpportunityConfig } from "../types";
import type { SwapTokenOption } from "./swap-asset-selector";

type OnrampCryptoCurrency = {
  chainCode?: string;
  chainId: number | string;
  contract?: string;
  currencyCode: string;
  decimals?: number;
  name?: string;
  symbolUrl?: string;
  token?: string;
};

type OnrampCountry = {
  countryCode: string;
  flagUrl?: string;
  name: string;
  subdivisions?: unknown[];
};

type OnrampFiatCurrency =
  | string
  | {
      code?: string;
      currencyCode?: string;
      flagUrl?: string;
      name?: string;
      symbol?: string;
      symbolUrl?: string;
    };

type OnrampFiatCurrencyOption = {
  currencyCode: string;
  flagUrl?: string;
  name?: string;
  symbol?: string;
  symbolUrl?: string;
};

type OnrampOptionsResponse = {
  countries?: OnrampCountry[];
  selection?: {
    countryCode: string;
    cryptoCurrencies?: OnrampCryptoCurrency[];
    defaultFiat?: string;
    defaultPaymentMethods?: string[];
    fiatCurrencies?: OnrampFiatCurrency[];
  } | null;
};

type IpCountryResponse = {
  country?: string;
  ip?: string;
};

type OnrampErrorResponse = {
  code?: string;
  errorId?: string;
  message?: string;
  subcode?: string;
};

type OnrampPaymentMethod = {
  description?: string;
  duration?: string;
  estimatedDuration?: string;
  estimatedTime?: string;
  limits?: {
    currencyCode?: string;
    max?: string;
    min?: string;
  };
  method: string;
  subtitle?: string;
  type?: string;
};

type OnrampRoute = {
  paymentMethods?: OnrampPaymentMethod[];
  provider: string;
};

type OnrampRoutesResponse = {
  routes?: OnrampRoute[];
};

type OnrampProviderOption = {
  destinationAmount?: string;
  paymentMethod?: OnrampPaymentMethod;
  paymentMethodType?: string;
  provider: string;
  quote?: OnrampQuote;
  route?: OnrampRoute;
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

type OnrampCacheRecord<T> = {
  expiresAt: number;
  value: T;
};

type OnrampBlockedRequest = {
  key: string;
  message: string;
};

type OnrampDepositExecutionState = {
  amount?: string;
  error?: string;
  explorerUrl?: string;
  skipped?: boolean;
  status: "idle" | "running" | "success" | "failed";
  txHash?: Hex;
};

type OnrampNexusSDK = {
  chainList?: {
    getChainByID?: (chainId: number) =>
      | {
          blockExplorers?: {
            default?: {
              url?: string;
            };
          };
        }
      | null
      | undefined;
  };
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
  nexusSDK?: OnrampNexusSDK | null;
  ownerAddress?: string;
  opportunity?: NexusWidgetDepositOpportunityConfig;
  primaryButtonForeground: string;
  toToken?: SwapTokenOption;
  walletClient?: WalletClient | null;
}

const ONRAMP_CLIENT_HEADER = "nexus-widgets";
const ONRAMP_DEFAULT_BASE_URL = "https://nexus-v2.canary.avail.so/middleware";
const ONRAMP_RETURN_PATH = "/onramp/complete";
const ONRAMP_IP_COUNTRY_URL = "https://api.country.is/";
const ONRAMP_OPTIONS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ONRAMP_COUNTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ONRAMP_COUNTRY_CACHE_KEY = "nexus-widgets:onramp:country:v1";
const ONRAMP_OPTIONS_CACHE_KEY_PREFIX = "nexus-widgets:onramp:options:v1";
const ONRAMP_SANDBOX_FALLBACK_COUNTRY = "FR";
const ONRAMP_PRODUCTION_FALLBACK_COUNTRY = "US";
const QUOTE_REFRESH_SECONDS = 60;
const ONRAMP_SESSION_POLL_MS = 3000;
const ONRAMP_CALLBACK_MESSAGE_TYPE = "nexus-widgets:onramp:session";
const ONRAMP_CALLBACK_SUCCESS_MESSAGE = "nexus-onramp-success";
const ONRAMP_CALLBACK_SUCCESS_ACK_MESSAGE = "nexus-onramp-success-received";
const ONRAMP_CALLBACK_CHANNEL = "nexus-widgets:onramp";
const ONRAMP_CALLBACK_STORAGE_KEY = "nexus-widgets:onramp:session";
const ONRAMP_PROGRESS_ARTWORK_URL =
  "https://files.availproject.org/nexus-elements/nexus-one/progress-grid.gif";
const ONRAMP_SHEET_EDGE_OFFSET = "-16px";
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

const getIntlCurrencyName = (currencyCode?: string) => {
  if (!currencyCode) return "";
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "currency" }).of(
        currencyCode.toUpperCase(),
      ) ?? currencyCode
    );
  } catch {
    return currencyCode;
  }
};

const getIntlCurrencySymbol = (currencyCode?: string) => {
  if (!currencyCode) return undefined;
  try {
    return new Intl.NumberFormat("en", {
      currency: currencyCode.toUpperCase(),
      currencyDisplay: "narrowSymbol",
      style: "currency",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value;
  } catch {
    return undefined;
  }
};

const getFiatCurrencyCode = (currency: OnrampFiatCurrency) =>
  (typeof currency === "string"
    ? currency
    : (currency.currencyCode ?? currency.code ?? "")
  ).toUpperCase();

const getFiatCurrencyName = (
  currencyCode?: string,
  currency?: OnrampFiatCurrencyOption,
) => currency?.name ?? getIntlCurrencyName(currencyCode);

const getCountryByCode = (
  countries: OnrampCountry[] | undefined,
  countryCode?: string,
) =>
  countries?.find(
    (country) =>
      country.countryCode.toUpperCase() === countryCode?.toUpperCase(),
  );

const isCountryInOptionsList = (
  options: OnrampOptionsResponse,
  countryCode: string,
) => {
  if (!options.countries?.length) return true;
  return Boolean(getCountryByCode(options.countries, countryCode));
};

const getCountryFlagUrl = (
  countries: OnrampCountry[] | undefined,
  countryCode?: string,
) => {
  const normalizedCountryCode = countryCode?.toUpperCase();
  if (!normalizedCountryCode) return undefined;
  return (
    getCountryByCode(countries, normalizedCountryCode)?.flagUrl ??
    `https://flagsapi.com/${normalizedCountryCode}/flat/64.png`
  );
};

const getFiatCurrencyOptions = (
  options: OnrampOptionsResponse | null,
): OnrampFiatCurrencyOption[] => {
  const selection = options?.selection;
  const selectedCountryFlagUrl = getCountryFlagUrl(
    options?.countries,
    selection?.countryCode,
  );
  const byCode = new Map<string, OnrampFiatCurrencyOption>();

  for (const currency of selection?.fiatCurrencies ?? []) {
    const currencyCode = getFiatCurrencyCode(currency);
    if (!currencyCode || byCode.has(currencyCode)) continue;
    const isDefaultFiat =
      currencyCode === selection?.defaultFiat?.toUpperCase();
    byCode.set(currencyCode, {
      currencyCode,
      flagUrl:
        typeof currency === "string"
          ? isDefaultFiat
            ? selectedCountryFlagUrl
            : undefined
          : (currency.flagUrl ??
            currency.symbolUrl ??
            (isDefaultFiat ? selectedCountryFlagUrl : undefined)),
      name:
        typeof currency === "string"
          ? getIntlCurrencyName(currencyCode)
          : (currency.name ?? getIntlCurrencyName(currencyCode)),
      symbol:
        typeof currency === "string"
          ? getIntlCurrencySymbol(currencyCode)
          : (currency.symbol ?? getIntlCurrencySymbol(currencyCode)),
      symbolUrl: typeof currency === "string" ? undefined : currency.symbolUrl,
    });
  }

  const defaultFiat = selection?.defaultFiat?.toUpperCase();
  if (defaultFiat && !byCode.has(defaultFiat)) {
    byCode.set(defaultFiat, {
      currencyCode: defaultFiat,
      flagUrl: selectedCountryFlagUrl,
      name: getIntlCurrencyName(defaultFiat),
      symbol: getIntlCurrencySymbol(defaultFiat),
    });
  }

  return Array.from(byCode.values());
};

const readOnrampCache = <T,>(key: string) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as OnrampCacheRecord<T>;
    if (!cached?.expiresAt || cached.expiresAt <= Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }
    return cached.value;
  } catch {
    return null;
  }
};

const writeOnrampCache = <T,>(key: string, value: T, ttlMs: number) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        expiresAt: Date.now() + ttlMs,
        value,
      } satisfies OnrampCacheRecord<T>),
    );
  } catch {
    // Cache failures should not affect the onramp flow.
  }
};

const getOnrampOptionsCacheKey = (baseUrl: string, countryCode: string) =>
  `${ONRAMP_OPTIONS_CACHE_KEY_PREFIX}:${baseUrl}:${countryCode.toUpperCase()}`;

const readCachedOnrampOptions = (baseUrl: string, countryCode: string) =>
  readOnrampCache<OnrampOptionsResponse>(
    getOnrampOptionsCacheKey(baseUrl, countryCode),
  );

const writeCachedOnrampOptions = (
  baseUrl: string,
  countryCode: string,
  options: OnrampOptionsResponse,
) => {
  writeOnrampCache(
    getOnrampOptionsCacheKey(baseUrl, countryCode),
    options,
    ONRAMP_OPTIONS_CACHE_TTL_MS,
  );
};

const getOnrampEnvironmentValue = (key: string) => {
  if (typeof process === "undefined") return "";
  return process.env?.[key]?.trim() ?? "";
};

const normalizeOnrampBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, "");

const getOnrampBaseUrl = () =>
  normalizeOnrampBaseUrl(
    getOnrampEnvironmentValue("NEXT_PUBLIC_NEXUS_ONRAMP_BASE_URL") ||
      ONRAMP_DEFAULT_BASE_URL,
  );

const getOnrampReturnUrl = () =>
  getOnrampEnvironmentValue("NEXT_PUBLIC_NEXUS_ONRAMP_RETURN_URL") ||
  (typeof window !== "undefined" && window.location.origin
    ? `${window.location.origin}${ONRAMP_RETURN_PATH}`
    : ONRAMP_RETURN_PATH);

const getOnrampRuntimeEnvironment = (baseUrl: string) => {
  const explicitEnvironment =
    getOnrampEnvironmentValue("NEXT_PUBLIC_NEXUS_ONRAMP_ENV") ||
    getOnrampEnvironmentValue("NEXT_PUBLIC_ONRAMP_ENV") ||
    getOnrampEnvironmentValue("NEXT_PUBLIC_NEXUS_ENV") ||
    getOnrampEnvironmentValue("NEXT_PUBLIC_VERCEL_ENV") ||
    getOnrampEnvironmentValue("VERCEL_ENV");

  if (explicitEnvironment) return explicitEnvironment.toLowerCase();

  const normalizedBaseUrl = baseUrl.toLowerCase();
  if (
    normalizedBaseUrl.includes("canary") ||
    normalizedBaseUrl.includes("localhost") ||
    normalizedBaseUrl.includes("127.0.0.1")
  ) {
    return "sandbox";
  }

  return "production";
};

const getUnsupportedCountryFallbackCode = (baseUrl: string) => {
  const environment = getOnrampRuntimeEnvironment(baseUrl);
  return environment === "production" || environment === "prod"
    ? ONRAMP_PRODUCTION_FALLBACK_COUNTRY
    : ONRAMP_SANDBOX_FALLBACK_COUNTRY;
};

const getIpCountryCode = async () => {
  try {
    const response = await fetch(ONRAMP_IP_COUNTRY_URL, {
      headers: { Accept: "application/json" },
      method: "GET",
    });
    if (!response.ok) return "";
    const data = (await response.json()) as IpCountryResponse;
    return data.country?.toUpperCase() ?? "";
  } catch {
    return "";
  }
};

const getLocalCountryCode = () => {
  if (typeof navigator === "undefined") return "";
  const locales = [...(navigator.languages ?? []), navigator.language].filter(
    Boolean,
  );
  for (const locale of locales) {
    const countryCode = locale.match(/[-_]([A-Za-z]{2})$/)?.[1]?.toUpperCase();
    if (countryCode) return countryCode;
  }
  return "";
};

const resolveOnrampCountryCode = async () => {
  const cached = readOnrampCache<string>(ONRAMP_COUNTRY_CACHE_KEY);
  if (cached) return cached;

  const resolved = (await getIpCountryCode()) || getLocalCountryCode() || "US";
  writeOnrampCache(
    ONRAMP_COUNTRY_CACHE_KEY,
    resolved,
    ONRAMP_COUNTRY_CACHE_TTL_MS,
  );
  return resolved;
};

const getDefaultFiatCurrencyCode = (options: OnrampOptionsResponse | null) => {
  const currencies = getFiatCurrencyOptions(options);
  const defaultFiat = options?.selection?.defaultFiat?.toUpperCase();
  if (
    defaultFiat &&
    currencies.some((currency) => currency.currencyCode === defaultFiat)
  ) {
    return defaultFiat;
  }
  return currencies[0]?.currencyCode ?? "";
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
                part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
            )
            .join(" ")
        : "Payment method";
  }
};

const getMethodSubtitle = (method?: OnrampPaymentMethod) => {
  const subtitle =
    method?.subtitle ??
    method?.description ??
    method?.estimatedTime ??
    method?.estimatedDuration ??
    method?.duration;
  return typeof subtitle === "string" && subtitle.trim()
    ? subtitle.trim()
    : undefined;
};

const getProviderLabel = (provider?: string) =>
  provider
    ? provider
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map(
          (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
        )
        .join(" ")
    : "Payment partner";

const getProviderInitials = (provider?: string) => {
  const label = getProviderLabel(provider);
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return label.slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
};

class OnrampRequestError extends Error {
  code?: string;
  errorId?: string;
  rawMessage?: string;
  status: number;
  subcode?: string;

  constructor({
    code,
    errorId,
    message,
    rawMessage,
    status,
    subcode,
  }: {
    code?: string;
    errorId?: string;
    message: string;
    rawMessage?: string;
    status: number;
    subcode?: string;
  }) {
    super(message);
    this.name = "OnrampRequestError";
    this.code = code;
    this.errorId = errorId;
    this.rawMessage = rawMessage;
    this.status = status;
    this.subcode = subcode;
  }
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unable to continue with local currency.";
};

const getOnrampErrorSignature = (error: OnrampRequestError) =>
  [error.code, error.subcode, error.rawMessage, error.message]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

const isUnsupportedOnrampDestinationError = (error: unknown) => {
  if (!(error instanceof OnrampRequestError)) return false;
  const signature = getOnrampErrorSignature(error);
  return (
    signature.includes("ASSET_NOT_SUPPORTED") ||
    signature.includes("CURRENCY_NOT_SUPPORTED") ||
    signature.includes("TOKEN_NOT_SUPPORTED") ||
    signature.includes("TOKEN UNSUPPORTED") ||
    signature.includes("UNSUPPORTED_DESTINATION") ||
    signature.includes("UNSUPPORTED TOKEN") ||
    signature.includes("DESTINATION ASSET IS NOT SUPPORTED") ||
    signature.includes("DESTINATIONCHAINID IS INVALID") ||
    signature.includes("DESTINATIONTOKEN IS INVALID")
  );
};

const isOnrampConfigError = (error: unknown) => {
  if (!(error instanceof OnrampRequestError)) return false;
  const signature = getOnrampErrorSignature(error);
  return (
    signature.includes("CONFIG") ||
    signature.includes("CONFIGURATION") ||
    signature.includes("NOT CONFIGURED") ||
    signature.includes("NO ROUTE") ||
    (signature.includes("ROUTE") && signature.includes("UNAVAILABLE"))
  );
};

const isTerminalOnrampRateError = (error: unknown) =>
  isUnsupportedOnrampDestinationError(error) || isOnrampConfigError(error);

const getOnrampRequestErrorMessage = (
  error: unknown,
  context?: {
    countryCode?: string;
    sourceCurrencyCode?: string;
    token?: SwapTokenOption;
  },
) => {
  if (isTerminalOnrampRateError(error)) {
    const tokenLabel = context?.token?.symbol
      ? `${context.token.symbol}${
          context.token.chainName ? ` on ${context.token.chainName}` : ""
        }`
      : "this token";
    const localeLabel = [context?.countryCode, context?.sourceCurrencyCode]
      .filter(Boolean)
      .join(" / ");
    return `Local currency deposits are not available for ${tokenLabel}${
      localeLabel ? ` with ${localeLabel}` : ""
    }. Choose another deposit token or pay with wallet.`;
  }

  return getErrorMessage(error);
};

const getOnrampRateRequestKey = ({
  countryCode,
  destinationChainId,
  destinationCurrencyCode,
  destinationToken,
  sourceCurrencyCode,
}: {
  countryCode?: string;
  destinationChainId?: string;
  destinationCurrencyCode?: string;
  destinationToken?: string;
  sourceCurrencyCode?: string;
}) =>
  [
    countryCode?.toUpperCase() ?? "",
    sourceCurrencyCode?.toUpperCase() ?? "",
    destinationCurrencyCode?.toUpperCase() ?? "",
    destinationChainId ?? "",
    destinationToken?.toLowerCase() ?? "",
  ].join("|");

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
    lower === zeroAddress ||
    lower === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  );
};

const isPositiveGasLimit = (value: unknown): value is bigint => {
  try {
    return BigInt(value as bigint) > BigInt(0);
  } catch {
    return false;
  }
};

const getOnrampChainIdNumber = (chainId?: number | string) => {
  if (typeof chainId === "number") return chainId;
  const match = chainId?.match(/\d+$/);
  return match ? Number(match[0]) : undefined;
};

const getOnrampCurrencyAddress = (currency?: OnrampCryptoCurrency) =>
  currency?.contract ?? currency?.token;

const getOnrampCryptoCurrency = (
  options: OnrampOptionsResponse | null,
  token?: SwapTokenOption,
) => {
  if (!token?.chainId || !token.contractAddress) return undefined;

  const targetAddress = token.contractAddress.toLowerCase();
  return options?.selection?.cryptoCurrencies?.find((currency) => {
    if (getOnrampChainIdNumber(currency.chainId) !== token.chainId)
      return false;
    const address = getOnrampCurrencyAddress(currency)?.toLowerCase();
    if (!address) return false;
    return (
      address === targetAddress ||
      (isNativeAddress(address) && isNativeAddress(targetAddress))
    );
  });
};

const getDestinationRequestDetails = (
  options: OnrampOptionsResponse | null,
  token?: SwapTokenOption,
) => {
  const matched = getOnrampCryptoCurrency(options, token);
  return {
    destinationChainId: token?.chainId ? `EVM_${token.chainId}` : undefined,
    destinationCurrencyCode:
      matched?.currencyCode ?? token?.symbol?.toUpperCase() ?? "",
    destinationToken: token?.contractAddress,
  };
};

const getRawTokenAmount = (amount: unknown, decimals: number) => {
  const parsed = parseDecimal(amount);
  if (!parsed?.gt(0)) return null;
  return parseUnits(
    parsed.toDecimalPlaces(decimals, Decimal.ROUND_DOWN).toFixed(),
    decimals,
  );
};

const isMatchingOnrampToken = (
  token: SwapTokenOption,
  chainId: number,
  tokenAddress: string,
) => {
  if (token.chainId !== chainId) return false;
  const candidateAddress = token.contractAddress?.toLowerCase();
  const targetAddress = tokenAddress.toLowerCase();
  return (
    candidateAddress === targetAddress ||
    (isNativeAddress(candidateAddress) && isNativeAddress(targetAddress))
  );
};

const getOnrampTokenBalanceRaw = (
  token: SwapTokenOption,
  decimals: number,
  chainId: number,
  tokenAddress: string,
) => {
  const matchingToken =
    token.sourceTokens?.find((sourceToken) =>
      isMatchingOnrampToken(sourceToken, chainId, tokenAddress),
    ) ?? (isMatchingOnrampToken(token, chainId, tokenAddress) ? token : null);
  if (!matchingToken) return null;

  const balanceAmount = parseDecimal(
    matchingToken.userAmount ?? matchingToken.balance,
  );
  if (!balanceAmount?.gt(0)) return null;

  return parseUnits(
    balanceAmount.toDecimalPlaces(decimals, Decimal.ROUND_DOWN).toFixed(),
    decimals,
  );
};

const getTransactionExplorerUrl = (chainId?: number, txHash?: string) => {
  const baseUrl = getExplorerBaseUrl(chainId);
  return baseUrl && txHash ? `${baseUrl}${txHash}` : undefined;
};

const getSandboxDepositAmountRaw = (decimals: number) =>
  BigInt(new Decimal(0.1).mul(Decimal.pow(10, decimals)).toFixed());

const getNexusChainTransactionExplorerUrl = (
  nexusSDK: OnrampNexusSDK | null | undefined,
  chainId?: number,
  txHash?: string,
) => {
  if (!chainId || !txHash) return undefined;
  try {
    const baseUrl =
      nexusSDK?.chainList?.getChainByID?.(chainId)?.blockExplorers?.default
        ?.url;
    if (baseUrl) return `${baseUrl.replace(/\/+$/, "")}/tx/${txHash}`;
  } catch {
    return getTransactionExplorerUrl(chainId, txHash);
  }
  return getTransactionExplorerUrl(chainId, txHash);
};

const waitForWalletTransactionSuccess = async (
  walletClient: WalletClient,
  txHash: Hex,
) => {
  const timeoutAt = Date.now() + 120_000;
  while (Date.now() < timeoutAt) {
    const receipt = (await walletClient.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    } as any)) as { status?: Hex } | null;

    if (receipt) {
      if (receipt.status === "0x0") {
        throw new Error("Transaction failed.");
      }
      return receipt;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Timed out waiting for deposit transaction.");
};

const getOnrampTokenKey = (token?: SwapTokenOption) => {
  if (!token?.chainId || !token.contractAddress) return "";
  return `${token.chainId}:${token.contractAddress.toLowerCase()}`;
};

const isSameOnrampToken = (left?: SwapTokenOption, right?: SwapTokenOption) =>
  Boolean(
    left && right && getOnrampTokenKey(left) === getOnrampTokenKey(right),
  );

const sortQuotes = (quotes: OnrampQuote[]) =>
  [...quotes].sort((a, b) => {
    const scoreDelta = (b.rampScore ?? 0) - (a.rampScore ?? 0);
    if (scoreDelta !== 0) return scoreDelta;
    const destinationDelta =
      parseDecimal(b.destinationAmount)?.cmp(
        parseDecimal(a.destinationAmount) ?? new Decimal(0),
      ) ?? 0;
    return destinationDelta;
  });

const matchesSearch = (query: string, values: Array<string | undefined>) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return values.some((value) =>
    (value ?? "").toLowerCase().includes(normalizedQuery),
  );
};

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const openOnrampProviderWindow = () => {
  if (typeof window === "undefined") return null;
  const providerWindow = window.open("about:blank", "_blank");
  if (!providerWindow) return null;
  providerWindow.document.title = "Opening payment provider";
  providerWindow.document.body.style.fontFamily =
    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  providerWindow.document.body.style.margin = "0";
  providerWindow.document.body.style.display = "grid";
  providerWindow.document.body.style.minHeight = "100vh";
  providerWindow.document.body.style.placeItems = "center";
  providerWindow.document.body.textContent = "Opening payment provider...";
  return providerWindow;
};

type OnrampCallbackPayload = {
  session?: OnrampSessionResponse;
  sessionId: string;
  state?: string;
  timestamp?: number;
  type: string;
};

declare global {
  interface Window {
    setRampSessionId?: (sessionId: string) => void;
  }
}

const isOnrampCallbackPayload = (
  payload: unknown,
): payload is OnrampCallbackPayload => {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Partial<OnrampCallbackPayload>;
  return (
    candidate.type === ONRAMP_CALLBACK_MESSAGE_TYPE &&
    typeof candidate.sessionId === "string" &&
    candidate.sessionId.length > 0
  );
};

const fetchOnrampJson = async <T,>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
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
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text ? { message: text } : {};
  }

  if (!response.ok) {
    const errorData = data as OnrampErrorResponse;
    const baseMessage =
      typeof errorData?.message === "string"
        ? errorData.message
        : `Onramp request failed (${response.status})`;
    const details = [errorData?.subcode, errorData?.errorId]
      .filter(Boolean)
      .join(" · ");
    const message = details ? `${baseMessage} (${details})` : baseMessage;
    throw new OnrampRequestError({
      code: errorData?.code,
      errorId: errorData?.errorId,
      message,
      rawMessage: baseMessage,
      status: response.status,
      subcode: errorData?.subcode,
    });
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

function CurrencyMark({
  code,
  currency,
}: {
  code?: string;
  currency?: OnrampFiatCurrencyOption;
}) {
  const displayCode = currency?.currencyCode ?? code;
  const imageUrl = currency?.flagUrl ?? currency?.symbolUrl;

  if (imageUrl) {
    return <TokenLogo label={displayCode} size={32} src={imageUrl} />;
  }

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
      {(currency?.symbol ?? displayCode ?? "?").slice(0, 3).toUpperCase()}
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
    normalized === "UPI" ||
    normalized === "APPLE_PAY" ||
    normalized === "GOOGLE_PAY" ? (
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
        bottom: ONRAMP_SHEET_EDGE_OFFSET,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        left: ONRAMP_SHEET_EDGE_OFFSET,
        position: "absolute",
        right: ONRAMP_SHEET_EDGE_OFFSET,
        top: ONRAMP_SHEET_EDGE_OFFSET,
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
          boxShadow: "none",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          height: "min(420px, 100%)",
          maxHeight: "100%",
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
          <div style={compactTitleStyle}>{title}</div>
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

function QuoteDetailsSkeleton({ showFees = true }: { showFees?: boolean }) {
  return (
    <div style={panelStyle}>
      <DetailRow
        action={
          <SkeletonBlock borderRadius="999px" height="30px" width="62px" />
        }
        label="Payment Method"
      >
        <div style={{ alignItems: "center", display: "flex", gap: "10px" }}>
          <SkeletonBlock height="38px" width="38px" />
          <SkeletonBlock height="20px" width="120px" />
        </div>
      </DetailRow>

      <DetailRow
        action={
          <SkeletonBlock borderRadius="999px" height="30px" width="62px" />
        }
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

      {showFees && (
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
      )}
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
  opportunity?: NexusWidgetDepositOpportunityConfig,
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
  provider?: string,
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
  opportunity?: NexusWidgetDepositOpportunityConfig,
) =>
  opportunity?.title ||
  opportunity?.label ||
  opportunity?.protocol ||
  "the selected market";

const getDepositChainName = (
  opportunity?: NexusWidgetDepositOpportunityConfig,
  token?: SwapTokenOption,
) =>
  token?.chainName ?? opportunity?.subtitle?.replace(/^on\s+/i, "") ?? "chain";

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
  token?: SwapTokenOption,
) => {
  if (session.deposit?.explorerUrl) return session.deposit.explorerUrl;
  const txHash = session.deposit?.txHash;
  const baseUrl = getExplorerBaseUrl(token?.chainId);
  return txHash && baseUrl ? `${baseUrl}${txHash}` : undefined;
};

function OnrampStatusArtwork() {
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
      <img
        alt=""
        src={ONRAMP_PROGRESS_ARTWORK_URL}
        style={{
          display: "block",
          height: "100%",
          objectFit: "cover",
          width: "100%",
        }}
      />
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
        <div style={compactTitleStyle}>{title}</div>
        <div style={compactBodyStyle}>{description}</div>
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
            color: isPending
              ? theme.colors.textSubtle
              : theme.colors.textStrong,
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

type OnrampTimelineItem = {
  complete?: boolean;
  pending?: boolean;
  subtitle: string;
  title: string;
};

function OnrampExpandableTimelineCard({
  summaryAmount,
  summaryLabel,
  steps,
}: {
  summaryAmount: string;
  summaryLabel: string;
  steps: OnrampTimelineItem[];
}) {
  const [expanded, setExpanded] = React.useState(true);
  return (
    <div
      style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: "10px",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <button
        onClick={() => setExpanded((current) => !current)}
        style={{
          alignItems: "center",
          background: "transparent",
          border: "none",
          color: theme.colors.textStrong,
          cursor: "pointer",
          display: "flex",
          fontFamily: theme.fonts.sans,
          fontSize: "14px",
          gap: "10px",
          justifyContent: "space-between",
          lineHeight: "20px",
          padding: "12px 14px",
          textAlign: "left",
          width: "100%",
        }}
        type="button"
      >
        <span>{summaryLabel}</span>
        <span
          style={{
            alignItems: "center",
            display: "flex",
            flexShrink: 0,
            fontFamily: theme.fonts.display,
            fontWeight: 500,
            gap: "6px",
          }}
        >
          {summaryAmount}
          <ChevronDown
            aria-hidden="true"
            color={theme.colors.icon}
            size={15}
            strokeWidth={1.8}
            style={{ transform: expanded ? "rotate(180deg)" : undefined }}
          />
        </span>
      </button>
      {expanded && (
        <div
          style={{
            backgroundColor: "#EFEFEF",
            display: "flex",
            flexDirection: "column",
            padding: "14px",
          }}
        >
          {steps.map((step, index) => (
            <TimelineStep
              isComplete={step.complete}
              isLast={index === steps.length - 1}
              isPending={step.pending}
              key={`${step.title}-${index}`}
              subtitle={step.subtitle}
              title={step.title}
            />
          ))}
        </div>
      )}
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
    destinationSymbol,
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
        <OnrampExpandableTimelineCard
          steps={[
            {
              complete: isSettling,
              subtitle: `${sourceDisplay} by ${getProviderLabel(provider)}`,
              title: isSettling ? "Payment received" : "Payment processing",
            },
            {
              pending: !isSettling,
              subtitle: `On ${destinationChainName}`,
              title: `Sending ${destinationDisplay} to your wallet`,
            },
            {
              pending: true,
              subtitle: `On ${destinationChainName}`,
              title: `Depositing on ${targetLabel}`,
            },
          ]}
          summaryAmount={isSettling ? destinationDisplay : sourceDisplay}
          summaryLabel={
            isSettling
              ? "Sending amount to your wallet"
              : "Processing your payment"
          }
        />
        <SafeCloseNotice />
      </div>
    </>
  );
}

function OnrampCompletingDepositPanel({
  destinationAmount,
  destinationChainName,
  destinationSymbol,
  provider,
  sourceAmount,
  sourceCurrencyCode,
  targetLabel,
}: {
  destinationAmount: string;
  destinationChainName: string;
  destinationSymbol?: string;
  provider?: string;
  sourceAmount: string;
  sourceCurrencyCode: string;
  targetLabel: string;
}) {
  const destinationDisplay = formatTokenAmountDisplay(
    destinationAmount,
    destinationSymbol,
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
        <OnrampExpandableTimelineCard
          steps={[
            {
              complete: true,
              subtitle: `${sourceDisplay} by ${getProviderLabel(provider)}`,
              title: "Payment received",
            },
            {
              complete: true,
              subtitle: `On ${destinationChainName}`,
              title: `Sent ${destinationDisplay} to your wallet`,
            },
            {
              subtitle: `On ${destinationChainName}`,
              title: `Depositing on ${targetLabel}`,
            },
          ]}
          summaryAmount={destinationDisplay}
          summaryLabel={`Depositing to ${targetLabel}`}
        />
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
      <OnrampStatusArtwork />
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
  destinationChainName,
  provider,
  summaryAmount,
  targetLabel,
}: {
  destinationChainName: string;
  provider?: string;
  summaryAmount: string;
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
        <OnrampExpandableTimelineCard
          steps={[
            {
              subtitle: `With ${getProviderLabel(provider)}`,
              title: "Continue on other window",
            },
            {
              pending: true,
              subtitle: `On ${destinationChainName}`,
              title: `Sending ${summaryAmount} to your wallet`,
            },
            {
              pending: true,
              subtitle: `On ${destinationChainName}`,
              title: `Depositing on ${targetLabel}`,
            },
          ]}
          summaryAmount={summaryAmount}
          summaryLabel={getOnrampSummaryLabel("AWAITING_USER", provider)}
        />
      </div>
    </>
  );
}

function OnrampSessionStatusPanel({
  depositExecution,
  onCancel,
  onDone,
  onRetryDeposit,
  onRetryPayment,
  opportunity,
  primaryButtonForeground,
  quote,
  session,
  sessionCallbackReceived,
  sourceAmount,
  sourceCurrencyCode,
  toToken,
}: {
  depositExecution: OnrampDepositExecutionState;
  onCancel: () => void;
  onDone: () => void;
  onRetryDeposit: () => void;
  onRetryPayment: () => void;
  opportunity?: NexusWidgetDepositOpportunityConfig;
  primaryButtonForeground: string;
  quote?: OnrampQuote;
  session: OnrampSessionResponse;
  sessionCallbackReceived: boolean;
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
    depositExecution.amount ??
    transaction?.destinationAmount ??
    quote?.destinationAmount ??
    "";
  const sourceDisplayAmount =
    transaction?.sourceAmount ?? quote?.sourceAmount ?? sourceAmount;
  const sourceDisplayCurrency =
    transaction?.sourceCurrencyCode ??
    quote?.sourceCurrencyCode ??
    sourceCurrencyCode;
  const destinationChainName = getDepositChainName(opportunity, toToken);
  const targetLabel = getDepositTargetLabel(opportunity);
  const explorerUrl =
    depositExecution.explorerUrl ?? getOnrampExplorerUrl(session, toToken);
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
            provider,
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

  if (
    depositExecution.status === "failed" ||
    isOnrampDepositFailedState(normalizedState)
  ) {
    return (
      <div style={containerStyle}>
        <OnrampActionStatusPanel
          description={
            depositExecution.error ??
            getOnrampSessionSubtitle(normalizedState, opportunity)
          }
          onPrimary={onRetryDeposit}
          onSecondary={onDone}
          primaryButtonForeground={primaryButtonForeground}
          primaryLabel="Retry Deposit"
          secondaryLabel="Skip Deposit"
          title="Deposit needs your attention"
        />
      </div>
    );
  }

  if (
    depositExecution.status === "success" ||
    isOnrampDepositSuccessState(normalizedState)
  ) {
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

  if (
    normalizedState === "SETTLED" ||
    depositExecution.status === "running" ||
    isOnrampDepositProcessingState(normalizedState)
  ) {
    return (
      <div style={containerStyle}>
        <OnrampCompletingDepositPanel
          destinationAmount={destinationAmount}
          destinationChainName={destinationChainName}
          destinationSymbol={destinationSymbol}
          provider={provider}
          sourceAmount={sourceDisplayAmount}
          sourceCurrencyCode={sourceDisplayCurrency}
          targetLabel={targetLabel}
        />
      </div>
    );
  }

  if (sessionCallbackReceived) {
    return (
      <div style={containerStyle}>
        <OnrampProcessingTimelinePanel
          destinationAmount={destinationAmount}
          destinationChainName={destinationChainName}
          destinationSymbol={destinationSymbol}
          isSettling={true}
          provider={provider}
          sourceAmount={sourceDisplayAmount}
          sourceCurrencyCode={sourceDisplayCurrency}
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
        destinationChainName={destinationChainName}
        provider={provider}
        summaryAmount={formatTokenAmountDisplay(
          destinationAmount,
          destinationSymbol,
        )}
        targetLabel={targetLabel}
      />
    </div>
  );
}

export function DepositOnrampFlow({
  baseUrl = getOnrampBaseUrl(),
  destinationTokens,
  onConnectWallet,
  onError,
  onSelectDestinationToken,
  onSessionStateChange,
  nexusSDK,
  ownerAddress,
  opportunity,
  primaryButtonForeground,
  toToken,
  walletClient,
}: DepositOnrampFlowProps) {
  const [countryCode, setCountryCode] = React.useState("");
  const [sourceCurrencyCode, setSourceCurrencyCode] = React.useState("");
  const [sourceAmount, setSourceAmount] = React.useState("");
  const [options, setOptions] = React.useState<OnrampOptionsResponse | null>(
    null,
  );
  const [routes, setRoutes] = React.useState<OnrampRoute[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState("");
  const [quotes, setQuotes] = React.useState<OnrampQuote[]>([]);
  const [selectedProvider, setSelectedProvider] = React.useState("");
  const [activeSheet, setActiveSheet] = React.useState<OnrampSheet>(null);
  const [methodSearch, setMethodSearch] = React.useState("");
  const [partnerSearch, setPartnerSearch] = React.useState("");
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [routesLoading, setRoutesLoading] = React.useState(false);
  const [quotesLoading, setQuotesLoading] = React.useState(false);
  const [sessionLoading, setSessionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [blockedRateRequest, setBlockedRateRequest] =
    React.useState<OnrampBlockedRequest | null>(null);
  const [session, setSession] = React.useState<OnrampSessionResponse | null>(
    null,
  );
  const [sessionCallbackReceived, setSessionCallbackReceived] =
    React.useState(false);
  const [depositExecution, setDepositExecution] =
    React.useState<OnrampDepositExecutionState>({ status: "idle" });
  const [quoteRefreshSeconds, setQuoteRefreshSeconds] = React.useState(
    QUOTE_REFRESH_SECONDS,
  );
  const quoteRunIdRef = React.useRef(0);
  const routeRunIdRef = React.useRef(0);
  const lastRouteRequestKeyRef = React.useRef("");
  const lastQuoteRequestKeyRef = React.useRef("");
  const quotesLoadingRef = React.useRef(false);
  const depositExecutionSessionRef = React.useRef("");
  const normalizedSessionState = getNormalizedOnrampState(session?.state);

  const fiatCurrencyOptions = React.useMemo(
    () => getFiatCurrencyOptions(options),
    [options],
  );
  const selectedFiatCurrency = fiatCurrencyOptions.find(
    (currency) => currency.currencyCode === sourceCurrencyCode,
  );
  const selectedOnrampCryptoCurrency = React.useMemo(
    () => getOnrampCryptoCurrency(options, toToken),
    [options, toToken],
  );
  const hasBackendCryptoCurrencyList = Array.isArray(
    options?.selection?.cryptoCurrencies,
  );
  const isDestinationTokenUnsupported = Boolean(
    hasBackendCryptoCurrencyList &&
    toToken?.chainId &&
    toToken.contractAddress &&
    !selectedOnrampCryptoCurrency,
  );
  const destinationTokenUnsupportedMessage = isDestinationTokenUnsupported
    ? "Token is not supported for purchase with local currency"
    : null;
  const availableDestinationTokens = React.useMemo(() => {
    const tokens = destinationTokens?.length
      ? destinationTokens
      : toToken
        ? [toToken]
        : [];
    const byKey = new Map<string, SwapTokenOption>();
    for (const token of tokens) {
      const key = getOnrampTokenKey(token);
      if (!key) continue;
      const onrampCurrency = getOnrampCryptoCurrency(options, token);
      byKey.set(key, {
        ...token,
        logo: onrampCurrency?.symbolUrl ?? token.logo,
        name: token.name ?? onrampCurrency?.name,
      });
    }
    return Array.from(byKey.values());
  }, [destinationTokens, options, toToken]);
  const destinationRequestDetails = React.useMemo(
    () => getDestinationRequestDetails(options, toToken),
    [options, toToken],
  );
  const rateRequestKey = React.useMemo(
    () =>
      getOnrampRateRequestKey({
        countryCode,
        destinationChainId: destinationRequestDetails.destinationChainId,
        destinationCurrencyCode:
          destinationRequestDetails.destinationCurrencyCode,
        destinationToken: destinationRequestDetails.destinationToken,
        sourceCurrencyCode,
      }),
    [
      countryCode,
      destinationRequestDetails.destinationChainId,
      destinationRequestDetails.destinationCurrencyCode,
      destinationRequestDetails.destinationToken,
      sourceCurrencyCode,
    ],
  );
  const quoteRequestKey = React.useMemo(
    () =>
      [
        rateRequestKey,
        ownerAddress?.toLowerCase() ?? "",
        selectedPaymentMethod,
        sourceAmount.trim(),
      ].join("|"),
    [ownerAddress, rateRequestKey, selectedPaymentMethod, sourceAmount],
  );
  const selectedRoute = React.useMemo(
    () =>
      routes.find((route) => route.provider === selectedProvider) ?? routes[0],
    [routes, selectedProvider],
  );
  const availablePaymentMethods = React.useMemo(() => {
    const map = new Map<string, OnrampPaymentMethod>();
    const sourceRoutes = selectedRoute ? [selectedRoute] : routes;
    for (const route of sourceRoutes) {
      for (const method of route.paymentMethods ?? []) {
        if (!method.method || map.has(method.method)) continue;
        map.set(method.method, method);
      }
    }
    return Array.from(map.values());
  }, [routes, selectedRoute]);
  const selectedPaymentMethodDetails = availablePaymentMethods.find(
    (method) => method.method === selectedPaymentMethod,
  );
  const selectedQuote =
    quotes.find(
      (quote) =>
        quote.provider === selectedProvider &&
        (!selectedPaymentMethod ||
          quote.paymentMethodType === selectedPaymentMethod),
    ) ??
    quotes.find((quote) => quote.provider === selectedProvider) ??
    quotes.find((quote) => quote.paymentMethodType === selectedPaymentMethod) ??
    quotes[0];
  const filteredPaymentMethods = React.useMemo(
    () =>
      availablePaymentMethods.filter((method) =>
        matchesSearch(methodSearch, [
          method.method,
          getMethodLabel(method.method),
          getMethodSubtitle(method),
        ]),
      ),
    [availablePaymentMethods, methodSearch],
  );
  const providerOptions = React.useMemo<OnrampProviderOption[]>(() => {
    if (quotes.length > 0) {
      return quotes.map((quote) => {
        const route = routes.find(
          (candidate) => candidate.provider === quote.provider,
        );
        const paymentMethod = route?.paymentMethods?.find(
          (method) => method.method === quote.paymentMethodType,
        );
        return {
          destinationAmount: quote.destinationAmount,
          paymentMethod,
          paymentMethodType: quote.paymentMethodType,
          provider: quote.provider,
          quote,
          route,
        };
      });
    }
    return routes
      .filter((route) => route.provider)
      .map((route) => ({
        paymentMethod: route.paymentMethods?.[0],
        paymentMethodType: route.paymentMethods?.[0]?.method,
        provider: route.provider,
        route,
      }));
  }, [quotes, routes]);
  const filteredProviderOptions = React.useMemo(
    () =>
      providerOptions.filter((option) =>
        matchesSearch(partnerSearch, [
          option.provider,
          getProviderLabel(option.provider),
          option.paymentMethodType,
          getMethodLabel(option.paymentMethodType),
          getMethodSubtitle(option.paymentMethod),
        ]),
      ),
    [partnerSearch, providerOptions],
  );
  const hasMultipleCurrencies = fiatCurrencyOptions.length > 1;
  const hasMultipleDestinationTokens = availableDestinationTokens.length > 1;
  const hasMultipleMethods = availablePaymentMethods.length > 1;
  const hasMultipleProviders = providerOptions.length > 1;
  const parsedSourceAmount = React.useMemo(
    () => parseDecimal(sourceAmount),
    [sourceAmount],
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

  const executeOnrampDeposit = React.useCallback(
    async (force = false) => {
      const sessionId = session?.sessionId;
      if (!sessionId || !opportunity || !ownerAddress || !toToken) return;
      if (
        !force &&
        depositExecutionSessionRef.current === sessionId &&
        depositExecution.status !== "failed"
      ) {
        return;
      }

      depositExecutionSessionRef.current = sessionId;
      setDepositExecution({ status: "running" });
      setSession((current) =>
        current?.sessionId === sessionId
          ? { ...current, state: "COMPLETING_DEPOSIT" }
          : current,
      );

      const account = ownerAddress as Address;
      const decimals = opportunity.tokenDecimals ?? toToken.decimals ?? 18;
      const receivedAmount =
        session.transaction?.destinationAmount ??
        selectedQuote?.destinationAmount ??
        "";
      const isSandbox = getOnrampRuntimeEnvironment(baseUrl) !== "production";
      const sandboxAmountRaw = getSandboxDepositAmountRaw(decimals);
      let amountRaw = getRawTokenAmount(receivedAmount, decimals);

      try {
        if (!amountRaw || amountRaw <= BigInt(0)) {
          throw new Error("Unable to resolve the onramp received amount.");
        }

        if (isSandbox) {
          const balanceRaw = getOnrampTokenBalanceRaw(
            toToken,
            decimals,
            opportunity.chainId,
            opportunity.tokenAddress,
          );

          if (balanceRaw === null || balanceRaw <= sandboxAmountRaw) {
            const displayAmount = formatUnits(amountRaw, decimals);
            setDepositExecution({
              amount: displayAmount,
              skipped: true,
              status: "success",
            });
            setSession((current) =>
              current?.sessionId === sessionId
                ? {
                    ...current,
                    deposit: {
                      ...current.deposit,
                      state: "DEPOSIT_SUCCESS",
                    },
                    state: "DEPOSIT_SUCCESS",
                  }
                : current,
            );
            return;
          }

          amountRaw = sandboxAmountRaw;
        }

        if (!walletClient) {
          throw new Error("Wallet client is not available for deposit.");
        }

        const toChainId = toToken.chainId ?? opportunity.chainId;
        if (!toChainId) {
          throw new Error("Unable to resolve the deposit chain.");
        }

        if (walletClient.chain?.id !== toChainId) {
          await walletClient.switchChain({ id: toChainId });
        }

        const executeParams = opportunity.executeDeposit(
          opportunity.tokenSymbol,
          opportunity.tokenAddress,
          amountRaw,
          opportunity.chainId,
          account,
        );
        console.log("[NexusWidget Onramp] executeDeposit output", {
          executeParams,
          walletTransaction: {
            account,
            data: executeParams.data,
            gas: executeParams.gas,
            to: executeParams.to,
            value: executeParams.value,
          },
        });

        if (!isPositiveGasLimit(executeParams.gas)) {
          throw new Error(
            "Deposit config executeDeposit must return a positive gas limit.",
          );
        }

        if (executeParams.tokenApproval) {
          const approvalHash = await walletClient.writeContract({
            abi: erc20Abi,
            account,
            address: executeParams.tokenApproval.toTokenAddress,
            args: [
              executeParams.tokenApproval.spender,
              executeParams.tokenApproval.amount,
            ],
            chain: null,
            functionName: "approve",
          });
          await waitForWalletTransactionSuccess(walletClient, approvalHash);
        }

        const txHash = await walletClient.sendTransaction({
          account,
          chain: null,
          data: executeParams.data,
          gas: executeParams.gas,
          to: executeParams.to,
          value: executeParams.value,
        });
        await waitForWalletTransactionSuccess(walletClient, txHash);
        const displayAmount = formatUnits(amountRaw, decimals);
        const explorerUrl = getNexusChainTransactionExplorerUrl(
          nexusSDK,
          toChainId,
          txHash,
        );
        setDepositExecution({
          amount: displayAmount,
          explorerUrl,
          status: "success",
          txHash,
        });
        setSession((current) =>
          current?.sessionId === sessionId
            ? {
                ...current,
                deposit: {
                  ...current.deposit,
                  explorerUrl,
                  state: "DEPOSIT_SUCCESS",
                  txHash,
                },
                state: "DEPOSIT_SUCCESS",
              }
            : current,
        );
      } catch (depositError) {
        const message = getErrorMessage(depositError);
        setDepositExecution({ error: message, status: "failed" });
        setSession((current) =>
          current?.sessionId === sessionId
            ? {
                ...current,
                deposit: {
                  ...current.deposit,
                  state: "DEPOSIT_FAILED",
                },
                state: "DEPOSIT_FAILED",
              }
            : current,
        );
        onError?.(message);
      }
    },
    [
      baseUrl,
      depositExecution.status,
      onError,
      opportunity,
      ownerAddress,
      nexusSDK,
      selectedQuote,
      session,
      toToken,
      walletClient,
    ],
  );

  const applyOptions = React.useCallback(
    (data: OnrampOptionsResponse, fallbackCountryCode: string) => {
      setOptions(data);
      setCountryCode(
        data.selection?.countryCode?.toUpperCase() ?? fallbackCountryCode,
      );
      setSourceCurrencyCode((current) => {
        const currencies = getFiatCurrencyOptions(data);
        if (
          current &&
          currencies.some((currency) => currency.currencyCode === current)
        ) {
          return current;
        }
        return getDefaultFiatCurrencyCode(data);
      });
    },
    [],
  );

  const loadOptions = React.useCallback(async () => {
    setOptionsLoading(true);
    setError(null);
    try {
      const loadOptionsForCountry = async (countryCodeToLoad: string) => {
        const requestedCountryCode = countryCodeToLoad.toUpperCase();
        const cached = readCachedOnrampOptions(baseUrl, requestedCountryCode);
        if (cached) {
          return { data: cached, requestedCountryCode };
        }

        const data = await fetchOnrampJson<OnrampOptionsResponse>(
          baseUrl,
          `/api/v1/onramp/options?countryCode=${encodeURIComponent(
            requestedCountryCode,
          )}`,
          { method: "GET" },
        );
        writeCachedOnrampOptions(baseUrl, requestedCountryCode, data);

        const selectedCountryCode = data.selection?.countryCode?.toUpperCase();
        if (
          selectedCountryCode &&
          selectedCountryCode !== requestedCountryCode &&
          isCountryInOptionsList(data, selectedCountryCode)
        ) {
          writeCachedOnrampOptions(baseUrl, selectedCountryCode, data);
        }

        return { data, requestedCountryCode };
      };

      const resolvedCountryCode = await resolveOnrampCountryCode();
      let { data, requestedCountryCode } =
        await loadOptionsForCountry(resolvedCountryCode);

      if (!isCountryInOptionsList(data, requestedCountryCode)) {
        const fallbackCountryCode = getUnsupportedCountryFallbackCode(baseUrl);
        if (fallbackCountryCode !== requestedCountryCode) {
          const fallbackOptions =
            await loadOptionsForCountry(fallbackCountryCode);
          data = fallbackOptions.data;
          requestedCountryCode = fallbackOptions.requestedCountryCode;
        }
      }

      applyOptions(data, requestedCountryCode);
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      onError?.(message);
    } finally {
      setOptionsLoading(false);
    }
  }, [applyOptions, baseUrl, onError]);

  React.useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const getRequestErrorMessage = React.useCallback(
    (requestError: unknown) =>
      getOnrampRequestErrorMessage(requestError, {
        countryCode,
        sourceCurrencyCode,
        token: toToken,
      }),
    [countryCode, sourceCurrencyCode, toToken],
  );

  React.useEffect(() => {
    setBlockedRateRequest((current) =>
      current && current.key !== rateRequestKey ? null : current,
    );
  }, [rateRequestKey]);

  React.useEffect(() => {
    if (activeSheet !== "method") setMethodSearch("");
    if (activeSheet !== "partner") setPartnerSearch("");
  }, [activeSheet]);

  React.useEffect(() => {
    quotesLoadingRef.current = quotesLoading;
  }, [quotesLoading]);

  React.useEffect(() => {
    if (blockedRateRequest?.key === rateRequestKey) {
      quoteRunIdRef.current += 1;
      lastRouteRequestKeyRef.current = rateRequestKey;
      lastQuoteRequestKeyRef.current = "";
      setRoutes([]);
      setSelectedPaymentMethod("");
      setQuotes([]);
      setSelectedProvider("");
      setError(blockedRateRequest.message);
      setRoutesLoading(false);
      setQuotesLoading(false);
      return;
    }
    if (isDestinationTokenUnsupported) {
      quoteRunIdRef.current += 1;
      lastRouteRequestKeyRef.current = "";
      lastQuoteRequestKeyRef.current = "";
      setRoutes([]);
      setSelectedPaymentMethod("");
      setQuotes([]);
      setSelectedProvider("");
      setError(null);
      setRoutesLoading(false);
      setQuotesLoading(false);
      return;
    }
    if (
      !countryCode ||
      !sourceCurrencyCode ||
      !destinationRequestDetails.destinationCurrencyCode
    ) {
      lastRouteRequestKeyRef.current = "";
      lastQuoteRequestKeyRef.current = "";
      setRoutes([]);
      setSelectedPaymentMethod("");
      setQuotes([]);
      setSelectedProvider("");
      setRoutesLoading(false);
      setQuotesLoading(false);
      return;
    }
    if (lastRouteRequestKeyRef.current === rateRequestKey) return;
    const routeRunId = routeRunIdRef.current + 1;
    routeRunIdRef.current = routeRunId;
    quoteRunIdRef.current += 1;
    lastQuoteRequestKeyRef.current = "";
    setRoutes([]);
    setSelectedPaymentMethod("");
    setQuotes([]);
    setSelectedProvider("");
    let cancelled = false;

    const loadRoutes = async () => {
      setRoutesLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          countryCode,
          destinationCurrencyCode:
            destinationRequestDetails.destinationCurrencyCode,
          sourceCurrencyCode,
        });
        if (destinationRequestDetails.destinationChainId) {
          params.set(
            "destinationChainId",
            destinationRequestDetails.destinationChainId,
          );
        }
        if (destinationRequestDetails.destinationToken) {
          params.set(
            "destinationToken",
            destinationRequestDetails.destinationToken,
          );
        }
        const data = await fetchOnrampJson<OnrampRoutesResponse>(
          baseUrl,
          `/api/v1/onramp/routes?${params.toString()}`,
          { method: "GET" },
        );
        if (cancelled || routeRunIdRef.current !== routeRunId) return;
        const nextRoutes = data.routes ?? [];
        setRoutes(nextRoutes);
        const firstRoute = nextRoutes[0];
        setSelectedProvider(firstRoute?.provider ?? "");
        setSelectedPaymentMethod(firstRoute?.paymentMethods?.[0]?.method ?? "");
        lastRouteRequestKeyRef.current = rateRequestKey;
      } catch (requestError) {
        if (cancelled || routeRunIdRef.current !== routeRunId) return;
        const message = getRequestErrorMessage(requestError);
        quoteRunIdRef.current += 1;
        if (isTerminalOnrampRateError(requestError)) {
          setBlockedRateRequest({ key: rateRequestKey, message });
        }
        setRoutes([]);
        setSelectedPaymentMethod("");
        setQuotes([]);
        setSelectedProvider("");
        setError(message);
        onError?.(message);
      } finally {
        if (!cancelled && routeRunIdRef.current === routeRunId) {
          setRoutesLoading(false);
        }
      }
    };

    void loadRoutes();
    return () => {
      cancelled = true;
    };
  }, [
    baseUrl,
    blockedRateRequest?.key,
    blockedRateRequest?.message,
    countryCode,
    destinationRequestDetails.destinationChainId,
    destinationRequestDetails.destinationCurrencyCode,
    destinationRequestDetails.destinationToken,
    getRequestErrorMessage,
    isDestinationTokenUnsupported,
    onError,
    rateRequestKey,
    sourceCurrencyCode,
  ]);

  const fetchQuotes = React.useCallback(async () => {
    if (
      !countryCode ||
      !ownerAddress ||
      !sourceCurrencyCode ||
      !destinationRequestDetails.destinationCurrencyCode ||
      !selectedPaymentMethod ||
      !parsedSourceAmount?.gt(0) ||
      amountLimitMessage ||
      isDestinationTokenUnsupported
    ) {
      return;
    }
    if (blockedRateRequest?.key === rateRequestKey) {
      setError(blockedRateRequest.message);
      setQuotesLoading(false);
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
            destination: {
              chainId: destinationRequestDetails.destinationChainId,
              currencyCode: destinationRequestDetails.destinationCurrencyCode,
              token: destinationRequestDetails.destinationToken,
            },
            destinationChainId: destinationRequestDetails.destinationChainId,
            destinationCurrencyCode:
              destinationRequestDetails.destinationCurrencyCode,
            destinationToken: destinationRequestDetails.destinationToken,
            paymentMethodType: selectedPaymentMethod,
            sourceAmount,
            sourceCurrencyCode,
            walletAddress: ownerAddress,
          }),
          method: "POST",
        },
      );
      if (quoteRunIdRef.current !== runId) return;
      const nextQuotes = sortQuotes(data.quotes ?? []);
      setQuotes(nextQuotes);
      setSelectedProvider((current) =>
        current && nextQuotes.some((quote) => quote.provider === current)
          ? current
          : (nextQuotes[0]?.provider ?? ""),
      );
      if (nextQuotes.length === 0) {
        setError(
          "No local currency rates are available for this token and currency. Choose another deposit token or pay with wallet.",
        );
      }
    } catch (requestError) {
      if (quoteRunIdRef.current !== runId) return;
      const message = getRequestErrorMessage(requestError);
      if (isTerminalOnrampRateError(requestError)) {
        setBlockedRateRequest({ key: rateRequestKey, message });
      }
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
    destinationRequestDetails.destinationChainId,
    destinationRequestDetails.destinationCurrencyCode,
    destinationRequestDetails.destinationToken,
    getRequestErrorMessage,
    blockedRateRequest,
    isDestinationTokenUnsupported,
    onError,
    ownerAddress,
    parsedSourceAmount,
    rateRequestKey,
    selectedPaymentMethod,
    sourceAmount,
    sourceCurrencyCode,
  ]);

  React.useEffect(() => {
    setSessionCallbackReceived(false);
    setSession(null);
  }, [
    destinationRequestDetails.destinationChainId,
    destinationRequestDetails.destinationCurrencyCode,
    destinationRequestDetails.destinationToken,
  ]);

  React.useEffect(() => {
    if (session?.sessionId) return;
    if (
      !ownerAddress ||
      !sourceCurrencyCode ||
      !destinationRequestDetails.destinationCurrencyCode ||
      !selectedPaymentMethod ||
      !parsedSourceAmount?.gt(0) ||
      amountLimitMessage ||
      isDestinationTokenUnsupported
    ) {
      lastQuoteRequestKeyRef.current = "";
      setQuotes([]);
      return;
    }
    if (lastQuoteRequestKeyRef.current === quoteRequestKey) return;
    setQuotes([]);
    const timer = window.setTimeout(() => {
      lastQuoteRequestKeyRef.current = quoteRequestKey;
      void fetchQuotes();
    }, 350);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    amountLimitMessage,
    destinationRequestDetails.destinationChainId,
    destinationRequestDetails.destinationCurrencyCode,
    destinationRequestDetails.destinationToken,
    fetchQuotes,
    isDestinationTokenUnsupported,
    ownerAddress,
    parsedSourceAmount,
    quoteRequestKey,
    selectedPaymentMethod,
    session?.sessionId,
    sourceCurrencyCode,
  ]);

  React.useEffect(() => {
    if (session?.sessionId || !selectedQuote || sessionLoading) {
      return;
    }
    setQuoteRefreshSeconds(QUOTE_REFRESH_SECONDS);
    const interval = window.setInterval(() => {
      setQuoteRefreshSeconds((current) => {
        if (current <= 1) {
          if (!quotesLoadingRef.current) void fetchQuotes();
          return QUOTE_REFRESH_SECONDS;
        }
        return current - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [fetchQuotes, selectedQuote, session?.sessionId, sessionLoading]);

  React.useEffect(() => {
    const derivedSessionState =
      depositExecution.status === "running"
        ? "COMPLETING_DEPOSIT"
        : depositExecution.status === "success"
          ? "DEPOSIT_SUCCESS"
          : depositExecution.status === "failed"
            ? "DEPOSIT_FAILED"
            : sessionCallbackReceived
              ? "ONRAMP_CALLBACK_RECEIVED"
              : normalizedSessionState || "AWAITING_USER";
    onSessionStateChange?.(session?.sessionId ? derivedSessionState : null);
  }, [
    depositExecution.status,
    normalizedSessionState,
    onSessionStateChange,
    sessionCallbackReceived,
    session?.sessionId,
  ]);

  React.useEffect(
    () => () => {
      onSessionStateChange?.(null);
    },
    [onSessionStateChange],
  );

  const applyOnrampCallback = React.useCallback((payload: unknown) => {
    if (payload === ONRAMP_CALLBACK_SUCCESS_MESSAGE) {
      setSessionCallbackReceived(true);
      setError(null);
      return;
    }
    if (!isOnrampCallbackPayload(payload)) return;
    setSessionCallbackReceived(true);
    setSession((current) => {
      if (current?.sessionId && current.sessionId !== payload.sessionId) {
        return current;
      }
      return {
        ...current,
        ...payload.session,
        sessionId: payload.sessionId,
        state:
          payload.session?.state ??
          (payload.state || undefined) ??
          current?.state,
      };
    });
    setError(null);
  }, []);

  const applyManualOnrampSessionId = React.useCallback((sessionId: string) => {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) return;
    setSessionCallbackReceived(true);
    setSession({
      sessionId: normalizedSessionId,
      state: "AWAITING_USER",
    });
    setError(null);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data === ONRAMP_CALLBACK_SUCCESS_MESSAGE) {
        try {
          (event.source as Window | null)?.postMessage(
            ONRAMP_CALLBACK_SUCCESS_ACK_MESSAGE,
            "*",
          );
        } catch {
          // The callback page will close itself if the ack cannot be sent.
        }
      }
      applyOnrampCallback(event.data);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ONRAMP_CALLBACK_STORAGE_KEY || !event.newValue) return;
      try {
        applyOnrampCallback(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed callback payloads from storage.
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);
    window.setRampSessionId = applyManualOnrampSessionId;

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(ONRAMP_CALLBACK_CHANNEL);
      channel.onmessage = (event) => applyOnrampCallback(event.data);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      if (window.setRampSessionId === applyManualOnrampSessionId) {
        delete window.setRampSessionId;
      }
      channel?.close();
    };
  }, [applyManualOnrampSessionId, applyOnrampCallback]);

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
          { method: "GET" },
        );
        if (cancelled) return;
        setSession((current) =>
          current?.sessionId === sessionId ? { ...current, ...data } : current,
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
  }, [baseUrl, normalizedSessionState, onError, session?.sessionId]);

  React.useEffect(() => {
    if (!session?.sessionId) {
      depositExecutionSessionRef.current = "";
      setDepositExecution({ status: "idle" });
      return;
    }
    if (
      depositExecutionSessionRef.current &&
      depositExecutionSessionRef.current !== session.sessionId
    ) {
      depositExecutionSessionRef.current = "";
      setDepositExecution({ status: "idle" });
    }
  }, [session?.sessionId]);

  React.useEffect(() => {
    if (
      !session?.sessionId ||
      normalizedSessionState !== "SETTLED" ||
      depositExecution.status !== "idle"
    ) {
      return;
    }
    void executeOnrampDeposit();
  }, [
    depositExecution.status,
    executeOnrampDeposit,
    normalizedSessionState,
    session?.sessionId,
  ]);

  const createSession = async () => {
    if (
      !selectedQuote ||
      !ownerAddress ||
      !selectedPaymentMethod ||
      isDestinationTokenUnsupported
    ) {
      return;
    }
    setSessionLoading(true);
    setError(null);
    setSessionCallbackReceived(false);
    depositExecutionSessionRef.current = "";
    setDepositExecution({ status: "idle" });
    const providerWindow = openOnrampProviderWindow();
    if (!providerWindow) {
      setSessionLoading(false);
      setError(
        "Payment provider popup was blocked. Allow popups and try again.",
      );
      return;
    }
    try {
      const data = await fetchOnrampJson<OnrampSessionResponse>(
        baseUrl,
        "/api/v1/onramp/sessions",
        {
          body: JSON.stringify({
            countryCode,
            destination: {
              chainId: destinationRequestDetails.destinationChainId,
              currencyCode:
                selectedQuote.destinationCurrencyCode ??
                destinationRequestDetails.destinationCurrencyCode,
              token: destinationRequestDetails.destinationToken,
            },
            destinationChainId: destinationRequestDetails.destinationChainId,
            destinationCurrencyCode:
              selectedQuote.destinationCurrencyCode ??
              destinationRequestDetails.destinationCurrencyCode,
            destinationToken: destinationRequestDetails.destinationToken,
            paymentMethodType: selectedPaymentMethod,
            provider: selectedQuote.provider,
            returnUrl: getOnrampReturnUrl(),
            sourceAmount: selectedQuote.sourceAmount,
            sourceCurrencyCode: selectedQuote.sourceCurrencyCode,
            walletAddress: ownerAddress,
          }),
          headers: {
            "Idempotency-Key": createIdempotencyKey(),
          },
          method: "POST",
        },
      );
      setSession(data);
      const widgetUrl = data.widgetUrl ?? data.fallbackWidgetUrl;
      if (widgetUrl) {
        providerWindow.location.href = widgetUrl;
      } else {
        providerWindow.close();
        setError("Payment provider URL was not returned. Try again.");
      }
    } catch (requestError) {
      providerWindow?.close();
      const message = getRequestErrorMessage(requestError);
      setError(message);
      onError?.(message);
    } finally {
      setSessionLoading(false);
    }
  };

  const resetSession = () => {
    setError(null);
    setSessionCallbackReceived(false);
    depositExecutionSessionRef.current = "";
    setDepositExecution({ status: "idle" });
    setSession(null);
  };

  const completeSession = () => {
    setError(null);
    setSessionCallbackReceived(false);
    depositExecutionSessionRef.current = "";
    setDepositExecution({ status: "idle" });
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
      setSessionCallbackReceived(false);
      setSession(null);
    }
    setActiveSheet(null);
  };

  const handleProviderSelect = (option: OnrampProviderOption) => {
    setSelectedProvider(option.provider);
    if (option.paymentMethodType) {
      setSelectedPaymentMethod(option.paymentMethodType);
    }
    if (!option.quote) {
      setQuotes([]);
    }
    setActiveSheet(null);
  };

  const handleMethodSelect = (method: string) => {
    const nextRoute =
      routes.find(
        (route) =>
          route.provider === selectedProvider &&
          route.paymentMethods?.some(
            (candidate) => candidate.method === method,
          ),
      ) ??
      routes.find((route) =>
        route.paymentMethods?.some((candidate) => candidate.method === method),
      );
    setSelectedPaymentMethod(method);
    setSelectedProvider(nextRoute?.provider ?? selectedProvider);
    setQuotes([]);
    setActiveSheet(null);
  };

  const receiveAmount = selectedQuote?.destinationAmount;
  const receiveUsd = selectedQuote?.destinationAmount;
  const feeTotal = selectedQuote?.fees?.total;
  const displayProvider = selectedQuote?.provider ?? selectedProvider;
  const providerSubtitle = selectedQuote ? "Best available quote" : "";
  const hasRouteDetails = Boolean(
    selectedPaymentMethodDetails || selectedPaymentMethod || displayProvider,
  );
  const rateRequestLoading = routesLoading || quotesLoading;
  const fetchingBestRates =
    hasPositiveSourceAmount &&
    !selectedQuote &&
    !amountLimitMessage &&
    !error &&
    !destinationTokenUnsupportedMessage &&
    Boolean(destinationRequestDetails.destinationCurrencyCode) &&
    (rateRequestLoading || Boolean(selectedPaymentMethod));
  const ctaRateLoading =
    !error &&
    !destinationTokenUnsupportedMessage &&
    !selectedQuote &&
    (fetchingBestRates || (hasPositiveSourceAmount && rateRequestLoading));
  const quoteDetailsLoading =
    fetchingBestRates || (routesLoading && !hasRouteDetails);
  const shouldShowQuoteDetails =
    !destinationTokenUnsupportedMessage &&
    (quoteDetailsLoading || hasRouteDetails || Boolean(selectedQuote));
  const shouldShowQuoteTimer = Boolean(selectedQuote);
  const ctaDisabled =
    !ownerAddress ||
    !hasPositiveSourceAmount ||
    !selectedQuote ||
    Boolean(destinationTokenUnsupportedMessage) ||
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
        depositExecution={depositExecution}
        onCancel={resetSession}
        onDone={completeSession}
        onRetryDeposit={() => void executeOnrampDeposit(true)}
        onRetryPayment={() => void createSession()}
        opportunity={opportunity}
        primaryButtonForeground={primaryButtonForeground}
        quote={selectedQuote}
        session={session}
        sessionCallbackReceived={sessionCallbackReceived}
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
            className={
              quotesLoading || routesLoading ? "animate-spin" : undefined
            }
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
                aria-invalid={Boolean(amountLimitMessage)}
                disabled={Boolean(destinationTokenUnsupportedMessage)}
                inputMode="decimal"
                max={selectedPaymentMethodDetails?.limits?.max}
                min={selectedPaymentMethodDetails?.limits?.min}
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
                  cursor: destinationTokenUnsupportedMessage
                    ? "not-allowed"
                    : undefined,
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
                {hasPositiveSourceAmount
                  ? formatCurrencyAmount(
                      selectedQuote?.sourceAmount ?? sourceAmount,
                      selectedQuote?.sourceCurrencyCode ?? sourceCurrencyCode,
                    )
                  : "Select currency"}
              </div>
            </div>
            <SelectPill
              disabled={!hasMultipleCurrencies}
              onClick={() => setActiveSheet("currency")}
            >
              <CurrencyMark
                code={sourceCurrencyCode}
                currency={selectedFiatCurrency}
              />
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
                fontSize: "12px",
                gap: "6px",
                lineHeight: "15px",
                padding: "7px 10px",
              }}
            >
              <Info aria-hidden="true" size={13} strokeWidth={1.8} />
              <span>
                Limits
                {selectedPaymentMethodDetails.limits.min
                  ? ` · Min ${formatCurrencyAmount(
                      selectedPaymentMethodDetails.limits.min,
                      sourceCurrencyCode,
                    )}`
                  : ""}
                {selectedPaymentMethodDetails.limits.max
                  ? ` · Max ${formatCurrencyAmount(
                      selectedPaymentMethodDetails.limits.max,
                      sourceCurrencyCode,
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
          <QuoteDetailsSkeleton showFees={hasPositiveSourceAmount} />
        ) : hasRouteDetails ? (
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
              <div
                style={{ alignItems: "center", display: "flex", gap: "10px" }}
              >
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
              <div
                style={{ alignItems: "center", display: "flex", gap: "10px" }}
              >
                <ProviderMark provider={displayProvider} />
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
                    {getProviderLabel(displayProvider)}
                  </div>
                  {providerSubtitle && (
                    <div
                      style={{
                        color: theme.colors.textSubtle,
                        fontFamily: theme.fonts.sans,
                        fontSize: "13px",
                        lineHeight: "17px",
                      }}
                    >
                      {providerSubtitle}
                    </div>
                  )}
                </div>
              </div>
            </DetailRow>

            {selectedQuote && (
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
            )}
          </div>
        ) : null)}

      {(destinationTokenUnsupportedMessage ||
        error ||
        amountLimitMessage ||
        session?.state) && (
        <div
          style={{
            backgroundColor:
              destinationTokenUnsupportedMessage || error || amountLimitMessage
                ? "#FCEEED"
                : "#E8F5E9",
            borderRadius: "8px",
            color:
              destinationTokenUnsupportedMessage || error || amountLimitMessage
                ? "#D32F2F"
                : "#2E7D32",
            fontFamily: theme.fonts.sans,
            fontSize: "13px",
            lineHeight: "18px",
            padding: "10px 12px",
          }}
        >
          {destinationTokenUnsupportedMessage ??
            error ??
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
            ? "Fetching best rates..."
            : destinationTokenUnsupportedMessage
              ? "Token not supported"
              : selectedQuote
                ? `Pay ${formatCurrencyAmount(sourceAmount, sourceCurrencyCode)}`
                : "Enter amount"}
      </button>

      {activeSheet === "fees" && (
        <Sheet
          onClose={() => setActiveSheet(null)}
          title={`Buying ${formatNumberDisplay(receiveAmount, 6)} ${toToken?.symbol ?? ""}`}
        >
          <div
            style={{
              color: theme.colors.textSubtle,
              fontFamily: theme.fonts.sans,
              fontSize: "13px",
              lineHeight: "17px",
            }}
          >
            1 {toToken?.symbol ?? "token"} ≈{" "}
            {selectedQuote &&
            parseDecimal(selectedQuote.destinationAmount)?.gt(0)
              ? formatCurrencyAmount(
                  parseDecimal(selectedQuote.sourceAmount)?.div(
                    parseDecimal(selectedQuote.destinationAmount) ??
                      new Decimal(1),
                  ),
                  sourceCurrencyCode,
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
                  {value
                    ? formatCurrencyAmount(value, sourceCurrencyCode)
                    : "--"}
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
          {filteredProviderOptions.length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {filteredProviderOptions.map((option) => {
                const optionIndex = providerOptions.findIndex(
                  (candidate) =>
                    candidate.provider === option.provider &&
                    candidate.paymentMethodType === option.paymentMethodType,
                );
                const methodSubtitle = getMethodSubtitle(option.paymentMethod);
                const optionSubtitle = option.paymentMethodType
                  ? [getMethodLabel(option.paymentMethodType), methodSubtitle]
                      .filter(Boolean)
                      .join(" · ")
                  : "Available route";
                return (
                  <SelectRow
                    icon={<ProviderMark provider={option.provider} />}
                    key={`${option.provider}-${option.paymentMethodType ?? "route"}`}
                    onClick={() => handleProviderSelect(option)}
                    primary={optionIndex === 0}
                    selected={option.provider === displayProvider}
                    subtitle={optionSubtitle}
                    title={getProviderLabel(option.provider)}
                    value={
                      option.destinationAmount
                        ? `${formatNumberDisplay(option.destinationAmount, 6)} ${toToken?.symbol ?? ""}`
                        : undefined
                    }
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
          <div style={sectionLabelStyle}>Fiat currencies</div>
          {fiatCurrencyOptions.length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {fiatCurrencyOptions.map((currency) => (
                <SelectRow
                  icon={<CurrencyMark currency={currency} />}
                  key={currency.currencyCode}
                  onClick={() => handleCurrencySelect(currency.currencyCode)}
                  selected={currency.currencyCode === sourceCurrencyCode}
                  subtitle={getFiatCurrencyName(
                    currency.currencyCode,
                    currency,
                  )}
                  title={currency.currencyCode}
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
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {filteredPaymentMethods.map((method) => (
                <SelectRow
                  icon={<MethodMark method={method.method} />}
                  key={method.method}
                  onClick={() => handleMethodSelect(method.method)}
                  selected={method.method === selectedPaymentMethod}
                  subtitle={getMethodSubtitle(method)}
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
          {availableDestinationTokens.length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {availableDestinationTokens.map((token) => (
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
