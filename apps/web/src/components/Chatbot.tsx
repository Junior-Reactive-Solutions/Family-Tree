import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { MessageSquarePlus, X } from "lucide-react";
import { SuggestionInputSchema, SUGGESTION_CATEGORIES } from "@family-tree/shared";
import type { Person } from "@family-tree/shared";
import type { Family } from "../lib/data";
import { displayName } from "../lib/data";
import { slideIn } from "../lib/motion";

const LABELS: Record<(typeof SUGGESTION_CATEGORIES)[number], string> = {
  add_person: "Add a person",
  correct_name: "Correct a name",
  correct_status: "Alive or late status",
  relationship: "Relationship",
  add_photo: "Add a photo",
  other: "Other",
};
const API = import.meta.env.VITE_API_URL ?? "http://localhost:9902";
const QUESTION = /\?\s*$|^(who|what|when|where|why|how|is|are|does|do|can)\b/i;

type Step = "category" | "person" | "message" | "contact" | "review" | "done" | "error";

export default function Chatbot({
  family,
  open,
  onClose,
  prefillPath,
}: {
  family: Family;
  open: boolean;
  onClose: () => void;
  prefillPath: string | null;
}) {
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<(typeof SUGGESTION_CATEGORIES)[number]>("other");
  const [person, setPerson] = useState<Person | null>(null);
  const [q, setQ] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [hp, setHp] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  const fuse = useMemo(() => new Fuse(family.tree.persons, { keys: ["fullName", "aliases"], threshold: 0.32 }), [family]);
  const matches = q.trim().length >= 2 ? fuse.search(q.trim(), { limit: 5 }).map((r) => r.item) : [];

  useEffect(() => {
    if (open) slideIn(panel.current, "bottom");
  }, [open]);
  useEffect(() => {
    if (open && prefillPath) {
      const p = family.byPath.get(prefillPath) ?? null;
      setPerson(p);
      setStep("category");
    }
  }, [open, prefillPath, family]);

  if (!open) return null;

  const reset = () => {
    setStep("category");
    setPerson(null);
    setQ("");
    setMessage("");
    setName("");
    setContact("");
    setHint("");
  };

  const submit = async () => {
    const payload = {
      category,
      personId: person?.id ?? null,
      message,
      submitterName: name || undefined,
      submitterContact: contact || undefined,
      website: hp,
    };
    const parsed = SuggestionInputSchema.safeParse(payload);
    if (!parsed.success) {
      setHint("Please check the message length (5 to 1000 characters) and your details.");
      setStep("message");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      setStep(res.ok ? "done" : "error");
    } catch {
      setStep("error");
    } finally {
      setBusy(false);
    }
  };

  const onMessageNext = () => {
    const t = message.trim();
    if (t.length < 5) return setHint("Please describe the change in a few words.");
    if (QUESTION.test(t) && t.length < 120) {
      return setHint("I can only take suggestions. Please describe the change you'd like to see.");
    }
    setHint("");
    setStep("contact");
  };

  return (
    <div className="chat" role="dialog" aria-label="Suggestion assistant" ref={panel}>
      <header>
        <span>Suggestions</span>
        <button className="icon-btn" aria-label="Close suggestions" onClick={onClose}>
          <X size={20} strokeWidth={1.75} />
        </button>
      </header>
      <div className="chat-body" aria-live="polite">
        <p className="bubble">I collect suggestions and corrections for the family tree. I can't answer questions.</p>

        {step === "category" && (
          <>
            <p className="bubble">What would you like to suggest?{person && ` (About ${displayName(person)})`}</p>
            <div className="chips">
              {SUGGESTION_CATEGORIES.map((c) => (
                <button
                  key={c}
                  className="chip"
                  onClick={() => {
                    setCategory(c);
                    setStep(person ? "message" : "person");
                  }}
                >
                  {LABELS[c]}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "person" && (
          <>
            <p className="bubble">Which person is this about? You can skip this.</p>
            <input
              value={q}
              maxLength={80}
              aria-label="Search for the person"
              placeholder="Search a name"
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="chips">
              {matches.map((p) => (
                <button
                  key={p.id}
                  className="chip"
                  onClick={() => {
                    setPerson(p);
                    setStep("message");
                  }}
                >
                  {displayName(p)}
                </button>
              ))}
              <button className="chip" onClick={() => setStep("message")}>
                Skip
              </button>
            </div>
          </>
        )}

        {step === "message" && (
          <>
            <p className="bubble">Describe the change you'd like to see.</p>
            <textarea
              rows={4}
              maxLength={1000}
              value={message}
              aria-label="Your suggestion"
              onChange={(e) => setMessage(e.target.value)}
            />
            <small className="muted">{message.length} / 1000</small>
            {hint && <p className="bubble">{hint}</p>}
            <div className="chat-row">
              <button className="btn" onClick={onMessageNext}>Next</button>
            </div>
          </>
        )}

        {step === "contact" && (
          <>
            <p className="bubble">Your name and contact are optional. They let us follow up.</p>
            <input value={name} maxLength={80} aria-label="Your name" placeholder="Your name" onChange={(e) => setName(e.target.value)} />
            <input value={contact} maxLength={120} aria-label="Email or phone" placeholder="Email or phone" onChange={(e) => setContact(e.target.value)} />
            <div className="hp" aria-hidden="true">
              <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
            </div>
            <div className="chat-row">
              <button className="btn" onClick={() => setStep("review")}>Review</button>
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <p className="bubble me">
              {LABELS[category]}
              {person && ` about ${displayName(person)}`}: {message}
            </p>
            <div className="chat-row">
              <button className="btn" disabled={busy} onClick={submit}>
                <MessageSquarePlus size={16} strokeWidth={1.75} aria-hidden="true" /> Submit
              </button>
              <button className="btn ghost" onClick={() => setStep("message")}>Edit</button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <p className="bubble">Thank you, your suggestion will be reviewed.</p>
            <button className="btn ghost" onClick={reset}>Add another</button>
          </>
        )}
        {step === "error" && (
          <>
            <p className="bubble">That did not go through. Please try again in a few minutes.</p>
            <button className="btn ghost" onClick={() => setStep("review")}>Back</button>
          </>
        )}
      </div>
    </div>
  );
}
