import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

/**
 * Vite embeds VITE_* at build time. On Vercel, set Project → Settings → Environment Variables:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY  (publishable/anon — never service_role)
 * for Production and Preview. Missing values do not fail the build; the SPA shows a config
 * notice at runtime via `configured` in src/api.ts.
 */
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, rootDir, "VITE_");
  const url =
    process.env.VITE_SUPABASE_URL?.trim() ||
    fileEnv.VITE_SUPABASE_URL?.trim() ||
    "";
  const key =
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    fileEnv.VITE_SUPABASE_ANON_KEY?.trim() ||
    fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    "";

  if (mode === "production" && (!url || !key)) {
    console.warn(
      "[dkasu-loyalty] VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are unset. " +
        "The production bundle will build, but the app cannot talk to Supabase until " +
        "those variables are set in the Vercel project (Preview + Production).",
    );
  }

  return {
    root: rootDir,
    plugins: [react()],
    build: { outDir: "dist", emptyOutDir: true },
    server: { port: 5174 },
  };
});
