"use client";

import { useAccount } from "wagmi";
import { useConnectWalletClick } from "@/components/helpers/use-connect-wallet-click";
import { NexusWidget } from "@/registry/avail-widgets/nexus-widget/nexus-widget";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export function HomeNexusWidgetPreview() {
  const { address } = useAccount();
  const openConnectWallet = useConnectWalletClick();

  return (
    <div className="flex w-full justify-center">
      <NexusWidget
        config={{
          mode: "swap",
          destination: {
            chain: 8453,
            tokens: [
              {
                address: USDC_BASE,
                decimals: 6,
                symbol: "USDC",
              },
            ],
          },
        }}
        connectedAddress={address}
        onConnectClick={openConnectWallet}
      />
    </div>
  );
}
