import { getTenantSecret } from '@/lib/supabase/master-client';

/**
 * Slack notifications, per tenant.
 *
 * The original single-tenant app used one platform-wide SLACK_WEBHOOK_URL env
 * var, because it only ever served one company. Under this platform every
 * tenant is a different manager who would want notifications in their OWN
 * Slack workspace, so the webhook lives in the tenant's own encrypted secrets
 * bag (tenants.secrets, via getTenantSecret/setTenantSecret) instead — see
 * docs/multi-tenant.md "The general secrets bag".
 *
 * A tenant with no webhook configured is a normal, silent no-op — Slack
 * notifications are optional, not a Shift7 setup requirement.
 */
export async function sendShift7SlackMessage(tenantId: string, text: string): Promise<void> {
  const webhookUrl = await getTenantSecret(tenantId, 'shift7_slack_webhook_url');
  if (!webhookUrl) return;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    console.error('[shift7/slack] notification failed:', response.status, await response.text());
  }
}
