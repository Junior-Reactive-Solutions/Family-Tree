import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { ArrowRight, GitBranch, ListTree, MessageSquarePlus } from "lucide-react";
import { useFamily } from "../lib/context";
import { displayName } from "../lib/data";
import { countUp, useFadeUp } from "../lib/motion";
import { useMedia } from "../lib/useMedia";
import Avatar from "../components/Avatar";

export default function Home() {
  const { family } = useFamily();
  const narrow = useMedia("(max-width: 767px)");
  const cards = useRef<HTMLDivElement>(null);
  const s1 = useRef<HTMLElement>(null);
  const s2 = useRef<HTMLElement>(null);
  const s3 = useRef<HTMLElement>(null);

  const heads = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => family.byPath.get(String(n))!);
  const root = family.byPath.get("0")!;
  const rootSpouse = family.spousesOf.get(root.id)?.[0];
  const total = family.tree.persons.length;
  const living = family.tree.persons.filter((p) => !p.isDeceased).length;

  useFadeUp(cards, ".branch-card");
  useEffect(() => {
    countUp(s1.current, total);
    countUp(s2.current, 5);
    countUp(s3.current, living);
  }, [total, living]);

  const descendants = (path: string) =>
    family.tree.persons.filter((p) => p.isBloodMember && p.path?.startsWith(path + ".")).length;
  const spouseOf = (id: string) => family.spousesOf.get(id)?.[0];

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <p className="eyebrow">The Bintukwanga family</p>
            <h1>Five generations, one family</h1>
            <p className="lead">
              Descendants of Antiel Bintukwanga and Maria Christine Nakayima. Find a relative, follow a branch, and
              help keep the record accurate.
            </p>
            <div className="hero-actions">
              <Link className="btn" to={narrow ? "/tree" : "/tree?focus=1"}>
                <GitBranch size={18} strokeWidth={1.75} aria-hidden="true" /> Explore the tree
              </Link>
              <Link className="btn ghost" to="/branches">
                <ListTree size={18} strokeWidth={1.75} aria-hidden="true" /> Browse as a list
              </Link>
            </div>
          </div>

          <aside className="root-card" aria-label="The root couple">
            <div className="root-couple">
              <div>
                <Avatar person={root} size={64} />
                <strong>{displayName(root)}</strong>
                <span className="badge">Late</span>
              </div>
              <span className="root-link" aria-hidden="true" />
              {rootSpouse && (
                <div>
                  <Avatar person={rootSpouse} size={64} />
                  <strong>{displayName(rootSpouse)}</strong>
                  <span className="badge">Late</span>
                </div>
              )}
            </div>
            <dl className="stats">
              <div><dt>People</dt><dd><b ref={s1}>0</b></dd></div>
              <div><dt>Generations</dt><dd><b ref={s2}>0</b></dd></div>
              <div><dt>Living</dt><dd><b ref={s3}>0</b></dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="home-section" aria-labelledby="branches-h">
        <div className="section-head">
          <h2 id="branches-h">The nine branches</h2>
          <p className="muted">Each branch begins with one child of Antiel and Maria Christine.</p>
        </div>
        <div className="branch-grid" ref={cards}>
          {heads.map((h) => {
            const sp = spouseOf(h.id);
            return (
              <Link key={h.id} to={narrow ? `/branches?open=${h.path}` : `/tree?focus=${h.path}`} className="branch-card">
                <span className="branch-numeral" aria-hidden="true">{h.path}</span>
                <div className="branch-body">
                  <span className="branch-no">Branch {h.path}</span>
                  <h3>{displayName(h)}{h.isDeceased && <span className="badge on-dark">Late</span>}</h3>
                  {sp && <p className="muted">with {displayName(sp)}</p>}
                  <p className="muted">{descendants(h.path!)} descendants</p>
                </div>
                <ArrowRight className="branch-arrow" size={20} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-section" aria-labelledby="how-h">
        <div className="section-head"><h2 id="how-h">Finding your way</h2></div>
        <ul className="how">
          <li>
            <GitBranch size={24} strokeWidth={1.75} aria-hidden="true" />
            <h3>The tree</h3>
            <p>Tap or click anyone to centre the tree on them and see their parents, spouse and children.</p>
          </li>
          <li>
            <ListTree size={24} strokeWidth={1.75} aria-hidden="true" />
            <h3>Branch lists</h3>
            <p>Read each branch as a simple list, the way it was first written down. Easy to print.</p>
          </li>
          <li>
            <MessageSquarePlus size={24} strokeWidth={1.75} aria-hidden="true" />
            <h3>Suggestions</h3>
            <p>Spot a missing name or a mistake? Use the button at the corner of any page to tell us.</p>
          </li>
        </ul>
      </section>
    </>
  );
}
