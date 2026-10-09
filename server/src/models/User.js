import mongoose from 'mongoose';

export const ROLES = ['admin', 'user'];
export const PLATFORMS = ['PS5', 'PS4', 'Xbox', 'PC', 'Mobile', 'Other'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user' },

    konamiId: { type: String, trim: true, maxlength: 40, default: '' },
    platform: { type: String, enum: PLATFORMS, default: 'Mobile' },
    phone: { type: String, trim: true, maxlength: 30, default: '' },

    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
    // Embedded in every session token. Bumping it signs the user out everywhere.
    tokenVersion: { type: Number, default: 0 },

    elo: { type: Number, default: 1200 },
    peakElo: { type: Number, default: 1200 },

    lastLoginAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export default mongoose.model('User', userSchema);
