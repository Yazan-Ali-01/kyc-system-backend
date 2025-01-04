import { ApiResponse } from "@/types/common.types";

export class ResponseFormatter {
  static success<T>(
    data?: T,
    message?: string,
    statusCode: number = 200
  ): ApiResponse<T> {
    return {
      success: true,
      statusCode,
      message,
      data,
      timestamp: Date.now(),
    };
  }

  static error(
    message: string,
    statusCode: number,
    errors?: any[],
    path?: string,
    stack?: string
  ): ApiResponse<null> {
    const response: ApiResponse<null> = {
      success: false,
      statusCode,
      message,
      errors,
      timestamp: Date.now(),
      path,
    };

    if (stack) {
      response.stack = stack;
    }

    return response;
  }
}
