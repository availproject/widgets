import * as path from "path";
import type {
  RegistryConfig,
  ScannedComponent,
  Registry,
  RegistryItem,
  RegistryFile,
  ClassifiedDependency,
} from "./types";
import { parseImports, deduplicateImports } from "./parser";
import {
  classifyImports,
  aggregateDependencies,
} from "./dependency-resolver";
import { scanRegistry, getCommonFiles } from "./scanner";

/**
 * Convert a component name to title case
 */
function toTitleCase(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Generate default description for a component
 */
function generateDescription(
  component: ScannedComponent,
  config: RegistryConfig
): string {
  const override = config.componentOverrides[component.name];
  if (override?.description) {
    return override.description;
  }

  switch (component.type) {
    case "ui-primitive":
      return `UI primitive: ${toTitleCase(component.name)}`;
    case "complex-widget":
      return `A component built with Nexus for ${component.name.replace(/-/g, " ")} functionality`;
    case "provider":
      return "Nexus SDK provider and context";
    case "shared":
      return "Shared utilities and hooks";
    default:
      return `${toTitleCase(component.name)} component`;
  }
}

/**
 * Get title for a component
 */
function getTitle(
  component: ScannedComponent,
  config: RegistryConfig
): string {
  const override = config.componentOverrides[component.name];
  if (override?.title) {
    return override.title;
  }
  return toTitleCase(component.name);
}

/**
 * Convert absolute file path to registry path
 */
function toRegistryPath(filePath: string, projectRoot: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

/**
 * Convert registry path to target path
 */
function toTargetPath(
  registryPath: string,
  component: ScannedComponent,
  config: RegistryConfig
): string {
  // Special case for lib/utils.ts
  if (registryPath.startsWith("lib/")) {
    return registryPath;
  }

  // For registry components, convert to target prefix
  // registry/nexus-elements/ui/button.tsx -> components/ui/button.tsx
  // registry/nexus-elements/deposit/deposit.tsx -> components/deposit/deposit.tsx
  const registryPrefix = config.registryPath + "/";
  if (registryPath.startsWith(registryPrefix)) {
    const relativePath = registryPath.slice(registryPrefix.length);
    return `${config.targetPrefix}/${relativePath}`;
  }

  return registryPath;
}

/**
 * Build files array for a component
 */
function buildFilesArray(
  component: ScannedComponent,
  config: RegistryConfig,
  includeCommon: boolean
): RegistryFile[] {
  const projectRoot = process.cwd();
  const files: RegistryFile[] = [];
  const seenPaths = new Set<string>();

  // Add component's own files
  for (const file of component.files) {
    const registryPath = toRegistryPath(file, projectRoot);
    if (seenPaths.has(registryPath)) continue;
    seenPaths.add(registryPath);

    files.push({
      path: registryPath,
      target: toTargetPath(registryPath, component, config),
      type: "registry:component",
    });
  }

  // Add common files for complex widgets
  if (includeCommon && component.type === "complex-widget") {
    const commonFiles = getCommonFiles(config);
    for (const file of commonFiles) {
      const registryPath = toRegistryPath(file, projectRoot);
      if (seenPaths.has(registryPath)) continue;
      seenPaths.add(registryPath);

      files.push({
        path: registryPath,
        target: toTargetPath(registryPath, component, config),
        type: "registry:component",
      });
    }
  }

  return files;
}

/**
 * Analyze dependencies for a component
 */
function analyzeDependencies(
  component: ScannedComponent,
  config: RegistryConfig
): { npmDeps: string[]; registryDeps: string[] } {
  const allDependencies: ClassifiedDependency[] = [];

  // Parse and classify imports from all component files
  for (const file of component.files) {
    try {
      const imports = parseImports(file);
      const dedupedImports = deduplicateImports(imports);
      const classified = classifyImports(dedupedImports, file, config);
      allDependencies.push(...classified);
    } catch (error) {
      console.warn(`Warning: Could not parse ${file}: ${error}`);
    }
  }

  // Aggregate
  const { npmDependencies, registryDependencies } =
    aggregateDependencies(allDependencies);

  // Remove self-references from registry dependencies
  registryDependencies.delete(component.name);

  // Also remove special mappings (e.g., if component is "transfer", remove "fast-transfer")
  if (component.name === "transfer") {
    registryDependencies.delete("fast-transfer");
  }

  return {
    npmDeps: Array.from(npmDependencies).sort(),
    registryDeps: Array.from(registryDependencies).sort(),
  };
}

/**
 * Convert registry component names to full URLs
 */
function toRegistryUrls(componentNames: string[], config: RegistryConfig): string[] {
  return componentNames.map((name) => `${config.baseUrl}/${name}.json`);
}

/**
 * Get the registry name for a component (may be different from folder name)
 */
function getRegistryName(
  component: ScannedComponent,
  config: RegistryConfig
): string {
  const override = config.componentOverrides[component.name];
  if (override?.name) {
    return override.name;
  }
  return component.name;
}

/**
 * Build a single registry item
 */
function buildRegistryItem(
  component: ScannedComponent,
  config: RegistryConfig
): RegistryItem | null {
  // Check if component should be skipped
  const override = config.componentOverrides[component.name];
  if (override?.skip) {
    return null;
  }

  // Determine if we should include common files
  const includeCommon = component.type === "complex-widget";

  // Build files array
  const files = buildFilesArray(component, config, includeCommon);

  // Analyze dependencies
  const { npmDeps, registryDeps } = analyzeDependencies(component, config);

  // Add additional dependencies from overrides
  const additionalDeps = override?.additionalDependencies || [];
  const allNpmDeps = [...new Set([...npmDeps, ...additionalDeps])].sort();

  // Get the registry name (may be different from folder name)
  const registryName = getRegistryName(component, config);

  // Build the registry item
  const item: RegistryItem = {
    name: registryName,
    type: "registry:component",
    title: getTitle(component, config),
    description: generateDescription(component, config),
    files,
  };

  // Only add dependencies if they exist
  if (allNpmDeps.length > 0) {
    item.dependencies = allNpmDeps;
  }

  if (registryDeps.length > 0) {
    item.registryDependencies = toRegistryUrls(registryDeps, config);
  }

  if (override?.meta) {
    item.meta = override.meta;
  }

  if (override?.docs) {
    item.docs = override.docs;
  }

  return item;
}

/**
 * Build the complete registry
 */
export function buildRegistry(config: RegistryConfig): Registry {
  // Scan for components
  const components = scanRegistry(config);

  console.log(`Found ${components.length} components`);

  // Build registry items
  const items: RegistryItem[] = [];

  for (const component of components) {
    console.log(`Processing: ${component.name} (${component.type})`);
    const item = buildRegistryItem(component, config);
    if (item) {
      items.push(item);
    }
  }

  // Sort items by name for consistency
  items.sort((a, b) => a.name.localeCompare(b.name));

  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: config.name,
    namespace: config.namespace,
    homepage: config.homepage,
    items,
  };
}

/**
 * Validate the generated registry
 */
export function validateRegistry(registry: Registry): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!registry.name) errors.push("Missing registry name");
  if (!registry.namespace) errors.push("Missing registry namespace");
  if (!registry.items || registry.items.length === 0) {
    warnings.push("Registry has no items");
  }

  // Validate each item
  for (const item of registry.items) {
    if (!item.name) errors.push(`Item missing name`);
    if (!item.files || item.files.length === 0) {
      warnings.push(`Item "${item.name}" has no files`);
    }

    // Check for circular dependencies
    if (item.registryDependencies) {
      for (const dep of item.registryDependencies) {
        const depName = dep.split("/").pop()?.replace(".json", "");
        if (depName === item.name) {
          errors.push(`Item "${item.name}" has circular dependency on itself`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
