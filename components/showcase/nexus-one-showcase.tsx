"use client";
import React, { useMemo, useState } from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusOne } from "@/registry/nexus-elements/nexus-one/nexus-one";
import {
  type DepositOpportunity,
  type NexusOneConfig,
  type NexusOneMode,
} from "@/registry/nexus-elements/nexus-one/types";
import { encodeFunctionData } from "viem";
import { useAccount } from "wagmi";

const ALL_MODES: NexusOneMode[] = ["swap", "deposit", "send"];
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const AAVE_ABI = [
  {
    inputs: [
      { internalType: "address", name: "asset", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "address", name: "onBehalfOf", type: "address" },
      { internalType: "uint16", name: "referralCode", type: "uint16" },
    ],
    name: "supply",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const COMPOUND_ABI = [
  {
    inputs: [
      { internalType: "address", name: "asset", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "supply",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const FLUID_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "assets_", type: "uint256" },
      { internalType: "address", name: "receiver_", type: "address" },
    ],
    name: "deposit",
    outputs: [{ internalType: "uint256", name: "shares_", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const DEPOSIT_OPPORTUNITIES: DepositOpportunity[] = [
  {
    id: "aave-arb",
    title: "Aave",
    protocol: "Aave",
    subtitle: "USDT on Aave on Arbitrum",
    logo: "https://files.availproject.org/uploads/2026-04-16/aave.svg",
    chainId: 42161,
    tokenSymbol: "USDT",
    tokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    tokenLogo:
      "https://raw.githubusercontent.com/availproject/nexus-assets/refs/heads/main/tokens/usdt/logo.png",
    execute: (amount, connectedAddress) => ({
      to: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      data: encodeFunctionData({
        abi: AAVE_ABI,
        functionName: "supply",
        args: [
          "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
          amount,
          connectedAddress,
          0,
        ],
      }),
      gas: BigInt(300000),
      tokenApproval: {
        token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        amount,
        spender: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      },
    }),
  },
  {
    id: "aave-eth",
    title: "Aave",
    protocol: "Aave",
    subtitle: "GHO on Aave on Ethereum",
    logo: "https://files.availproject.org/uploads/2026-04-16/aave.svg",
    chainId: 1,
    tokenSymbol: "GHO",
    tokenAddress: "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f",
    tokenLogo: "https://s2.coinmarketcap.com/static/img/coins/64x64/23508.png",
    execute: (amount, connectedAddress) => ({
      to: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
      data: encodeFunctionData({
        abi: AAVE_ABI,
        functionName: "supply",
        args: [
          "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f",
          amount,
          connectedAddress,
          0,
        ],
      }),
      gas: BigInt(300000),
      tokenApproval: {
        token: "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f",
        amount,
        spender: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
      },
    }),
  },
  {
    id: "compound-pol",
    title: "Compound",
    protocol: "Compound",
    subtitle: "USDT on Compound on Polygon",
    logo: "https://files.availproject.org/uploads/2026-04-16/compound.svg",
    chainId: 137,
    tokenSymbol: "USDT",
    tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    tokenLogo:
      "https://raw.githubusercontent.com/availproject/nexus-assets/refs/heads/main/tokens/usdt/logo.png",
    execute: (amount) => ({
      to: "0xaeB318360f27748Acb200CE616E389A6C9409a07",
      data: encodeFunctionData({
        abi: COMPOUND_ABI,
        functionName: "supply",
        args: ["0xc2132D05D31c914a87C6611C10748AEb04B58e8F", amount],
      }),
      gas: BigInt(300000),
      tokenApproval: {
        token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        amount,
        spender: "0xaeB318360f27748Acb200CE616E389A6C9409a07",
      },
    }),
  },
  {
    id: "fluid-base",
    title: "Fluid",
    protocol: "Fluid",
    subtitle: "USDC on Fluid on Base",
    logo: "https://fluid.instad.app/images/logo.png",
    chainId: 8453,
    tokenSymbol: "USDC",
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    tokenLogo:
      "https://raw.githubusercontent.com/availproject/nexus-assets/refs/heads/main/tokens/usdc/logo.png",
    execute: (amount, connectedAddress) => ({
      to: "0xf42f5795D9ac7e9D757dB633D693cD548Cfd9169",
      data: encodeFunctionData({
        abi: FLUID_ABI,
        functionName: "deposit",
        args: [amount, connectedAddress],
      }),
      gas: BigInt(300000),
      tokenApproval: {
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount,
        spender: "0xf42f5795D9ac7e9D757dB633D693cD548Cfd9169",
      },
    }),
  },
];

const CONFIG_SNIPPETS: Record<NexusOneMode, string> = {
  swap: `const config = {
  mode: "swap",
  prefill: {
    source: {
      token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      chain: 42161, // Arbitrum
    },
    destination: {
      token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      chain: 8453, // Base
    },
  },
} satisfies NexusOneConfig;`,
  send: `const config = {
  mode: "send",
} satisfies NexusOneConfig;`,
  deposit: `const config = {
  mode: "deposit",
  opportunities: [
    {
      id: "aave-arb",
      title: "Aave",
      protocol: "Aave",
      subtitle: "USDT on Aave on Arbitrum",
      chainId: 42161,
      tokenSymbol: "USDT",
      tokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      execute: (amount, connectedAddress) => ({
        to: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        data: encodeFunctionData({ abi: AAVE_ABI, functionName: "supply", args: [...] }),
        gas: BigInt(300000),
        tokenApproval: {
          token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
          amount,
          spender: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        },
      }),
    },
    // Additional opportunities render as a selectable list.
  ],
} satisfies NexusOneConfig;`,
};

const NexusOneShowcase = () => {
  const [selectedMode, setSelectedMode] = useState<NexusOneMode>("swap");
  const { address } = useAccount();
  const config = useMemo<NexusOneConfig>(() => {
    if (selectedMode === "deposit") {
      return {
        mode: "deposit",
        opportunities: DEPOSIT_OPPORTUNITIES,
      };
    }

    if (selectedMode === "send") {
      return {
        mode: "send",
      };
    }

    return {
      mode: "swap",
      prefill: {
        source: {
          token: USDC_ARBITRUM,
          chain: 42161,
        },
        destination: {
          token: USDC_BASE,
          chain: 8453,
        },
      },
    };
  }, [selectedMode]);

  return (
    <div className="flex flex-col gap-y-4 w-full">
      <ShowcaseWrapper
        type="nexus-one"
        connectLabel="Connect wallet to use Nexus One"
      >
        <div
          className="flex w-full justify-center"
          style={{
            alignItems: "flex-start",
          }}
        >
          <NexusOne
            key={selectedMode}
            config={config}
            connectedAddress={address}
          />
        </div>
      </ShowcaseWrapper>

      <div className="bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-sm font-medium">Mode:</span>
          {ALL_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
                selectedMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="bg-muted/40 overflow-hidden rounded-lg border">
          <div className="text-muted-foreground border-b px-3 py-2 text-xs font-medium">
            Current config
          </div>
          <pre className="text-foreground max-h-72 overflow-auto p-3 text-xs leading-5">
            <code>{CONFIG_SNIPPETS[selectedMode]}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default NexusOneShowcase;
