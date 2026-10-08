import { useSearchParams } from "react-router";
import { GitBranch, Heart, IdCard, Users } from "lucide-react";
import type { Person } from "@family-tree/shared";
import { useFamily } from "../lib/context";
import { displayName, generationOf } from "../lib/data";
import Avatar from "./Avatar";
import PersonRow from "./PersonRow";
import { useTitle } from "../lib/useTitle";

/** Phone-friendly way to move through the tree: one person at a time, tap to go up or down. */
export default function FocusNavigator({ onDiagram }: { onDiagram: () => void }) {
  const { family, openPerson } = useFamily();
  const [params, setParams] = useSearchParams();
  const person = family.byPath.get(params.get("focus") ?? "1") ?? family.byPath.get("1")!;

  useTitle(person.fullName);

  const go = (p: Person) => {
    if (!p.path) return openPerson(null);
    const next = new URLSearchParams(params);
    next.set("focus", p.path);
    next.delete("person");
    setParams(next);
    window.scrollTo({ top: 0 });
  };

  const crumbs: Person[] = [];
  if (person.path) {
    const parts = person.path.split(".");
    for (let i = 1; i <= parts.length; i++) {
      const p = family.byPath.get(parts.slice(0, i).join("."));
      if (p) crumbs.push(p);
    }
  }
  const spouses = family.spousesOf.get(person.id) ?? [];
  const parents = family.parentsOf.get(person.id) ?? [];
  const siblings = (parents[0] ? family.childrenOf.get(parents[0].id) ?? [] : []).filter((s) => s.id !== person.id);
  const children = family.childrenOf.get(person.id) ?? [];

  return (
    <div className="navigator">
      <div className="nav-top">
        <nav className="crumbs" aria-label="Path from the family root">
          {crumbs.map((c, i) => (
            <button key={c.id} onClick={() => go(c)} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
              {c.fullName.split(" ")[0]}
            </button>
          ))}
        </nav>
        <button className="btn ghost small" onClick={onDiagram}>
          <GitBranch size={16} strokeWidth={1.75} aria-hidden="true" /> Diagram
        </button>
      </div>

      <section className="focus-card" aria-label="Selected person">
        <Avatar person={person} size={72} />
        <h2>{displayName(person)}</h2>
        <p className="muted">
          {generationOf(person) !== null ? `Generation ${generationOf(person)}` : "Married into the family"}
          {person.isDeceased && <span className="badge">Late</span>}
        </p>
        {spouses.length > 0 && (
          <p className="spouse-line">
            <Heart size={16} strokeWidth={1.75} aria-hidden="true" /> {spouses.map((s) => displayName(s) + (s.isDeceased ? " (Late)" : "")).join(", ")}
          </p>
        )}
        <button className="btn ghost" onClick={() => openPerson(person.path)}>
          <IdCard size={16} strokeWidth={1.75} aria-hidden="true" /> Full profile
        </button>
      </section>

      {parents.length > 0 && (
        <section>
          <h3 className="nav-h">Parents</h3>
          <div className="nav-list">{parents.map((p) => <PersonRow key={p.id} person={p} onSelect={go} />)}</div>
        </section>
      )}
      <section>
        <h3 className="nav-h"><Users size={16} strokeWidth={1.75} aria-hidden="true" /> Children ({children.length})</h3>
        {children.length === 0 ? (
          <p className="muted">No children recorded.</p>
        ) : (
          <div className="nav-list">
            {children.map((c) => {
              const n = family.childrenOf.get(c.id)?.length ?? 0;
              return <PersonRow key={c.id} person={c} onSelect={go} hint={n ? `${n} ${n === 1 ? "child" : "children"}` : undefined} />;
            })}
          </div>
        )}
      </section>
      {siblings.length > 0 && (
        <section>
          <h3 className="nav-h">Siblings</h3>
          <div className="chips">
            {siblings.map((s) => (
              <button key={s.id} className="chip" onClick={() => go(s)}>
                {s.fullName.split(" ").slice(0, 2).join(" ")}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
