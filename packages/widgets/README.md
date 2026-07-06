# @avail-project/widgets

Closed npm distribution for Avail widgets.

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
