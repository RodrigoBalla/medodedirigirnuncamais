import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Em produção, derruba console.log/debugger pra não vazar fluxo de auth
  // e reduzir tamanho do bundle. Em dev, mantém pra facilitar troubleshooting.
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  build: {
    // Code-splitting: separa bibliotecas pesadas em chunks próprios pra cache
    // e download paralelo. Reduz o initial load de ~960 KB pra ~250-400 KB.
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": [
            "framer-motion",
            "lucide-react",
            "@radix-ui/react-dialog",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-toast",
          ],
          "supabase": ["@supabase/supabase-js"],
          "tanstack": ["@tanstack/react-query"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
