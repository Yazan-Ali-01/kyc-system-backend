export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: any[];

  constructor(message: string, statusCode: number, errors?: any[]) {
    super(message);
    this.statusCode = statusCode;
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

    super(message, 429, errors); // 429 is the standard HTTP status code for rate limiting
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request", errors?: any[]) {
    super(message, 400, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflict") {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(errors: any[]) {
    super("Validation Error", 422, errors);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal Server Error") {
    super(message, 500);
  }
}
