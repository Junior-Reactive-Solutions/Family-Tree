import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { createChart } from "family-chart";
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
  const focus = params.get("focus") ?? "1";
  const focusId = (family.byPath.get(focus) ?? family.byPath.get("1")!).id;

  useEffect(() => {
    if (!host.current) return;
    host.current.innerHTML = "";
    const chart = createChart(host.current, family.chart);
    chart.setTransitionTime(250).setCardXSpacing(230).setCardYSpacing(140);
    chart.setAncestryDepth(2).setProgenyDepth(2).setShowSiblingsOfMain(false);
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
  }, [family]);

  useEffect(() => {
    const c = chartRef.current;
    if (!c) return;
    c.updateMainId(focusId);
    c.updateTree({ tree_position: "main_to_middle" });
  }, [focusId]);

  return (
    <section className="tree-wrap">
      <div className="f3" ref={host} aria-label="Interactive family tree. Use the Branches page for a text list." />
    </section>
  );
}
