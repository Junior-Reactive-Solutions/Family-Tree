import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { SuggestionInputSchema, TreeSchema } from "@family-tree/shared";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 9902);
const origins = (process.env.CORS_ORIGINS ?? "http://localhost:9901").split(",");

// Until Neon is wired up (phase 2/3), serve the generated seed.
const tree = TreeSchema.parse(
  JSON.parse(readFileSync(resolve(here, "../../../data/family.seed.json"), "utf8")),
);

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: "10kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/tree", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json(tree);
});

const suggestionLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });
app.post("/api/suggestions", suggestionLimiter, (req, res) => {
  const parsed = SuggestionInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid submission" });
  if (parsed.data.website) return res.status(202).json({ ok: true }); // honeypot
  // TODO(phase 3): Turnstile verification + persist to Neon.
  return res.status(202).json({ ok: true });
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.listen(port, () => console.log(`api listening on http://localhost:${port}`));
