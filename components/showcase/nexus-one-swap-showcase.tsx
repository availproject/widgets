"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusWidget } from "@/registry/nexus-elements/nexus-one/nexus-one";
import { useAccount } from "wagmi";
import { useModal } from "connectkit";

const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const NexusWidgetSwapShowcase = () => {
  const { address } = useAccount();
  const { setOpen } = useModal();

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
        <NexusWidget
          config={{
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
          }}
          connectedAddress={address}
          onConnectClick={() => setOpen(true)}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusWidgetSwapShowcase;
