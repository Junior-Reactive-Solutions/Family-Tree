import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { MessageSquarePlus, X } from "lucide-react";
import type { Person } from "@family-tree/shared";
import { useFamily } from "../lib/context";
import { displayName, generationOf } from "../lib/data";
import { slideIn } from "../lib/motion";
import Avatar from "./Avatar";

export default function PersonDrawer() {
  const { family, openPerson, openChat } = useFamily();
  const [params] = useSearchParams();
  const path = params.get("person");
  const person = path ? family.byPath.get(path) : undefined;
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (person) slideIn(ref.current, window.innerWidth < 768 ? "bottom" : "right");
  }, [person]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPerson(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPerson]);

  if (!person) return null;

  const links = (list: Person[] | undefined) =>
    list?.length ? (
      <ul>
        {list.map((p) => (
          <li key={p.id}>
            {p.path ? <button className="link" onClick={() => openPerson(p.path)}>{displayName(p)}</button> : displayName(p)}
            {p.isDeceased && <span className="badge">Late</span>}
          </li>
        ))}
      </ul>
    ) : (
      <p className="muted">None recorded</p>
    );

  const parents = family.parentsOf.get(person.id);
  const siblings = parents?.[0]
    ? (family.childrenOf.get(parents[0].id) ?? []).filter((s) => s.id !== person.id)
    : [];
  const gen = generationOf(person);

  return (
    <aside className="drawer" ref={ref} aria-label={`Profile of ${person.fullName}`}>
      <div className="drawer-head">
        <Avatar person={person} size={64} />
        <div>
          <h2>{displayName(person)}</h2>
          <p className="muted">
            {gen !== null ? `Generation ${gen}` : "Married into the family"}
            {person.isDeceased && <span className="badge">Late</span>}
          </p>
        </div>
        <button className="icon-btn" aria-label="Close profile" onClick={() => openPerson(null)}>
          <X size={20} strokeWidth={1.75} />
        </button>
      </div>
      {person.aliases.length > 0 && <p className="muted">Also written as: {person.aliases.join(", ")}</p>}
      <h3>Spouse</h3>
      {links(family.spousesOf.get(person.id))}
      <h3>Parents</h3>
      {links(parents)}
      <h3>Siblings</h3>
      {links(siblings)}
      <h3>Children</h3>
      {links(family.childrenOf.get(person.id))}
      <div className="drawer-actions">
        {person.path && (
          <Link className="btn" to={`/tree?focus=${person.path}`}>
            View in tree
          </Link>
        )}
        <button className="btn ghost" onClick={() => openChat(person.path)}>
          <MessageSquarePlus size={16} strokeWidth={1.75} aria-hidden="true" /> Suggest a correction
        </button>
      </div>
    </aside>
  );
}
