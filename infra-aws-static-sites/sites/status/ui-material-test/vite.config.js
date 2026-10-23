import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../dist/ui-material-test-build",
    emptyOutDir: true,
    assetsDir: "ui-material-test-assets",
  },
});
