"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusWidget } from "@/registry/nexus-elements/nexus-one/nexus-one";
import { useAccount } from "wagmi";
import { useModal } from "connectkit";

const NexusWidgetBridgeShowcase = () => {
  const { address } = useAccount();
  const { setOpen } = useModal();

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
          onConnectClick={() => setOpen(true)}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusWidgetBridgeShowcase;
