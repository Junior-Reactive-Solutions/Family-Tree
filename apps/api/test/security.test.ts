import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanLine, cleanText, SuggestionInputSchema } from "@family-tree/shared";

const SECRET = "test-session-secret";
const CODE = "maple-river-test-42";
process.env.FAMILY_ACCESS_CODE = CODE;
process.env.SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

let server: Server;
let base = "";
let ipSeq = 0;
const freshIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

interface Opts {
  ip?: string;
  cookie?: string;
  raw?: string;
  contentType?: string;
  method?: string;
  headers?: Record<string, string>;
}
async function call(path: string, body?: unknown, o: Opts = {}) {
  const headers: Record<string, string> = { "X-Forwarded-For": o.ip ?? freshIp() };
  if (o.cookie) headers.Cookie = o.cookie;
  Object.assign(headers, o.headers);
  if (body !== undefined || o.raw !== undefined) headers["Content-Type"] = o.contentType ?? "application/json";
  const res = await fetch(base + path, {
    method: o.method ?? (body !== undefined || o.raw !== undefined ? "POST" : "GET"),
    headers,
    body: o.raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers, json: () => JSON.parse(text) };
}

let cookie = "";
const valid = { category: "correct_name", message: "Please fix the spelling of this name." };
const suggest = (body: unknown, o: Opts = {}) => call("/api/suggestions", body, { cookie, ...o });

beforeAll(async () => {
  const { app } = await import("../src/app.js");
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const res = await fetch(base + "/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": freshIp() },
    body: JSON.stringify({ code: CODE }),
  });
  cookie = (res.headers.get("set-cookie") ?? "").split(";")[0]!;
});
afterAll(() => server?.close());

describe("access code box", () => {
  it("blocks family data without the code", async () => {
    expect((await call("/api/tree")).status).toBe(401);
  });
  it.each([
    ["wrong code", { code: "wrong" }],
    ["SQL injection", { code: "' OR '1'='1" }],
    ["script tag", { code: "<script>alert(1)</script>" }],
    ["over-long", { code: "a".repeat(101) }],
    ["number instead of text", { code: 12345 }],
    ["object instead of text", { code: { $ne: "" } }],
    ["missing field", {}],
  ])("rejects %s", async (_n, body) => {
    const r = await call("/api/access", body);
    expect(r.status).toBe(401);
    expect(r.headers.get("set-cookie")).toBeNull();
  });
  it("ignores case and surrounding spaces", async () => {
    expect((await call("/api/access", { code: `  ${CODE.toUpperCase()} ` })).status).toBe(200);
  });
  it("rejects forged, tampered and expired cookies", async () => {
    const exp = String(Date.now() - 1000);
    const sig = createHmac("sha256", SECRET).update(`access:${exp}`).digest("base64url");
    const [, realSig] = decodeURIComponent(cookie.split("=")[1]!).split(".");
    for (const c of [
      "family_access=9999999999999.forged",
      `family_access=9999999999999.${realSig}`,
      `family_access=${exp}.${sig}`,
    ]) {
      expect((await call("/api/suggestions", valid, { cookie: c })).status).toBe(401);
    }
  });
  it("issues an httpOnly SameSite=Strict cookie", async () => {
    const r = await call("/api/access", { code: CODE });
    const sc = r.headers.get("set-cookie") ?? "";
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Strict/i);
  });
  it("does not count correct codes towards the lockout", async () => {
    const ip = freshIp();
    for (let i = 0; i < 12; i++) expect((await call("/api/access", { code: CODE }, { ip })).status).toBe(200);
  });
  it("caps guessing from one connection even when visitor headers are forged", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 41; i++) {
      const headers = { "x-vercel-forwarded-for": `198.51.100.${i}`, "cf-connecting-ip": "192.0.2.20" };
      statuses.push((await call("/api/access", { code: `guess-${i}` }, { headers })).status);
    }
    expect(statuses.slice(0, 40).every((s) => s === 401)).toBe(true);
    expect(statuses[40]).toBe(429);
  });
  it("locks out guessing after 8 attempts from one visitor", async () => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) statuses.push((await call("/api/access", { code: `guess-${i}` }, { ip })).status);
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses[8]).toBe(429);
  });
});

