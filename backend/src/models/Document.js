import mongoose from 'mongoose';

export const ALLOWED_CATEGORIES = [
  'Notes',
  'Assignment',
  'Question Paper',
  'Practical',
  'PPT',
  'Reference',
  'Other'
];

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    originalFileName: {
      type: String,
      required: [true, 'Original file name is required'],
      trim: true
    },
    s3Key: {
      type: String,
      default: null,
      trim: true
    },
    fileType: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    mimeType: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    fileSize: {
      type: Number,
      default: null
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true
    },
    semester: {
      type: String,
      required: [true, 'Semester is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ALLOWED_CATEGORIES,
        message: '{VALUE} is not an allowed document category'
      }
    },
    tags: {
      type: [String],
      default: []
    },
    isFavorite: {
      type: Boolean,
      default: false
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for user-scoped filtering, searching and sorting
documentSchema.index({ userId: 1, subject: 1 });
documentSchema.index({ userId: 1, semester: 1 });
documentSchema.index({ userId: 1, category: 1 });
documentSchema.index({ userId: 1, uploadedAt: -1 });

// Helper to normalize and deduplicate tags
documentSchema.pre('save', function () {
  if (this.tags && Array.isArray(this.tags)) {
    this.tags = [...new Set(this.tags.map((t) => t.trim()).filter(Boolean))];
  }
});

// Clean JSON serialization
documentSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Document = mongoose.model('Document', documentSchema);

export default Document;
