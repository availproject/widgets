"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusOne } from "@/registry/nexus-elements/nexus-one/nexus-one";
import { useAccount } from "wagmi";

const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const NexusOneShowcase = () => {
  const { address } = useAccount();

  return (
    <ShowcaseWrapper
      type="nexus-one"
      connectLabel="Connect wallet to use Swap and Bridge"
    >
      <div
        className="flex w-full justify-center"
        style={{
          alignItems: "flex-start",
        }}
      >
        <NexusOne
          config={{
            mode: "swap",
            prefill: {
              amount: "1",
              source: {
                token: USDC_ARBITRUM,
                chain: 42161,
              },
              destination: {
                token: USDC_BASE,
                chain: 8453,
              },
            },
          }}
          connectedAddress={address}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusOneShowcase;
