/**
 * Configuration for the registry builder
 */
export interface RegistryConfig {
  /** Registry name (e.g., "nexus-elements") */
  name: string;
  /** Namespace for shadcn CLI (e.g., "nexus-elements") */
  namespace: string;
  /** Homepage URL */
  homepage: string;
  /** Base URL for registry dependencies */
  baseUrl: string;
  /** Path to registry folder relative to project root */
  registryPath: string;
  /** Output path for registry.json */
  outputPath: string;
  /** Dependencies that should be excluded (peer deps like react) */
  peerDependencies: string[];
  /** Dependencies with pinned versions */
  pinnedDependencies: Record<string, string>;
  /** Path alias mappings (e.g., "@/lib/utils" -> "lib/utils.ts") */
  aliases: Record<string, string>;
  /** Target prefix for installed components (e.g., "components") */
  targetPrefix: string;
  /** Target path for lib utilities */
  libTarget: string;
  /** Component metadata overrides */
  componentOverrides: Record<string, ComponentOverride>;
}

export interface ComponentOverride {
  title?: string;
  description?: string;
  docs?: string;
  meta?: Record<string, unknown>;
  /** Additional npm dependencies not detected from imports */
  additionalDependencies?: string[];
  /** Skip this component */
  skip?: boolean;
  /** Override the component name (for folder->name mapping) */
  name?: string;
  /** Override the installed component folder/file name. */
  targetName?: string;
}

/**
 * Parsed import from a source file
 */
export interface ParsedImport {
  /** The import source/path */
  source: string;
  /** Whether this is a type-only import */
  isTypeOnly: boolean;
}

/**
 * Classification of a dependency
 */
export type DependencyType =
  | "npm" // External npm package
  | "registry" // Another component in the registry
  | "local" // Local file within same component
  | "peer" // Peer dependency (excluded)
  | "alias"; // Path alias that needs resolution

export interface ClassifiedDependency {
  type: DependencyType;
  source: string;
  /** For npm deps: the package name */
  packageName?: string;
  /** For registry deps: the component name */
  componentName?: string;
  /** Resolved version (if pinned) */
  version?: string;
}

/**
 * Component type detection
 */
export type ComponentType =
  | "ui-primitive" // Single file in ui/ folder
  | "complex-widget" // Folder with substructure
  | "shared" // Shared utilities (common/)
  | "provider"; // Context provider (nexus/)

export interface ScannedComponent {
  /** Component name (kebab-case) */
  name: string;
  /** Detected component type */
  type: ComponentType;
  /** Absolute path to component folder or file */
  path: string;
  /** All files belonging to this component */
  files: string[];
  /** Main entry file */
  entryFile?: string;
}

/**
 * shadcn registry schema types
 */
export interface RegistryFile {
  /** Source path in registry */
  path: string;
  /** Target path in user's project */
  target: string;
  /** File type */
  type: "registry:component";
}

export interface RegistryItem {
  /** Component name (kebab-case) */
  name: string;
  /** Item type */
  type: "registry:component";
  /** Human-readable title */
  title: string;
  /** Description */
  description: string;
  /** npm dependencies */
  dependencies?: string[];
  /** URLs to other registry components */
  registryDependencies?: string[];
  /** Additional metadata consumed by registry clients */
  meta?: Record<string, unknown>;
  /** Documentation text for registry clients */
  docs?: string;
  /** Files to install */
  files: RegistryFile[];
}

export interface Registry {
  $schema: string;
  name: string;
  namespace: string;
  homepage: string;
  items: RegistryItem[];
}
