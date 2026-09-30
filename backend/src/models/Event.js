import mongoose from 'mongoose';

const inviteeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    name: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'tentative'],
      default: 'pending',
    },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    eventDate: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    endDate: { type: Date },
    location: {
      type: String,
      trim: true,
      maxlength: [500, 'Location cannot exceed 500 characters'],
    },
    isVirtual: { type: Boolean, default: false },
    meetingLink: { type: String, trim: true },
    invitees: {
      type: [String],
      validate: {
        validator: (arr) => arr.every((e) => /^\S+@\S+\.\S+$/.test(e)),
        message: 'All invitees must be valid email addresses',
      },
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sent', 'cancelled'],
      default: 'draft',
    },
    googleCalendarEventId: { type: String },
    // Placeholder for future auth: owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────
eventSchema.index({ eventDate: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ createdAt: -1 });

// ─── Virtual ──────────────────────────────────────────────
eventSchema.virtual('inviteeCount').get(function () {
  return this.invitees?.length ?? 0;
});

const Event = mongoose.model('Event', eventSchema);
export default Event;
