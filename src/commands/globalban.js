import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import GlobalBan from '../models/GlobalBan.js';
import { hasPermission } from '../lib/permissions.js';
import { sendGlobalLog, logEmbed } from '../lib/logger.js';

// Add server IDs here that should be EXEMPT from global bans
const EXEMPT_GUILD_IDS = [
  // '1502655289386729653',
  // '1493549808521318421',
];

export const data = new SlashCommandBuilder()
  .setName('globalban')
  .setDescription('Globally ban a user from all servers the bot is in')
  .addUserOption(opt =>
    opt.setName('user')
      .setDescription('User to globally ban (mention)')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt.setName('user_id')
      .setDescription('User ID to globally ban (use if you cannot mention them)')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt.setName('reason')
      .setDescription('Reason for the global ban')
      .setRequired(false)
  );

export async function execute(interaction) {
  const allowed = await hasPermission(interaction, 'globalban');
  if (!allowed) {
    return interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true,
    });
  }

  const mentionedUser = interaction.options.getUser('user');
  const rawId         = interaction.options.getString('user_id')?.trim();
  const reason        = interaction.options.getString('reason') || 'No reason provided';

  if (!mentionedUser && !rawId) {
    return interaction.reply({
      content: '❌ You must provide either a user mention or a user ID.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  // Resolve the target — prefer mention, fall back to ID fetch
  let target = mentionedUser;
  if (!target) {
    try {
      target = await interaction.client.users.fetch(rawId);
    } catch {
      return interaction.editReply({ content: `❌ Could not find a user with ID \`${rawId}\`. Double-check the ID and try again.` });
    }
  }

  const targetId  = target?.id  ?? rawId;
  const targetTag = target?.tag ?? rawId;

  await GlobalBan.findOneAndUpdate(
    { userId: targetId },
    { userId: targetId, username: targetTag, reason, bannedBy: interaction.user.tag, bannedAt: new Date() },
    { upsert: true, new: true }
  );

  // DM the user if possible
  if (target) {
    try {
      const banDmEmbed = new EmbedBuilder()
        .setTitle('You Have Been BANNED')
        .setColor(0xe74c3c)
        .setDescription(
          `You have been **BANNED** from all **IMPERIUM** servers.\n\n` +
          `If you believe this was a mistake, you may submit a ban appeal below. Do **NOT** DM or harrass any Staff Or Lore Team Members, Or you'll be perma-banned from Imperium forever.`
        )
        .addFields(
          { name: 'Reason',     value: reason },
          { name: 'Ban Appeal', value: 'https://discord.gg/7W2EZcBr7Z' },
        )
        .setFooter({ text: 'IMPERIUM Management — This action was reviewed by Staff.' })
        .setTimestamp();

      await target.send({ embeds: [banDmEmbed] });
    } catch {
      // DMs disabled or bot shares no server with user — silent fail
    }
  }

  let banned = 0;
  let failed = 0;
  let skipped = 0;

  for (const guild of interaction.client.guilds.cache.values()) {
    if (EXEMPT_GUILD_IDS.includes(guild.id)) {
      skipped++;
      continue;
    }
    try {
      await guild.bans.create(targetId, { reason: `[Auto Global Ban from IMPERIUM Admin Bot] ${reason} | By: ${interaction.user.tag}` });
      banned++;
    } catch {
      failed++;
    }
  }

  const fields = [
    { name: 'Reason',    value: reason },
    { name: 'Banned in', value: `${banned} server(s)`, inline: true },
    { name: 'Failed',    value: `${failed} server(s)`, inline: true },
  ];

  if (skipped > 0) {
    fields.push({ name: 'Skipped (exempt)', value: `${skipped} server(s)`, inline: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🔨 Global Ban Applied')
    .setColor(0x000000)
    .setDescription(`**${targetTag}** has been globally banned.`)
    .addFields(fields)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  await sendGlobalLog(interaction.client, logEmbed(
    '🔨 Global Ban',
    `**${interaction.user.tag}** globally banned **${targetTag}** (\`${targetId}\`)`,
    0x000000,
    [{ name: 'Reason', value: reason }, { name: 'Servers', value: `${banned} banned, ${failed} failed, ${skipped} skipped` }]
  ));
}
