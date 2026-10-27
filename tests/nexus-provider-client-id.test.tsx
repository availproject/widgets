import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createConfig, http, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";
import NexusProvider, {
  getDefaultClientId,
  isLocalHostname,
  useNexus,
} from "../registry/avail-widgets/nexus/NexusProvider";

const testWagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

test("isLocalHostname correctly identifies localhost and local IP variants", () => {
  // Localhost names
  assert.equal(isLocalHostname("localhost"), true);
  assert.equal(isLocalHostname("localhost:3000"), true);
  assert.equal(isLocalHostname("LOCALHOST:8080"), true);
  assert.equal(isLocalHostname("sub.localhost"), true);
  assert.equal(isLocalHostname("sub.localhost:5173"), true);
  assert.equal(isLocalHostname("app.local"), true);
  assert.equal(isLocalHostname("macbook.local:4000"), true);
  assert.equal(isLocalHostname("0.0.0.0"), true);
  assert.equal(isLocalHostname("0.0.0.0:8080"), true);
  assert.equal(isLocalHostname("::1"), true);
  assert.equal(isLocalHostname("[::1]:3000"), true);
  assert.equal(isLocalHostname("fe80::1"), true);
  assert.equal(isLocalHostname("fc00::1"), true);
  assert.equal(isLocalHostname("fd00::1"), true);

  // IPv4 loopback (127.0.0.0/8)
  assert.equal(isLocalHostname("127.0.0.1"), true);
  assert.equal(isLocalHostname("127.0.0.1:3000"), true);
  assert.equal(isLocalHostname("127.0.0.1:5173"), true);
  assert.equal(isLocalHostname("127.0.1.5"), true);
  assert.equal(isLocalHostname("127.255.255.255"), true);

  // IPv4 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
  assert.equal(isLocalHostname("10.0.0.1"), true);
  assert.equal(isLocalHostname("10.255.255.255"), true);
  assert.equal(isLocalHostname("172.16.0.1"), true);
  assert.equal(isLocalHostname("172.20.10.2"), true);
  assert.equal(isLocalHostname("172.31.255.255"), true);
  assert.equal(isLocalHostname("192.168.0.1"), true);
  assert.equal(isLocalHostname("192.168.1.100:8080"), true);
  assert.equal(isLocalHostname("169.254.1.1"), true);

  // Non-local hostnames / public domains
  assert.equal(isLocalHostname("example.com"), false);
  assert.equal(isLocalHostname("availproject.org"), false);
  assert.equal(isLocalHostname("arcana.network"), false);
  assert.equal(isLocalHostname("app.availproject.org:443"), false);
  assert.equal(isLocalHostname("sub.example.co.uk"), false);
  assert.equal(isLocalHostname("172.32.0.1"), false);
  assert.equal(isLocalHostname("8.8.8.8"), false);
});

test("getDefaultClientId resolves domains and defaults to localhost for local origins", () => {
  // Domain / origins return clean domain
  assert.equal(getDefaultClientId("example.com"), "example.com");
  assert.equal(getDefaultClientId("example.com:8080"), "example.com");
  assert.equal(getDefaultClientId("availproject.org"), "availproject.org");
  assert.equal(getDefaultClientId("availproject.org:3000"), "availproject.org");
  assert.equal(getDefaultClientId("arcana.network"), "arcana.network");
  assert.equal(getDefaultClientId("https://arcana.network/swap"), "arcana.network");
  assert.equal(getDefaultClientId("https://sub.domain.org:8443/app"), "sub.domain.org");

  // Localhost / local IP return "localhost"
  assert.equal(getDefaultClientId("localhost"), "localhost");
  assert.equal(getDefaultClientId("localhost:3000"), "localhost");
  assert.equal(getDefaultClientId("sub.localhost:8080"), "localhost");
  assert.equal(getDefaultClientId("app.local"), "localhost");
  assert.equal(getDefaultClientId("127.0.0.1"), "localhost");
  assert.equal(getDefaultClientId("127.0.0.1:5173"), "localhost");
  assert.equal(getDefaultClientId("192.168.1.50:3000"), "localhost");
  assert.equal(getDefaultClientId("10.0.0.2:8080"), "localhost");
  assert.equal(getDefaultClientId("172.16.5.5"), "localhost");
  assert.equal(getDefaultClientId("169.254.0.1"), "localhost");
  assert.equal(getDefaultClientId("0.0.0.0:3000"), "localhost");
  assert.equal(getDefaultClientId("::1"), "localhost");
  assert.equal(getDefaultClientId("[::1]:3000"), "localhost");

  // Empty or invalid returns "localhost"
  assert.equal(getDefaultClientId(""), "localhost");
  assert.equal(getDefaultClientId("   "), "localhost");
});

