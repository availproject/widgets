"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusOne } from "@/registry/nexus-elements/nexus-one/nexus-one";
import { SUPPORTED_CHAINS } from "@avail-project/nexus-core";
import { encodeFunctionData } from "viem";
import { useAccount } from "wagmi";

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

const MYSTIC_ABI = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
    ],
    name: "deposit",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
]

const ZENTRA_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "asset",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "onBehalfOf",
        type: "address",
      },
      {
        internalType: "uint16",
        name: "referralCode",
        type: "uint16",
      },
    ],
    name: "supply",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
]

const NexusOneDepositShowcase = () => {
  const { address } = useAccount();

  return (
    <ShowcaseWrapper
      type="nexus-one"
      connectLabel="Connect wallet to use Deposit"
    >
      <div
        className="flex w-full justify-center"
        style={{
          alignItems: "flex-start",
        }}
      >
        <NexusOne
          config={{
            mode: "deposit",
            prefill: {
              amount: "0.1",
            },
            opportunities: [
              {
                id: "aave-arb-usdt",
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
                    amount: amount,
                    spender: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
                  },
                }),
              },
              {
                id: "aave-eth-gho",
                title: "Aave",
                protocol: "Aave",
                subtitle: "GHO on Aave on Ethereum",
                logo: "https://files.availproject.org/uploads/2026-04-16/aave.svg",
                chainId: 1,
                tokenSymbol: "GHO",
                tokenAddress: "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f",
                tokenLogo:
                  "https://s2.coinmarketcap.com/static/img/coins/64x64/23508.png",
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
                    amount: amount,
                    spender: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
                  },
                }),
              },
              {
                id: "compound-pol-usdt",
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
                    amount: amount,
                    spender: "0xaeB318360f27748Acb200CE616E389A6C9409a07",
                  },
                }),
              },
              {
                id: "fluid-base-usdc",
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
                    amount: amount,
                    spender: "0xf42f5795D9ac7e9D757dB633D693cD548Cfd9169",
                  },
                }),
              },
              {
                id: "mystic-citrea-ctusd",
                title: "Mystic",
                protocol: "Mystic",
                subtitle: "ctUSD on Mystic on Citrea",
                logo: "https://files.availproject.org/nexus-elements/mystic.png",
                chainId: SUPPORTED_CHAINS.CITREA,
                tokenSymbol: "ctUSD",
                tokenAddress: "0x8D82c4E3c936C7B5724A382a9c5a4E6Eb7aB6d5D",
                tokenLogo:
                  "https://files.availproject.org/nexus-elements/ctUSD.svg",
                execute: (amount, connectedAddress) => ({
                  to: "0x72f8C254548839Fa1Db4156aE01d8C6ae5885EE4",
                  data: encodeFunctionData({
                    abi: MYSTIC_ABI,
                    functionName: "deposit",
                    args: [amount, connectedAddress],
                  }),
                  gas: BigInt(300000),
                  tokenApproval: {
                    token: "0x8D82c4E3c936C7B5724A382a9c5a4E6Eb7aB6d5D",
                    amount: amount,
                    spender: "0x72f8C254548839Fa1Db4156aE01d8C6ae5885EE4",
                  },
                }),
              },
              {
                id: "zentra-citrea-wcbtc",
                title: "Zentra",
                protocol: "Zentra",
                subtitle: "wcBTC on Zentra on Citrea",
                logo: "https://zentrafinance.gitbook.io/zentra/~gitbook/image?url=https%3A%2F%2F2899070418-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Forganizations%252F1jzW9aBSq190MuRJKgIj%252Fsites%252Fsite_2l6Ro%252Ficon%252Fb8adwB6RA7Y6VJH3vGjh%252FZentra%2520%284%29.png%3Falt%3Dmedia%26token%3D8aa44578-e817-4c2f-b20e-abd25827d4fe&width=32&dpr=3&quality=100&sign=d18163fe&sv=2",
                chainId: SUPPORTED_CHAINS.CITREA,
                tokenSymbol: "wcBTC",
                tokenAddress: "0x3100000000000000000000000000000000000006",
                tokenLogo:
                  "https://assets.coingecko.com/coins/images/102172843/standard/cBTC.png",
                execute: (amount, connectedAddress) => ({
                  to: "0xfb7908150b738e7dB9862007c66C9eb7850706F5",
                  data: encodeFunctionData({
                    abi: ZENTRA_ABI,
                    functionName: "supply",
                    args: ["0x3100000000000000000000000000000000000006", amount, connectedAddress, 0],
                  }),
                  gas: BigInt(300000),
                  tokenApproval: {
                    token: "0x3100000000000000000000000000000000000006",
                    amount: amount,
                    spender: "0xfb7908150b738e7dB9862007c66C9eb7850706F5",
                  },
                }),
              },
            ],
          }}
          connectedAddress={address}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusOneDepositShowcase;
