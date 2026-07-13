import pkg from 'mongoose';
const { Schema, model, models } = pkg;

const inventorySchema = new Schema({
  userId: { type: String, required: true, unique: true },
  items:  [{ name: String, quantity: { type: Number, default: 1 } }],
}, { timestamps: true });

export default models.Inventory || model('Inventory', inventorySchema);
