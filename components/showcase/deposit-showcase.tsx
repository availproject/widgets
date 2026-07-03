"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import NexusDeposit from "@/registry/avail-widgets/deposit/nexus-deposit";
import { Abi, Address, encodeFunctionData } from "viem";
import {
  CHAIN_METADATA,
  SUPPORTED_CHAINS,
  TOKEN_CONTRACT_ADDRESSES,
  TOKEN_METADATA,
} from "@/registry/avail-widgets/common/utils/constant";

const AAVE_POOL_BY_CHAIN: Partial<Record<number, Address>> = {
  [SUPPORTED_CHAINS.BASE]: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  [SUPPORTED_CHAINS.MEGAETH]: "0x7e324abc5de01d112afc03a584966ff199741c28",
};

const DepositShowcase = () => {
  const [embed, setEmbed] = React.useState(false);

  const executeDeposit = (
    tokenSymbol: string,
    tokenAddress: `0x${string}`,
    amount: bigint,
    chainId: number,
    user: Address,
  ) => {
    const contractAddress = AAVE_POOL_BY_CHAIN[chainId];
    if (!contractAddress) {
      throw new Error(`Unsupported Aave destination chain: ${chainId}`);
    }

    const abi: Abi = [
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
    ];

    if (tokenSymbol === "ETH") {
      throw new Error(
        "ETH is native and not supported for this execute builder",
      );
    }

    const encoded = encodeFunctionData({
      abi: abi,
      functionName: "supply",
      args: [tokenAddress, amount, user, 0],
    });
    if (!encoded) {
      throw new Error("Failed to encode contract call");
    }
    return {
      to: contractAddress,
      data: encoded,
      gasPriceSelector: "medium",
      tokenApproval: {
        toTokenSymbol: tokenSymbol,
        amount,
        spender: contractAddress,
      },
    };
  };

  return (
    <ShowcaseWrapper
      type="deposit"
      connectLabel="Connect wallet to use Deposit Widget"
      toggle={true}
      toggleLabel="Embed"
      pressed={embed}
      onPressedChange={setEmbed}
    >
      <NexusDeposit
        embed={embed}
        heading={"Deposit USDC on Aave's Base Market"}
        destination={{
          chainId: SUPPORTED_CHAINS.BASE,
          tokenAddress: TOKEN_CONTRACT_ADDRESSES["USDC"][SUPPORTED_CHAINS.BASE],
          tokenSymbol: "USDC",
          tokenDecimals: 6,
          tokenLogo: TOKEN_METADATA["USDC"]?.logo,
          label: "Deposit USDC on Aave's Base Market",
          gasTokenSymbol:
            CHAIN_METADATA[SUPPORTED_CHAINS.BASE].nativeCurrency.symbol,
          estimatedTime: "≈ 30s",
          explorerUrl:
            CHAIN_METADATA[SUPPORTED_CHAINS.BASE].blockExplorerUrls[0],
          depositTargetLogo: "/aave.svg",
        }}
        executeDeposit={executeDeposit}
      />
    </ShowcaseWrapper>
  );
};

export default DepositShowcase;
