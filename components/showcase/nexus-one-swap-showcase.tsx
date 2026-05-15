"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusOne } from "@/registry/nexus-elements/nexus-one/nexus-one";
import { useAccount } from "wagmi";

const NexusOneSwapShowcase = () => {
  const { address } = useAccount();

  return (
    <ShowcaseWrapper
      type="nexus-one"
      connectLabel="Connect wallet to use Nexus One Swap"
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
          config={{ mode: "swap" }}
          connectedAddress={address}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusOneSwapShowcase;
