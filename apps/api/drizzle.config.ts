import { defineConfig } from "drizzle-kit";

// Use apps/api/.env when present, so `pnpm db:migrate` works as the README describes.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env: rely on the environment */
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "../../db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost/unused" },
});
