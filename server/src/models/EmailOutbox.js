import mongoose from 'mongoose';

const THIRTY_DAYS = 30 * 24 * 60 * 60;

// Emails waiting to go out. Requests only add a row here; a background worker sends them, so a
// slow or broken mail server never slows a request down, and failed sends are retried.
const outboxSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    to: { type: String, required: true },
    subject: { type: String, required: true, maxlength: 200 },
    html: { type: String, required: true },
    text: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: { type: String, default: '' },
    sentAt: Date,
  },
  { timestamps: true }
);

outboxSchema.index({ status: 1, nextAttemptAt: 1 });
// Sent emails are kept for a month, then removed.
outboxSchema.index({ sentAt: 1 }, { expireAfterSeconds: THIRTY_DAYS });

export default mongoose.model('EmailOutbox', outboxSchema);
