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
      port: 5175,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts"
    }
  };
});
