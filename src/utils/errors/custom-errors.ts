export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly status: string;
  public readonly errors?: any[];

  constructor(statusCode: number, message: string, errors?: any[]) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    const message = "Rate limit exceeded";
    const errors = [
      {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Too many requests. Please try again in ${retryAfterSeconds} seconds`,
        retryAfter: retryAfterSeconds,
      },
    ];

    super(429, message, errors);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request", errors?: any[]) {
    super(400, message, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflict") {
    super(409, message);
  }
}

export class ValidationError extends AppError {
  constructor(errors: any[]) {
    super(422, "Validation Error", errors);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal Server Error") {
    super(500, message);
  }
}
