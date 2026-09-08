# @avail-project/widgets

Public npm distribution for Avail widgets.

Install from npm:

```bash
pnpm add @avail-project/widgets
```

For internal GitHub installs, the package runs its `prepare` script and builds `dist` after clone:

```bash
pnpm add github:availproject/widgets
```

```tsx
import { NexusProvider, NexusWidget } from "@avail-project/widgets";

export function App() {
  return (
    <NexusProvider config={{ network: "mainnet", debug: false }}>
      <NexusWidget config={{ mode: "swap" }} />
    </NexusProvider>
  );
}
```

The shadcn registry remains the open source code-install path. Until the
namespace is listed in shadcn, install with:

```bash
npx shadcn@latest add availproject/widgets/nexus
```

## Onramp + Deposit diagnostics

For `config.mode: "deposit"`, set `config.enableOnRamp: true` to offer local currency funding. It defaults to `false`, which opens the wallet deposit flow directly. The deposit showcase includes an Onramp toggle for both settings.

Onramp checks the active wallet provider instead of trusting a persisted address. Disconnected users see Connect Wallet after quotes arrive; reconnecting refreshes the quote for the verified account before Pay is enabled. If the wallet disconnects during checkout, reconnect the funded wallet from the settled purchase screen to finish the deposit. Popup widgets (`embed={false}`) dismiss through the header close button, not outside clicks or Escape.

Version `2.1.0-rc.1` uses Nexus Core `2.4.1`. Filter the browser console by `[Nexus Onramp]` to trace payment status, SDK gas-swap events, wallet approval and the final deposit receipt. Keep the page open and approve the wallet prompts. See [onramp troubleshooting](../../docs/onramp-troubleshooting.md) in the source repository for configuration, failure cases and testing.
