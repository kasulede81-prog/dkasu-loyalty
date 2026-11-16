import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import QRCode from "qrcode";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleUserRound,
  Gift,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { MerchantControls } from "./MerchantControls";
import { MerchantAdvanced } from "./MerchantAdvanced";
import {
  configured,
  db,
  issueMemberWallet,
  joinByCode,
  memberActivity,
  memberDashboard,
  memberRewards,
  merchantAccounts,
  merchantOverview,
  merchantRequests,
  publicFunction,
  registerMember,
  reviewRequest,
  shops,
  submitPublicFunction,
  updatePassword,
  walletConfigured,
  type JoinRequest,
  type Json,
  type MemberDashboard,
  type MerchantAccount,
  type MerchantOverview,
  type Shop,
} from "./api";

const number = (value: unknown) => Number(value ?? 0).toLocaleString("en-UG");
const date = (value: unknown) =>
  value
    ? new Date(String(value)).toLocaleDateString("en-UG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const readableError = (error: unknown) =>
  error instanceof Error
    ? error.message.replaceAll("_", " ")
    : "Something went wrong. Please try again.";

function Brand() {
  return (
    <Link className="brand" to="/app">
      <span className="brand-mark">D</span>
      <span>
        DKASU <strong>Loyalty</strong>
      </span>
    </Link>
  );
}

function Shell({
  children,
  session,
}: {
  children: ReactNode;
  session?: Session | null;
}) {
  return (
    <div className="site">
      <header className="topbar">
        <Brand />
        <nav>
          <Link to="/app">Dashboard</Link>
          {session ? (
            <button className="quiet" onClick={() => void db?.auth.signOut()}>
              <LogOut size={16} /> Sign out
            </button>
          ) : (
            <Link to="/login">
              Sign in <ArrowRight size={16} />
            </Link>
          )}
        </nav>
      </header>
      {children}
      <footer>DKASU Loyalty · One card, more reasons to return</footer>
    </div>
  );
}

function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function Qr({ value }: { value: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(value, { width: 240, margin: 1 }).then((image) => {
      if (alive) setSrc(image);
    });
    return () => {
      alive = false;
    };
  }, [value]);
  return src ? (
    <img className="qr" src={src} alt="Loyalty card QR code" />
  ) : null;
}

