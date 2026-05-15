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

const NexusOneDepositShowcase = () => {
  const { address } = useAccount();

  return (
    <ShowcaseWrapper
      type="nexus-one"
      connectLabel="Connect wallet to use Nexus One Deposit"
    >
      <div
        className="flex w-full justify-center"
        style={{
          alignItems: "flex-start",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        <NexusOne
          config={{
            mode: "deposit",
            opportunities: [
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
                    amount: amount,
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
                    amount: amount,
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
                    amount: amount,
                    spender: "0xf42f5795D9ac7e9D757dB633D693cD548Cfd9169",
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
