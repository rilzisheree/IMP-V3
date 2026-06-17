import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import GlobalBan from '../models/GlobalBan.js';
import { hasPermission } from '../lib/permissions.js';
import { sendGlobalLog, logEmbed } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('unglobalban')
  .setDescription('Remove a global ban from a user')
  .addStringOption(opt =>
    opt.setName('user_id')
      .setDescription('User ID to unban globally')
      .setRequired(true)
  );

export async function execute(interaction) {
  const allowed = await hasPermission(interaction, 'unglobalban');
  if (!allowed) {
    return interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true,
    });
  }

  const userId = interaction.options.getString('user_id');
  await interaction.deferReply();

  const ban = await GlobalBan.findOneAndDelete({ userId });
  if (!ban) {
    return interaction.editReply({ content: `❌ No global ban found for user ID \`${userId}\`.` });
  }

  let unbanned = 0;
  let failed = 0;
  for (const guild of interaction.client.guilds.cache.values()) {
    try {
      await guild.bans.remove(userId, `GlobalBan removed by ${interaction.user.tag}`);
      unbanned++;
    } catch {
      failed++;
    }
  }

  // DM the user to let them know they've been unbanned
  try {
    const target = await interaction.client.users.fetch(userId);
    const dmEmbed = new EmbedBuilder()
      .setTitle('You Have Been UNBANNED')
      .setColor(0x2ecc71)
      .setDescription(
        `After reviewing the case, the **Administration Team** has decided to **approve** your appeal and lift the ban issued against your account. Following a thorough assessment of the available information, it was determined that the punishment will be revoked.\n\n` +
        `You are now free to rejoin IMPERIUM servers. Link; https://discord.gg/WREM7sAy`
      )
      .addFields(
        { name: 'Unbanned By',    value: interaction.user.tag },
        { name: 'Original Reason', value: ban.reason || 'Not recorded' },
      )
      .setFooter({ text: 'IMPERIUM Management' })
      .setTimestamp();

    await target.send({ embeds: [dmEmbed] });
  } catch {
    // DMs disabled or user not reachable — silent fail
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Global Ban Removed')
    .setColor(0xF5C400)
    .setDescription(`Global ban removed for **${ban.username || userId}**.`)
    .addFields(
      { name: 'Unbanned in', value: `${unbanned} server(s)`, inline: true },
      { name: 'Failed',      value: `${failed} server(s)`,   inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  await sendGlobalLog(interaction.client, logEmbed(
    '✅ Global Unban',
    `**${interaction.user.tag}** removed global ban for **${ban.username || userId}** (\`${userId}\`)`,
    0xF5C400
  ));
}
