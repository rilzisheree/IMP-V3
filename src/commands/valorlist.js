import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isLT } from '../lib/valorPerms.js';
import Valor from '../models/Valor.js';

export default {
  data: new SlashCommandBuilder()
    .setName('valorlist')
    .setDescription('List all users who have valor, sorted highest to lowest. (LT only)'),

  async execute(interaction) {
    if (!await isLT(interaction.member)) {
      return interaction.reply({ content: 'You need the Loreteam role to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const records = await Valor.find({ valor: { $gt: 0 } })
      .sort({ valor: -1 })
      .lean();

    if (!records.length) {
      return interaction.editReply({ content: 'No users currently have any valor.' });
    }

    // Discord embed descriptions cap at 4096 chars — chunk into pages of 25.
    const pageSize = 25;
    const page     = records.slice(0, pageSize);
    const overflow = records.length > pageSize;

    const lines = page.map((r, i) =>
      `\`${String(i + 1).padStart(2, ' ')}.\` <@${r.userId}> — **${r.valor}**`
    );

    const embed = new EmbedBuilder()
      .setColor(0x00c2a8)
      .setTitle('Valor — All Users')
      .setDescription(lines.join('\n'))
      .setFooter({
        text: overflow
          ? `Showing top ${pageSize} of ${records.length} users`
          : `${records.length} user${records.length === 1 ? '' : 's'} total`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
