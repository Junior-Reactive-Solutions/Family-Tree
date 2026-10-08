/** Loads data/family.seed.json into Postgres (Neon). Idempotent: upserts by id. Usage: DATABASE_URL=... pnpm seed:db */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { TreeSchema } from "@family-tree/shared";
import { parentage, persons, unions } from "../src/db/schema.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const here = dirname(fileURLToPath(import.meta.url));
const tree = TreeSchema.parse(JSON.parse(readFileSync(resolve(here, "../../../data/family.seed.json"), "utf8")));
const db = drizzle(neon(url));

const chunks = <T>(a: T[], n = 100) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

for (const c of chunks(tree.persons)) {
  await db
    .insert(persons)
    .values(c.map((p) => ({ ...p, genderSource: p.genderSource })))
    .onConflictDoUpdate({
      target: persons.id,
      set: {
        fullName: sql`excluded.full_name`, title: sql`excluded.title`, aliases: sql`excluded.aliases`,
        isDeceased: sql`excluded.is_deceased`, gender: sql`excluded.gender`, twinGroup: sql`excluded.twin_group`,
        birthOrder: sql`excluded.birth_order`, needsReview: sql`excluded.needs_review`, reviewNote: sql`excluded.review_note`,
        updatedAt: sql`now()`,
      },
    });
}
for (const c of chunks(tree.unions)) await db.insert(unions).values(c).onConflictDoNothing();
await db.delete(parentage);
for (const c of chunks(tree.parentage)) await db.insert(parentage).values(c);
console.log(`seeded persons=${tree.persons.length} unions=${tree.unions.length} parentage=${tree.parentage.length}`);
