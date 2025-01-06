import { ReportsController } from "@/controllers/reports.controller";
import { AuthMiddleware } from "@/middleware/auth.middleware";
import { RateLimiterMiddleware } from "@/middleware/rate-limit.middleware";
import { UserRole } from "@/types/user.types";
import { Router } from "express";

export class ReportsRoutes {
  private router: Router;
  private reportsController: ReportsController;
  private authMiddleware: AuthMiddleware;
  private rateLimiter: RateLimiterMiddleware;

  constructor() {
    this.router = Router();
    this.reportsController = ReportsController.getInstance();
    this.authMiddleware = AuthMiddleware.getInstance();
    this.rateLimiter = new RateLimiterMiddleware();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    const reportsRateLimit = this.rateLimiter.createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 100,
      keyPrefix: "reports",
    });

    /**
     * @swagger
     * /api/v1/reports/overview:
     *   get:
     *     summary: Get KYC overview statistics
     *     tags: [Reports]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Overview statistics retrieved successfully
     *       403:
     *         description: Insufficient permissions
     */
    this.router.get(
      "/overview",
      this.authMiddleware.verifyAccessToken,
      this.authMiddleware.checkRole([UserRole.ADMIN]),
      reportsRateLimit,
      this.reportsController.getOverviewStats
    );

    /**
     * @swagger
     * /api/v1/reports/timeline:
     *   get:
     *     summary: Get KYC submission timeline data
     *     tags: [Reports]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *     responses:
     *       200:
     *         description: Timeline data retrieved successfully
     *       403:
     *         description: Insufficient permissions
     */
    this.router.get(
      "/timeline",
      this.authMiddleware.verifyAccessToken,
      this.authMiddleware.requireAdmin,
      reportsRateLimit,
      this.reportsController.getTimelineData
    );

    /**
     * @swagger
     * /api/v1/reports/documents:
     *   get:
     *     summary: Get document type distribution
     *     tags: [Reports]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Document distribution data retrieved successfully
     *       403:
     *         description: Insufficient permissions
     */
    this.router.get(
      "/documents",
      this.authMiddleware.verifyAccessToken,
      this.authMiddleware.requireAdmin,
      reportsRateLimit,
      this.reportsController.getDocumentDistribution
    );

    /**
     * @swagger
     * /api/v1/reports/geography:
     *   get:
     *     summary: Get geographical distribution of KYC submissions
     *     tags: [Reports]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Geographical distribution data retrieved successfully
     *       403:
     *         description: Insufficient permissions
     */
    this.router.get(
      "/geography",
      this.authMiddleware.verifyAccessToken,
      this.authMiddleware.requireAdmin,
      reportsRateLimit,
      this.reportsController.getGeographicalDistribution
    );

    /**
     * @swagger
     * /api/v1/reports/processing-time:
     *   get:
     *     summary: Get KYC processing time analytics
     *     tags: [Reports]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *     responses:
     *       200:
     *         description: Processing time data retrieved successfully
     *       403:
     *         description: Insufficient permissions
     */
    this.router.get(
      "/processing-time",
      this.authMiddleware.verifyAccessToken,
      this.authMiddleware.requireAdmin,
      reportsRateLimit,
      this.reportsController.getProcessingTimeAnalytics
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
