"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Admin-only: create a login (auth.users) for a staff member and link it via
 * staff.user_id. Matches the closed-HR-system model - no public self-signup,
 * see docs/MIGRATION_PLAN.md B.4. Uses the service-role client (bypasses
 * RLS), so this function does its own authorization check rather than
 * relying on RLS to reject a non-admin caller.
 */
export async function createStaffLogin(input: {
  staffId: string;
  email: string;
  password: string;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (claims?.claims?.user_role !== "admin") {
    throw new Error("Forbidden: only admins can create staff logins.");
  }

  const serviceRoleClient = createServiceRoleClient();

  const { data: created, error: createError } = await serviceRoleClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Failed to create user");
  }

  const { error: linkError } = await serviceRoleClient
    .from("staff")
    .update({ user_id: created.user.id })
    .eq("id", input.staffId);
  if (linkError) {
    throw new Error(`User created but failed to link to staff record: ${linkError.message}`);
  }

  return { userId: created.user.id };
}
