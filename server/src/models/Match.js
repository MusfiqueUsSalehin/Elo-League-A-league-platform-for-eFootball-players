import mongoose from 'mongoose';

export const MATCH_STATUSES = [
  'scheduled',
  'live',
  'awaiting_confirmation',
  'completed',
  'cancelled',
];

const link = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, default: null });
const goals = () => ({
  home: { type: Number, min: 0, max: 99, default: null },
  away: { type: Number, min: 0, max: 99, default: null },
});

const matchSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    round: { type: Number, required: true, min: 1 },
    roundName: { type: String, required: true },
    leg: { type: Number, enum: [1, 2], default: 1 },
    number: { type: Number, required: true, min: 1 },

    // Empty in a cup round whose opponents are not known yet.
    homeTeam: link('Team'),
    awayTeam: link('Team'),
    homeUser: link('User'),
    awayUser: link('User'),

    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: MATCH_STATUSES, default: 'scheduled' },
    score: goals(),
    penalties: goals(),

    // Cup only: the match the winner moves into, and which side they take.
    nextMatch: link('Match'),
    nextSlot: { type: String, enum: ['home', 'away'], default: null },
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

matchSchema.index({ tournament: 1, round: 1, number: 1 }, { unique: true });
matchSchema.index({ homeUser: 1, scheduledAt: 1 });
matchSchema.index({ awayUser: 1, scheduledAt: 1 });
matchSchema.index({ scheduledAt: 1, status: 1 });

export default mongoose.model('Match', matchSchema);
