import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isLT } from '../lib/valorPerms.js';
import ShopItem from '../models/ShopItem.js';

export default {
  data: new SlashCommandBuilder()
    .setName('vshopdeflate')
    .setDescription('Decrease an item\'s price in the shop. (LT only)')
    .addStringOption(opt =>
      opt.setName('item').setDescription('Name of the item').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Amount to decrease the price by').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    if (!await isLT(interaction.member)) {
      return interaction.reply({ content: 'You need the Loreteam role to use this command.', ephemeral: true });
    }

    const name   = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });

    const item = await ShopItem.findOne({
      guildId: interaction.guildId,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (!item) {
      return interaction.editReply({ content: `No item called **${name}** found in the shop.` });
    }

    if (item.price - amount < 1) {
      return interaction.editReply({ content: `Can't decrease by **${amount}** — that would bring the price to ${item.price - amount} or below zero. Current price is **${item.price} valor**.` });
    }

    item.price -= amount;
    await item.save();

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('Shop Price Decreased')
      .addFields(
        { name: 'Item',      value: item.name,                   inline: true },
        { name: 'Change',    value: `-${amount} valor`,          inline: true },
        { name: 'New Price', value: `${item.price} valor`,       inline: true },
        { name: 'By',        value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
