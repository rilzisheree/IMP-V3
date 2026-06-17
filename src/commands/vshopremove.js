import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isLT } from '../lib/valorPerms.js';
import ShopItem from '../models/ShopItem.js';

export default {
  data: new SlashCommandBuilder()
    .setName('vshopremove')
    .setDescription('Remove an item from the valor shop. (LT only)')
    .addStringOption(opt =>
      opt.setName('item').setDescription('Name of the item to remove').setRequired(true)),

  async execute(interaction) {
    if (!await isLT(interaction.member)) {
      return interaction.reply({ content: 'You need the Loreteam role to use this command.', ephemeral: true });
    }

    const name = interaction.options.getString('item');
    await interaction.deferReply({ ephemeral: true });

    const deleted = await ShopItem.findOneAndDelete({
      guildId: interaction.guildId,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (!deleted) {
      return interaction.editReply({ content: `No item called **${name}** found in the shop.` });
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Item Removed from Shop')
      .addFields(
        { name: 'Item',       value: deleted.name,            inline: true },
        { name: 'Was priced', value: `${deleted.price} valor`, inline: true },
        { name: 'Removed by', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
