import * as path from "path";
import type {
  ParsedImport,
  ClassifiedDependency,
  RegistryConfig,
} from "./types";

/**
 * Extract npm package name from import source
 * Handles scoped packages: @radix-ui/react-dialog -> @radix-ui/react-dialog
 * Handles subpaths: lucide-react/icons/X -> lucide-react
 */
export function extractPackageName(source: string): string {
  if (source.startsWith("@")) {
    // Scoped package: @scope/package or @scope/package/subpath
    const parts = source.split("/");
    return parts.slice(0, 2).join("/");
  }
  // Regular package: package or package/subpath
  return source.split("/")[0];
}

/**
 * Check if an import source is a relative path
 */
function isRelativePath(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../");
}

/**
 * Check if an import source is a path alias
 */
function isPathAlias(source: string, config: RegistryConfig): boolean {
  // Check exact matches first
  if (config.aliases[source]) {
    return true;
  }
  // Check prefix matches (e.g., "@/components/ui" matches "@/components/ui/button")
  for (const alias of Object.keys(config.aliases)) {
    if (source.startsWith(alias + "/") || source === alias) {
      return true;
    }
  }
  // Common alias patterns
  return source.startsWith("@/") || source.startsWith("~/");
}

/**
 * Resolve a path alias to its actual path
 */
function resolveAlias(
  source: string,
  config: RegistryConfig
): string | undefined {
  // Check exact match
  if (config.aliases[source]) {
    return config.aliases[source];
  }
  // Check prefix matches
  for (const [alias, target] of Object.entries(config.aliases)) {
    if (source.startsWith(alias + "/")) {
      const suffix = source.slice(alias.length + 1);
      return path.join(target, suffix);
    }
    if (source === alias) {
      return target;
    }
  }
  // Handle @/ prefix (common convention)
  if (source.startsWith("@/")) {
    return source.slice(2); // Remove @/ prefix
  }
  return undefined;
}

/**
 * Determine if a resolved path points to a registry component
 */
function getRegistryComponentFromPath(
  resolvedPath: string,
  config: RegistryConfig
): string | undefined {
  // Normalize path
  const normalizedPath = resolvedPath.replace(/\\/g, "/");

  // Check if path is within registry
  if (!normalizedPath.includes(config.registryPath)) {
    // Check for lib/utils special case
    if (normalizedPath === "lib/utils.ts" || normalizedPath === "lib/utils") {
      return "utils";
    }
    return undefined;
  }

  // Extract component name from path
  // registry/avail-widgets/ui/button.tsx -> button
  // registry/avail-widgets/deposit/components/... -> deposit
  const registryPrefix = config.registryPath + "/";
  const relativePath = normalizedPath.includes(registryPrefix)
    ? normalizedPath.split(registryPrefix)[1]
    : normalizedPath;

  const parts = relativePath.split("/");

  if (parts[0] === "ui") {
    // UI component: registry/avail-widgets/ui/button.tsx -> button
    const fileName = parts[1];
    if (fileName) {
      return fileName.replace(/\.(tsx?|jsx?)$/, "");
    }
  } else if (parts[0] === "nexus") {
    // Nexus provider (folder name -> registry name mapping)
    return "nexus-provider";
  } else if (parts[0] === "common") {
    // Common utilities are typically bundled with components, not separate
    return undefined;
  } else {
    // Complex widget: registry/avail-widgets/deposit/... -> deposit
    return parts[0];
  }

  return undefined;
}

/**
 * Classify a single import
 */
export function classifyImport(
  imp: ParsedImport,
  currentFilePath: string,
  config: RegistryConfig
): ClassifiedDependency {
  const { source } = imp;

  // 1. Check peer dependencies
  for (const peer of config.peerDependencies) {
    if (source === peer || source.startsWith(peer + "/")) {
      return { type: "peer", source };
    }
  }

  // 2. Check path aliases
  if (isPathAlias(source, config)) {
    const resolvedPath = resolveAlias(source, config);
    if (resolvedPath) {
      const componentName = getRegistryComponentFromPath(resolvedPath, config);
      if (componentName) {
        return {
          type: "registry",
          source,
          componentName,
        };
      }
    }
    return { type: "alias", source };
  }

  // 3. Check relative imports
  if (isRelativePath(source)) {
    const currentDir = path.dirname(currentFilePath);
    const resolvedPath = path.resolve(currentDir, source);
    const relativeToCwd = path.relative(process.cwd(), resolvedPath);

    // Check if it points to another registry component
    const componentName = getRegistryComponentFromPath(relativeToCwd, config);
    if (componentName) {
      // Check if it's the same component (local file) or different
      const currentComponent = getRegistryComponentFromPath(
        path.relative(process.cwd(), currentFilePath),
        config
      );
      if (componentName !== currentComponent) {
        return {
          type: "registry",
          source,
          componentName,
        };
      }
    }
    return { type: "local", source };
  }

  // 4. Must be an npm package
  const packageName = extractPackageName(source);
  const version = config.pinnedDependencies[packageName];

  return {
    type: "npm",
    source,
    packageName,
    version,
  };
}

/**
 * Classify all imports from a file
 */
export function classifyImports(
  imports: ParsedImport[],
  currentFilePath: string,
  config: RegistryConfig
): ClassifiedDependency[] {
  return imports.map((imp) => classifyImport(imp, currentFilePath, config));
}

/**
 * Aggregate dependencies from multiple files
 */
export function aggregateDependencies(
  allDependencies: ClassifiedDependency[]
): {
  npmDependencies: Set<string>;
  registryDependencies: Set<string>;
} {
  const npmDependencies = new Set<string>();
  const registryDependencies = new Set<string>();

  for (const dep of allDependencies) {
    if (dep.type === "npm" && dep.packageName) {
      // Format: package@version or just package
      const formatted = dep.version
        ? `${dep.packageName}@${dep.version}`
        : dep.packageName;
      npmDependencies.add(formatted);
    } else if (dep.type === "registry" && dep.componentName) {
      registryDependencies.add(dep.componentName);
    }
  }

  return { npmDependencies, registryDependencies };
}
