import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
export const configured = Boolean(url && key);
export const db = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;

export type Json = Record<string, unknown>;
export type Shop = { id: string; name: string; business_type: string | null };
export type MerchantOverview = {
  program: Json | null;
  members_total: number;
  members_active: number;
  points_issued: number;
  points_redeemed: number;
  recent_activity: Json[];
};
export type MerchantAccount = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  balance_points: number;
  lifetime_earned_points: number;
  membership_active: boolean;
};
export type JoinRequest = {
  id: string;
  name: string;
  phone_e164: string;
  requested_at: string;
  status: string;
};
export type MemberAccount = {
  link_id: string;
  shop: { id: string; name: string; business_type: string | null };
  account: {
    status: string;
    balance_points: number;
    lifetime_earned_points: number;
    lifetime_redeemed_points: number;
    membership_expires_at: string | null;
    google_wallet_issued_at?: string | null;
    google_wallet_sync_balance?: number | null;
  };
  card: {
    has_public_card: boolean;
    qr_token?: string | null;
    member_number?: string | null;
    member_cvc?: string | null;
  };
};
export type MemberDashboard = {
  member: {
    display_name: string | null;
    phone_e164_masked: string | null;
    email: string | null;
    status: string;
    member_since: string | null;
  };
  accounts: MemberAccount[];
  counts: { linked_accounts: number; active_accounts: number };
};

function requireDb() {
  if (!db) throw new Error("This app has no database configuration.");
  return db;
}

async function rpc<T extends Json>(name: string, args: Json = {}): Promise<T> {
  const { data, error } = await requireDb().rpc(name, args);
  if (error) throw new Error(error.message);
  const value = (
    typeof data === "string" ? JSON.parse(data) : data
  ) as T | null;
  if (!value || value.ok !== true)
    throw new Error(String(value?.error ?? "This information is unavailable."));
  return value;
}

export async function shops(): Promise<Shop[]> {
  const { data, error } = await requireDb()
    .from("shops")
    .select("id,name,business_type")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Shop[];
}

export async function merchantOverview(
  shopId: string
): Promise<MerchantOverview> {
  return rpc<MerchantOverview & Json>("loyalty_shop_overview", {
    p_shop_id: shopId,
  });
}

export async function merchantAccounts(
  shopId: string,
  query = "",
  status = "all"
): Promise<MerchantAccount[]> {
  const data = await rpc<{ accounts: MerchantAccount[] } & Json>(
    "loyalty_search_accounts",
    {
      p_shop_id: shopId,
      p_query: query.trim() || null,
      p_status: status,
      p_limit: 50,
    }
  );
  return data.accounts ?? [];
}

export async function merchantRequests(shopId: string): Promise<JoinRequest[]> {
  const data = await rpc<{ requests: JoinRequest[] } & Json>(
    "loyalty_list_enrollment_requests",
    {
      p_shop_id: shopId,
      p_status: "pending",
      p_limit: 100,
    }
  );
  return data.requests ?? [];
}

export async function reviewRequest(
  shopId: string,
  requestId: string,
  action: "approve" | "reject"
) {
  return rpc("loyalty_review_enrollment_request", {
    p_shop_id: shopId,
    p_request_id: requestId,
    p_action: action,
    p_rejection_reason: null,
  });
}

export async function updateProgram(
  shopId: string,
  existing: Json | null,
  input: {
    enabled: boolean;
    earnUnit: number;
    earnPoints: number;
    minSpend: number;
  }
) {
  if (
    !Number.isInteger(input.earnUnit) ||
    input.earnUnit <= 0 ||
    !Number.isInteger(input.earnPoints) ||
    input.earnPoints <= 0 ||
    !Number.isInteger(input.minSpend) ||
    input.minSpend < 0
  ) {
    throw new Error("Enter valid whole numbers for the earning rule.");
  }
  return rpc("loyalty_update_program", {
    p_shop_id: shopId,
    p_enabled: input.enabled,
    p_earn_unit_ugx: input.earnUnit,
    p_earn_points_per_unit: input.earnPoints,
    p_min_eligible_spend_ugx: input.minSpend,
    p_membership_expiry_mode: existing?.membership_expiry_mode ?? "never",
    p_membership_fixed_expires_on:
      existing?.membership_fixed_expires_on ?? null,
    p_membership_duration_months: existing?.membership_duration_months ?? null,
    p_points_expiry_mode: existing?.points_expiry_mode ?? "never",
    p_points_expiry_months: existing?.points_expiry_months ?? null,
  });
}

