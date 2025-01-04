import cors from "cors";
import "dotenv/config";
import express, { Express, Router } from "express";
import "express-async-errors";
import helmet from "helmet";

import { loadEnvConfig } from "@/config/env";
import {
  errorHandler,
  notFoundHandler,
} from "@/middleware/error-handler.middleware";
import { requestLogger } from "@/middleware/logging.middleware";
import { monitoringMiddleware } from "@/middleware/monitoring.middleware";
import { RateLimiterMiddleware } from "@/middleware/rate-limit.middleware";
import routes from "@/routes";
import { MongoDBService } from "@/services/mongodb.service";
import { RedisService } from "@/services/redis.service";
import Logger from "@/utils/logger";

class App {
  public app: Express;
  private middleware: Router;
  private mongoDBService: MongoDBService;
  private rateLimiter: RateLimiterMiddleware;
  private redisService: RedisService;

  constructor() {
    this.app = express();
    this.middleware = Router();
    this.mongoDBService = MongoDBService.getInstance();
    this.redisService = RedisService.getInstance();
    this.rateLimiter = new RateLimiterMiddleware();

    // Set up basic Express middleware first
    this.app.use(express.json({ limit: "10kb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10kb" }));

    this.setupHealthCheck();
  }

  public async init(): Promise<Express> {
    await this.initialize();
    return this.app;
  }

  private setupHealthCheck(): void {
    this.app.get("/health", (req, res) => {
      Logger.info("Health check accessed");
      res.status(200).send("healthy");
    });
  }

  private async initialize() {
    Logger.info("Beginning initialize sequence");

    Logger.info("Loading environment configuration...");
    try {
      loadEnvConfig();
      Logger.info("Environment configuration loaded successfully");
    } catch (error) {
      Logger.error("Failed to load environment configuration:", error);
      throw error;
    }

    Logger.info("Initializing MongoDB connection...");
    try {
      await this.mongoDBService.connect();
      Logger.info("MongoDB connection established");
    } catch (error) {
      Logger.error("Failed to initialize MongoDB:", error);
      throw error;
    }

    Logger.info("Initializing Redis connection...");
    try {
      await this.redisService.connect();
      Logger.info("Redis connection established");
    } catch (error) {
      Logger.error("Failed to initialize Redis:", error);
      throw error;
    }

    Logger.info("Setting up middleware...");
    this.setupMiddleware();
    Logger.info("Middleware setup completed");

    Logger.info("Setting up routes...");
    this.setupRoutes();
    Logger.info("Routes setup completed");

    Logger.info("Setting up error handling...");
    this.setupErrorHandling();
    Logger.info("Error handling setup completed");
  }
  private setupMiddleware(): void {
    // Add basic middleware first
    this.app.use(requestLogger);
    this.app.use(monitoringMiddleware);

    // Configure security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
      })
    );

    // Configure CORS
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
        maxAge: 86400,
      })
    );

    // Set up rate limiters
    const globalRateLimit = this.rateLimiter.createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 100,
    });

    // Apply rate limiters
    this.app.use(globalRateLimit);

    // Mount the middleware router
    this.app.use(this.middleware);
  }

  private setupRoutes(): void {
    Logger.info("Starting route setup");

    // Basic logger for all requests
    this.app.use((req, res, next) => {
      Logger.info(`[DEBUG] Incoming request: ${req.method} ${req.originalUrl}`);
      next();
    });

    // Test server route
    this.app.get("/test-server", (req, res) => {
      Logger.info("Test server accessed");
      res.json({ message: "Express server is working" });
    });

    // Mount the API v1 router to the main app
    this.app.use("/api/v1", routes);

    // Catch-all for unmatched routes
    this.app.use((req, res, next) => {
      Logger.info(`Unmatched route: ${req.method} ${req.originalUrl}`);
      next();
    });

    Logger.info("Routes setup completed");
  }

  private setupErrorHandling(): void {
    // Middleware error logger
    this.app.use((err: any, req: any, res: any, next: any) => {
      Logger.error("Initial error catch:", err);
      throw err;
    });

    // 404 handler for unmatched routes
    this.app.use((req, res, next) => {
      if (!res.headersSent) {
        Logger.info(`No route match: ${req.method} ${req.originalUrl}`);
        notFoundHandler(req, res, next);
      } else {
        next();
      }
    });

    // Final error handler
    this.app.use((err: any, req: any, res: any, next: any) => {
      Logger.error("Final error handler:", {
        error: err,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
      });

      // Ensure we don't send multiple responses
      if (!res.headersSent) {
        errorHandler(err, req, res, next);
      }
    });

    // Process error handlers
    process.on("uncaughtException", (error) => {
      Logger.error("Uncaught Exception:", error);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      Logger.error("Unhandled Rejection:", reason);
    });
  }

  public async shutdown(): Promise<void> {
    Logger.info("Shutting down application...");

    try {
      await this.mongoDBService.disconnect();
      await this.redisService.disconnect();
      Logger.info("All connections closed successfully");
    } catch (error) {
      Logger.error("Error during shutdown:", error);
      throw error;
    }
  }
}

// Start the server
Logger.info("Server starting...");
const startServer = async () => {
  try {
    const app = new App();
    const initializedApp = await app.init();
    const port = process.env.PORT || 3000;

    const server = initializedApp.listen(port, () => {
      Logger.info(`Server listening on port ${port}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      Logger.info(`Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        Logger.info("HTTP server closed");

        try {
          await app.shutdown();
          Logger.info("All connections closed successfully");
          process.exit(0);
        } catch (error) {
          Logger.error("Error during shutdown:", error);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        Logger.error("Forced shutdown due to timeout");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    Logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
