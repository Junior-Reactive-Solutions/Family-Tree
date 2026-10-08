import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { GitBranch, MessageSquarePlus, X } from "lucide-react";
import type { Person } from "@family-tree/shared";
import { useFamily } from "../lib/context";
import { displayName, generationOf } from "../lib/data";
import { slideIn } from "../lib/motion";
import Avatar from "./Avatar";
import PersonRow from "./PersonRow";

export default function PersonDrawer() {
  const { family, openPerson, openChat } = useFamily();
  const [params] = useSearchParams();
  const path = params.get("person");
  const person = path ? family.byPath.get(path) : undefined;
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!person) return;
    if (!returnTo.current) returnTo.current = document.activeElement;
    slideIn(ref.current, window.innerWidth < 768 ? "bottom" : "right");
    ref.current?.scrollTo({ top: 0 });
    closeRef.current?.focus({ preventScroll: true });
  }, [person]);

  useEffect(() => {
    if (person) return;
    // Return focus to whatever opened the drawer.
    (returnTo.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    returnTo.current = null;
  }, [person]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && person && openPerson(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPerson, person]);

  if (!person) return null;

  const go = (p: Person) => p.path && openPerson(p.path);
  const section = (title: string, list: Person[] | undefined, hint?: (p: Person) => string | undefined) => (
    <section>
      <h3>{title}</h3>
      {list?.length ? (
        <div className="nav-list">
          {list.map((p) => <PersonRow key={p.id} person={p} onSelect={go} hint={hint?.(p)} />)}
        </div>
      ) : (
        <p className="muted">None recorded</p>
      )}
    </section>
  );

  const parents = family.parentsOf.get(person.id);
  const siblings = parents?.[0]
    ? (family.childrenOf.get(parents[0].id) ?? []).filter((s) => s.id !== person.id)
    : [];
  const spouses = family.spousesOf.get(person.id);
  const gen = generationOf(person);
  const kidsHint = (p: Person) => {
    const n = family.childrenOf.get(p.id)?.length ?? 0;
    return n ? `${n} ${n === 1 ? "child" : "children"}` : undefined;
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={() => openPerson(null)} aria-hidden="true" />
      <aside className="drawer" ref={ref} role="dialog" aria-modal="false" aria-labelledby="drawer-title">
        <div className="drawer-head">
          <Avatar person={person} size={64} />
          <div>
            <h2 id="drawer-title">{displayName(person)}</h2>
            <p className="muted">
              {gen !== null ? `Generation ${gen}` : "Married into the family"}
              {person.path && person.path !== "0" && <> · Branch {person.path.split(".")[0]}</>}
              {person.isDeceased && <span className="badge">Late</span>}
            </p>
          </div>
          <button ref={closeRef} className="icon-btn" aria-label="Close profile" onClick={() => openPerson(null)}>
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        {person.aliases.length > 0 && <p className="muted aliases">Also written as: {person.aliases.join(", ")}</p>}
        <div className="drawer-actions">
          {person.path && (
            <Link className="btn" to={`/tree?focus=${person.path}&person=${person.path}`}>
              <GitBranch size={16} strokeWidth={1.75} aria-hidden="true" /> View in tree
            </Link>
          )}
          <button className="btn ghost" onClick={() => openChat(person.path)}>
            <MessageSquarePlus size={16} strokeWidth={1.75} aria-hidden="true" /> Suggest a correction
          </button>
        </div>
        {section(spouses && spouses.length > 1 ? "Spouses" : "Spouse", spouses)}
        {section("Parents", parents)}
        {section(`Children${family.childrenOf.get(person.id)?.length ? ` (${family.childrenOf.get(person.id)!.length})` : ""}`, family.childrenOf.get(person.id), kidsHint)}
        {section("Siblings", siblings)}
      </aside>
    </>
  );
}
