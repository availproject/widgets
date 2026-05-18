"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusOne } from "@/registry/nexus-elements/nexus-one/nexus-one";
import { useAccount } from "wagmi";

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
          config={{ mode: "send" }}
          connectedAddress={address}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusOneTransferShowcase;
