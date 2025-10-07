// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true, // allows `node:buffer` style if any dep uses it
    }),
  ],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  optimizeDeps: {
    include: ["buffer", "process"],
    // exclude: ["@reown/appkit", "@reown/appkit/react", "@reown/appkit-adapter-wagmi"], // optional
  },
  define: {
    global: "globalThis",
    "process.env": {},
  },
});
