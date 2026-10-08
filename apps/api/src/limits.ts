import type { Request } from "express";
import rateLimit from "express-rate-limit";

/**
 * The address that connected to our hosting proxy: the right-most X-Forwarded-For entry
 * (appended by Render), or the socket address locally. Through Vercel this is a Vercel edge;
 * when someone calls the API directly it is their real address and cannot be forged.
 */
export function edgeKey(req: Request): string {
  const xff = req.get("x-forwarded-for");
  const last = xff?.split(",").pop()?.trim();
  return last || req.socket.remoteAddress || "unknown";
}

/** Per visitor (req.ip honours TRUST_PROXY) plus a looser per-edge cap that forged headers cannot dodge. */
export function limiters(perVisitor: number, perEdge: number, windowMs = 15 * 60_000) {
  return [
    rateLimit({ windowMs, limit: perVisitor, standardHeaders: true, legacyHeaders: false }),
    rateLimit({ windowMs, limit: perEdge, standardHeaders: false, legacyHeaders: false, keyGenerator: edgeKey }),
  ];
}
