/**
 * Parses Section 6 of the build plan into data/family.seed.json
 * (persons, unions, parentage) and a web snapshot.
 * Usage: tsx scripts/build-seed.ts [path-to-plan.md]
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Parentage, Person, Tree, Union } from "@family-tree/shared";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const planPath = process.argv[2] ?? resolve(root, "bintukwanga-family-tree-plan.md");

const TITLES = ["Dr.", "Eng.", "Prof.", "Counsel", "Rev.", "Sr."];

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
  "7.2": ["Kagurusi"],
  "7.1": ["Kamundtu"],
  "7.2.3": ["Kabaku"],
  "6": ["Kemitoooma"],
  "8": ["Bakatonda"],
  "3.7.1.2": ["Cittorio", "Metcaffe"],
  "9.5": ["Swithing"],
  "2.4.1.2": ["Nadrube"],
  "3.7": ["Vicky"],
  "6.2.2": ["Tumwine"],
  "3.1.1.1": ["G.W.", "George William", "G.W. Kalenzi Smith"],
};
const SPOUSE_ALIASES: Record<string, string[]> = { "2.4.1": ["Maria Obua"] };
const NAME_OVERRIDE: Record<string, string> = { "3.1.1.1": "George William Kalenzi Smith" };

const OPEN_ITEMS: Record<string, string> = {
  "1": "Agnes Tumuhwire vs Agnes Tumwine is undecided. Kept Tumuhwire; Tumwine stored as alias.",
  "2": "Wife's name to be confirmed.",
  "3": "Spouse recorded with a single or partial name; full name to be confirmed.",
  "4": "Gender inferred from first name; please confirm.",
};

const FEMALE = new Set(
  `Martha Beatrice Margarette Maria Maureen Mauda Immaculate Sharon Josephine Elizabeth Ivy Caroline Catherine Elsa Clare Christabell Gillian Grace Magdalena Merina Loma Charlotte Imelda Gloria Francesca Nicolette Mary Pauline Theresa Evelyn Alisha Arrielle Sanyu Abigail Christine Madrine Irene Sheila Doreen Lynette Lorita Hildagarde Patricia Joy Peace Zion Alexia Isabella Salome Veronica Semara Yemi Verity Florence Audriana Vincent Lucy Liza Lyn Laureen Rose Lenah Michelle Makyla Sylvia Gianna Aviella Amaris Every Suzan Rosa Joana Hannah Eugenia Anita Agnes Anna Jackline Anne Brenda Mercy Sonia Loida Felista Cecilia Edith Harriet Cynthis Teodozia Komuhangi Sylivia Ruth Debra Rhola Angelina Albertina Regina Wendy Michell Roshmin Nikita Patience Jacquerine Hanna Nora Hellen Kezerle Petrina Paroma Macrina Channel Thea Kiara Stella Phiona Theopista Speciosa Baby Kyomugisha Jolly Elisha Caaroline Kobusingye Kiconco Ikondere Nethan Maxine Kemitooma`.split(
    /\s+/,
  ),
);
const MALE = new Set(
  `John Ivan Israel Isaih Paul Godfrey Godwin Wilson Frank Edward Agaba Nigel Briel Robert Michael Joseph Francis Maxmillan Stefan Joshua Martin Gilbert Collins Jeremiah Archangel Mario Melvin Patrick Solomon Norbert Liam Julian Ryan Moses Emmanuel Shawn George Sam Xavier Gabriel Deus Hilary Conrad Mathew Mark Anthony Felix William Aedan Ben Jonathan Benjamin Kevin Micah Andrew Rogers Trevor Tarvis Josiah Henry Larry Josheb Silasi Cedrick Deogratius Petero Ronald Innocent Christian Banyenzaki Antiel Yakobo Steven Denis Justus Priton David Bosco Deo Gerald Roderick Allan Brian Brandon Raymond Albert Trevaar Jason Herbert Nolan Jordan Omukama Swithin Timothy Aaron Alexander Eugene Aeden Karl Bonny Jeffrey Roy Warren Jonah Vittorio Vincenzo Kigambo`.split(
    /\s+/,
  ),
);

const uuid = (seed: string) => {
  const h = createHash("sha1").update(`family-tree:${seed}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

function guessGender(name: string): "M" | "F" | "U" {
  const first = name.split(/\s+/)[0] ?? "";
  if (FEMALE.has(first)) return "F";
  if (MALE.has(first)) return "M";
  return "U";
}

interface Parsed {
  name: string;
  title: string | null;
  late: boolean;
  twinOf: string | null;
  female: boolean;
  items: string[];
}

function parseName(raw: string): Parsed {
  let s = raw;
  const late = /\(late\)/i.test(s);
  const twin = /\(twin of ([\d.]+)\)/.exec(s);
  const female = /\(female/.test(s);
  const items = [...s.matchAll(/\[\?(\d)\]/g)].map((m) => m[1]!);
  s = s.replace(/\(late\)/gi, "").replace(/\[\?\d\]/g, "").replace(/\([^)]*\)/g, "");
  s = s.replace(/\s+/g, " ").trim();
  let title: string | null = null;
  for (const t of TITLES) {
    if (s.startsWith(t + " ")) {
      title = t;
      s = s.slice(t.length + 1);
      break;
    }
  }
  return { name: s, title, late, twinOf: twin?.[1] ?? null, female, items };
}

const persons: Person[] = [];
const unions: Union[] = [];
const parentage: Parentage[] = [];
const byPath = new Map<string, Person>();
const unionOfPath = new Map<string, Union>(); // union whose children descend (latest)

function addPerson(
  p: Parsed,
  path: string | null,
  opts: { blood: boolean; order: number | null; idSeed: string; statedGender?: "M" | "F" },
): Person {
  const stated = !!opts.statedGender || p.female;
  const g = opts.statedGender ?? (p.female ? "F" : guessGender(p.name));
  const notes: string[] = p.items.map((i) => OPEN_ITEMS[i] ?? "");
  const person: Person = {
    id: uuid(opts.idSeed),
    path,
    fullName: (path && NAME_OVERRIDE[path]) || p.name,
    title: p.title,
    aliases: [],
    isDeceased: p.late,
    isBloodMember: opts.blood,
    gender: g,
    genderSource: stated ? "stated" : "inferred",
    twinGroup: null,
    birthOrder: opts.order,
    needsReview: false,
    reviewNote: null,
  };
  if (!stated && g !== "U") notes.push(OPEN_ITEMS["4"]!);
  if (g === "U") notes.push(OPEN_ITEMS["4"]!);
  const n = notes.filter(Boolean);
  if (n.length) {
    person.needsReview = true;
    person.reviewNote = n.join(" ");
  }
  persons.push(person);
  if (path) byPath.set(path, person);
  return person;
}

function addUnion(a: Person, b: Person | null, seq: number, status: Union["status"]): Union {
  const u: Union = {
    id: uuid(`union:${a.id}:${seq}`),
    partnerA: a.id,
    partnerB: b?.id ?? null,
    sequence: seq,
    status,
  };
  unions.push(u);
  return u;
}

function addSpouse(of: Person, raw: string, seq: number, key: string): void {
  if (/name to be confirmed/i.test(raw)) {
    of.needsReview = true;
    of.reviewNote = [of.reviewNote, OPEN_ITEMS["2"]].filter(Boolean).join(" ");
    unionOfPath.set(key, addUnion(of, null, seq, "unknown"));
    return;
  }
  const p = parseName(raw);
  const sp = addPerson(p, null, { blood: false, order: null, idSeed: `spouse:${key}:${seq}` });
  if (sp.gender === "U") {
    sp.gender = of.gender === "M" ? "F" : of.gender === "F" ? "M" : "U";
  }
  if (!/\s/.test(p.name)) {
    sp.needsReview = true;
    sp.reviewNote = [sp.reviewNote, OPEN_ITEMS["3"]].filter(Boolean).join(" ");
  }
  const u = addUnion(of, sp, seq, sp.isDeceased || of.isDeceased ? "widowed" : "married");
  unionOfPath.set(key, u);
}

// Root couple
const antiel = addPerson(parseName("Antiel Bintukwanga (late)"), "0", {
  blood: true,
  order: null,
  idSeed: "root:a",
  statedGender: "M",
});
const maria = addPerson(parseName("Maria Christine Nakayima (late)"), null, {
  blood: false,
  order: null,
  idSeed: "root:m",
  statedGender: "F",
});
const rootUnion = addUnion(antiel, maria, 1, "widowed");

const lines = readFileSync(planPath, "utf8").split(/\r?\n/);
const start = lines.findIndex((l) => l.startsWith("### Branch 1"));
const end = lines.findIndex((l) => l.startsWith("### Seeding task"));
const orderCounter: Record<string, number> = {};

for (const line of lines.slice(start, end)) {
  const head = /^### Branch (\d+) — (.+)$/.exec(line);
  if (head) {
    const no = head[1]!;
    const text = head[2]!;
    let subjectRaw = text.split(" — ")[0]!;
    let spouseRaw: string | null = null;
    if (subjectRaw.includes(" m. ")) {
      const [a, b] = subjectRaw.split(" m. ") as [string, string];
      subjectRaw = a;
      spouseRaw = b;
    }
    const person = addPerson(parseName(subjectRaw), no, {
      blood: true,
      order: Number(no),
      idSeed: `path:${no}`,
    });
    parentage.push({ childId: person.id, unionId: rootUnion.id, parentId: null });
    if (spouseRaw) addSpouse(person, spouseRaw, 1, no);
    continue;
  }
  const m = /^(\s*)- (\d+(?:\.\d+)+) (.+)$/.exec(line);
  if (!m) continue;
  const path = m[2]!;
  const rest = m[3]!;
  const parentPath = path.split(".").slice(0, -1).join(".");
  const parent = byPath.get(parentPath)!;
  orderCounter[parentPath] = (orderCounter[parentPath] ?? 0) + 1;

  let spouseParts: string[] = [];
  let subject = rest;
  if (path === "7.2") {
    subject = "Allan Kagurutsi Kakuba";
    spouseParts = ["Ruth (late)", "Sylivia Namatovu"];
  } else {
    const idx = rest.indexOf(" m. ");
    if (idx >= 0) {
      subject = rest.slice(0, idx).replace(/\s*[—-]\s*$/, "");
      spouseParts = [rest.slice(idx + 4)];
    } else subject = rest.replace(/\s*[—-]\s*$/, "");
  }
  const parsed = parseName(subject);
  const person = addPerson(parsed, path, {
    blood: true,
    order: orderCounter[parentPath]!,
    idSeed: `path:${path}`,
  });
  if (parsed.twinOf) {
    const g = [path, parsed.twinOf].sort().join("+");
    person.twinGroup = g;
    const other = byPath.get(parsed.twinOf);
    if (other) other.twinGroup = g;
  }
  spouseParts.forEach((s, i) => addSpouse(person, s, i + 1, path));

  const pu = unionOfPath.get(parentPath);
  if (pu) parentage.push({ childId: person.id, unionId: pu.id, parentId: null });
  else parentage.push({ childId: person.id, unionId: null, parentId: parent.id });
}

for (const [p, a] of Object.entries(ALIASES)) byPath.get(p)?.aliases.push(...a);
for (const [p, a] of Object.entries(SPOUSE_ALIASES)) {
  const u = unionOfPath.get(p);
  persons.find((x) => x.id === u?.partnerB)?.aliases.push(...a);
}
for (const x of persons) {
  if (x.fullName.includes("Mwongyera")) {
    x.aliases.push(x.fullName.replace("Mwongyera", "Mwongera"), x.fullName.replace("Mwongyera", "Mwondgyera"));
  }
}
const agnes = byPath.get("6.2.2")!;
agnes.needsReview = true;
agnes.reviewNote = [agnes.reviewNote, OPEN_ITEMS["1"]].filter(Boolean).join(" ");

const tree: Tree = { persons, unions, parentage };
mkdirSync(resolve(root, "data"), { recursive: true });
writeFileSync(resolve(root, "data/family.seed.json"), JSON.stringify(tree, null, 2));
mkdirSync(resolve(root, "apps/web/public"), { recursive: true });
writeFileSync(resolve(root, "apps/web/public/tree.snapshot.json"), JSON.stringify(tree));

const counts: Record<string, number> = {};
for (const p of persons) {
  if (p.path) {
    const k = `G${p.path === "0" ? 0 : p.path.split(".").length}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }
}
console.log(`persons=${persons.length} unions=${unions.length} parentage=${parentage.length}`);
console.log("blood by generation:", counts, "needs_review:", persons.filter((p) => p.needsReview).length);
