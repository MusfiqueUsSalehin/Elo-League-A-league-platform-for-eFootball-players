import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from './Notification.js';

const emailShape = Object.fromEntries(
  NOTIFICATION_TYPES.map((type) => [type, { type: Boolean, default: true }])
);

// Which kinds of notification a person also wants by email. Everything is on until they say
// otherwise, and a person with no saved preferences gets the defaults.
const preferenceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    email: { type: new mongoose.Schema(emailShape, { _id: false }), default: () => ({}) },
  },
  {
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const defaultEmailPreferences = () =>
  Object.fromEntries(NOTIFICATION_TYPES.map((type) => [type, true]));

export default mongoose.model('NotificationPreference', preferenceSchema);
