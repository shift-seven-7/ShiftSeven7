// One-off local dev seed: creates a facility + an admin login so Phase 1
// can actually be tested end-to-end. Reads service-role credentials from
// .env.local. Not part of the app bundle - run with `node scripts/seed-admin.mjs`.
//
// Uses plain REST calls (not @supabase/supabase-js) since that SDK's
// realtime module requires Node 22+'s native WebSocket; this repo is on
// Node 20 as of this script being written.
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) process.env[match[1]] ??= match[2];
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = "admin@guardsync.test";
const ADMIN_PASSWORD = "GuardSync-Dev-1!";

function headers(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function checkOk(res, label) {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${label} failed: ${res.status} ${body}`);
  }
}

async function main() {
  const facilityRes = await fetch(`${SUPABASE_URL}/rest/v1/facilities`, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ name: "Headquarters", code: "HQ" }),
  });
  await checkOk(facilityRes, "Create facility");
  const [facility] = await facilityRes.json();
  console.log("Created facility:", facility.id);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    }),
  });
  await checkOk(userRes, "Create auth user");
  const user = await userRes.json();
  console.log("Created auth user:", user.id);

  const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff`, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({
      user_id: user.id,
      full_name: "Dev Admin",
      employee_id: "ADMIN-001",
      role: "dispatcher",
      primary_facility: facility.id,
      access_level: "admin",
      email: ADMIN_EMAIL,
    }),
  });
  await checkOk(staffRes, "Create staff row");
  const [staff] = await staffRes.json();
  console.log("Created staff row:", staff.id);

  console.log("\nLogin with:");
  console.log("  email:   ", ADMIN_EMAIL);
  console.log("  password:", ADMIN_PASSWORD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
