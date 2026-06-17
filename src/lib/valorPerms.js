import { OWNER_IDS } from '../config.js';
import LoreteamRole from '../models/LoreteamRole.js';

export function isOwner(userId) {
  return OWNER_IDS.includes(userId);
}

export async function isLT(member) {
  if (isOwner(member.id)) return true;
  const doc = await LoreteamRole.findOne({ guildId: member.guild.id });
  if (!doc) return false;
  return member.roles.cache.has(doc.roleId);
}
