// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ protocolImports: true }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),

      // 🔒 Force one React/ReactDOM instance (fixes "Expected static flag was missing")
      react: resolve(__dirname, "node_modules/react"),
      "react-dom": resolve(__dirname, "node_modules/react-dom"),
    },

    // Extra safety when using linked/local packages
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["buffer", "process"],
    // If you’re linking local UI libs that import React, exclude them here so Vite
    // doesn’t prebundle their own copy (uncomment if relevant):
    // exclude: ["@reown/appkit", "@reown/appkit/react", "@reown/appkit-adapter-wagmi"],
  },
  define: {
    global: "globalThis",
    "process.env": {},
  },
});
