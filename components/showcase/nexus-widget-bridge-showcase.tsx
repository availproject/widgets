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

const NexusWidgetBridgeShowcase = () => {
  const { address } = useAccount();
  const openConnectWallet = useConnectWalletClick();
  const [renderMode, setRenderMode] =
    React.useState<NexusWidgetRenderMode>("inline");
  const isPopupMode = renderMode === "popup";

  return (
    <ShowcaseWrapper
      type="nexus-widget"
      connectLabel="Connect wallet to use Nexus Widget Bridge"
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
          config={{ mode: "swap" }}
          connectedAddress={address}
          onConnectClick={openConnectWallet}
        />
      </div>
    </ShowcaseWrapper>
  );
};

export default NexusWidgetBridgeShowcase;
