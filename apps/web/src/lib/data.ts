import { TreeSchema, type Person, type Tree } from "@family-tree/shared";
import type { Datum } from "family-chart";

export interface Family {
  tree: Tree;
  byId: Map<string, Person>;
  byPath: Map<string, Person>;
  spousesOf: Map<string, Person[]>;
  childrenOf: Map<string, Person[]>;
  parentsOf: Map<string, Person[]>;
  chart: Datum[];
}

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

async function fetchJson(url: string, ms: number): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** API first (Render may be waking from idle), build-time snapshot as fallback. */
export async function loadFamily(): Promise<Family> {
  {
    try {
      return buildFamily(TreeSchema.parse(await fetchJson(`${API}/api/tree`, 55000)));
    } catch {
      /* fall through to snapshot */
    }
  }
  return buildFamily(TreeSchema.parse(await fetchJson("/tree.snapshot.json", 10000)));
}

const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
  const a = m.get(k) ?? [];
  if (!a.includes(v)) a.push(v);
  m.set(k, a);
};

export function buildFamily(tree: Tree): Family {
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const byPath = new Map(tree.persons.filter((p) => p.path).map((p) => [p.path!, p]));
  const spousesOf = new Map<string, Person[]>();
  const childrenOf = new Map<string, Person[]>();
  const parentsOf = new Map<string, Person[]>();
  const unionById = new Map(tree.unions.map((u) => [u.id, u]));

  for (const u of tree.unions) {
    const a = byId.get(u.partnerA)!;
    const b = u.partnerB ? byId.get(u.partnerB) : undefined;
    if (b) {
      push(spousesOf, a.id, b);
      push(spousesOf, b.id, a);
    }
  }
  for (const pg of tree.parentage) {
    const child = byId.get(pg.childId)!;
    const parents: Person[] = [];
    if (pg.unionId) {
      const u = unionById.get(pg.unionId)!;
      parents.push(byId.get(u.partnerA)!);
      if (u.partnerB) parents.push(byId.get(u.partnerB)!);
    } else if (pg.parentId) parents.push(byId.get(pg.parentId)!);
    for (const p of parents) {
      push(childrenOf, p.id, child);
      push(parentsOf, child.id, p);
    }
  }
  const order = (a: Person, b: Person) => (a.birthOrder ?? 0) - (b.birthOrder ?? 0);
  childrenOf.forEach((v) => v.sort(order));

  const chart: Datum[] = tree.persons.map((p) => ({
    id: p.id,
    data: { gender: p.gender === "F" ? "F" : "M" },
    rels: {
      parents: (parentsOf.get(p.id) ?? []).map((x) => x.id),
      spouses: (spousesOf.get(p.id) ?? []).map((x) => x.id),
      children: (childrenOf.get(p.id) ?? []).map((x) => x.id),
    },
  }));
  return { tree, byId, byPath, spousesOf, childrenOf, parentsOf, chart };
}

export const displayName = (p: Person) => (p.title ? `${p.title} ${p.fullName}` : p.fullName);
export const initials = (p: Person) =>
  p.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
export const generationOf = (p: Person) => (p.path ? (p.path === "0" ? 0 : p.path.split(".").length) : null);
