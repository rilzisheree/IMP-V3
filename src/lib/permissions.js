import { OWNER_IDS } from '../config.js';
import AllowedUser from '../models/AllowedUser.js';

export async function hasPermission(interaction, commandName) {
  if (OWNER_IDS.includes(interaction.user.id)) return true;

  const record = await AllowedUser.findOne({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    command: commandName,
  });

  return !!record;
}
