"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusOne } from "@/registry/nexus-elements/nexus-one/nexus-one";

const NexusOneTransferShowcase = () => {
  return (
    <ShowcaseWrapper
      type="nexus-one"
      connectLabel="Connect wallet to use Nexus One Transfer"
    >
      <NexusOne
        config={{ mode: "send" }}
        connectedAddress={"0x0000000000000000000000000000000000000000"}
      />
    </ShowcaseWrapper>
  );
};

export default NexusOneTransferShowcase;
