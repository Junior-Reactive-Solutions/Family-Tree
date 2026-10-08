import { animate, stagger } from "animejs";
import { useEffect, type RefObject } from "react";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Staggered fade-up for children matching `selector`. No-op under reduced motion. */
export function useFadeUp(ref: RefObject<HTMLElement | null>, selector: string, deps: unknown[] = []) {
  useEffect(() => {
    if (!ref.current || reduced()) return;
    const targets = ref.current.querySelectorAll(selector);
    if (!targets.length) return;
    animate(targets, { opacity: [0, 1], translateY: [12, 0], duration: 380, ease: "outQuad", delay: stagger(40) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function slideIn(el: HTMLElement | null, from: "right" | "bottom") {
  if (!el || reduced()) return;
  animate(el, {
    opacity: [0, 1],
    translateX: from === "right" ? [24, 0] : [0, 0],
    translateY: from === "bottom" ? [32, 0] : [0, 0],
    duration: 300,
    ease: "outCubic",
  });
}

export function countUp(el: HTMLElement | null, to: number) {
  if (!el) return;
  if (reduced()) {
    el.textContent = String(to);
    return;
  }
  const state = { v: 0 };
  animate(state, { v: to, duration: 700, ease: "outQuad", onUpdate: () => (el.textContent = String(Math.round(state.v))) });
}
