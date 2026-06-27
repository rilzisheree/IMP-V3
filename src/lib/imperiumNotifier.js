/**
 * imperiumNotifier.js — drop into src/lib/
 *
 * Spins up a lightweight HTTP listener inside your bot process.
 * The Imperium website posts ticket events here; the bot forwards
 * them as Discord embeds to whichever channels you configure.
 *
 * ── Setup ────────────────────────────────────────────────────────
 *
 * 1. Add this to your .env:
 *
 *    IMPERIUM_WEBHOOK_PORT=3001
 *    IMPERIUM_WEBHOOK_SECRET=some-long-random-string
 *    IMPERIUM_CHANNEL_DEFAULT=YOUR_FALLBACK_CHANNEL_ID
 *
 *    Optional per-event overrides (leave blank to use DEFAULT):
 *    IMPERIUM_CHANNEL_TICKET_CREATED=
 *    IMPERIUM_CHANNEL_STATUS_CHANGED=
 *    IMPERIUM_CHANNEL_REPLY_ADDED=
 *    IMPERIUM_CHANNEL_NOTE_ADDED=
 *    IMPERIUM_CHANNEL_ASSIGNED=
 *    IMPERIUM_CHANNEL_DELETED=
 *
 * 2. Add two lines to your src/index.js (after client is created):
 *
 *    import { startImperiumNotifier } from './lib/imperiumNotifier.js';
 *    // inside main(), after client.login():
 *    startImperiumNotifier(client);
 *
 * 3. In the Imperium staff panel → Webhooks → New Webhook:
 *    - Mode: Webhook URL
 *    - URL:  http://your-railway-host:3001/imperium
 *    - Secret: (the same value as IMPERIUM_WEBHOOK_SECRET)
 *    - Pick whichever events you want
 *
 * ─────────────────────────────────────────────────────────────────
 */

import http from 'http';
import crypto from 'crypto';
import { EmbedBuilder } from 'discord.js';

// ── Helpers ──────────────────────────────────────────────────────

function safe(value, fallback = 'N/A') {
  const str = String(value ?? '').trim();
  return str.length > 0 ? str : fallback;
}

function ticketTypeLabel(type) {
  const map = {
    'report-user': 'Report User',
    'appeal-ban': 'Appeal Ban',
    'appeal-character-death': 'Appeal Character Death',
    'permadeath-event': 'Permadeath Event',
  };
  return map[type] ?? type;
}

function statusLabel(status) {
  const map = {
    pending: 'Pending',
    open: 'Open',
    'awaiting-user': 'Awaiting User',
    'under-investigation': 'Under Investigation',
    accepted: 'Accepted',
    denied: 'Denied',
    closed: 'Closed',
    resolved: 'Resolved',
  };
  return map[status] ?? status;
}

const EVENT_COLORS = {
  'ticket.created': 0x5865f2,
  'ticket.status_changed': 0xffa500,
  'ticket.reply_added': 0x57f287,
  'ticket.note_added': 0xfee75c,
  'ticket.assigned': 0xeb459e,
  'ticket.deleted': 0xed4245,
  test: 0xffd23f,
};

const FOOTER = { text: 'Imperium Support System' };

// ── Embed builder ────────────────────────────────────────────────

