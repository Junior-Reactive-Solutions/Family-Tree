import { createHmac, timingSafeEqual } from "node:crypto";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

const COOKIE = "family_access";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const prod = process.env.NODE_ENV === "production";
const secret = process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me";
const code = process.env.FAMILY_ACCESS_CODE ?? "";

// Fail closed in production: without a code the family data is never served.
export const gateEnabled = prod || code.length > 0;

const sign = (v: string) => createHmac("sha256", secret).update(`access:${v}`).digest("base64url");
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
// Compare fixed-length digests so the code length is not leaked by timing.
const digest = (s: string) => createHmac("sha256", secret).update(`code:${s.trim().toLowerCase()}`).digest();

function hasAccess(req: Request): boolean {
  if (!gateEnabled) return true;
  if (!code) return false;
  const raw = req.cookies?.[COOKIE] as string | undefined;
  const [exp, sig] = (raw ?? "").split(".");
  if (!exp || !sig || !safeEq(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

export function requireAccess(req: Request, res: Response, next: NextFunction) {
  if (hasAccess(req)) return next();
  res.set("Cache-Control", "no-store");
  return res.status(401).json({ error: "Access code required" });
}

const BodySchema = z.object({ code: z.string().min(1).max(100) });

export function accessRouter() {
  const r = express.Router();
  r.use(cookieParser());
  r.use(express.json({ limit: "1kb" }));
  r.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });

  r.get("/", (req, res) => res.json({ ok: hasAccess(req), required: gateEnabled }));
  r.post("/", limiter, (req, res) => {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success || !code) return res.status(401).json({ error: "Incorrect code" });
    if (!timingSafeEqual(digest(parsed.data.code), digest(code))) return res.status(401).json({ error: "Incorrect code" });
    const exp = String(Date.now() + TTL_MS);
    res.cookie(COOKIE, `${exp}.${sign(exp)}`, {
      httpOnly: true,
      secure: prod,
      sameSite: "strict",
      maxAge: TTL_MS,
      path: "/",
    });
    res.json({ ok: true });
  });
  r.delete("/", (_req, res) => {
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ ok: true });
  });
  return r;
}