export type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
};

export async function merchantRewards(shopId: string): Promise<Reward[]> {
  const { data, error } = await requireDb()
    .from("loyalty_rewards")
    .select("id,name,description,points_required,active")
    .eq("shop_id", shopId)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Reward[];
}

export async function createReward(
  shopId: string,
  name: string,
  points: number
) {
  if (!name.trim() || !Number.isInteger(points) || points <= 0)
    throw new Error("Enter a reward name and a positive whole point cost.");
  const { error } = await requireDb().from("loyalty_rewards").insert({
    shop_id: shopId,
    name: name.trim(),
    description: "",
    points_required: points,
    reward_kind: "custom",
    product_id: null,
    product_quantity: 1,
    max_redemptions_per_account: null,
    active: true,
    expires_on: null,
    benefit_kind: "none",
    benefit_amount_ugx: null,
    benefit_percent: null,
  });
  if (error) throw new Error(error.message);
}

export async function setRewardActive(rewardId: string, active: boolean) {
  const { error } = await requireDb()
    .from("loyalty_rewards")
    .update({ active })
    .eq("id", rewardId);
  if (error) throw new Error(error.message);
}

export async function memberDashboard(): Promise<MemberDashboard> {
  return rpc<MemberDashboard & Json>("loyalty_member_dashboard");
}

export async function memberActivity(): Promise<Json[]> {
  const data = await rpc<{ items: Json[] } & Json>("loyalty_member_activity", {
    p_limit: 30,
    p_before: null,
    p_before_id: null,
  });
  return data.items ?? [];
}

export async function memberRewards(): Promise<Json[]> {
  const data = await rpc<{ rewards: Json[] } & Json>("loyalty_member_rewards", {
    p_limit: 100,
  });
  return data.rewards ?? [];
}

export async function walletConfigured(): Promise<boolean> {
  if (!configured) return false;
  const session = await requireDb().auth.getSession();
  const response = await fetch(
    `${url.replace(
      /\/$/,
      ""
    )}/functions/v1/loyalty-wallet-pass?provider=google`,
    {
      headers: {
        apikey: key,
        ...(session.data.session
          ? { Authorization: `Bearer ${session.data.session.access_token}` }
          : {}),
      },
    }
  );
  const data = (await response.json()) as Json;
  return response.ok && data.configured === true;
}

export async function issueMemberWallet(shopId: string): Promise<string> {
  const { data, error } = await requireDb().functions.invoke(
    "loyalty-wallet-pass",
    {
      body: { provider: "google", shop_id: shopId },
    }
  );
  if (error) throw new Error(error.message);
  const result = data as Json;
  if (result.ok !== true || typeof result.save_url !== "string")
    throw new Error(String(result.error ?? "Wallet is unavailable."));
  return result.save_url;
}

export async function registerMember(name: string, phone: string) {
  return rpc("loyalty_member_register", {
    p_display_name: name,
    p_phone_e164: phone,
  });
}

export async function joinByCode(code: string) {
  return rpc("loyalty_member_join_by_code", {
    p_code: code.trim().toUpperCase().replace(/\s+/g, ""),
  });
}

export async function publicFunction(
  name: string,
  query: Record<string, string>
): Promise<Json> {
  if (!configured) throw new Error("This app has no database configuration.");
  const params = new URLSearchParams(query);
  const response = await fetch(
    `${url.replace(/\/$/, "")}/functions/v1/${name}?${params}`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }
  );
  const data = (await response.json()) as Json;
  if (!response.ok || data.ok !== true)
    throw new Error(String(data.error ?? "Unavailable"));
  return data;
}

