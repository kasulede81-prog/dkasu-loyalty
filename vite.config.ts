import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  if (
    mode === "production" &&
    (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY)
  ) {
    throw new Error(
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the standalone Loyalty build."
    );
  }
  return {
    root: __dirname,
    plugins: [react()],
    build: { outDir: "dist", emptyOutDir: true },
    server: { port: 5174 },
  };
});
