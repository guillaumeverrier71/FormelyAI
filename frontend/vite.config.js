import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "FormelyAI – Fiches intelligentes",
        short_name: "FormelyAI",
        description: "Transforme tes cours en fiches de révision intelligentes en 30 secondes. Upload ton PDF, l'IA génère tes questions/réponses.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "fr",
        categories: ["education", "productivity"],
        icons: [
          { src: "icons/icon.svg",    sizes: "any",     type: "image/svg+xml", purpose: "any" },
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png",    purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png",    purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png",    purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^\/(sessions|upload|qa|export|auth|billing)/,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/upload": "http://localhost:8000",
      "/sessions": "http://localhost:8000",
      "/qa": "http://localhost:8000",
      "/export": "http://localhost:8000",
      "/auth": "http://localhost:8000",
      "/billing": "http://localhost:8000",
      "/library": "http://localhost:8000",
    },
  },
  build: {
    outDir: "../frontend/dist",
    emptyOutDir: true,
  },
});
