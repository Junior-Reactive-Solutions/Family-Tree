import { useCallback, useEffect, useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { useFamily } from "../lib/context";

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type Suggestion = {
  id: string;
  category: string;
  personId: string | null;
  message: string;
  submitterName: string | null;
  submitterContact: string | null;
  status: string;
  createdAt: string;
};
type Queued = { id: string; path: string | null; fullName: string; gender: string; reviewNote: string | null };

const STATUSES = ["new", "reviewed", "applied", "rejected"] as const;

export default function AdminPage() {
  const { family } = useFamily();
  const [csrf, setCsrf] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<"suggestions" | "review">("suggestions");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const call = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrf) headers["X-CSRF-Token"] = csrf;
      return fetch(`${API}/api/admin${path}`, { ...init, headers, credentials: "include" });
    },
    [csrf],
  );

  useEffect(() => {
    fetch(`${API}/api/admin/me`, { credentials: "include" })
      .then(async (r) => (r.ok ? setCsrf((await r.json()).csrf) : null))
      .catch(() => null)
      .finally(() => setChecking(false));
  }, []);

  const load = useCallback(async () => {
    const [s, q] = await Promise.all([call("/suggestions"), call("/review-queue")]);
    if (s.ok) setItems(await s.json());
    if (q.ok) setQueue(await q.json());
  }, [call]);
  useEffect(() => {
    if (csrf) void load();
  }, [csrf, load]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const r = await fetch(`${API}/api/admin/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return setError(r.status === 429 ? "Too many attempts. Try again later." : "Sign in failed.");
    setPassword("");
    setCsrf((await r.json()).csrf);
  };

  const logout = async () => {
    await call("/logout", { method: "POST" });
    setCsrf(null);
  };

  const setStatus = async (id: string, status: string) => {
    const r = await call(`/suggestions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (r.ok) setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const fixGender = async (id: string, gender: "M" | "F" | "U") => {
    const r = await call(`/persons/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ gender, needsReview: false, reviewNote: null }),
    });
    if (r.ok) setQueue((xs) => xs.filter((x) => x.id !== id));
  };
  const markOk = async (id: string) => {
    const r = await call(`/persons/${id}`, { method: "PATCH", body: JSON.stringify({ needsReview: false, reviewNote: null }) });
    if (r.ok) setQueue((xs) => xs.filter((x) => x.id !== id));
  };

  if (checking) return <p className="notice">Checking session...</p>;

  if (!csrf) {
    return (
      <section className="container narrow">
        <h1>Admin sign in</h1>
        <form onSubmit={login} className="form">
          <label>
            Email
            <input type="email" required maxLength={254} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" required maxLength={200} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="btn" type="submit">
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" /> Sign in
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="container">
      <div className="admin-head">
        <h1>Admin</h1>
        <button className="btn ghost" onClick={logout}>
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" /> Sign out
        </button>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "suggestions"} onClick={() => setTab("suggestions")}>
          Suggestions ({items.filter((i) => i.status === "new").length} new)
        </button>
        <button role="tab" aria-selected={tab === "review"} onClick={() => setTab("review")}>
          Review queue ({queue.length})
        </button>
      </div>

      {tab === "suggestions" && (
        <ul className="admin-list">
          {items.length === 0 && <li className="muted">No suggestions yet.</li>}
          {items.map((s) => {
            const p = s.personId ? family.byId.get(s.personId) : null;
            return (
              <li key={s.id}>
                <div>
                  <strong>{s.category.replace("_", " ")}</strong>
                  {p && <> about {p.fullName}</>}
                  <span className="muted"> {new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
                <p>{s.message}</p>
                <p className="muted">
                  {[s.submitterName, s.submitterContact].filter(Boolean).join(" | ") || "Anonymous"}
                </p>
                <select aria-label="Status" value={s.status} onChange={(e) => setStatus(s.id, e.target.value)}>
                  {STATUSES.map((st) => <option key={st}>{st}</option>)}
                </select>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "review" && (
        <ul className="admin-list">
          {queue.length === 0 && <li className="muted">Nothing to review.</li>}
          {queue.map((q) => (
            <li key={q.id}>
              <strong>{q.path ? `${q.path} ` : ""}{q.fullName}</strong>
              <p className="muted">{q.reviewNote}</p>
              <div className="chat-row">
                <span className="muted">Gender:</span>
                {(["M", "F", "U"] as const).map((g) => (
                  <button key={g} className={`chip${q.gender === g ? " on" : ""}`} onClick={() => fixGender(q.id, g)}>
                    {g === "M" ? "Male" : g === "F" ? "Female" : "Unknown"}
                  </button>
                ))}
                <button className="chip" onClick={() => markOk(q.id)}>Mark reviewed</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
