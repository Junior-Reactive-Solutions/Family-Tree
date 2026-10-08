import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React rarely changes: a separate file stays cached across deploys and keeps each file under 250 KB.
        manualChunks: (id) => (/node_modules[\/](react|react-dom|scheduler)[\/]/.test(id) ? "react" : undefined),
      },
    },
  },
  server: { port: 9901, strictPort: true, host: "localhost" },
  preview: { port: 9901, strictPort: true },
});
