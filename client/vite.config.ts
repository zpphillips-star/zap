import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  build: {
    outDir: "../server/public",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libs into a separate cacheable chunk
          vendor: ["react", "react-dom"],
          markdown: ["marked", "dompurify"],
        },
      },
    },
  },
});
