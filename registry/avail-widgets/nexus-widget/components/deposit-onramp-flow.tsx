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
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";
import { NEXUS_WIDGET_FAST_SPINNER_STYLE, nexusWidgetTheme } from "../theme";
import type { NexusWidgetDepositOpportunityConfig } from "../types";
import type { SwapTokenOption } from "./swap-asset-selector";
import {
  useOnrampWallet,
  type GetOnrampWalletProvider,
} from "../utils/use-onramp-wallet";
import { CHAIN_METADATA } from "../../common";
import {
  getOnrampRemainingAmount,
  onrampDelay,
  waitForOnrampReceipt,
  getNormalizedOnrampState,
  isOnrampTerminalState,
  logOnramp,
  getOnrampBaseUrl,
  ONRAMP_CLIENT_HEADER,
  mergeOnrampSession,
  normalizeOnrampSession,
  startOnrampPolling,
  type OnrampSessionResponse,
} from "../utils/onramp-session";
import type { OnrampHistoryUpdate } from "../utils/onramp-history";

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

type OnrampProviderLogo = {
  dark?: string;
  darkShort?: string;
  light?: string;
  lightShort?: string;
};

type OnrampProviderMetadata = {
  logo?: OnrampProviderLogo;
  name: string;
  provider: string;
};

type OnrampCountry = {
  countryCode: string;
  flagUrl?: string;
  name: string;
  subdivisions?: unknown[];
};

type OnrampFiatMetadata = {
  currencyCode: string;
  decimals?: number;
  flagUrl?: string;
  name?: string;
  symbolUrl?: string;
};

type OnrampFiatCurrency =
  | string
  | {
      code?: string;
      currencyCode?: string;
      decimals?: number;
      flagUrl?: string;
      name?: string;
      symbol?: string;
      symbolUrl?: string;
    };

type OnrampFiatCurrencyOption = {
  currencyCode: string;
  decimals?: number;
  flagUrl?: string;
  name?: string;
  symbol?: string;
  symbolUrl?: string;
};

type OnrampPaymentMethodLogo =
  | {
      dark?: string;
      light?: string;
    }
  | string;

type OnrampOptionsResponse = {
  countries?: OnrampCountry[];
  fiatCurrencyMetadata?: OnrampFiatMetadata[];
  paymentMethodMetadata?: OnrampPaymentMethod[];
  paymentMethods?: OnrampPaymentMethod[];
  providers?: OnrampProviderMetadata[];
  selection?: {
    countryCode: string;
    cryptoCurrencies?: OnrampCryptoCurrency[];
    defaultFiat?: string;
    defaultPaymentMethods?: string[];
    fiatCurrencies?: OnrampFiatCurrency[];
    fiatCurrencyMetadata?: OnrampFiatMetadata[];
    paymentMethods?: OnrampPaymentMethod[];
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
  headlessSupported?: boolean;
  limits?: {
    currencyCode?: string;
    max?: string;
    min?: string;
  };
  logo?: OnrampPaymentMethodLogo;
  method: string;
  name?: string;
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
  status: "idle" | "running" | "success" | "failed";
  step?: "swapping_gas" | "depositing";
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
          nativeCurrency?: {
            decimals?: number;
            name?: string;
            symbol?: string;
          };
          rpcUrls?: {
            default?: {
              http?: string[];
            };
          };
        }
      | null
      | undefined;
  };
  swapWithExactOut?: (input: any, options?: any) => Promise<any>;
  [key: string]: any;
};

export type OnrampGasShortfallInfo = {
  estimatedGasUnits: bigint;
  gasPriceWei: bigint;
  hasApproval: boolean;
  isErc20: boolean;
  isShortfall: boolean;
  requiredGasEth: string;
  requiredGasWei: bigint;
  shortfallAmountEth: string;
  shortfallAmountRaw: bigint;
  userGasBalanceEth: string;
  userGasBalanceWei: bigint;
};

type OnrampSheet =
  | "country"
  | "currency"
  | "destination"
  | "fees"
  | "method"
  | "partner"
  | null;

interface DepositOnrampFlowProps {
  baseUrl?: string;
  getWalletProvider: GetOnrampWalletProvider;
  walletConnected: boolean;
  destinationTokens?: SwapTokenOption[];
  onConnectWallet: () => void | Promise<void>;
  onError?: (message: string) => void;
  onSelectDestinationToken?: (token: SwapTokenOption) => void;
  onSessionStateChange?: (state: string | null) => void;
  onSessionUpdate?: (update: OnrampHistoryUpdate) => void;
  nexusSDK?: OnrampNexusSDK | null;
  ownerAddress?: string;
  opportunity?: NexusWidgetDepositOpportunityConfig;
  primaryButtonForeground: string;
  toToken?: SwapTokenOption;
  walletClient?: WalletClient | null;
}

const ONRAMP_RETURN_PATH = "/onramp/complete";
const ONRAMP_IP_COUNTRY_URL = "https://api.country.is/";
const ONRAMP_IP_API_URL = "http://ip-api.com/json";
const ONRAMP_IPAPI_CO_URL = "https://ipapi.co/json/";
const ONRAMP_CLOUDFLARE_META_URL = "https://speed.cloudflare.com/meta";
const ONRAMP_DISCONNECTED_QUOTE_WALLET_ADDRESS =
  "0xd733d48f2a7f57d4559f98ae07f87dab595e3523" as Address;
const ONRAMP_OPTIONS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ONRAMP_COUNTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ONRAMP_USER_COUNTRY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ONRAMP_COUNTRY_CACHE_KEY = "nexus-widgets:onramp:country:v1";
const ONRAMP_USER_COUNTRY_CACHE_KEY = "nexus-widgets:onramp:user-country:v1";
const ONRAMP_OPTIONS_CACHE_KEY_PREFIX = "nexus-widgets:onramp:options:v1";
const ONRAMP_SANDBOX_FALLBACK_COUNTRY = "FR";
const ONRAMP_PRODUCTION_FALLBACK_COUNTRY = "US";
const QUOTE_REFRESH_SECONDS = 60;
const QUOTE_REFRESH_MS = QUOTE_REFRESH_SECONDS * 1000;
const ONRAMP_SESSION_POLL_MS = 3000;
const ONRAMP_CALLBACK_MESSAGE_TYPE = "nexus-widgets:onramp:session";
const ONRAMP_CALLBACK_SUCCESS_MESSAGE = "nexus-onramp-success";
const ONRAMP_CALLBACK_SUCCESS_ACK_MESSAGE = "nexus-onramp-success-received";
const ONRAMP_CALLBACK_CHANNEL = "nexus-widgets:onramp";
const ONRAMP_CALLBACK_STORAGE_KEY = "nexus-widgets:onramp:session";
const ONRAMP_PROGRESS_ARTWORK_URL =
  "https://files.availproject.org/nexus-elements/nexus-one/progress-grid.gif";
const ONRAMP_SHEET_EDGE_OFFSET = "-16px";
const ONRAMP_GENERIC_QUOTE_ERROR_MESSAGE =
  "We are facing some issues at the moment, try again later";
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
  flexShrink: 0,
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

function OnrampQuoteCountdownIcon({ progress }: { progress: number }) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <svg
      fill="none"
      height="16"
      style={{
        transform: "rotate(-90deg)",
      }}
      viewBox="0 0 18 18"
      width="16"
    >
      <circle cx="9" cy="9" r={radius} stroke="#E8E8E7" strokeWidth="2" />
      <circle
        cx="9"
        cy="9"
        r={radius}
        stroke="var(--foreground-brand)"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clampedProgress)}
        strokeLinecap="round"
        strokeWidth="2"
        style={{ transition: "stroke-dashoffset 0.25s linear" }}
      />
    </svg>
  );
}

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
  const fixed = parsed
    .toDecimalPlaces(maxDecimals, Decimal.ROUND_DOWN)
    .toFixed();
  const [intPart, decPart] = fixed.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
};

const formatPlainNumberDisplay = (value: unknown, maxDecimals = 6) => {
  const parsed = parseDecimal(value);
  if (!parsed || parsed.isZero()) return "0";
  return parsed.toDecimalPlaces(maxDecimals, Decimal.ROUND_DOWN).toFixed();
};

const ONRAMP_FOREX_RATES_CACHE_KEY = "nexus_onramp_forex_rates_usd";
const ONRAMP_FOREX_RATES_TTL_MS = 60 * 60 * 1000; // 1 hour

const fetchOnrampForexRates = async (
  signal?: AbortSignal,
): Promise<Record<string, number>> => {
  const cached = readOnrampCache<Record<string, number>>(
    ONRAMP_FOREX_RATES_CACHE_KEY,
  );
  if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
    return cached;
  }
  try {
    logOnramp("forex.request");
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.rates && typeof data.rates === "object") {
        const rates = data.rates as Record<string, number>;
        writeOnrampCache(
          ONRAMP_FOREX_RATES_CACHE_KEY,
          rates,
          ONRAMP_FOREX_RATES_TTL_MS,
        );
        return rates;
      }
    }
  } catch (e) {
    logOnramp("Failed to fetch onramp forex rates", e);
  }
  return {};
};

const FIAT_EXCLUSIVE_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  EUR: "€",
  GBP: "£",
  ILS: "₪",
  INR: "₹",
  JPY: "¥",
  KPW: "₩",
  KRW: "₩",
  NGN: "₦",
  PHP: "₱",
  RUB: "₽",
  THB: "฿",
  TRY: "₺",
  USD: "$",
  VND: "₫",
};

