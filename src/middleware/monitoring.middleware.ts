import { InternalServerError } from "@/utils/errors/custom-errors";
import Logger from "@/utils/logger";
import { ResponseFormatter } from "@/utils/response-formatter";
import { NextFunction, Request, Response } from "express";
import promClient from "prom-client";

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const httpRequestsTotalCounter = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotalCounter);

export const metricsMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.set("Content-Type", register.contentType);
    const metrics = await register.metrics();
    res.json(ResponseFormatter.success(metrics));
  } catch (error) {
    Logger.error("Error generating metrics:", error);
    throw new InternalServerError("Error generating metrics");
  }
};

export const monitoringMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = process.hrtime();

  res.on("finish", () => {
    try {
      const duration = process.hrtime(start);
      const durationInSeconds = duration[0] + duration[1] / 1e9;

      httpRequestDurationMicroseconds
        .labels(req.method, req.path, res.statusCode.toString())
        .observe(durationInSeconds);

      httpRequestsTotalCounter
        .labels(req.method, req.path, res.statusCode.toString())
        .inc();
    } catch (error) {
      Logger.error("Error recording metrics:", error);
      // I'm not throwing error here as this is post-response monitoring
    }
  });

  next();
};
