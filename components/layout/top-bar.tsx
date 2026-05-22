"use client";
import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/registry/nexus-elements/ui/skeleton";

const ThemeControl = dynamic(
  () => import("./theme-control").then((m) => m.default),
  {
    loading: () => <Skeleton className="w-24 h-9" />,
  }
);

const MobileNav = dynamic(() => import("./mobile-nav").then((m) => m.default), {
  loading: () => <Skeleton className="w-24 h-9" />,
});

const ConnectWalletButton = dynamic(
  () =>
    import("@/components/helpers/wallet-connect-button").then((m) => m.default),
  {
    loading: () => <Skeleton className="w-24 h-9" />,
  }
);

const NAV_ITEMS = [
  // {
  //   sectionId: "experience-nexus",
  //   section: "Experience Nexus",
  //   children: [
  //     {
  //       id: "experience",
  //       label: "Build Once, Scale Everywhere",
  //       href: "/experience",
  //     },
  //   ],
  // },
  {
    sectionId: "get-started",
    section: "Get Started",
    children: [
      {
        id: "installation",
        label: "Installation",
        href: "/docs/get-started",
      },
      {
        id: "components",
        label: "Components",
        href: "/docs/view-components",
      },
    ],
  },
  {
    sectionId: "components",
    section: "Components",
    children: [
      {
        id: "nexus-one",
        label: "Nexus One",
        href: "/docs/components/nexus-one",
      },
      {
        id: "deposit",
        label: "Deposit",
        href: "/docs/components/deposit",
      },
      {
        id: "fast-bridge",
        label: "Fast Bridge",
        href: "/docs/components/fast-bridge",
      },
      // {
      //   id: "swap-deposit",
      //   label: "Swap And Deposit",
      //   href: "/docs/components/swap-deposit",
      // },
      {
        id: "swaps",
        label: "Swaps",
        href: "/docs/components/swaps",
      },
      {
        id: "transfer",
        label: "Transfer",
        href: "/docs/components/transfer",
      },
      {
        id: "unified-balance",
        label: "Unified Balance",
        href: "/docs/components/unified-balance",
      },
      {
        id: "view-history",
        label: "View History",
        href: "/docs/components/view-history",
      },
    ],
  },
];

export default function Topbar() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [palette, setPalette] = useState<string>("default");
  const prevPaletteClass = useRef<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    try {
      const saved = (localStorage.getItem("palette") as string) || "default";
      setPalette(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("palette", palette);
    } catch {}
  }, [palette]);

  useEffect(() => {
    const root = document.documentElement;
    if (prevPaletteClass.current) {
      root.classList.remove(prevPaletteClass.current);
      prevPaletteClass.current = null;
    }

    if (
      palette !== "default" &&
      (resolvedTheme === "light" || resolvedTheme === "dark")
    ) {
      const cls = `${resolvedTheme}-${palette}`;
      root.classList.add(cls);
      prevPaletteClass.current = cls;
    }
  }, [palette, resolvedTheme]);

  const componentsGroup = NAV_ITEMS.find((g) => g.sectionId === "components");
  const componentItems =
    componentsGroup?.children?.map((c) => ({ href: c.href, label: c.label })) ??
    [];
  const topItems: { href: string; label: string }[] = [
    { href: "/docs/get-started", label: "Docs" },
    { href: "/docs/view-components", label: "Components" },
  ];

  return (
    <div className="sticky top-0 z-40 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="h-(--header-height) px-4! py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-x-6">
          <Link href={"/"} className={cn("cursor-pointer hidden sm:block")}>
            <Image
              src="/avail-logo-dark.svg"
              alt="Nexus Elements"
              width={100}
              height={100}
              className="w-[100px] h-[100px] dark:hidden block"
            />
            <Image
              src="/avail-logo-light.svg"
              alt="Nexus Elements"
              width={100}
              height={100}
              className="w-[100px] h-[100px] hidden dark:block"
            />
          </Link>
          <MobileNav
            items={topItems}
            componentItems={componentItems}
            className="block lg:hidden"
          />
          <Link
            href="/docs/get-started"
            className="text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors hidden lg:inline-block"
          >
            Docs
          </Link>
          <Link
            href="/docs/view-components"
            className="text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors hidden lg:inline-block"
          >
            Components
          </Link>
        </div>

        {/* Search bar */}
        {/* <div className="flex-1 max-w-md mx-4 hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search documentation..."
              className="pl-9 pr-20 h-9 w-full"
              disabled
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div> */}

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          <ThemeControl
            theme={theme ?? ""}
            setTheme={setTheme}
            palette={palette}
            setPalette={setPalette}
            isMobile={isMobile}
          />
          <div className="hidden sm:block">
            <ConnectWalletButton />
          </div>
        </div>
      </div>
    </div>
  );
}
