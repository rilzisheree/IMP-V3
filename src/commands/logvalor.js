import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isLT } from '../lib/valorPerms.js';
import ValorLog from '../models/ValorLog.js';

export default {
  data: new SlashCommandBuilder()
    .setName('logvalor')
    .setDescription('See valor changes in the last 24 hours. (LT only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Filter by a specific user (optional)')),

  async execute(interaction) {
    if (!await isLT(interaction.member)) {
      return interaction.reply({ content: 'You need the Loreteam role to use this command.', ephemeral: true });
    }

    await interaction.deferReply();

    const since      = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filterUser = interaction.options.getUser('user');

    const query = { guildId: interaction.guildId, timestamp: { $gte: since } };
    if (filterUser) query.userId = filterUser.id;

    const logs = await ValorLog.find(query).sort({ timestamp: -1 }).limit(25);

    if (!logs.length) {
      return interaction.editReply({ content: 'No valor changes in the last 24 hours.' });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Valor Log — Last 24 Hours')
      .setDescription(
        logs.map(l => {
          const amt  = l.amount > 0 ? `+${l.amount}` : `${l.amount}`;
          const time = `<t:${Math.floor(l.timestamp.getTime() / 1000)}:R>`;
          const note = l.note ? ` — ${l.note}` : '';
          return `[${l.action}] <@${l.userId}> **${amt}** by <@${l.executorId}> ${time}${note}`;
        }).join('\n')
      )
      .setFooter({ text: `Up to 25 entries${filterUser ? ` for ${filterUser.username}` : ''}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