function buildEmbed(event, data) {
  const color = EVENT_COLORS[event] ?? 0x5865f2;
  const base = new EmbedBuilder().setColor(color).setTimestamp().setFooter(FOOTER);

  if (event === 'test') {
    return base
      .setTitle('🔔 Webhook Test')
      .setDescription(`Webhook **${safe(data.webhookName)}** is connected and working.`)
      .addFields(
        { name: 'Webhook ID', value: safe(data.webhookId), inline: true },
        { name: 'Event', value: 'test', inline: true },
      );
  }

  switch (event) {
    case 'ticket.created':
      return base
        .setTitle('🎫 New Ticket Created')
        .addFields(
          { name: 'Ticket Code', value: safe(data.ticketCode), inline: true },
          { name: 'Type', value: ticketTypeLabel(safe(data.type)), inline: true },
          { name: 'Status', value: statusLabel(safe(data.status, 'pending')), inline: true },
          { name: 'Roblox Username', value: safe(data.robloxUsername), inline: true },
          { name: 'Discord Username', value: safe(data.discordUsername), inline: true },
          { name: 'Subject', value: safe(data.subject).slice(0, 1024), inline: false },
        );

    case 'ticket.status_changed': {
      const embed = base
        .setTitle('🔄 Ticket Status Changed')
        .addFields(
          { name: 'Ticket Code', value: safe(data.ticketCode), inline: true },
          { name: 'Old Status', value: statusLabel(safe(data.oldStatus)), inline: true },
          { name: 'New Status', value: statusLabel(safe(data.newStatus)), inline: true },
        );
      if (data.changedBy) embed.addFields({ name: 'Changed By', value: safe(data.changedBy), inline: true });
      return embed;
    }

    case 'ticket.reply_added':
      return base
        .setTitle('💬 Reply Added')
        .addFields(
          { name: 'Ticket Code', value: safe(data.ticketCode), inline: true },
          { name: 'Author', value: safe(data.authorName), inline: true },
          { name: 'Role', value: safe(data.authorRole), inline: true },
          { name: 'Message', value: safe(data.message).slice(0, 1024), inline: false },
        );

    case 'ticket.note_added':
      return base
        .setTitle('📝 Internal Note Added')
        .addFields(
          { name: 'Ticket Code', value: safe(data.ticketCode), inline: true },
          { name: 'Added By', value: safe(data.addedBy ?? data.authorName), inline: true },
          { name: 'Note', value: safe(data.note ?? data.authorNote).slice(0, 1024), inline: false },
        );

    case 'ticket.assigned': {
      const embed = base
        .setTitle('👤 Ticket Assigned')
        .addFields(
          { name: 'Ticket Code', value: safe(data.ticketCode), inline: true },
          { name: 'Assigned To', value: safe(data.assignedTo, 'Unassigned'), inline: true },
        );
      if (data.assignedBy) embed.addFields({ name: 'Assigned By', value: safe(data.assignedBy), inline: true });
      return embed;
    }

    case 'ticket.deleted': {
      const embed = base
        .setTitle('🗑️ Ticket Deleted')
        .addFields({ name: 'Ticket Code', value: safe(data.ticketCode), inline: true });
      if (data.deletedBy) embed.addFields({ name: 'Deleted By', value: safe(data.deletedBy), inline: true });
      return embed;
    }

    default:
      return base
        .setTitle(`🔔 ${event}`)
        .setDescription(('```json\n' + JSON.stringify(data, null, 2) + '\n```').slice(0, 2000));
  }
}

// ── Channel routing ──────────────────────────────────────────────

function getChannelId(event) {
  const overrides = {
    'ticket.created': process.env.IMPERIUM_CHANNEL_TICKET_CREATED,
    'ticket.status_changed': process.env.IMPERIUM_CHANNEL_STATUS_CHANGED,
    'ticket.reply_added': process.env.IMPERIUM_CHANNEL_REPLY_ADDED,
    'ticket.note_added': process.env.IMPERIUM_CHANNEL_NOTE_ADDED,
    'ticket.assigned': process.env.IMPERIUM_CHANNEL_ASSIGNED,
    'ticket.deleted': process.env.IMPERIUM_CHANNEL_DELETED,
    test: process.env.IMPERIUM_CHANNEL_DEFAULT,
  };
  return overrides[event]?.trim() || process.env.IMPERIUM_CHANNEL_DEFAULT?.trim() || null;
}

// ── Signature validation ─────────────────────────────────────────

function validateSignature(secret, rawBody, signatureHeader) {
  if (!secret) return true; // no secret configured — skip check
  if (!signatureHeader) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

// ── HTTP server ──────────────────────────────────────────────────

/**
 * Call this once after client.login() to start the notifier.
 * @param {import('discord.js').Client} client
 */
export function startImperiumNotifier(client) {
  const port = parseInt(process.env.IMPERIUM_WEBHOOK_PORT ?? '3001', 10);
  const secret = process.env.IMPERIUM_WEBHOOK_SECRET ?? '';

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/imperium') {
      res.writeHead(404).end('Not found');
      return;
    }

    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
      // Signature check
      const sig = req.headers['x-webhook-signature'] ?? '';
      if (!validateSignature(secret, rawBody, sig)) {
        console.warn('[ImperiumNotifier] Invalid signature — request rejected');
        res.writeHead(401).end('Unauthorized');
        return;
      }

      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        res.writeHead(400).end('Bad JSON');
        return;
      }

      res.writeHead(200).end('OK');

      const { event, data = {} } = payload;
      if (!event) return;

      const channelId = getChannelId(event);
      if (!channelId) {
        console.warn(`[ImperiumNotifier] No channel configured for event "${event}" — set IMPERIUM_CHANNEL_DEFAULT`);
        return;
      }

      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel?.isTextBased()) {
          console.warn(`[ImperiumNotifier] Channel ${channelId} is not a text channel`);
          return;
        }
        const embed = buildEmbed(event, data);
        await channel.send({ embeds: [embed] });
        console.log(`[ImperiumNotifier] ✅ Sent "${event}" to #${channel.name ?? channelId}`);
      } catch (err) {
        console.error(`[ImperiumNotifier] Failed to send "${event}":`, err.message);
      }
    });
  });

  server.listen(port, () => {
    console.log(`[ImperiumNotifier] Listening on port ${port} — POST /imperium`);
  });

  server.on('error', err => {
    console.error('[ImperiumNotifier] Server error:', err.message);
  });

  return server;
}
