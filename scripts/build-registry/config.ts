import * as fs from "fs";
import * as path from "path";
import type { RegistryConfig } from "./types";

const DEFAULT_CONFIG: RegistryConfig = {
  name: "avail-widgets",
  namespace: "avail-widgets",
  homepage: "https://elements.nexus.availproject.org",
  baseUrl: "https://develop.elements.nexus.availproject.org/r",
  registryPath: "registry/avail-widgets",
  outputPath: "registry.json",
  peerDependencies: ["react", "react-dom"],
  pinnedDependencies: {
    "@avail-project/nexus-core": "2.0.0",
  },
  aliases: {
    "@/lib/utils": "lib/utils.ts",
    "@/components/ui": "registry/avail-widgets/ui",
    "@/components": "registry/avail-widgets",
  },
  targetPrefix: "components",
  libTarget: "lib",
  componentOverrides: {
    "fast-bridge": {
      title: "Fast Bridge",
      description:
        "Deprecated: use Nexus Widget instead. A legacy component built with Nexus to enable cross chain bridging.",
      docs: "Deprecated in favor of Nexus Widget. Use @avail-widgets/nexus for new integrations.",
      meta: {
        deprecated: true,
        deprecationMessage:
          "Fast Bridge is deprecated in favor of Nexus Widget. Use @avail-widgets/nexus for new integrations.",
      },
    },
    "fast-transfer": {
      title: "Fast Transfer",
      description:
        "Deprecated: use Nexus Widget instead. A legacy component built with Nexus to enable cross chain transfer.",
      docs: 'Deprecated in favor of Nexus Widget. Use @avail-widgets/nexus with config.mode = "send" for new integrations.',
      meta: {
        deprecated: true,
        deprecationMessage:
          'Fast Transfer is deprecated in favor of Nexus Widget. Use @avail-widgets/nexus with config.mode = "send" for new integrations.',
      },
    },
    transfer: {
      title: "Fast Transfer",
      description:
        "Deprecated: use Nexus Widget instead. A legacy component built with Nexus to enable cross chain transfer.",
      docs: 'Deprecated in favor of Nexus Widget. Use @avail-widgets/nexus with config.mode = "send" for new integrations.',
      meta: {
        deprecated: true,
        deprecationMessage:
          'Fast Transfer is deprecated in favor of Nexus Widget. Use @avail-widgets/nexus with config.mode = "send" for new integrations.',
      },
    },
    "nexus-provider": {
      title: "Nexus Provider",
      description: "Shared Nexus SDK provider and types for Avail Widgets",
    },
    deposit: {
      title: "Deposit",
      description:
        "Deprecated: use Nexus Widget instead. A legacy component built with Nexus to enable deposits.",
      docs: 'Deprecated in favor of Nexus Widget. Use @avail-widgets/nexus with config.mode = "deposit" and opportunities for new integrations.',
      meta: {
        deprecated: true,
        deprecationMessage:
          'Deposit is deprecated in favor of Nexus Widget. Use @avail-widgets/nexus with config.mode = "deposit" and opportunities for new integrations.',
      },
    },
    swaps: {
      title: "Swaps",
      description:
        "Deprecated: use Nexus Widget instead. Legacy swap tokens across chains component.",
      docs: 'Deprecated in favor of Nexus Widget. Use @avail-widgets/nexus with config.mode = "swap" for new integrations.',
      meta: {
        deprecated: true,
        deprecationMessage:
          'Swaps is deprecated in favor of Nexus Widget. Use @avail-widgets/nexus with config.mode = "swap" for new integrations.',
      },
    },
    "unified-balance": {
      title: "Unified Balance",
      description:
        "A simple component built with Nexus to display unified balance",
    },
    "view-history": {
      title: "View History",
      description:
        "A simple component built with Nexus to display view history",
    },
    all: {
      title: "All Widgets",
      description:
        "Install all Avail widgets. For new integrations, use @avail-widgets/nexus instead - it provides unified swap, send, and deposit in one component.",
    },
    utils: {
      title: "Utils (cn)",
      description: "Utility helpers used by UI components",
    },
  },
};

/**
 * Load configuration from file or use defaults
 */
export function loadConfig(
  configPath?: string,
  overrides?: Partial<RegistryConfig>,
): RegistryConfig {
  let config = { ...DEFAULT_CONFIG };

  // Determine config file path
  const defaultConfigPath = "registry.config.json";
  const resolvedPath = configPath
    ? path.resolve(process.cwd(), configPath)
    : path.resolve(process.cwd(), defaultConfigPath);

  // Load from config file if it exists
  if (fs.existsSync(resolvedPath)) {
    const fileConfig = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
    // Deep merge componentOverrides
    config = {
      ...config,
      ...fileConfig,
      componentOverrides: {
        ...config.componentOverrides,
        ...fileConfig.componentOverrides,
      },
      pinnedDependencies: {
        ...config.pinnedDependencies,
        ...fileConfig.pinnedDependencies,
      },
      aliases: {
        ...config.aliases,
        ...fileConfig.aliases,
      },
    };
  }

  // Apply CLI overrides
  if (overrides) {
    config = { ...config, ...overrides };
  }

  return config;
}

/**
 * Get the project root directory
 */
export function getProjectRoot(): string {
  // Walk up from current directory to find package.json
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export { DEFAULT_CONFIG };
