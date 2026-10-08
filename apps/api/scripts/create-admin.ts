/** Usage: pnpm admin:create <email> <password>  (password min 12 chars). Reads DATABASE_URL from .env */
import { neon } from "@neondatabase/serverless";
import { hash } from "@node-rs/argon2";
import { drizzle } from "drizzle-orm/neon-http";
import { admins } from "../src/db/schema.js";

const [email, password] = process.argv.slice(2);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!email || !password || password.length < 12) throw new Error("Usage: admin:create <email> <password of 12+ chars>");

const db = drizzle(neon(process.env.DATABASE_URL));
const passwordHash = await hash(password, { algorithm: 2 }); // argon2id
await db
  .insert(admins)
  .values({ email: email.toLowerCase(), passwordHash })
  .onConflictDoUpdate({ target: admins.email, set: { passwordHash } });
console.log(`admin ready: ${email.toLowerCase()}`);
