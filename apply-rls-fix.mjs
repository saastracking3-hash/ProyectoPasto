// Helper to apply the RLS recursion fix.
// Usage: node --env-file=.env.local apply-rls-fix.mjs
//
// If you have the DB password:
//   node --env-file=.env.local apply-rls-fix.mjs --db-password YOUR_PASSWORD
//
// Otherwise, paste the SQL printed below into:
//   https://app.supabase.com/project/kdgeywiajbassqqlkfkg/editor

import { readFileSync } from "fs";
import { createRequire } from "module";

const SQL_FILE = "./supabase/migrations/00004_fix_rls_recursion.sql";
const sql = readFileSync(SQL_FILE, "utf8");

const args = process.argv.slice(2);
const pwIndex = args.indexOf("--db-password");
const dbPassword = pwIndex !== -1 ? args[pwIndex + 1] : null;

if (!dbPassword) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  RLS Fix — Paste this SQL in the Supabase dashboard:");
  console.log("  https://app.supabase.com/project/kdgeywiajbassqqlkfkg/editor");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(sql);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Or re-run with your DB password:");
  console.log("  node --env-file=.env.local apply-rls-fix.mjs --db-password YOUR_PASSWORD");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(0);
}

// Direct connection with pg
const require = createRequire(import.meta.url);
const { Client } = require("pg");

const projectRef = "kdgeywiajbassqqlkfkg";
const client = new Client({
  connectionString: `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("Connected. Applying RLS fix...");
  await client.query(sql);
  console.log("✓ RLS fix applied successfully!");
} catch (err) {
  console.error("Error:", err.message);
  console.log("\nFallback: Paste the SQL manually at:");
  console.log("https://app.supabase.com/project/kdgeywiajbassqqlkfkg/editor");
} finally {
  await client.end();
}
