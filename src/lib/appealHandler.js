import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import Appeal from '../models/Appeal.js';

function statusColor(status) {
  return { pending: 0xF5C400, review: 0xF0A500, approved: 0x2ECC71, denied: 0xE74C3C }[status] ?? 0xF5C400;
}

function statusLabel(status) {
  return { pending: 'Pending', review: 'Under Review', approved: 'Approved', denied: 'Denied' }[status] ?? status;
}

function buildStaffButtons(appealId, status) {
  const id = appealId.toString();
  const isFinished = status === 'approved' || status === 'denied';

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ar:${id}`)
      .setLabel('Under Review')
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(status !== 'pending'),
    new ButtonBuilder()
      .setCustomId(`ay:${id}`)
      .setLabel('Vote Yes')
      .setEmoji('👍')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isFinished),
    new ButtonBuilder()
      .setCustomId(`an:${id}`)
      .setLabel('Vote No')
      .setEmoji('👎')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isFinished),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`aa:${id}`)
      .setLabel('End Vote — Approve')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isFinished),
    new ButtonBuilder()
      .setCustomId(`ad:${id}`)
      .setLabel('End Vote — Deny')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isFinished),
  );

  return [row1, row2];
}

function buildBanStaffEmbed(appeal) {
  const yesVoters = appeal.votesYes.length ? appeal.votesYes.map(v => v.userTag).join(', ') : 'None';
  const noVoters  = appeal.votesNo.length  ? appeal.votesNo.map(v => v.userTag).join(', ')  : 'None';

  return new EmbedBuilder()
    .setColor(statusColor(appeal.status))
    .setTitle('Ban Appeal')
    .setDescription(`Submitted by <@${appeal.userId}> (\`${appeal.userTag}\`)`)
    .addFields(
      { name: 'Username',        value: appeal.banUsername    || '—', inline: true  },
      { name: 'Status',          value: statusLabel(appeal.status),   inline: true  },
      { name: '\u200b',          value: '\u200b',                      inline: false },
      { name: 'Reason for Ban',  value: appeal.banReason      || '—', inline: false },
      { name: 'Why Unban?',      value: appeal.whyUnban       || '—', inline: false },
      { name: 'Additional Info', value: appeal.banAdditional  || '—', inline: false },
      { name: `Yes (${appeal.votesYes.length})`, value: yesVoters, inline: true  },
      { name: `No (${appeal.votesNo.length})`,   value: noVoters,  inline: true  },
    )
    .setFooter({
      text: appeal.decidedByTag
        ? `Decided by ${appeal.decidedByTag}`
        : appeal.reviewedByTag
        ? `Reviewing: ${appeal.reviewedByTag}`
        : 'Awaiting staff review',
    })
    .setTimestamp();
}

function buildVoidStaffEmbed(appeal) {
  const yesVoters = appeal.votesYes.length ? appeal.votesYes.map(v => v.userTag).join(', ') : 'None';
  const noVoters  = appeal.votesNo.length  ? appeal.votesNo.map(v => v.userTag).join(', ')  : 'None';

  return new EmbedBuilder()
    .setColor(statusColor(appeal.status))
    .setTitle('Void Appeal')
    .setDescription(`Submitted by <@${appeal.userId}> (\`${appeal.userTag}\`)`)
    .addFields(
      { name: 'Lore Name',      value: appeal.loreName      || '—', inline: true  },
      { name: 'Username',       value: appeal.voidUsername  || '—', inline: true  },
      { name: 'Status',         value: statusLabel(appeal.status),  inline: true  },
      { name: 'What Happened',  value: appeal.whatHappened  || '—', inline: false },
      { name: 'Evidence / Clips', value: appeal.evidence    || '—', inline: false },
      { name: 'Why Void?',      value: appeal.whyVoid       || '—', inline: false },
      { name: `Yes (${appeal.votesYes.length})`, value: yesVoters, inline: true  },
      { name: `No (${appeal.votesNo.length})`,   value: noVoters,  inline: true  },
    )
    .setFooter({
      text: appeal.decidedByTag
        ? `Decided by ${appeal.decidedByTag}`
        : appeal.reviewedByTag
        ? `Reviewing: ${appeal.reviewedByTag}`
        : 'Awaiting staff review',
    })
    .setTimestamp();
}

async function updateStaffMessage(client, appeal) {
  try {
    const channel = await client.channels.fetch(appeal.staffChannelId);
    const msg     = await channel.messages.fetch(appeal.staffMessageId);
    const embed   = appeal.type === 'ban' ? buildBanStaffEmbed(appeal) : buildVoidStaffEmbed(appeal);
    await msg.edit({ embeds: [embed], components: buildStaffButtons(appeal._id, appeal.status) });
  } catch (err) {
    console.error('Appeal staff message update error:', err.message);
  }
}

