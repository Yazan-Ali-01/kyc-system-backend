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

      const dtoObj = plainToInstance(dto, req.body, {
        enableImplicitConversion: true,
        excludeExtraneousValues: false,
      });
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
  const formattedErrors: string[] = [];

  function processError(error: ValidationError, prefix = "") {
    if (error.constraints) {
      const firstMessage = Object.values(error.constraints)[0];
      formattedErrors.push(`${prefix}${error.property}: ${firstMessage}`);
    }

    if (error.children && error.children.length > 0) {
      error.children.forEach((childError) => {
        const childPrefix = prefix
          ? `${prefix}${error.property}.`
          : `${error.property}.`;
        processError(childError, childPrefix);
      });
    }
  }

  errors.forEach((error) => processError(error));
  return formattedErrors;
}
