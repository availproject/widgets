import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import SwapWidget from "@/registry/avail-widgets/swaps/swap-widget";

const SwapsShowcase = () => {
  return (
    <ShowcaseWrapper
      connectLabel="Connect wallet to use Nexus Swaps"
      type="swaps"
    >
      <SwapWidget />
    </ShowcaseWrapper>
  );
};

export default SwapsShowcase;
