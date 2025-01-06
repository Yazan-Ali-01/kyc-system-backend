// src/repositories/kyc.repository.ts
import { IKYC, KYC } from "@/models/kyc.model";
import { KycStatus, KycSubmissionDto, KycUpdateDto } from "@/types/kyc.types";
import { NotFoundError } from "@/utils/errors/custom-errors";
import mongoose from "mongoose";

export class KycRepository {
  private static instance: KycRepository;

  private constructor() {}

  public static getInstance(): KycRepository {
    if (!KycRepository.instance) {
      KycRepository.instance = new KycRepository();
    }
    return KycRepository.instance;
  }

  public async createKyc(
    userId: string,
    kycData: KycSubmissionDto,
    fileInfo: { fileName: string; fileType: string; filePath: string }
  ): Promise<IKYC> {
    const kyc = new KYC({
      userId: new mongoose.Types.ObjectId(userId),
      ...kycData,
      idDocumentFile: {
        ...fileInfo,
        uploadDate: new Date(),
      },
    });

    return await kyc.save();
  }

  public async findKycById(
    kycId: string,
    userId?: string
  ): Promise<IKYC | null> {
    if (kycId === "latest" && userId) {
      // Find the latest KYC submission for the user
      return await KYC.findOne({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ submissionDate: -1 })
        .exec();
    }

    // Regular findById for specific KYC ID
    return await KYC.findById(kycId);
  }

  public async findLatestKycByUserId(userId: string): Promise<IKYC | null> {
    return await KYC.findOne({ userId }).sort({ submissionDate: -1 }).exec();
  }

  public async updateKycStatus(
    kycId: string,
    reviewerId: string,
    updateData: KycUpdateDto
  ): Promise<IKYC> {
    const kyc = await KYC.findById(kycId);
    if (!kyc) {
      throw new NotFoundError("KYC submission not found");
    }

    kyc.status = updateData.status;
    kyc.reviewedBy = new mongoose.Types.ObjectId(reviewerId);
    kyc.reviewDate = new Date();
    kyc.lastUpdated = new Date();

    if (updateData.status === "rejected" && updateData.rejectionReason) {
      kyc.rejectionReason = updateData.rejectionReason;
    }

    return await kyc.save();
  }

  public async findKycByStatus(
    status: KycStatus,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;

    const [kyc, total] = await Promise.all([
      KYC.find({ status })
        .sort({ submissionDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      KYC.countDocuments({ status }),
    ]);

    return {
      kyc,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async getKycStats() {
    const stats = await KYC.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const formattedStats = stats.reduce((acc: Record<string, number>, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    return {
      pending: formattedStats["pending"] || 0,
      approved: formattedStats["approved"] || 0,
      rejected: formattedStats["rejected"] || 0,
      total: Object.values(formattedStats).reduce((a, b) => a + b, 0),
    };
  }
}
