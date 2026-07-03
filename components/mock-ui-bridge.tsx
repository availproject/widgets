"use client";

import { Edit } from "lucide-react";
import { Card } from "@/registry/avail-widgets/ui/card";
import { Label } from "@/registry/avail-widgets/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/registry/avail-widgets/ui/select";
import {
  CHAIN_METADATA,
  SUPPORTED_CHAINS,
  TOKEN_METADATA,
} from "@/registry/avail-widgets/common/utils/constant";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/registry/avail-widgets/ui/accordion";
import { Fragment } from "react";
import { SHORT_CHAIN_NAME } from "@/registry/avail-widgets/common/utils/constant";
import { Input } from "@/registry/avail-widgets/ui/input";
import Link from "next/link";
import { Button } from "@/registry/avail-widgets/ui/button";

const MOCK_BALANCE = {
  abstracted: true,
  balance: "1.731490751289602344",
  balanceInFiat: 1.73,
  breakdown: [
    {
      balance: "1",
      balanceInFiat: 1,
      chain: {
        id: 1,
        logo: "https://assets.coingecko.com/asset_platforms/images/279/large/ethereum.png",
        name: "Ethereum Mainnet",
      },
      contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      decimals: 6,
      universe: 0,
    },
    {
      balance: "0.150554",
      balanceInFiat: 0.15,
      chain: {
        id: 8453,
        logo: "https://assets.coingecko.com/asset_platforms/images/131/large/base-network.png",
        name: "Base",
      },
      contractAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      decimals: 6,
      universe: 0,
    },
    {
      balance: "0.118598",
      balanceInFiat: 0.12,
      chain: {
        id: 999,
        logo: "https://assets.coingecko.com/asset_platforms/images/243/large/hyperliquid.png",
        name: "HyperEVM",
      },
      contractAddress: "0xb88339cb7199b77e23db6e890353e22632ba630f",
      decimals: 6,
      universe: 0,
    },
    {
      balance: "0.1",
      balanceInFiat: 0.1,
      chain: {
        id: 10,
        logo: "https://assets.coingecko.com/coins/images/25244/large/Optimism.png",
        name: "OP Mainnet",
      },
      contractAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
      decimals: 6,
      universe: 0,
    },
  ],
  decimals: 18,
  icon: "https://coin-images.coingecko.com/coins/images/6319/large/usdc.png",
  symbol: "USDC",
};

export default function MockBridgeUI() {
  return (
    <Card className="w-full max-w-md mx-auto p-8">
      <div className="space-y-5">
        <div className="flex flex-col gap-y-5">
          <Link href={"/docs/components/fast-bridge"}>
            <Label className=" text-base font-medium">To</Label>
          </Link>
          {/* Chain Selector */}
          <Select value={"10"}>
            <Link href={"/docs/components/fast-bridge"} className="w-full">
              <SelectTrigger className=" w-full">
                <SelectValue>
                  <div className="flex items-center gap-x-2 w-full">
                    <img
                      src={CHAIN_METADATA[SUPPORTED_CHAINS.OPTIMISM].logo}
                      alt={CHAIN_METADATA[SUPPORTED_CHAINS.OPTIMISM].name}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                    <p className="text-primary test-sm">
                      {CHAIN_METADATA[SUPPORTED_CHAINS.OPTIMISM].name}
                    </p>
                  </div>
                </SelectValue>
              </SelectTrigger>
            </Link>
          </Select>

          {/* Token Selector */}
          <Select value={"10"}>
            <Link href={"/docs/components/fast-bridge"} className="w-full">
              <SelectTrigger className=" w-full">
                <SelectValue>
                  <div className="flex items-center gap-x-2 w-full">
                    <img
                      src={TOKEN_METADATA["USDC"].logo}
                      alt={TOKEN_METADATA["USDC"].name}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                    <p className="text-primary test-sm">
                      {TOKEN_METADATA["USDC"].name}
                    </p>
                  </div>
                </SelectValue>
              </SelectTrigger>
            </Link>
          </Select>

          <div className="flex flex-col gap-y-2 w-full">
            <Link href={"/docs/components/fast-bridge"} className="w-full">
              <div className="w-full flex sm:flex-row flex-col border border-border rounded-lg gap-y-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={"100"}
                  onChange={() => {}}
                  placeholder="Enter Amount"
                  className="w-full border-none bg-transparent rounded-r-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none py-0 px-3"
                />
                <div className="flex items-center justify-end-safe gap-x-2 sm:gap-x-4 w-fit px-2 border-l border-border">
                  <p className="text-base font-semibold min-w-max">200 USDC</p>

                  <Button size={"sm"} variant={"ghost"} className="px-0">
                    Max
                  </Button>
                </div>
              </div>
            </Link>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="balance-breakdown">
                <AccordionTrigger
                  className="w-fit justify-end items-center py-0 gap-x-0.5 cursor-pointer"
                  hideChevron={false}
                >
                  View Assets
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  <div className="space-y-3 py-2">
                    {MOCK_BALANCE?.breakdown.map((chain) => {
                      if (Number.parseFloat(chain.balance) === 0) return null;
                      return (
                        <Fragment key={chain.chain.id}>
                          <div className="flex items-center justify-between px-2 py-1 rounded-md">
                            <div className="flex items-center gap-2">
                              <div className="relative h-6 w-6">
                                <img
                                  src={chain?.chain?.logo}
                                  alt={chain.chain.name}
                                  sizes="100%"
                                  className="rounded-full"
                                  loading="lazy"
                                  decoding="async"
                                  width="24"
                                  height="24"
                                />
                              </div>
                              <span className="text-sm sm:block hidden">
                                {SHORT_CHAIN_NAME[chain.chain.id]}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {chain.balance}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ${chain.balanceInFiat.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Recipient Address */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center w-full justify-between">
            <p className="font-semibold w-full">Recipient Address</p>
            <div className="flex items-center gap-x-3 w-full">
              <p className="font-semibold">{"0x12312...456789"}</p>

              <Button variant={"ghost"} size={"icon"} className="px-0 size-6">
                <Edit className="size-6" />
              </Button>
            </div>
          </div>
        </div>

        <Link href={"/docs/components/fast-bridge"}>
          <Button className="w-full">Bridge</Button>
        </Link>
      </div>
    </Card>
  );
}
