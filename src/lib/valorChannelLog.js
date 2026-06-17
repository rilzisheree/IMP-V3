import ValorChannel from '../models/ValorChannel.js';

/**
 * Posts an embed to the configured valor log channel for this guild.
 * Silently does nothing if no channel is set or the channel is missing.
 */
export async function sendToValorChannel(client, guildId, embed) {
  try {
    const doc = await ValorChannel.findOne({ guildId });
    if (!doc) return;
    const channel = await client.channels.fetch(doc.channelId).catch(() => null);
    if (!channel) return;
    await channel.send({ embeds: [embed] });
  } catch {
    // Never crash a command because logging failed
  }
}