function WalletButton({
  shopId,
  issued,
  stale,
}: {
  shopId: string;
  issued: boolean;
  stale: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function openWallet() {
    setBusy(true);
    setError("");
    try {
      const saveUrl = await issueMemberWallet(shopId);
      const url = new URL(saveUrl);
      if (url.protocol !== "https:") throw new Error("Wallet link is invalid.");
      if (!window.open(saveUrl, "_blank", "noopener,noreferrer")) {
        const link = document.createElement("a");
        link.href = saveUrl;
        link.rel = "noreferrer noopener";
        link.target = "_self";
        document.body.append(link);
        link.click();
        link.remove();
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wallet-action">
      <button
        className="wallet-button"
        disabled={busy}
        onClick={() => void openWallet()}
      >
        {busy
          ? "Opening…"
          : stale
          ? "Update Google Wallet card"
          : issued
          ? "Open in Google Wallet"
          : "Add to Google Wallet"}
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

function PublicWalletButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function issue() {
    setBusy(true);
    setError("");
    try {
      const result = await submitPublicFunction("loyalty-public-wallet-issue", {
        token,
      });
      const saveUrl = String(result.save_url ?? "");
      if (!saveUrl || new URL(saveUrl).protocol !== "https:")
        throw new Error("Wallet link is invalid.");
      if (!window.open(saveUrl, "_blank", "noopener,noreferrer")) {
        const link = document.createElement("a");
        link.href = saveUrl;
        link.rel = "noreferrer noopener";
        link.target = "_self";
        document.body.append(link);
        link.click();
        link.remove();
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wallet-action">
      <button
        className="wallet-button"
        disabled={busy}
        onClick={() => void issue()}
      >
        {busy ? "Opening…" : "Add to Google Wallet"}
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

function AuthPage({ onSession }: { onSession: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!db) return;
    setBusy(true);
    setMessage("");
    const result =
      mode === "signin"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session)
      setMessage("Check your email to confirm your account, then sign in.");
    else {
      onSession();
      navigate("/app", { replace: true });
    }
  }
  return (
    <Shell>
      <main className="auth-layout">
        <section className="auth-intro">
          <span className="eyebrow">THE NEW DKASU LOYALTY</span>
          <h1>Every customer relationship, beautifully connected.</h1>
          <p>
            Members see their points and rewards. Merchants see the people
            behind every visit. All in one dedicated space.
          </p>
          <div className="feature-row">
            <span>
              <Gift size={18} /> Rewards
            </span>
            <span>
              <Users size={18} /> Members
            </span>
            <span>
              <LayoutDashboard size={18} /> Insights
            </span>
          </div>
        </section>
        <section className="auth-card">
          <div className="card-head">
            <span className="eyebrow">WELCOME</span>
            <h2>{mode === "signin" ? "Sign in" : "Create an account"}</h2>
            <p>Use your DKASU account to access loyalty.</p>
          </div>
          {!configured && (
            <Notice tone="error">
              Database settings are missing for this deployment.
            </Notice>
          )}
          <form onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {message && (
              <Notice tone={message.startsWith("Check") ? "success" : "error"}>
                {message}
              </Notice>
            )}
            <button
              className="primary wide"
              type="submit"
              disabled={!configured || busy}
            >
              {busy
                ? "Please wait…"
                : mode === "signin"
                ? "Sign in"
                : "Create account"}
              <ArrowRight size={18} />
            </button>
          </form>
          {mode === "signin" && (
            <>
              <button
                className="secondary wide google-button"
                onClick={() =>
                  void db?.auth
                    .signInWithOAuth({
                      provider: "google",
                      options: {
                        redirectTo: `${window.location.origin}/auth/callback`,
                      },
                    })
                    .then(({ error }) => {
                      if (error) setMessage(error.message);
                    })
                }
                disabled={!configured}
              >
                Continue with Google
              </button>
              <Link className="forgot-link" to="/forgot-password">
                Forgot password?
              </Link>
            </>
          )}
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setMessage("");
            }}
          >
            {mode === "signin"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </section>
      </main>
    </Shell>
  );
}

function PasswordPage({ recovery = false }: { recovery?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!db) return;
    const result = recovery
      ? await db.auth.updateUser({ password })
      : await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
    setMessage(
      result.error?.message ||
        (recovery
          ? "Password updated. You can open your dashboard."
          : "Check your email for a reset link.")
    );
  }
  return (
    <Shell>
      <main className="public-wrap">
        <span className="eyebrow">ACCOUNT ACCESS</span>
        <h1>{recovery ? "Set a new password" : "Reset your password"}</h1>
        <form className="panel join-panel" onSubmit={submit}>
          <label>
            {recovery ? "New password" : "Email"}
            <input
              required
              type={recovery ? "password" : "email"}
              minLength={recovery ? 6 : undefined}
              value={recovery ? password : email}
              onChange={(e) =>
                recovery
                  ? setPassword(e.target.value)
                  : setEmail(e.target.value)
              }
            />
          </label>
          <button className="primary wide">
            {recovery ? "Save password" : "Send reset link"}
          </button>
          {message && <Notice>{message}</Notice>}
        </form>
      </main>
    </Shell>
  );
}

function MemberView() {
  const [dashboard, setDashboard] = useState<MemberDashboard | null>(null);
  const [activity, setActivity] = useState<Json[]>([]);
  const [rewards, setRewards] = useState<Json[]>([]);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await memberDashboard();
      setDashboard(data);
      const [events, awards, wallet] = await Promise.allSettled([
        memberActivity(),
        memberRewards(),
        walletConfigured(),
      ]);
      setActivity(events.status === "fulfilled" ? events.value : []);
      setRewards(awards.status === "fulfilled" ? awards.value : []);
      setWalletAvailable(wallet.status === "fulfilled" && wallet.value);
    } catch (e) {
      setError(readableError(e));
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  async function register(event: FormEvent) {
    event.preventDefault();
    setFeedback("");
    try {
      await registerMember(name.trim(), phone.trim());
      await load();
    } catch (e) {
      setFeedback(readableError(e));
    }
  }
  async function join(event: FormEvent) {
    event.preventDefault();
    setFeedback("");
    try {
      const result = await joinByCode(code);
      setFeedback(
        result.status === "already_member"
          ? "You already belong to this programme."
          : "Request sent. The shop will review it."
      );
    } catch (e) {
      setFeedback(readableError(e));
    }
  }
  if (loading)
    return <div className="panel loading">Loading your loyalty space…</div>;
  if (error && !dashboard)
    return (
      <section className="panel">
        <h2>
          {error === "not a member"
            ? "Create your member profile"
            : "Your loyalty space is unavailable"}
        </h2>
        {error === "not a member" ? (
          <form className="inline-form" onSubmit={register}>
            <label>
              Your name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Phone number (+256… )
              <input
                required
                pattern="\+256[0-9]{9}"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <button className="primary">Create profile</button>
          </form>
        ) : (
          <button className="secondary" onClick={() => void load()}>
            <RefreshCw size={16} /> Try again
          </button>
        )}
        {feedback && <Notice tone="error">{feedback}</Notice>}
      </section>
    );
  if (!dashboard) return null;
  const total = dashboard.accounts.reduce(
    (sum, item) => sum + Number(item.account.balance_points || 0),
    0
  );
  return (
    <div className="space">
      <div className="section-title member-title">
        <div>
          <span className="eyebrow">MEMBER SPACE</span>
          <h1>
            Good to see you,{" "}
            {dashboard.member.display_name?.split(" ")[0] || "member"}.
          </h1>
          <p>Every card, point and reward in one place.</p>
        </div>
        <span className="pill">
          <CircleUserRound size={15} /> {dashboard.member.status}
        </span>
      </div>
      <section className="member-overview" aria-label="Your loyalty overview">
        <div className="member-overview-copy">
          <span className="eyebrow">YOUR LOYALTY AT A GLANCE</span>
          <h2>Good things add up.</h2>
          <p>Keep your cards close and see what each shop has waiting for you.</p>
          <span className="overview-chip">
            <Wallet size={16} /> {number(dashboard.counts.active_accounts)} active
            {dashboard.counts.active_accounts === 1 ? " card" : " cards"}
          </span>
        </div>
        <div className="member-overview-total">
          <span>YOUR POINTS</span>
          <strong>{number(total)}</strong>
          <small>Across your shop cards</small>
        </div>
      </section>
      <div className="stats member-stats">
        <Stat
          icon={<Sparkles />}
          label="Points across cards"
          value={number(total)}
          detail="Each shop keeps its own balance"
        />
        <Stat
          icon={<Wallet />}
          label="Memberships"
          value={number(dashboard.counts.linked_accounts)}
        />
        <Stat
          icon={<Gift />}
          label="Available rewards"
          value={number(rewards.filter((r) => r.state === "available").length)}
        />
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">YOUR CARDS</span>
              <h2>Memberships</h2>
            </div>
          </div>
          {dashboard.accounts.length === 0 ? (
            <p className="empty">
              No cards yet. Join a shop using its loyalty code.
            </p>
          ) : (
            <div className="cards-list">
              {dashboard.accounts.map((item) => (
                <article className="member-card" key={item.link_id}>
                  <div className="member-card-top">
                    <span>
                      DKASU <b>LOYALTY</b>
                    </span>
                    <span>{item.account.status}</span>
                  </div>
                  <div>
                    <small>{item.shop.name}</small>
                    <strong>
                      {number(item.account.balance_points)} <em>points</em>
                    </strong>
                  </div>
                  <div className="member-card-bottom">
                    <span>{item.card.member_number || "MEMBER CARD"}</span>
                    {item.card.qr_token && (
                      <button
                        onClick={() =>
                          setActiveCard(
                            activeCard === item.link_id ? null : item.link_id
                          )
                        }
                      >
                        {activeCard === item.link_id
                          ? "Hide code"
                          : "Show code"}
                      </button>
                    )}
                  </div>
                  {activeCard === item.link_id && item.card.qr_token && (
                    <div className="card-code">
                      <Qr value={`WAKA-LOYALTY:${item.card.qr_token}`} />
                      <p>Show this at checkout</p>
                    </div>
                  )}
                  {walletAvailable && item.account.status === "active" && (
                    <WalletButton
                      shopId={item.shop.id}
                      issued={Boolean(item.account.google_wallet_issued_at)}
                      stale={Boolean(
                        item.account.google_wallet_issued_at &&
                          item.account.google_wallet_sync_balance != null &&
                          item.account.google_wallet_sync_balance !==
                            item.account.balance_points
                      )}
                    />
                  )}
                </article>
              ))}
            </div>
          )}
          <form className="join-form" onSubmit={join}>
            <label>
              Have a shop loyalty code?
              <div className="input-action">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="WPL2026001"
                  required
                  pattern="WPL[0-9]{7,13}"
                />
                <button className="secondary">
                  Join <ArrowRight size={16} />
                </button>
              </div>
            </label>
          </form>
          {feedback && (
            <Notice
              tone={
                feedback.startsWith("Request") ||
                feedback.startsWith("You already")
                  ? "success"
                  : "error"
              }
            >
              {feedback}
            </Notice>
          )}
        </section>
        <div className="stack">
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">WHAT'S NEW</span>
                <h2>Recent activity</h2>
              </div>
            </div>
            {activity.length ? (
              <div className="rows">
                {activity.map((row) => (
                  <div className="row" key={String(row.id)}>
                    <div>
                      <strong>{String(row.kind || "Activity")}</strong>
                      <small>
                        {String((row.shop as Json | undefined)?.name || "")} ·{" "}
                        {date(row.created_at)}
                      </small>
                    </div>
                    <b
                      className={
                        Number(row.points) < 0 ? "negative" : "positive"
                      }
                    >
                      {Number(row.points) > 0 ? "+" : ""}
                      {number(row.points)}
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty">Your activity will appear here.</p>
            )}
          </section>
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">FOR YOU</span>
                <h2>Rewards</h2>
              </div>
            </div>
            {rewards.length ? (
              <div className="rows">
                {rewards.slice(0, 8).map((row) => (
                  <div className="row" key={String(row.id)}>
                    <div>
                      <strong>{String(row.name)}</strong>
                      <small>
                        {String((row.shop as Json | undefined)?.name || "")} ·{" "}
                        {String(row.state || "")}
                      </small>
                    </div>
                    <b>{number(row.points_required)} pts</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty">Rewards from your shops will appear here.</p>
            )}
          </section>
          <AccountSecurity />
        </div>
      </div>
    </div>
  );
}

function AccountSecurity() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (password.length < 8)
        throw new Error("Use at least 8 characters for a new password.");
      await updatePassword(password);
      setPassword("");
      setMessage("Password updated.");
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">SECURITY</span>
          <h2>
            <ShieldCheck size={20} /> Account
          </h2>
        </div>
      </div>
      <p className="muted">
        Update your sign-in password for this loyalty account. Email changes
        use the recovery flow from the sign-in screen.
      </p>
      <form className="control-form" onSubmit={save}>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <button className="primary" type="submit" disabled={busy}>
          Update password
        </button>
      </form>
    </section>
  );
}

function MerchantView() {
  const [shopList, setShopList] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [overview, setOverview] = useState<MerchantOverview | null>(null);
  const [accounts, setAccounts] = useState<MerchantAccount[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const requestSeq = useRef(0);
  useEffect(() => {
    ++requestSeq.current;
    queueMicrotask(() => {
      setOverview(null);
      setAccounts([]);
      setRequests([]);
    });
  }, [shopId]);
  useEffect(() => {
    let alive = true;
    void shops()
      .then((data) => {
        if (alive) {
          setShopList(data);
          setShopId(data[0]?.id || "");
        }
      })
      .catch((e) => {
        if (alive) setError(readableError(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  const load = useCallback(async () => {
    if (!shopId) return;
    const seq = ++requestSeq.current;
    setBusy(true);
    setError("");
    try {
      const [o, a, r] = await Promise.all([
        merchantOverview(shopId),
        merchantAccounts(shopId, query, status),
        merchantRequests(shopId).catch(() => []),
      ]);
      if (seq !== requestSeq.current) return;
      setOverview(o);
      setAccounts(a);
      setRequests(r);
    } catch (e) {
      if (seq === requestSeq.current) setError(readableError(e));
    } finally {
      if (seq === requestSeq.current) setBusy(false);
    }
  }, [shopId, query, status]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function decide(requestId: string, action: "approve" | "reject") {
    setMessage("");
    try {
      await reviewRequest(shopId, requestId, action);
      setMessage(
        action === "approve" ? "Member approved." : "Request rejected."
      );
      await load();
    } catch (e) {
      setError(readableError(e));
    }
  }
  const selected = shopList.find((item) => item.id === shopId);
  const program = overview?.program || null;
  return (
    <div className="space">
      <div className="section-title">
        <div>
          <span className="eyebrow">MERCHANT SPACE</span>
          <h1>Customer loyalty, at a glance.</h1>
          <p>Understand your members and keep every request moving.</p>
        </div>
        {shopList.length > 1 && (
          <label className="shop-select">
            Shop{" "}
            <select value={shopId} onChange={(e) => setShopId(e.target.value)}>
              {shopList.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </label>
        )}
      </div>
      {error && (
        <Notice tone="error">
          {error}{" "}
          <button className="text-button" onClick={() => void load()}>
            Retry
          </button>
        </Notice>
      )}
      {message && <Notice tone="success">{message}</Notice>}
      {!shopId && !error ? (
        <section className="panel">
          <h2>No shop available</h2>
          <p>
            Your account needs access to a DKASU shop before the merchant
            dashboard can open.
          </p>
        </section>
      ) : (
        <>
          <div className="hero">
            <div>
              <span className="eyebrow">{selected?.name || "YOUR SHOP"}</span>
              <h2>
                {program?.enabled
                  ? "Your loyalty programme is live."
                  : "Your customer story starts here."}
              </h2>
              <p>
                {program?.enabled
                  ? "A clear view of your members, points and activity."
                  : "Set your earning rules below to start welcoming members."}
              </p>
            </div>
            <div className={`hero-badge ${program?.enabled ? "live" : "setup"}`}>
              <ShieldCheck size={20} />
              {program?.enabled ? "Programme live" : "Ready to set up"}
            </div>
          </div>
          <div className="stats">
            <Stat
              icon={<Users />}
              label="Total members"
              value={number(overview?.members_total)}
              detail={`${number(overview?.members_active)} active`}
            />
            <Stat
              icon={<Sparkles />}
              label="Points issued"
              value={number(overview?.points_issued)}
            />
            <Stat
              icon={<Ticket />}
              label="Points redeemed"
              value={number(overview?.points_redeemed)}
            />
            <Stat
              icon={<Gift />}
              label="Requests waiting"
              value={number(requests.length)}
            />
          </div>
          <div className="two-column">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">YOUR COMMUNITY</span>
                  <h2>Members</h2>
                </div>
                <span className="muted">First 50 results</span>
              </div>
              <div className="filter-row">
                <input
                  aria-label="Search members"
                  placeholder="Search name or phone"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="Member status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
              {busy && !overview ? (
                <p className="empty">Loading members…</p>
              ) : accounts.length ? (
                <div className="rows">
                  {accounts.map((item) => (
                    <div className="row" key={item.id}>
                      <div>
                        <strong>{item.customer_name}</strong>
                        <small>
                          {item.customer_phone || "No phone"} · {item.status}
                        </small>
                      </div>
                      <b>{number(item.balance_points)} pts</b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty">No members match this search.</p>
              )}
            </section>
            <div className="stack">
              <section className="panel">
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">NEEDS ATTENTION</span>
                    <h2>Join requests</h2>
                  </div>
                </div>
                {requests.length ? (
                  <div className="rows">
                    {requests.map((item) => (
                      <div className="request" key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <small>
                            {item.phone_e164} · {date(item.requested_at)}
                          </small>
                        </div>
                        <div className="request-actions">
                          <button
                            className="approve"
                            onClick={() => void decide(item.id, "approve")}
                            disabled={busy}
                          >
                            <Check size={15} /> Approve
                          </button>
                          <button
                            className="quiet"
                            onClick={() => void decide(item.id, "reject")}
                            disabled={busy}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty">
                    All caught up. New requests will appear here.
                  </p>
                )}
              </section>
              <section className="panel">
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">LATEST MOMENTS</span>
                    <h2>Activity</h2>
                  </div>
                </div>
                {overview?.recent_activity?.length ? (
                  <div className="rows">
                    {overview.recent_activity.map((item) => (
                      <div className="row" key={String(item.id)}>
                        <div>
                          <strong>
                            {String(item.customer_name || "Member")}
                          </strong>
                          <small>
                            {String(item.kind || "Activity")} ·{" "}
                            {date(item.created_at)}
                          </small>
                        </div>
                        <b
                          className={
                            Number(item.points) < 0 ? "negative" : "positive"
                          }
                        >
                          {Number(item.points) > 0 ? "+" : ""}
                          {number(item.points)}
                        </b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty">Loyalty activity will appear here.</p>
                )}
                {Boolean(program?.public_code) && (
                  <p className="code-note">
                    Shop code <strong>{String(program?.public_code)}</strong>{" "}
                    <button
                      className="text-button"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          `${window.location.origin}/j/${program?.public_code}`
                        )
                      }
                    >
                      Copy join link
                    </button>
                  </p>
                )}
              </section>
            </div>
          </div>
          {overview && (
            <MerchantControls
              key={`${shopId}:${String(program?.updated_at || "")}`}
              shopId={shopId}
              program={program}
              onSaved={load}
            />
          )}
          {shopId && (
            <MerchantAdvanced
              shopId={shopId}
              accounts={accounts}
              onChanged={load}
            />
          )}
        </>
      )}
    </div>
  );
}

function Workspace({ session }: { session: Session }) {
  const [view, setView] = useState<"member" | "merchant">("member");
  useEffect(() => {
    void shops()
      .then((list) => {
        if (list.length) setView("merchant");
      })
      .catch(() => {});
  }, []);
  return (
    <Shell session={session}>
      <main className="container">
        <div className="workspace-nav" aria-label="Loyalty dashboard views">
          <button
            type="button"
            className={view === "member" ? "selected" : ""}
            aria-pressed={view === "member"}
            onClick={() => setView("member")}
          >
            <Wallet size={18} /> My rewards
          </button>
          <button
            type="button"
            className={view === "merchant" ? "selected" : ""}
            aria-pressed={view === "merchant"}
            onClick={() => setView("merchant")}
          >
            <LayoutDashboard size={18} /> Merchant dashboard
          </button>
        </div>
        {view === "member" ? <MemberView /> : <MerchantView />}
      </main>
    </Shell>
  );
}

function PublicCard() {
  const { token = "" } = useParams();
  const [card, setCard] = useState<Json | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!/^[a-f0-9]{64}$/i.test(token)) return;
    let alive = true;
    void publicFunction("loyalty-public-card", { token })
      .then((data) => {
        if (alive) setCard(data);
      })
      .catch((e) => {
        if (alive) setError(readableError(e));
      });
    return () => {
      alive = false;
    };
  }, [token]);
  return (
    <Shell>
      <main className="public-wrap">
        <span className="eyebrow">DIGITAL MEMBER CARD</span>
        {error || !/^[a-f0-9]{64}$/i.test(token) ? (
          <Notice tone="error">{error || "This card link is invalid."}</Notice>
        ) : !card ? (
          <div className="panel loading">Loading card…</div>
        ) : (
          <>
            <div className="member-card public-card">
              <div className="member-card-top">
                <span>
                  DKASU <b>LOYALTY</b>
                </span>
                <span>{card.account_active ? "ACTIVE" : "INACTIVE"}</span>
              </div>
              <div>
                <small>{String(card.shop_name || "Merchant")}</small>
                <strong>
                  {number(card.balance_points)} <em>points</em>
                </strong>
              </div>
              <div className="member-card-bottom">
                <span>{String(card.member_number || "MEMBER CARD")}</span>
              </div>
            </div>
            <section className="panel center">
              <h1>{String(card.customer_name || "Your loyalty card")}</h1>
              <p>{String(card.program_name || "Loyalty programme")}</p>
              {typeof card.qr_payload === "string" && (
                <Qr value={card.qr_payload} />
              )}
              <p>Show this code at checkout.</p>
              {card.wallet_configured === true && (
                <PublicWalletButton token={token} />
              )}
            </section>
          </>
        )}
      </main>
    </Shell>
  );
}

function PublicJoin({ kind }: { kind: "code" | "token" }) {
  const params = useParams();
  const value = kind === "code" ? params.code ?? "" : params.token ?? "";
  const [preview, setPreview] = useState<Json | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const valid =
      kind === "code"
        ? /^WPL[0-9]{7,13}$/i.test(value)
        : /^[a-f0-9]{64}$/i.test(value);
    if (!valid) return;
    void publicFunction(
      kind === "code" ? "loyalty-public-program" : "loyalty-public-enroll",
      { [kind === "code" ? "code" : "token"]: value }
    )
      .then((data) => {
        if (alive) setPreview(data);
      })
      .catch((e) => {
        if (alive) setError(readableError(e));
      });
    return () => {
      alive = false;
    };
  }, [kind, value]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await submitPublicFunction(
        kind === "code" ? "loyalty-public-program" : "loyalty-public-enroll",
        {
          ...(kind === "code" ? { code: value } : { token: value }),
          name,
          phone,
          email: email || null,
          consent,
        }
      );
      setSent(true);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <main className="public-wrap">
        <span className="eyebrow">JOIN A LOYALTY PROGRAMME</span>
        <h1>{String(preview?.shop_name || "Join a DKASU shop")}</h1>
        <p>
          {String(
            preview?.program_name ||
              preview?.welcome_message ||
              "Get more from every visit."
          )}
        </p>
        {(error ||
          !(kind === "code"
            ? /^WPL[0-9]{7,13}$/i.test(value)
            : /^[a-f0-9]{64}$/i.test(value))) && (
          <Notice tone="error">{error || "This join link is invalid."}</Notice>
        )}
        {sent ? (
          <section className="panel center">
            <div className="success-icon">
              <Check />
            </div>
            <h2>Request sent</h2>
            <p>
              The shop will review your request. You can sign in to see your
              memberships.
            </p>
            <Link className="primary" to="/login">
              Go to sign in <ArrowRight size={16} />
            </Link>
          </section>
        ) : (
          preview && (
            <form className="panel join-panel" onSubmit={submit}>
              <label>
                Your name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Phone number
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+256…"
                />
              </label>
              <label>
                Email (optional)
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />{" "}
                I agree to share these details with this shop for loyalty
                membership.
              </label>
              <button className="primary wide" disabled={busy}>
                {busy ? "Sending…" : "Send join request"}
                <ArrowRight size={16} />
              </button>
            </form>
          )
        )}
      </main>
    </Shell>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(
    configured ? undefined : null
  );
  useEffect(() => {
    if (!db) return;
    void db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event, next) =>
      setSession(next)
    );
    return () => data.subscription.unsubscribe();
  }, []);
  const onSession = useCallback(() => {
    void db?.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);
  const ready = useMemo(() => session !== undefined, [session]);
  if (!ready)
    return <div className="site loading-screen">Opening DKASU Loyalty…</div>;
  return (
    <Routes>
      <Route
        path="/login"
        element={
          session ? (
            <Navigate to="/app" replace />
          ) : (
            <AuthPage onSession={onSession} />
          )
        }
      />
      <Route
        path="/auth/callback"
        element={
          session ? (
            <Navigate to="/app" replace />
          ) : (
            <AuthPage onSession={onSession} />
          )
        }
      />
      <Route path="/forgot-password" element={<PasswordPage />} />
      <Route path="/reset-password" element={<PasswordPage recovery />} />
      <Route path="/auth/recovery" element={<PasswordPage recovery />} />
      <Route
        path="/app"
        element={
          session ? (
            <Workspace session={session} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/member" element={<Navigate to="/app" replace />} />
      <Route path="/c/:token" element={<PublicCard />} />
      <Route path="/loyalty/:token" element={<PublicCard />} />
      <Route path="/j/:code" element={<PublicJoin kind="code" />} />
      <Route path="/join/:token" element={<PublicJoin kind="token" />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
