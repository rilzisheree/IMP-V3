import pkg from 'mongoose';
const { Schema, model, models } = pkg;

const valorChannelSchema = new Schema({
  guildId:   { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
}, { timestamps: true });

export default models.ValorChannel || model('ValorChannel', valorChannelSchema);
