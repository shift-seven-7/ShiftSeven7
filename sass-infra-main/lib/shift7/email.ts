/**
 * Resend REST API via plain fetch (no SDK dependency) — direct port of the
 * original app's lib/email.ts.
 *
 * Platform-wide RESEND_API_KEY/EMAIL_FROM_ADDRESS, not per-tenant: unlike the
 * Slack webhook, a shared verified sending domain/API key across all tenants
 * matches how Resend accounts are normally set up (one account, one verified
 * domain). Per-tenant "from name" branding is a real possible enhancement but
 * nothing today needs it — see the `shift7_slack_webhook_url` per-tenant
 * secret in lib/shift7/slack.ts for the contrasting case where per-tenant
 * genuinely was needed.
 */
export async function sendShift7Email({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey || !from) {
    console.warn('[shift7/email] RESEND_API_KEY/EMAIL_FROM_ADDRESS not configured — skipping email to', to);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    console.error('[shift7/email] send failed:', response.status, await response.text());
  }
}
