import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import swaggerUi from "swagger-ui-express";

import express, { Express, Router } from "express";
import "express-async-errors";
import helmet from "helmet";
import "reflect-metadata";

import { loadEnvConfig } from "@/config/env";
import { swaggerSpec } from "@/config/swagger";
import { errorHandler } from "@/middleware/error-handler.middleware";
import { requestLogger } from "@/middleware/logging.middleware";
import { monitoringMiddleware } from "@/middleware/monitoring.middleware";
import { RateLimiterMiddleware } from "@/middleware/rate-limit.middleware";
import routes from "@/routes";
import { MongoDBService } from "@/services/mongodb.service";
import { RedisService } from "@/services/redis.service";
import { AppError, NotFoundError } from "@/utils/errors/custom-errors";
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

    const jsonLimit = "5mb";
    const urlEncodedLimit = "5mb";

    // Set up basic Express middleware first
    this.app.use(
      express.json({
        limit: jsonLimit,
        strict: false,
      })
    );
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: urlEncodedLimit,
      })
    );

    this.app.use((req, res, next) => {
      if (req.headers["content-type"]?.includes("multipart/form-data")) {
        return next();
      }
      express.json({ limit: jsonLimit })(req, res, next);
    });

    this.setupHealthCheck();
  }

  private setupSwagger(): void {
    if (process.env.NODE_ENV !== "production") {
      // Disable helmet for Swagger UI
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

    Logger.info("Setting up Swagger...");
    this.setupSwagger();
    Logger.info("Swagger setup completed");

    Logger.info("Setting up routes...");
    this.setupRoutes();
    Logger.info("Routes setup completed");

    Logger.info("Setting up error handling...");
    this.setupErrorHandling();
    Logger.info("Error handling setup completed");
  }
  private setupMiddleware(): void {
    this.app.use(
      cors({
        origin: true, // TBD update in production
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
        maxAge: 86400,
      })
    );

    this.app.get("/test-cors", (req, res) => {
      console.log("Test CORS endpoint reached");
      res.json({ message: "CORS test successful" });
    });

    // 2. Basic parsing middleware
    this.app.use(express.json({ limit: "5mb", strict: false }));
    this.app.use(express.urlencoded({ extended: true, limit: "5mb" }));
    this.app.use(cookieParser());

    // 3. Security middleware
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

    // 4. Logging and monitoring
    this.app.use(requestLogger);
    this.app.use(monitoringMiddleware);

    // 5. Rate limiting
    const globalRateLimit = this.rateLimiter.createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 10000,
    });
    this.app.use(globalRateLimit);

    // 6. Mount the middleware router
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

    Logger.info("Routes setup completed");
  }

  private setupErrorHandling(): void {
    // 404 handler for unmatched routes
    this.app.use((req, res, next) => {
      if (!res.headersSent) {
        Logger.info(`No route match: ${req.method} ${req.originalUrl}`);
        throw new NotFoundError();
      } else {
        next();
      }
    });

    this.app.use(errorHandler);

    // Process error handlers for truly uncaught errors
    process.on("uncaughtException", (error: Error) => {
      Logger.error("Uncaught Exception:", error);

      if (error instanceof AppError && error.isOperational) {
        Logger.info("Operational error, no need to crash");
        return;
      }

      Logger.error("Fatal error encountered, shutting down");
      process.exit(1);
    });

    process.on("unhandledRejection", (reason: any) => {
      Logger.error("Unhandled Rejection:", reason);

      if (reason instanceof AppError && reason.isOperational) {
        Logger.info("Operational error, no need to crash");
        return;
      }

      Logger.error("Fatal error encountered, shutting down");
      process.exit(1);
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