export async function submitPublicFunction(
  name: string,
  body: Json
): Promise<Json> {
  if (!configured) throw new Error("This app has no database configuration.");
  const response = await fetch(
    `${url.replace(/\/$/, "")}/functions/v1/${name}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = (await response.json()) as Json;
  if (!response.ok || data.ok !== true)
    throw new Error(String(data.error ?? "Unavailable"));
  return data;
}

export type LifecycleAction = "suspend" | "reactivate" | "revoke";

export async function setAccountLifecycle(
  shopId: string,
  accountId: string,
  action: LifecycleAction
) {
  return rpc("loyalty_set_account_lifecycle", {
    p_shop_id: shopId,
    p_account_id: accountId,
    p_action: action,
  });
}

export type CardDesign = {
  program_display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  text_color: string | null;
  welcome_message: string | null;
  card_style: string;
  reward_layout: string;
};

export async function fetchCardDesign(shopId: string): Promise<CardDesign | null> {
  const { data, error } = await requireDb()
    .from("loyalty_card_designs")
    .select(
      "program_display_name, logo_url, primary_color, accent_color, background_color, text_color, welcome_message, card_style, reward_layout"
    )
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CardDesign | null) ?? null;
}

export async function upsertCardDesign(shopId: string, draft: CardDesign) {
  return rpc("loyalty_upsert_card_design", {
    p_shop_id: shopId,
    p_program_display_name: draft.program_display_name,
    p_logo_url: draft.logo_url,
    p_primary_color: draft.primary_color,
    p_accent_color: draft.accent_color,
    p_background_color: draft.background_color,
    p_text_color: draft.text_color,
    p_welcome_message: draft.welcome_message,
    p_card_style: draft.card_style || "classic",
    p_reward_layout: draft.reward_layout || "list",
  });
}

export async function resetCardDesign(shopId: string) {
  return rpc("loyalty_reset_card_design", { p_shop_id: shopId });
}

export type SpendPromotion = {
  id: string;
  account_id: string | null;
  title: string;
  threshold_ugx: number;
  bonus_points: number;
  max_awards: number;
  starts_at: string | null;
  ends_at: string | null;
  status: "active" | "paused" | "revoked";
};

export async function listSpendPromotions(shopId: string): Promise<SpendPromotion[]> {
  const { data, error } = await requireDb()
    .from("loyalty_spend_promotions")
    .select(
      "id, account_id, title, threshold_ugx, bonus_points, max_awards, starts_at, ends_at, status"
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SpendPromotion[];
}

export async function createSpendPromotion(
  shopId: string,
  input: {
    title: string;
    thresholdUgx: number;
    bonusPoints: number;
    maxAwards?: number;
    accountId?: string | null;
  }
) {
  if (!input.title.trim()) throw new Error("Enter a promotion title.");
  if (!Number.isInteger(input.thresholdUgx) || input.thresholdUgx <= 0)
    throw new Error("Enter a positive spend threshold.");
  if (!Number.isInteger(input.bonusPoints) || input.bonusPoints <= 0)
    throw new Error("Enter positive bonus points.");
  const { error } = await requireDb().from("loyalty_spend_promotions").insert({
    shop_id: shopId,
    account_id: input.accountId ?? null,
    title: input.title.trim().slice(0, 80),
    threshold_ugx: input.thresholdUgx,
    bonus_points: input.bonusPoints,
    max_awards: input.maxAwards ?? 1,
    status: "active",
  });
  if (error) throw new Error(error.message);
}

export async function setSpendPromotionStatus(
  promotionId: string,
  status: SpendPromotion["status"]
) {
  const { error } = await requireDb()
    .from("loyalty_spend_promotions")
    .update({ status })
    .eq("id", promotionId);
  if (error) throw new Error(error.message);
}

export type CustomerOffer = {
  id: string;
  title: string;
  offer_kind: string;
  status: string;
  priority: number;
  window_active?: boolean;
};

export async function listCustomerOffers(
  shopId: string,
  accountId: string
): Promise<CustomerOffer[]> {
  const data = await rpc<{ offers: CustomerOffer[] } & Json>(
    "loyalty_list_customer_offers",
    { p_shop_id: shopId, p_account_id: accountId }
  );
  return data.offers ?? [];
}

export async function createCustomerOffer(input: {
  shopId: string;
  accountId: string;
  title: string;
  bonusPoints?: number;
}) {
  // Config shape is enforced by loyalty_validate_offer_config (earn_bonus_flat → { points }).
  return rpc("loyalty_create_customer_offer", {
    p_shop_id: input.shopId,
    p_account_id: input.accountId,
    p_offer_kind: "earn_bonus_flat",
    p_title: input.title.trim(),
    p_config: { points: input.bonusPoints ?? 50 },
    p_priority: 0,
    p_starts_at: null,
    p_ends_at: null,
    p_note: null,
  });
}

export async function setCustomerOfferStatus(
  shopId: string,
  offerId: string,
  status: "active" | "paused" | "revoked"
) {
  return rpc("loyalty_set_customer_offer_status", {
    p_shop_id: shopId,
    p_offer_id: offerId,
    p_status: status,
  });
}

export async function updatePassword(newPassword: string) {
  const { error } = await requireDb().auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
