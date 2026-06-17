import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { hasPermission } from '../lib/permissions.js';
import Appeal from '../models/Appeal.js';

export const data = new SlashCommandBuilder()
  .setName('appeal')
  .setDescription('Manage the appeal panel')

  .addSubcommand(sub =>
    sub.setName('panel')
      .setDescription('Post the appeal panel in a channel')
      .addChannelOption(opt =>
        opt.setName('channel').setDescription('Channel to post the panel in').setRequired(true)
      )
  )

  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('View all active appeals in this server')
      .addStringOption(opt =>
        opt.setName('status')
          .setDescription('Filter by status (default: pending + review)')
          .setRequired(false)
          .addChoices(
            { name: 'Pending',      value: 'pending'  },
            { name: 'Under Review', value: 'review'   },
            { name: 'Approved',     value: 'approved' },
            { name: 'Denied',       value: 'denied'   },
            { name: 'All',          value: 'all'      },
          )
      )
      .addStringOption(opt =>
        opt.setName('type')
          .setDescription('Filter by appeal type')
          .setRequired(false)
          .addChoices(
            { name: 'Ban Appeals',  value: 'ban'  },
            { name: 'Void Appeals', value: 'void' },
          )
      )
  )

  .addSubcommand(sub =>
    sub.setName('close')
      .setDescription('Delete finished appeals from the database to free up space')
      .addStringOption(opt =>
        opt.setName('type')
          .setDescription('Which finished appeals to close (ignored if user is specified)')
          .setRequired(false)
          .addChoices(
            { name: 'All approved',        value: 'approved' },
            { name: 'All denied',          value: 'denied'   },
            { name: 'All finished (both)', value: 'finished' },
          )
      )
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Delete a specific user\'s appeal(s) instead of bulk clearing')
          .setRequired(false)
      )
  );

export async function execute(interaction) {
  const allowed = await hasPermission(interaction, 'appeal');
  if (!allowed) {
    return interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true,
    });
  }

  const sub = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });

  // ── PANEL ─────────────────────────────────────────────────────────────────
  if (sub === 'panel') {
    const channel   = interaction.options.getChannel('channel');
    const guildIcon = interaction.guild.iconURL({ dynamic: true, size: 256 });

    const panelEmbed = new EmbedBuilder()
      .setColor(0xF5C400)
      .setTitle('IMPERIUM — Appeal Centre')
      .setThumbnail(guildIcon)
      .setDescription(
        `If you have been **banned** or would like to appeal a **void**, you may submit an appeal below.\n\n` +
        `Please be **honest** and **detailed** in your responses. False or incomplete appeals will be denied.\n\n` +
        `⚔️ **Void Appeal** — Request to have your character voided.\n` +
        `🔨 **Ban Appeal** — Request to be unbanned from IMPERIUM.\n\n` +
        `*All appeals are reviewed by Staff. Results will be sent to you via DM.*`
      )
      .setFooter({ text: 'IMPERIUM Appeal System', iconURL: guildIcon ?? undefined })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('appeal_open_void')
        .setLabel('Void Appeal')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('appeal_open_ban')
        .setLabel('Ban Appeal')
        .setEmoji('🔨')
        .setStyle(ButtonStyle.Danger),
    );

    try {
      await channel.send({ embeds: [panelEmbed], components: [row] });
    } catch {
      return interaction.editReply({ content: `Could not post the panel in ${channel}. Check my permissions.` });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xF5C400)
          .setTitle('Appeal Panel Posted')
          .setDescription(`The appeal panel has been posted in ${channel}.`)
          .setTimestamp(),
      ],
    });
  }

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (sub === 'list') {
    const statusFilter = interaction.options.getString('status');
    const typeFilter   = interaction.options.getString('type');

    const query = { guildId: interaction.guildId };

    if (!statusFilter || statusFilter === 'all') {
      if (!statusFilter) query.status = { $in: ['pending', 'review'] };
    } else {
      query.status = statusFilter;
    }

    if (typeFilter) query.type = typeFilter;

    const appeals = await Appeal.find(query).sort({ createdAt: -1 }).limit(20).lean();

    if (!appeals.length) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF5C400)
            .setDescription('No appeals found matching those filters.'),
        ],
      });
    }

    const statusEmoji = { pending: '⏳', review: '🔍', approved: '✅', denied: '❌' };
    const typeLabel   = { ban: 'Ban', void: 'Void' };
    const statusColor = { pending: 0xF5C400, review: 0xF0A500, approved: 0x2ECC71, denied: 0xE74C3C };

    const lines = appeals.map(a => {
      const ts      = `<t:${Math.floor(new Date(a.createdAt).getTime() / 1000)}:R>`;
      const votes   = `Yes: ${a.votesYes.length} · No: ${a.votesNo.length}`;
      const name    = a.type === 'ban' ? a.banUsername : `${a.loreName} (${a.voidUsername})`;
      const jumpUrl = a.staffMessageId && a.staffChannelId
        ? ` · [Jump](https://discord.com/channels/${a.guildId}/${a.staffChannelId}/${a.staffMessageId})`
        : '';
      return (
        `${statusEmoji[a.status]} **[${typeLabel[a.type]}]** ${name} — <@${a.userId}>\n` +
        `┗ ${votes} · ${ts}${jumpUrl}`
      );
    });

    const label = statusFilter === 'all'
      ? 'All Appeals'
      : !statusFilter
      ? 'Active Appeals'
      : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Appeals`;

    const embed = new EmbedBuilder()
      .setColor(statusFilter && statusFilter !== 'all' ? statusColor[statusFilter] : 0xF5C400)
      .setTitle(`${label}${typeFilter ? ` — ${typeFilter === 'ban' ? 'Ban' : 'Void'}` : ''}`)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Showing ${appeals.length} result${appeals.length === 1 ? '' : 's'} · Most recent first` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ── CLOSE ─────────────────────────────────────────────────────────────────
  if (sub === 'close') {
    const type       = interaction.options.getString('type');
    const targetUser = interaction.options.getUser('user');
    const query      = { guildId: interaction.guildId };

    if (targetUser) {
      query.userId = targetUser.id;
    } else {
      if (!type) {
        return interaction.editReply({ content: 'Provide either a `type` to bulk clear or a `user` to clear a specific person.' });
      }
      if (type === 'finished') {
        query.status = { $in: ['approved', 'denied'] };
      } else {
        query.status = type;
      }
    }

    const { deletedCount } = await Appeal.deleteMany(query);

    if (deletedCount === 0) {
      const label = targetUser
        ? `any appeals for **${targetUser.tag}**`
        : `${type === 'finished' ? 'finished' : type} appeals`;
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xF5C400).setDescription(`No ${label} found to remove.`)],
      });
    }

    const label = targetUser
      ? `**${deletedCount}** appeal${deletedCount === 1 ? '' : 's'} for **${targetUser.tag}**`
      : `**${deletedCount}** ${type === 'finished' ? 'finished' : type} appeal${deletedCount === 1 ? '' : 's'}`;

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xF5C400)
          .setTitle('Appeals Cleared')
          .setDescription(`Removed ${label} from the database.`)
          .setTimestamp(),
      ],
    });
  }
}
