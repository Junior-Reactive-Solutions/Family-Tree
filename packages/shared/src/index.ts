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

const clean = (s: string) =>
  s.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").trim();

export const SuggestionInputSchema = z.object({
  category: z.enum(SUGGESTION_CATEGORIES),
  personId: z.string().nullable().optional(),
  message: z.string().transform(clean).pipe(z.string().min(5).max(1000)),
  submitterName: z.string().transform(clean).pipe(z.string().max(80)).optional(),
  submitterContact: z.string().transform(clean).pipe(z.string().max(120)).optional(),
  website: z.string().max(0).optional(), // honeypot
});
export type SuggestionInput = z.infer<typeof SuggestionInputSchema>;
