import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { createChart } from "family-chart";
import { select } from "d3";
import { Heart, HeartOff, Maximize, Users, UsersRound, ZoomIn, ZoomOut } from "lucide-react";
import "family-chart/styles/family-chart.css";
import { useFamily } from "../lib/context";
import { displayName, initials } from "../lib/data";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function TreePage() {
  const { family, openPerson } = useFamily();
  const [params, setParams] = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const [whole, setWhole] = useState(false);
  const [spouses, setSpouses] = useState(true);
  const [depth, setDepth] = useState(2);
  const focus = params.get("focus") ?? "1";
  const focusId = (family.byPath.get(focus) ?? family.byPath.get("1")!).id;

  const chartData = useMemo(() => {
    if (spouses) return family.chart;
    const keep = new Set(family.tree.persons.filter((p) => p.isBloodMember).map((p) => p.id));
    return family.chart
      .filter((d) => keep.has(d.id))
      .map((d) => ({ ...d, rels: { parents: d.rels.parents.filter((x) => keep.has(x)), spouses: [], children: d.rels.children.filter((x) => keep.has(x)) } }));
  }, [family, spouses]);

  useEffect(() => {
    if (!host.current) return;
    host.current.innerHTML = "";
    const chart = createChart(host.current, chartData);
    chart.setTransitionTime(250).setCardXSpacing(230).setCardYSpacing(140);
    chart.setAncestryDepth(whole ? 6 : depth).setProgenyDepth(whole ? 6 : depth).setShowSiblingsOfMain(false);
    const card = chart.setCardHtml();
    card.setCardDim({ w: 200, h: 70, text_x: 70, text_y: 12, img_w: 0, img_h: 0, img_x: 0, img_y: 0 });
    card.setCardInnerHtmlCreator((d) => {
      const p = family.byId.get(d.data.id);
      if (!p) return "";
      return `<div class="tree-card${p.isDeceased ? " late" : ""}${p.isBloodMember ? "" : " spouse"}">
        <span class="avatar" aria-hidden="true"><b>${esc(initials(p))}</b></span>
        <span class="tc-text"><strong>${esc(displayName(p))}</strong>${p.isDeceased ? '<em class="badge">Late</em>' : ""}</span>
      </div>`;
    });
    card.setOnCardClick((_e: unknown, d: { data: { id: string } }) => {
      const p = family.byId.get(d.data.id);
      chart.updateMainId(d.data.id);
      chart.updateTree({ tree_position: "main_to_middle" });
      if (p?.path) {
        const next = new URLSearchParams(window.location.search);
        next.set("focus", p.path);
        next.set("person", p.path);
        setParams(next, { replace: true });
        openPerson(p.path);
      }
    });
    chart.updateMainId(focusId);
    chart.updateTree({ initial: true });
    chartRef.current = chart;
    return () => {
      if (host.current) host.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, whole, spouses, depth, chartData]);

  useEffect(() => {
    const c = chartRef.current;
    if (!c) return;
    c.updateMainId(focusId);
    c.updateTree({ tree_position: "main_to_middle" });
  }, [focusId]);

  const zoom = (amount: number) => {
    const svg = host.current?.querySelector("svg") as (SVGElement & { __zoomObj?: any }) | null;
    const el = (svg?.__zoomObj ? svg : svg?.parentNode) as (Element & { __zoomObj?: any }) | null;
    if (!el?.__zoomObj) return;
    select(el).transition().duration(200).call(el.__zoomObj.scaleBy, amount);
  };

  return (
    <section className="tree-wrap">
      <div className="tree-controls" role="toolbar" aria-label="Tree controls">
        <button className="icon-btn" aria-label="Zoom in" onClick={() => zoom(1.3)}><ZoomIn size={20} strokeWidth={1.75} /></button>
        <button className="icon-btn" aria-label="Zoom out" onClick={() => zoom(1 / 1.3)}><ZoomOut size={20} strokeWidth={1.75} /></button>
        <button className="icon-btn" aria-label="Fit tree to screen" onClick={() => chartRef.current?.updateTree({ tree_position: "fit", transition_time: 250 })}><Maximize size={20} strokeWidth={1.75} /></button>
        <button className="icon-btn" aria-pressed={whole} aria-label={whole ? "Show focused branch only" : "Show whole family"} title={whole ? "Focused view" : "Whole family"} onClick={() => setWhole((w) => !w)}>
          {whole ? <Users size={20} strokeWidth={1.75} /> : <UsersRound size={20} strokeWidth={1.75} />}
        </button>
        <button className="icon-btn" aria-pressed={spouses} aria-label={spouses ? "Hide spouses" : "Show spouses"} title={spouses ? "Hide spouses" : "Show spouses"} onClick={() => setSpouses((x) => !x)}>
          {spouses ? <Heart size={20} strokeWidth={1.75} /> : <HeartOff size={20} strokeWidth={1.75} />}
        </button>
        <select aria-label="Generations shown" value={depth} disabled={whole} onChange={(e) => setDepth(Number(e.target.value))}>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} generation{n > 1 ? "s" : ""}</option>)}
        </select>
        <select aria-label="Jump to branch" value="" onChange={(e) => e.target.value && setParams({ focus: e.target.value })}>
          <option value="">Branch</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={String(n)}>Branch {n}: {family.byPath.get(String(n))?.fullName.split(" ")[0]}</option>)}
        </select>
      </div>
      <div className="f3" ref={host} aria-label="Interactive family tree. Use the Branches page for a text list." />
    </section>
  );
}
