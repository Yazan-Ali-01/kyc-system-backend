import Logger from "@/utils/logger";
import { NextFunction, Request, Response } from "express";

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = new Date().getTime();

  res.on("finish", () => {
    const duration = new Date().getTime() - startTime;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 400) {
      Logger.error(message);
    } else {
      Logger.http(message);
    }
  });

  next();
};
