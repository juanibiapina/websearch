import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    target: "node22",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      formats: ["es"],
      fileName: () => "websearch.js",
    },
    rollupOptions: {
      external: [
        // Node.js built-ins must resolve at runtime, not be browser-stubbed
        /^node:/,
        // Keep deps with Node.js built-in requirements external
        "jsdom",
        "commander",
        // CommonJS package with dynamic requires (graceful-fs); resolve at runtime
        "proper-lockfile",
      ],
      output: {
        banner: "#!/usr/bin/env node",
      },
    },
  },
});
