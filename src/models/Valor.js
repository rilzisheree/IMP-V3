import pkg from 'mongoose';
const { Schema, model, models } = pkg;

const valorSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  valor:  { type: Number, default: 0 },
}, { timestamps: true });

export default models.Valor || model('Valor', valorSchema);
