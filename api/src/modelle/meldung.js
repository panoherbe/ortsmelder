import mongoose from 'mongoose';
import { KATEGORIE_IDS, STATUS_IDS } from '../fachlich.js';

const punktSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }, // GeoJSON order: longitude, latitude
  },
  { _id: false },
);

const meldungSchema = new mongoose.Schema(
  {
    vorgangscode: { type: String, required: true, unique: true },
    kategorie: { type: String, enum: KATEGORIE_IDS, required: true },
    beschreibung: { type: String, required: true, maxlength: 1000 },
    ort: {
      punkt: { type: punktSchema, required: true },
      name: { type: String, required: true },
      hinweis: { type: String, maxlength: 120 },
    },
    status: { type: String, enum: STATUS_IDS, default: 'neu', required: true },
    antwort: { type: String, maxlength: 1000 },
    verlauf: [
      {
        _id: false,
        am: { type: Date, required: true },
        status: { type: String, enum: STATUS_IDS, required: true },
        antwort: String,
      },
    ],
    erledigtAm: Date,
  },
  { timestamps: { createdAt: 'eingegangenAm', updatedAt: 'geaendertAm' } },
);

meldungSchema.index({ 'ort.punkt': '2dsphere' });
meldungSchema.index({ status: 1, eingegangenAm: -1 });
meldungSchema.index({ kategorie: 1, eingegangenAm: -1 });
meldungSchema.index(
  { beschreibung: 'text', 'ort.name': 'text', 'ort.hinweis': 'text' },
  { name: 'suche', default_language: 'german' },
);

export const Meldung = mongoose.model('Meldung', meldungSchema, 'meldungen');
