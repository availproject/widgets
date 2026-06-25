"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusWidget } from "@/registry/nexus-elements/nexus-one/nexus-one";
import { useAccount } from "wagmi";
import { useModal } from "connectkit";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const NexusWidgetTransferShowcase = () => {
  const { address } = useAccount();
  const { setOpen } = useModal();

  return (
    <ShowcaseWrapper
      type="nexus-one"
      connectLabel="Connect wallet to use Send"
    >
      <div
        className="flex w-full justify-center"
        style={{
          alignItems: "flex-start",
        }}
      >
        <NexusWidget
          config={{
            mode: "send",
            prefill: {
              token: USDC_BASE,
              chain: 8453,
              amount: "0.1",
            },
          }}
          connectedAddress={address}
          onConnectClick={() => setOpen(true)}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusWidgetTransferShowcase;
