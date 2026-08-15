import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { week_label, facility_name, shift_count, staff_names } = body;

    // Read the configured Slack channel from SystemConfig
    const configEntries = await base44.asServiceRole.entities.SystemConfig.filter({ key: 'slack_notification_channel' });
    const channel = configEntries[0]?.value;
    if (!channel) {
      return Response.json({ error: 'Slack channel not configured' }, { status: 400 });
    }

    // Get the Slack bot connection
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('slackbot');

    // Build the message
    const staffList = staff_names && staff_names.length > 0
      ? staff_names.slice(0, 30).map(n => `• ${n}`).join('\n')
      : '';

    const messageText = `📢 *סידור עבודה חדש פורסם*\n\n📅 שבוע: ${week_label}\n🏢 ${facility_name || 'כלל הצוות'}\n✅ ${shift_count} משמרות פורסמו${staffList ? '\n\n👥 עובדים משובצים:\n' + staffList : ''}\n\nהסידור זמין לצפייה במערכת.`;

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
        icon_emoji: ':calendar:',
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