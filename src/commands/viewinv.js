import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isLT } from '../lib/valorPerms.js';
import Inventory from '../models/Inventory.js';

export default {
  data: new SlashCommandBuilder()
    .setName('viewinv')
    .setDescription('View a user\'s inventory. (LT only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to check').setRequired(true)),

  async execute(interaction) {
    if (!await isLT(interaction.member)) {
      return interaction.reply({ content: 'You need the Loreteam role to use this command.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    await interaction.deferReply({ ephemeral: true });

    const inv = await Inventory.findOne({ userId: target.id, guildId: interaction.guildId });
    const items = inv?.items ?? [];

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`${target.username}'s Inventory`)
      .setDescription(
        items.length
          ? items.map(i => `**${i.name}** x${i.quantity}`).join('\n')
          : 'This user has no items.'
      )
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