describe("suggestion box", () => {
  it("accepts a normal suggestion", async () => {
    expect((await suggest(valid)).status).toBe(202);
  });
  it.each([
    ["message too long", { ...valid, message: "x".repeat(1001) }],
    ["huge raw message", { ...valid, message: "x".repeat(4001) }],
    ["message only spaces", { ...valid, message: "        " }],
    ["message only invisible characters", { ...valid, message: "​​​​​​" }],
    ["unknown category", { ...valid, category: "drop_tables" }],
    ["person id injection", { ...valid, personId: "1; DROP TABLE persons;--" }],
    ["name too long", { ...valid, submitterName: "n".repeat(81) }],
    ["contact is a script URL", { ...valid, submitterContact: "javascript:alert(1)" }],
    ["contact is random text", { ...valid, submitterContact: "call me maybe" }],
    ["message is a number", { ...valid, message: 12345 }],
    ["body is an array", [valid]],
  ])("rejects %s", async (_n, body) => {
    const r = await suggest(body);
    expect(r.status).toBe(400);
    expect(r.text).not.toMatch(/at \w+ \(|node_modules|ZodError/);
  });
  it.each([
    ["an email contact", { ...valid, submitterContact: "aunt.ruth@example.com" }],
    ["a phone contact", { ...valid, submitterContact: "+256 772 123 456" }],
    ["a valid person id", { ...valid, personId: "0ef6ad9e-2e30-5852-af74-0cd69c2d14e0" }],
    ["HTML and script text (stored as plain text)", { ...valid, message: '<img src=x onerror="alert(1)"> <script>alert(2)</script>' }],
    ["SQL text (stored as plain text)", { ...valid, message: "Robert'); DROP TABLE suggestions;--" }],
  ])("accepts %s", async (_n, body) => {
    expect((await suggest(body)).status).toBe(202);
  });
  it("silently swallows the honeypot", async () => {
    expect((await suggest({ ...valid, website: "http://spam.example" })).status).toBe(202);
  });
  it("is not affected by prototype pollution", async () => {
    const r = await suggest(undefined, { raw: `{"category":"other","message":"hello there","__proto__":{"polluted":"yes"}}` });
    expect(r.status).toBe(202);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("returns a plain JSON error for malformed JSON", async () => {
    const r = await suggest(undefined, { raw: '{"category": "other", "message": ' });
    expect(r.status).toBe(400);
    expect(r.json()).toEqual({ error: "Invalid request" });
  });
  it("refuses bodies over 10 KB", async () => {
    const r = await suggest(undefined, { raw: JSON.stringify({ ...valid, message: "x".repeat(11_000) }) });
    expect(r.status).toBe(413);
  });
  it("ignores non-JSON content types", async () => {
    expect((await suggest(undefined, { raw: "category=other&message=hello", contentType: "application/x-www-form-urlencoded" })).status).toBe(400);
  });
  it("rate-limits one visitor to 5 per 15 minutes", async () => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await suggest(valid, { ip })).status);
    expect(statuses.slice(0, 5).every((s) => s === 202)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
  it("cannot dodge the limit by forging visitor headers (production path)", async () => {
    // Through Vercel a caller can forge x-vercel-forwarded-for, but Cloudflare's cf-connecting-ip is fixed.
    const statuses: number[] = [];
    for (let i = 0; i < 70; i++) {
      const headers = { "x-vercel-forwarded-for": `203.0.113.${i}`, "cf-connecting-ip": "192.0.2.10" };
      statuses.push((await suggest(valid, { headers })).status);
    }
    expect(statuses.filter((s) => s === 202).length).toBe(60);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("text cleaning", () => {
  it("removes invisible and direction-flipping characters", () => {
    expect(cleanLine("Ann‮egdirB​")).toBe("AnnegdirB");
  });
  it("normalises look-alike full-width letters", () => {
    expect(cleanLine("Ｊｏｙ")).toBe("Joy");
  });
  it("keeps line breaks in messages but strips control characters", () => {
    expect(cleanText("Line one\r\n\u0007Line two\n\n\n\nLine three")).toBe("Line one\nLine two\n\nLine three");
  });
  it("keeps HTML as literal text (the page escapes it on display)", () => {
    const r = SuggestionInputSchema.parse({ category: "other", message: "<b>bold</b> & more" });
    expect(r.message).toBe("<b>bold</b> & more");
  });
});

describe("general hardening", () => {
  it("sends security headers and hides the framework", async () => {
    const r = await call("/api/health");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("x-powered-by")).toBeNull();
  });
  it("never lets a shared cache store family data", async () => {
    // Regression: a public Cache-Control let Vercel's edge serve the tree to visitors without the code.
    for (const path of ["/api/tree", "/api/health", "/api/access"]) {
      const r = await call(path, undefined, { cookie });
      const cc = r.headers.get("cache-control") ?? "";
      expect(cc).toMatch(/no-store/);
      expect(cc).not.toMatch(/public|s-maxage/);
      expect(r.headers.get("vercel-cdn-cache-control")).toBe("no-store");
    }
  });
  it("answers unknown routes with plain JSON", async () => {
    const r = await call("/api/../../etc/passwd");
    expect(r.status).toBe(404);
    expect(r.json()).toEqual({ error: "Not found" });
  });
});
