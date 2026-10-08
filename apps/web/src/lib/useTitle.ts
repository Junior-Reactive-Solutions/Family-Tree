import { useEffect } from "react";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Bintukwanga Family Tree` : "Bintukwanga Family Tree";
  }, [title]);
}
