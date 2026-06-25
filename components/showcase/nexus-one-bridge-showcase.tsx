"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusWidget } from "@/registry/nexus-elements/nexus-one/nexus-one";
import { useAccount } from "wagmi";

const NexusWidgetBridgeShowcase = () => {
  const { address } = useAccount();

  return (
    <ShowcaseWrapper
      type="nexus-one"
      connectLabel="Connect wallet to use Nexus Widget Bridge"
    >
      <div
        className="flex w-full justify-center"
        style={{
          alignItems: "flex-start",
        }}
      >
        <NexusWidget
          config={{ mode: "swap" }}
          connectedAddress={address}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusWidgetBridgeShowcase;
