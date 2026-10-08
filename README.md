# Family Tree

Interactive family tree for the descendants of Antiel Bintukwanga and Maria Christine Nakayima.

- `apps/web` React + Vite + TypeScript (Vercel)
- `apps/api` Node + Express + TypeScript (Render)
- `packages/shared` shared types and zod schemas

## Develop
```bash
pnpm install
pnpm dev                              # seeds data, web on http://localhost:9901
pnpm --filter @family-tree/api dev    # API on http://localhost:9902
```
Family data (`data/`, the source plan) is gitignored: it names living people including children. Place the plan file in the repo root, then run `pnpm seed:build`.
