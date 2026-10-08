import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import type { Person } from "@family-tree/shared";
import type { Family } from "../lib/data";
import { displayName } from "../lib/data";

export default function SearchBox({ family, onPick }: { family: Family; onPick: (p: Person) => void }) {
  const [q, setQ] = useState("");
  const fuse = useMemo(
    () => new Fuse(family.tree.persons, { keys: ["fullName", "aliases"], threshold: 0.32, ignoreLocation: true }),
    [family],
  );
  const results = q.trim().length >= 2 ? fuse.search(q.trim(), { limit: 8 }).map((r) => r.item) : [];

  return (
    <div className="search">
      <Search size={16} strokeWidth={1.75} aria-hidden="true" />
      <input
        type="search"
        value={q}
        maxLength={80}
        placeholder="Search a name"
        aria-label="Search the family"
        onChange={(e) => setQ(e.target.value.replace(/[\u0000-\u001f]/g, ""))}
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  onPick(p);
                  setQ("");
                }}
              >
                {displayName(p)}
                {p.isDeceased && <em> (Late)</em>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
