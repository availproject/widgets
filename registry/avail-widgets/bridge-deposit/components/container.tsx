"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import SimpleDeposit from "./simple-deposit";
import { useNexus } from "../../nexus/NexusProvider";
import { type BaseDepositProps } from "../deposit";
import { truncateAddress } from "@avail-project/nexus-core/utils";

interface ContainerProps extends BaseDepositProps {
  fiatSubheading?: string;
  destinationLabel?: string;
}

const Container = ({
  address,
  fiatSubheading = "Cards, Apple Pay",
  token,
  chain,
  chainOptions,
  destinationLabel,
  depositExecute,
}: ContainerProps) => {
  const { nexusSDK } = useNexus();
  return (
    <Tabs defaultValue="simple" className="sm:min-w-sm">
      <TabsList className="h-12 p-0 w-full">
        <TabsTrigger value="simple" className="px-2 py-1">
          <div className="flex items-center flex-col gap-y-1">
            <p className="text-sm data-[state=active]:font-bold">Wallet</p>
            <p className="text-[10px]">{truncateAddress(address, 4, 4)}</p>
          </div>
        </TabsTrigger>
        <TabsTrigger value="qr" className="px-2 py-1">
          <div className="flex items-center flex-col gap-y-1">
            <p className="text-sm data-[state=active]:font-bold">Transfer QR</p>
            <p className="text-[10px]">{chainOptions?.length ?? "0"} chains</p>
          </div>
        </TabsTrigger>
        <TabsTrigger value="fiat" className="px-2 py-1">
          <div className="flex items-center flex-col gap-y-1">
            <p className="text-sm data-[state=active]:font-bold">Fiat</p>
            <p className="text-[10px]">{fiatSubheading}</p>
          </div>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="simple">
        <SimpleDeposit
          address={address}
          token={token}
          chain={chain}
          chainOptions={chainOptions}
          destinationLabel={destinationLabel}
          depositExecute={depositExecute}
        />
      </TabsContent>
      <TabsContent value="qr">
        <p className="text-xl text-primary text-center">Coming soon</p>
      </TabsContent>
      <TabsContent value="fiat">
        <p className="text-xl text-primary text-center">Coming soon</p>
      </TabsContent>
    </Tabs>
  );
};

export default Container;
