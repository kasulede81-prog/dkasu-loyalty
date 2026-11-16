# Feature gaps vs POS loyalty hub

This app implements customer and merchant dashboards against **existing** shared-project RPCs, RLS, and Edge Functions. No second database.

## Done here

Customer auth/profile/cards/QR/Wallet, activity, rewards list, join-by-code, public routes, password update.  
Merchant KPIs, shop switch, member search, enrollment review, earning rules, reward catalogue, activity, card design, lifecycle, spend promotions, personal offers.

## Still POS-hub / backend-context limited

1. **Sale-linked reward redemption** (`loyalty_redeem_reward` with POS cart/sale) — stays in POS.
2. **Product-backed reward editor** — richer UI in POS `/office/loyalty`.
3. **Reward assignments** — use POS until ported (existing RPCs; no migration required for a UI port).
4. **Enrollment link regenerate/revoke chrome** — RPCs exist; public `/join/:token` already works.
5. **Merchant Wallet outbox drain** — operational tooling with POS/Edge.

Do not invent client-side privileges. New database capability needs an additive SQL proposal for owner review.
