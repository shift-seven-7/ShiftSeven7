// Resend REST API via plain fetch (no SDK dependency) - see
// docs/MIGRATION_PLAN.md B.5 for why Resend over SES/SendGrid.
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey || !from) {
    console.warn("RESEND_API_KEY/EMAIL_FROM_ADDRESS not configured - skipping email to", to);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    console.error("Email send failed:", res.status, await res.text());
  }
}
