import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { staff_name, type_label, date_range, notes } = body;

    // Read the configured Slack channel from SystemConfig
    const configEntries = await base44.asServiceRole.entities.SystemConfig.filter({ key: 'slack_notification_channel' });
    const channel = configEntries[0]?.value;
    if (!channel) {
      return Response.json({ error: 'Slack channel not configured' }, { status: 400 });
    }

    // Get the Slack bot connection
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('slackbot');

    // Build the message
    const messageText = `📋 *בקשה חדשה מעובד*\n\n👤 עובד: ${staff_name}\n📝 סוג: ${type_label}${date_range ? `\n📅 תאריכים: ${date_range}` : ''}${notes ? `\n💬 הערות: ${notes}` : ''}\n\nטפל בבקשה בלוח הניהול במערכת.`;

    // Post to Slack
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channel,
        text: messageText,
        username: 'SecureShift',
        icon_emoji: ':inbox_tray:',
      }),
    });

    const slackData = await slackResponse.json();
    if (!slackData.ok) {
      return Response.json({ error: slackData.error }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});