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
                // Function form required to match sub-path imports like highlight.js/lib/languages/bash
                manualChunks: function (id) {
                    if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
                        return "vendor";
                    }
                    if (id.includes("node_modules/marked") ||
                        id.includes("node_modules/dompurify") ||
                        id.includes("node_modules/highlight.js")) {
                        return "markdown";
                    }
                },
            },
        },
    },
});
