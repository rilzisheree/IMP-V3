import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isLT } from '../lib/valorPerms.js';
import ShopItem from '../models/ShopItem.js';

export default {
  data: new SlashCommandBuilder()
    .setName('vshopadd')
    .setDescription('Add an item to the valor shop. (LT only)')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Item name').setRequired(true).setMaxLength(50))
    .addIntegerOption(opt =>
      opt.setName('price').setDescription('Price in valor').setRequired(true).setMinValue(1))
    .addStringOption(opt =>
      opt.setName('description').setDescription('Short description of the item').setMaxLength(150)),

  async execute(interaction) {
    if (!await isLT(interaction.member)) {
      return interaction.reply({ content: 'You need the Loreteam role to use this command.', ephemeral: true });
    }

    const name  = interaction.options.getString('name');
    const price = interaction.options.getInteger('price');
    const desc  = interaction.options.getString('description') || '';

    await interaction.deferReply({ ephemeral: true });

    const existing = await ShopItem.findOne({
      guildId: interaction.guildId,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (existing) {
      return interaction.editReply({ content: `An item called **${name}** already exists in the shop. Use \`/vshopinflate\` or \`/vshopdeflate\` to change its price.` });
    }

    await ShopItem.create({ guildId: interaction.guildId, name, price, description: desc });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Item Added to Shop')
      .addFields(
        { name: 'Item',        value: name,          inline: true },
        { name: 'Price',       value: `${price} valor`, inline: true },
        { name: 'Description', value: desc || '—',   inline: false },
        { name: 'Added by',    value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
