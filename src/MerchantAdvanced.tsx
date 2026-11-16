import { useCallback, useEffect, useState, type FormEvent } from "react";
import { IdCard, Megaphone, ShieldAlert, Sparkles } from "lucide-react";
import {
  createCustomerOffer,
  createSpendPromotion,
  fetchCardDesign,
  listCustomerOffers,
  listSpendPromotions,
  resetCardDesign,
  setAccountLifecycle,
  setCustomerOfferStatus,
  setSpendPromotionStatus,
  upsertCardDesign,
  type CardDesign,
  type CustomerOffer,
  type LifecycleAction,
  type MerchantAccount,
  type SpendPromotion,
} from "./api";

const err = (value: unknown) =>
  value instanceof Error
    ? value.message.replaceAll("_", " ")
    : "Please try again.";

const emptyDesign = (): CardDesign => ({
  program_display_name: "",
  logo_url: "",
  primary_color: "#0f766e",
  accent_color: "#f59e0b",
  background_color: "#042f2e",
  text_color: "#ecfdf5",
  welcome_message: "",
  card_style: "classic",
  reward_layout: "list",
});

export function MerchantAdvanced({
  shopId,
  accounts,
  onChanged,
}: {
  shopId: string;
  accounts: MerchantAccount[];
  onChanged: () => Promise<void>;
}) {
  const [design, setDesign] = useState<CardDesign>(emptyDesign());
  const [promos, setPromos] = useState<SpendPromotion[]>([]);
  const [promoTitle, setPromoTitle] = useState("");
  const [promoThreshold, setPromoThreshold] = useState(50000);
  const [promoBonus, setPromoBonus] = useState(100);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [offers, setOffers] = useState<CustomerOffer[]>([]);
  const [offerTitle, setOfferTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        fetchCardDesign(shopId),
        listSpendPromotions(shopId),
      ]);
      setDesign(
        d
          ? {
              ...emptyDesign(),
              ...d,
              program_display_name: d.program_display_name ?? "",
              logo_url: d.logo_url ?? "",
              welcome_message: d.welcome_message ?? "",
            }
          : emptyDesign()
      );
      setPromos(p);
    } catch (e) {
      setError(err(e));
    }
  }, [shopId]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    if (!selectedAccount) {
      setOffers([]);
      return;
    }
    let alive = true;
    void listCustomerOffers(shopId, selectedAccount)
      .then((rows) => {
        if (alive) setOffers(rows);
      })
      .catch((e) => {
        if (alive) setError(err(e));
      });
    return () => {
      alive = false;
    };
  }, [shopId, selectedAccount]);

  async function run(label: string, work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      setMessage(label);
      await refresh();
      await onChanged();
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveDesign(event: FormEvent) {
    event.preventDefault();
    await run("Card design saved.", async () => {
      await upsertCardDesign(shopId, {
        ...design,
        program_display_name: design.program_display_name || null,
        logo_url: design.logo_url || null,
        welcome_message: design.welcome_message || null,
      });
    });
  }

  async function lifecycle(accountId: string, action: LifecycleAction) {
    await run(`Member ${action} completed.`, async () => {
      await setAccountLifecycle(shopId, accountId, action);
    });
  }

  async function addPromo(event: FormEvent) {
    event.preventDefault();
    await run("Spend promotion created.", async () => {
      await createSpendPromotion(shopId, {
        title: promoTitle,
        thresholdUgx: promoThreshold,
        bonusPoints: promoBonus,
      });
      setPromoTitle("");
    });
  }

  async function addOffer(event: FormEvent) {
    event.preventDefault();
    if (!selectedAccount) throw new Error("Select a member first.");
    await run("Member offer created.", async () => {
      await createCustomerOffer({
        shopId,
        accountId: selectedAccount,
        title: offerTitle || "Bonus points",
        bonusPoints: 50,
      });
      setOfferTitle("");
      setOffers(await listCustomerOffers(shopId, selectedAccount));
    });
  }

  return (
    <div className="space">
      {error && <p className="empty" role="alert">{error}</p>}
      {message && <p className="empty">{message}</p>}

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">CARD STUDIO</span>
            <h2>
              <IdCard size={20} /> Digital card design
            </h2>
          </div>
        </div>
        <form className="control-form" onSubmit={saveDesign}>
          <label>
            Programme name
            <input
              value={design.program_display_name ?? ""}
              onChange={(e) =>
                setDesign({ ...design, program_display_name: e.target.value })
              }
              maxLength={60}
            />
          </label>
          <label>
            Logo URL
            <input
              value={design.logo_url ?? ""}
              onChange={(e) => setDesign({ ...design, logo_url: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <div className="filter-row">
            <label>
              Primary
              <input
                value={design.primary_color ?? ""}
                onChange={(e) =>
                  setDesign({ ...design, primary_color: e.target.value })
                }
              />
            </label>
            <label>
              Accent
              <input
                value={design.accent_color ?? ""}
                onChange={(e) =>
                  setDesign({ ...design, accent_color: e.target.value })
                }
              />
            </label>
          </div>
          <label>
            Welcome message
            <input
              value={design.welcome_message ?? ""}
              onChange={(e) =>
                setDesign({ ...design, welcome_message: e.target.value })
              }
              maxLength={120}
            />
          </label>
          <div className="filter-row">
            <label>
              Style
              <select
                value={design.card_style}
                onChange={(e) =>
                  setDesign({ ...design, card_style: e.target.value })
                }
              >
                <option value="classic">Classic</option>
                <option value="modern">Modern</option>
                <option value="minimal">Minimal</option>
                <option value="premium">Premium</option>
              </select>
            </label>
            <label>
              Reward layout
              <select
                value={design.reward_layout}
                onChange={(e) =>
                  setDesign({ ...design, reward_layout: e.target.value })
                }
              >
                <option value="list">List</option>
                <option value="cards">Cards</option>
              </select>
            </label>
          </div>
          <div className="request-actions">
            <button className="primary" type="submit" disabled={busy}>
              Save design
            </button>
            <button
              className="quiet"
              type="button"
              disabled={busy}
              onClick={() =>
                void run("Card design reset.", async () => {
                  await resetCardDesign(shopId);
                })
              }
            >
              Reset to default
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">LIFECYCLE</span>
            <h2>
              <ShieldAlert size={20} /> Member controls
            </h2>
          </div>
        </div>
        <p className="muted">
          Suspend, reactivate, or revoke membership. Points balances are never
          rewritten by these actions.
        </p>
        <div className="rows">
          {accounts.slice(0, 20).map((account) => (
            <div className="row" key={account.id}>
              <div>
                <strong>{account.customer_name}</strong>
                <small>
                  {account.status} · {account.balance_points} pts
                </small>
              </div>
              <div className="request-actions">
                <button
                  className="quiet"
                  disabled={busy || account.status === "suspended"}
                  onClick={() => void lifecycle(account.id, "suspend")}
                >
                  Suspend
                </button>
                <button
                  className="approve"
                  disabled={busy || account.status === "active"}
                  onClick={() => void lifecycle(account.id, "reactivate")}
                >
                  Reactivate
                </button>
                <button
                  className="quiet"
                  disabled={busy || account.status === "revoked"}
                  onClick={() => void lifecycle(account.id, "revoke")}
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
          {!accounts.length && (
            <p className="empty">Search members above to manage lifecycle.</p>
          )}
        </div>
      </section>

      <div className="two-column controls">
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">PROMOTIONS</span>
              <h2>
                <Megaphone size={20} /> Spend bonuses
              </h2>
            </div>
          </div>
          <form className="control-form" onSubmit={addPromo}>
            <label>
              Title
              <input
                value={promoTitle}
                onChange={(e) => setPromoTitle(e.target.value)}
                required
              />
            </label>
            <label>
              Spend threshold (UGX)
              <input
                type="number"
                min={1}
                value={promoThreshold}
                onChange={(e) => setPromoThreshold(Number(e.target.value))}
              />
            </label>
            <label>
              Bonus points
              <input
                type="number"
                min={1}
                value={promoBonus}
                onChange={(e) => setPromoBonus(Number(e.target.value))}
              />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              Create promotion
            </button>
          </form>
          <div className="rows">
            {promos.map((promo) => (
              <div className="row" key={promo.id}>
                <div>
                  <strong>{promo.title}</strong>
                  <small>
                    Spend {promo.threshold_ugx.toLocaleString("en-UG")} → +
                    {promo.bonus_points} · {promo.status}
                  </small>
                </div>
                <div className="request-actions">
                  {promo.status === "active" ? (
                    <button
                      className="quiet"
                      disabled={busy}
                      onClick={() =>
                        void run("Promotion paused.", async () => {
                          await setSpendPromotionStatus(promo.id, "paused");
                        })
                      }
                    >
                      Pause
                    </button>
                  ) : promo.status !== "revoked" ? (
                    <button
                      className="approve"
                      disabled={busy}
                      onClick={() =>
                        void run("Promotion activated.", async () => {
                          await setSpendPromotionStatus(promo.id, "active");
                        })
                      }
                    >
                      Activate
                    </button>
                  ) : null}
                  {promo.status !== "revoked" && (
                    <button
                      className="quiet"
                      disabled={busy}
                      onClick={() =>
                        void run("Promotion revoked.", async () => {
                          await setSpendPromotionStatus(promo.id, "revoked");
                        })
                      }
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!promos.length && (
              <p className="empty">No spend promotions yet.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">MEMBER OFFERS</span>
              <h2>
                <Sparkles size={20} /> Personal offers
              </h2>
            </div>
          </div>
          <label>
            Member
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="">Select…</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.customer_name}
                </option>
              ))}
            </select>
          </label>
          <form className="control-form" onSubmit={addOffer}>
            <label>
              Offer title
              <input
                value={offerTitle}
                onChange={(e) => setOfferTitle(e.target.value)}
                placeholder="Weekend bonus"
              />
            </label>
            <button
              className="primary"
              type="submit"
              disabled={busy || !selectedAccount}
            >
              Grant +50 bonus offer
            </button>
          </form>
          <div className="rows">
            {offers.map((offer) => (
              <div className="row" key={offer.id}>
                <div>
                  <strong>{offer.title}</strong>
                  <small>
                    {offer.offer_kind} · {offer.status}
                  </small>
                </div>
                {offer.status === "active" && (
                  <button
                    className="quiet"
                    disabled={busy}
                    onClick={() =>
                      void run("Offer paused.", async () => {
                        await setCustomerOfferStatus(
                          shopId,
                          offer.id,
                          "paused"
                        );
                        setOffers(
                          await listCustomerOffers(shopId, selectedAccount)
                        );
                      })
                    }
                  >
                    Pause
                  </button>
                )}
              </div>
            ))}
            {selectedAccount && !offers.length && (
              <p className="empty">No personal offers for this member.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
