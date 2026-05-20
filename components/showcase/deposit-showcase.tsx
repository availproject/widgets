"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import NexusDeposit from "@/registry/nexus-elements/deposit/nexus-deposit";
import { Abi, Address, encodeFunctionData } from "viem";
import {
  CHAIN_METADATA,
  SUPPORTED_CHAINS,
  // TOKEN_CONTRACT_ADDRESSES,
  // TOKEN_METADATA,
} from "@avail-project/nexus-core";

// const AAVE_POOL_BY_CHAIN: Partial<Record<number, Address>> = {
//   [SUPPORTED_CHAINS.BASE]: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
//   [SUPPORTED_CHAINS.MEGAETH]: "0x7e324abc5de01d112afc03a584966ff199741c28",
// };

const DepositShowcase = () => {
  const [embed, setEmbed] = React.useState(false);

  const executeDeposit = (
    tokenSymbol: string,
    tokenAddress: `0x${string}`,
    amount: bigint,
    chainId: number,
    user: Address,
  ) => {
    const contractAddress =
      "0xfb7908150b738e7dB9862007c66C9eb7850706F5" as const;
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

    const encoded = encodeFunctionData({
      abi: abi,
      functionName: "supply",
      args: [tokenAddress, amount, user, 0],
    });
    return {
      to: contractAddress,
      data: encoded,
      gasPriceSelector: "medium",
      tokenApproval: {
        token: tokenAddress,
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
        heading={"Deposit wcBTC on Zentra on Citrea"}
        destination={{
          chainId: SUPPORTED_CHAINS.CITREA,
          tokenAddress: "0x3100000000000000000000000000000000000006",
          tokenSymbol: "wcBTC",
          tokenDecimals: 18,
          tokenLogo:
            "https://assets.coingecko.com/coins/images/102172843/standard/cBTC.png?1776227743",
          label: "Deposit wcBTC on Zentra on Citrea",
          gasTokenSymbol:
            CHAIN_METADATA[SUPPORTED_CHAINS.CITREA].nativeCurrency.symbol,
          estimatedTime: "≈ 30s",
          explorerUrl:
            CHAIN_METADATA[SUPPORTED_CHAINS.CITREA].blockExplorerUrls[0],
          depositTargetLogo:
            "https://zentrafinance.gitbook.io/zentra/~gitbook/image?url=https%3A%2F%2F2899070418-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Forganizations%252F1jzW9aBSq190MuRJKgIj%252Fsites%252Fsite_2l6Ro%252Ficon%252Fb8adwB6RA7Y6VJH3vGjh%252FZentra%2520%284%29.png%3Falt%3Dmedia%26token%3D8aa44578-e817-4c2f-b20e-abd25827d4fe&width=32&dpr=3&quality=100&sign=d18163fe&sv=2",
        }}
        executeDeposit={executeDeposit}
      />
    </ShowcaseWrapper>
  );
};

export default DepositShowcase;
