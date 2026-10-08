/**
 * Syncs data/family.seed.json into Postgres (Neon) so the database matches the seed exactly:
 * upserts people and couples, rebuilds parent links, then removes people and couples no longer in the seed.
 * Suggestions about a removed person are kept, with their person link cleared.
 *
 * Usage: pnpm seed:db            (reads DATABASE_URL from apps/api/.env)
 *        pnpm seed:db --dry-run  (shows what would change, writes nothing)
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { inArray, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { Seed } from "./build-seed.js";
import { parentage, persons, suggestions, unions } from "../src/db/schema.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const dryRun = process.argv.includes("--dry-run");
const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(resolve(here, "../../../data/family.seed.json"), "utf8")) as Seed;
const db = drizzle(neon(url));

const chunks = <T>(a: T[], n = 100) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const personIds = seed.persons.map((p) => p.id);
const unionIds = seed.unions.map((u) => u.id);

const existingPeople = await db.select({ id: persons.id, fullName: persons.fullName }).from(persons);
const existingUnions = await db.select({ id: unions.id }).from(unions);
const keep = new Set(personIds);
const goingPeople = existingPeople.filter((p) => !keep.has(p.id));
const newPeople = seed.persons.filter((p) => !existingPeople.some((e) => e.id === p.id));
const goingUnions = existingUnions.filter((u) => !unionIds.includes(u.id));

console.log(`people: ${existingPeople.length} -> ${seed.persons.length} (add ${newPeople.length}, remove ${goingPeople.length})`);
for (const p of newPeople) console.log(`  + ${p.path ?? "spouse"} ${p.fullName}`);
for (const p of goingPeople) console.log(`  - ${p.fullName}`);
console.log(`couples: ${existingUnions.length} -> ${seed.unions.length} (remove ${goingUnions.length}); parent links: ${seed.parentage.length}`);
if (dryRun) {
  console.log("dry run: nothing written");
  process.exit(0);
}

// Addresses are unique, so free the ones that move (siblings reordered) before writing new ones.
const existingPaths = await db.select({ id: persons.id, path: persons.path }).from(persons);
const moving = existingPaths.filter((e) => e.path && seed.persons.find((p) => p.id === e.id)?.path !== e.path).map((e) => e.id);
if (moving.length) await db.update(persons).set({ path: null }).where(inArray(persons.id, moving));

for (const c of chunks(seed.persons)) {
  await db
    .insert(persons)
    .values(c.map((p) => ({ ...p, birthYear: p.birthDate ? Number(p.birthDate.slice(0, 4)) : null })))
    .onConflictDoUpdate({
      target: persons.id,
      set: {
        path: sql`excluded.path`,
        fullName: sql`excluded.full_name`,
        title: sql`excluded.title`,
        aliases: sql`excluded.aliases`,
        isDeceased: sql`excluded.is_deceased`,
        isBloodMember: sql`excluded.is_blood_member`,
        gender: sql`excluded.gender`,
        genderSource: sql`excluded.gender_source`,
        birthYear: sql`excluded.birth_year`,
        birthDate: sql`excluded.birth_date`,
        twinGroup: sql`excluded.twin_group`,
        birthOrder: sql`excluded.birth_order`,
        needsReview: sql`excluded.needs_review`,
        reviewNote: sql`excluded.review_note`,
        updatedAt: sql`now()`,
      },
    });
}
for (const c of chunks(seed.unions)) {
  await db
    .insert(unions)
    .values(c)
    .onConflictDoUpdate({
      target: unions.id,
      set: { partnerB: sql`excluded.partner_b`, sequence: sql`excluded.sequence`, status: sql`excluded.status` },
    });
}
await db.delete(parentage);
for (const c of chunks(seed.parentage)) await db.insert(parentage).values(c);
if (goingUnions.length) await db.delete(unions).where(notInArray(unions.id, unionIds));
if (goingPeople.length) {
  const gone = goingPeople.map((p) => p.id);
  await db.update(suggestions).set({ personId: null }).where(inArray(suggestions.personId, gone));
  await db.delete(persons).where(inArray(persons.id, gone));
}
console.log(`synced persons=${seed.persons.length} unions=${seed.unions.length} parentage=${seed.parentage.length}`);
