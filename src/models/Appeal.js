import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema({
  userId:  { type: String, required: true },
  userTag: { type: String, required: true },
}, { _id: false });

const appealSchema = new mongoose.Schema({
  guildId:       { type: String, required: true },
  userId:        { type: String, required: true },
  userTag:       { type: String, required: true },
  type:          { type: String, enum: ['ban', 'void'], required: true },
  status:        { type: String, enum: ['pending', 'review', 'approved', 'denied'], default: 'pending' },

  staffMessageId:  { type: String, default: '' },
  staffChannelId:  { type: String, default: '' },

  // Ban appeal fields
  banUsername:    { type: String, default: '' },
  banReason:      { type: String, default: '' },
  whyUnban:       { type: String, default: '' },
  banAdditional:  { type: String, default: '' },

  // Void appeal fields
  loreName:       { type: String, default: '' },
  voidUsername:   { type: String, default: '' },
  whatHappened:   { type: String, default: '' },
  evidence:       { type: String, default: '' },
  whyVoid:        { type: String, default: '' },

  // Voting
  votesYes: [voteSchema],
  votesNo:  [voteSchema],

  // Audit trail
  reviewedById:  { type: String, default: '' },
  reviewedByTag: { type: String, default: '' },
  decidedById:   { type: String, default: '' },
  decidedByTag:  { type: String, default: '' },
}, { timestamps: true });

appealSchema.index({ guildId: 1, status: 1 });
appealSchema.index({ userId: 1 });

export default mongoose.model('Appeal', appealSchema);
