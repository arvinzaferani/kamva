import { resolve } from "node:path";
import { defineConfig } from "vite";

// Relative base so the demo works both locally (`npx serve dist`) and when
// GitHub Pages serves it from the /kamva/ subpath.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        docs: resolve(__dirname, "docs.html"),
      },
    },
  },
});