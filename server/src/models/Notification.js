import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'account',
  'tournament',
  'match',
  'result',
  'reminder',
  'announcement',
  'system',
];

const NINETY_DAYS = 90 * 24 * 60 * 60;

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 500, default: '' },
    // A path inside the app, such as /matches/123. Never an outside address.
    link: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
      validate: {
        validator: (value) => value === '' || (value.startsWith('/') && !value.startsWith('//')),
        message: 'link must be a path inside the app',
      },
    },
    readAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
// Old notifications clean themselves up.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NINETY_DAYS });

export default mongoose.model('Notification', notificationSchema);
