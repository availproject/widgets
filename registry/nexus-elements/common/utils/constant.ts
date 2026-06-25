import { formatUnits, parseUnits } from "viem";

export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  BASE: 8453,
  ARBITRUM: 42_161,
  OPTIMISM: 10,
  POLYGON: 137,
  AVALANCHE: 43_114,
  SCROLL: 534_352,
  MEGAETH: 4326,
  KAIA: 8217,
  BNB: 56,
  MONAD: 143,
  HYPEREVM: 999,
  CITREA: 4114,
  SEPOLIA: 11_155_111,
  BASE_SEPOLIA: 84_532,
  ARBITRUM_SEPOLIA: 421_614,
  OPTIMISM_SEPOLIA: 11_155_420,
  POLYGON_AMOY: 80_002,
  MONAD_TESTNET: 10_143,
} as const;

interface ChainMetadata {
  blockExplorerUrls: string[];
  logo: string;
  name: string;
  nativeCurrency: {
    decimals: number;
    name: string;
    symbol: string;
  };
  rpcUrls?: string[];
}

export const CHAIN_METADATA: Record<number, ChainMetadata> = {
  [SUPPORTED_CHAINS.ETHEREUM]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/ethereum/logo.png",
    name: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://etherscan.io"],
  },
  [SUPPORTED_CHAINS.BASE]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/base/logo.png",
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://basescan.org"],
  },
  [SUPPORTED_CHAINS.ARBITRUM]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/arbitrum/logo.png",
    name: "Arbitrum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://arbiscan.io"],
  },
  [SUPPORTED_CHAINS.OPTIMISM]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/optimism/logo.png",
    name: "Optimism",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://optimistic.etherscan.io"],
  },
  [SUPPORTED_CHAINS.POLYGON]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/polygon/logo.png",
    name: "Polygon",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    blockExplorerUrls: ["https://polygonscan.com"],
  },
  [SUPPORTED_CHAINS.AVALANCHE]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/avalanche/logo.png",
    name: "Avalanche",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    blockExplorerUrls: ["https://snowtrace.io"],
  },
  [SUPPORTED_CHAINS.SCROLL]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/scroll/logo.png",
    name: "Scroll",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://scrollscan.com"],
  },
  [SUPPORTED_CHAINS.MEGAETH]: {
    logo: "https://files.availproject.org/fastbridge/megaeth/megaeth-favicon.svg",
    name: "MegaETH",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://mega.etherscan.io"],
    rpcUrls: ["https://rpcs.avail.so/megaeth"],
  },
  [SUPPORTED_CHAINS.KAIA]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/kaia/logo.png",
    name: "Kaia",
    nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 },
    blockExplorerUrls: ["https://kaiascan.io"],
    rpcUrls: ["https://rpcs.avail.so/kaia"],
  },
  [SUPPORTED_CHAINS.MONAD]: {
    logo: "https://files.availproject.org/fastbridge/monad/monad-favicon.svg",
    name: "Monad",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    blockExplorerUrls: ["https://monadscan.com"],
    rpcUrls: ["https://rpcs.avail.so/monad"],
  },
  [SUPPORTED_CHAINS.HYPEREVM]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/hyperevm/logo.png",
    name: "HyperEVM",
    nativeCurrency: { name: "Hype", symbol: "HYPE", decimals: 18 },
    blockExplorerUrls: ["https://hyperevmscan.io"],
    rpcUrls: ["https://rpcs.avail.so/hyperevm"],
  },
  [SUPPORTED_CHAINS.BNB]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/bnb/logo.png",
    name: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    blockExplorerUrls: ["https://bscscan.com"],
  },
  [SUPPORTED_CHAINS.CITREA]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/citrea/logo.png",
    name: "Citrea",
    nativeCurrency: { name: "cBTC", symbol: "cBTC", decimals: 18 },
    blockExplorerUrls: ["https://explorer.citrea.xyz"],
  },
  // Testnets
  [SUPPORTED_CHAINS.SEPOLIA]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/ethereum/logo.png",
    name: "Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
  [SUPPORTED_CHAINS.BASE_SEPOLIA]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/base/logo.png",
    name: "Base Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
  [SUPPORTED_CHAINS.ARBITRUM_SEPOLIA]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/arbitrum/logo.png",
    name: "Arbitrum Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia.arbiscan.io"],
  },
  [SUPPORTED_CHAINS.OPTIMISM_SEPOLIA]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/optimism/logo.png",
    name: "Optimism Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia-optimism.etherscan.io"],
  },
  [SUPPORTED_CHAINS.POLYGON_AMOY]: {
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/polygon/logo.png",
    name: "Polygon Amoy",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    blockExplorerUrls: ["https://amoy.polygonscan.com"],
  },
};

