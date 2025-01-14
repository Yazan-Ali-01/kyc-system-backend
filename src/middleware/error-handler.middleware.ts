import { BaseError, ValidationErrorItem } from "@/types/common.types";
import Logger from "@/utils/logger";
import { NextFunction, Request, Response } from "express";
import { MongoServerError } from "mongodb";
import { Error as MongooseError } from "mongoose";
import { AppError, NotFoundError } from "../utils/errors/custom-errors";
import { ResponseFormatter } from "../utils/response-formatter";

interface ExpressValidationError extends BaseError {
  array: () => ValidationErrorItem[];
}

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!res.headersSent) {
    Logger.info(`No route match: ${req.method} ${req.originalUrl}`);
    throw new NotFoundError();
  } else {
    next();
  }
};

type CombinedError = (
  | Error
  | AppError
  | MongoServerError
  | ExpressValidationError
) &
  BaseError;

export const errorHandler = (
  err: CombinedError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Logger.error("Error encountered:", {
    name: err.name,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    query: req.query,
    params: req.params,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  let statusCode = 500;
  let message = "Internal Server Error";
  let errors: any[] | undefined;

  if (err instanceof MongoServerError && err.code === 11000) {
    statusCode = 409;
    message = "Duplicate Entry";
    if (err.keyPattern && typeof err.keyPattern === "object") {
      const field = Object.keys(err.keyPattern)[0];
      const value = err.keyValue?.[field];
      errors = [
        {
          field,
          message: `${field} '${value}' already exists`,
        },
      ];
    }
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof MongooseError.ValidationError) {
    statusCode = 422;
    message = "Validation Error";
    errors = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));
  } else if ("array" in err && typeof err.array === "function") {
    statusCode = 422;
    message = "Validation Error";
    errors = err.array();
  }

  const formattedResponse = ResponseFormatter.error(
    message,
    statusCode,
    errors,
    req.path,
    process.env.NODE_ENV === "development"
      ? JSON.stringify({ error: err.message, stack: err.stack })
      : undefined
  );

  res.status(statusCode).json(formattedResponse);
};
