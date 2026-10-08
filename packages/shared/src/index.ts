import { z } from "zod";

export const GenderSchema = z.enum(["M", "F", "U"]);

export const PersonSchema = z.object({
  id: z.string(),
  path: z.string().nullable(),
  fullName: z.string().min(1).max(120),
  title: z.string().nullable(),
  aliases: z.array(z.string()),
  isDeceased: z.boolean(),
  isBloodMember: z.boolean(),
  gender: GenderSchema,
  genderSource: z.enum(["stated", "inferred"]),
  twinGroup: z.string().nullable(),
  birthOrder: z.number().int().nullable(),
  needsReview: z.boolean(),
  reviewNote: z.string().nullable(),
});
export type Person = z.infer<typeof PersonSchema>;

export const UnionSchema = z.object({
  id: z.string(),
  partnerA: z.string(),
  partnerB: z.string().nullable(),
  sequence: z.number().int(),
  status: z.enum(["married", "widowed", "unknown"]),
});
export type Union = z.infer<typeof UnionSchema>;

export const ParentageSchema = z.object({
  childId: z.string(),
  unionId: z.string().nullable(),
  parentId: z.string().nullable(),
});
export type Parentage = z.infer<typeof ParentageSchema>;

export const TreeSchema = z.object({
  persons: z.array(PersonSchema),
  unions: z.array(UnionSchema),
  parentage: z.array(ParentageSchema),
});
export type Tree = z.infer<typeof TreeSchema>;

export const SUGGESTION_CATEGORIES = [
  "add_person",
  "correct_name",
  "correct_status",
  "add_photo",
  "relationship",
  "other",
] as const;

// Zero-width, bidi-override and other invisible formatting characters used to disguise text.
const INVISIBLE = /[­؜᠎​-‏‪-‮⁠-⁤⁦-⁯﻿]/g;

/** Single-line field: NFKC, no control or invisible characters, collapsed whitespace. */
export const cleanLine = (s: string) =>
  s.normalize("NFKC").replace(INVISIBLE, "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();

/** Multi-line field: as above but keeps line breaks (at most one blank line in a row). */
export const cleanText = (s: string) =>
  s
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const PHONE = /^\+?[0-9][0-9 ()-]{5,22}$/;

export const SuggestionInputSchema = z.object({
  category: z.enum(SUGGESTION_CATEGORIES),
  personId: z.string().uuid().nullable().optional(),
  message: z.string().max(4000).transform(cleanText).pipe(z.string().min(5).max(1000)),
  submitterName: z.string().max(400).transform(cleanLine).pipe(z.string().max(80)).optional(),
  submitterContact: z
    .string()
    .max(400)
    .transform(cleanLine)
    .pipe(
      z
        .string()
        .max(120)
        .refine((v) => v === "" || EMAIL.test(v) || PHONE.test(v), "Enter an email address or phone number"),
    )
    .optional(),
  // Honeypot: real people never see this field. Accepted but checked by the server, so bots get no signal.
  website: z.string().max(200).optional(),
});
export type SuggestionInput = z.infer<typeof SuggestionInputSchema>;
