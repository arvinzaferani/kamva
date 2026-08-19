import { defineConfig } from "tsup";

/**
 * Bundle the single public package's JavaScript. chart-core,
 * renderer-canvas and indicators are devDependencies, and `noExternal` forces
 * their code into the output so `dist/index.js` is fully self-contained —
 * exactly what a standalone `npm i kamvachart` needs (zero runtime deps).
 *
 * Types are produced separately by rollup-plugin-dts (see
 * rollup.dts.config.mjs) so no `@kamvachart/*` reference leaks into the
 * published `.d.ts` either.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  sourcemap: true,
  clean: true,
  target: "es2022",
  outDir: "dist",
  noExternal: [/@kamvachart\/.*/],
});