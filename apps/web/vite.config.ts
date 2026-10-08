import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 9901, strictPort: true, host: "localhost" },
  preview: { port: 9901, strictPort: true },
});
