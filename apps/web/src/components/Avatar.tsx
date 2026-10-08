import { User } from "lucide-react";
import type { Person } from "@family-tree/shared";
import { initials } from "../lib/data";

export default function Avatar({ person, size = 40 }: { person: Person; size?: number }) {
  return (
    <span
      className={`avatar${person.isDeceased ? " late" : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Photo of ${person.fullName} not yet available`}
    >
      <User size={Math.round(size * 0.35)} strokeWidth={1.75} aria-hidden="true" />
      <b aria-hidden="true">{initials(person)}</b>
    </span>
  );
}
