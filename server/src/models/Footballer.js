import mongoose from 'mongoose';
import { RATING_MAX, RATING_MIN } from '../config/limits.js';

export const POSITIONS = [
  'GK',
  'CB',
  'LB',
  'RB',
  'DMF',
  'CMF',
  'AMF',
  'LMF',
  'RMF',
  'LWF',
  'RWF',
  'SS',
  'CF',
];

// A member of a team's squad. (Not to be confused with a league "player", which is a user.)
const footballerSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    nameKey: { type: String, required: true },
    position: { type: String, enum: POSITIONS, required: true },
    rating: {
      type: Number,
      required: true,
      min: RATING_MIN,
      max: RATING_MAX,
      validate: { validator: Number.isInteger, message: 'Rating must be a whole number' },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.nameKey;
        delete ret.__v;
        return ret;
      },
    },
  }
);

footballerSchema.index({ team: 1, nameKey: 1 }, { unique: true });

footballerSchema.pre('validate', async function setNameKey() {
  if (this.name) this.nameKey = this.name.trim().toLowerCase();
});

export default mongoose.model('Footballer', footballerSchema);
