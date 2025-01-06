/**
 * @swagger
 * components:
 *   schemas:
 *     AddressDto:
 *       type: object
 *       required:
 *         - street
 *         - city
 *         - state
 *         - country
 *         - postalCode
 *       properties:
 *         street:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: Street address
 *         city:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           description: City name
 *         state:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           description: State or province
 *         country:
 *           type: string
 *           pattern: '^[A-Z]{2}$'
 *           description: Two-letter country code (ISO)
 *         postalCode:
 *           type: string
 *           minLength: 1
 *           maxLength: 20
 *           description: Postal or ZIP code
 *
 *     SubmitKycDto:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - dateOfBirth
 *         - address
 *         - idDocumentType
 *         - idDocumentNumber
 *       properties:
 *         firstName:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *         lastName:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *         dateOfBirth:
 *           type: string
 *           format: date
 *         address:
 *           $ref: '#/components/schemas/AddressDto'
 *         idDocumentType:
 *           type: string
 *           enum: [passport, nationalId, drivingLicense]
 *         idDocumentNumber:
 *           type: string
 *           minLength: 5
 *           maxLength: 30
 *
 *     UpdateKycStatusDto:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [approved, rejected]
 *         rejectionReason:
 *           type: string
 *           maxLength: 500
 *           description: Required when status is rejected
 */

import { KycController } from "@/controllers/kyc.controller";
import { SubmitKycDto } from "@/dtos/kyc/submit-kyc.dto";
import { UpdateKycStatusDto } from "@/dtos/kyc/update-kyc-status.dto";
import { AuthMiddleware } from "@/middleware/auth.middleware";
import { RateLimiterMiddleware } from "@/middleware/rate-limit.middleware";
import { validateDto } from "@/middleware/validation.middleware";
import { Router } from "express";
import multer from "multer";

export class KycRoutes {
  private router: Router;
  private kycController: KycController;
  private authMiddleware: AuthMiddleware;
  private rateLimiter: RateLimiterMiddleware;
  private upload: multer.Multer;

  constructor() {
    this.router = Router();
    this.kycController = KycController.getInstance();
    this.authMiddleware = AuthMiddleware.getInstance();
    this.rateLimiter = new RateLimiterMiddleware();

    // Initialize multer directly in the constructor
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1,
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              "Invalid file type. Only JPEG, PNG and PDF files are allowed"
            )
          );
        }
      },
    });

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Configure rate limiter
    const kycSubmissionRateLimit = this.rateLimiter.createRateLimiter({
      windowMs: 24 * 60 * 60 * 1000,
      max: 10000,
      keyPrefix: "kyc-submission",
    });

    /**
     * @swagger
     * /api/v1/kyc/submit:
     *   post:
     *     summary: Submit KYC documentation
     *     tags: [KYC]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             required:
     *               - idDocument
     *               - firstName
     *               - lastName
     *               - dateOfBirth
     *               - address
     *               - idDocumentType
     *               - idDocumentNumber
     *             properties:
     *               idDocument:
     *                 type: string
     *                 format: binary
     *                 description: ID document file (JPEG, PNG, or PDF, max 5MB)
     *               firstName:
     *                 type: string
     *               lastName:
     *                 type: string
     *               dateOfBirth:
     *                 type: string
     *                 format: date
     *               address:
     *                 $ref: '#/components/schemas/AddressDto'
     *               idDocumentType:
     *                 type: string
     *                 enum: [passport, nationalId, drivingLicense]
     *               idDocumentNumber:
     *                 type: string
     *     responses:
     *       201:
     *         description: KYC submission successful
     *       400:
     *         description: Invalid input or file type
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.post(
      "/submit",
      this.authMiddleware.verifyAccessToken,
      kycSubmissionRateLimit,

      this.upload.single("idDocument"), // File upload middleware
      validateDto(SubmitKycDto),
      this.kycController.submitKyc
    );

    /**
     * @swagger
     * /api/v1/kyc/{kycId}/status:
     *   patch:
     *     summary: Update KYC submission status (Admin only)
     *     tags: [KYC]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: kycId
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UpdateKycStatusDto'
     *     responses:
     *       200:
     *         description: KYC status updated successfully
     *       403:
     *         description: Insufficient permissions
     */
    this.router.patch(
      "/:kycId/status",
      this.authMiddleware.verifyAccessToken,
      validateDto(UpdateKycStatusDto),
      this.kycController.updateKycStatus
    );

    /**
     * @swagger
     * /api/v1/kyc/pending:
     *   get:
     *     summary: Get pending KYC submissions (Admin only)
     *     tags: [KYC]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: Page number
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Items per page
     *     responses:
     *       200:
     *         description: List of pending KYC submissions
     *       403:
     *         description: Insufficient permissions
     */
    this.router.get(
      "/pending",
      this.authMiddleware.verifyAccessToken,
      this.kycController.getPendingKycSubmissions
    );

    /**
     * @swagger
     * /api/v1/kyc/stats:
     *   get:
     *     summary: Get KYC statistics (Admin only)
     *     tags: [KYC]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: KYC statistics retrieved successfully
     *       403:
     *         description: Insufficient permissions
     */

    this.router.get(
      "/stats",
      this.authMiddleware.verifyAccessToken,
      this.kycController.getKycStats
    );

    /**
     * @swagger
     * /api/v1/kyc/{kycId}:
     *   get:
     *     summary: Get KYC submission details
     *     tags: [KYC]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: kycId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: KYC details retrieved successfully
     *       403:
     *         description: Insufficient permissions
     *       404:
     *         description: KYC submission not found
     */
    this.router.get(
      "/:kycId",
      this.authMiddleware.verifyAccessToken,
      this.kycController.getKycDetails
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
