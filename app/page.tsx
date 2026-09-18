import Link from "next/link";
import { Button } from "@/registry/avail-widgets/ui/button";
import { Check, Terminal, Zap, Shield, Globe, Box } from "lucide-react";
import { HomeHeroSection } from "@/components/home-hero-section";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-white selection:bg-accent selection:text-primary font-sans">
      <main className="relative pt-32">
        <section className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h1 className="text-5xl sm:text-7xl font-bold  mb-8 text-foreground">
              Plug n Play components <br /> to{" "}
              <span className="text-chart-1">10x</span> your UX
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10 font-serif">
              Ready-made React components for almost any use case. Use as is or
              customise and go to market fast
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={"/docs/get-started"}>
                <Button size="lg">Get Started</Button>
              </Link>
              <Link href={"/docs/view-components"}>
                <Button size="lg" variant="outline" className="text-foreground">
                  View Components
                </Button>
              </Link>
            </div>
          </div>

          <HomeHeroSection />
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-6 py-32">
          <div className="mb-16 w-full">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-foreground font-sans">
              What is Nexus?
            </h2>
            <p className="text-muted-foreground text-lg w-full max-w-4xl font-serif">
              Nexus is a meta-interoperability protocol that eliminates
              blockchain fragmentation by connecting liquidity, assets, and
              coordination logic at the base layer. It abstracts complexities
              such as manual bridging, chain switching, wallet switching, swaps,
              and complex approvals for the end user to create a seamless
              “bridgeless” experience.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: "Instant Transactions",
                desc: "Optimized for speed with optimistic UI updates and automatic gas estimation.",
              },
              {
                icon: Shield,
                title: "Type-Safe Contracts",
                desc: "End-to-end type safety for your smart contract interactions with full Wagmi support.",
              },
              {
                icon: Globe,
                title: "Multi-Chain Ready",
                desc: "Built-in support for all major EVM chains with unified balance aggregation.",
              },
              {
                icon: Box,
                title: "Composable UI",
                desc: "Headless components that give you full control over styling and behavior.",
              },
              {
                icon: Terminal,
                title: "CLI Automation",
                desc: "Scaffold new projects or add components with a single command.",
              },
              {
                icon: Check,
                title: "Production Tested",
                desc: "Used in production by leading DeFi protocols handling millions in volume.",
              },
            ].map((feature) => (
              <div
                key={feature.desc}
                className="group p-6 rounded-xl border border-border bg-card/20 hover:bg-card/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center mb-4 group-hover:border-border/70 transition-colors">
                  <feature.icon className="w-5 h-5 text-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground font-sans">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-serif">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
