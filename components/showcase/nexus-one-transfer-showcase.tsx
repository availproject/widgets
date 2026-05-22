"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusOne } from "@/registry/nexus-elements/nexus-one/nexus-one";
import { useAccount } from "wagmi";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DEFAULT_SEND_RECIPIENT = "0xF3a15b38e63dBb1a1b2d7842CcD9B9dD8fB9b2E";

const NexusOneTransferShowcase = () => {
  const { address } = useAccount();

  return (
    <ShowcaseWrapper
      type="nexus-one"
      connectLabel="Connect wallet to use Nexus One Send"
    >
      <div
        className="flex w-full justify-center"
        style={{
          alignItems: "flex-start",
        }}
      >
        <NexusOne
          config={{
            mode: "send",
            prefill: {
              token: USDC_BASE,
              chain: 8453,
              amount: "0.1",
              recipient: DEFAULT_SEND_RECIPIENT,
            },
          }}
          connectedAddress={address}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusOneTransferShowcase;
