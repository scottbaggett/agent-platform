import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";

const config = defineConfig({
  plugins: [
    nitroV2Plugin(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    host: true, // Listen on all addresses (0.0.0.0) for Docker
    port: 3000,
    strictPort: true,
    watch: {
      usePolling: true, // Required for Docker volume mounts to detect changes
      interval: 100, // Polling interval in ms
    },
    hmr: {
      host: "localhost", // HMR client connects to localhost
      port: 3000,
    },
  },
});

export default config;
