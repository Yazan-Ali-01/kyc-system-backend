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

    // Auth routes
    this.router.post(
      "/register",
      authRateLimit,
      validateDto(RegisterDto),
      this.authController.register
    );

    this.router.post(
      "/login",
      authRateLimit,
      validateDto(LoginDto),
      this.authController.login
    );

    this.router.post(
      "/refresh",
      authRateLimit,
      this.authMiddleware.verifyRefreshToken,
      this.authController.refresh
    );

    this.router.post(
      "/logout",
      this.authMiddleware.verifyAccessToken,
      this.authController.logout
    );

    this.router.post(
      "/logout-all",
      this.authMiddleware.verifyAccessToken,
      this.authController.logoutAll
    );

    this.router.get(
      "/sessions",
      this.authMiddleware.verifyAccessToken,
      this.authController.getSessions
    );

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
