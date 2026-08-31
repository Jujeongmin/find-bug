import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // The Verse8 editor preview serves the build from a sub-path, so every asset
  // URL has to be relative. Removing this gives a blank preview.
  base: "./",

  // The Agent8 SDK otherwise resolves its own React copy through Vite's dep
  // pre-bundling, which breaks hooks in dev. Bundling them together, rather
  // than excluding the SDK, keeps its CJS deps (lz4js) working.
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: {
    include: ["@agent8/gameserver", "react", "react-dom", "react/jsx-runtime"],
  },

  build: {
    outDir: "dist",
    reportCompressedSize: false,
    chunkSizeWarningLimit: 5000,
  },
});
