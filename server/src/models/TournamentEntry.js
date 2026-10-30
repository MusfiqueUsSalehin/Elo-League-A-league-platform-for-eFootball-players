import mongoose from 'mongoose';

export const ENTRY_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'];

// A team's place in a competition. `owner` is the manager who entered it.
const entrySchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ENTRY_STATUSES, default: 'pending' },
    seed: { type: Number, default: null },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

entrySchema.index({ tournament: 1, team: 1 }, { unique: true });
entrySchema.index({ tournament: 1, status: 1 });
entrySchema.index({ owner: 1 });

export default mongoose.model('TournamentEntry', entrySchema);
