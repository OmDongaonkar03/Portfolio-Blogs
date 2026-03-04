import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import sitemap from "vite-plugin-sitemap";
import fs from "fs";

// Read post slugs directly from the posts folder using Node fs
// Cannot import posts.ts here because it uses import.meta.glob (browser-only)
const postFiles = fs.existsSync("./src/posts")
  ? fs.readdirSync("./src/posts").filter((f) => f.endsWith(".md"))
  : [];

const postRoutes = postFiles.map((f) => `/blog/${f.replace(".md", "")}`);

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    sitemap({
      hostname: "https://blogs.omdongaonkar.in",
      dynamicRoutes: ["/", ...postRoutes],
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer",
    },
  },
  define: {
    global: "globalThis",
  },
}));
