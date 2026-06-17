import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isLT } from '../lib/valorPerms.js';
import ShopItem from '../models/ShopItem.js';

export default {
  data: new SlashCommandBuilder()
    .setName('vshopinflate')
    .setDescription('Increase an item\'s price in the shop. (LT only)')
    .addStringOption(opt =>
      opt.setName('item').setDescription('Name of the item').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Amount to increase the price by').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    if (!await isLT(interaction.member)) {
      return interaction.reply({ content: 'You need the Loreteam role to use this command.', ephemeral: true });
    }

    const name   = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });

    const item = await ShopItem.findOneAndUpdate(
      { guildId: interaction.guildId, name: { $regex: new RegExp(`^${name}$`, 'i') } },
      { $inc: { price: amount } },
      { new: true }
    );

    if (!item) {
      return interaction.editReply({ content: `No item called **${name}** found in the shop.` });
    }

    const embed = new EmbedBuilder()
      .setColor(0xf0a500)
      .setTitle('Shop Price Increased')
      .addFields(
        { name: 'Item',      value: item.name,                    inline: true },
        { name: 'Change',    value: `+${amount} valor`,           inline: true },
        { name: 'New Price', value: `${item.price} valor`,        inline: true },
        { name: 'By',        value: `<@${interaction.user.id}>`,  inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
