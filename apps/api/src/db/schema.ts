import { boolean, check, date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey(),
    path: text("path").unique(),
    fullName: text("full_name").notNull(),
    title: text("title"),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    isDeceased: boolean("is_deceased").notNull().default(false),
    isBloodMember: boolean("is_blood_member").notNull(),
    gender: text("gender").notNull().default("U"),
    genderSource: text("gender_source"),
    birthYear: integer("birth_year"),
    // Stored for administrators only; never sent to the public tree endpoint.
    birthDate: date("birth_date"),
    deathYear: integer("death_year"),
    twinGroup: text("twin_group"),
    birthOrder: integer("birth_order"),
    photoPublicId: text("photo_public_id"),
    photoAlt: text("photo_alt"),
    bio: text("bio"),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("gender_chk", sql`${t.gender} in ('M','F','U')`),
    check("gender_source_chk", sql`${t.genderSource} in ('stated','inferred')`),
  ],
);

export const unions = pgTable("unions", {
  id: uuid("id").primaryKey(),
  partnerA: uuid("partner_a").notNull().references(() => persons.id),
  partnerB: uuid("partner_b").references(() => persons.id),
  sequence: integer("sequence").notNull().default(1),
  status: text("status").notNull().default("unknown"),
});

export const parentage = pgTable("parentage", {
  childId: uuid("child_id").notNull().references(() => persons.id),
  unionId: uuid("union_id").references(() => unions.id),
  parentId: uuid("parent_id").references(() => persons.id),
});

export const suggestions = pgTable("suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(),
  personId: uuid("person_id").references(() => persons.id),
  message: text("message").notNull(),
  submitterName: text("submitter_name"),
  submitterContact: text("submitter_contact"),
  status: text("status").notNull().default("new"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