export const TOKEN_METADATA = {
  ETH: {
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/tokens/eth/logo.png",
  },
  USDC: {
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/tokens/usdc/logo.png",
  },
  USDT: {
    decimals: 6,
    name: "Tether USD",
    symbol: "USDT",
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/tokens/usdt/logo.png",
  },
  DAI: {
    decimals: 18,
    name: "Dai Stablecoin",
    symbol: "DAI",
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/tokens/dai/logo.png",
  },
  WBTC: {
    decimals: 8,
    name: "Wrapped BTC",
    symbol: "WBTC",
    logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/tokens/wbtc/logo.png",
  },
} as const;

export const SHORT_CHAIN_NAME: Record<number, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: "Ethereum",
  [SUPPORTED_CHAINS.BASE]: "Base",
  [SUPPORTED_CHAINS.ARBITRUM]: "Arbitrum",
  [SUPPORTED_CHAINS.OPTIMISM]: "Optimism",
  [SUPPORTED_CHAINS.POLYGON]: "Polygon",
  [SUPPORTED_CHAINS.AVALANCHE]: "Avalanche",
  [SUPPORTED_CHAINS.SCROLL]: "Scroll",
  [SUPPORTED_CHAINS.MEGAETH]: "MegaETH",
  [SUPPORTED_CHAINS.KAIA]: "Kaia",
  [SUPPORTED_CHAINS.BNB]: "BNB",
  [SUPPORTED_CHAINS.MONAD]: "Monad",
  [SUPPORTED_CHAINS.HYPEREVM]: "HyperEVM",
  [SUPPORTED_CHAINS.CITREA]: "Citrea",
  // [SUPPORTED_CHAINS.TRON]: "Tron",
  [SUPPORTED_CHAINS.SEPOLIA]: "Sepolia",
  [SUPPORTED_CHAINS.BASE_SEPOLIA]: "Base Sepolia",
  [SUPPORTED_CHAINS.ARBITRUM_SEPOLIA]: "Arbitrum Sepolia",
  [SUPPORTED_CHAINS.OPTIMISM_SEPOLIA]: "Optimism Sepolia",
  [SUPPORTED_CHAINS.POLYGON_AMOY]: "Polygon Amoy",
  [SUPPORTED_CHAINS.MONAD_TESTNET]: "Monad Testnet",
  // [SUPPORTED_CHAINS.TRON_SHASTA]: "Tron Shasta",
} as const;

export type SdkChainWithSwapSupport = {
  chain?: { id?: number | null } | null;
  id?: number | null;
  swapSupported?: boolean | null;
};

export type SdkChainListWithSwapSupport =
  | readonly SdkChainWithSwapSupport[]
  | null
  | undefined;

const getSdkChainId = (chain: SdkChainWithSwapSupport) => {
  const rawId = chain.id ?? chain.chain?.id;
  if (rawId == null) {
    return undefined;
  }

  const chainId = Number(rawId);
  return Number.isInteger(chainId) && chainId > 0 ? chainId : undefined;
};

export function getSdkSwapSupportedChainIds(
  chains: SdkChainListWithSwapSupport
): Set<number> | null {
  if (!chains?.length) {
    return null;
  }

  const hasExplicitSwapSupport = chains.some(
    (chain) => typeof chain.swapSupported === "boolean"
  );
  if (!hasExplicitSwapSupport) {
    return null;
  }

  const supportedIds = new Set<number>();
  for (const chain of chains) {
    if (chain.swapSupported !== true) {
      continue;
    }

    const chainId = getSdkChainId(chain);
    if (chainId) {
      supportedIds.add(chainId);
    }
  }

  return supportedIds;
}

export function isSwapSupportedBySdkChainList(
  chainId: number | null | undefined,
  chains: SdkChainListWithSwapSupport
): boolean {
  if (!chainId) {
    return false;
  }

  const sdkSupportedIds = getSdkSwapSupportedChainIds(chains);
  if (sdkSupportedIds) {
    return sdkSupportedIds.has(Number(chainId));
  }

  return true;
}

export function getShortChainName(
  chainId?: number,
  fallbackName?: string
): string {
  if (!chainId) {
    return fallbackName ?? "";
  }
  return SHORT_CHAIN_NAME[chainId] ?? fallbackName ?? String(chainId);
}

export const TOKEN_IMAGES: Record<string, string> = {
  BNB: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  KAIA: "https://assets.coingecko.com/asset_platforms/images/9672/large/kaia.png",
  SOPH: "https://assets.coingecko.com/coins/images/38680/large/sophon_logo_200.png",
  USDC: "https://coin-images.coingecko.com/coins/images/6319/large/usdc.png",
  USDM: "https://raw.githubusercontent.com/availproject/nexus-assets/refs/heads/main/tokens/usdm/logo.png",
  USDS: "https://assets.coingecko.com/coins/images/39926/standard/usds.webp?1726666683",
  USDT: "https://coin-images.coingecko.com/coins/images/35023/large/USDT.png",
  "USD₮0":
    "https://coin-images.coingecko.com/coins/images/35023/large/USDT.png",
  WETH: "https://assets.coingecko.com/coins/images/279/large/ethereum.png?1595348880",
};

