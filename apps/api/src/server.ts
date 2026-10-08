import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { SuggestionInputSchema, TreeSchema, type Tree } from "@family-tree/shared";
import { parentage, persons, suggestions, unions } from "./db/schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 9902);
const origins = (process.env.CORS_ORIGINS ?? "http://localhost:9901").split(",");
const db = process.env.DATABASE_URL ? drizzle(neon(process.env.DATABASE_URL)) : null;
const ipSalt = process.env.IP_HASH_SALT ?? "dev-only-salt";

function loadSeed(): Tree {
  return TreeSchema.parse(JSON.parse(readFileSync(resolve(here, "../../../data/family.seed.json"), "utf8")));
}

let cache: { at: number; tree: Tree } | null = null;
async function getTree(): Promise<Tree> {
  if (cache && Date.now() - cache.at < 60_000) return cache.tree;
  let tree: Tree;
  if (db) {
    const [p, u, pg] = await Promise.all([db.select().from(persons), db.select().from(unions), db.select().from(parentage)]);
    tree = TreeSchema.parse({
      persons: p.map((x) => ({
        id: x.id, path: x.path, fullName: x.fullName, title: x.title, aliases: x.aliases,
        isDeceased: x.isDeceased, isBloodMember: x.isBloodMember, gender: x.gender,
        genderSource: x.genderSource ?? "inferred", twinGroup: x.twinGroup, birthOrder: x.birthOrder,
        needsReview: x.needsReview, reviewNote: x.reviewNote,
      })),
      unions: u,
      parentage: pg,
    });
  } else tree = loadSeed();
  cache = { at: Date.now(), tree };
  return tree;
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: "10kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ ok: true, db: !!db }));
app.get("/api/tree", async (_req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=300");
    res.json(await getTree());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const suggestionLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });
app.post("/api/suggestions", suggestionLimiter, async (req, res) => {
  const parsed = SuggestionInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid submission" });
  const d = parsed.data;
  if (d.website) return res.status(202).json({ ok: true }); // honeypot
  // TODO(phase 3): Turnstile verification.
  try {
    if (db) {
      await db.insert(suggestions).values({
        category: d.category,
        personId: d.personId ?? null,
        message: d.message,
        submitterName: d.submitterName || null,
        submitterContact: d.submitterContact || null,
        ipHash: createHash("sha256").update(ipSalt + (req.ip ?? "")).digest("hex"),
      });
    }
    return res.status(202).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.listen(port, () => console.log(`api listening on http://localhost:${port} (db: ${db ? "neon" : "seed file"})`));
