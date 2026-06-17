import pkg from 'mongoose';
const { Schema, model, models } = pkg;

const valorLogSchema = new Schema({
  guildId:    { type: String, required: true },
  userId:     { type: String, required: true },
  executorId: { type: String, required: true },
  action:     { type: String, required: true },
  amount:     { type: Number, required: true },
  note:       { type: String, default: '' },
  timestamp:  { type: Date, default: Date.now },
});

valorLogSchema.index({ guildId: 1, timestamp: -1 });

export default models.ValorLog || model('ValorLog', valorLogSchema);
