import type { Request } from "express";
import rateLimit from "express-rate-limit";

/*
 * Production path: browser -> Vercel (rewrite proxy) -> Cloudflare -> Render.
 * Measured on the live site:
 *  - Vercel passes a client-supplied X-Forwarded-For and x-vercel-forwarded-for through unchanged,
 *    so neither can be trusted to identify a person.
 *  - Cloudflare sets cf-connecting-ip and rejects requests that try to forge it. Through Vercel it is
 *    a Vercel egress address; when someone calls Render directly it is their real address.
 */

/** Best-effort per-person key, so one relative's typos do not lock out everyone. Forgeable. */
export function visitorKey(req: Request): string {
  const vercel = req.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  return vercel || req.get("cf-connecting-ip") || req.ip || "unknown";
}

/** Unforgeable key for hard caps. Locally (no Cloudflare) falls back to the last proxy hop or socket. */
export function edgeKey(req: Request): string {
  const cf = req.get("cf-connecting-ip");
  if (cf) return cf;
  const last = req.get("x-forwarded-for")?.split(",").pop()?.trim();
  return last || req.socket.remoteAddress || "unknown";
}

/**
 * A per-visitor limit plus a looser cap that forged headers cannot dodge.
 * failuresOnly: count only failed attempts (for login and access-code checks).
 */
export function limiters(perVisitor: number, perEdge: number, opts: { failuresOnly?: boolean; windowMs?: number } = {}) {
  const windowMs = opts.windowMs ?? 15 * 60_000;
  const skipSuccessfulRequests = !!opts.failuresOnly;
  return [
    rateLimit({ windowMs, limit: perVisitor, standardHeaders: true, legacyHeaders: false, keyGenerator: visitorKey, skipSuccessfulRequests }),
    rateLimit({ windowMs, limit: perEdge, standardHeaders: false, legacyHeaders: false, keyGenerator: edgeKey, skipSuccessfulRequests }),
  ];
}
