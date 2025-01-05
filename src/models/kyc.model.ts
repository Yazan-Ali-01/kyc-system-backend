import { IdDocumentType, KycStatus } from "@/types/kyc.types";
import mongoose, { Document, Schema } from "mongoose";

export interface IKYC extends Document {
  userId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  idDocumentType: string;
  idDocumentNumber: string;
  idDocumentFile: {
    fileName: string;
    fileType: string;
    filePath: string;
    uploadDate: Date;
  };
  status: KycStatus;
  submissionDate: Date;
  lastUpdated: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewDate?: Date;
  rejectionReason?: string;
  version: number;
}

const KYCSchema = new Schema<IKYC>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      postalCode: { type: String, required: true },
    },
    idDocumentType: {
      type: String,
      required: true,
      enum: Object.values(IdDocumentType),
    },
    idDocumentNumber: {
      type: String,
      required: true,
      unique: true,
    },
    idDocumentFile: {
      fileName: { type: String, required: true },
      fileType: { type: String, required: true },
      filePath: { type: String, required: true },
      uploadDate: { type: Date, default: Date.now },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    submissionDate: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewDate: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
KYCSchema.index({ status: 1, submissionDate: -1 });
KYCSchema.index({ userId: 1, version: -1 });

export const KYC = mongoose.model<IKYC>("KYC", KYCSchema);
