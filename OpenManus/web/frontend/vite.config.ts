import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:8181",
        ws: true,
      },
      "/api": {
        target: "http://localhost:8181",
      },
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
