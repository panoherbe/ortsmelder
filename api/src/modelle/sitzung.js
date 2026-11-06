import mongoose from 'mongoose';

const sitzungSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  abgelaufenAm: { type: Date, required: true },
});

// MongoDB removes a session on its own once this date has passed.
sitzungSchema.index({ abgelaufenAm: 1 }, { expireAfterSeconds: 0 });

export const Sitzung = mongoose.model('Sitzung', sitzungSchema, 'sitzungen');
