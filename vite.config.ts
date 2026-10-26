import { defineConfig } from "vite";

// GitHub Pages project site: https://<user>.github.io/Hearthland/
export default defineConfig({
  base: "/Hearthland/",
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
