import { after } from 'next/server';
import { getTenantInfo } from '@/lib/api/auth';
import { sendShift7SlackMessage } from '@/lib/shift7/slack';

/**
 * Fire-and-forget Slack notifications, called from a Shift7 API route right
 * after the write that triggered them commits. Uses after() (from
 * next/server) so a slow/down Slack never adds latency to the user-facing
 * request — see docs/MIGRATION_PLAN.md B.5 for the original app's reasoning,
 * unchanged here.
 *
 * sendShift7SlackMessage no-ops silently when the tenant has no webhook
 * configured, so callers don't need their own "is Slack set up" check.
 */

export async function notifyShift7EmployeeRequest(input: {
  staffName: string;
  typeLabel: string;
  dateRange?: string;
  notes?: string;
}) {
  const { tenantId } = await getTenantInfo();

  after(async () => {
    const lines = [
      '📋 בקשה חדשה מעובד',
      `*${input.staffName}* — ${input.typeLabel}`,
      input.dateRange ? `📅 ${input.dateRange}` : null,
      input.notes ? `💬 ${input.notes}` : null,
      'טפל בבקשה בלוח הניהול.',
    ].filter((line): line is string => !!line);
    await sendShift7SlackMessage(tenantId, lines.join('\n'));
  });
}

/**
 * Admin-only in spirit — callers must already have verified the admin/
 * scheduler claim before invoking a publish action; this function itself
 * does not gate anything.
 */
export async function notifyShift7SchedulePublished(input: {
  weekLabel: string;
  facilityName?: string;
  shiftCount: number;
  staffNames?: string[];
}) {
  const { tenantId } = await getTenantInfo();

  after(async () => {
    const names = (input.staffNames ?? []).slice(0, 30);
    const lines = [
      '📢 סידור עבודה חדש פורסם',
      `*${input.weekLabel}* — ${input.facilityName || 'כלל הצוות'}`,
      `${input.shiftCount} משמרות`,
      ...names.map((name) => `• ${name}`),
    ];
    await sendShift7SlackMessage(tenantId, lines.join('\n'));
  });
}
