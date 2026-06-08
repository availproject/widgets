import { CHAIN_METADATA } from "@avail-project/nexus-core";
import { getShortChainName } from "../../common/utils/constant";
import type { SwapTokenOption } from "../components/swap-asset-selector";

export const CITREA_CHAIN_ID = 4114;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const E_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const CITREA_CHAIN_FALLBACK = {
  logo: "https://raw.githubusercontent.com/availproject/nexus-assets/main/chains/citrea/logo.png",
  name: "Citrea Mainnet",
};

export const CITREA_STABLE_SYMBOLS = [
  "ctUSD",
  "USDC.e",
  "JUSD",
  "svJUSD",
  "GUSD",
  "USDT.e",
];

export const CITREA_LOCAL_TOKENS = [
  {
    address: ZERO_ADDRESS,
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/102172844/standard/cBTC.png",
    name: "Citrea Bitcoin",
    symbol: "cBTC",
    type: "NATIVE",
  },
  {
    address: "0x3100000000000000000000000000000000000006",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/102172843/standard/cBTC.png",
    name: "Wrapped Citrea Bitcoin",
    symbol: "wcBTC",
  },
  {
    address: "0x8D82c4E3c936C7B5724A382a9c5a4E6Eb7aB6d5D",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/71615/standard/ctUSD.png",
    name: "Citrea USD",
    symbol: "ctUSD",
    type: "STABLE",
  },
  {
    address: "0xE045e6c36cF77FAA2CfB54466D71A3aEF7bbE839",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/6319/standard/USDC.png",
    name: "Bridged USDC",
    symbol: "USDC.e",
    type: "STABLE",
  },
  {
    address: "0x0987D3720D38847ac6dBB9D025B9dE892a3CA35C",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/102172725/standard/JUSD_192x192_App_Icon.png",
    name: "Juice Dollar",
    symbol: "JUSD",
    type: "STABLE",
  },
  {
    address: "0x384157027B1CDEAc4e26e3709667BB28735379Bb",
    decimals: 8,
    logo: "https://assets.coingecko.com/coins/images/102172893/standard/syBTC.png",
    name: "Symbiosis BTC",
    symbol: "syBTC",
  },
  {
    address: "0x1b70ae756b1089cc5948e4f8a2AD498DF30E897d",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/102172892/standard/JuiceDollar_Coinlogo.png",
    name: "Savings Vault JUSD",
    symbol: "svJUSD",
    type: "STABLE",
  },
  {
    address: "0xAC8c1AEB584765DB16ac3e08D4736CFcE198589B",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/71672/large/GUSD.png",
    name: "Generic Dollar",
    symbol: "GUSD",
    type: "STABLE",
  },
  {
    address: "0xDF240DC08B0FdaD1d93b74d5048871232f6BEA3d",
    decimals: 8,
    logo: "https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png",
    name: "Bridged Wrapped Bitcoin",
    symbol: "WBTC.e",
  },
  {
    address: "0x9f3096Bac87e7F03DC09b0B416eB0DF837304dc4",
    decimals: 6,
    logo: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png",
    name: "Bridged USDT",
    symbol: "USDT.e",
    type: "STABLE",
  },
] as const;

const normalizeAddress = (address?: string) => {
  const lower = address?.toLowerCase();
  if (!lower) return "";
  if (lower === E_ADDRESS) return ZERO_ADDRESS;
  return lower;
};

export const getCitreaChainMeta = () => ({
  logo: CHAIN_METADATA[CITREA_CHAIN_ID]?.logo ?? CITREA_CHAIN_FALLBACK.logo,
  name: getShortChainName(
    CITREA_CHAIN_ID,
    CHAIN_METADATA[CITREA_CHAIN_ID]?.name ?? CITREA_CHAIN_FALLBACK.name,
  ),
});

export const getCitreaReceiveTokenOptions = (): SwapTokenOption[] => {
  const chain = getCitreaChainMeta();
  return CITREA_LOCAL_TOKENS.map((token) => ({
    balance: `0 ${token.symbol}`,
    balanceInFiat: "$0.00",
    chainId: CITREA_CHAIN_ID,
    chainLogo: chain.logo,
    chainName: chain.name,
    contractAddress: token.address,
    decimals: token.decimals,
    logo: token.logo,
    name: token.name,
    symbol: token.symbol,
  }));
};

export const findCitreaReceiveToken = ({
  address,
  chainId,
  symbol,
}: {
  address?: string;
  chainId?: number;
  symbol?: string;
}): SwapTokenOption | undefined => {
  if (chainId !== CITREA_CHAIN_ID) return undefined;

  const normalizedAddress = normalizeAddress(address);
  const normalizedSymbol = symbol?.toLowerCase();

  return getCitreaReceiveTokenOptions().find((token) => {
    const addressMatches =
      normalizedAddress &&
      normalizeAddress(token.contractAddress) === normalizedAddress;
    const symbolMatches =
      normalizedSymbol && token.symbol.toLowerCase() === normalizedSymbol;
    return Boolean(addressMatches || symbolMatches);
  });
};
