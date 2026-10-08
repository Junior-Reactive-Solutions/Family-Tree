import { useRef } from "react";
import { useSearchParams } from "react-router";
import { ChevronsDownUp, ChevronsUpDown, Printer } from "lucide-react";
import type { Person } from "@family-tree/shared";
import { useFamily } from "../lib/context";
import { displayName } from "../lib/data";
import { useTitle } from "../lib/useTitle";

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
        <span className="muted spouse-inline">
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
  const [params] = useSearchParams();
  const open = params.get("open") ?? "1";
  const wrap = useRef<HTMLDivElement>(null);
  useTitle("Branches");

  const heads = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => family.byPath.get(String(n))!);
  const count = (path: string) =>
    family.tree.persons.filter((p) => p.isBloodMember && p.path?.startsWith(path + ".")).length;
  const setAll = (value: boolean) =>
    wrap.current?.querySelectorAll("details").forEach((d) => (d.open = value));

  return (
    <section className="container branches">
      <div className="page-head">
        <div>
          <h1>Branches</h1>
          <p className="muted">Each branch follows the descendants of one child of Antiel and Maria Christine.</p>
        </div>
        <div className="page-tools">
          <button className="btn ghost" onClick={() => setAll(true)}>
            <ChevronsUpDown size={16} strokeWidth={1.75} aria-hidden="true" /> Expand all
          </button>
          <button className="btn ghost" onClick={() => setAll(false)}>
            <ChevronsDownUp size={16} strokeWidth={1.75} aria-hidden="true" /> Collapse all
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              setAll(true);
              window.print();
            }}
          >
            <Printer size={16} strokeWidth={1.75} aria-hidden="true" /> Print
          </button>
        </div>
      </div>
      <div ref={wrap}>
        {heads.map((h) => {
          const sp = family.spousesOf.get(h.id)?.[0];
          return (
            <details key={h.id} className="acc" open={h.path === open}>
              <summary>
                <span className="acc-no" aria-hidden="true">{h.path}</span>
                <span className="acc-title">
                  {displayName(h)}
                  {h.isDeceased && <span className="badge">Late</span>}
                  {sp && <small className="muted">m. {displayName(sp)}</small>}
                </span>
                <span className="acc-count">{count(h.path!)} descendants</span>
              </summary>
              <ul className="tree-list">
                {(family.childrenOf.get(h.id) ?? []).map((c) => <Node key={c.id} p={c} />)}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
