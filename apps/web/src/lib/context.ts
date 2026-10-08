import { createContext, useContext } from "react";
import type { Family } from "./data";

interface Ctx {
  family: Family;
  openPerson: (path: string | null) => void;
}
export const FamilyContext = createContext<Ctx | null>(null);
export function useFamily(): Ctx {
  const c = useContext(FamilyContext);
  if (!c) throw new Error("FamilyContext missing");
  return c;
}