export async function handleAppealInteraction(interaction) {

  if (interaction.isButton() && interaction.customId === 'appeal_open_ban') {
    const existing = await Appeal.findOne({ userId: interaction.user.id, status: { $in: ['pending', 'review'] } });
    if (existing) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xF5C400).setDescription('You already have an active appeal pending. Please wait for it to be resolved.')],
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('appeal_modal_ban')
      .setTitle('Ban Appeal');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ban_username').setLabel('Your Username').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ban_reason').setLabel('What was the reason for your ban?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ban_why_unban').setLabel('Why should you be unbanned?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ban_additional').setLabel('Any additional details?').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
      ),
    );

    return interaction.showModal(modal);
  }

  if (interaction.isButton() && interaction.customId === 'appeal_open_void') {
    const existing = await Appeal.findOne({ userId: interaction.user.id, status: { $in: ['pending', 'review'] } });
    if (existing) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xF5C400).setDescription('You already have an active appeal pending. Please wait for it to be resolved.')],
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('appeal_modal_void')
      .setTitle('Void Appeal');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('void_lorename').setLabel('Your Lore Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('void_username').setLabel('Your Username').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('void_what_happened').setLabel('Explain what happened').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('void_evidence').setLabel('Evidence / Clips (required)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('void_why_void').setLabel('Why should you be voided?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
      ),
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'appeal_modal_ban') {
    await interaction.deferReply({ ephemeral: true });

    const appeal = await Appeal.create({
      guildId:      interaction.guildId,
      userId:       interaction.user.id,
      userTag:      interaction.user.tag,
      type:         'ban',
      banUsername:  interaction.fields.getTextInputValue('ban_username'),
      banReason:    interaction.fields.getTextInputValue('ban_reason'),
      whyUnban:     interaction.fields.getTextInputValue('ban_why_unban'),
      banAdditional:interaction.fields.getTextInputValue('ban_additional') || '—',
    });

    const channelId = process.env.APPEAL_BAN_CHANNEL_ID;
    if (!channelId) {
      return interaction.editReply({ content: 'Ban appeal channel is not configured. Contact an admin.' });
    }

    try {
      const staffChannel = await interaction.client.channels.fetch(channelId);
      const staffEmbed   = buildBanStaffEmbed(appeal);
      const msg = await staffChannel.send({ embeds: [staffEmbed], components: buildStaffButtons(appeal._id, 'pending') });

      appeal.staffMessageId = msg.id;
      appeal.staffChannelId = channelId;
      await appeal.save();
    } catch (err) {
      return interaction.editReply({ content: `Could not post your appeal to staff: ${err.message}` });
    }

    await interaction.user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xF5C400)
          .setTitle('Ban Appeal Submitted')
          .setDescription(
            `Your ban appeal has been **received** and is now awaiting staff review.\n\n` +
            `You will be notified here when the status of your appeal changes.\n\n` +
            `*Please be patient — staff review all appeals thoroughly.*`
          )
          .setTimestamp(),
      ],
    }).catch(() => {});

    return interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xF5C400).setDescription('Your ban appeal has been submitted. You will receive a DM with updates.')],
    });
  }

  if (interaction.isModalSubmit() && interaction.customId === 'appeal_modal_void') {
    await interaction.deferReply({ ephemeral: true });

    const appeal = await Appeal.create({
      guildId:      interaction.guildId,
      userId:       interaction.user.id,
      userTag:      interaction.user.tag,
      type:         'void',
      loreName:     interaction.fields.getTextInputValue('void_lorename'),
      voidUsername: interaction.fields.getTextInputValue('void_username'),
      whatHappened: interaction.fields.getTextInputValue('void_what_happened'),
      evidence:     interaction.fields.getTextInputValue('void_evidence'),
      whyVoid:      interaction.fields.getTextInputValue('void_why_void'),
    });

    const channelId = process.env.APPEAL_VOID_CHANNEL_ID;
    if (!channelId) {
      return interaction.editReply({ content: 'Void appeal channel is not configured. Contact an admin.' });
    }

    try {
      const staffChannel = await interaction.client.channels.fetch(channelId);
      const staffEmbed   = buildVoidStaffEmbed(appeal);
      const msg = await staffChannel.send({ embeds: [staffEmbed], components: buildStaffButtons(appeal._id, 'pending') });

      appeal.staffMessageId = msg.id;
      appeal.staffChannelId = channelId;
      await appeal.save();
    } catch (err) {
      return interaction.editReply({ content: `Could not post your appeal to staff: ${err.message}` });
    }

    await interaction.user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xF5C400)
          .setTitle('Void Appeal Submitted')
          .setDescription(
            `Your void appeal has been **received** and is now awaiting staff review.\n\n` +
            `You will be notified here when the status of your appeal changes.\n\n` +
            `*Please be patient — staff review all appeals thoroughly.*`
          )
          .setTimestamp(),
      ],
    }).catch(() => {});

    return interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xF5C400).setDescription('Your void appeal has been submitted. You will receive a DM with updates.')],
    });
  }

  if (!interaction.isButton()) return false;

  const { customId } = interaction;
  const prefix = customId.split(':')[0];
  const appealId = customId.split(':')[1];

  if (!['ar', 'ay', 'an', 'aa', 'ad'].includes(prefix)) return false;

  const appeal = await Appeal.findById(appealId);
  if (!appeal) {
    return interaction.reply({ content: 'This appeal no longer exists.', ephemeral: true });
  }

  if (appeal.status === 'approved' || appeal.status === 'denied') {
    return interaction.reply({ content: 'This appeal has already been finalised.', ephemeral: true });
  }

  await interaction.deferUpdate();

  if (prefix === 'ar') {
    appeal.status        = 'review';
    appeal.reviewedById  = interaction.user.id;
    appeal.reviewedByTag = interaction.user.tag;
    await appeal.save();
    await updateStaffMessage(interaction.client, appeal);

    await interaction.client.users.fetch(appeal.userId).then(u =>
      u.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF0A500)
            .setTitle('Appeal — Under Review')
            .setDescription(
              `Your **${appeal.type === 'ban' ? 'ban' : 'void'} appeal** is now being reviewed by staff.\n\n` +
              `This process may take up to **24 hours** or longer depending on staff availability. ` +
              `You will be notified once a decision has been made.`
            )
            .setTimestamp(),
        ],
      })
    ).catch(() => {});

    return;
  }

  if (prefix === 'ay') {
    appeal.votesNo  = appeal.votesNo.filter(v => v.userId !== interaction.user.id);
    if (!appeal.votesYes.some(v => v.userId === interaction.user.id)) {
      appeal.votesYes.push({ userId: interaction.user.id, userTag: interaction.user.tag });
    }
    await appeal.save();
    await updateStaffMessage(interaction.client, appeal);
    return;
  }

  if (prefix === 'an') {
    appeal.votesYes = appeal.votesYes.filter(v => v.userId !== interaction.user.id);
    if (!appeal.votesNo.some(v => v.userId === interaction.user.id)) {
      appeal.votesNo.push({ userId: interaction.user.id, userTag: interaction.user.tag });
    }
    await appeal.save();
    await updateStaffMessage(interaction.client, appeal);
    return;
  }

  if (prefix === 'aa') {
    appeal.status       = 'approved';
    appeal.decidedById  = interaction.user.id;
    appeal.decidedByTag = interaction.user.tag;
    await appeal.save();
    await updateStaffMessage(interaction.client, appeal);

    const isBan = appeal.type === 'ban';

    await interaction.client.users.fetch(appeal.userId).then(u =>
      u.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle(isBan ? 'Ban Appeal — Approved' : 'Void Appeal — Approved')
            .setDescription(
              isBan
                ? `Your **ban appeal** has been **approved** by IMPERIUM Staff.\n\nYou may now rejoin the server. Welcome back.`
                : `Your **void appeal** has been **approved** by IMPERIUM Staff.\n\nYour character will be voided. **To complete the void in-game, please open a Staff ticket in the server so a Staff Member can process it.**`
            )
            .setFooter({ text: `Decision by ${appeal.decidedByTag}` })
            .setTimestamp(),
        ],
      })
    ).catch(() => {});

    return;
  }

  if (prefix === 'ad') {
    appeal.status       = 'denied';
    appeal.decidedById  = interaction.user.id;
    appeal.decidedByTag = interaction.user.tag;
    await appeal.save();
    await updateStaffMessage(interaction.client, appeal);

    const isBan = appeal.type === 'ban';

    await interaction.client.users.fetch(appeal.userId).then(u =>
      u.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle(isBan ? 'Ban Appeal — Denied' : 'Void Appeal — Denied')
            .setDescription(
              isBan
                ? `Your **ban appeal** has been **denied** by IMPERIUM Staff.\n\nIf you believe this decision was made in error, please contact a Staff Member directly.`
                : `Your **void appeal** has been **denied** by IMPERIUM Staff.\n\nIf you believe this decision was made in error, please contact a Staff Member directly.`
            )
            .setFooter({ text: `Decision by ${appeal.decidedByTag}` })
            .setTimestamp(),
        ],
      })
    ).catch(() => {});

    return;
  }

  return false;
}
