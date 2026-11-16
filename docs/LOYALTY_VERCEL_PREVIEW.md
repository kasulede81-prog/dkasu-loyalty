# Vercel Preview readiness — DKASU Loyalty

**Do not deploy production or reassign DNS from the agent.** Owner approval required.

## Project settings

| Item | Value |
|------|--------|
| GitHub | `kasulede81-prog/dkasu-loyalty` |
| Root Directory | `.` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Supabase | `ljaedextsenbkxzzgxcg` (shared with POS) |

## Browser environment

```
VITE_SUPABASE_URL=https://ljaedextsenbkxzzgxcg.supabase.co
VITE_SUPABASE_ANON_KEY=<shared publishable/anon key>
```

Never set `service_role`, database passwords, or Wallet HMAC secrets in `VITE_*`.

## Hosted Supabase Auth (manual)

Allow for both loyalty surfaces during transition:

- `https://loyalty.dkasu.com/auth/callback`
- `https://loyalty.dkasu.com/auth/recovery`
- `https://loyalty.dkasu.com/reset-password`
- `https://lyt.dkasu.com/auth/callback` (POS built-in)
- `https://lyt.dkasu.com/auth/recovery`
- `https://lyt.dkasu.com/reset-password`
- Preview: `https://<preview>.vercel.app/auth/callback` (and recovery/reset as used)

## Google OAuth

Authorized JavaScript origins: `https://loyalty.dkasu.com`, `https://lyt.dkasu.com`, `https://pos.dkasu.com`, plus Preview origins under test.

## Google Wallet

If `WALLET_ALLOWED_ORIGINS` is set on Edge Functions, include `https://loyalty.dkasu.com` and `https://lyt.dkasu.com`.

## Hostname cutover (owner-only)

1. Preview smoke on this Vercel project.
2. Keep POS serving `lyt.dkasu.com` with built-in loyalty links.
3. Point `loyalty.dkasu.com` at this project (remove from POS) in the same window.
4. Verify sign-in returns, `/c/:token`, `/j/:code`, Wallet, merchant shop switch; POS `/office/loyalty` remains on `pos.dkasu.com`.

Rollback: reassign `loyalty.dkasu.com` to POS; leave the shared database untouched.
