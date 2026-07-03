"use client";
import { Button } from "@/registry/avail-widgets/ui/button";
import { ConnectKitButton } from "connectkit";
import { truncateAddress } from "@avail-project/nexus-core/utils";
import { Loader2 } from "lucide-react";
import { useConnectWalletClick } from "./use-connect-wallet-click";
import { AddressIdenticon } from "@/registry/avail-widgets/nexus-widget/components/address-identicon";

const ConnectWalletButton = () => {
  const openConnectWallet = useConnectWalletClick();

  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address }) => {
        return (
          <Button
            variant={"outline"}
            size={"sm"}
            disabled={!show || isConnecting}
            onClick={openConnectWallet}
          >
            {isConnecting && <Loader2 className="size-5 animate-spin" />}
            {isConnected && address ? (
              <>
                <AddressIdenticon address={address} size={16} />
                <span>{truncateAddress(address, 4, 4)}</span>
              </>
            ) : (
              "Connect"
            )}
          </Button>
        );
      }}
    </ConnectKitButton.Custom>
  );
};

export default ConnectWalletButton;
