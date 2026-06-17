import pkg from 'mongoose';
const { Schema, model, models } = pkg;

const inventorySchema = new Schema({
  userId:  { type: String, required: true },
  guildId: { type: String, required: true },
  items:   [{ name: String, quantity: { type: Number, default: 1 } }],
}, { timestamps: true });

inventorySchema.index({ userId: 1, guildId: 1 }, { unique: true });

export default models.Inventory || model('Inventory', inventorySchema);
