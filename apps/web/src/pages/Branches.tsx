import type { Person } from "@family-tree/shared";
import { useFamily } from "../lib/context";
import { displayName } from "../lib/data";

function Node({ p }: { p: Person }) {
  const { family, openPerson } = useFamily();
  const kids = family.childrenOf.get(p.id) ?? [];
  const spouse = family.spousesOf.get(p.id) ?? [];
  return (
    <li>
      <button className="link" onClick={() => openPerson(p.path)}>
        <span className="path">{p.path}</span> {displayName(p)}
      </button>
      {p.isDeceased && <span className="badge">Late</span>}
      {spouse.length > 0 && (
        <span className="muted">
          {" "}
          m. {spouse.map((s) => displayName(s) + (s.isDeceased ? " (Late)" : "")).join("; ")}
        </span>
      )}
      {kids.length > 0 && (
        <ul>
          {kids.map((k) => <Node key={k.id} p={k} />)}
        </ul>
      )}
    </li>
  );
}

export default function Branches() {
  const { family } = useFamily();
  const heads = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => family.byPath.get(String(n))!);
  return (
    <section className="container">
      <h1>Branches</h1>
      <p className="muted">Each branch follows the children of one child of Antiel and Maria Christine.</p>
      {heads.map((h) => (
        <details key={h.id} className="acc" open={h.path === "1"}>
          <summary>
            Branch {h.path}: {displayName(h)}
            {h.isDeceased && <span className="badge">Late</span>}
          </summary>
          <ul className="tree-list">
            {(family.childrenOf.get(h.id) ?? []).map((c) => <Node key={c.id} p={c} />)}
          </ul>
        </details>
      ))}
    </section>
  );
}
