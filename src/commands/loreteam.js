import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { isOwner } from '../lib/valorPerms.js';
import LoreteamRole from '../models/LoreteamRole.js';

export default {
  data: new SlashCommandBuilder()
    .setName('loreteam')
    .setDescription('Set the Loreteam role for this server. (Bot owners only)')
    .addRoleOption(opt =>
      opt.setName('role').setDescription('The Loreteam role').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: 'Only bot owners can set the Loreteam role.', ephemeral: true });
    }

    const role = interaction.options.getRole('role');

    await interaction.deferReply();

    await LoreteamRole.findOneAndUpdate(
      { guildId: interaction.guildId },
      { roleId: role.id },
      { upsert: true }
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Loreteam Role Set')
      .setDescription(`Members with <@&${role.id}> now have access to all LT commands.`)
      .addFields(
        { name: 'Role',   value: `<@&${role.id}>`,           inline: true },
        { name: 'Set by', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
