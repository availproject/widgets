"use client";

import * as React from "react";
import { CopyButton } from "@/components/helpers/copy-button";
import { cn } from "@/lib/utils";

const COMMANDS = {
  npm: "npm install @avail-project/widgets",
  shadcn: "npx shadcn@latest add availproject/widgets/nexus",
} as const;

type InstallTab = keyof typeof COMMANDS;

export function HomeInstallTabs() {
  const [tab, setTab] = React.useState<InstallTab>("npm");

  const currentCommand = COMMANDS[tab];

  return (
    <div className="mt-10 flex flex-col items-center gap-3 w-fit max-w-full mx-auto px-4">
      {/* Tab Selector */}
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

      {/* Terminal Command Box */}
      <div className="flex items-center justify-between gap-4 text-sm text-foreground font-mono border border-border rounded-md px-4 py-3 w-fit max-w-full bg-background overflow-x-auto shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground select-none">~</span>
          <span className="whitespace-nowrap">{currentCommand}</span>
        </div>
        <CopyButton value={currentCommand} customPosition="relative top-0 right-0 shrink-0" />
      </div>
    </div>
  );
}
