import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { verify } from "@node-rs/argon2";
import cookieParser from "cookie-parser";
import { desc, eq } from "drizzle-orm";
import express, { type NextFunction, type Request, type Response } from "express";
import { limiters } from "./limits.js";
import { z } from "zod";
import { cleanLine as clean, cleanText } from "@family-tree/shared";
import type { drizzle } from "drizzle-orm/neon-http";
import { admins, persons, suggestions } from "./db/schema.js";

type Db = ReturnType<typeof drizzle>;

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const secret = process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me";
const prod = process.env.NODE_ENV === "production";
if (prod && !process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required in production");

const sign = (payload: string) => createHmac("sha256", secret).update(payload).digest("base64url");
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Sessions are bound to the current password hash: changing the password or deleting the admin ends them.
const fingerprint = (passwordHash: string) => createHmac("sha256", secret).update(`pw:${passwordHash}`).digest("base64url");

function issueSession(adminId: string, passwordHash: string) {
  const csrf = randomBytes(16).toString("base64url");
  const body = `${adminId}.${Date.now() + SESSION_TTL_MS}.${csrf}`;
  return { token: `${body}.${sign(`${body}:${fingerprint(passwordHash)}`)}`, csrf };
}

function parseSession(token: string | undefined) {
  const parts = (token ?? "").split(".");
  if (parts.length !== 4) return null;
  const [adminId, exp, csrf, sig] = parts as [string, string, string, string];
  if (!/^[0-9a-f-]{36}$/.test(adminId) || !(Number(exp) > Date.now())) return null;
  return { adminId, exp, csrf, sig };
}

const LoginSchema = z.object({ email: z.string().max(254).email(), password: z.string().min(1).max(200) });
const StatusSchema = z.object({ status: z.enum(["new", "reviewed", "applied", "rejected"]) });
const PersonPatchSchema = z
  .object({
    fullName: z.string().transform(clean).pipe(z.string().min(1).max(120)),
    title: z.string().transform(clean).pipe(z.string().max(20)).nullable(),
    aliases: z.array(z.string().transform(clean).pipe(z.string().min(1).max(120))).max(20),
    isDeceased: z.boolean(),
    gender: z.enum(["M", "F", "U"]),
    bio: z.string().max(8000).transform(cleanText).pipe(z.string().max(2000)).nullable(),
    needsReview: z.boolean(),
    reviewNote: z.string().transform(clean).pipe(z.string().max(500)).nullable(),
  })
  .partial()
  .strict();


export function adminRouter(db: Db | null) {
  const r = express.Router();
  r.use(cookieParser());
  r.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!db) return res.status(503).json({ error: "Admin requires a database" });
    next();
  });

  const loginLimiter = limiters(5, 20, { failuresOnly: true });

  r.post("/login", ...loginLimiter, async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid credentials" });
    const [row] = await db!.select().from(admins).where(eq(admins.email, parsed.data.email.toLowerCase())).limit(1);
    // Verify against a dummy hash when the account is missing to keep timing similar.
    const ok = row ? await verify(row.passwordHash, parsed.data.password).catch(() => false) : false;
    if (!row || !ok) return res.status(401).json({ error: "Invalid credentials" });
    const { token, csrf } = issueSession(row.id, row.passwordHash);
    res.cookie("session", token, {
      httpOnly: true,
      secure: prod,
      sameSite: "strict",
      maxAge: SESSION_TTL_MS,
      path: "/api/admin",
    });
    res.json({ ok: true, csrf });
  });

  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const p = parseSession(req.cookies?.session);
    if (!p) return res.status(401).json({ error: "Not signed in" });
    let row: { passwordHash: string } | undefined;
    try {
      [row] = await db!
        .select({ passwordHash: admins.passwordHash })
        .from(admins)
        .where(eq(admins.id, p.adminId))
        .limit(1);
    } catch (e) {
      console.error(e);
      return res.status(503).json({ error: "Please try again shortly" });
    }
    const expected = row ? sign(`${p.adminId}.${p.exp}.${p.csrf}:${fingerprint(row.passwordHash)}`) : "";
    if (!row || !safeEq(p.sig, expected)) return res.status(401).json({ error: "Not signed in" });
    const s = { adminId: p.adminId, csrf: p.csrf };
    if (req.method !== "GET") {
      const sent = req.get("x-csrf-token") ?? "";
      if (!safeEq(sent, s.csrf)) return res.status(403).json({ error: "Forbidden" });
    }
    res.locals.admin = s;
    next();
  };

  r.post("/logout", requireAdmin, (_req, res) => {
    res.clearCookie("session", { path: "/api/admin" });
    res.json({ ok: true });
  });
  r.get("/me", requireAdmin, (_req, res) => res.json({ ok: true, csrf: (res.locals.admin as { csrf: string }).csrf }));

  r.get("/suggestions", requireAdmin, async (_req, res) => {
    const rows = await db!.select().from(suggestions).orderBy(desc(suggestions.createdAt)).limit(200);
    res.json(rows.map(({ ipHash: _ip, ...rest }) => rest));
  });
  r.patch("/suggestions/:id", requireAdmin, async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    const body = StatusSchema.safeParse(req.body);
    if (!id.success || !body.success) return res.status(400).json({ error: "Invalid request" });
    await db!.update(suggestions).set({ status: body.data.status }).where(eq(suggestions.id, id.data));
    res.json({ ok: true });
  });

  r.get("/review-queue", requireAdmin, async (_req, res) => {
    const rows = await db!
      .select({ id: persons.id, path: persons.path, fullName: persons.fullName, gender: persons.gender, reviewNote: persons.reviewNote })
      .from(persons)
      .where(eq(persons.needsReview, true));
    res.json(rows);
  });
  r.patch("/persons/:id", requireAdmin, async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    const body = PersonPatchSchema.safeParse(req.body);
    if (!id.success || !body.success || Object.keys(body.data).length === 0) {
      return res.status(400).json({ error: "Invalid request" });
    }
    const set: Record<string, unknown> = { ...body.data, updatedAt: new Date() };
    if (body.data.gender) set.genderSource = "stated";
    await db!.update(persons).set(set).where(eq(persons.id, id.data));
    res.json({ ok: true });
  });

  return r;
}
