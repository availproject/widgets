"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusOne } from "@/registry/nexus-elements/nexus-one/nexus-one";
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
            deposit: {
              title: "Aave",
              protocol: "Aave",
              label: "Deposit USDT on Aave on Arbitrum",
              depositTargetLogo:
                "https://files.availproject.org/uploads/2026-04-16/aave.svg",
              chainId: 42161,
              tokenSymbol: "USDT",
              tokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
              tokenDecimals: 6,
              tokenLogo:
                "https://raw.githubusercontent.com/availproject/nexus-assets/refs/heads/main/tokens/usdt/logo.png",
              executeDeposit: (
                _tokenSymbol,
                tokenAddress,
                amount,
                _chainId,
                connectedAddress,
              ) => ({
                to: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
                data: encodeFunctionData({
                  abi: AAVE_ABI,
                  functionName: "supply",
                  args: [tokenAddress, amount, connectedAddress, 0],
                }),
                tokenApproval: {
                  token: tokenAddress,
                  amount,
                  spender: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
                },
              }),
            },
          }}
          connectedAddress={address}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusOneDepositShowcase;
