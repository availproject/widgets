"use client";

import { ArrowDown, Settings } from "lucide-react";
import { Card } from "@/registry/nexus-elements/ui/card";
import { Label } from "@/registry/nexus-elements/ui/label";
import { Button } from "@/registry/nexus-elements/ui/button";
import { Input } from "@/registry/nexus-elements/ui/input";
import {
  CHAIN_METADATA,
  SUPPORTED_CHAINS,
  TOKEN_METADATA,
} from "@avail-project/nexus-core";

export default function MockBridgeUI() {
  return (
    <Card className="w-full max-w-md mx-auto p-6 bg-card border-border shadow-xl relative overflow-hidden text-card-foreground">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Swap</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Pay Container */}
      <div className="rounded-xl bg-muted/30 border border-border/50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">You pay</Label>
          <span className="text-xs text-muted-foreground">Balance: 200.0 USDC</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Input
            type="text"
            value="100.0"
            readOnly
            className="border-none bg-transparent p-0 text-2xl font-semibold focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none h-auto w-full text-foreground"
          />
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm min-w-max">
            <img
              src={CHAIN_METADATA[SUPPORTED_CHAINS.ARBITRUM].logo}
              alt="Arbitrum"
              width={16}
              height={16}
              className="rounded-full"
            />
            <img
              src={TOKEN_METADATA["USDC"].icon}
              alt="USDC"
              width={16}
              height={16}
              className="rounded-full"
            />
            <span className="text-sm font-semibold text-foreground">USDC</span>
          </div>
        </div>
      </div>

      {/* Divider Arrow */}
      <div className="relative flex justify-center -my-3.5 z-10">
        <div className="h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center shadow-md text-muted-foreground hover:text-foreground">
          <ArrowDown className="h-4 w-4" />
        </div>
      </div>

      {/* Receive Container */}
      <div className="rounded-xl bg-muted/30 border border-border/50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">You receive (est.)</Label>
          <span className="text-xs text-muted-foreground">Route resolved by Nexus</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Input
            type="text"
            value="99.9"
            readOnly
            className="border-none bg-transparent p-0 text-2xl font-semibold focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none h-auto w-full text-foreground/80"
          />
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm min-w-max">
            <img
              src={CHAIN_METADATA[SUPPORTED_CHAINS.BASE].logo}
              alt="Base"
              width={16}
              height={16}
              className="rounded-full"
            />
            <img
              src={TOKEN_METADATA["USDC"].icon}
              alt="USDC"
              width={16}
              height={16}
              className="rounded-full"
            />
            <span className="text-sm font-semibold text-foreground">USDC</span>
          </div>
        </div>
      </div>

      {/* Route Info */}
      <div className="mt-4 pt-2 px-1 text-xs text-muted-foreground flex items-center justify-between">
        <span>Nexus Route: Arbitrum USDC → Base USDC</span>
        <span>Est. Time: ~ 30s</span>
      </div>

      {/* Swap Button */}
      <Button className="w-full mt-6 py-6 text-base font-semibold shadow-lg">
        Swap
      </Button>
    </Card>
  );
}
