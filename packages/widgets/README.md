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

## Theme

All three modes support `config.theme: "dark" | "light" | "system"`:

```tsx
<NexusWidget
  config={{
    mode: "swap",
    theme: "system",
    appearance: { primaryColor: "#006BF4" },
  }}
/>
```

The default is light. System follows live OS preference changes. Dark uses a
plain background; light keeps the background graphic. Primary-color overrides
continue to work in all themes. The legacy `config.appearance.mode` setting is
used when `config.theme` is omitted. Both embedded widgets and modals are supported.
