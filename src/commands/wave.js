import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { hasPermission } from '../lib/permissions.js';

const WAVE_ROLE_ID   = '1463028818275991685';
const UNWAVE_ROLE_ID = '1444837994270822452';

export const data = new SlashCommandBuilder()
  .setName('wave')
  .setDescription('Wave a user into IMPERIUM — grants access and sends them the welcome embed')
  .addUserOption(opt =>
    opt.setName('user')
      .setDescription('The member to wave in (mention)')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt.setName('user_id')
      .setDescription('User ID to wave in (use if you cannot mention them)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const allowed = await hasPermission(interaction, 'wave');
  if (!allowed) {
    return interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true,
    });
  }

  const mentionedUser = interaction.options.getUser('user');
  const rawId         = interaction.options.getString('user_id')?.trim();

  if (!mentionedUser && !rawId) {
    return interaction.reply({
      content: '❌ You must provide either a user mention or a user ID.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;

  // Resolve user object (needed for DM)
  let target = mentionedUser;
  if (!target) {
    try {
      target = await interaction.client.users.fetch(rawId);
    } catch {
      return interaction.editReply({ content: `❌ Could not find a user with ID \`${rawId}\`. Double-check the ID and try again.` });
    }
  }

  const member = await guild.members.fetch(target.id).catch(() => null);
  if (!member) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xF5C400)
          .setDescription(`❌ **${target.tag}** is not in this server.`),
      ],
    });
  }

  const errors = [];

  if (guild.members.me.roles.highest.comparePositionTo(
    guild.roles.cache.get(WAVE_ROLE_ID) ?? { position: 0 }
  ) > 0) {
    await member.roles.add(WAVE_ROLE_ID, `Waved in by ${interaction.user.tag}`).catch(e => {
      errors.push(`Could not add wave role: ${e.message}`);
    });
  } else {
    errors.push('Bot role is too low to assign the wave role.');
  }

  await member.roles.remove(UNWAVE_ROLE_ID, `Waved in by ${interaction.user.tag}`).catch(() => {});

  const guildIcon = guild.iconURL({ dynamic: true, size: 256 });

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0xF5C400)
    .setTitle('You have been waved in IMPERIUM!')
    .setThumbnail(guildIcon)
    .setDescription(
      `Welcome to **IMPERIUM!** **IMPERIUM** is a **hardcore** game with **permanent death**. ` +
      `Losing characters is **part** of the experience.\n\n` +
      `You've been accepted and have been **waved**, and now have **full access** to join IMPERIUM.`
    )
    .addFields({
      name: 'How to get started?',
      value:
        `Please read and follow the general and lore rules stated in the server. ` +
        `You may also ask for help from Staff Members or other community members.\n\n` +
        `Join the IMPERIUM-**affiliated servers**, such as "Lore Information" and "Support" servers, ` +
        `for further information.\n\n` +
        `We're excited to see the path you carve out in **IMPERIUM**. There's a lot ahead of you, ` +
        `and we can't wait to watch you **grow**, push your **limits**, and make your **mark**. ` +
        `Good luck, and **enjoy** every step of the journey!`,
    })
    .setFooter({ text: guild.name, iconURL: guildIcon ?? undefined })
    .setTimestamp();

  let dmFailed = false;
  try {
    await target.send({ embeds: [welcomeEmbed] });
  } catch {
    dmFailed = true;
  }

  const confirmEmbed = new EmbedBuilder()
    .setColor(0xF5C400)
    .setTitle('User Waved')
    .addFields(
      { name: 'Member',   value: `<@${target.id}> (\`${target.tag}\`)`, inline: true },
      { name: 'Waved by', value: `<@${interaction.user.id}>`,           inline: true },
      { name: 'Roles',    value: `Granted <@&${WAVE_ROLE_ID}> / Removed <@&${UNWAVE_ROLE_ID}>` },
    )
    .setTimestamp();

  if (dmFailed) {
    confirmEmbed.addFields({ name: '⚠️ DM', value: 'Could not DM the user — their DMs are likely closed.' });
  }

  if (errors.length) {
    confirmEmbed.addFields({ name: '⚠️ Errors', value: errors.join('\n') });
  }

  await interaction.editReply({ embeds: [confirmEmbed] });
}
