import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("DKASU Loyalty standalone repo contracts", () => {
  it("targets the shared Supabase project in env example", () => {
    const env = read(".env.example");
    expect(env).toContain("ljaedextsenbkxzzgxcg");
    expect(env).toContain("VITE_SUPABASE_URL");
    expect(env).toContain("VITE_SUPABASE_ANON_KEY");
    expect(env).not.toMatch(/VITE_SUPABASE_SERVICE|SERVICE_ROLE_KEY|sb_secret_/);
    expect(env).toMatch(/never service_role/i);
  });

  it("does not import POS source modules", () => {
    const files = [
      "src/api.ts",
      "src/App.tsx",
      "src/MerchantControls.tsx",
      "src/MerchantAdvanced.tsx",
      "src/main.tsx",
    ];
    for (const file of files) {
      const text = read(file);
      expect(text, file).not.toMatch(/from\s+["']\.\.\/\.\.\/src\//);
      expect(text, file).not.toMatch(/DkasuPOS|pos-waka|apps\/pos/i);
      expect(text, file).not.toMatch(/VITE_SUPABASE_SERVICE|SERVICE_ROLE_KEY|sb_secret_/);
    }
  });

  it("auth redirects use this app origin (loyalty.dkasu.com in production)", () => {
    const app = read("src/App.tsx");
    expect(app).toContain("window.location.origin");
    expect(app).toContain("/auth/callback");
    expect(app).toContain("/reset-password");
  });

  it("Vercel config builds dist from repository root", () => {
    const vercel = JSON.parse(read("vercel.json")) as {
      rewrites?: unknown[];
    };
    expect(Array.isArray(vercel.rewrites)).toBe(true);
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toContain("vite build");
  });
});
