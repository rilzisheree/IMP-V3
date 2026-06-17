import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import ShopItem from '../models/ShopItem.js';

export default {
  data: new SlashCommandBuilder()
    .setName('vshopcheck')
    .setDescription('See what\'s currently available in the valor shop.'),

  async execute(interaction) {
    await interaction.deferReply();

    const items = await ShopItem.find({ guildId: interaction.guildId }).sort({ price: 1 }).lean();

    if (!items.length) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x9b59b6)
          .setDescription('The shop is currently empty. Check back later.')],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('Valor Shop')
      .setDescription(
        items.map(i =>
          `**${i.name}** — ${i.price} valor${i.description ? `\n┗ *${i.description}*` : ''}`
        ).join('\n\n')
      )
      .setFooter({ text: `${items.length} item${items.length === 1 ? '' : 's'} available · Use /purchase to buy` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
