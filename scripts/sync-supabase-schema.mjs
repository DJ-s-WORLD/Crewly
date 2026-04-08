/**
 * Applies supabase/bootstrap_missing_tables.sql to your Supabase Postgres database.
 *
 * Why this exists:
 * - The Vite app talks to Supabase over HTTPS (PostgREST). Tables must exist in Postgres.
 * - The Express app in /server uses MongoDB — it never touches Supabase. Starting it does not create Postgres tables.
 *
 * Usage:
 *   npm run db:sync
 *
 * Optional (skip if DATABASE_URL unset — for dev:all):
 *   node scripts/sync-supabase-schema.mjs --optional
 */

import fs from "fs";
import dns from "node:dns";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

// Supabase often exposes only AAAA (IPv6) for db.*.supabase.co. Node’s default ipv4first
// can yield ENOTFOUND on some networks; respect DNS order instead.
dns.setDefaultResultOrder("verbatim");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const optional = process.argv.includes("--optional");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv(path.join(root, ".env"));

const DATABASE_URL = (process.env.DATABASE_URL || "").trim();

if (!DATABASE_URL) {
  const msg = `
[LifePilot] DATABASE_URL is not set in .env (project root).

Your Supabase tables are in PostgreSQL. They are NOT created by:
  • npm run dev (Vite only serves the UI)
  • npm run dev:api (Express + MongoDB — different database entirely)

Fix (pick one):
  A) Add DATABASE_URL to .env, then run:  npm run db:sync
     Get URI from Supabase → Project Settings → Database → Connection string → URI
     (use the direct connection, port 5432, with your database password)

  B) Paste supabase/bootstrap_missing_tables.sql into Supabase → SQL Editor → Run
`;
  if (optional) {
    console.warn(msg);
    process.exit(0);
  }
  console.error(msg);
  process.exit(1);
}

const sqlPath = path.join(root, "supabase", "bootstrap_missing_tables.sql");
if (!fs.existsSync(sqlPath)) {
  console.error(`Missing file: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const useSsl = !/localhost|127\.0\.0\.1/i.test(DATABASE_URL);

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

try {
  await client.connect();
  console.log("[LifePilot] Connected to Postgres. Applying schema…");
  await client.query(sql);
  console.log("[LifePilot] Schema applied successfully (profiles, tasks, chat_messages, storage policies).");
} catch (err) {
  console.error("[LifePilot] Schema sync failed:", err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
