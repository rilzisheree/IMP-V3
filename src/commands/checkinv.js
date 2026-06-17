import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import Inventory from '../models/Inventory.js';

export default {
  data: new SlashCommandBuilder()
    .setName('checkinv')
    .setDescription('Check your own inventory.'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const inv   = await Inventory.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
    const items = inv?.items ?? [];

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('Your Inventory')
      .setDescription(
        items.length
          ? items.map(i => `**${i.name}** x${i.quantity}`).join('\n')
          : 'You have no items. Use `/vshopcheck` to see what\'s available.'
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
