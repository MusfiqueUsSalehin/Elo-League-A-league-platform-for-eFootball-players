import mongoose from 'mongoose';

export const FORMATS = ['league', 'knockout'];
export const STATUSES = ['draft', 'registration', 'active', 'completed', 'cancelled'];

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    // Lower-case copy of the name, so two competitions cannot differ only by letter case.
    nameKey: { type: String, required: true, unique: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    format: { type: String, enum: FORMATS, required: true },
    // League only: 1 = everyone plays everyone once, 2 = home and away.
    legs: { type: Number, enum: [1, 2], default: 1 },
    maxTeams: { type: Number, required: true, min: 2, max: 64, validate: Number.isInteger },
    requiresApproval: { type: Boolean, default: true },
    registrationDeadline: { type: Date, default: null },
    startsAt: { type: Date, default: null },
    status: { type: String, enum: STATUSES, default: 'draft' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

tournamentSchema.pre('validate', async function setNameKey() {
  if (this.name) this.nameKey = this.name.trim().toLowerCase();
});

export default mongoose.model('Tournament', tournamentSchema);
