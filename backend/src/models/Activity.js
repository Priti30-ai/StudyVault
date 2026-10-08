import mongoose from 'mongoose';

export const ALLOWED_ACTIONS = [
  'UPLOAD',
  'DOWNLOAD',
  'DELETE',
  'FAVORITE',
  'UNFAVORITE',
  'UPDATE'
];

const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document ID is required']
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: {
        values: ALLOWED_ACTIONS,
        message: '{VALUE} is not a valid activity action'
      }
    },
    fileName: {
      type: String,
      trim: true,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

// Indexes for fast user-scoped and action-scoped activity retrieval
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ userId: 1, action: 1, createdAt: -1 });

// Clean JSON serialization
activitySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

const Activity = mongoose.model('Activity', activitySchema);

export default Activity;
