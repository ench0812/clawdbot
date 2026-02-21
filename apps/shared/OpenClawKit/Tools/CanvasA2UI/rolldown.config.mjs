import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const uiRoot = path.resolve(repoRoot, "ui");
const fromHere = (p) => path.resolve(here, p);
const outputFile = path.resolve(
  here,
  "../../../../..",
  "src",
  "canvas-host",
  "a2ui",
  "a2ui.bundle.js",
);

const a2uiLitDist = path.resolve(repoRoot, "vendor/a2ui/renderers/lit/dist/src");
const a2uiThemeContext = path.resolve(a2uiLitDist, "0.8/ui/context/theme.js");
const uiNodeModules = path.resolve(uiRoot, "node_modules");
const repoNodeModules = path.resolve(repoRoot, "node_modules");

function resolveUiDependency(moduleId) {
  const candidates = [
    path.resolve(uiNodeModules, moduleId),
    path.resolve(repoNodeModules, moduleId),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const fallbackCandidates = candidates.join(", ");
  throw new Error(
    `A2UI bundle config cannot resolve ${moduleId}. Checked: ${fallbackCandidates}. ` +
      "Keep dependency installed in ui workspace or repo root before bundling.",
  );
}

// Rolldown incorrectly resolves signal-utils subpath exports via the "types"
// condition (→ .d.ts) instead of "default" (→ .js). Work around this by
// intercepting resolution with a plugin that rewrites to the dist JS files.
const signalUtilsBase = resolveUiDependency("signal-utils");
const signalUtilsPlugin = () => ({
  name: "signal-utils-fix",
  resolveId(source) {
    if (source.startsWith("signal-utils/")) {
      const subpath = source.slice("signal-utils/".length);
      return path.resolve(signalUtilsBase, "dist", `${subpath}.ts.js`);
    }
    return null;
  },
});

export default {
  input: fromHere("bootstrap.js"),
  experimental: {
    attachDebugInfo: "none",
  },
  treeshake: false,
  plugins: [signalUtilsPlugin()],
  resolve: {
    alias: {
      "@a2ui/lit": path.resolve(a2uiLitDist, "index.js"),
      "@a2ui/lit/ui": path.resolve(a2uiLitDist, "0.8/ui/ui.js"),
      "@openclaw/a2ui-theme-context": a2uiThemeContext,
      "@lit/context": resolveUiDependency("@lit/context"),
      "@lit/context/": resolveUiDependency("@lit/context/"),
      "@lit-labs/signals": resolveUiDependency("@lit-labs/signals"),
      "@lit-labs/signals/": resolveUiDependency("@lit-labs/signals/"),
      lit: resolveUiDependency("lit"),
      "lit/": resolveUiDependency("lit/"),
    },
  },
  output: {
    file: outputFile,
    format: "esm",
    codeSplitting: false,
    sourcemap: false,
  },
};
