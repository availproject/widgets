---
name: nexus-migration-guide
description: Detailed guidelines for LLMs and developer agents on migrating codebases from legacy standalone Nexus Elements widgets (swaps, fast-bridge, transfer, deposit) to the unified Nexus Widget component.
---

# Nexus Elements - Migration Guide for Agents & LLMs

Use this skill when asked to migrate an existing React/Next/Vite codebase from legacy Nexus elements (`SwapWidget`, `FastBridge`, `FastTransfer`, `NexusDeposit`, `BridgeDeposit`, `UnifiedBalance`, `ViewHistory`) to the unified **Nexus Widget** component.

## ⚠️ Deprecation Context

All legacy standalone widgets have been **deprecated and removed** from the registry. You must migrate all usages to `NexusWidget`, configuring the workflow via `config.mode`.

## 1. Replacement Mapping

- **Standalone Swaps & FastBridge** (`SwapWidget`, `FastBridge`):
  - Replace with `<NexusWidget config={{ mode: "swap" }} />`.
  - Prefill via `config.prefill.source` and `config.prefill.destination`.
- **FastTransfer** (`FastTransfer`):
  - Replace with `<NexusWidget config={{ mode: "send" }} />`.
  - Prefill via `config.prefill.recipient` and `config.prefill.amount`.
- **Protocol Deposits & BridgeDeposit** (`NexusDeposit`, `BridgeDeposit`):
  - Replace with `<NexusWidget config={{ mode: "deposit", deposit: { ... } }} />`.
  - Required to configure `deposit` object with `executeDeposit` callback.
- **UnifiedBalance & ViewHistory**:
  - Remove. Balance is rendered inline in `NexusWidget`. Use `sdk.getMyIntents()` for custom history.

## 2. Installation & Imports

Instruct the developer or run the command:

```bash
npx shadcn@latest add @avail-widgets/nexus
```

Update imports:
```diff
-import { SwapWidget } from "@/components/nexus-elements/swaps";
-import { FastTransfer } from "@/components/nexus-elements/transfer";
+import { NexusWidget } from "@/components/nexus/nexus";
+import NexusProvider from "@/components/nexus/NexusProvider";
```

## 3. Provider Configurations

Ensure that `NexusProvider` wraps the app layout.
Provide the EIP-1193 provider initialization flow on wallet connection:

```tsx
import { useEffect } from "react";
import { useAccount, useConnectorClient } from "wagmi";
import type { EthereumProvider } from "@avail-project/nexus-sdk-v2";
import { useNexus } from "@/components/nexus/NexusProvider";

export function InitNexusOnConnect() {
  const { status, connector } = useAccount();
  const { data: walletClient } = useConnectorClient();
  const { handleInit } = useNexus();

  useEffect(() => {
    if (status !== "connected") return;

    void (async () => {
      const mobileProvider = walletClient
        ? ({ request: (args: unknown) => walletClient.request(args as never) } as EthereumProvider)
        : undefined;
      const desktopProvider = await connector?.getProvider();
      const provider = mobileProvider ?? (desktopProvider as EthereumProvider | undefined);
      
      if (provider && typeof provider.request === "function") {
        await handleInit(provider);
      }
    })();
  }, [status, connector, walletClient, handleInit]);

  return null;
}
```

## 4. Porting Custom Logic & Overwrite Safe-guarding

If the existing project has custom logic modifications inside the `components/nexus-elements/common/` folder, warn the user and follow this workflow:

1. **Back up existing components:** Suggest backing up the `components/nexus-elements/` folder before continuing.
2. **Utilize Callbacks:** Encourage using the built-in callbacks on `NexusWidget` first before editing component internals:
   - `onStart`: Called when transaction starts.
   - `onComplete(explorerUrl)`: Called when execution succeeds.
   - `onError(message)`: Called when execution fails.
   - `onConnectWallet`: Custom handler for connect wallet CTA clicks.
3. **Port custom changes manually:** If custom internal logic (like custom UI layout/styles) was used, instruct the developer or make changes inside the new `components/nexus/` files manually. Do NOT copy the legacy files directly over.
