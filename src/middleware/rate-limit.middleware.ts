import { RedisService } from "@/services/redis.service";
import {
  InternalServerError,
  RateLimitError,
} from "@/utils/errors/custom-errors";
import Logger from "@/utils/logger";
import { NextFunction, Request, Response } from "express";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export class RateLimiterMiddleware {
  private redis: RedisService;

  constructor() {
    this.redis = RedisService.getInstance();
  }

  public createRateLimiter(config: RateLimitConfig) {
    return async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const key = `${config.keyPrefix || "rate-limit"}:${req.ip}`;
      const client = this.redis.getClient();

      try {
        const [requests] = await Promise.all([
          client.incr(key),
          client.expire(key, Math.floor(config.windowMs / 1000)),
        ]);

        const remaining = Math.max(0, config.max - requests);
        const retryAfterSeconds = Math.floor(config.windowMs / 1000);

        res.setHeader("X-RateLimit-Limit", config.max);
        res.setHeader("X-RateLimit-Remaining", remaining);

        if (requests > config.max) {
          throw new RateLimitError(retryAfterSeconds);
        }

        next();
      } catch (error) {
        Logger.error("Rate limiting error:", error);
        throw new InternalServerError("Rate limiting system error");
      }
    };
  }
}
