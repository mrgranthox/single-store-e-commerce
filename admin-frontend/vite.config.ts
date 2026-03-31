import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DEV_PROXY_TARGET?.trim() || "http://127.0.0.1:4000";

  return {
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true
      }
    }
  },
  build: {
    sourcemap: "hidden",
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("react-router")) {
            return "router-vendor";
          }

          if (id.includes("@tanstack/react-query")) {
            return "query-vendor";
          }

          if (id.includes("recharts") || id.includes("d3")) {
            return "charts-vendor";
          }

          if (id.includes("react") || id.includes("scheduler")) {
            return "react-vendor";
          }

          return "vendor";
        }
      }
    }
  }
};
});
