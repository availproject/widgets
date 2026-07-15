"use client";
import React from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusWidget } from "@/registry/avail-widgets/nexus-widget/nexus-widget";
import { useAccount } from "wagmi";
import { useConnectWalletClick } from "../helpers/use-connect-wallet-click";
import {
  NexusWidgetRenderModeToggle,
  type NexusWidgetRenderMode,
} from "./nexus-widget-render-mode-toggle";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

const NexusWidgetTransferShowcase = () => {
  const { address } = useAccount();
  const openConnectWallet = useConnectWalletClick();
  const [renderMode, setRenderMode] =
    React.useState<NexusWidgetRenderMode>("inline");
  const isPopupMode = renderMode === "popup";

  return (
    <ShowcaseWrapper
      type="nexus-widget"
      connectLabel="Connect wallet to use Send"
      controls={
        <NexusWidgetRenderModeToggle
          value={renderMode}
          onValueChange={setRenderMode}
        />
      }
    >
      <div
        className="flex w-full justify-center"
        style={{
          alignItems: "flex-start",
        }}
      >
        <NexusWidget
          key={renderMode}
          embed={!isPopupMode}
          defaultOpen={isPopupMode}
          config={{
            mode: "send",
            prefill: {
              amount: "0.1",
              token: {
                address: USDC_BASE,
                chain: 8453,
                decimals: 6,
                symbol: "USDC",
              },
            },
          }}
          connectedAddress={address}
          onConnectClick={openConnectWallet}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusWidgetTransferShowcase;