const DEFAULT_SAFETY_MARGIN = 0.01; // 1%
const TRAILING_DECIMAL_ZERO_REGEX = /(\.\d*?[1-9])0+$/u;
const ZERO_DECIMAL_REGEX = /\.0+$/u;
const LONE_DECIMAL_POINT_REGEX = /^\.$/u;

/**
 * Compute an amount string for fraction buttons (25%, 50%, 75%, 100%).
 *
 * @param balanceStr - user's balance as a human decimal string (e.g. "12.345") OR as base-unit integer string if `balanceIsBaseUnits` true
 * @param fraction - fraction e.g. 0.25, 0.5, 0.75, 1
 * @param decimals - token decimals (6 for USDC/USDT, 18 for ETH)
 * @param safetyMargin - 0.01 for 1% default
 * @param balanceIsBaseUnits - if true, balanceStr is already base units integer string (wei / smallest unit)
 * @returns decimal string clipped to token decimals (rounded down)
 */
export function computeAmountFromFraction(
  balanceStr: string,
  fraction: number,
  decimals: number,
  safetyMargin = DEFAULT_SAFETY_MARGIN,
  balanceIsBaseUnits = false
): string {
  if (!balanceStr) {
    return "0";
  }

  // parse balance into base units (BigInt)
  const balanceUnits: bigint = balanceIsBaseUnits
    ? BigInt(balanceStr)
    : parseUnits(balanceStr, decimals);

  if (balanceUnits === BigInt(0)) {
    return "0";
  }

  // Use an integer precision multiplier to avoid FP issues
  const PREC = 1_000_000; // 1e6 precision for fraction & safety margin
  const safetyMul = BigInt(Math.max(0, Math.floor((1 - safetyMargin) * PREC))); // (1 - safetyMargin) * PREC
  const fractionMul = BigInt(Math.max(0, Math.floor(fraction * PREC))); // fraction * PREC

  // Apply safety margin: floor(balance * (1 - safetyMargin))
  const maxAfterSafety = (balanceUnits * safetyMul) / BigInt(PREC);

  // Apply fraction and floor: floor(maxAfterSafety * fraction)
  let desiredUnits = (maxAfterSafety * fractionMul) / BigInt(PREC);

  // Extra clamp just in case
  if (desiredUnits > balanceUnits) {
    desiredUnits = balanceUnits;
  }
  if (desiredUnits < BigInt(0)) {
    desiredUnits = BigInt(0);
  }

  // format back to human readable decimal string with token decimals (formatUnits truncates/keeps decimals)
  // formatUnits will produce exactly decimals digits if fractional part exists; we'll strip trailing zeros.
  const raw = formatUnits(desiredUnits, decimals);
  // strip trailing zeros and possible trailing dot
  return raw
    .replace(TRAILING_DECIMAL_ZERO_REGEX, "$1")
    .replace(ZERO_DECIMAL_REGEX, "")
    .replace(LONE_DECIMAL_POINT_REGEX, "0");
}

export const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFormatterPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/**
 * Formats USD values for UI.
 * Values between 0 and 0.001 are shown as "< $0.001".
 * Values between 0.001 and 0.01 are shown with 3 decimals.
 */
export function formatUsdForDisplay(value: number): string {
  if (!Number.isFinite(value)) {
    return usdFormatter.format(0);
  }
  const absValue = Math.abs(value);

  if (absValue === 0) {
    return usdFormatter.format(0);
  }
  if (absValue < 0.001) {
    return "< $0.001";
  }
  if (absValue < 0.01) {
    return usdFormatterPrecise.format(value);
  }

  return usdFormatter.format(value);
}

export const TOKEN_CONTRACT_ADDRESSES = {
  USDC: {
    1: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    137: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    42161: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    10: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
    534352: "0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4",
    43114: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
    56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    999: "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
    143: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    4114: "0xE045e6c36cF77FAA2CfB54466D71A3aEF7bbE839",
    11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    80002: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    10143: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    5115: "0xb669dC8cC6D044307Ba45366C0c836eC3c7e31AA",
  },
  USDT: {
    1: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    137: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
    42161: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    8217: "0xd077a400968890eacc75cdc901f0356c943e4fdb",
    10: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
    534352: "0xf55bec9cafdbe8730f096aa55dad6d22d44099df",
    43114: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
    56: "0x55d398326f99059fF775485246999027B3197955",
    999: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    4114: "0x9f3096Bac87e7F03DC09b0B416eB0DF837304dc4",
    4326: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    421614: "0xF954d4A5859b37De88a91bdbb8Ad309056FB04B1",
    11155420: "0x6462693c2F21AC0E517f12641D404895030F7426",
    10143: "0x1c56F176D6735888fbB6f8bD9ADAd8Ad7a023a0b",
  },
  USDM: {
    4326: "0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7",
  },
} as Record<string, Record<number, `0x${string}`>>;
