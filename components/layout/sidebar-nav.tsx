/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { source } from "@/lib/source";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const TOP_LEVEL_SECTIONS = [
  { name: "Get Started", href: "/docs/get-started" },
  { name: "MCP", href: "/docs/mcp" },
  { name: "Components", href: "/docs/view-components" },
];

const EXCLUDED_SECTIONS: string[] = [
  "root:get-started.mdx",
  "root:view-components.mdx",
  "root:mcp.mdx",
  "get-started.mdx",
  "view-components.mdx",
  "mcp.mdx",
];

const EXCLUDED_PAGES: string[] = ["/docs/components/swap-deposit"];

export default function SidebarNav({
  tree,
  ...props
}: React.ComponentProps<typeof Sidebar> & { tree: typeof source.pageTree }) {
  const pathname = usePathname();

  return (
    <Sidebar
      className="sticky top-[calc(var(--header-height)+1px)] z-30 hidden h-[calc(100svh-var(--footer-height)-4rem)] overscroll-none bg-transparent lg:flex"
      collapsible="none"
      {...props}
    >
      <SidebarContent className="no-scrollbar overflow-x-hidden px-2">
        <div className="from-background via-background/80 to-background/50 sticky -top-1 z-10 h-8 shrink-0 bg-linear-to-b blur-xs" />
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground font-medium">
            Sections
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {TOP_LEVEL_SECTIONS.map(({ name, href }) => {
                return (
                  <SidebarMenuItem key={name}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        href === "/docs"
                          ? pathname === href
                          : pathname.startsWith(href)
                      }
                      className="data-[active=true]:bg-accent data-[active=true]:border-accent 3xl:fixed:w-full 3xl:fixed:max-w-48 relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md"
                    >
                      <Link href={href}>
                        <span className="absolute inset-0 flex w-(--sidebar-width) bg-transparent" />
                        {name}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {tree.children.map((item: any) => {
          if (EXCLUDED_SECTIONS.includes(item.$id ?? "")) {
            return null;
          }

          if (item.type === "page") {
            return (
              <SidebarGroup key={item.$id} className="py-1">
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={item.url === pathname}
                        className="data-[active=true]:bg-accent data-[active=true]:border-accent 3xl:fixed:w-full 3xl:fixed:max-w-48 relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md"
                      >
                        <Link href={item.url}>
                          <span className="absolute inset-0 flex w-(--sidebar-width) bg-transparent" />
                          {item.name}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <SidebarGroup key={item.$id}>
              <SidebarGroupLabel className="text-muted-foreground font-medium">
                {item.name}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {item.type === "folder" && (
                  <SidebarMenu className="gap-0.5">
                    {item.children.map((child: any) => {
                      if (
                        child.type === "page" &&
                        child.url?.includes("/mcp")
                      ) {
                        return null;
                      }

                      return (
                        child.type === "page" &&
                        !EXCLUDED_PAGES.includes(child.url) && (
                          <SidebarMenuItem key={child.url}>
                            <SidebarMenuButton
                              asChild
                              isActive={child.url === pathname}
                              className="data-[active=true]:bg-accent data-[active=true]:border-accent 3xl:fixed:w-full 3xl:fixed:max-w-48 relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md"
                            >
                              <Link href={child.url}>
                                <span className="absolute inset-0 flex w-(--sidebar-width) bg-transparent" />
                                {child.name}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      );
                    })}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
        <div className="from-background via-background/80 to-background/50 sticky -bottom-1 z-10 h-16 shrink-0 bg-linear-to-t blur-xs" />
      </SidebarContent>
    </Sidebar>
  );
}
