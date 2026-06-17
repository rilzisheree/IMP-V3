import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isLT } from '../lib/valorPerms.js';
import { sendToValorChannel } from '../lib/valorChannelLog.js';
import Valor from '../models/Valor.js';
import ValorLog from '../models/ValorLog.js';

export default {
  data: new SlashCommandBuilder()
    .setName('commend')
    .setDescription('Add valor to a user. (LT only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to commend').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Amount of valor to add').setRequired(true).setMinValue(1))
    .addStringOption(opt =>
      opt.setName('note').setDescription('Optional reason')),

  async execute(interaction) {
    if (!await isLT(interaction.member)) {
      return interaction.reply({ content: 'You need the Loreteam role to use this command.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const note   = interaction.options.getString('note') || '';

    if (target.bot) {
      return interaction.reply({ content: 'You cannot add valor to a bot.', ephemeral: true });
    }

    await interaction.deferReply();

    const record = await Valor.findOneAndUpdate(
      { userId: target.id, guildId: interaction.guildId },
      { $inc: { valor: amount } },
      { upsert: true, new: true }
    );

    await ValorLog.create({
      guildId:    interaction.guildId,
      userId:     target.id,
      executorId: interaction.user.id,
      action:     'ADD',
      amount,
      note,
    });

    const embed = new EmbedBuilder()
      .setColor(0x00c2a8)
      .setTitle('Valor Added')
      .addFields(
        { name: 'User',         value: `<@${target.id}>`,           inline: true },
        { name: 'Amount Added', value: `+${amount}`,                inline: true },
        { name: 'Total Valor',  value: `${record.valor}`,           inline: true },
        { name: 'By',           value: `<@${interaction.user.id}>`, inline: true },
      )
      .setFooter({ text: note ? `Note: ${note}` : 'No note provided.' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await sendToValorChannel(interaction.client, interaction.guildId, embed);
  },
};
