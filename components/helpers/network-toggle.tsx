"use client";
import { NexusNetwork } from "@avail-project/nexus-core";
import React, { useState, useEffect } from "react";
import { useNexus } from "@/registry/nexus-elements/nexus/NexusProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/nexus-elements/ui/select";
import { getItem, setItem } from "@/lib/local-storage";
import { NETWORK_KEY } from "@/providers/Web3Provider";

interface NetworkToggleProps {
  disableTestnet?: boolean;
}

const NetworkToggle = ({ disableTestnet = false }: NetworkToggleProps) => {
  const { nexusSDK, deinitializeNexus } = useNexus();
  const [currentNetwork, setCurrentNetwork] = useState<NexusNetwork>("mainnet");

  useEffect(() => {
    // Read from localStorage on client side only
    const storedNetwork = getItem(NETWORK_KEY) as NexusNetwork | null;
    if (disableTestnet && storedNetwork === "testnet") {
      setItem(NETWORK_KEY, "mainnet");
      setCurrentNetwork("mainnet");
    } else if (
      storedNetwork &&
      (storedNetwork === "mainnet" || storedNetwork === "testnet")
    ) {
      setCurrentNetwork(storedNetwork);
    } else {
      setCurrentNetwork("mainnet");
    }
  }, [disableTestnet]);

  const handleNetworkChange = async (newValue: string) => {
    if (disableTestnet && newValue === "testnet") return;

    if (nexusSDK) {
      await deinitializeNexus();
    }

    setItem(NETWORK_KEY, newValue);
    setCurrentNetwork(newValue as NexusNetwork);
    window.location.reload();
  };

  return (
    <div className="flex items-center space-x-2">
      <Select
        value={currentNetwork as string}
        onValueChange={handleNetworkChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a network" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="testnet" disabled={disableTestnet}>
            Testnet{disableTestnet ? " (not supported)" : ""}
          </SelectItem>
          <SelectItem value="mainnet">Mainnet</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default NetworkToggle;
