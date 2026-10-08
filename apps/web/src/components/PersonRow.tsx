import { ChevronRight } from "lucide-react";
import type { Person } from "@family-tree/shared";
import { displayName } from "../lib/data";
import Avatar from "./Avatar";

/** A tappable relative: avatar, name, late badge and an optional hint. Married-in relatives are not navigable. */
export default function PersonRow({
  person,
  hint,
  onSelect,
}: {
  person: Person;
  hint?: string;
  onSelect: (p: Person) => void;
}) {
  const navigable = !!person.path;
  return (
    <button className="nav-row" onClick={() => onSelect(person)} disabled={!navigable}>
      <Avatar person={person} size={40} />
      <span className="nav-name">
        {displayName(person)}
        {person.isDeceased && <span className="badge">Late</span>}
        {hint && <small className="muted">{hint}</small>}
      </span>
      {navigable && <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  );
}