const formatCurrencyAmount = (
  value: unknown,
  currencyCode?: string,
  maxDecimals = 2,
) => {
  const code = (currencyCode ?? "").toUpperCase();
  const symbol = code ? FIAT_EXCLUSIVE_SYMBOLS[code] : undefined;
  const formatted = formatNumberDisplay(value, maxDecimals);
  if (symbol) {
    return `${symbol}${formatted}`;
  }
  return code ? `${formatted} ${code}` : formatted;
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
  const normalized = currencyCode.toUpperCase();
  if (FIAT_EXCLUSIVE_SYMBOLS[normalized]) {
    return FIAT_EXCLUSIVE_SYMBOLS[normalized];
  }
  try {
    return new Intl.NumberFormat("en", {
      currency: normalized,
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
  return getCountryByCode(countries, normalizedCountryCode)?.flagUrl;
};

const onrampProviderMetadataCache = new Map<string, OnrampProviderMetadata>();

const cacheOnrampProviders = (providers?: OnrampProviderMetadata[]) => {
  if (!providers?.length) return;
  for (const provider of providers) {
    if (!provider?.provider) continue;
    onrampProviderMetadataCache.set(provider.provider.toUpperCase(), provider);
  }
};

const getProviderMetadata = (provider?: string) => {
  if (!provider) return undefined;
  return onrampProviderMetadataCache.get(provider.toUpperCase());
};

const onrampFiatMetadataCache = new Map<string, OnrampFiatMetadata>();

const cacheOnrampFiatMetadata = (metadata?: OnrampFiatMetadata[]) => {
  if (!metadata?.length) return;
  for (const item of metadata) {
    if (!item?.currencyCode) continue;
    onrampFiatMetadataCache.set(item.currencyCode.toUpperCase(), item);
  }
};

const getFiatMetadata = (currencyCode?: string) => {
  if (!currencyCode) return undefined;
  return onrampFiatMetadataCache.get(currencyCode.toUpperCase());
};

const getCurrencyLogoUrl = (
  currencyCode?: string,
  currency?: OnrampFiatCurrencyOption,
) => {
  if (currency?.symbolUrl || currency?.flagUrl) {
    return currency.symbolUrl ?? currency.flagUrl;
  }
  if (!currencyCode) return undefined;
  const meta = getFiatMetadata(currencyCode);
  return meta?.symbolUrl ?? meta?.flagUrl;
};

const onrampPaymentMethodMetadataCache = new Map<string, OnrampPaymentMethod>();

const cacheOnrampPaymentMethods = (methods?: OnrampPaymentMethod[]) => {
  if (!methods?.length) return;
  for (const method of methods) {
    if (!method?.method) continue;
    const key = method.method.toUpperCase();
    const existing = onrampPaymentMethodMetadataCache.get(key);
    onrampPaymentMethodMetadataCache.set(key, {
      ...existing,
      ...method,
    });
  }
};

const getPaymentMethodMetadata = (method?: string) => {
  if (!method) return undefined;
  return onrampPaymentMethodMetadataCache.get(method.toUpperCase());
};

const getPaymentMethodLogoUrl = (
  method?: string,
  logo?: OnrampPaymentMethodLogo,
  isDark?: boolean,
) => {
  const resolvedLogo = logo ?? getPaymentMethodMetadata(method)?.logo;
  if (!resolvedLogo) return undefined;
  if (typeof resolvedLogo === "string") return resolvedLogo;
  if (isDark) {
    return resolvedLogo.dark || resolvedLogo.light;
  }
  return resolvedLogo.light || resolvedLogo.dark;
};

const getFiatCurrencyOptions = (
  options: OnrampOptionsResponse | null,
): OnrampFiatCurrencyOption[] => {
  const selection = options?.selection;
  const fiatMetadataList =
    selection?.fiatCurrencyMetadata ?? options?.fiatCurrencyMetadata;
  cacheOnrampFiatMetadata(fiatMetadataList);
  if (options?.providers) {
    cacheOnrampProviders(options.providers);
  }
  const paymentMethodList =
    selection?.paymentMethods ??
    options?.paymentMethods ??
    options?.paymentMethodMetadata;
  if (paymentMethodList) {
    cacheOnrampPaymentMethods(paymentMethodList);
  }

  const byCode = new Map<string, OnrampFiatCurrencyOption>();

  for (const currency of selection?.fiatCurrencies ?? []) {
    const currencyCode = getFiatCurrencyCode(currency);
    if (!currencyCode || byCode.has(currencyCode)) continue;
    const meta =
      getFiatMetadata(currencyCode) ??
      (typeof currency === "object" ? currency : undefined);

    const logoUrl =
      typeof currency === "object"
        ? (currency.symbolUrl ??
          currency.flagUrl ??
          meta?.symbolUrl ??
          meta?.flagUrl)
        : (meta?.symbolUrl ??
          meta?.flagUrl ??
          getCountryFlagUrl(options?.countries, currencyCode.slice(0, 2)));

    byCode.set(currencyCode, {
      currencyCode,
      decimals:
        typeof currency === "object"
          ? (currency.decimals ?? meta?.decimals)
          : meta?.decimals,
      flagUrl: logoUrl,
      name:
        typeof currency === "object"
          ? (currency.name ?? meta?.name ?? getIntlCurrencyName(currencyCode))
          : (meta?.name ?? getIntlCurrencyName(currencyCode)),
      symbol:
        typeof currency === "object"
          ? (currency.symbol ?? getIntlCurrencySymbol(currencyCode))
          : getIntlCurrencySymbol(currencyCode),
      symbolUrl: logoUrl,
    });
  }

  const defaultFiat = selection?.defaultFiat?.toUpperCase();
  if (defaultFiat && !byCode.has(defaultFiat)) {
    const meta = getFiatMetadata(defaultFiat);
    const logoUrl =
      meta?.symbolUrl ??
      meta?.flagUrl ??
      getCountryFlagUrl(options?.countries, defaultFiat.slice(0, 2));
    byCode.set(defaultFiat, {
      currencyCode: defaultFiat,
      decimals: meta?.decimals,
      flagUrl: logoUrl,
      name: meta?.name ?? getIntlCurrencyName(defaultFiat),
      symbol: getIntlCurrencySymbol(defaultFiat),
      symbolUrl: logoUrl,
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

const getOnrampReturnUrl = () =>
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_NEXUS_ONRAMP_RETURN_URL?.trim()) ||
  (typeof window !== "undefined"
    ? `${window.location.origin}${ONRAMP_RETURN_PATH}`
    : ONRAMP_RETURN_PATH);
const getOnrampRuntimeEnvironment = (_baseUrl: string) => {
  const explicit =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_NEXUS_ONRAMP_ENV?.trim().toLowerCase()
      : undefined;
  // Canary is a mainnet-class Nexus deployment, not evidence of a Meld sandbox.
  return explicit === "sandbox" || explicit === "testnet"
    ? "sandbox"
    : "production";
};

const getUnsupportedCountryFallbackCode = (baseUrl: string) => {
  const environment = getOnrampRuntimeEnvironment(baseUrl);
  return environment === "production"
    ? ONRAMP_PRODUCTION_FALLBACK_COUNTRY
    : ONRAMP_SANDBOX_FALLBACK_COUNTRY;
};

const isValidCountryCode = (code?: string): code is string =>
  Boolean(code && /^[A-Za-z]{2}$/.test(code));

const fetchCountryIs = async (signal?: AbortSignal): Promise<string> => {
  const response = await fetch(ONRAMP_IP_COUNTRY_URL, {
    signal,
    headers: { Accept: "application/json" },
    method: "GET",
  });
  if (!response.ok) throw new Error("country.is failed");
  const data = (await response.json()) as IpCountryResponse;
  const country = data.country?.trim()?.toUpperCase();
  if (isValidCountryCode(country)) return country;
  throw new Error("Invalid country code from country.is");
};

const fetchIpApi = async (signal?: AbortSignal): Promise<string> => {
  const response = await fetch(ONRAMP_IP_API_URL, {
    signal,
    headers: { Accept: "application/json" },
    method: "GET",
  });
  if (!response.ok) throw new Error("ip-api.com failed");
  const data = (await response.json()) as {
    countryCode?: string;
    country?: string;
  };
  const country = (data.countryCode ?? data.country)?.trim()?.toUpperCase();
  if (isValidCountryCode(country)) return country;
  throw new Error("Invalid country code from ip-api.com");
};

const fetchIpapiCo = async (signal?: AbortSignal): Promise<string> => {
  const response = await fetch(ONRAMP_IPAPI_CO_URL, {
    signal,
    headers: { Accept: "application/json" },
    method: "GET",
  });
  if (!response.ok) throw new Error("ipapi.co failed");
  const data = (await response.json()) as {
    country?: string;
    country_code?: string;
  };
  const country = (data.country_code ?? data.country)?.trim()?.toUpperCase();
  if (isValidCountryCode(country)) return country;
  throw new Error("Invalid country code from ipapi.co");
};

const fetchCloudflareSpeedMeta = async (
  signal?: AbortSignal,
): Promise<string> => {
  const response = await fetch(ONRAMP_CLOUDFLARE_META_URL, {
    signal,
    method: "GET",
  });
  if (!response.ok) throw new Error("cloudflare meta failed");
  const text = await response.text();
  const data = JSON.parse(text) as { country?: string };
  const country = data.country?.trim()?.toUpperCase();
  if (isValidCountryCode(country)) return country;
  throw new Error("Invalid country code from cloudflare");
};

const getIpCountryCode = async (signal?: AbortSignal) => {
  const timeoutSignal = AbortSignal.timeout(15_000);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const country = await Promise.any([
      fetchCountryIs(combinedSignal),
      fetchIpApi(combinedSignal),
      fetchIpapiCo(combinedSignal),
      fetchCloudflareSpeedMeta(combinedSignal),
    ]);
    return country;
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

const resolveOnrampCountryCode = async (signal?: AbortSignal) => {
  const userSelected = readOnrampCache<string>(ONRAMP_USER_COUNTRY_CACHE_KEY);
  if (userSelected) return userSelected;

  const cached = readOnrampCache<string>(ONRAMP_COUNTRY_CACHE_KEY);
  if (cached) return cached;

  const resolved =
    (await getIpCountryCode(signal)) || getLocalCountryCode() || "US";
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

const getMethodLabel = (method?: string, customName?: string) => {
  if (customName) return customName;
  const meta = getPaymentMethodMetadata(method);
  if (meta?.name) return meta.name;
  switch ((method ?? "").toUpperCase()) {
    case "APPLE_PAY":
      return "Apple Pay";
    case "GOOGLE_PAY":
      return "Google Pay";
    case "UPI":
      return "UPI";
    case "IMPS":
      return "IMPS";
    case "CREDIT_DEBIT_CARD":
    case "CARD":
      return "Credit / Debit Cards";
    case "BANK_TRANSFER":
    case "NEFT":
    case "RTGS":
    case "AR_BANK_TRANSFER":
    case "NG_BANK_TRANSFER":
      return "Bank Transfer";
    case "SEPA":
      return "SEPA";
    case "REVOLUT_PAY":
    case "REVOLUT":
      return "Revolut Pay";
    case "MOBILE_MONEY":
      return "Mobile Money";
    case "BINANCE_P2P":
      return "Binance P2P";
    case "PAYMAYA":
      return "PayMaya";
    case "GCASH":
      return "GCash";
    case "GRABPAY":
      return "GrabPay";
    case "SPEI":
      return "SPEI";
    case "MX_CASH":
      return "Cash";
    case "ROBINHOOD_BUYING_POWER":
    case "ROBINHOOD":
      return "Robinhood";
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

const getProviderLabel = (provider?: string) => {
  if (!provider) return "Payment partner";
  const meta = getProviderMetadata(provider);
  if (meta?.name) return meta.name;
  return provider
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

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

const isOnrampProcessingState = (state?: string | null) => {
  const normalized = getNormalizedOnrampState(state);
  return [
    "PROCESSING",
    "SETTLING",
    "PENDING",
    "PENDING CREATED",
    "PENDING_CREATED",
    "TWO_FA_REQUIRED",
    "TWO_FA_PROVIDED",
    "ERROR",
    "ACCEPTED",
    "AUTHORIZED",
    "PARTIALLY_SETTLED",
  ].includes(normalized);
};

const ONRAMP_DEPOSIT_PROCESSING_STATES = new Set([
  "COMPLETING_DEPOSIT",
  "DEPOSIT_PROCESSING",
  "DEPOSITING",
  "SWAPPING_GAS",
]);

const ONRAMP_DEPOSIT_SUCCESS_STATES = new Set([
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

const FALLBACK_CHAIN_RPCS: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  10: "https://mainnet.optimism.io",
  56: "https://bsc-dataseed.binance.org",
  137: "https://polygon-rpc.com",
  8453: "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
  43114: "https://api.avax.network/ext/bc/C/rpc",
  534352: "https://rpc.scroll.io",
  11155111: "https://rpc.sepolia.org",
  84532: "https://sepolia.base.org",
  421614: "https://sepolia-rollup.arbitrum.io/rpc",
  11155420: "https://sepolia.optimism.io",
  80002: "https://rpc-amoy.polygon.technology",
};

const getChainRpcUrl = (
  chainId?: number,
  nexusSDK?: OnrampNexusSDK | null,
): string | undefined => {
  if (!chainId) return undefined;
  const sdkRpc =
    nexusSDK?.chainList?.getChainByID?.(chainId)?.rpcUrls?.default?.http?.[0];
  if (sdkRpc) return sdkRpc;
  const metaRpc = CHAIN_METADATA[chainId]?.rpcUrls?.[0];
  if (metaRpc) return metaRpc;
  return FALLBACK_CHAIN_RPCS[chainId];
};

const makeJsonRpcCall = async <T = any,>(
  rpcUrl: string,
  method: string,
  params: any[] = [],
  signal?: AbortSignal,
): Promise<T> => {
  logOnramp("rpc.request", { method });
  const response = await fetch(rpcUrl, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: Date.now(),
      jsonrpc: "2.0",
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`RPC request failed with status ${response.status}`);
  }
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message || "RPC call error");
  }
  logOnramp("rpc.response", { method, result: json.result });
  return json.result as T;
};

const fetchDestinationGasPriceWei = async (
  chainId: number,
  walletClient?: WalletClient | null,
  nexusSDK?: OnrampNexusSDK | null,
): Promise<bigint> => {
  const rpcUrl = getChainRpcUrl(chainId, nexusSDK);
  const useWallet = walletClient?.chain?.id === chainId;

  // 1. Try Type-2 EIP-1559 fee calculation
  try {
    let maxPriorityFeeHex: string | null = null;
    let baseFeeHex: string | null = null;

    if (useWallet && walletClient) {
      try {
        maxPriorityFeeHex = (await walletClient.request({
          method: "eth_maxPriorityFeePerGas",
        } as any)) as string;
      } catch {}
      try {
        const block = (await walletClient.request({
          method: "eth_getBlockByNumber",
          params: ["latest", false],
        } as any)) as { baseFeePerGas?: string } | null;
        baseFeeHex = block?.baseFeePerGas ?? null;
      } catch {}
    }

    if (!maxPriorityFeeHex && rpcUrl) {
      try {
        maxPriorityFeeHex = await makeJsonRpcCall<string>(
          rpcUrl,
          "eth_maxPriorityFeePerGas",
        );
      } catch {}
    }

    if (!baseFeeHex && rpcUrl) {
      try {
        const block = await makeJsonRpcCall<{ baseFeePerGas?: string }>(
          rpcUrl,
          "eth_getBlockByNumber",
          ["latest", false],
        );
        baseFeeHex = block?.baseFeePerGas ?? null;
      } catch {}
    }

    const priorityFee = maxPriorityFeeHex
      ? BigInt(maxPriorityFeeHex)
      : BigInt(0);
    const baseFee = baseFeeHex ? BigInt(baseFeeHex) : BigInt(0);

    if (priorityFee > BigInt(0) && baseFee > BigInt(0)) {
      return baseFee * BigInt(2) + priorityFee;
    }
    if (priorityFee > BigInt(0)) {
      return priorityFee;
    }
  } catch (err) {
    logOnramp(
      "Error fetching type 2 gas fee, falling back to eth_gasPrice",
      err,
    );
  }

  // 2. Fallback to eth_gasPrice
  try {
    if (useWallet && walletClient) {
      const gasPriceHex = (await walletClient.request({
        method: "eth_gasPrice",
      } as any)) as string;
      if (gasPriceHex) {
        const parsed = BigInt(gasPriceHex);
        if (parsed > BigInt(0)) return parsed;
      }
    }

    if (rpcUrl) {
      const gasPriceHex = await makeJsonRpcCall<string>(rpcUrl, "eth_gasPrice");
      if (gasPriceHex) {
        const parsed = BigInt(gasPriceHex);
        if (parsed > BigInt(0)) return parsed;
      }
    }
  } catch (err) {
    logOnramp("Error fetching eth_gasPrice", err);
  }

  // 3. Fallback default (1 Gwei)
  throw new Error(
    "Unable to fetch the destination gas price. Retry Deposit when the RPC is available.",
  );
};

const fetchUserNativeGasBalanceWei = async (
  account: Address,
  chainId: number,
  walletClient?: WalletClient | null,
  nexusSDK?: OnrampNexusSDK | null,
): Promise<bigint> => {
  const rpcUrl = getChainRpcUrl(chainId, nexusSDK);
  const useWallet = walletClient?.chain?.id === chainId;

  try {
    if (useWallet && walletClient) {
      const balanceHex = (await walletClient.request({
        method: "eth_getBalance",
        params: [account, "latest"],
      } as any)) as string;
      if (balanceHex) return BigInt(balanceHex);
    }

    if (rpcUrl) {
      const balanceHex = await makeJsonRpcCall<string>(
        rpcUrl,
        "eth_getBalance",
        [account, "latest"],
      );
      if (balanceHex) return BigInt(balanceHex);
    }
  } catch (err) {
    logOnramp("Failed to fetch user native gas balance", err);
  }

  throw new Error(
    "Unable to fetch the wallet gas balance. Retry Deposit when the RPC is available.",
  );
};

const isErc20Token = (token?: SwapTokenOption, chainId?: number) => {
  if (!token?.contractAddress) return false;
  if (isNativeAddress(token.contractAddress)) return false;
  const effectiveChainId = token.chainId ?? chainId;
  const nativeSymbol = effectiveChainId
    ? CHAIN_METADATA[effectiveChainId]?.nativeCurrency?.symbol?.toUpperCase()
    : undefined;
  if (
    nativeSymbol &&
    token.symbol?.toUpperCase() === nativeSymbol &&
    isNativeAddress(token.contractAddress)
  ) {
    return false;
  }
  return true;
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

const getTransactionExplorerUrl = (chainId?: number, txHash?: string) => {
  const baseUrl = getExplorerBaseUrl(chainId);
  return baseUrl && txHash ? `${baseUrl}${txHash}` : undefined;
};

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
  chainId: number,
  nexusSDK: OnrampNexusSDK | null | undefined,
  signal: AbortSignal,
) => {
  const rpcUrl = getChainRpcUrl(chainId, nexusSDK);
  logOnramp("wallet.receipt.wait", { chainId, txHash });
  const receipt = await waitForOnrampReceipt(async () => {
    const receipt = rpcUrl
      ? await makeJsonRpcCall<{ status?: string } | null>(
          rpcUrl,
          "eth_getTransactionReceipt",
          [txHash],
          signal,
        )
      : ((await walletClient.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        } as any)) as { status?: string } | null);
    logOnramp("wallet.receipt.poll", { chainId, txHash, receipt });
    return receipt;
  }, signal);
  logOnramp("wallet.receipt.confirmed", { chainId, txHash, receipt });
  return receipt;
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
    const aAmount = parseDecimal(a.destinationAmount) ?? new Decimal(0);
    const bAmount = parseDecimal(b.destinationAmount) ?? new Decimal(0);
    const destinationDelta = bAmount.cmp(aAmount);
    if (destinationDelta !== 0) return destinationDelta;
    const scoreDelta = (b.rampScore ?? 0) - (a.rampScore ?? 0);
    return scoreDelta;
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
  const requestId = createIdempotencyKey();
  const startedAt = Date.now();
  const controller = new AbortController();
  const abort = () => controller.abort();
  init?.signal?.addEventListener("abort", abort, { once: true });
  if (init?.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 20_000);
  logOnramp("api.request", {
    requestId,
    path,
    method: init?.method ?? "GET",
    request: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  });
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
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

    logOnramp("api.response", {
      requestId,
      path,
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      response: path.includes("/sessions")
        ? normalizeOnrampSession(data)
        : undefined,
      quoteCount: data.quotes?.length,
      routeCount: data.routes?.length,
      countryCount: data.countries?.length,
      cacheStatus:
        response.headers.get("x-cache") ??
        response.headers.get("cf-cache-status"),
      age: response.headers.get("age"),
    });
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
  } catch (error) {
    logOnramp("api.error", {
      requestId,
      path,
      durationMs: Date.now() - startedAt,
      aborted: controller.signal.aborted,
      error,
    });
    throw error;
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener("abort", abort);
  }
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
  const imageUrl = getCurrencyLogoUrl(displayCode, currency);

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

function CountryMark({
  countryCode,
  flagUrl,
  size = 20,
}: {
  countryCode?: string;
  flagUrl?: string;
  size?: number;
}) {
  const code = countryCode?.toUpperCase() ?? "";
  const [failed, setFailed] = React.useState(!flagUrl);

  React.useEffect(() => {
    setFailed(!flagUrl);
  }, [flagUrl]);

  if (!failed && flagUrl) {
    return (
      <img
        alt={code}
        onError={() => setFailed(true)}
        src={flagUrl}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: "999px",
          display: "block",
          flexShrink: 0,
          height: `${size}px`,
          objectFit: "cover",
          width: `${size}px`,
        }}
      />
    );
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
        fontSize: `${Math.max(9, Math.floor(size * 0.4))}px`,
        fontWeight: 700,
        height: `${size}px`,
        justifyContent: "center",
        width: `${size}px`,
      }}
    >
      {(code || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}


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

function ProviderMark({ provider }: { provider?: string }) {
  const isDark = useIsDarkMode();
  const meta = getProviderMetadata(provider);
  const logo = meta?.logo;
  const [failed, setFailed] = React.useState(false);

  const logoUrl = React.useMemo(() => {
    if (!logo) return undefined;
    if (isDark) {
      return logo.darkShort || logo.lightShort || logo.dark || logo.light;
    }
    return logo.lightShort || logo.darkShort || logo.light || logo.dark;
  }, [logo, isDark]);

  React.useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  if (logoUrl && !failed) {
    return (
      <div
        style={{
          alignItems: "center",
          backgroundColor: isDark
            ? "rgba(255, 255, 255, 0.06)"
            : theme.colors.surfaceCool,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: "8px",
          display: "flex",
          flexShrink: 0,
          height: "34px",
          justifyContent: "center",
          overflow: "hidden",
          width: "34px",
        }}
      >
        <img
          alt={meta?.name ?? getProviderLabel(provider)}
          onError={() => setFailed(true)}
          src={logoUrl}
          style={{
            height: "100%",
            objectFit: "contain",
            padding: "3px",
            width: "100%",
          }}
        />
      </div>
    );
  }

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

const PAYMENT_METHOD_LOGOS: Record<string, string> = {
  APPLE_PAY: "https://files.availproject.org/widgets/nexus/assets/applepay.svg",
  BINANCE_P2P: "https://files.availproject.org/widgets/nexus/assets/binance.png",
  GCASH: "https://files.availproject.org/widgets/nexus/assets/gcash.png",
  GOOGLE_PAY: "https://files.availproject.org/widgets/nexus/assets/googlepay.svg",
  GRABPAY: "https://files.availproject.org/widgets/nexus/assets/grabpay.svg",
  IMPS: "https://files.availproject.org/widgets/nexus/assets/imps.png",
  PAYMAYA: "https://files.availproject.org/widgets/nexus/assets/paymaya.svg",
  REVOLUT: "https://files.availproject.org/widgets/nexus/assets/revolut.svg",
  REVOLUT_PAY: "https://files.availproject.org/widgets/nexus/assets/revolut.svg",
  ROBINHOOD: "https://files.availproject.org/widgets/nexus/assets/robinhood.jpg",
  ROBINHOOD_BUYING_POWER:
    "https://files.availproject.org/widgets/nexus/assets/robinhood.jpg",
  SEPA: "https://files.availproject.org/widgets/nexus/assets/sepa.jpg",
  UPI: "https://files.availproject.org/widgets/nexus/assets/upi.png",
};

const PAYMENT_METHOD_LOGO_STYLES: Record<string, React.CSSProperties> = {
  GOOGLE_PAY: {
    padding: 0,
    transform: "scale(1.35)",
  },
};

function MethodMark({
  alt,
  logo,
  method,
}: {
  alt?: string;
  logo?: OnrampPaymentMethodLogo;
  method?: string;
}) {
  const isDark = useIsDarkMode();
  const normalized = (method ?? "").toUpperCase();
  const apiLogoUrl = getPaymentMethodLogoUrl(method, logo, isDark);
  const staticLogoUrl = PAYMENT_METHOD_LOGOS[normalized];
  const customLogoStyle = PAYMENT_METHOD_LOGO_STYLES[normalized];
  const [apiFailed, setApiFailed] = React.useState(false);
  const [staticFailed, setStaticFailed] = React.useState(false);

  React.useEffect(() => {
    setApiFailed(false);
  }, [apiLogoUrl]);

  React.useEffect(() => {
    setStaticFailed(false);
  }, [staticLogoUrl]);

  const candidateUrl =
    (!apiFailed && apiLogoUrl) || (!staticFailed && staticLogoUrl) || undefined;

  if (candidateUrl) {
    return (
      <div
        style={{
          alignItems: "center",
          backgroundColor: isDark
            ? "rgba(255, 255, 255, 0.06)"
            : theme.colors.surfaceCool,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: "8px",
          display: "flex",
          flexShrink: 0,
          height: "34px",
          justifyContent: "center",
          overflow: "hidden",
          width: "34px",
        }}
      >
        <img
          alt={alt ?? getMethodLabel(method)}
          onError={() => {
            if (candidateUrl === apiLogoUrl) {
              setApiFailed(true);
            } else {
              setStaticFailed(true);
            }
          }}
          src={candidateUrl}
          style={{
            maxHeight: "100%",
            maxWidth: "100%",
            objectFit: "contain",
            padding: "4px",
            ...(candidateUrl === staticLogoUrl ? customLogoStyle : undefined),
          }}
        />
      </div>
    );
  }

  const icon =
    normalized === "CREDIT_DEBIT_CARD" ||
    normalized === "CARD" ||
    normalized.includes("CARD") ? (
      <CreditCard aria-hidden="true" size={20} strokeWidth={1.7} />
    ) : normalized.includes("BANK") ||
      normalized === "NEFT" ||
      normalized === "RTGS" ||
      normalized === "SPEI" ? (
      <Landmark aria-hidden="true" size={20} strokeWidth={1.7} />
    ) : (
      <Smartphone aria-hidden="true" size={20} strokeWidth={1.7} />
    );

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.06)"
          : theme.colors.surfaceCool,
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
        backgroundColor: disabled
          ? theme.colors.surfaceCool
          : "var(--nexus-widget-primary-soft, #E8F0FF)",
        border: "none",
        borderRadius: "999px",
        color: disabled ? theme.colors.muted : theme.colors.textStrong,
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
        backgroundColor: theme.colors.surfaceCool,
        border: `1px solid ${
          focused
            ? "var(--nexus-widget-focus-border, #A8C9FF)"
            : theme.colors.border
        }`,
        borderRadius: "12px",
        boxShadow: focused
          ? "0 0 0 1px var(--nexus-widget-focus-ring, rgba(0,107,244,0.16))"
          : "none",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        gap: "8px",
        height: "42px",
        minHeight: "42px",
        padding: "0 8px 0 14px",
        width: "100%",
      }}
    >
      <Search
        aria-hidden="true"
        color={theme.colors.textSubtle}
        size={18}
        style={{ flexShrink: 0 }}
      />
      <input
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        style={{
          backgroundColor: "transparent",
          border: "none",
          boxSizing: "border-box",
          color: theme.colors.textStrong,
          flex: "1 1 0%",
          fontFamily: theme.fonts.sans,
          fontSize: "14px",
          height: "100%",
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
            flexShrink: 0,
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
        flexShrink: 0,
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
  if (isOnrampDepositSuccessState(normalized)) {
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
      Keep this page open to finish your deposit
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
        aria-expanded={expanded}
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
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </span>
      </button>
      <div
        style={{
          backgroundColor: "#EFEFEF",
          display: "grid",
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition: "grid-template-rows 0.22s ease, opacity 0.18s ease-out",
        }}
      >
        <div
          style={{
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
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
  depositExecution,
  destinationAmount,
  destinationChainName,
  destinationSymbol,
  gasShortfallInfo,
  gasTokenSymbol,
  provider,
  sourceAmount,
  sourceCurrencyCode,
  targetLabel,
}: {
  depositExecution?: OnrampDepositExecutionState;
  destinationAmount: string;
  destinationChainName: string;
  destinationSymbol?: string;
  gasShortfallInfo?: OnrampGasShortfallInfo | null;
  gasTokenSymbol?: string;
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
  const isSwappingGas = depositExecution?.step === "swapping_gas";
  const hasGasSwap = Boolean(
    gasShortfallInfo?.isShortfall &&
    gasShortfallInfo.shortfallAmountRaw > BigInt(0),
  );
  const gasSwapDone = hasGasSwap && depositExecution?.step === "depositing";

  const steps = [
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
    ...(hasGasSwap
      ? [
          {
            complete: gasSwapDone,
            subtitle: `Swapping ${gasShortfallInfo?.shortfallAmountEth ?? ""} ${
              gasTokenSymbol ?? "gas"
            } on ${destinationChainName}`,
            title: `Swap for gas (${gasTokenSymbol ?? "gas"})`,
          },
        ]
      : []),
    {
      complete: false,
      subtitle: `On ${destinationChainName}`,
      title: `Depositing on ${targetLabel}`,
    },
  ];

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
        {isSwappingGas ? "Swapping for gas..." : "Usually takes 20 seconds"}
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
          steps={steps}
          summaryAmount={destinationDisplay}
          summaryLabel={
            isSwappingGas
              ? `Swapping for ${gasTokenSymbol ?? "gas"}`
              : `Depositing to ${targetLabel}`
          }
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
        {paymentMethod && (
          <SummaryRow
            label="Payment method"
            value={getMethodLabel(paymentMethod)}
          />
        )}
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
  hasConnectedWallet,
  walletChecking,
  onConnectWallet,
  depositExecution,
  gasShortfallInfo,
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
  hasConnectedWallet: boolean;
  walletChecking: boolean;
  onConnectWallet: () => void;
  depositExecution: OnrampDepositExecutionState;
  gasShortfallInfo?: OnrampGasShortfallInfo | null;
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
  const destinationChainId = toToken?.chainId ?? opportunity?.chainId ?? 0;
  const gasTokenSymbol =
    CHAIN_METADATA[destinationChainId]?.nativeCurrency?.symbol ?? "ETH";
  const explorerUrl =
    depositExecution.explorerUrl ?? getOnrampExplorerUrl(session, toToken);
  const containerStyle: React.CSSProperties = {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "100%",
  };

  if (
    ["FAILED", "DECLINED", "AUTHORIZATION_EXPIRED"].includes(normalizedState)
  ) {
    return (
      <div style={containerStyle}>
        <OnrampActionStatusPanel
          description={`${getProviderLabel(
            provider,
          )} could not complete the payment. Check the provider for charge or refund details.`}
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
    normalizedState === "SETTLED" &&
    depositExecution.status !== "success" &&
    depositExecution.status !== "running" &&
    !hasConnectedWallet
  ) {
    return (
      <OnrampActionStatusPanel
        title="Connect your wallet to deposit"
        description="Your purchase is complete. Connect the wallet that received the crypto to complete your deposit."
        onPrimary={onConnectWallet}
        onSecondary={onDone}
        primaryButtonForeground={primaryButtonForeground}
        primaryLabel={walletChecking ? "Checking wallet..." : "Connect Wallet"}
        secondaryLabel="Skip Deposit"
      />
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

  if (depositExecution.status === "success") {
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
          subtitle={getOnrampSessionSubtitle("DEPOSIT_SUCCESS", opportunity)}
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
          depositExecution={depositExecution}
          destinationAmount={destinationAmount}
          destinationChainName={destinationChainName}
          destinationSymbol={destinationSymbol}
          gasShortfallInfo={gasShortfallInfo}
          gasTokenSymbol={gasTokenSymbol}
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
  getWalletProvider,
  walletConnected,
  destinationTokens,
  onConnectWallet,
  onError,
  onSelectDestinationToken,
  onSessionStateChange,
  onSessionUpdate,
  nexusSDK,
  ownerAddress: persistedOwnerAddress,
  opportunity,
  primaryButtonForeground,
  toToken,
  walletClient,
}: DepositOnrampFlowProps) {
  const {
    address: ownerAddress,
    revision: walletRevision,
    checking: walletChecking,
    check: checkWalletConnection,
  } = useOnrampWallet({
    getProvider: getWalletProvider,
    walletClient,
    walletConnected,
  });
  const [walletActionPending, setWalletActionPending] = React.useState(false);
  const [countryCode, setCountryCode] = React.useState("");
  const [sourceCurrencyCode, setSourceCurrencyCode] = React.useState("");
  const [sourceAmount, setSourceAmount] = React.useState("");
  const [options, setOptions] = React.useState<OnrampOptionsResponse | null>(
    null,
  );
  const [routes, setRoutes] = React.useState<OnrampRoute[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState("");
  const [quotes, setQuotes] = React.useState<OnrampQuote[]>([]);
  const [quotesRequestKey, setQuotesRequestKey] = React.useState("");
  const [selectedProvider, setSelectedProvider] = React.useState("");
  const [activeSheet, setActiveSheet] = React.useState<OnrampSheet>(null);
  const [countrySearch, setCountrySearch] = React.useState("");
  const [currencySearch, setCurrencySearch] = React.useState("");
  const [methodSearch, setMethodSearch] = React.useState("");
  const [partnerSearch, setPartnerSearch] = React.useState("");
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [routesLoading, setRoutesLoading] = React.useState(false);
  const [quotesLoading, setQuotesLoading] = React.useState(false);
  const [sessionLoading, setSessionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [blockedRateRequest, setBlockedRateRequest] =
    React.useState<OnrampBlockedRequest | null>(null);
  const [failedQuoteRequest, setFailedQuoteRequest] =
    React.useState<OnrampBlockedRequest | null>(null);
  const [session, setSession] = React.useState<OnrampSessionResponse | null>(
    null,
  );
  const [sessionCallbackReceived, setSessionCallbackReceived] =
    React.useState(false);
  const [depositExecution, setDepositExecution] =
    React.useState<OnrampDepositExecutionState>({ status: "idle" });
  const [gasShortfallInfo, setGasShortfallInfo] =
    React.useState<OnrampGasShortfallInfo | null>(null);
  const [gasShortfallLoading, setGasShortfallLoading] = React.useState(false);
  const [forexRates, setForexRates] = React.useState<Record<string, number>>(
    {},
  );
  const [quoteRefreshSeconds, setQuoteRefreshSeconds] = React.useState(
    QUOTE_REFRESH_SECONDS,
  );
  const [quoteRefreshProgress, setQuoteRefreshProgress] = React.useState(1);
  const userSelectedCountryRef = React.useRef<string>(
    readOnrampCache<string>(ONRAMP_USER_COUNTRY_CACHE_KEY) || "",
  );
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;
  const sessionRef = React.useRef(session);
  sessionRef.current = session;
  const sessionHistoryRef = React.useRef<Omit<
    OnrampHistoryUpdate,
    "session"
  > | null>(null);
  const sessionQuoteRef = React.useRef<OnrampQuote | null>(null);
  const sessionUpdateRef = React.useRef(onSessionUpdate);
  sessionUpdateRef.current = onSessionUpdate;
  const ownerRef = React.useRef(ownerAddress);
  ownerRef.current = ownerAddress;
  const refreshSessionRef = React.useRef<(() => void) | null>(null);
  const depositAbortRef = React.useRef<AbortController | null>(null);
  const depositBusyRef = React.useRef(false);
  const remainingDepositRef = React.useRef<{
    sessionId: string;
    amountRaw: bigint;
  } | null>(null);
  const pendingApprovalRef = React.useRef<{
    sessionId: string;
    txHash: Hex;
  } | null>(null);
  const pendingDepositRef = React.useRef<{
    sessionId: string;
    txHash: Hex;
    amountRaw: bigint;
  } | null>(null);
  const quoteRunIdRef = React.useRef(0);
  const routeRunIdRef = React.useRef(0);
  const lastRouteRequestKeyRef = React.useRef("");
  const lastQuoteRequestKeyRef = React.useRef("");
  const quotesLoadingRef = React.useRef(false);
  const quoteAbortRef = React.useRef<AbortController | null>(null);
  const createSessionAbortRef = React.useRef<AbortController | null>(null);
  const depositExecutionSessionRef = React.useRef("");
  const normalizedSessionState = getNormalizedOnrampState(session?.state);
  const hasConnectedWallet = Boolean(ownerAddress);
  const quoteWalletAddress = hasConnectedWallet
    ? (ownerAddress as Address)
    : ONRAMP_DISCONNECTED_QUOTE_WALLET_ADDRESS;

  const fiatCurrencyOptions = React.useMemo(
    () => getFiatCurrencyOptions(options),
    [options],
  );
  const selectedFiatCurrency = fiatCurrencyOptions.find(
    (currency) => currency.currencyCode === sourceCurrencyCode,
  );
  const filteredFiatCurrencies = React.useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) return fiatCurrencyOptions;
    return fiatCurrencyOptions.filter((currency) => {
      const code = currency.currencyCode.toLowerCase();
      const name = (
        currency.name ?? getFiatCurrencyName(currency.currencyCode, currency)
      ).toLowerCase();
      const symbol = (currency.symbol ?? "").toLowerCase();
      return (
        code.includes(query) || name.includes(query) || symbol.includes(query)
      );
    });
  }, [fiatCurrencyOptions, currencySearch]);

  const filteredCountries = React.useMemo(() => {
    const list = options?.countries ?? [];
    const seen = new Set<string>();
    const unique: OnrampCountry[] = [];
    for (const item of list) {
      const code = item.countryCode?.toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      unique.push(item);
    }
    const query = countrySearch.trim().toLowerCase();
    if (!query) return unique;
    return unique.filter((country) => {
      const name = (country.name ?? "").toLowerCase();
      const code = (country.countryCode ?? "").toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [options?.countries, countrySearch]);

  const selectedCountry = React.useMemo(
    () => getCountryByCode(options?.countries, countryCode),
    [options?.countries, countryCode],
  );
  const selectedCountryFlagUrl =
    selectedCountry?.flagUrl ??
    getCountryFlagUrl(options?.countries, countryCode);

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
        quoteWalletAddress.toLowerCase(),
        walletRevision,
        selectedPaymentMethod,
        sourceAmount.trim(),
      ].join("|"),
    [
      quoteWalletAddress,
      walletRevision,
      rateRequestKey,
      selectedPaymentMethod,
      sourceAmount,
    ],
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
    const list = Array.from(map.values());
    cacheOnrampPaymentMethods(list);
    return list;
  }, [routes, selectedRoute]);
  const selectedPaymentMethodDetails = availablePaymentMethods.find(
    (method) => method.method === selectedPaymentMethod,
  );
  const currentQuotes = React.useMemo(
    () => (quotesRequestKey === quoteRequestKey ? quotes : []),
    [quoteRequestKey, quotes, quotesRequestKey],
  );
  const selectedQuote =
    currentQuotes.find(
      (quote) =>
        quote.provider === selectedProvider &&
        (!selectedPaymentMethod ||
          quote.paymentMethodType === selectedPaymentMethod),
    ) ??
    currentQuotes.find((quote) => quote.provider === selectedProvider) ??
    currentQuotes.find(
      (quote) => quote.paymentMethodType === selectedPaymentMethod,
    ) ??
    currentQuotes[0];
  const filteredPaymentMethods = React.useMemo(
    () =>
      availablePaymentMethods.filter((method) =>
        matchesSearch(methodSearch, [
          method.method,
          method.name,
          getMethodLabel(method.method),
          getMethodSubtitle(method),
        ]),
      ),
    [availablePaymentMethods, methodSearch],
  );
  const providerOptions = React.useMemo<OnrampProviderOption[]>(() => {
    if (currentQuotes.length > 0) {
      return currentQuotes.map((quote) => {
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
  }, [currentQuotes, routes]);
  const filteredProviderOptions = React.useMemo(
    () =>
      providerOptions.filter((option) =>
        matchesSearch(partnerSearch, [
          option.provider,
          getProviderLabel(option.provider),
          option.paymentMethodType,
          option.paymentMethod?.name,
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

  const targetChainId = toToken?.chainId ?? opportunity?.chainId;
  const isErc20 = isErc20Token(toToken, targetChainId);

  React.useEffect(() => {
    if (!targetChainId || !isErc20) {
      setGasShortfallInfo(null);
      setGasShortfallLoading(false);
      return;
    }

    let cancelled = false;
    setGasShortfallLoading(true);

    const runGasShortfallCheck = async () => {
      try {
        // 1. Gas units from opportunity executeDeposit:
        let configGas = BigInt(1000000);
        let hasApproval = false;
        if (opportunity?.executeDeposit) {
          try {
            const dummyAmountRaw = BigInt(1000000);
            const dummyUser =
              ownerAddress && isAddress(ownerAddress)
                ? (ownerAddress as Address)
                : ONRAMP_DISCONNECTED_QUOTE_WALLET_ADDRESS;
            const executeParams = opportunity.executeDeposit(
              opportunity.tokenSymbol,
              opportunity.tokenAddress,
              dummyAmountRaw,
              targetChainId,
              dummyUser,
            );
            if (executeParams?.gas && executeParams.gas > BigInt(0)) {
              configGas = executeParams.gas;
            }
            if (executeParams?.tokenApproval) {
              hasApproval = true;
            }
          } catch (e) {
            logOnramp(
              "Could not simulate executeDeposit for gas estimation, using default 1M gas",
              e,
            );
          }
        }
        const estimatedGasUnits =
          configGas + (hasApproval ? BigInt(50000) : BigInt(0));

        // 2. Fetch destination gas price:
        const gasPriceWei = await fetchDestinationGasPriceWei(
          targetChainId,
          walletClient,
          nexusSDK,
        );

        if (cancelled) return;

        // 3. Wei calculation with 20% safety margin:
        const rawGasCostWei = estimatedGasUnits * gasPriceWei;
        const requiredGasWei = (rawGasCostWei * BigInt(120)) / BigInt(100);

        // 4. Native decimals & ETH conversion:
        const nativeDecimals =
          CHAIN_METADATA[targetChainId]?.nativeCurrency?.decimals ?? 18;
        const requiredGasEth = new Decimal(requiredGasWei.toString())
          .div(Decimal.pow(10, nativeDecimals))
          .toFixed();

        // 5. User balance & shortfall:
        let userGasBalanceWei = BigInt(0);
        if (ownerAddress && isAddress(ownerAddress)) {
          userGasBalanceWei = await fetchUserNativeGasBalanceWei(
            ownerAddress as Address,
            targetChainId,
            walletClient,
            nexusSDK,
          );
        }
        const userGasBalanceEth = new Decimal(userGasBalanceWei.toString())
          .div(Decimal.pow(10, nativeDecimals))
          .toFixed();

        const gasDiffWei = userGasBalanceWei - requiredGasWei;
        const isShortfall = isErc20 && gasDiffWei < BigInt(0);
        const shortfallAmountRaw = isShortfall
          ? requiredGasWei - userGasBalanceWei
          : BigInt(0);
        const shortfallAmountEth = isShortfall
          ? new Decimal(shortfallAmountRaw.toString())
              .div(Decimal.pow(10, nativeDecimals))
              .toFixed()
          : "0";

        if (!cancelled) {
          setGasShortfallInfo({
            estimatedGasUnits,
            gasPriceWei,
            hasApproval,
            isErc20: true,
            isShortfall,
            requiredGasEth,
            requiredGasWei,
            shortfallAmountEth,
            shortfallAmountRaw,
            userGasBalanceEth,
            userGasBalanceWei,
          });
        }
      } catch (err) {
        logOnramp("Failed to check gas shortfall:", err);
        if (!cancelled) {
          setGasShortfallInfo(null);
        }
      } finally {
        if (!cancelled) {
          setGasShortfallLoading(false);
        }
      }
    };

    void runGasShortfallCheck();

    return () => {
      cancelled = true;
    };
  }, [
    targetChainId,
    isErc20,
    opportunity,
    ownerAddress,
    walletClient,
    nexusSDK,
  ]);

  const executeOnrampDeposit = React.useCallback(
    async (force = false) => {
      const sessionId = session?.sessionId;
      logOnramp("deposit.handoff", {
        sessionId,
        state: session?.state,
        force,
        hasOpportunity: Boolean(opportunity),
        hasWallet: Boolean(walletClient),
        hasSDK: Boolean(nexusSDK),
        ownerAddress,
        persistedOwnerAddress,
      });
      if (
        !sessionId ||
        depositBusyRef.current ||
        depositExecution.status === "success"
      )
        return;
      if (!force && depositExecutionSessionRef.current === sessionId) return;
      depositExecutionSessionRef.current = sessionId;
      depositBusyRef.current = true;
      const controller = new AbortController();
      depositAbortRef.current = controller;
      const checkActive = () => {
        controller.signal.throwIfAborted();
        if (
          sessionRef.current?.sessionId !== sessionId ||
          ownerRef.current !== ownerAddress
        ) {
          throw new Error(
            "The wallet or onramp session changed. Reconnect the funded wallet to continue.",
          );
        }
      };
      setDepositExecution({ status: "running", step: "depositing" });
      try {
        checkActive();
        let settledSession = session;
        if (force && !pendingDepositRef.current) {
          const payload = await fetchOnrampJson<unknown>(
            baseUrl,
            `/api/v1/onramp/sessions/${encodeURIComponent(sessionId)}`,
            { signal: controller.signal },
          );
          checkActive();
          settledSession = mergeOnrampSession(
            session,
            normalizeOnrampSession(payload, sessionId),
          );
          setSession(settledSession);
        }
        if (!opportunity || !toToken || !ownerAddress || !walletClient) {
          throw new Error(
            "Reconnect your wallet to complete the deposit. Your purchased crypto remains in your wallet.",
          );
        }
        const account = ownerAddress as Address;
        const liveAccount = await checkWalletConnection();
        if (liveAccount?.toLowerCase() !== account.toLowerCase()) {
          throw new Error(
            "Reconnect the funded wallet to complete your deposit.",
          );
        }
        checkActive();
        const toChainId = opportunity.chainId;
        const decimals = opportunity.tokenDecimals;
        if (
          !isMatchingOnrampToken(toToken, toChainId, opportunity.tokenAddress)
        ) {
          throw new Error(
            "The onramp token does not match the configured deposit destination.",
          );
        }
        if (
          settledSession.transaction?.walletAddress &&
          settledSession.transaction.walletAddress.toLowerCase() !==
            account.toLowerCase()
        ) {
          throw new Error(
            "Connect the wallet that received this onramp payment to deposit.",
          );
        }
        if (
          settledSession.transaction?.chainId &&
          settledSession.transaction.chainId !== toChainId
        ) {
          throw new Error(
            "The payment was delivered on a different chain than the deposit destination.",
          );
        }
        const confirm = (hash: Hex) =>
          waitForWalletTransactionSuccess(
            walletClient,
            hash,
            toChainId,
            nexusSDK,
            controller.signal,
          );
        const markSuccess = (txHash: Hex, amountRaw: bigint) => {
          checkActive();
          const amount = formatUnits(amountRaw, decimals);
          const explorerUrl = getNexusChainTransactionExplorerUrl(
            nexusSDK,
            toChainId,
            txHash,
          );
          logOnramp("deposit.confirmed", {
            sessionId,
            txHash,
            toChainId,
            amount,
            explorerUrl,
          });
          setDepositExecution({
            amount,
            explorerUrl,
            status: "success",
            txHash,
          });
          // Keep the authoritative Meld state separate from local execution state.
          pendingDepositRef.current = null;
        };
        const pending = pendingDepositRef.current;
        if (pending?.sessionId === sessionId) {
          logOnramp("deposit.resume_confirmation", pending);
          await confirm(pending.txHash);
          markSuccess(pending.txHash, pending.amountRaw);
          return;
        }
        if (pendingApprovalRef.current?.sessionId === sessionId) {
          logOnramp(
            "wallet.approval.resume_confirmation",
            pendingApprovalRef.current,
          );
          await confirm(pendingApprovalRef.current.txHash);
          pendingApprovalRef.current = null;
        }
        // Quotes are estimates. Only the settled transaction establishes the amount to deposit.
        let amountRaw =
          remainingDepositRef.current?.sessionId === sessionId
            ? remainingDepositRef.current.amountRaw
            : getRawTokenAmount(
                settledSession.transaction?.destinationAmount,
                decimals,
              );
        if (!amountRaw || amountRaw <= BigInt(0))
          throw new Error(
            "The settled payment is missing its received amount. Check payment status again before depositing.",
          );
        logOnramp("deposit.amount", {
          sessionId,
          amountRaw,
          decimals,
          state: settledSession.state,
        });
        if (settledSession.state !== "SETTLED")
          throw new Error("The payment has not settled yet.");
        logOnramp("wallet.switch_chain", { sessionId, toChainId });
        const chainHex = await walletClient.request({ method: "eth_chainId" });
        if (Number(chainHex) !== toChainId)
          await walletClient.switchChain({ id: toChainId });
        const assertWallet = async () => {
          checkActive();
          const liveAccount = await checkWalletConnection();
          const [chainId, accounts] = await Promise.all([
            walletClient.request({ method: "eth_chainId" }),
            walletClient.request({ method: "eth_accounts" }),
          ]);
          checkActive();
          if (
            liveAccount?.toLowerCase() !== account.toLowerCase() ||
            Number(chainId) !== toChainId ||
            accounts[0]?.toLowerCase() !== account.toLowerCase()
          ) {
            throw new Error(
              "Select the funded wallet and deposit chain to continue.",
            );
          }
        };
        await assertWallet();
        const readTokenBalance = async () => {
          const isNative = isNativeAddress(opportunity.tokenAddress);
          const method = isNative ? "eth_getBalance" : "eth_call";
          const params = isNative
            ? [account, "latest"]
            : [
                {
                  to: opportunity.tokenAddress,
                  data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: "balanceOf",
                    args: [account],
                  }),
                },
                "latest",
              ];
          const rpc = getChainRpcUrl(toChainId, nexusSDK);
          const balance = rpc
            ? await makeJsonRpcCall<string>(
                rpc,
                method,
                params,
                controller.signal,
              )
            : ((await walletClient.request({
                method,
                params,
              } as any)) as string);
          checkActive();
          logOnramp("deposit.balance", {
            sessionId,
            toChainId,
            balanceRaw: BigInt(balance),
            requiredRaw: amountRaw,
          });
          return BigInt(balance);
        };
        // Allow RPC visibility to catch up with 60 one-second retries after Meld reports delivery.
        let balanceBefore = await readTokenBalance();
        for (
          let attempt = 0;
          balanceBefore < amountRaw && attempt < 60;
          attempt++
        ) {
          logOnramp("deposit.awaiting_balance", { sessionId, attempt });
          await onrampDelay(1000, controller.signal);
          balanceBefore = await readTokenBalance();
        }
        if (balanceBefore < amountRaw)
          throw new Error(
            "The settled amount is not yet available on the deposit chain. Retry Deposit after the balance arrives.",
          );
        const makeExecuteParams = () =>
          opportunity.executeDeposit(
            opportunity.tokenSymbol,
            opportunity.tokenAddress,
            amountRaw!,
            toChainId,
            account,
          );
        let executeParams = makeExecuteParams();
        if (!isPositiveGasLimit(executeParams.gas))
          throw new Error(
            "Deposit config executeDeposit must return a positive gas limit.",
          );
        // Refresh gas at settlement: checkout may have taken several minutes.
        const [gasPrice, nativeBalance] = await Promise.all([
          fetchDestinationGasPriceWei(toChainId, walletClient, nexusSDK),
          fetchUserNativeGasBalanceWei(
            account,
            toChainId,
            walletClient,
            nexusSDK,
          ),
        ]);
        checkActive();
        const gasUnits =
          executeParams.gas +
          (executeParams.tokenApproval ? BigInt(50_000) : BigInt(0));
        const gasRequired = (gasUnits * gasPrice * BigInt(120)) / BigInt(100);
        const shortfall =
          gasRequired > nativeBalance ? gasRequired - nativeBalance : BigInt(0);
        logOnramp("deposit.gas_check", {
          sessionId,
          gasUnits,
          gasPrice,
          nativeBalance,
          gasRequired,
          shortfall,
        });
        if (
          isNativeAddress(opportunity.tokenAddress) &&
          nativeBalance < amountRaw + gasRequired
        ) {
          throw new Error(
            "Additional native gas is needed to deposit the purchased amount. Add gas to this wallet and retry Deposit.",
          );
        }
        if (isErc20Token(toToken, toChainId) && shortfall > BigInt(0)) {
          if (!nexusSDK?.swapWithExactOut)
            throw new Error(
              "Nexus is not ready to acquire gas for the deposit. Reconnect and retry.",
            );
          await assertWallet();
          setDepositExecution({ status: "running", step: "swapping_gas" });
          const input = {
            sources: [
              { chainId: toChainId, tokenAddress: opportunity.tokenAddress },
            ],
            toAmountRaw: shortfall,
            toChainId,
            toTokenAddress: zeroAddress,
          };
          logOnramp("sdk.swapWithExactOut.start", { sessionId, input });
          const result = await nexusSDK.swapWithExactOut(input, {
            hooks: {
              onIntent: (data: any) => {
                logOnramp("sdk.intent", { sessionId, intent: data.intent });
                try {
                  checkActive();
                } catch {
                  data.deny();
                  return;
                }
                try {
                  const spend = (data.intent?.sources ?? []).reduce(
                    (total: bigint, source: any) => {
                      if (
                        !isMatchingOnrampToken(
                          toToken,
                          source.chain.id,
                          source.token.contractAddress,
                        )
                      )
                        throw new Error(
                          "Gas quote uses an unexpected source token.",
                        );
                      return (
                        total + parseUnits(source.amount, source.token.decimals)
                      );
                    },
                    BigInt(0),
                  );
                  if (spend >= amountRaw!) {
                    logOnramp("sdk.intent.denied", {
                      sessionId,
                      reason: "Gas quote consumes the purchased amount",
                      spend,
                      amountRaw,
                    });
                    data.deny();
                    return;
                  }
                  logOnramp("sdk.intent.allow", { sessionId, spend });
                  data.allow();
                } catch (error) {
                  logOnramp("sdk.intent.denied", { sessionId, error });
                  data.deny();
                }
              },
            },
            onEvent: (event: any) =>
              logOnramp("sdk.event", {
                sessionId,
                operation: "swapWithExactOut",
                event,
              }),
          });
          checkActive();
          logOnramp("sdk.swapWithExactOut.complete", { sessionId, result });
          amountRaw = getOnrampRemainingAmount(
            amountRaw,
            balanceBefore,
            await readTokenBalance(),
          );
          remainingDepositRef.current = { sessionId, amountRaw };
          executeParams = makeExecuteParams();
          setDepositExecution({ status: "running", step: "depositing" });
        }
        logOnramp("deposit.execute_config", {
          sessionId,
          amountRaw,
          executeParams,
        });
        if (!isPositiveGasLimit(executeParams.gas))
          throw new Error(
            "Deposit config executeDeposit must return a positive gas limit.",
          );
        if (executeParams.tokenApproval) {
          await assertWallet();
          const approval = executeParams.tokenApproval;
          const allowanceData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "allowance",
            args: [account, approval.spender],
          });
          const allowance = BigInt(
            (await walletClient.request({
              method: "eth_call",
              params: [
                { to: approval.toTokenAddress, data: allowanceData },
                "latest",
              ],
            } as any)) as string,
          );
          logOnramp("wallet.approval.check", {
            sessionId,
            allowance,
            required: approval.amount,
          });
          if (allowance < approval.amount) {
            await assertWallet();
            logOnramp("wallet.approval.prompt", { sessionId, approval });
            const approvalHash = await walletClient.writeContract({
              abi: erc20Abi,
              account,
              address: approval.toTokenAddress,
              args: [approval.spender, approval.amount],
              chain: null,
              functionName: "approve",
            });
            pendingApprovalRef.current = { sessionId, txHash: approvalHash };
            logOnramp("wallet.approval.submitted", { sessionId, approvalHash });
            await confirm(approvalHash);
            pendingApprovalRef.current = null;
          }
        }
        await assertWallet();
        logOnramp("wallet.deposit.prompt", {
          sessionId,
          toChainId,
          amountRaw,
          to: executeParams.to,
        });
        const txHash = await walletClient.sendTransaction({
          account,
          chain: null,
          data: executeParams.data,
          gas: executeParams.gas,
          to: executeParams.to,
          value: executeParams.value,
        });
        // Preserve the hash before waiting: retry must check this transaction, never send a second deposit.
        pendingDepositRef.current = { sessionId, txHash, amountRaw };
        logOnramp("wallet.deposit.submitted", { sessionId, txHash, amountRaw });
        await confirm(txHash);
        markSuccess(txHash, amountRaw);
      } catch (depositError) {
        logOnramp("deposit.error", {
          sessionId,
          pending: pendingDepositRef.current,
          error: depositError,
        });
        if (controller.signal.aborted) return;
        if (
          depositError instanceof Error &&
          depositError.message === "Transaction reverted on chain."
        ) {
          pendingDepositRef.current = null;
          pendingApprovalRef.current = null;
        }
        const message = getErrorMessage(depositError);
        setDepositExecution({
          error: message,
          status: "failed",
          txHash: pendingDepositRef.current?.txHash,
        });
        onErrorRef.current?.(message);
      } finally {
        depositBusyRef.current = false;
        if (depositAbortRef.current === controller)
          depositAbortRef.current = null;
        logOnramp("deposit.run_finished", { sessionId });
      }
    },
    [
      baseUrl,
      checkWalletConnection,
      depositExecution.status,
      opportunity,
      ownerAddress,
      persistedOwnerAddress,
      nexusSDK,
      session,
      toToken,
      walletClient,
    ],
  );

  const applyOptions = React.useCallback(
    (data: OnrampOptionsResponse, fallbackCountryCode: string) => {
      cacheOnrampProviders(data.providers);
      cacheOnrampFiatMetadata(
        data.selection?.fiatCurrencyMetadata ?? data.fiatCurrencyMetadata,
      );
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

  const loadOptions = React.useCallback(
    async (signal?: AbortSignal) => {
      setOptionsLoading(true);
      setError(null);
      try {
        const loadOptionsForCountry = async (countryCodeToLoad: string) => {
          const requestedCountryCode = countryCodeToLoad.toUpperCase();
          const cached = readCachedOnrampOptions(baseUrl, requestedCountryCode);
          if (cached) {
            cacheOnrampProviders(cached.providers);
            cacheOnrampFiatMetadata(
              cached.selection?.fiatCurrencyMetadata ??
                cached.fiatCurrencyMetadata,
            );
            logOnramp("options.cache_hit", { requestedCountryCode });
            applyOptions(cached, requestedCountryCode);
          }

          try {
            const data = await fetchOnrampJson<OnrampOptionsResponse>(
              baseUrl,
              `/api/v1/onramp/options?countryCode=${encodeURIComponent(
                requestedCountryCode,
              )}`,
              { method: "GET", signal },
            );
            cacheOnrampProviders(data.providers);
            cacheOnrampFiatMetadata(
              data.selection?.fiatCurrencyMetadata ?? data.fiatCurrencyMetadata,
            );
            cacheOnrampPaymentMethods(
              data.selection?.paymentMethods ??
                data.paymentMethods ??
                data.paymentMethodMetadata,
            );
            writeCachedOnrampOptions(baseUrl, requestedCountryCode, data);

            const selectedCountryCode =
              data.selection?.countryCode?.toUpperCase();
            if (
              selectedCountryCode &&
              selectedCountryCode !== requestedCountryCode &&
              isCountryInOptionsList(data, selectedCountryCode)
            ) {
              writeCachedOnrampOptions(baseUrl, selectedCountryCode, data);
            }

            return { data, requestedCountryCode };
          } catch (fetchError) {
            if (cached) {
              logOnramp("options.refresh_failed_using_cache", {
                error: fetchError,
                requestedCountryCode,
              });
              return { data: cached, requestedCountryCode };
            }
            throw fetchError;
          }
        };

        const resolvedCountryCode =
          userSelectedCountryRef.current ||
          (await resolveOnrampCountryCode(signal));
        signal?.throwIfAborted();
        logOnramp("country.resolved", { countryCode: resolvedCountryCode });
        let { data, requestedCountryCode } =
          await loadOptionsForCountry(resolvedCountryCode);

        if (!isCountryInOptionsList(data, requestedCountryCode)) {
          const fallbackCountryCode =
            getUnsupportedCountryFallbackCode(baseUrl);
          if (fallbackCountryCode !== requestedCountryCode) {
            const fallbackOptions =
              await loadOptionsForCountry(fallbackCountryCode);
            data = fallbackOptions.data;
            requestedCountryCode = fallbackOptions.requestedCountryCode;
          }
        }

        signal?.throwIfAborted();
        applyOptions(data, requestedCountryCode);
      } catch (requestError) {
        if (signal?.aborted) return;
        const message = getErrorMessage(requestError);
        setError(message);
        onErrorRef.current?.(message);
      } finally {
        if (!signal?.aborted) setOptionsLoading(false);
      }
    },
    [applyOptions, baseUrl],
  );

  React.useEffect(() => {
    let controller: AbortController | null = new AbortController();
    void loadOptions(controller.signal);

    let lastComebackAt = Date.now();
    const handleComeback = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      const now = Date.now();
      if (now - lastComebackAt < 3000) return;
      lastComebackAt = now;
      controller?.abort();
      controller = new AbortController();
      void loadOptions(controller.signal);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleComeback);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleComeback);
    }

    return () => {
      controller?.abort();
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleComeback);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleComeback);
      }
    };
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
    setFailedQuoteRequest((current) =>
      current && current.key !== quoteRequestKey ? null : current,
    );
  }, [quoteRequestKey]);

  React.useEffect(() => {
    if (activeSheet !== "country") setCountrySearch("");
    if (activeSheet !== "currency") setCurrencySearch("");
    if (activeSheet !== "method") setMethodSearch("");
    if (activeSheet !== "partner") setPartnerSearch("");
  }, [activeSheet]);

  React.useEffect(() => {
    quotesLoadingRef.current = quotesLoading;
  }, [quotesLoading]);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loadForex = async () => {
      const rates = await fetchOnrampForexRates(controller.signal);
      if (!cancelled && rates && Object.keys(rates).length > 0) {
        setForexRates(rates);
      }
    };
    void loadForex();
    return () => {
      controller.abort();
      cancelled = true;
    };
  }, []);

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
    const controller = new AbortController();

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
          { method: "GET", signal: controller.signal },
        );
        if (cancelled || routeRunIdRef.current !== routeRunId) return;
        const nextRoutes: OnrampRoute[] = (
          Array.isArray(data) ? data : (data.routes ?? [])
        ).map((route: any) => ({
          ...route,
          provider: route.provider ?? route.partner,
          paymentMethods: route.paymentMethods?.map((method: any) => ({
            ...method,
            method: method.method ?? method.name,
          })),
        }));
        for (const route of nextRoutes) {
          cacheOnrampPaymentMethods(route.paymentMethods);
        }
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
        onErrorRef.current?.(message);
      } finally {
        if (!cancelled && routeRunIdRef.current === routeRunId) {
          setRoutesLoading(false);
        }
      }
    };

    void loadRoutes();
    return () => {
      controller.abort();
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
    rateRequestKey,
    sourceCurrencyCode,
  ]);

  const fetchQuotes = React.useCallback(async () => {
    if (
      !countryCode ||
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

    quoteAbortRef.current?.abort();
    const controller = new AbortController();
    quoteAbortRef.current = controller;
    const runId = quoteRunIdRef.current + 1;
    quoteRunIdRef.current = runId;
    setQuotesLoading(true);
    setFailedQuoteRequest(null);
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
            walletAddress: quoteWalletAddress,
          }),
          method: "POST",
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted || quoteRunIdRef.current !== runId) return;
      const nextQuotes = sortQuotes(
        (data.quotes ?? []).map((quote: any) => ({
          ...quote,
          provider: quote.provider ?? quote.serviceProvider,
          destinationAmount: String(quote.destinationAmount),
          sourceAmount: String(quote.sourceAmount),
          rampScore: quote.rampScore ?? quote.rampIntelligence?.rampScore,
          lowKyc: quote.lowKyc ?? quote.rampIntelligence?.lowKyc,
          fees: quote.fees ?? {
            total: quote.totalFee,
            network: quote.networkFee,
            provider: quote.transactionFee,
            partner: quote.partnerFee,
          },
        })),
      );
      setQuotesRequestKey(quoteRequestKey);
      setQuotes(nextQuotes);
      setSelectedProvider(nextQuotes[0]?.provider ?? "");
      if (nextQuotes.length === 0) {
        setError(
          "No local currency rates are available for this token and currency. Choose another deposit token or pay with wallet.",
        );
      }
    } catch (requestError) {
      if (controller.signal.aborted || quoteRunIdRef.current !== runId) return;
      const isTerminalError = isTerminalOnrampRateError(requestError);
      const message = isTerminalError
        ? getRequestErrorMessage(requestError)
        : ONRAMP_GENERIC_QUOTE_ERROR_MESSAGE;
      if (isTerminalError) {
        setBlockedRateRequest({ key: rateRequestKey, message });
      }
      setFailedQuoteRequest({ key: quoteRequestKey, message });
      setQuotesRequestKey("");
      setQuotes([]);
      setError(message);
      onErrorRef.current?.(message);
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
    parsedSourceAmount,
    quoteRequestKey,
    quoteWalletAddress,
    rateRequestKey,
    selectedPaymentMethod,
    sourceAmount,
    sourceCurrencyCode,
  ]);

  React.useEffect(() => {
    if (session?.sessionId) return;
    if (
      !sourceCurrencyCode ||
      !destinationRequestDetails.destinationCurrencyCode ||
      !selectedPaymentMethod ||
      !parsedSourceAmount?.gt(0) ||
      amountLimitMessage ||
      isDestinationTokenUnsupported
    ) {
      lastQuoteRequestKeyRef.current = "";
      setQuotesRequestKey("");
      setQuotes([]);
      return;
    }
    if (failedQuoteRequest?.key === quoteRequestKey) {
      lastQuoteRequestKeyRef.current = quoteRequestKey;
      setError(failedQuoteRequest.message);
      setQuotesLoading(false);
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
    failedQuoteRequest,
    isDestinationTokenUnsupported,
    parsedSourceAmount,
    quoteRequestKey,
    selectedPaymentMethod,
    session?.sessionId,
    sourceCurrencyCode,
  ]);

  React.useEffect(() => {
    if (session?.sessionId || !selectedQuote || sessionLoading) {
      setQuoteRefreshSeconds(0);
      setQuoteRefreshProgress(0);
      return;
    }
    let cycleStartedAt = Date.now();

    const updateRefreshCountdown = () => {
      const elapsed = Date.now() - cycleStartedAt;
      const remainingMs = Math.max(0, QUOTE_REFRESH_MS - elapsed);
      setQuoteRefreshSeconds(Math.ceil(remainingMs / 1000));
      setQuoteRefreshProgress(remainingMs / QUOTE_REFRESH_MS);

      if (remainingMs > 0 || quotesLoadingRef.current) return;
      cycleStartedAt = Date.now();
      setQuoteRefreshSeconds(QUOTE_REFRESH_SECONDS);
      setQuoteRefreshProgress(1);
      void fetchQuotes();
    };

    setQuoteRefreshSeconds(QUOTE_REFRESH_SECONDS);
    setQuoteRefreshProgress(1);
    updateRefreshCountdown();
    const interval = window.setInterval(() => {
      updateRefreshCountdown();
    }, 250);
    return () => {
      window.clearInterval(interval);
    };
  }, [fetchQuotes, selectedQuote, session?.sessionId, sessionLoading]);

  React.useEffect(() => {
    if (session?.sessionId && sessionHistoryRef.current) {
      sessionUpdateRef.current?.({ ...sessionHistoryRef.current, session });
    }
  }, [session]);

  React.useEffect(() => {
    const derivedSessionState =
      depositExecution.status === "running"
        ? "COMPLETING_DEPOSIT"
        : depositExecution.status === "success"
          ? "DEPOSIT_SUCCESS"
          : depositExecution.status === "failed"
            ? "DEPOSIT_FAILED"
            : normalizedSessionState ||
              (sessionCallbackReceived
                ? "ONRAMP_CALLBACK_RECEIVED"
                : "AWAITING_USER");
    logOnramp("ui.state", {
      sessionId: session?.sessionId,
      paymentState: normalizedSessionState,
      depositState: depositExecution.status,
      derivedSessionState,
    });
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
    const currentId = sessionRef.current?.sessionId;
    if (!currentId) return;
    if (
      payload !== ONRAMP_CALLBACK_SUCCESS_MESSAGE &&
      (!isOnrampCallbackPayload(payload) || payload.sessionId !== currentId)
    )
      return;
    // Redirects/postMessages only wake the authoritative status check.
    logOnramp("provider.return", { sessionId: currentId });
    setSessionCallbackReceived(true);
    setError(null);
    refreshSessionRef.current?.();
  }, []);

  const applyManualOnrampSessionId = React.useCallback(
    (sessionId: string) => {
      const normalizedSessionId = sessionId.trim();
      if (!normalizedSessionId) return;
      if (depositBusyRef.current || pendingDepositRef.current) return;
      logOnramp("session.manual_resume", { sessionId: normalizedSessionId });
      sessionHistoryRef.current = {
        ownerAddress: ownerRef.current ?? persistedOwnerAddress ?? "",
        context: { chainId: toToken?.chainId, tokenSymbol: toToken?.symbol },
      };
      sessionQuoteRef.current = null;
      setSessionCallbackReceived(true);
      setSession({
        sessionId: normalizedSessionId,
        state: "AWAITING_USER",
      });
      setError(null);
    },
    [persistedOwnerAddress, toToken?.chainId, toToken?.symbol],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !==
        new URL(getOnrampReturnUrl(), window.location.href).origin
      )
        return;
      if (event.data === ONRAMP_CALLBACK_SUCCESS_MESSAGE) {
        try {
          (event.source as Window | null)?.postMessage(
            ONRAMP_CALLBACK_SUCCESS_ACK_MESSAGE,
            event.origin,
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

  const paymentTerminal = isOnrampTerminalState(normalizedSessionState);
  React.useEffect(() => {
    const sessionId = session?.sessionId;
    if (!sessionId || paymentTerminal) return;
    let previousState = sessionRef.current?.state;
    const startedAt = Date.now();
    logOnramp("poll.start", {
      sessionId,
      baseUrl,
      intervalMs: ONRAMP_SESSION_POLL_MS,
    });
    const poller = startOnrampPolling({
      fetchSession: (signal) =>
        fetchOnrampJson<unknown>(
          baseUrl,
          `/api/v1/onramp/sessions/${encodeURIComponent(sessionId)}`,
          { method: "GET", signal },
        ),
      onData: (payload) => {
        const data = normalizeOnrampSession(payload, sessionId);
        const terminal = isOnrampTerminalState(data.state);
        logOnramp("poll.status", {
          sessionId,
          previousState,
          state: data.state,
          rawMeldStatus: data.rawMeldStatus,
          transaction: data.transaction,
          providerUpdatedAt: data.updatedAt,
          elapsedMs: Date.now() - startedAt,
          terminal,
        });
        previousState = data.state;
        setSession((current) =>
          current?.sessionId === sessionId
            ? mergeOnrampSession(current, data)
            : current,
        );
        setError(null);
        return terminal;
      },
      onError: (requestError) => {
        logOnramp("poll.retry", { sessionId, error: requestError });
        setError(
          "Unable to refresh payment status. Retrying automatically; keep this page open.",
        );
      },
      intervalMs: ONRAMP_SESSION_POLL_MS,
    });
    refreshSessionRef.current = poller.refresh;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      logOnramp("poll.wake", { sessionId });
      void poller.refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      poller.stop();
      if (refreshSessionRef.current === poller.refresh)
        refreshSessionRef.current = null;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      logOnramp("poll.stop", { sessionId, elapsedMs: Date.now() - startedAt });
    };
  }, [baseUrl, paymentTerminal, session?.sessionId]);

  React.useEffect(() => {
    logOnramp("flow.mounted", {
      baseUrl,
      environment: getOnrampRuntimeEnvironment(baseUrl),
    });
    return () => {
      depositAbortRef.current?.abort();
      quoteAbortRef.current?.abort();
      createSessionAbortRef.current?.abort();
      quoteRunIdRef.current += 1;
      routeRunIdRef.current += 1;
      logOnramp("flow.cleanup", {
        sessionId: sessionRef.current?.sessionId,
        pending: pendingDepositRef.current,
      });
    };
  }, [baseUrl]);

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
      !hasConnectedWallet ||
      depositExecution.status !== "idle"
    ) {
      return;
    }
    void executeOnrampDeposit();
  }, [
    depositExecution.status,
    hasConnectedWallet,
    executeOnrampDeposit,
    normalizedSessionState,
    session?.sessionId,
  ]);

  const createSession = async () => {
    if (
      !selectedQuote ||
      !hasConnectedWallet ||
      !ownerAddress ||
      !selectedPaymentMethod ||
      isDestinationTokenUnsupported
    ) {
      return;
    }
    if (
      sessionLoading ||
      depositBusyRef.current ||
      createSessionAbortRef.current
    )
      return;
    const controller = new AbortController();
    createSessionAbortRef.current = controller;
    setSessionLoading(true);
    setError(null);
    setSessionCallbackReceived(false);
    depositExecutionSessionRef.current = "";
    setDepositExecution({ status: "idle" });
    quoteAbortRef.current?.abort();
    quoteRunIdRef.current += 1;
    const providerWindow = openOnrampProviderWindow();
    if (!providerWindow) {
      createSessionAbortRef.current = null;
      setSessionLoading(false);
      setError(
        "Payment provider popup was blocked. Allow popups and try again.",
      );
      return;
    }
    try {
      const liveAccount = await checkWalletConnection();
      controller.signal.throwIfAborted();
      if (liveAccount?.toLowerCase() !== ownerAddress.toLowerCase()) {
        providerWindow.close();
        setError(
          "Connect your wallet and wait for a refreshed quote before paying.",
        );
        return;
      }
      logOnramp("session.create", {
        baseUrl,
        environment: getOnrampRuntimeEnvironment(baseUrl),
        provider: selectedQuote.provider,
        destination: destinationRequestDetails,
        ownerAddress,
        returnUrl: getOnrampReturnUrl(),
      });
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
          signal: controller.signal,
        },
      );
      controller.signal.throwIfAborted();
      const normalized = normalizeOnrampSession(data);
      if (!normalized.sessionId)
        throw new Error(
          "Payment session ID was not returned. Unable to track this payment.",
        );
      sessionHistoryRef.current = {
        ownerAddress,
        context: {
          chainId: toToken?.chainId,
          tokenSymbol: toToken?.symbol,
          destinationAmount: selectedQuote.destinationAmount,
          sourceAmount: selectedQuote.sourceAmount,
          sourceCurrencyCode: selectedQuote.sourceCurrencyCode,
          provider: selectedQuote.provider,
          paymentMethodType: selectedPaymentMethod,
        },
      };
      sessionQuoteRef.current = selectedQuote;
      // Save before navigating the provider window so pending purchases survive closing the widget.
      sessionUpdateRef.current?.({
        ...sessionHistoryRef.current,
        session: normalized,
      });
      setSession(normalized);
      pendingApprovalRef.current = null;
      remainingDepositRef.current = null;
      logOnramp("session.created", normalized);
      const widgetUrl = normalized.widgetUrl ?? normalized.fallbackWidgetUrl;
      if (widgetUrl) {
        logOnramp("provider.open", {
          sessionId: normalized.sessionId,
          origin: new URL(widgetUrl).origin,
        });
        providerWindow.location.href = widgetUrl;
      } else {
        providerWindow.close();
        setError("Payment provider URL was not returned. Try again.");
      }
    } catch (requestError) {
      providerWindow?.close();
      if (controller.signal.aborted) return;
      const message = getRequestErrorMessage(requestError);
      setError(message);
      onErrorRef.current?.(message);
    } finally {
      if (!controller.signal.aborted) setSessionLoading(false);
      if (createSessionAbortRef.current === controller)
        createSessionAbortRef.current = null;
    }
  };

  const handlePrimaryAction = async () => {
    if (!hasConnectedWallet) {
      await reconnectWallet();
      return;
    }
    await createSession();
  };

  const reconnectWallet = async () => {
    if (walletActionPending) return;
    setWalletActionPending(true);
    setError(null);
    logOnramp("wallet.connect_requested", { sessionId: session?.sessionId });
    try {
      await onConnectWallet();
      await checkWalletConnection();
    } catch (connectionError) {
      const message = getErrorMessage(connectionError);
      setError(message);
      onErrorRef.current?.(message);
    } finally {
      setWalletActionPending(false);
    }
  };

  const resetSession = () => {
    if (depositBusyRef.current) return;
    logOnramp("session.reset", { sessionId: session?.sessionId });
    pendingDepositRef.current = null;
    remainingDepositRef.current = null;
    pendingApprovalRef.current = null;
    setError(null);
    setSessionCallbackReceived(false);
    depositExecutionSessionRef.current = "";
    setDepositExecution({ status: "idle" });
    setSession(null);
  };

  const completeSession = () => {
    if (depositBusyRef.current) return;
    logOnramp("session.done", {
      sessionId: session?.sessionId,
      depositExecution,
    });
    pendingDepositRef.current = null;
    remainingDepositRef.current = null;
    pendingApprovalRef.current = null;
    setError(null);
    setSessionCallbackReceived(false);
    depositExecutionSessionRef.current = "";
    setDepositExecution({ status: "idle" });
    setQuotes([]);
    setSelectedProvider("");
    setSession(null);
    setSourceAmount("");
  };

  const handleCountrySelect = React.useCallback(
    async (nextCountryCode: string) => {
      const normalizedCountryCode = nextCountryCode.toUpperCase();
      if (!normalizedCountryCode) return;
      setActiveSheet(null);
      if (normalizedCountryCode === countryCode.toUpperCase()) return;

      logOnramp("selection.country", { countryCode: normalizedCountryCode });
      userSelectedCountryRef.current = normalizedCountryCode;
      writeOnrampCache(
        ONRAMP_USER_COUNTRY_CACHE_KEY,
        normalizedCountryCode,
        ONRAMP_USER_COUNTRY_CACHE_TTL_MS,
      );
      setCountryCode(normalizedCountryCode);

      const cached = readCachedOnrampOptions(baseUrl, normalizedCountryCode);
      if (cached) {
        cacheOnrampProviders(cached.providers);
        cacheOnrampFiatMetadata(
          cached.selection?.fiatCurrencyMetadata ??
            cached.fiatCurrencyMetadata,
        );
        setOptions(cached);
        const nextFiat = getDefaultFiatCurrencyCode(cached);
        setSourceCurrencyCode(nextFiat);
      }

      setSelectedPaymentMethod("");
      setSelectedProvider("");
      setQuotes([]);
      setRoutes([]);
      setBlockedRateRequest(null);
      setFailedQuoteRequest(null);
      setDepositExecution({ status: "idle" });
      setSession(null);
      setGasShortfallInfo(null);

      setOptionsLoading(true);
      try {
        const data = await fetchOnrampJson<OnrampOptionsResponse>(
          baseUrl,
          `/api/v1/onramp/options?countryCode=${encodeURIComponent(
            normalizedCountryCode,
          )}`,
        );
        cacheOnrampProviders(data.providers);
        cacheOnrampFiatMetadata(
          data.selection?.fiatCurrencyMetadata ?? data.fiatCurrencyMetadata,
        );
        cacheOnrampPaymentMethods(
          data.selection?.paymentMethods ??
            data.paymentMethods ??
            data.paymentMethodMetadata,
        );
        writeCachedOnrampOptions(baseUrl, normalizedCountryCode, data);

        const selectedCode = data.selection?.countryCode?.toUpperCase();
        if (
          selectedCode &&
          selectedCode !== normalizedCountryCode &&
          isCountryInOptionsList(data, selectedCode)
        ) {
          writeCachedOnrampOptions(baseUrl, selectedCode, data);
        }

        setOptions(data);
        const mappedFiat = getDefaultFiatCurrencyCode(data);
        setSourceCurrencyCode(mappedFiat);
      } catch (fetchError) {
        if (!cached) {
          const message = getErrorMessage(fetchError);
          setError(message);
          onErrorRef.current?.(message);
        }
      } finally {
        setOptionsLoading(false);
      }
    },
    [baseUrl, countryCode],
  );

  const handleCurrencySelect = (currencyCode: string) => {
    logOnramp("selection.currency", { currencyCode });
    setSourceCurrencyCode(currencyCode);
    setSelectedPaymentMethod("");
    setSelectedProvider("");
    setQuotes([]);
    setRoutes([]);
    setActiveSheet(null);
  };

  const handleDestinationTokenSelect = (token: SwapTokenOption) => {
    logOnramp("selection.destination", {
      chainId: token.chainId,
      address: token.contractAddress,
    });
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
    logOnramp("selection.provider", {
      provider: option.provider,
      paymentMethod: option.paymentMethodType,
    });
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

  const receiveFiatSubtitle = React.useMemo(() => {
    if (!receiveAmount) return "$0.00 USD";
    const usdDisplay = formatUsdDisplay(receiveUsd);
    const upperCurrency = sourceCurrencyCode.toUpperCase();
    if (!upperCurrency || upperCurrency === "USD") {
      return usdDisplay;
    }

    // Try converting USD to selected fiat currency using live forex rate
    let fiatAmount: Decimal | null = null;
    const rate = forexRates[upperCurrency];
    if (rate && typeof rate === "number" && rate > 0) {
      const parsedUsd = parseDecimal(receiveUsd);
      if (parsedUsd) {
        fiatAmount = parsedUsd.mul(rate);
      }
    }

    // Fallback: estimate from quote (sourceAmount minus fees)
    if (!fiatAmount && selectedQuote?.sourceAmount) {
      const sourceDec = parseDecimal(selectedQuote.sourceAmount);
      const feeDec = parseDecimal(selectedQuote.fees?.total) ?? new Decimal(0);
      if (sourceDec && sourceDec.gt(0)) {
        fiatAmount = Decimal.max(0, sourceDec.minus(feeDec));
      }
    }

    if (fiatAmount && fiatAmount.gt(0)) {
      const formattedFiat = formatCurrencyAmount(fiatAmount, upperCurrency, 2);
      return `${usdDisplay} ≈ ${formattedFiat}`;
    }

    return usdDisplay;
  }, [
    forexRates,
    receiveAmount,
    receiveUsd,
    selectedQuote?.fees?.total,
    selectedQuote?.sourceAmount,
    sourceCurrencyCode,
  ]);

  const tokenCostFiatValue = React.useMemo(() => {
    if (!receiveAmount) return null;
    if (selectedQuote?.sourceAmount) {
      const sourceDec = parseDecimal(selectedQuote.sourceAmount);
      const feeDec = parseDecimal(selectedQuote.fees?.total) ?? new Decimal(0);
      if (sourceDec && sourceDec.gt(0)) {
        return Decimal.max(0, sourceDec.minus(feeDec));
      }
    }

    const upperCurrency = sourceCurrencyCode.toUpperCase();
    const parsedUsd = parseDecimal(receiveUsd);
    if (!parsedUsd || parsedUsd.lte(0)) return null;

    if (!upperCurrency || upperCurrency === "USD") {
      return parsedUsd;
    }

    const rate = forexRates[upperCurrency];
    if (rate && typeof rate === "number" && rate > 0) {
      return parsedUsd.mul(rate);
    }

    return null;
  }, [
    forexRates,
    receiveAmount,
    receiveUsd,
    selectedQuote?.fees?.total,
    selectedQuote?.sourceAmount,
    sourceCurrencyCode,
  ]);

  const activeQuoteRequestFailure =
    failedQuoteRequest?.key === quoteRequestKey ? failedQuoteRequest : null;
  const hasRouteDetails = Boolean(
    selectedPaymentMethodDetails || selectedPaymentMethod || displayProvider,
  );
  const rateRequestLoading = routesLoading || quotesLoading;
  const fetchingBestRates =
    hasPositiveSourceAmount &&
    !selectedQuote &&
    !amountLimitMessage &&
    !error &&
    !activeQuoteRequestFailure &&
    !destinationTokenUnsupportedMessage &&
    Boolean(destinationRequestDetails.destinationCurrencyCode) &&
    (rateRequestLoading || Boolean(selectedPaymentMethod));
  const ctaRateLoading =
    !error &&
    !activeQuoteRequestFailure &&
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
    !hasPositiveSourceAmount ||
    !selectedQuote ||
    Boolean(destinationTokenUnsupportedMessage) ||
    Boolean(amountLimitMessage) ||
    ctaRateLoading ||
    sessionLoading ||
    walletActionPending ||
    (!hasConnectedWallet && walletChecking);

  if (session?.sessionId) {
    return (
      <>
        {error && (
          <div
            role="status"
            style={{ ...compactBodyStyle, marginBottom: "12px" }}
          >
            {error}
          </div>
        )}
        {normalizedSessionState === "TWO_FA_REQUIRED" && (
          <div
            role="status"
            style={{ ...compactBodyStyle, marginBottom: "12px" }}
          >
            Complete the verification in the payment provider window to
            continue.
          </div>
        )}
        <OnrampSessionStatusPanel
          hasConnectedWallet={hasConnectedWallet}
          walletChecking={walletChecking || walletActionPending}
          onConnectWallet={() => void reconnectWallet()}
          depositExecution={depositExecution}
          gasShortfallInfo={gasShortfallInfo}
          onCancel={resetSession}
          onDone={completeSession}
          onRetryDeposit={() => void executeOnrampDeposit(true)}
          onRetryPayment={resetSession}
          opportunity={opportunity}
          primaryButtonForeground={primaryButtonForeground}
          quote={sessionQuoteRef.current ?? selectedQuote}
          session={session}
          sessionCallbackReceived={sessionCallbackReceived}
          sourceAmount={sourceAmount}
          sourceCurrencyCode={sourceCurrencyCode}
          toToken={toToken}
        />
      </>
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
      <div
        style={{
          alignItems: "center",
          alignSelf: "flex-end",
          display: "flex",
          gap: "8px",
          height: "32px",
          marginTop: "-48px",
          marginBottom: "4px",
          position: "relative",
          zIndex: 20,
        }}
      >
        {shouldShowQuoteTimer && (
          <div
            style={{
              alignItems: "center",
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
              paddingInline: "10px",
              pointerEvents: "none",
            }}
          >
            {quotesLoading || routesLoading ? (
              <Loader2
                className="animate-spin"
                size={16}
                style={NEXUS_WIDGET_FAST_SPINNER_STYLE}
              />
            ) : (
              <OnrampQuoteCountdownIcon progress={quoteRefreshProgress} />
            )}
            {quotesLoading || routesLoading ? "..." : `${quoteRefreshSeconds}s`}
          </div>
        )}

        <button
          aria-label="Select country"
          onClick={() =>
            setActiveSheet((prev) => (prev === "country" ? null : "country"))
          }
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: "9px",
            boxShadow: theme.shadows.iconButton,
            boxSizing: "border-box",
            cursor: "pointer",
            display: "flex",
            gap: "6px",
            height: "32px",
            justifyContent: "center",
            paddingInline: "8px",
          }}
          type="button"
        >
          <CountryMark
            countryCode={countryCode}
            flagUrl={selectedCountryFlagUrl}
            size={20}
          />
          <ChevronDown
            aria-hidden="true"
            color={theme.colors.icon}
            size={15}
            strokeWidth={1.8}
          />
        </button>
      </div>

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
                {receiveAmount
                  ? formatPlainNumberDisplay(receiveAmount, 6)
                  : "0"}
              </div>
              <div
                style={{
                  color: theme.colors.textSubtle,
                  fontFamily: theme.fonts.sans,
                  fontSize: "14px",
                  lineHeight: "18px",
                }}
              >
                {receiveFiatSubtitle}
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
                <MethodMark
                  alt={
                    selectedPaymentMethodDetails?.name ??
                    getMethodLabel(selectedPaymentMethod)
                  }
                  logo={selectedPaymentMethodDetails?.logo}
                  method={selectedPaymentMethod}
                />
                <div
                  style={{
                    color: theme.colors.textStrong,
                    fontFamily: theme.fonts.sans,
                    fontSize: "15px",
                    fontWeight: 500,
                    lineHeight: "19px",
                  }}
                >
                  {selectedPaymentMethodDetails?.name ??
                    getMethodLabel(selectedPaymentMethod)}
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
        onClick={() => void handlePrimaryAction()}
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
        {sessionLoading ||
        ctaRateLoading ||
        walletActionPending ||
        (!hasConnectedWallet && walletChecking) ? (
          <Loader2
            className="animate-spin"
            size={16}
            style={NEXUS_WIDGET_FAST_SPINNER_STYLE}
          />
        ) : selectedQuote && hasConnectedWallet ? (
          <ExternalLink aria-hidden="true" size={16} strokeWidth={1.8} />
        ) : null}
        {walletActionPending
          ? "Connecting wallet..."
          : !hasConnectedWallet && walletChecking
            ? "Checking wallet..."
            : sessionLoading
              ? "Opening provider..."
              : ctaRateLoading
                ? "Fetching best rates..."
                : destinationTokenUnsupportedMessage
                  ? "Token not supported"
                  : selectedQuote
                    ? hasConnectedWallet
                      ? `Pay ${formatCurrencyAmount(sourceAmount, sourceCurrencyCode)}`
                      : "Connect Wallet"
                    : "Enter amount"}
      </button>

      {activeSheet === "fees" && (
        <Sheet
          onClose={() => setActiveSheet(null)}
          title={`Buying ${formatPlainNumberDisplay(receiveAmount, 6)} ${toToken?.symbol ?? ""}`}
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
            <div
              style={{
                alignItems: "center",
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
                {receiveAmount
                  ? `Cost of ${formatPlainNumberDisplay(receiveAmount, 6)} ${toToken?.symbol ?? ""}`.trim()
                  : `Cost of ${toToken?.symbol ?? "tokens"}`}
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
                {tokenCostFiatValue
                  ? formatCurrencyAmount(tokenCostFiatValue, sourceCurrencyCode)
                  : "--"}
              </span>
            </div>
            {[
              [
                selectedQuote?.provider
                  ? `${getProviderLabel(selectedQuote.provider)} fee`
                  : "Provider fee",
                selectedQuote?.fees?.provider,
              ],
              ["Network fee", selectedQuote?.fees?.network],
              ["Partner fee", selectedQuote?.fees?.partner],
            ].map(([label, value]) => (
              <div
                key={label}
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
                  ? [
                      option.paymentMethod?.name ??
                        getMethodLabel(option.paymentMethodType),
                      methodSubtitle,
                    ]
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
                        ? `${formatPlainNumberDisplay(option.destinationAmount, 6)} ${toToken?.symbol ?? ""}`
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

      {activeSheet === "country" && (
        <Sheet onClose={() => setActiveSheet(null)} title="Select country">
          <SheetSearchInput
            onChange={setCountrySearch}
            placeholder="Search country"
            value={countrySearch}
          />
          <div style={sectionLabelStyle}>Supported countries</div>
          {filteredCountries.length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {filteredCountries.map((country) => (
                <SelectRow
                  icon={
                    <CountryMark
                      countryCode={country.countryCode}
                      flagUrl={country.flagUrl}
                      size={32}
                    />
                  }
                  key={country.countryCode}
                  onClick={() => {
                    void handleCountrySelect(country.countryCode);
                    setCountrySearch("");
                  }}
                  selected={
                    country.countryCode.toUpperCase() ===
                    countryCode.toUpperCase()
                  }
                  subtitle={country.countryCode}
                  title={country.name}
                />
              ))}
            </div>
          ) : (
            <EmptySheetMessage>No countries found.</EmptySheetMessage>
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
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {filteredFiatCurrencies.map((currency) => (
                <SelectRow
                  icon={<CurrencyMark currency={currency} />}
                  key={currency.currencyCode}
                  onClick={() => {
                    handleCurrencySelect(currency.currencyCode);
                    setCurrencySearch("");
                  }}
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
                  icon={
                    <MethodMark
                      alt={method.name ?? getMethodLabel(method.method)}
                      logo={method.logo}
                      method={method.method}
                    />
                  }
                  key={method.method}
                  onClick={() => handleMethodSelect(method.method)}
                  selected={method.method === selectedPaymentMethod}
                  subtitle={getMethodSubtitle(method)}
                  title={method.name ?? getMethodLabel(method.method)}
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
