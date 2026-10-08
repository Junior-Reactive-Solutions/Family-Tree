import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { useFamily } from "../lib/context";
import { displayName, generationOf } from "../lib/data";
import { countUp, useFadeUp } from "../lib/motion";

export default function Home() {
  const { family } = useFamily();
  const cards = useRef<HTMLDivElement>(null);
  const stat1 = useRef<HTMLElement>(null);
  const stat2 = useRef<HTMLElement>(null);
  const stat3 = useRef<HTMLElement>(null);
  const heads = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => family.byPath.get(String(n))!);
  const total = family.tree.persons.length;
  const living = family.tree.persons.filter((p) => !p.isDeceased).length;

  useFadeUp(cards, ".branch-card");
  useEffect(() => {
    countUp(stat1.current, total);
    countUp(stat2.current, 5);
    countUp(stat3.current, living);
  }, [total, living]);

  const descendants = (path: string) =>
    family.tree.persons.filter((p) => p.isBloodMember && p.path?.startsWith(path + ".")).length;

  return (
    <>
      <section className="hero">
        <p className="eyebrow">The descendants of</p>
        <h1>Antiel Bintukwanga and Maria Christine Nakayima</h1>
        <p className="lead">
          Five generations across nine branches. Explore the family, see who is who, and help keep the record accurate.
        </p>
        <dl className="stats">
          <div><dt>People</dt><dd><b ref={stat1}>0</b></dd></div>
          <div><dt>Generations</dt><dd><b ref={stat2}>0</b></dd></div>
          <div><dt>Living members</dt><dd><b ref={stat3}>0</b></dd></div>
        </dl>
      </section>
      <section className="container" aria-labelledby="branches-h">
        <h2 id="branches-h">The nine branches</h2>
        <div className="branch-grid" ref={cards}>
          {heads.map((h) => (
            <Link key={h.id} to={`/tree?focus=${h.path}`} className="branch-card">
              <span className="branch-no">Branch {h.path}</span>
              <h3>{displayName(h)}</h3>
              <p className="muted">
                {descendants(h.path!)} descendants{generationOf(h) === 1 && h.isDeceased ? ", late" : ""}
              </p>
              <span className="more">
                Open branch <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
