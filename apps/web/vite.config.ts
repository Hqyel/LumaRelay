import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      target: "react",
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
});
