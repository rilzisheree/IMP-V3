import pkg from 'mongoose';
const { Schema, model, models } = pkg;

const shopItemSchema = new Schema({
  guildId:     { type: String, required: true },
  name:        { type: String, required: true },
  price:       { type: Number, required: true },
  description: { type: String, default: '' },
}, { timestamps: true });

shopItemSchema.index({ guildId: 1, name: 1 }, { unique: true });

export default models.ShopItem || model('ShopItem', shopItemSchema);
