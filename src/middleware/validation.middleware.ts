import { BadRequestError } from "@/utils/errors/custom-errors";
import Logger from "@/utils/logger";
import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import { RequestHandler } from "express";

export function validateDto(dto: any): RequestHandler {
  return async (req, res, next) => {
    console.log("req.body", req.body);
    try {
      if (req.file) {
        Logger.info("File received:", {
          fieldname: req.file.fieldname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        });
      }

      const dtoObj = plainToInstance(dto, req.body);
      const errors = await validate(dtoObj, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      console.log("errors", errors);
      if (errors.length > 0) {
        const errorMessages = formatValidationErrors(errors);
        throw new BadRequestError("Validation failed", errorMessages);
      }

      req.validatedData = dtoObj;
      next();
    } catch (error) {
      throw error;
    }
  };
}

function formatValidationErrors(errors: ValidationError[]): string[] {
  const uniqueErrors = new Map<string, string>();

  errors.forEach((error: ValidationError) => {
    const constraints = error.constraints || {};

    // If the field is missing (undefined), set a "required" message
    if (
      "isNotEmpty" in constraints ||
      Object.keys(constraints).includes("isDefined")
    ) {
      uniqueErrors.set(error.property, `${error.property} is required`);
      return;
    }

    // For other validation errors, take the first error message for each field
    if (!uniqueErrors.has(error.property)) {
      const firstMessage = Object.values(constraints)[0];
      uniqueErrors.set(error.property, `${error.property}: ${firstMessage}`);
    }
  });

  return Array.from(uniqueErrors.values());
}
