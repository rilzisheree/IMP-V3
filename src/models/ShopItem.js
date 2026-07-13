import pkg from 'mongoose';
const { Schema, model, models } = pkg;

const shopItemSchema = new Schema({
  name:        { type: String, required: true, unique: true },
  price:       { type: Number, required: true },
  description: { type: String, default: '' },
}, { timestamps: true });

export default models.ShopItem || model('ShopItem', shopItemSchema);
