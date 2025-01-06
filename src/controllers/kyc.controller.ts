// src/controllers/kyc.controller.ts
import { KycRepository } from "@/repositories/kyc.repository";
import { UserRole } from "@/types/user.types";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/utils/errors/custom-errors";
import Logger from "@/utils/logger";
import { ResponseFormatter } from "@/utils/response-formatter";
import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";

export class KycController {
  private static instance: KycController;
  private kycRepository: KycRepository;
  private readonly UPLOAD_DIR = "uploads/kyc-documents";

  private constructor() {
    this.kycRepository = KycRepository.getInstance();
    this.ensureUploadDirectory();
  }

  public static getInstance(): KycController {
    if (!KycController.instance) {
      KycController.instance = new KycController();
    }
    return KycController.instance;
  }

  private async ensureUploadDirectory() {
    try {
      await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
      Logger.info("KYC upload directory created/verified");
    } catch (error) {
      Logger.error("Failed to create KYC upload directory:", error);
      throw error;
    }
  }

  private async saveFile(
    file: Express.Multer.File,
    userId: string
  ): Promise<{ fileName: string; fileType: string; filePath: string }> {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${userId}-${Date.now()}${fileExtension}`;
    const filePath = path.join(this.UPLOAD_DIR, fileName);

    try {
      await fs.writeFile(filePath, file.buffer);
      return {
        fileName: file.originalname,
        fileType: file.mimetype,
        filePath: filePath,
      };
    } catch (error) {
      Logger.error("Failed to save KYC document:", error);
      throw new BadRequestError("Failed to save document");
    }
  }

  public submitKyc = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const kycData = req.body;

    Logger.info("KYC submission received:", {
      userId,
      hasFile: !!req.file,
      fileDetails: req.file,
      body: req.body,
    });

    if (!req.file) {
      Logger.error("File upload missing in request");
      throw new BadRequestError("ID document file is required");
    }

    // Check if user already has a pending or approved KYC
    const existingKyc = await this.kycRepository.findLatestKycByUserId(userId);
    if (
      existingKyc &&
      (existingKyc.status === "pending" || existingKyc.status === "approved")
    ) {
      throw new BadRequestError(
        existingKyc.status === "pending"
          ? "You already have a pending KYC submission"
          : "Your KYC has already been approved"
      );
    }

    if (!req.file) {
      Logger.error("File upload missing in request");
      throw new BadRequestError("ID document file is required");
    }

    const fileInfo = await this.saveFile(req.file, userId);
    const kyc = await this.kycRepository.createKyc(userId, kycData, fileInfo);

    Logger.info(`KYC submission created for user ${userId}`);
    res.status(201).json(
      ResponseFormatter.success(
        {
          kycId: kyc.id,
          status: kyc.status,
          submissionDate: kyc.submissionDate,
        },
        "KYC submission successful"
      )
    );
  };

  public updateKycStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const { kycId } = req.params;
    const { status, rejectionReason } = req.body;
    const reviewerId = req.user!.userId;

    // Verify admin role
    if (req.user!.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only administrators can update KYC status");
    }

    // Additional validation for rejection reason
    if (status === "rejected" && !rejectionReason) {
      throw new BadRequestError(
        "Rejection reason is required when rejecting a KYC"
      );
    }

    const updatedKyc = await this.kycRepository.updateKycStatus(
      kycId,
      reviewerId,
      {
        status,
        rejectionReason,
      }
    );

    Logger.info(
      `KYC ${kycId} status updated to ${status} by admin ${reviewerId}`
    );
    res.json(
      ResponseFormatter.success(
        {
          kycId: updatedKyc.id,
          status: updatedKyc.status,
          reviewDate: updatedKyc.reviewDate,
        },
        "KYC status updated successfully"
      )
    );
  };

  public getKycDetails = async (req: Request, res: Response): Promise<void> => {
    const { kycId } = req.params;
    const requesterId = req.user!.userId;
    const isAdmin = req.user!.role === UserRole.ADMIN;

    // Handle 'latest' special case or specific KYC ID
    const kyc = await this.kycRepository.findKycById(
      kycId,
      kycId === "latest" ? requesterId : undefined
    );
    // For 'latest' endpoint, return null if no KYC found
    if (!kyc && kycId === "latest") {
      res.json(
        ResponseFormatter.success(
          null,
          "No KYC submissions found for user",
          204
        )
      );
      return;
    }
    if (!kyc) {
      throw new NotFoundError("KYC submission not found");
    }

    // Verify access rights (admin or kyc owner)
    if (!isAdmin && kyc.userId.toString() !== requesterId) {
      throw new ForbiddenError("You don't have permission to view this KYC");
    }

    res.json(
      ResponseFormatter.success(
        {
          id: kyc.id,
          status: kyc.status,
          submittedAt: kyc.submissionDate,
          updatedAt: kyc.lastUpdated,
          reviewDate: kyc.reviewDate,
          rejectionReason: kyc.rejectionReason,
          firstName: kyc.firstName,
          lastName: kyc.lastName,
          dateOfBirth: kyc.dateOfBirth,
          address: kyc.address,
          idDocumentType: kyc.idDocumentType,
          idDocumentNumber: kyc.idDocumentNumber,
        },
        "KYC details retrieved successfully"
      )
    );
  };

  public getPendingKycSubmissions = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (req.user!.role !== UserRole.ADMIN) {
      throw new ForbiddenError(
        "Only administrators can view pending submissions"
      );
    }

    const { kyc, pagination } = await this.kycRepository.findKycByStatus(
      "pending",
      page,
      limit
    );

    res.json(
      ResponseFormatter.success(
        {
          submissions: kyc,
          pagination,
        },
        "Pending KYC submissions retrieved successfully"
      )
    );
  };

  public getKycStats = async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only administrators can view KYC statistics");
    }

    const stats = await this.kycRepository.getKycStats();

    res.json(
      ResponseFormatter.success(stats, "KYC statistics retrieved successfully")
    );
  };
}
