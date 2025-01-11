import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express, { Express } from "express";
import "express-async-errors";
import helmet from "helmet";
import "reflect-metadata";

import { loadEnvConfig } from "@/config/env";
import { swaggerSpec } from "@/config/swagger";
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
import * as swaggerUi from "swagger-ui-express";

class App {
  public app: Express;
  public server: any;
  private readonly JSON_LIMIT = "5mb";
  private readonly URL_ENCODED_LIMIT = "5mb";
  private readonly SHUTDOWN_TIMEOUT = 10000;
  private mongoDBService: MongoDBService;
  private redisService: RedisService;
  private rateLimiter: RateLimiterMiddleware;

  constructor() {
    this.app = express();
    this.mongoDBService = MongoDBService.getInstance();
    this.redisService = RedisService.getInstance();
    this.rateLimiter = new RateLimiterMiddleware();
  }

  public async init(): Promise<Express> {
    try {
      await this.loadEnvironment();
      await this.initializeServices();
      await this.setupMiddleware();
      this.setupSwagger();
      await this.setupRoutes();
      this.setupErrorHandling();
      return this.app;
    } catch (error) {
      Logger.error("Initialization failed:", error);
      throw new Error("Application initialization failed");
    }
  }

  private async loadEnvironment(): Promise<void> {
    Logger.info("Loading environment configuration...");
    try {
      await loadEnvConfig();
      Logger.info("Environment configuration loaded successfully");
    } catch (error) {
      Logger.error("Failed to load environment configuration:", error);
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    Logger.info("Initializing services...");

    try {
      // Initialize services concurrently
      await Promise.all([
        (async () => {
          Logger.info("Initializing MongoDB connection...");
          await this.mongoDBService.connect();
          Logger.info("MongoDB connection established");
        })(),
        (async () => {
          Logger.info("Initializing Redis connection...");
          await this.redisService.connect();
          Logger.info("Redis connection established");
        })(),
      ]);
    } catch (error) {
      Logger.error("Failed to initialize services:", error);
      throw error;
    }
  }

  private async setupMiddleware(): Promise<void> {
    Logger.info("Setting up middleware...");

    // Security middleware
    this.setupSecurityMiddleware();

    // Parse requests
    this.setupRequestParsing();

    // Compression (before routes)
    this.setupCompression();

    // Development logging
    this.setupDevelopmentLogging();

    // Health check
    this.setupHealthCheck();

    Logger.info("Middleware setup completed");
  }

  private setupSecurityMiddleware(): void {
    if (process.env.NODE_ENV === "production") {
      this.app.use(
        this.rateLimiter.createRateLimiter({
          windowMs: 15 * 60 * 1000,
          max: 100,
          keyPrefix: "global-rate-limit",
        })
      );
    }

    this.app.use(
      helmet({
        contentSecurityPolicy: process.env.NODE_ENV === "production",
        dnsPrefetchControl: true,
        frameguard: true,
        hidePoweredBy: true,
        hsts: process.env.NODE_ENV === "production",
        ieNoOpen: true,
        noSniff: true,
        xssFilter: true,
      })
    );

    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(",") || true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
        maxAge: 86400,
      })
    );
  }

  private setupRequestParsing(): void {
    this.app.use(express.json({ limit: this.JSON_LIMIT, strict: false }));
    this.app.use(
      express.urlencoded({ extended: true, limit: this.URL_ENCODED_LIMIT })
    );
    this.app.use(cookieParser(process.env.COOKIE_SECRET));
  }

  private setupCompression(): void {
    if (process.env.NODE_ENV === "production") {
      this.app.use(compression());
    }
  }

  private setupDevelopmentLogging(): void {
    if (process.env.NODE_ENV === "development") {
      this.app.use(requestLogger);
      this.app.use(monitoringMiddleware);
    }
  }

  private setupSwagger(): void {
    if (process.env.NODE_ENV !== "production") {
      this.app.use("/api-docs", (req, res, next) => {
        helmet({
          contentSecurityPolicy: false,
          crossOriginEmbedderPolicy: false,
        })(req, res, next);
      });

      this.app.use("/api-docs", swaggerUi.serve);
      this.app.get("/api-docs", swaggerUi.setup(swaggerSpec));

      this.app.get("/swagger.json", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.send(swaggerSpec);
      });

      Logger.info("Swagger UI initialized at /api-docs");
    }
  }

  private setupHealthCheck(): void {
    this.app.get("/health", (req, res) => {
      res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      });
    });
  }

  private async setupRoutes(): Promise<void> {
    Logger.info("Setting up routes...");

    if (process.env.NODE_ENV === "development") {
      this.app.use((req, res, next) => {
        Logger.info(
          `[DEBUG] Incoming request: ${req.method} ${req.originalUrl}`
        );
        next();
      });
    }

    this.app.use("/api/v1", routes);
    Logger.info("Routes setup completed");
  }

  private setupErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
    this.setupProcessErrorHandlers();
  }

  private setupProcessErrorHandlers(): void {
    process.on(
      "uncaughtException",
      this.handleFatalError("Uncaught Exception")
    );
    process.on(
      "unhandledRejection",
      this.handleFatalError("Unhandled Rejection")
    );
  }

  private handleFatalError(type: string) {
    return async (error: Error) => {
      Logger.error(`${type}:`, error);
      await this.gracefulShutdown("SIGTERM");
    };
  }

  public async gracefulShutdown(signal: string): Promise<void> {
    Logger.info(`Received ${signal}. Starting graceful shutdown...`);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Shutdown timed out"));
      }, this.SHUTDOWN_TIMEOUT);
    });

    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          if (this.server) {
            this.server.close(() => {
              Logger.info("HTTP server closed");
              resolve();
            });
          } else {
            resolve();
          }
        }),
        timeoutPromise,
      ]);

      await Promise.all([
        this.mongoDBService.disconnect(),
        this.redisService.disconnect(),
      ]);

      Logger.info("All connections closed successfully");
      process.exit(0);
    } catch (error) {
      Logger.error("Failed to shutdown gracefully:", error);
      process.exit(1);
    }
  }
}

const startServer = async () => {
  try {
    const app = new App();
    const initializedApp = await app.init();
    const port = process.env.PORT || 3000;

    const server = initializedApp.listen(port, () => {
      Logger.info(`Server listening on port ${port}`);
    });

    // Store server reference for graceful shutdown
    app.server = server;

    // Setup signal handlers for graceful shutdown
    const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
    signals.forEach((signal) => {
      process.on(signal, () => app.gracefulShutdown(signal));
    });
  } catch (error) {
    Logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Run the server
if (require.main === module) {
  startServer();
}

// Export for testing
export default App;
