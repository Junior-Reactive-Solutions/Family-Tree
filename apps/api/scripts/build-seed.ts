/**
 * Builds data/family.seed.json (persons, unions, parentage) from the family's draw.io export.
 *
 * Usage: tsx scripts/build-seed.ts [path-to-drawio.html]
 * Default input: data/source/family-tree.drawio.html (gitignored, like all family data).
 *
 * How the diagram is read (the "Full family tree" page):
 *  - Each rounded box is one person. Lines run from parent box to child box.
 *  - First line: the person, with an optional title and "(late)".
 *  - "m. Name" lines: spouses. "m. A; earlier m. B (late)" means B was the first spouse;
 *    children belong to the most recent spouse.
 *  - Notes: "Born 23 April 2024", "Twin", "Also known as X", anything else becomes a review note.
 *  - Children are ordered top to bottom, which is the confirmed birth order.
 * Each person's address (path) is their position: 3.8.2 = branch 3, 8th child, 2nd child.
 * Database ids are kept stable by matching against the previous seed (see "keep identities stable").
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import type { Parentage, Person, Union } from "@family-tree/shared";

export type SeedPerson = Person & { birthDate: string | null };
export interface Seed {
  persons: SeedPerson[];
  unions: Union[];
  parentage: Parentage[];
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--previous");
const input = positional[0] ?? resolve(root, "data/source/family-tree.drawio.html");

const TITLES = ["Dr.", "Eng.", "Prof.", "Counsel", "Rev.", "Sr."];

// Alternate spellings so search still finds people (keyed by path).
const ALIASES: Record<string, string[]> = {
  "2": ["Adyeri"],
  "2.3": ["Teddy", "Dr. Teddy Namuli Kagoro"],
  "2.5": ["Patrick Kagoro"],
  "2.5.1": ["Kyakahaire"],
  "1.2": ["Beatrice Ayebre"],
  "1.2.1": ["Caroline Atuhaire"],
  "1.2.3": ["Clare Atuhaire"],
  "1.1.1": ["Immaculate Nuwagabe"],
  "2.1.2": ["Ivan Kagoro"],
  "2.1.3": ["Nigel Kagoro"],
  "2.1.3.1": ["Briel Akiki Kagoro", "Briel"],
  "7.2": ["Kagurusi"],
  "7.1": ["Kamundtu"],
  "7.2.3": ["Kabaku"],
  "6": ["Kemitoooma"],
  "8": ["Bakatonda"],
  "3.1": ["Beatrice Nabukalu", "Bea"],
  "3.1.1.1": ["George William Kalenzi Smith", "George William", "G.W.", "G.W. Kalenzi Smith", "Kalenzi Smith"],
  "3.2.1.1": ["Theresa Sanyu"],
  "3.6.1": ["Jeffrey Kigambo Magara"],
  "3.7.1.2": ["Cittorio", "Metcaffe"],
  "4.1.1": ["Deogratius Byaruhanga"],
  "9.5": ["Swithing"],
  "2.4.1.2": ["Nadrube"],
  "6.2.2": ["Tumwine"],
};
const SPOUSE_ALIASES: Record<string, string[]> = { "2.4.1": ["Maria Obua"] };

const NOTE = {
  agnes: "Agnes Tumuhwire vs Agnes Tumwine is undecided. Kept Tumuhwire; Tumwine stored as alias.",
  spouse: "Spouse recorded with a single or partial name; full name to be confirmed.",
  gender: "Gender inferred from first name; please confirm.",
};
const FLAGGED: Record<string, string> = { "6.2.2": NOTE.agnes };
// Genders the family stated explicitly (everyone else is inferred and queued for review).
const STATED_GENDER: Record<string, "M" | "F"> = { "3.7": "F" };

// Owner decisions that take precedence over the diagram. Matched by path and name, so a moved or
// renamed entry is reported instead of silently overriding the wrong person.
const OWNER_CONFIRMED: { path: string; name: string; isDeceased: boolean; note: string }[] = [
  { path: "3.1", name: "Bea Nabukalu Twesigye", isDeceased: false, note: "Owner confirmed living on 2026-10-08 (v5 diagram marks her late)." },
];

const FEMALE = new Set(
  `Martha Beatrice Bea Margarette Maria Maureen Mauda Immaculate Sharon Josephine Elizabeth Ivy Caroline Catherine Elsa Clare Christabell Gillian Grace Magdalena Merina Loma Charlotte Imelda Gloria Francesca Nicolette Mary Pauline Theresa Evelyn Alisha Arrielle Sanyu Abigail Christine Madrine Irene Sheila Doreen Lynette Lorita Hildagarde Patricia Joy Peace Zion Alexia Isabella Salome Veronica Semara Yemi Verity Florence Audriana Vincent Lucy Liza Lyn Laureen Rose Lenah Michelle Makyla Sylvia Gianna Aviella Amaris Every Suzan Rosa Joana Hannah Eugenia Anita Agnes Anna Jackline Anne Brenda Mercy Sonia Loida Felista Cecilia Edith Harriet Cynthis Teodozia Komuhangi Sylivia Ruth Debra Rhola Angelina Albertina Regina Wendy Michell Roshmin Nikita Patience Jacquerine Hanna Nora Hellen Kezerle Petrina Paroma Macrina Channel Thea Kiara Stella Phiona Theopista Speciosa Baby Kyomugisha Jolly Elisha Caaroline Kobusingye Kiconco Ikondere Nethan Maxine Kemitooma Linda Berna Aya Brielle Dorcas Karen Christabel Lynn Lauren`.split(/\s+/),
);
const MALE = new Set(
  `John Ivan Israel Isaih Paul Godfrey Godwin Wilson Frank Edward Agaba Nigel Briel Robert Michael Joseph Francis Maxmillan Stefan Joshua Martin Gilbert Collins Jeremiah Archangel Mario Melvin Patrick Solomon Norbert Liam Julian Ryan Moses Emmanuel Shawn George Sam Xavier Gabriel Deus Hilary Conrad Mathew Mark Anthony Felix William Aedan Ben Jonathan Benjamin Kevin Micah Andrew Rogers Trevor Tarvis Josiah Henry Larry Josheb Silasi Cedrick Deogratius Deogratus Petero Ronald Innocent Christian Banyenzaki Antiel Yakobo Steven Denis Justus Priton David Bosco Deo Gerald Roderick Allan Brian Brandon Raymond Albert Trevaar Jason Herbert Nolan Jordan Omukama Swithin Timothy Aaron Alexander Eugene Aeden Karl Bonny Jeffrey Jeffery Roy Warren Jonah Vittorio Vincenzo Kigambo Thomas Calvin`.split(/\s+/),
);

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const uuid = (seed: string) => {
  const h = createHash("sha1").update(`family-tree:${seed}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// ---------- draw.io extraction ----------

interface Cell {
  id: string;
  vertex: boolean;
  edge: boolean;
  source?: string;
  target?: string;
  value: string;
  style: string;
  x: number;
  y: number;
}

const unescapeXml = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&#xa;/gi, "\n").replace(/&amp;/g, "&");

function htmlToText(s: string) {
  let text = unescapeXml(unescapeXml(s)).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(div|p)>/gi, "\n");
  // Strip tags until none remain (nested fragments like "<scr<b>ipt" can re-form a tag), then drop stray brackets.
  let previous: string;
  do {
    previous = text;
    text = text.replace(/<[^<>]*>/g, "");
  } while (text !== previous);
  return text
    .replace(/[<>]/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function readDiagram(file: string): Cell[] {
  const html = readFileSync(file, "utf8");
  const attr = html.match(/data-mxgraph="([^"]*)"/)?.[1];
  if (!attr) throw new Error("No draw.io diagram found in " + file);
  const xml: string = JSON.parse(unescapeXml(attr)).xml;
  const pages = [...xml.matchAll(/<diagram([^>]*)>([\s\S]*?)<\/diagram>/g)].map((d) => {
    let body = d[2]!.trim();
    if (!body.startsWith("<")) body = decodeURIComponent(inflateRawSync(Buffer.from(body, "base64")).toString("utf8"));
    return { name: d[1]!.match(/name="([^"]*)"/)?.[1] ?? "", body };
  });
  const page = pages.find((p) => /full/i.test(p.name)) ?? pages[0];
  if (!page) throw new Error("Diagram has no pages");
  return [...page.body.matchAll(/<mxCell\b([^>]*?)(\/>|>([\s\S]*?)<\/mxCell>)/g)].map((m) => {
    const a: Record<string, string> = {};
    for (const x of m[1]!.matchAll(/(\w+)="([^"]*)"/g)) a[x[1]!] = x[2]!;
    const g: Record<string, number> = {};
    const geo = (m[3] ?? "").match(/<mxGeometry\b([^>]*)/);
    if (geo) for (const x of geo[1]!.matchAll(/(\w+)="([^"]*)"/g)) g[x[1]!] = Number(x[2]);
    return {
      id: a.id ?? "",
      vertex: a.vertex === "1",
      edge: a.edge === "1",
      source: a.source,
      target: a.target,
      value: htmlToText(a.value ?? ""),
      style: a.style ?? "",
      x: g.x ?? 0,
      y: g.y ?? 0,
    };
  });
}

// ---------- label parsing ----------

interface Parsed {
  name: string;
  title: string | null;
  late: boolean;
}
function parseName(raw: string): Parsed {
  let s = raw.trim();
  const late = /\(late\)/i.test(s);
  s = s.replace(/\(late\)/gi, "").replace(/\s+/g, " ").trim();
  let title: string | null = null;
  for (const t of TITLES) {
    if (s.startsWith(t + " ")) {
      title = t;
      s = s.slice(t.length + 1);
      break;
    }
  }
  return { name: s, title, late };
}

interface Label {
  subject: Parsed;
  spouses: string[]; // in marriage order (earliest first)
  birthDate: string | null;
  twin: boolean;
  aliases: string[];
  notes: string[];
}
function parseLabel(text: string): Label {
  const [first = "", ...rest] = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: Label = { subject: parseName(first), spouses: [], birthDate: null, twin: false, aliases: [], notes: [] };
  for (const line of rest) {
    let m: RegExpMatchArray | null;
    if (/^m\.\s/.test(line)) {
      // "m. Current; earlier m. First" -> [First, Current]
      const parts = line.replace(/^m\.\s*/, "").split(/;\s*earlier\s+m\.\s*/i).map((s) => s.trim()).filter(Boolean);
      out.spouses.push(...parts.reverse());
    } else if ((m = line.match(/^born\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i))) {
      const month = MONTHS.indexOf(m[2]!.toLowerCase());
      if (month < 0) out.notes.push(line);
      else out.birthDate = `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    } else if (/^twin$/i.test(line)) {
      out.twin = true;
    } else if ((m = line.match(/^also known as\s+(.+)$/i))) {
      out.aliases.push(m[1]!.trim());
    } else {
      out.notes.push(line);
    }
  }
  return out;
}

// ---------- build ----------

const persons: SeedPerson[] = [];
const unions: Union[] = [];
const parentage: Parentage[] = [];
const byPath = new Map<string, SeedPerson>();
const familyUnion = new Map<string, Union>(); // the union a person's children belong to

function guessGender(name: string): "M" | "F" | "U" {
  const first = name.split(/\s+/)[0] ?? "";
  return FEMALE.has(first) ? "F" : MALE.has(first) ? "M" : "U";
}

function addNote(p: SeedPerson, note: string) {
  p.needsReview = true;
  p.reviewNote = [p.reviewNote, note].filter(Boolean).join(" ");
}

function addPerson(p: Parsed, path: string | null, opts: { blood: boolean; order: number | null; idSeed: string; gender?: "M" | "F" }) {
  const gender = opts.gender ?? guessGender(p.name);
  const person: SeedPerson = {
    id: uuid(opts.idSeed),
    path,
    fullName: p.name,
    title: p.title,
    aliases: [],
    isDeceased: p.late,
    isBloodMember: opts.blood,
    gender,
    genderSource: opts.gender ? "stated" : "inferred",
    twinGroup: null,
    birthOrder: opts.order,
    needsReview: false,
    reviewNote: null,
    birthDate: null,
  };
  if (!opts.gender) addNote(person, NOTE.gender);
  persons.push(person);
  if (path) byPath.set(path, person);
  return person;
}

function addUnion(a: SeedPerson, b: SeedPerson | null, seq: number) {
  const u: Union = {
    id: uuid(`union:${a.id}:${seq}`),
    partnerA: a.id,
    partnerB: b?.id ?? null,
    sequence: seq,
    status: !b ? "unknown" : a.isDeceased || b.isDeceased ? "widowed" : "married",
  };
  unions.push(u);
  return u;
}

function addSpouses(of: SeedPerson, spouses: string[], key: string) {
  spouses.forEach((raw, i) => {
    const seq = i + 1;
    if (/name to be confirmed/i.test(raw)) {
      familyUnion.set(key, addUnion(of, null, seq));
      addNote(of, "Spouse's name to be confirmed.");
      return;
    }
    const sp = addPerson(parseName(raw), null, { blood: false, order: null, idSeed: `spouse:${key}:${seq}` });
    if (sp.gender === "U") sp.gender = of.gender === "M" ? "F" : of.gender === "F" ? "M" : "U";
    if (!/\s/.test(sp.fullName)) addNote(sp, NOTE.spouse);
    familyUnion.set(key, addUnion(of, sp, seq));
  });
}

const cells = readDiagram(input);
const boxes = new Map(cells.filter((c) => c.vertex && /rounded=1/.test(c.style) && /arcSize=12/.test(c.style)).map((c) => [c.id, c]));
const kids = new Map<string, Cell[]>();
const hasParent = new Set<string>();
for (const e of cells.filter((c) => c.edge && c.source && c.target && boxes.has(c.source) && boxes.has(c.target))) {
  const list = kids.get(e.source!) ?? [];
  list.push(boxes.get(e.target!)!);
  kids.set(e.source!, list);
  hasParent.add(e.target!);
}
const roots = [...boxes.values()].filter((b) => !hasParent.has(b.id));
if (roots.length !== 1) throw new Error(`Expected one root box, found ${roots.length}`);

// Root couple
const rootLabel = parseLabel(roots[0]!.value);
const rootPerson = addPerson(rootLabel.subject, "0", { blood: true, order: null, idSeed: "root:a", gender: "M" });
const rootSpouse = addPerson(parseName(rootLabel.spouses[0] ?? ""), null, { blood: false, order: null, idSeed: "root:m", gender: "F" });
familyUnion.set("0", addUnion(rootPerson, rootSpouse, 1));

const birthDates = new Map<string, string>();
const appliedOverrides = new Set<string>();
function walk(box: Cell, parentPath: string) {
  const children = (kids.get(box.id) ?? []).sort((a, b) => a.y - b.y || a.x - b.x);
  let twinRun: SeedPerson[] = [];
  const closeTwins = () => {
    if (twinRun.length > 1) {
      const g = twinRun.map((t) => t.path).join("+");
      twinRun.forEach((t) => (t.twinGroup = g));
    }
    twinRun = [];
  };
  children.forEach((child, i) => {
    const path = parentPath === "0" ? String(i + 1) : `${parentPath}.${i + 1}`;
    const label = parseLabel(child.value);
    const person = addPerson(label.subject, path, { blood: true, order: i + 1, idSeed: `path:${path}`, gender: STATED_GENDER[path] });
    const confirmed = OWNER_CONFIRMED.find((c) => c.path === path);
    if (confirmed) {
      if (confirmed.name === person.fullName) {
        if (person.isDeceased !== confirmed.isDeceased) console.log(`owner override at ${path}: ${confirmed.note}`);
        person.isDeceased = confirmed.isDeceased;
        appliedOverrides.add(path);
      } else {
        console.warn(`WARNING owner override for ${path} expects "${confirmed.name}" but the diagram has "${person.fullName}"; not applied`);
      }
    }
    person.aliases.push(...label.aliases);
    for (const n of label.notes) addNote(person, n);
    if (label.birthDate) {
      person.birthDate = label.birthDate;
      birthDates.set(path, label.birthDate);
    }
    if (label.twin) twinRun.push(person);
    else closeTwins();
    addSpouses(person, label.spouses, path);
    const fu = familyUnion.get(parentPath);
    parentage.push(fu ? { childId: person.id, unionId: fu.id, parentId: null } : { childId: person.id, unionId: null, parentId: byPath.get(parentPath)!.id });
    walk(child, path);
  });
  closeTwins();
}
walk(roots[0]!, "0");

for (const [p, a] of Object.entries(ALIASES)) byPath.get(p)?.aliases.push(...a);
for (const [p, a] of Object.entries(SPOUSE_ALIASES)) {
  const u = familyUnion.get(p);
  persons.find((x) => x.id === u?.partnerB)?.aliases.push(...a);
}
for (const x of persons) {
  if (x.fullName.includes("Mwongyera")) x.aliases.push(x.fullName.replace("Mwongyera", "Mwongera"), x.fullName.replace("Mwongyera", "Mwondgyera"));
  x.aliases = [...new Set(x.aliases)].filter((a) => a !== x.fullName);
}
for (const [p, note] of Object.entries(FLAGGED)) {
  const person = byPath.get(p);
  if (person) addNote(person, note);
}

// ---------- keep identities stable ----------
// Ids derive from positions, so reordering siblings would hand one person's record to another.
// Match against the previous seed instead: within each family, by name or alias first, then by position
// (a rename in place). Spouses keep their record per partner and marriage number. Genuinely new people get new ids.
const previousFile = argValue("--previous") ?? resolve(root, "data/family.seed.json");
let previous: Seed | null = null;
try {
  previous = JSON.parse(readFileSync(previousFile, "utf8")) as Seed;
} catch {
  /* first build: nothing to match against */
}
const renamed: string[] = [];
if (previous) {
  const prevById = new Map(previous.persons.map((p) => [p.id, p]));
  const childrenOf = (s: Seed, id: string) => {
    const unionIds = new Set(s.unions.filter((u) => u.partnerA === id).map((u) => u.id));
    return s.parentage
      .filter((x) => (x.unionId && unionIds.has(x.unionId)) || x.parentId === id)
      .map((x) => s.persons.find((p) => p.id === x.childId)!)
      .sort((a, b) => (a.birthOrder ?? 0) - (b.birthOrder ?? 0));
  };
  const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const names = (p: SeedPerson) => new Set([p.fullName, ...p.aliases].map(norm));
  const current: Seed = { persons, unions, parentage };
  const finalId = new Map<string, string>(); // build id -> kept id

  const matchFamily = (newId: string, oldId: string | null) => {
    const kept = finalId.get(newId)!;
    const newKids = childrenOf(current, newId);
    const oldKids = oldId ? childrenOf(previous!, oldId) : [];
    const pairs = new Map<string, SeedPerson>();
    const used = new Set<string>();
    for (const k of newKids) {
      const kn = names(k);
      const hit = oldKids.find((o) => !used.has(o.id) && [...names(o)].some((n) => kn.has(n)));
      if (hit) {
        pairs.set(k.id, hit);
        used.add(hit.id);
      }
    }
    newKids.forEach((k) => {
      if (pairs.has(k.id)) return;
      const samePlace = oldKids.find((o) => !used.has(o.id) && o.birthOrder === k.birthOrder);
      if (samePlace) {
        pairs.set(k.id, samePlace);
        used.add(samePlace.id);
      }
    });
    for (const k of newKids) {
      const o = pairs.get(k.id);
      finalId.set(k.id, o ? o.id : uuid(`person:${kept}:${norm(k.fullName)}`));
      if (o && norm(o.fullName) !== norm(k.fullName)) {
        k.aliases.push(o.fullName);
        renamed.push(`${o.fullName} -> ${k.fullName}`);
      }
      matchFamily(k.id, o?.id ?? null);
    }
    // Spouses: same partner, same marriage number keeps the record (covers spelling fixes).
    for (const u of current.unions.filter((x) => x.partnerA === newId)) {
      if (!u.partnerB) continue;
      const oldU = oldId ? previous!.unions.find((x) => x.partnerA === oldId && x.sequence === u.sequence) : undefined;
      const oldSpouse = oldU?.partnerB ? prevById.get(oldU.partnerB) : undefined;
      finalId.set(u.partnerB, oldSpouse ? oldSpouse.id : uuid(`spouse:${kept}:${u.sequence}`));
      const sp = persons.find((p) => p.id === u.partnerB)!;
      if (oldSpouse && norm(oldSpouse.fullName) !== norm(sp.fullName)) {
        sp.aliases.push(oldSpouse.fullName);
        renamed.push(`${oldSpouse.fullName} -> ${sp.fullName} (spouse)`);
      }
    }
  };
  const rootNew = persons.find((p) => p.path === "0")!;
  const rootOld = previous.persons.find((p) => p.path === "0");
  finalId.set(rootNew.id, rootOld?.id ?? rootNew.id);
  matchFamily(rootNew.id, rootOld?.id ?? null);
  for (const p of persons) if (!finalId.has(p.id)) finalId.set(p.id, p.id); // e.g. the root's spouse

  const remap = (id: string) => finalId.get(id) ?? id;
  for (const p of persons) {
    p.id = remap(p.id);
    p.aliases = [...new Set(p.aliases)].filter((a) => a !== p.fullName);
  }
  const unionIds = new Map<string, string>();
  for (const u of unions) {
    const before = u.id;
    u.partnerA = remap(u.partnerA);
    u.partnerB = u.partnerB ? remap(u.partnerB) : null;
    u.id = uuid(`union:${u.partnerA}:${u.sequence}`);
    unionIds.set(before, u.id);
  }
  for (const x of parentage) {
    x.childId = remap(x.childId);
    x.parentId = x.parentId ? remap(x.parentId) : null;
    x.unionId = x.unionId ? unionIds.get(x.unionId)! : null;
  }
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const seed: Seed = { persons, unions, parentage };
mkdirSync(resolve(root, "data"), { recursive: true });
writeFileSync(resolve(root, "data/family.seed.json"), JSON.stringify(seed, null, 2));
// Development snapshot for the web app: never includes birth dates.
mkdirSync(resolve(root, "apps/web/public"), { recursive: true });
writeFileSync(
  resolve(root, "apps/web/public/tree.snapshot.json"),
  JSON.stringify({ ...seed, persons: persons.map(({ birthDate: _b, ...p }) => p) }),
);

const counts: Record<string, number> = {};
for (const p of persons) if (p.path) counts[`G${p.path === "0" ? 0 : p.path.split(".").length}`] = (counts[`G${p.path === "0" ? 0 : p.path.split(".").length}`] ?? 0) + 1;
console.log(`source: ${input}`);
console.log(`persons=${persons.length} unions=${unions.length} parentage=${parentage.length} birthDates=${birthDates.size}`);
console.log("blood by generation:", counts, "needs_review:", persons.filter((p) => p.needsReview).length);
