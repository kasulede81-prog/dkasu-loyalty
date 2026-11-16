import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Gift, Settings2 } from "lucide-react";
import {
  createReward,
  merchantRewards,
  setRewardActive,
  updateProgram,
  type Json,
  type Reward,
} from "./api";

const errorText = (value: unknown) =>
  value instanceof Error
    ? value.message.replaceAll("_", " ")
    : "Please try again.";

export function MerchantControls({
  shopId,
  program,
  onSaved,
}: {
  shopId: string;
  program: Json | null;
  onSaved: () => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(Boolean(program?.enabled));
  const [earnUnit, setEarnUnit] = useState(
    Number(program?.earn_unit_ugx ?? 1000)
  );
  const [earnPoints, setEarnPoints] = useState(
    Number(program?.earn_points_per_unit ?? 1)
  );
  const [minSpend, setMinSpend] = useState(
    Number(program?.min_eligible_spend_ugx ?? 0)
  );
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardName, setRewardName] = useState("");
  const [rewardPoints, setRewardPoints] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refreshRewards = useCallback(async () => {
    try {
      setRewards(await merchantRewards(shopId));
    } catch (e) {
      setError(errorText(e));
    }
  }, [shopId]);
  useEffect(() => {
    queueMicrotask(() => void refreshRewards());
  }, [refreshRewards]);

  async function saveProgram(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateProgram(shopId, program, {
        enabled,
        earnUnit,
        earnPoints,
        minSpend,
      });
      await onSaved();
      setMessage("Programme settings saved.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function addReward(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createReward(shopId, rewardName, rewardPoints);
      setRewardName("");
      await refreshRewards();
      setMessage("Reward added.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleReward(reward: Reward) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await setRewardActive(reward.id, !reward.active);
      await refreshRewards();
      setMessage(reward.active ? "Reward paused." : "Reward activated.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-column controls">
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">PROGRAMME</span>
            <h2>
              <Settings2 size={20} /> Earning rules
            </h2>
          </div>
        </div>
        <form className="control-form" onSubmit={saveProgram}>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{" "}
            Loyalty programme enabled
          </label>
          <div className="control-grid">
            <label>
              Spend unit (UGX)
              <input
                type="number"
                min="1"
                step="1"
                required
                value={earnUnit}
                onChange={(e) => setEarnUnit(Number(e.target.value))}
              />
            </label>
            <label>
              Points per unit
              <input
                type="number"
                min="1"
                step="1"
                required
                value={earnPoints}
                onChange={(e) => setEarnPoints(Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            Minimum eligible spend (UGX)
            <input
              type="number"
              min="0"
              step="1"
              required
              value={minSpend}
              onChange={(e) => setMinSpend(Number(e.target.value))}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save rules"}
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">REWARDS</span>
            <h2>
              <Gift size={20} /> Reward catalogue
            </h2>
          </div>
        </div>
        <form className="control-form" onSubmit={addReward}>
          <div className="control-grid">
            <label>
              Reward name
              <input
                required
                value={rewardName}
                onChange={(e) => setRewardName(e.target.value)}
                placeholder="Free coffee"
              />
            </label>
            <label>
              Point cost
              <input
                type="number"
                min="1"
                step="1"
                required
                value={rewardPoints}
                onChange={(e) => setRewardPoints(Number(e.target.value))}
              />
            </label>
          </div>
          <button className="secondary" disabled={busy}>
            Add reward
          </button>
        </form>
        {rewards.length ? (
          <div className="rows reward-rows">
            {rewards.map((reward) => (
              <div className="row" key={reward.id}>
                <div>
                  <strong>{reward.name}</strong>
                  <small>
                    {reward.points_required.toLocaleString("en-UG")} points ·{" "}
                    {reward.active ? "Active" : "Paused"}
                  </small>
                </div>
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={() => void toggleReward(reward)}
                >
                  {reward.active ? "Pause" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">No rewards yet.</p>
        )}
      </section>
      {(error || message) && (
        <div
          className={`notice ${error ? "error" : "success"}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </div>
      )}
    </div>
  );
}
