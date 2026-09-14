import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => {
  const development = command === "serve";
  const demo = development && mode === "demo";
  const test = development && !demo;
  const testCertificatePath = fileURLToPath(
    new URL("../backend/certs/sislog-cert.pem", import.meta.url),
  );
  const testKeyPath = fileURLToPath(
    new URL("../backend/certs/sislog-key.pem", import.meta.url),
  );
  const testHttps =
    test && existsSync(testCertificatePath) && existsSync(testKeyPath)
      ? {
          cert: readFileSync(testCertificatePath),
          key: readFileSync(testKeyPath),
        }
      : undefined;

  if (development && mode === "production")
    throw new Error("Per PRODUZIONE usare scripts/start-production.ps1; Vite serve solo TEST");
  return {
    plugins: [react()],
    // Dev ignores legacy VITE_API_URL values, including machine .env.local.
    define: {
      "import.meta.env.VITE_SISLOG_TEST": JSON.stringify(test),
      "import.meta.env.VITE_SISLOG_DEMO": JSON.stringify(demo),
      ...(development ? { "import.meta.env.VITE_API_URL": JSON.stringify("/api") } : {}),
    },
    server: {
      host: "0.0.0.0", port: demo ? 5175 : 5174, strictPort: true,
      // HTTPS is enabled only when the local TEST certificates are available.
      https: testHttps,
      proxy: {
        "/api": { target: demo ? "http://127.0.0.1:3003" : "http://127.0.0.1:3002", changeOrigin: true },
      },
    },
  };
});
