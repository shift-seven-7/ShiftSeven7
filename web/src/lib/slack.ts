// Single incoming webhook, per docs/MIGRATION_PLAN.md B.4/B.5 - this app only
// ever posts to one configured channel, so a webhook covers it without the
// OAuth-bot complexity Base44's connector had.
export async function sendSlackMessage(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK_URL not configured - skipping Slack notification");
    return;
  }
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error("Slack notification failed:", res.status, await res.text());
  }
}
