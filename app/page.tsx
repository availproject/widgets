import Link from "next/link";
import { Button } from "@/registry/avail-widgets/ui/button";
import { Check, Terminal, Zap, Shield, Globe, Box } from "lucide-react";
import { CopyButton } from "@/components/helpers/copy-button";
import { HomeNexusWidgetPreview } from "@/components/home-nexus-widget-preview";

const INSTALL_COMMAND = "npx shadcn@latest add availproject/widgets/nexus";

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
            <div className="mt-12 flex items-center justify-center gap-2 text-sm text-foreground font-mono border border-border rounded-md p-4 w-full overflow-x-scroll lg:w-max bg-background mx-auto">
              <span>~</span>
              <span>{INSTALL_COMMAND}</span>
              <CopyButton value={INSTALL_COMMAND} customPosition="" />
            </div>
          </div>

          {/* Code Preview / Feature Highlight */}
          <div className="max-w-6xl mx-auto mt-24 border border-border rounded-xl bg-card overflow-hidden shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                nexus-widget-demo.tsx
              </div>
              <div className="w-16" /> {/* Spacer for centering */}
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
                    <code className="text-chart-2">{`import { NexusWidget } from '@/components/nexus/nexus'
import { useConnectWalletClick } from '@/components/helpers/use-connect-wallet-click'
import { useAccount } from 'wagmi'

export function NexusInterface() {
  const { address } = useAccount()
  const openConnectWallet = useConnectWalletClick()

  return (
    <div className="p-4">
      <NexusWidget
        connectedAddress={address}
        config={{
          mode: 'swap',
          prefill: {
            source: {
              token: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
              chain: 42161,
            },
            destination: {
              token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              chain: 8453,
            },
            amount: '100',
          },
        }}
        onComplete={(tx) => {
          console.log('Nexus intent successful:', tx)
        }}
        onConnectClick={openConnectWallet}
      />
    </div>
  )
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
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
