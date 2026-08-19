import { defineConfig } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import dts from "rollup-plugin-dts";

/**
 * Roll every inlineable declaration into a single self-contained
 * `dist/index.d.ts`. The internal `@kamvachart/*` packages are resolved
 * through node_modules (their built `.d.ts`) and inlined because nothing is
 * declared external, so the published types never reference them.
 */
export default defineConfig({
  input: "src/index.ts",
  output: [{ file: "dist/index.d.ts", format: "es" }],
  plugins: [
    nodeResolve({
      extensions: [".ts", ".d.ts", ".js"],
      // Resolve each package's `types` (and fall back to import/default).
      exportConditions: ["types", "import", "default"],
    }),
    dts({
      // rollup-plugin-dts externalizes every library by default; opting the
      // internal packages in bundles their declarations into the one file.
      includeExternal: [
        "@kamvachart/chart-core",
        "@kamvachart/renderer-canvas",
        "@kamvachart/indicators",
      ],
    }),
  ],
  external: [],
});