"use client";
import { type NexusNetwork } from "@avail-project/nexus-core";
import React, { useState, useEffect, useContext } from "react";
import { NexusContext } from "@/registry/avail-widgets/nexus/NexusProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/avail-widgets/ui/select";
import { getItem, setItem } from "@/lib/local-storage";
import { NETWORK_KEY } from "@/providers/Web3Provider";

interface NetworkToggleProps {
  disableTestnet?: boolean;
}

const NetworkToggle = ({ disableTestnet = true }: NetworkToggleProps) => {
  const nexusContext = useContext(NexusContext);
  const [currentNetwork, setCurrentNetwork] = useState<NexusNetwork>("mainnet");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Read from localStorage on client side only
    const storedNetwork = getItem(NETWORK_KEY) as NexusNetwork | null;
    if (disableTestnet && storedNetwork === "testnet") {
      setItem(NETWORK_KEY, "mainnet");
      setCurrentNetwork("mainnet");
    } else if (
      storedNetwork &&
      (storedNetwork === "canary" || storedNetwork === "mainnet" || storedNetwork === "testnet")
    ) {
      setCurrentNetwork(storedNetwork);
    } else {
      setCurrentNetwork("mainnet");
    }
  }, [disableTestnet]);

  const handleNetworkChange = async (newValue: string) => {
    if (disableTestnet && newValue === "testnet") return;

    if (nexusContext?.nexusSDK) {
      try {
        await nexusContext.deinitializeNexus();
      } catch {
        // ignore deinitialization error during network switch
      }
    }

    setItem(NETWORK_KEY, newValue);
    setCurrentNetwork(newValue as NexusNetwork);
    window.location.reload();
  };

  if (!mounted) {
    return (
      <div className="flex items-center space-x-2">
        <SelectTrigger size="sm" className="w-[120px] h-8">
          <SelectValue placeholder="Mainnet" />
        </SelectTrigger>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Select
        value={currentNetwork as string}
        onValueChange={handleNetworkChange}
      >
        <SelectTrigger size="sm" className="w-[120px] h-8">
          <SelectValue placeholder="Select a network" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mainnet">Mainnet</SelectItem>
          <SelectItem value="canary">Canary</SelectItem>
          <SelectItem value="testnet" disabled={disableTestnet}>
            Testnet{disableTestnet ? " (not supported)" : ""}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default NetworkToggle;
