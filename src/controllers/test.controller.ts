// src/controllers/test.controller.ts

import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../utils/errors/custom-errors";
import { ResponseFormatter } from "../utils/response-formatter";

export class TestController {
  // Success responses
  public static getSuccess = asyncHandler(
    async (req: Request, res: Response) => {
      console.log("test22");
      const response = ResponseFormatter.success(
        {
          id: 1,
          name: "Test Data",
          timestamp: Date.now(),
        },
        "Success response with data",
        200
      );

      res.status(200).json(response);
    }
  );

  public static createSuccess = asyncHandler(
    async (req: Request, res: Response) => {
      const response = ResponseFormatter.success(
        {
          id: 2,
          ...req.body,
          createdAt: new Date(),
        },
        "Resource created successfully",
        201
      );

      res.status(201).json(response);
    }
  );

  // Error responses
  public static testErrors = asyncHandler(
    async (req: Request, res: Response) => {
      const { type } = req.query;

      switch (type) {
        case "bad-request":
          throw new BadRequestError("Invalid parameters provided", [
            {
              field: "email",
              message: "Invalid email format",
            },
            {
              field: "password",
              message: "Password must be at least 8 characters",
            },
          ]);

        case "unauthorized":
          throw new UnauthorizedError("Invalid authentication token");

        case "forbidden":
          throw new ForbiddenError(
            "Insufficient permissions to access resource"
          );

        case "not-found":
          throw new NotFoundError("Requested resource not found");

        case "conflict":
          throw new ConflictError("Resource already exists");

        case "validation":
          throw new ValidationError([
            {
              field: "username",
              message: "Username is required",
            },
            {
              field: "age",
              message: "Age must be a positive number",
            },
          ]);

        case "internal":
          throw new InternalServerError("Something went wrong with the server");

        case "operational":
          throw new AppError("Custom operational error", 422, [
            {
              code: "CUSTOM_ERROR",
              message: "This is a custom operational error",
            },
          ]);

        case "programmatic":
          // This will be caught as an unhandled error
          throw new Error("This is an unexpected programmatic error");

        case "async":
          await Promise.reject(new Error("This is an async error"));

        case "mongoose":
          // Simulate Mongoose validation error
          const error: any = new Error("Mongoose Validation Error");
          error.name = "ValidationError";
          error.errors = {
            field1: {
              path: "field1",
              message: "Field1 is required",
            },
            field2: {
              path: "field2",
              message: "Field2 must be unique",
            },
          };
          throw error;

        case "mongo":
          // Simulate MongoDB duplicate key error
          const mongoError: any = new Error("MongoDB Duplicate Key");
          mongoError.code = 11000;
          mongoError.keyPattern = { email: 1 };
          throw mongoError;

        default:
          const response = ResponseFormatter.success(
            { message: "No error triggered" },
            "Success response"
          );
          res.status(200).json(response);
      }
    }
  );

  // Test timeout error
  public static testTimeout = asyncHandler(
    async (req: Request, res: Response) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      throw new InternalServerError("Operation timed out");
    }
  );

  // Test successful async operation
  public static testAsync = asyncHandler(
    async (req: Request, res: Response) => {
      const result = await new Promise((resolve) =>
        setTimeout(() => resolve({ data: "Async operation completed" }), 1000)
      );

      const response = ResponseFormatter.success(
        result,
        "Async operation successful",
        200
      );

      res.status(200).json(response);
    }
  );

  // Test pagination
  public static testPagination = asyncHandler(
    async (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (page < 1 || limit < 1) {
        throw new BadRequestError("Invalid pagination parameters");
      }

      const totalItems = 100;
      const totalPages = Math.ceil(totalItems / limit);

      if (page > totalPages) {
        throw new NotFoundError("Page not found");
      }

      const items = Array.from({ length: limit }, (_, i) => ({
        id: (page - 1) * limit + i + 1,
        name: `Item ${(page - 1) * limit + i + 1}`,
      }));

      const response = ResponseFormatter.success(
        {
          items,
          pagination: {
            page,
            limit,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
        "Paginated data retrieved successfully",
        200
      );

      res.status(200).json(response);
    }
  );
}
