import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repoRoot, "packages", "widgets");
const sourceRoot = path.join(packageRoot, ".build-src");
const distRoot = path.join(packageRoot, "dist");
const registryRoot = path.join(repoRoot, "registry", "avail-widgets");

const copy = (from, to) => {
  cpSync(from, to, {
    recursive: true,
    filter: (source) => !source.endsWith(".DS_Store"),
  });
};

const walk = (dir, files = []) => {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, files);
    } else if (/\.[cm]?[jt]sx?$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
};

const toImportPath = (fromFile, toFile) => {
  let relativePath = path.relative(path.dirname(fromFile), toFile).replaceAll(path.sep, "/");
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }
  return relativePath.replace(/\.(tsx?|jsx?)$/u, "");
};

rmSync(sourceRoot, { recursive: true, force: true });
rmSync(distRoot, { recursive: true, force: true });
mkdirSync(sourceRoot, { recursive: true });

copy(path.join(registryRoot, "common"), path.join(sourceRoot, "common"));
copy(path.join(registryRoot, "nexus"), path.join(sourceRoot, "nexus"));
copy(path.join(registryRoot, "nexus-widget"), path.join(sourceRoot, "nexus-widget"));

mkdirSync(path.join(sourceRoot, "ui"), { recursive: true });
copy(path.join(registryRoot, "ui", "button.tsx"), path.join(sourceRoot, "ui", "button.tsx"));
copy(path.join(registryRoot, "ui", "dialog.tsx"), path.join(sourceRoot, "ui", "dialog.tsx"));

mkdirSync(path.join(sourceRoot, "swaps", "components"), { recursive: true });
for (const fileName of [
  "stacked-token-icons.tsx",
  "step-flow.tsx",
  "token-icon.tsx",
  "transaction-progress.tsx",
]) {
  copy(
    path.join(registryRoot, "swaps", "components", fileName),
    path.join(sourceRoot, "swaps", "components", fileName)
  );
}

mkdirSync(path.join(sourceRoot, "lib"), { recursive: true });
copy(path.join(repoRoot, "lib", "utils.ts"), path.join(sourceRoot, "lib", "utils.ts"));

writeFileSync(
  path.join(sourceRoot, "index.ts"),
  [
    'export { NexusWidget, default } from "./nexus-widget/nexus-widget";',
    'export type { NexusWidgetConfig, NexusWidgetProps } from "./nexus-widget/types";',
    'export { default as NexusProvider, NexusContext, useNexus } from "./nexus/NexusProvider";',
    'export type { UserAsset } from "./nexus/NexusProvider";',
    "",
  ].join("\n")
);

const utilsPath = path.join(sourceRoot, "lib", "utils.ts");
for (const filePath of walk(sourceRoot)) {
  let source = readFileSync(filePath, "utf8");
  if (!source.includes("@/lib/utils")) continue;
  const relativeUtilsPath = toImportPath(filePath, utilsPath);
  source = source
    .replaceAll('from "@/lib/utils"', `from "${relativeUtilsPath}"`)
    .replaceAll("from '@/lib/utils'", `from '${relativeUtilsPath}'`);
  writeFileSync(filePath, source);
}

const localTsc = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsc.cmd" : "tsc"
);
const localTscScript = path.join(
  repoRoot,
  "node_modules",
  "typescript",
  "bin",
  "tsc"
);

if (existsSync(localTsc)) {
  execFileSync(localTsc, ["-p", path.join(packageRoot, "tsconfig.build.json")], {
    cwd: packageRoot,
    stdio: "inherit",
  });
} else if (existsSync(localTscScript)) {
  execFileSync(
    process.execPath,
    [localTscScript, "-p", path.join(packageRoot, "tsconfig.build.json")],
    {
      cwd: packageRoot,
      stdio: "inherit",
    }
  );
} else {
  execFileSync("tsc", ["-p", path.join(packageRoot, "tsconfig.build.json")], {
    cwd: packageRoot,
    stdio: "inherit",
  });
}
