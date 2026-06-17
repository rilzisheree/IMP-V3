import pkg from 'mongoose';
const { Schema, model, models } = pkg;

const loreteamRoleSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  roleId:  { type: String, required: true },
}, { timestamps: true });

export default models.LoreteamRole || model('LoreteamRole', loreteamRoleSchema);
