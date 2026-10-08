import { useState } from "react";
import { KeyRound } from "lucide-react";

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export default function AccessGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/access`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (r.ok) return onUnlocked();
      setError(r.status === 429 ? "Too many attempts. Please wait a few minutes." : "That code is not right. Please check it and try again.");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="container narrow">
      <h1>Family access</h1>
      <p className="lead">This family tree is private. Enter the family access code you were given.</p>
      <form onSubmit={submit} className="form">
        <label>
          Access code
          <input value={code} maxLength={100} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(e) => setCode(e.target.value)} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>
          <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" /> Enter
        </button>
      </form>
    </section>
  );
}
