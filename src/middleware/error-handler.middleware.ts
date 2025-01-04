// src/middleware/error-handler.middleware.ts

import { BaseError, ValidationErrorItem } from "@/types/common.types";
import { NextFunction, Request, Response } from "express";
import { MongoServerError } from "mongodb";
import { Error as MongooseError } from "mongoose";
import { AppError, NotFoundError } from "../utils/errors/custom-errors";
import { ResponseFormatter } from "../utils/response-formatter";

// Custom type for express-validator ValidationError
interface ExpressValidationError extends BaseError {
  array: () => ValidationErrorItem[];
}

// Combined error type
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
  // Log error
  console.error("Error:", {
    name: err.name,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  // Default error
  let statusCode = 500;
  let message = "Internal Server Error";
  let errors: any[] | undefined;

  // Handle operational errors (our custom AppError)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  }
  // Handle Mongoose validation errors
  else if (err instanceof MongooseError.ValidationError) {
    statusCode = 422;
    message = "Validation Error";
    errors = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));
  }
  // Handle MongoDB duplicate key errors
  else if (err instanceof MongoServerError && err.code === 11000) {
    statusCode = 409;
    message = "Duplicate Entry";
    if (err.keyPattern && typeof err.keyPattern === "object") {
      const field = Object.keys(err.keyPattern)[0];
      errors = [
        {
          field,
          message: `${field} already exists`,
        },
      ];
    }
  }
  // Handle Express Validator errors
  else if ("array" in err && typeof err.array === "function") {
    statusCode = 422;
    message = "Validation Error";
    errors = err.array();
  }

  const formattedResponse = ResponseFormatter.error(
    message,
    statusCode,
    errors,
    req.path,
    process.env.NODE_ENV === "development" ? err.stack : undefined
  );

  res.status(statusCode).json(formattedResponse);
};

// Catch 404 and forward to error handler
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  throw new NotFoundError();
};
