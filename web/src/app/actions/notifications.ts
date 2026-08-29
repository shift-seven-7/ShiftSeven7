"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendSlackMessage } from "@/lib/slack";
import { after } from "next/server";

async function slackChannelConfigured(): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", "slack_notification_channel")
    .maybeSingle();
  return !!data?.value;
}

/**
 * Fire-and-forget: called right after an EmployeeRequest insert commits.
 * Uses after() so a slow/down Slack never adds latency to the request
 * submission itself - see docs/MIGRATION_PLAN.md B.5.
 */
export async function notifyEmployeeRequest(input: {
  staffName: string;
  typeLabel: string;
  dateRange?: string;
  notes?: string;
}) {
  after(async () => {
    if (!(await slackChannelConfigured())) return;
    const lines = [
      "📋 בקשה חדשה מעובד",
      `*${input.staffName}* — ${input.typeLabel}`,
      input.dateRange ? `📅 ${input.dateRange}` : null,
      input.notes ? `💬 ${input.notes}` : null,
      "טפל בבקשה בלוח הניהול.",
    ].filter(Boolean);
    await sendSlackMessage(lines.join("\n"));
  });
}

/**
 * Fire-and-forget: called right after a bulk-publish of shift_assignments
 * commits. Admin-only - callers must already have verified the admin claim
 * before invoking a publish action; this function itself does not gate.
 */
export async function notifySchedulePublished(input: {
  weekLabel: string;
  facilityName?: string;
  shiftCount: number;
  staffNames?: string[];
}) {
  after(async () => {
    if (!(await slackChannelConfigured())) return;
    const names = (input.staffNames || []).slice(0, 30);
    const lines = [
      "📢 סידור עבודה חדש פורסם",
      `*${input.weekLabel}* — ${input.facilityName || "כלל הצוות"}`,
      `${input.shiftCount} משמרות`,
      ...(names.length ? names.map((n) => `• ${n}`) : []),
    ];
    await sendSlackMessage(lines.join("\n"));
  });
}
