import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "API_");
  return {
    plugins: [react(), tailwindcss()],
    ...(env.API_PROXY_TARGET
      ? {
          server: {
            proxy: {
              "/api": { target: env.API_PROXY_TARGET, changeOrigin: false },
            },
          },
        }
      : {}),
  };
});
