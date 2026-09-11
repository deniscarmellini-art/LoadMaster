import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => {
  const development = command === "serve";
  if (development && mode === "production")
    throw new Error("Per PRODUZIONE usare scripts/start-production.ps1; Vite serve solo TEST");
  return {
    plugins: [react()],
    // Dev ignores legacy VITE_API_URL values, including machine .env.local.
    define: {
      "import.meta.env.VITE_SISLOG_TEST": JSON.stringify(development),
      ...(development ? { "import.meta.env.VITE_API_URL": JSON.stringify("/api") } : {}),
    },
    server: {
      host: "0.0.0.0", port: 5174, strictPort: true,
      // Reuse working certificates read-only. Production build does not read certificates.
      https: development ? {
        cert: readFileSync(fileURLToPath(new URL("../backend/certs/sislog-cert.pem", import.meta.url))),
        key: readFileSync(fileURLToPath(new URL("../backend/certs/sislog-key.pem", import.meta.url))),
      } : undefined,
      proxy: {
        "/api": { target: "http://127.0.0.1:3002", changeOrigin: true },
      },
    },
  };
});
