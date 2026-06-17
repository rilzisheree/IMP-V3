import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { OWNER_IDS } from '../config.js';

// Add each affiliated server here — 'guildId': 'roleId'
// The bot will only assign the role in servers listed here.
const GUILD_ROLE_MAP = {
  // '1234567890123456789': '9876543210987654321',  // Server Name — Staff Role
  // '1111111111111111111': '2222222222222222222',  // Server Name — Staff Role
};

export const data = new SlashCommandBuilder()
  .setName('staff')
  .setDescription('Grant a user the staff role across all affiliated servers (Owner only)')
  .addUserOption(opt =>
    opt.setName('user')
      .setDescription('User to grant staff in all servers')
      .setRequired(true)
  );

export async function execute(interaction) {
  if (!OWNER_IDS.includes(interaction.user.id)) {
    return interaction.reply({
      content: '❌ Only bot owners can use this command.',
      ephemeral: true,
    });
  }

  const target = interaction.options.getUser('user');
  await interaction.deferReply({ ephemeral: true });

  if (Object.keys(GUILD_ROLE_MAP).length === 0) {
    return interaction.editReply({
      content: '⚠️ No servers configured in `GUILD_ROLE_MAP`. Open `staff.js` and add your guild ID + role ID pairs.',
    });
  }

  let granted = 0;
  let failed  = 0;
  let skipped = 0;
  const details = [];

  for (const guild of interaction.client.guilds.cache.values()) {
    const roleId = GUILD_ROLE_MAP[guild.id];

    if (!roleId) {
      skipped++;
      continue;
    }

    try {
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        details.push(`❌ **${guild.name}** — user not in server`);
        failed++;
        continue;
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        details.push(`❌ **${guild.name}** — role not found`);
        failed++;
        continue;
      }

      await member.roles.add(roleId, `Staff granted by ${interaction.user.tag} via /staff`);
      details.push(`✅ **${guild.name}** — granted ${role.name}`);
      granted++;
    } catch (err) {
      details.push(`❌ **${guild.name}** — ${err.message}`);
      failed++;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0xF5C400)
    .setTitle('Staff Role Granted')
    .setDescription(`Results for **${target.tag}**:`)
    .addFields(
      { name: 'Granted', value: `${granted} server(s)`, inline: true },
      { name: 'Failed',  value: `${failed} server(s)`,  inline: true },
      { name: 'Skipped', value: `${skipped} server(s) (not configured)`, inline: true },
    )
    .setTimestamp();

  if (details.length > 0) {
    embed.addFields({ name: 'Details', value: details.join('\n').slice(0, 1024) });
  }

  await interaction.editReply({ embeds: [embed] });
}
