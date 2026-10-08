import { useEffect, useId, useRef, useState } from "react";
import type Fuse from "fuse.js";
import { Search, X } from "lucide-react";
import type { Person } from "@family-tree/shared";
import type { Family } from "../lib/data";
import { displayName, generationOf } from "../lib/data";

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, "");

export default function SearchBox({ family, onPick }: { family: Family; onPick: (p: Person) => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  // The fuzzy-search library loads on first use, not with the page.
  const [fuse, setFuse] = useState<Fuse<Person> | null>(null);
  const loadSearch = () => {
    if (fuse) return;
    void import("fuse.js").then(({ default: F }) =>
      setFuse(new F(family.tree.persons, { keys: ["fullName", "aliases"], threshold: 0.32, ignoreLocation: true })),
    );
  };
  useEffect(() => setFuse(null), [family]);
  const term = q.trim();
  const results = fuse && term.length >= 2 ? fuse.search(term, { limit: 8 }).map((r) => r.item) : [];
  const show = open && term.length >= 2;

  useEffect(() => setActive(0), [term]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const pick = (p: Person) => {
    // Married-in relatives have no branch address; open their partner instead.
    const target = p.path ? p : family.spousesOf.get(p.id)?.find((x) => x.path);
    if (!target) return;
    onPick(target);
    setQ("");
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      pick(results[active]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const context = (p: Person) => {
    const g = generationOf(p);
    if (g === null) {
      const sp = family.spousesOf.get(p.id)?.[0];
      return sp ? `Spouse of ${sp.fullName}` : "Married into the family";
    }
    return g === 0 ? "Family root" : `Generation ${g} · Branch ${p.path!.split(".")[0]}`;
  };

  return (
    <div className="search" ref={box}>
      <Search size={16} strokeWidth={1.75} aria-hidden="true" />
      <input
        type="search"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-activedescendant={show && results[active] ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        value={q}
        maxLength={80}
        placeholder="Search a name"
        aria-label="Search the family"
        onChange={(e) => {
          setQ(clean(e.target.value));
          loadSearch();
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          loadSearch();
        }}
        onPointerEnter={loadSearch}
        onKeyDown={onKey}
      />
      {q && (
        <button className="search-clear" aria-label="Clear search" onClick={() => setQ("")}>
          <X size={16} strokeWidth={1.75} />
        </button>
      )}
      {show && (
        <ul className="search-results" id={listId} role="listbox" aria-label="Matching people">
          {results.length === 0 && <li className="search-empty">No one found for "{term}"</li>}
          {results.map((p, i) => (
            <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                tabIndex={-1}
                className={i === active ? "active" : undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                <span>
                  {displayName(p)}
                  {p.isDeceased && <span className="badge">Late</span>}
                </span>
                <small className="muted">{context(p)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
