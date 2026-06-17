import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { hasPermission } from '../lib/permissions.js';
import { sendGlobalLog, logEmbed } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Delete a number of messages from the channel')
  .addIntegerOption(opt =>
    opt.setName('amount')
      .setDescription('Number of messages to delete (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  );

export async function execute(interaction) {
  const allowed = await hasPermission(interaction, 'purge');
  if (!allowed) {
    return interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true,
    });
  }

  const amount = interaction.options.getInteger('amount');
  await interaction.deferReply({ ephemeral: true });

  const deleted = await interaction.channel.bulkDelete(amount, true);

  const embed = new EmbedBuilder()
    .setColor(0xF5C400)
    .setDescription(`Deleted **${deleted.size}** message(s) in ${interaction.channel}.`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  await sendGlobalLog(interaction.client, logEmbed(
    'Purge',
    `**${interaction.user.tag}** purged **${deleted.size}** messages in <#${interaction.channelId}> (**${interaction.guild.name}**)`,
    0xF5C400,
    [{ name: 'Channel', value: `<#${interaction.channelId}>`, inline: true }, { name: 'Guild', value: interaction.guild.name, inline: true }]
  ));
}