test("NexusProvider resolves origin when clientId is NOT set (never nexus-widget)", () => {
  const originalWindow = (globalThis as any).window;
  try {
    function Consumer({ onContext }: { onContext: (ctx: any) => void }) {
      const ctx = useNexus();
      onContext(ctx);
      return null;
    }

    // 1. On availproject.org, clientId is not set -> sends "availproject.org"
    (globalThis as any).window = {
      location: { hostname: "availproject.org", host: "availproject.org" },
    };
    let capturedCtx: any;
    renderToStaticMarkup(
      <WagmiProvider config={testWagmiConfig}>
        <NexusProvider>
          <Consumer onContext={(ctx) => (capturedCtx = ctx)} />
        </NexusProvider>
      </WagmiProvider>,
    );
    assert.equal(capturedCtx.identity?.clientId, "availproject.org");
    assert.notEqual(capturedCtx.identity?.clientId, "nexus-widget");

    // 2. On arcana.network, clientId is not set -> sends "arcana.network"
    (globalThis as any).window = {
      location: { hostname: "arcana.network", host: "arcana.network" },
    };
    renderToStaticMarkup(
      <WagmiProvider config={testWagmiConfig}>
        <NexusProvider config={{}}>
          <Consumer onContext={(ctx) => (capturedCtx = ctx)} />
        </NexusProvider>
      </WagmiProvider>,
    );
    assert.equal(capturedCtx.identity?.clientId, "arcana.network");
    assert.notEqual(capturedCtx.identity?.clientId, "nexus-widget");

    // 3. On example.com:3000, clientId is empty string -> sends "example.com"
    (globalThis as any).window = {
      location: { hostname: "example.com", host: "example.com:3000" },
    };
    renderToStaticMarkup(
      <WagmiProvider config={testWagmiConfig}>
        <NexusProvider config={{ identity: { clientId: "" } }}>
          <Consumer onContext={(ctx) => (capturedCtx = ctx)} />
        </NexusProvider>
      </WagmiProvider>,
    );
    assert.equal(capturedCtx.identity?.clientId, "example.com");

    // 4. On localhost:5173, clientId is not set -> sends "localhost"
    (globalThis as any).window = {
      location: { hostname: "localhost", host: "localhost:5173" },
    };
    renderToStaticMarkup(
      <WagmiProvider config={testWagmiConfig}>
        <NexusProvider>
          <Consumer onContext={(ctx) => (capturedCtx = ctx)} />
        </NexusProvider>
      </WagmiProvider>,
    );
    assert.equal(capturedCtx.identity?.clientId, "localhost");
    assert.notEqual(capturedCtx.identity?.clientId, "nexus-widget");

    // 5. On 127.0.0.1:3000, clientId is not set -> sends "localhost"
    (globalThis as any).window = {
      location: { hostname: "127.0.0.1", host: "127.0.0.1:3000" },
    };
    renderToStaticMarkup(
      <WagmiProvider config={testWagmiConfig}>
        <NexusProvider>
          <Consumer onContext={(ctx) => (capturedCtx = ctx)} />
        </NexusProvider>
      </WagmiProvider>,
    );
    assert.equal(capturedCtx.identity?.clientId, "localhost");

    // 6. On 192.168.1.5:8080, clientId is not set -> sends "localhost"
    (globalThis as any).window = {
      location: { hostname: "192.168.1.5", host: "192.168.1.5:8080" },
    };
    renderToStaticMarkup(
      <WagmiProvider config={testWagmiConfig}>
        <NexusProvider>
          <Consumer onContext={(ctx) => (capturedCtx = ctx)} />
        </NexusProvider>
      </WagmiProvider>,
    );
    assert.equal(capturedCtx.identity?.clientId, "localhost");
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
});

test("NexusProvider preserves explicit clientId when set (never overrides with domain)", () => {
  const originalWindow = (globalThis as any).window;
  try {
    function Consumer({ onContext }: { onContext: (ctx: any) => void }) {
      const ctx = useNexus();
      onContext(ctx);
      return null;
    }

    // Even on availproject.org, explicit clientId is respected
    (globalThis as any).window = {
      location: { hostname: "availproject.org", host: "availproject.org" },
    };
    let capturedCtx: any;
    renderToStaticMarkup(
      <WagmiProvider config={testWagmiConfig}>
        <NexusProvider config={{ identity: { clientId: "custom-partner-client" } }}>
          <Consumer onContext={(ctx) => (capturedCtx = ctx)} />
        </NexusProvider>
      </WagmiProvider>,
    );
    assert.equal(capturedCtx.identity?.clientId, "custom-partner-client");

    // Even on localhost, explicit clientId is respected
    (globalThis as any).window = {
      location: { hostname: "localhost", host: "localhost:3000" },
    };
    renderToStaticMarkup(
      <WagmiProvider config={testWagmiConfig}>
        <NexusProvider config={{ identity: { clientId: "dapp-xyz" } }}>
          <Consumer onContext={(ctx) => (capturedCtx = ctx)} />
        </NexusProvider>
      </WagmiProvider>,
    );
    assert.equal(capturedCtx.identity?.clientId, "dapp-xyz");
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
});
