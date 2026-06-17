import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { sendToValorChannel } from '../lib/valorChannelLog.js';
import Valor     from '../models/Valor.js';
import ShopItem  from '../models/ShopItem.js';
import Inventory from '../models/Inventory.js';
import ValorLog  from '../models/ValorLog.js';

export default {
  data: new SlashCommandBuilder()
    .setName('purchase')
    .setDescription('Buy an item from the valor shop.')
    .addStringOption(opt =>
      opt.setName('item').setDescription('Name of the item to buy').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('quantity').setDescription('How many to buy (default: 1)').setMinValue(1)),

  async execute(interaction) {
    const itemName = interaction.options.getString('item');
    const qty      = interaction.options.getInteger('quantity') ?? 1;

    await interaction.deferReply({ ephemeral: true });

    const shopItem = await ShopItem.findOne({
      guildId: interaction.guildId,
      name: { $regex: new RegExp(`^${itemName}$`, 'i') },
    });

    if (!shopItem) {
      return interaction.editReply({ content: `No item named **${itemName}** in the shop. Use \`/vshopcheck\` to see what's available.` });
    }

    const totalCost   = shopItem.price * qty;
    const valorRecord = await Valor.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
    const current     = valorRecord?.valor ?? 0;

    if (current < totalCost) {
      return interaction.editReply({
        content: `You don't have enough valor.\n**Cost:** ${totalCost} (${qty}x ${shopItem.name} @ ${shopItem.price} each)\n**Your balance:** ${current} valor`,
      });
    }

    await Valor.findOneAndUpdate(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $inc: { valor: -totalCost } },
      { upsert: true }
    );

    const inv = await Inventory.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
    if (inv) {
      const slot = inv.items.find(i => i.name.toLowerCase() === shopItem.name.toLowerCase());
      if (slot) slot.quantity += qty;
      else inv.items.push({ name: shopItem.name, quantity: qty });
      await inv.save();
    } else {
      await Inventory.create({
        userId:  interaction.user.id,
        guildId: interaction.guildId,
        items:   [{ name: shopItem.name, quantity: qty }],
      });
    }

    await ValorLog.create({
      guildId:    interaction.guildId,
      userId:     interaction.user.id,
      executorId: interaction.user.id,
      action:     'SPEND',
      amount:     -totalCost,
      note:       `Purchased ${qty}x ${shopItem.name}`,
    });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Purchase')
      .addFields(
        { name: 'User',      value: `<@${interaction.user.id}>`,    inline: true },
        { name: 'Item',      value: shopItem.name,                  inline: true },
        { name: 'Quantity',  value: `${qty}`,                       inline: true },
        { name: 'Cost',      value: `${totalCost} valor`,           inline: true },
        { name: 'Remaining', value: `${current - totalCost} valor`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await sendToValorChannel(interaction.client, interaction.guildId, embed);
  },
};
