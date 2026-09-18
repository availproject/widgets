"use client";

import * as React from "react";
import { CopyButton } from "@/components/helpers/copy-button";
import { HomeNexusWidgetPreview } from "@/components/home-nexus-widget-preview";
import { cn } from "@/lib/utils";

const COMMANDS = {
  npm: "npm install @avail-project/widgets",
  shadcn: "npx shadcn@latest add availproject/widgets/nexus",
} as const;

type InstallTab = keyof typeof COMMANDS;

export function HomeHeroSection() {
  const [tab, setTab] = React.useState<InstallTab>("npm");

  const currentCommand = COMMANDS[tab];

  const importLine =
    tab === "npm"
      ? "import { NexusWidget } from '@avail-project/widgets'"
      : "import { NexusWidget } from '@/components/nexus/nexus'";

  return (
    <>
      {/* Install Tabs & Command Box */}
      <div className="mt-10 flex flex-col items-center gap-3 w-fit max-w-full mx-auto px-4">
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setTab("npm")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
              tab === "npm"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            npm
          </button>
          <button
            type="button"
            onClick={() => setTab("shadcn")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
              tab === "shadcn"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            shadcn/ui
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 text-sm text-foreground font-mono border border-border rounded-md px-4 py-3 w-fit max-w-full bg-background overflow-x-auto shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground select-none">~</span>
            <span className="whitespace-nowrap">{currentCommand}</span>
          </div>
          <CopyButton value={currentCommand} customPosition="relative top-0 right-0 shrink-0" />
        </div>
      </div>

      {/* Code Preview / Feature Highlight */}
      <div className="max-w-6xl mx-auto mt-24 border border-border rounded-xl bg-card overflow-hidden shadow-2xl shadow-black/50 text-left">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            nexus-widget-demo.tsx
          </div>
          <div className="w-16" />
        </div>
        <div className="grid lg:grid-cols-2">
          <div className="p-3 md:p-12 border-r border-border bg-card flex items-center justify-center min-h-[500px]">
            <div className="w-full max-w-md">
              <HomeNexusWidgetPreview />
            </div>
          </div>
          <div className="p-0 bg-[#0d0d0d] overflow-hidden relative flex flex-col">
            <div className="absolute top-4 right-4 text-xs text-muted-foreground font-mono z-10">
              TypeScript
            </div>
            <div className="flex-1 overflow-auto p-8">
              <pre className="text-sm font-mono text-chart-2 leading-relaxed">
                <code className="text-chart-2">{`${importLine}
import { useAccount } from 'wagmi'

export function NexusInterface() {
  const { address } = useAccount()

  return (
    <div className="p-4">
      <NexusWidget
        connectedAddress={address}
        config={{
          mode: 'swap',
          destination: {
            chain: 8453,
            tokens: [
              {
                address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                symbol: 'USDC',
                decimals: 6,
              },
            ],
          },
        }}
        onComplete={(explorerUrl) => {
          console.log('Nexus intent successful:', explorerUrl)
        }}
      />
    </div>
  )
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
