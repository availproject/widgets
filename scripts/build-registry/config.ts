import * as fs from "fs";
import * as path from "path";
import type { RegistryConfig } from "./types";

const DEFAULT_CONFIG: RegistryConfig = {
  name: "nexus-elements",
  namespace: "nexus-elements",
  homepage: "https://elements.nexus.availproject.org",
  baseUrl: "https://develop.elements.nexus.availproject.org/r",
  registryPath: "registry/nexus-elements",
  outputPath: "registry.json",
  peerDependencies: ["react", "react-dom"],
  pinnedDependencies: {
    "@avail-project/nexus-core": "github:availproject/nexus-sdk#6829e4ccac5c913656e623758382d5d23b7a5379",
  },
  aliases: {
    "@/lib/utils": "lib/utils.ts",
    "@/components/ui": "registry/nexus-elements/ui",
    "@/components": "registry/nexus-elements",
  },
  targetPrefix: "components",
  libTarget: "lib",
  componentOverrides: {
    "fast-bridge": {
      title: "Fast Bridge",
      description:
        "A simple component built with Nexus to enable cross chain bridging",
    },
    "fast-transfer": {
      title: "Fast Transfer",
      description:
        "A simple component built with Nexus to enable cross chain transfer",
    },
    "nexus-provider": {
      title: "Nexus Provider",
      description: "Shared Nexus SDK provider and types for Nexus Elements",
    },
    deposit: {
      title: "Deposit",
      description: "A simple component built with Nexus to enable deposits",
    },
    swaps: {
      title: "Swaps",
      description: "Swap tokens across chains (Exact In)",
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
      title: "All Elements",
      description: "Install all Nexus Elements in one command",
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
