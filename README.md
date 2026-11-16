# DKASU Loyalty

Standalone customer and merchant loyalty app for **`https://loyalty.dkasu.com`**.

Uses the **shared** DKASU Supabase project (`ljaedextsenbkxzzgxcg`) — the same database as POS. There is no second loyalty database.

| Host | Application |
|------|-------------|
| `loyalty.dkasu.com` | **This** repository (standalone SPA) |
| `lyt.dkasu.com` | Built-in POS customer loyalty |
| `pos.dkasu.com` | Main POS |

Auth callbacks, password recovery, public card/join links, and Wallet flows in this app use **this origin** (`window.location.origin`). POS continues to generate built-in links for `lyt.dkasu.com`.

## Environment

Copy `.env.example` → `.env` (never commit `.env`):

```
VITE_SUPABASE_URL=https://ljaedextsenbkxzzgxcg.supabase.co
VITE_SUPABASE_ANON_KEY=<shared publishable/anon key>
```

Never put `service_role`, database passwords, or Wallet HMAC secrets in `VITE_*`.

## Scripts

```bash
npm install
npm run dev      # http://localhost:5174
npm test
npm run build    # tsc + vite → dist/
npm run preview
```

## Vercel

| Setting | Value |
|---------|--------|
| Root Directory | `.` (repository root) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Env | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only |

See `docs/LOYALTY_VERCEL_PREVIEW.md` for Auth / OAuth / Wallet / hostname cutover. Do not reassign production DNS without owner approval.

## Capabilities

**Customer:** sign-in / sign-up / Google / recovery, member profile, digital cards + QR, Google Wallet, activity, rewards, join-by-code, public card/join routes, password update.

**Merchant:** shop switcher (RPC/RLS enforced), KPIs, member search, join approve/reject, earning rules, reward catalogue, activity, card design, member lifecycle, spend promotions, personal offers.

Known gaps vs the POS hub are listed in `docs/LOYALTY_STANDALONE_FEATURE_GAPS.md`.
