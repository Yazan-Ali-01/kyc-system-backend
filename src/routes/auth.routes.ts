/**
 * @swagger
 * components:
 *   schemas:
 *     LoginDto:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         password:
 *           type: string
 *           format: password
 *           description: User's password
 *
 *     RegisterDto:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         password:
 *           type: string
 *           format: password
 *           description: Password (min 8 chars, must contain letter and number)
 *         firstName:
 *           type: string
 *           minLength: 2
 *           description: User's first name
 *         lastName:
 *           type: string
 *           minLength: 2
 *           description: User's last name
 *         role:
 *           type: string
 *           enum: [user, admin]
 *           default: user
 *           description: User's role
 *
 *     SessionInfo:
 *       type: object
 *       properties:
 *         tokenId:
 *           type: string
 *           description: Unique identifier for the session
 *         deviceInfo:
 *           type: string
 *           description: Information about the device used
 *         ipAddress:
 *           type: string
 *           description: IP address of the device
 *         lastUsed:
 *           type: string
 *           format: date-time
 *           description: Last time the session was used
 *         expiryTime:
 *           type: string
 *           format: date-time
 *           description: When the session expires
 *
 *   responses:
 *     UnauthorizedError:
 *       description: Authentication failed
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: error
 *               message:
 *                 type: string
 *                 example: Invalid credentials
 *
 *     ValidationError:
 *       description: Validation failed
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: error
 *               message:
 *                 type: string
 *                 example: Validation failed
 *               errors:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     field:
 *                       type: string
 *                     message:
 *                       type: string
 *
 * tags:
 *   name: Authentication
 *   description: Authentication and session management endpoints
 */

import { AuthController } from "@/controllers/auth.controller";
import { LoginDto } from "@/dtos/auth/login.dto";
import { RegisterDto } from "@/dtos/auth/register.dto";
import { AuthMiddleware } from "@/middleware/auth.middleware";
import { RateLimiterMiddleware } from "@/middleware/rate-limit.middleware";
import { validateDto } from "@/middleware/validation.middleware";
import { Router } from "express";

export class AuthRoutes {
  private router: Router;
  private authController: AuthController;
  private authMiddleware: AuthMiddleware;
  private rateLimiter: RateLimiterMiddleware;

  constructor() {
    this.router = Router();
    this.authController = AuthController.getInstance();
    this.authMiddleware = AuthMiddleware.getInstance();
    this.rateLimiter = new RateLimiterMiddleware();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Rate limiter for auth routes
    const authRateLimit = this.rateLimiter.createRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000,
      keyPrefix: "auth",
    });

    /**
     * @swagger
     * /api/v1/auth/register:
     *   post:
     *     summary: Register a new user
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/RegisterDto'
     *     responses:
     *       201:
     *         description: User registered successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: success
     *                 data:
     *                   type: object
     *                   properties:
     *                     userId:
     *                       type: string
     *                     email:
     *                       type: string
     *                 message:
     *                   type: string
     *                   example: User registered successfully
     */

    this.router.post(
      "/register",
      authRateLimit,
      validateDto(RegisterDto),
      this.authController.register
    );

    /**
     * @swagger
     * /api/v1/auth/login:
     *   post:
     *     summary: User login
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/LoginDto'
     *     responses:
     *       200:
     *         description: Login successful
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: success
     *                 data:
     *                   type: object
     *                   properties:
     *                     userId:
     *                       type: string
     *                     role:
     *                       type: string
     *                     email:
     *                       type: string
     *                     firstName:
     *                       type: string
     *                     lastName:
     *                       type: string
     */

    this.router.post(
      "/login",
      authRateLimit,
      validateDto(LoginDto),
      this.authController.login
    );

    /**
     * @swagger
     * /api/v1/auth/refresh:
     *   post:
     *     summary: Refresh access token
     *     tags: [Authentication]
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Tokens refreshed successfully
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */

    this.router.post(
      "/refresh",
      authRateLimit,
      this.authMiddleware.verifyRefreshToken,
      this.authController.refresh
    );

    /**
     * @swagger
     * /api/v1/auth/logout:
     *   post:
     *     summary: Logout current session
     *     tags: [Authentication]
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Logged out successfully
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.post(
      "/logout",
      this.authMiddleware.verifyAccessToken,
      this.authController.logout
    );

    /**
     * @swagger
     * /api/v1/auth/logout-all:
     *   post:
     *     summary: Logout from all devices
     *     tags: [Authentication]
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Logged out from all devices successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: success
     *                 message:
     *                   type: string
     *                   example: Logged out from all devices successfully
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.post(
      "/logout-all",
      this.authMiddleware.verifyAccessToken,
      this.authController.logoutAll
    );

    /**
     * @swagger
     * /api/v1/auth/sessions:
     *   get:
     *     summary: Get all active sessions
     *     tags: [Authentication]
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Active sessions retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: success
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/SessionInfo'
     */
    this.router.get(
      "/sessions",
      this.authMiddleware.verifyAccessToken,
      this.authController.getSessions
    );

    /**
     * @swagger
     * /api/v1/auth/sessions/{sessionId}:
     *   delete:
     *     summary: Revoke a specific session
     *     tags: [Authentication]
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: sessionId
     *         required: true
     *         schema:
     *           type: string
     *         description: ID of the session to revoke
     *     responses:
     *       200:
     *         description: Session revoked successfully
     */
    this.router.delete(
      "/sessions/:sessionId",
      this.authMiddleware.verifyAccessToken,
      this.authController.revokeSession
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
