import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const readHttpsConfig = (certPath: string | undefined, keyPath: string | undefined) => {
  if (!certPath && !keyPath) return undefined;
  if (!certPath || !keyPath) throw new Error("Per abilitare HTTPS configurare sia VITE_HTTPS_CERT_PATH sia VITE_HTTPS_KEY_PATH");
  return {
    cert: readFileSync(resolve(certPath)),
    key: readFileSync(resolve(keyPath)),
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const certPath = process.env.VITE_HTTPS_CERT_PATH || env.VITE_HTTPS_CERT_PATH;
  const keyPath = process.env.VITE_HTTPS_KEY_PATH || env.VITE_HTTPS_KEY_PATH;
  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      https: readHttpsConfig(certPath, keyPath),
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
      },
    },
  };
});
