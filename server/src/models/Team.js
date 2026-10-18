import mongoose from 'mongoose';

// The formations a team can use. The client draws each one, so keep this list in step with
// client/src/lib/formations.js (a test checks they match).
export const FORMATION_KEYS = [
  '4-3-3',
  '4-4-2',
  '4-2-3-1',
  '3-5-2',
  '4-1-4-1',
  '5-3-2',
  '3-4-3',
  '4-3-2-1',
];

const starterSchema = new mongoose.Schema(
  {
    slot: { type: Number, required: true, min: 0, max: 10 },
    footballer: { type: mongoose.Schema.Types.ObjectId, ref: 'Footballer', required: true },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    // Lower-case copy of the name, so "Red Devils" and "red devils" count as the same team.
    nameKey: { type: String, required: true },
    formation: { type: String, enum: FORMATION_KEYS, default: '4-3-3' },
    lineup: { type: [starterSchema], default: [] },
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

teamSchema.index({ owner: 1, nameKey: 1 }, { unique: true });

teamSchema.pre('validate', async function setNameKey() {
  if (this.name) this.nameKey = this.name.trim().toLowerCase();
});

export default mongoose.model('Team', teamSchema);
